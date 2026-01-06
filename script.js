// HER — Gentle Support Logic
(function() {
  // Splash screen logic
  const splash = document.getElementById('splash-screen');
  const splashContinueBtn = document.getElementById('splash-continue-btn');
  let splashTimerId = null;

  function hideSplash() {
    if (!splash) return;
    splash.classList.remove('active');
    splash.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    splash.removeEventListener('keydown', onSplashKey);
    if (splashContinueBtn) splashContinueBtn.removeEventListener('click', hideSplash);
    if (splashTimerId) { clearTimeout(splashTimerId); splashTimerId = null; }
  }

  function onSplashKey(e) {
    if (e.key === 'Escape') hideSplash();
  }

  function showSplash() {
    if (!splash) return;
    splash.classList.add('active');
    splash.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    splash.tabIndex = -1;
    splash.focus({ preventScroll: true });
    splash.addEventListener('keydown', onSplashKey);
    if (splashContinueBtn) splashContinueBtn.addEventListener('click', hideSplash);
    // Auto-dismiss after 40 seconds max
    splashTimerId = setTimeout(hideSplash, 40000);
  }
  const moodScreen = document.getElementById('mood-screen');
  const reasonScreen = document.getElementById('reason-screen');
  const reasonTitle = document.getElementById('reason-title');
  const reasonInput = document.getElementById('reason-input');
  const supportBtn = document.getElementById('support-btn');
    const questionsScreen = document.getElementById('questions-screen');
    const regenBtn = document.getElementById('regen-btn');
    const backBtn = document.getElementById('back-btn');
    const messageArea = document.getElementById('message-area');
    // History UI
    const historyList = document.getElementById('history-list');
    const historyRefreshBtn = document.getElementById('history-refresh-btn');

    // Questions UI
    const qBackBtn = document.getElementById('q-back-btn');
    const qTitle = document.getElementById('q-title');
    const qProgress = document.getElementById('q-progress');
    const qPrompt = document.getElementById('q-prompt');
    const qInput = document.getElementById('q-input');
    const qNextBtn = document.getElementById('q-next-btn');
    const qSkipBtn = document.getElementById('q-skip-btn');
    const qGenerateBtn = document.getElementById('q-generate-btn');

  let currentMood = null;
    let answers = {};
    let step = 0;
    let lastReason = '';
    const userId = getOrCreateUserId();

    // Show splash at startup
    showSplash();

    // Guided questions for make-or-break, couples therapy in an individual session
    let questions = [
      { id: 'make_or_break', prompt: 'What feels most make‑or‑break for you in this relationship right now?' },
      { id: 'hopes', prompt: 'If you imagine staying versus leaving, what do you hope would change in each path?' },
      { id: 'boundaries', prompt: 'Where have your boundaries been crossed or respected recently?' },
      { id: 'non_negotiable', prompt: 'What is one non‑negotiable for you—something you won’t trade away?' },
      { id: 'safety', prompt: 'How emotionally and physically safe do you feel? (Share any detail that matters.)' },
      { id: 'patterns', prompt: 'What patterns do you notice repeating between you—especially under stress?' },
      { id: 'support', prompt: 'Who is in your support circle that you can talk to or lean on?' },
      { id: 'future_self', prompt: 'If you picture yourself in three months, what would you thank yourself for choosing today?' },
    ];

  const titleByMood = {
    denial: "You're feeling Denial",
    anger: "You're feeling Anger",
    bargaining: "You're feeling Bargaining",
    depression: "You're feeling Depression",
    acceptance: "You're feeling Acceptance"
  };

  // Wire mood buttons
  moodScreen.querySelectorAll('.mood-card').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMood = btn.dataset.mood;
        answers = {}; step = 0;
        qTitle.textContent = titleByMood[currentMood] || 'Let’s explore this together';
        messageArea.innerHTML = '';
        regenBtn.disabled = true;
        setupQuestionStep();
        switchScreen('questions');
        qInput.focus();
    });
  });

  backBtn.addEventListener('click', () => {
    currentMood = null;
    messageArea.innerHTML = '';
    switchScreen('mood');
  });

    // Back from message screen
    qBackBtn.addEventListener('click', () => {
      currentMood = null; answers = {}; step = 0;
      switchScreen('mood');
    });

    qNextBtn.addEventListener('click', () => {
      saveAnswer();
      step++;
      setupQuestionStep();
    });

    qSkipBtn.addEventListener('click', () => {
      step++;
      setupQuestionStep();
    });

    // On mobile, ensure the textarea is visible when focused (avoid keyboard occlusion)
    if (qInput) {
      qInput.addEventListener('focus', () => {
        try {
          if (window.matchMedia && window.matchMedia('(max-width: 480px)').matches) {
            setTimeout(() => {
              qInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }
        } catch {}
      });
    }

    qGenerateBtn.addEventListener('click', async () => {
      if (!currentMood) return;
      setLoading(true);
      try {
        const summary = summarizeAnswers(answers);
        const msg = await generateSupportMessage(currentMood, summary);
        renderMessage(msg);
        regenBtn.disabled = false;
        // Save conversation (server if available; fallback local)
        await saveConversation({ userId, mood: currentMood, answers, message: msg.body }).catch(() => {
          saveConversationLocal({ mood: currentMood, answers, message: msg.body });
        });
        // Refresh history panel
        try { const h = await getHistory(5); renderHistory(h); } catch {}
        switchScreen('reason');
      } catch (err) {
        console.error(err);
        renderMessage({ title: 'We hit a snag', body: 'Something went wrong while generating your message. Please try again.' });
        switchScreen('reason');
      } finally {
        setLoading(false);
      }
    });

    function setupQuestionStep() {
      const total = questions.length;
      if (step >= total) {
        qProgress.textContent = `Ready • ${total}/${total}`;
        qPrompt.textContent = 'Ready when you are. Generate a tailored reflection now?';
        qInput.value = '';
        qInput.disabled = true;
        qNextBtn.disabled = true;
        qSkipBtn.disabled = true;
        qGenerateBtn.disabled = false;
        return;
      }
      const q = questions[step];
      qProgress.textContent = `Step ${step + 1} of ${total}`;
      qPrompt.textContent = q.prompt;
      qInput.value = answers[q.id] || '';
      qInput.disabled = false;
      qNextBtn.disabled = false;
      qSkipBtn.disabled = false;
      qGenerateBtn.disabled = step < Math.floor(total * 0.5); // enable after roughly half
    }

    function saveAnswer() {
      const q = questions[step];
      if (!q) return;
      const val = (qInput.value || '').trim();
      if (val) answers[q.id] = val;
      qInput.value = '';
    }

    function summarizeAnswers(ans) {
      const lines = [];
      for (const q of questions) {
        const a = ans[q.id];
        if (a) lines.push(`${q.prompt} ${a}`);
      }
      return lines.join('\n');
    }

  // Optional manual support button (not present in current HTML)
  if (supportBtn) {
    supportBtn.addEventListener('click', async () => {
      if (!currentMood) return;
      lastReason = (reasonInput?.value || '').trim();
      setLoading(true);
      try {
        const msg = await generateSupportMessage(currentMood, lastReason);
        renderMessage(msg);
        regenBtn.disabled = false;
      } catch (err) {
        console.error(err);
        renderMessage({ title: 'We hit a snag', body: 'Something went wrong while generating your message. Please try again.' });
      } finally {
        setLoading(false);
      }
    });
  }

  regenBtn.addEventListener('click', async () => {
    if (!currentMood) return;
    setLoading(true);
    try {
      const msg = await generateSupportMessage(currentMood, lastReason, { preferAI: false });
      renderMessage(msg);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  });

  function switchScreen(which) {
    moodScreen.classList.toggle('active', which === 'mood');
     questionsScreen.classList.toggle('active', which === 'questions');
     reasonScreen.classList.toggle('active', which === 'reason');
    // Ensure viewport is positioned well on mobile when entering questions
    if (which === 'questions') {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
  }

  function setLoading(isLoading) {
    // Guard optional button; questions flow uses qGenerateBtn
    if (supportBtn) {
      supportBtn.disabled = isLoading;
      supportBtn.textContent = isLoading ? 'Generating…' : 'Get Support';
    }
    regenBtn.disabled = isLoading || !messageArea.innerHTML;
  }

  function renderMessage(message) {
    const { title, body } = message;
    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerHTML = `<h4>${escapeHtml(title)}</h4><p>${escapeHtml(body)}</p>`;
    messageArea.innerHTML = '';
    messageArea.appendChild(card);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]+/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[s]));
  }

  async function generateSupportMessage(mood, reason, options = {}) {
    const preferAI = options.preferAI !== false; // default true on first try

    if (preferAI) {
      try {
        const ai = await aiGenerate(mood, reason);
        if (ai && ai.body) return ai;
      } catch (e) {
        console.warn('AI generation failed; falling back to offline.', e);
      }
    }
    return offlineGenerate(mood, reason);
  }

  async function aiGenerate(mood, reason) {
    // Calls local API server if available at /api/generate
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000); // 6s timeout
    try {
      const base = window._HER_API_BASE || 'http://localhost:3001';
      const res = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, reason, userId }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return { title: `A gentle note for ${capitalize(mood)}`, body: data.message };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  function offlineGenerate(mood, reason) {
    const theme = detectTheme(reason);
    const templates = messageBank[mood] || messageBank['acceptance'];
    const base = pick(templates);
    const tailored = tailor(base, mood, reason, theme);
    return { title: `A gentle note for ${capitalize(mood)}`, body: tailored };
  }

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

  function tailor(text, mood, reason, theme) {
    const tag = theme !== 'general'
      ? ` Given you mentioned ${theme}, it makes sense this feels the way it does.`
      : '';
    const note = reason
      ? ` Thank you for sharing—even a few words like "${truncate(reason, 140)}" tell me a lot.`
      : '';
    return text.replace('{mood}', capitalize(mood)).replace('{extra}', tag + note);
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // --- Persistence helpers ---
  function getOrCreateUserId() {
    try {
      const k = 'her_user_id';
      let id = localStorage.getItem(k);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        localStorage.setItem(k, id);
      }
      return id;
    } catch {
      // Fallback if localStorage unavailable
      return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    }
  }

  async function saveConversation(payload) {
    const base = window._HER_API_BASE || 'http://localhost:3001';
    const res = await fetch(`${base}/api/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('save failed');
    return res.json();
  }

  function saveConversationLocal(entry) {
    try {
      const k = 'her_local_conversations';
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      arr.unshift({ ...entry, ts: Date.now() });
      localStorage.setItem(k, JSON.stringify(arr.slice(0, 50))); // cap size
    } catch {}
  }

  async function fetchThemes() {
    const base = window._HER_API_BASE || 'http://localhost:3001';
    try {
      const res = await fetch(`${base}/api/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('themes fetch failed');
      const data = await res.json();
      return data.themes || {};
    } catch {
      // Fallback to local
      try {
        const k = 'her_local_conversations';
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        const counts = {};
        for (const r of arr) {
          const text = summarizeAnswers(r.answers || {}) || r.message || '';
          const t = detectTheme(text);
          counts[t] = (counts[t] || 0) + 1;
        }
        return counts;
      } catch {
        return {};
      }
    }
  }

  // --- History: fetch and render ---
  async function getHistory(limit = 5, offset = 0) {
    const base = window._HER_API_BASE || 'http://localhost:3001';
    // Try server first
    try {
      const res = await fetch(`${base}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, limit, offset }),
      });
      if (!res.ok) throw new Error('history fetch failed');
      const data = await res.json();
      const rows = data.conversations || [];
      return rows.map(r => ({
        mood: r.mood,
        message: r.message,
        answers: parseAnswers(r.answers),
        ts: Date.parse(r.created_at || Date.now()),
      }));
    } catch {
      // Fallback to localStorage
      try {
        const k = 'her_local_conversations';
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        return arr.slice(0, limit).map(r => ({ mood: r.mood, message: r.message, answers: r.answers, ts: r.ts }));
      } catch {
        return [];
      }
    }
  }

  function parseAnswers(a) {
    if (!a) return {};
    if (typeof a === 'object') return a;
    try { return JSON.parse(a); } catch { return { summary: String(a) }; }
  }

  function renderHistory(items) {
    if (!historyList) return;
    if (!items || !items.length) {
      historyList.innerHTML = `<p class="muted">No reflections yet. Generate one to see it here.</p>`;
      return;
    }
    historyList.innerHTML = items.map((it, idx) => {
      const d = it.ts ? new Date(it.ts) : new Date();
      const when = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      return `<div class="history-item" data-index="${idx}">
        <div>
          <div class="meta">${escapeHtml(when)} • ${escapeHtml(capitalize(it.mood || ''))}</div>
          <h4>A gentle note for ${escapeHtml(capitalize(it.mood || ''))}</h4>
          <p>${escapeHtml((it.message || '').slice(0, 400))}</p>
        </div>
        <div>
          <button class="secondary open-btn" data-open="${idx}">Open</button>
        </div>
      </div>`;
    }).join('');
  }

  // Open a history item into the message screen
  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-open]');
      if (!btn) return;
      const idx = Number(btn.getAttribute('data-open'));
      // Re-fetch current rendered list from DOM dataset; or better, keep last cache:
      if (!historyList._cache) return;
      const it = historyList._cache[idx];
      if (!it) return;
      currentMood = it.mood || null;
      renderMessage({ title: `A gentle note for ${capitalize(currentMood || '')}`, body: it.message || '' });
      regenBtn.disabled = !!it.message;
      switchScreen('reason');
    });
  }

  if (historyRefreshBtn) {
    historyRefreshBtn.addEventListener('click', async () => {
      try {
        const items = await getHistory(6);
        historyList._cache = items;
        renderHistory(items);
      } catch (e) { console.warn(e); }
    });
  }

  // --- Adaptive questions ---
  // Make questions re-orderable by history themes
  function adaptQuestionsByHistory(themes) {
    // Prioritize based on most frequent themes; stable reordering
    const priority = [];
    const tKeys = Object.keys(themes).sort((a, b) => (themes[b] || 0) - (themes[a] || 0));
    if (tKeys.includes('relationship')) priority.push('patterns', 'boundaries');
    if (tKeys.includes('loss')) priority.push('support', 'future_self');
    if (tKeys.includes('overwhelm')) priority.push('make_or_break', 'support');
    if (tKeys.includes('money')) priority.push('hopes', 'non_negotiable');
    if (tKeys.includes('health')) priority.push('safety');

    const ids = new Set(priority);
    const reordered = [
      ...questions.filter(q => ids.has(q.id)),
      ...questions.filter(q => !ids.has(q.id)),
    ];
    questions = reordered;
  }

  // Fetch themes and adapt at startup (after splash shows)
  showSplash();
  fetchThemes().then(adaptQuestionsByHistory).catch(() => {});

  // After splash and theme load, also load history initially
  (async () => {
    try {
      const items = await getHistory(6);
      if (historyList) historyList._cache = items;
      renderHistory(items);
    } catch { /* ignore */ }
  })();

  const messageBank = {
    denial: [
      "It sounds like your mind is giving you a cushion because the full reality is hard to hold right now. {extra} We can take this slowly—no rush, just one breath at a time. If it helps, what feels most tangible to focus on in the next hour?",
      "Part of you may be keeping a gentle distance until it’s safer to let more in. {extra} That’s okay. A tiny anchor can help—sip water, feel your feet, notice three things you can see. What’s one anchor you could try?",
      "When acceptance isn’t here yet, it doesn’t mean you’re doing anything wrong. {extra} Today could be about small orientation: light, sound, warmth. Would a short step outside or opening a window feel doable?"
    ],
    anger: [
      "I hear a lot of energy in your anger; often it guards something tender underneath. {extra} Let’s make room for it without letting it steer everything. What might safely release a bit of it—movement, unfiltered words on a page, or a paced breath?",
      "It makes sense to be mad at what’s felt unfair. {extra} A pause isn’t silencing you; it’s widening choice. Could you try a three-breath reset—jaw unclench, shoulders drop, a slow belly breath—and then name one need?",
      "Part of you wants action, part of you may need care. {extra} You can honor both. What’s a tiny, concrete step that respects your anger and supports you—five minutes of a task, or a quick check-in with someone you trust?"
    ],
    bargaining: [
      "Those ‘if only’ loops can be your care trying to find a way through. {extra} You did the best you could with what you knew then. What’s one thing within reach today—one call, one note, one honest five-minute task?",
      "It sounds like your mind is searching for a deal to ease the hurt. {extra} Let’s gently shift toward influence. If you wrote down the what-ifs, what’s one part you can affect now?",
      "Part of you hopes a change in the story could change the feeling. {extra} That hope matters. To meet today as it is, what small commitment would help—setting a timer, sending a message, preparing tomorrow’s first step?"
    ],
    depression: [
      "This heaviness asks for softness and smaller steps. {extra} Let’s shrink the day to one tiny act of care—water, a warm drink, opening a window. If you pick just one, which feels kindest right now?",
      "I hear how hard it is to move when energy is low. {extra} Borrow structure: set a gentle five-minute timer, do any tiny thing, then rest. Would choosing the easiest task—like a text or a stretch—be possible?",
      "You don’t have to carry this alone. {extra} Reaching out can be a lifeline—even a short message to someone or a helpline in your area. If it’s okay, who might you contact, or what number could you keep nearby?"
    ],
    acceptance: [
      "Acceptance here doesn’t mean approving; it’s noticing with steadiness. {extra} From this ground, one kind next step is enough. What’s a small choice that supports you today?",
      "You’re meeting reality with both honesty and care. {extra} Consider thanking yourself for one thing you’ve done to get here, no matter how small. What would you like to keep doing next?",
      "From groundedness, growth can be gentle and real. {extra} Keep one thing that works, release one small thing that doesn’t. If you chose just one of each, what would they be?"
    ],
  };
})();
