// HER — Optional AI backend (Express + OpenAI)
// Requires: OPENAI_API_KEY in environment

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Database from 'better-sqlite3';

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

const upsertUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');
const insertConv = db.prepare('INSERT INTO conversations (user_id, mood, answers, message, questions) VALUES (?, ?, ?, ?, ?)');
const getConvsByUser = db.prepare('SELECT id, mood, answers, message, questions, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
const getAllConvsByUser = db.prepare('SELECT mood, answers, message, questions FROM conversations WHERE user_id = ?');

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
    const { userId, mood, answers, message, questions } = req.body || {};
    if (!userId || !mood) return res.status(400).json({ error: 'userId and mood required' });
    upsertUser.run(userId);
    const answersStr = typeof answers === 'string' ? answers : JSON.stringify(answers || {});
    const questionsStr = typeof questions === 'string' ? questions : (questions ? JSON.stringify(questions) : null);
    insertConv.run(userId, mood, answersStr, message || null, questionsStr);
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

// --- API: AI-generated questions for a revisiting session ---
app.post('/api/questions', async (req, res) => {
  try {
    const { userId, mood } = req.body || {};
    if (!userId || !mood) return res.status(400).json({ error: 'userId and mood required' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'ai_unavailable', message: 'AI backend not configured' });
    }

    // Pull the most recent conversation for context
    const last = getConvsByUser.all(userId, 1, 0)[0];
    let lastAnswersText = '';
    let lastQuestionsText = '';
    let lastMessageText = '';
    let lastMood = '';
    if (last) {
      lastMood = String(last.mood || '');
      try {
        const obj = JSON.parse(last.answers || '{}');
        lastAnswersText = Object.entries(obj).map(([k,v]) => `${k}: ${v}`).join('\n');
      } catch {
        lastAnswersText = String(last.answers || '');
      }
      try {
        const qobj = JSON.parse(last.questions || '[]');
        lastQuestionsText = Array.isArray(qobj) ? qobj.map(q => q.prompt || String(q)).join('\n') : '';
      } catch { lastQuestionsText = ''; }
      lastMessageText = String(last.message || '');
    }

    // Compose prompt for structured JSON output
    const system = `You are a warm, grounded therapist facilitating a brief revisiting session. You generate 6–8 short, human questions based on the user's current mood and their last recorded conversation. Focus on: changes since last time (feeling now vs. then), what they have done/learned/accepted, boundaries, support, safety, and one tiny next step. Questions must be concise, actionable, and not repetitive.`;
    const user = {
      mood,
      lastMood,
      lastAnswers: lastAnswersText,
      lastQuestions: lastQuestionsText,
      lastMessage: lastMessageText,
      guidance: 'Return JSON with {"questions":[{"id":"string","category":"make_or_break|patterns|boundaries|safety|support|future_self|non_negotiable","prompt":"string"}...]}. Keep prompts 10–20 words. No extra text.'
    };

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return res.status(502).json({ error: 'no content' });
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      // try to extract array if model returned it directly
      parsed = { questions: [] };
    }
    const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
    // Minimal validation and fallback
    const cleaned = qs
      .filter(q => q && q.prompt)
      .slice(0, 8)
      .map((q, i) => ({
        id: String(q.id || `q_${i+1}`),
        category: String(q.category || 'make_or_break'),
        prompt: String(q.prompt).trim()
      }));
    if (!cleaned.length) {
      return res.status(502).json({ error: 'empty_questions' });
    }
    res.json({ questions: cleaned });
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
      insertConv.run(userId, mood, JSON.stringify({ summary: reason || '' }), message, null);
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
