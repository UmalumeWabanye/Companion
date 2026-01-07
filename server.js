// HER — Optional AI backend (Express + OpenAI)
// Requires: OPENAI_API_KEY in environment

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], methods: ['POST'] }));
// --- Persistence: SQLite (local file her.db) ---
const db = new Database('her.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    mood TEXT NOT NULL,
    answers TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migrate: add questions column to conversations to remember asked prompts
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN questions TEXT`);
} catch (e) {
  // ignore if column exists
}
// Add emotions column if missing
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN emotions TEXT`);
} catch (e) {
  // ignore if column exists
}

const upsertUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');
const insertConv = db.prepare('INSERT INTO conversations (user_id, mood, emotions, answers, message, questions) VALUES (?, ?, ?, ?, ?, ?)');
const getConvsByUser = db.prepare('SELECT id, mood, emotions, answers, message, questions, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
const getAllConvsByUser = db.prepare('SELECT mood, emotions, answers, message, questions FROM conversations WHERE user_id = ?');
const getAllConvsByUserWithDate = db.prepare('SELECT questions, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC');

// Utility: detect theme (mirror client)
function detectTheme(text) {
  text = (text || '').toLowerCase();
  const themes = [
    { key: 'loss', match: /(lost|passed away|death|grief|bereave|funeral)/ },
    { key: 'relationship', match: /(break.?up|divorce|partner|relationship|love)/ },
    { key: 'work', match: /(job|work|boss|layoff|fired|career|deadline)/ },
    { key: 'health', match: /(health|sick|ill|injury|diagnos)/ },
    { key: 'family', match: /(family|parent|mother|father|sibling|child)/ },
    { key: 'money', match: /(money|debt|rent|bills|finance)/ },
    { key: 'isolation', match: /(alone|lonely|isolated)/ },
    { key: 'overwhelm', match: /(overwhelm|too much|anxious|panic)/ },
  ];
  return themes.find(t => t.match.test(text))?.key || 'general';
}

// --- API: Save conversation ---
app.post('/api/conversation', (req, res) => {
  try {
    const { userId, mood, emotions, answers, message, questions } = req.body || {};
    if (!userId || !mood) return res.status(400).json({ error: 'userId and mood required' });
    upsertUser.run(userId);
    const answersStr = typeof answers === 'string' ? answers : JSON.stringify(answers || {});
    const questionsStr = typeof questions === 'string' ? questions : (questions ? JSON.stringify(questions) : null);
    const emotionsStr = Array.isArray(emotions) ? JSON.stringify(emotions) : (typeof emotions === 'string' ? emotions : null);
    insertConv.run(userId, mood, emotionsStr, answersStr, message || null, questionsStr);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'save failed' });
  }
});

// --- API: List conversations by user ---
app.post('/api/conversations', (req, res) => {
  try {
    const { userId, limit = 20, offset = 0 } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const rows = getConvsByUser.all(userId, Number(limit), Number(offset));
    res.json({ conversations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'fetch failed' });
  }
});

// --- API: Aggregate themes by user ---
app.post('/api/themes', (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const rows = getAllConvsByUser.all(userId);
    const counts = {};
    for (const r of rows) {
      // Prefer answers, fallback to message
      let text = '';
      try {
        const obj = JSON.parse(r.answers || '{}');
        text = Object.values(obj).join(' \n ');
      } catch {
        text = r.answers || '';
      }
      const t = detectTheme(text || r.message || '');
      counts[t] = (counts[t] || 0) + 1;
    }
    res.json({ themes: counts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'themes failed' });
  }
});

// --- Fixed Catalog: load and serve non-repeating questions ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const catalogPath = path.join(__dirname, 'data', 'questions.json');
let QUESTIONS_CATALOG = [];
try {
  const raw = fs.readFileSync(catalogPath, 'utf8');
  QUESTIONS_CATALOG = JSON.parse(raw);
} catch (e) {
  console.warn('Questions catalog missing or invalid at', catalogPath);
  QUESTIONS_CATALOG = [];
}

function getAskedMeta(userId) {
  const rows = getAllConvsByUserWithDate.all(userId);
  const meta = new Map(); // id -> { count, lastTs }
  for (const r of rows) {
    let arr = [];
    try {
      arr = JSON.parse(r.questions || '[]');
    } catch {}
    if (!Array.isArray(arr)) continue;
    const ts = Date.parse(r.created_at || '');
    for (const q of arr) {
      const id = q?.id;
      if (!id) continue;
      const prev = meta.get(id) || { count: 0, lastTs: 0 };
      const lastTs = Math.max(prev.lastTs, isNaN(ts) ? 0 : ts);
      meta.set(id, { count: prev.count + 1, lastTs });
    }
  }
  return meta;
}

function selectFromCatalog({ userId, mood, emotions = [], limit = 8, lastContextText = '' }) {
  const meta = getAskedMeta(userId);
  const now = Date.now();
  const COOL_DOWN_MS = Math.floor(3.5 * 7 * 24 * 60 * 60 * 1000); // 3.5 weeks
  const theme = detectTheme(lastContextText);
  const priorityCats = [];
  if (theme === 'relationship') priorityCats.push('patterns', 'boundaries');
  if (theme === 'loss') priorityCats.push('support', 'future_self');
  if (theme === 'overwhelm') priorityCats.push('make_or_break', 'support');
  if (theme === 'money') priorityCats.push('non_negotiable');
  if (theme === 'health') priorityCats.push('safety');
  const prioritySet = new Set(priorityCats);

  // Filter by emotions/tags or mood (include general "all")
  const selected = Array.isArray(emotions) ? emotions.map(s => String(s).toLowerCase()) : [];
  const byMood = QUESTIONS_CATALOG.filter(q => {
    const tags = (q.tags || []).map(s => String(s).toLowerCase());
    const moods = (q.moods || []).map(s => String(s).toLowerCase());
    const hasAll = tags.includes('all') || moods.includes('all');
    const moodMatch = mood ? moods.includes(String(mood).toLowerCase()) : false;
    const tagMatch = selected.length ? selected.some(e => tags.includes(e)) : false;
    return hasAll || moodMatch || tagMatch;
  });

  // Enforce cooldown: drop questions asked within the last 3.5 weeks
  const eligible = byMood.filter(q => {
    const m = meta.get(q.id);
    if (!m) return true; // never asked
    if (!m.lastTs) return true;
    return (now - m.lastTs) >= COOL_DOWN_MS;
  });

  // Sort eligible by: priority category first, then fewest asked count, then ID for stability
  eligible.sort((a, b) => {
    const prioA = prioritySet.has(a.category) ? 0 : 1;
    const prioB = prioritySet.has(b.category) ? 0 : 1;
    if (prioA !== prioB) return prioA - prioB;
    const ca = (meta.get(a.id)?.count) || 0;
    const cb = (meta.get(b.id)?.count) || 0;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });

  // Prefer unseen among eligible, then the rest of eligible
  const unseen = eligible.filter(q => ((meta.get(q.id)?.count) || 0) === 0);
  const seen = eligible.filter(q => ((meta.get(q.id)?.count) || 0) > 0);
  const pick = [];
  for (const q of unseen) { if (pick.length < limit) pick.push(q); }
  for (const q of seen) { if (pick.length < limit) pick.push(q); }
  return pick.slice(0, limit).map(q => ({ id: q.id, category: q.category, prompt: q.prompt }));
}

// --- API: AI-generated questions for a revisiting session ---
// Return fixed, non-repeating questions from catalog
app.post('/api/questions', async (req, res) => {
  try {
    const { userId, mood, emotions } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const last = getConvsByUser.all(userId, 1, 0)[0];
    let lastText = '';
    if (last) {
      try {
        const obj = JSON.parse(last.answers || '{}');
        lastText = Object.values(obj).join('\n');
      } catch { lastText = String(last.answers || ''); }
      if (!lastText) lastText = String(last.message || '');
    }
    const pick = selectFromCatalog({ userId, mood, emotions: Array.isArray(emotions) ? emotions : [], limit: 8, lastContextText: lastText });
    if (!pick.length) return res.status(404).json({ error: 'no_questions_available' });
    res.json({ questions: pick });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'questions_failed' });
  }
});

// Create OpenAI client lazily to avoid crashing when API key is missing

app.post('/api/generate', async (req, res) => {
  try {
    const { mood, reason, userId } = req.body || {};
    if (!mood) return res.status(400).json({ error: 'mood required' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ai_unavailable', message: 'AI backend not configured' });
    }

  const system = `You are a warm, grounded couples therapist meeting one partner for a brief individual check-in focused on a make-or-break moment. Offer one organic, compassionate message using reflective listening (e.g., "It sounds like...", "Part of you..."). Validate the feeling, center safety and boundaries, and suggest one tiny, doable next step. If helpful, include one gentle question to invite choice. Do not diagnose or moralize. Keep it human and specific to what the user shares.`;

  const user = `Context\nMood: ${mood}\nSummary of answers (optional):\n${reason || '—'}\nInstruction\nWrite a single paragraph (3–6 short sentences, ~80–160 words) that:\n- Reflects back what you hear with care in an individual session\n- Names safety, values, and boundaries when relevant\n- Offers one micro-action the user could try now\n- Optionally asks one gentle question to invite choice (stay/leave/clarify)\nAvoid lists, jargon, or platitudes. Speak directly to the user.`;

    // Use a small fast model; upgrade if desired
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
    });

    const message = completion.choices?.[0]?.message?.content?.trim();
    if (!message) return res.status(502).json({ error: 'no message from model' });
    // Save if userId provided
    if (userId) {
      upsertUser.run(userId);
      insertConv.run(userId, mood, null, JSON.stringify({ summary: reason || '' }), message, null);
    }
    res.json({ message });
  } catch (err) {
    console.error(err);
    const status = err?.status || 500;
    res.status(status).json({ error: 'generation failed' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`HER AI server listening on http://localhost:${port}`);
});
