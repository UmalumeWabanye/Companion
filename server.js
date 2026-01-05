// HER — Optional AI backend (Express + OpenAI)
// Requires: OPENAI_API_KEY in environment

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], methods: ['POST'] }));

// Create OpenAI client lazily to avoid crashing when API key is missing

app.post('/api/generate', async (req, res) => {
  try {
    const { mood, reason } = req.body || {};
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
