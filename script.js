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
  // Continuation UI
  const continueMoods = document.getElementById('continue-moods');

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

    // Mood-specific guided questions; each has a category for adaptive ordering
    const questionsByMood = {
      denial: [
        { id: 'dn_tangible', category: 'make_or_break', prompt: 'What feels most tangible to focus on in the next day or two?' },
        { id: 'dn_checks', category: 'patterns', prompt: 'What facts or signals help you orient when things feel unreal?' },
        { id: 'dn_senses', category: 'support', prompt: 'What simple sensory anchors (sight, sound, touch) help you feel a bit steadier?' },
        { id: 'dn_boundaries', category: 'boundaries', prompt: 'Is there one boundary that would make today feel safer to meet as it is?' },
        { id: 'dn_support', category: 'support', prompt: 'Who could you text or call just to say where you are with this—no fixing needed?' },
        { id: 'dn_future', category: 'future_self', prompt: 'What would your future self thank you for doing gently today?' },
      ],
      anger: [
        { id: 'ag_need', category: 'make_or_break', prompt: 'If anger could speak plainly, what need is it naming right now?' },
        { id: 'ag_boundary', category: 'boundaries', prompt: 'Which boundary was crossed, and what would honoring it look like today?' },
        { id: 'ag_release', category: 'support', prompt: 'What safe outlet would release a little energy—movement, writing, or breath?' },
        { id: 'ag_choice', category: 'patterns', prompt: 'After a short pause, what small choice feels more aligned than reactive?' },
        { id: 'ag_safety', category: 'safety', prompt: 'Is there any safety step you want to take before anything else?' },
        { id: 'ag_next', category: 'future_self', prompt: 'What tiny, concrete step respects both your anger and your care?' },
      ],
      bargaining: [
        { id: 'bg_ifonly', category: 'patterns', prompt: 'Which “if only” is looping most right now?' },
        { id: 'bg_influence', category: 'make_or_break', prompt: 'What part of this can you actually influence today?' },
        { id: 'bg_cost', category: 'non_negotiable', prompt: 'What are you trading away when you chase a deal with reality?' },
        { id: 'bg_commit', category: 'future_self', prompt: 'What small commitment (5–10 minutes) would move this gently forward?' },
        { id: 'bg_support', category: 'support', prompt: 'Who could witness this without trying to solve it?' },
        { id: 'bg_boundary', category: 'boundaries', prompt: 'What boundary helps you meet what is, not just what-if?' },
      ],
      depression: [
        { id: 'dp_energy', category: 'support', prompt: 'What is the smallest act of care that feels doable (sip water, open a window, stretch)?' },
        { id: 'dp_safety', category: 'safety', prompt: 'Is there any safety concern you want to name or plan for today?' },
        { id: 'dp_tiny', category: 'make_or_break', prompt: 'If you shrank today to one tiny task, what would you pick?' },
        { id: 'dp_support', category: 'support', prompt: 'Who could you lean on for a short check-in or message?' },
        { id: 'dp_boundary', category: 'boundaries', prompt: 'What boundary protects your limited energy right now?' },
        { id: 'dp_future', category: 'future_self', prompt: 'What would be kind to thank yourself for by tonight, however small?' },
      ],
      acceptance: [
        { id: 'ac_values', category: 'make_or_break', prompt: 'Which value do you want to honor most in this chapter?' },
        { id: 'ac_keep', category: 'patterns', prompt: 'What’s one thing you’d like to keep doing because it supports you?' },
        { id: 'ac_release', category: 'non_negotiable', prompt: 'What’s one small thing you’re ready to release?' },
        { id: 'ac_boundary', category: 'boundaries', prompt: 'What boundary keeps you steady while you meet reality as it is?' },
        { id: 'ac_support', category: 'support', prompt: 'Who helps you stay grounded, and how might you include them this week?' },
        { id: 'ac_next', category: 'future_self', prompt: 'What’s a gentle next step that aligns with what you know now?' },
      ],
    };

    // Category templates: reusable prompts to blend dynamically with mood-specific ones
    const categoryTemplates = {
      make_or_break: [
        'What feels most critical to address first, given what you shared?',
        'If you chose one small lever today, what would it be?',
        'Where do you want to aim your limited energy right now?'
      ],
      patterns: [
        'What patterns are repeating—and what shifts when you name them?',
        'When this happens, what do you usually do next? What else is possible?',
        'If you mapped this cycle, where could you insert a breath or boundary?'
      ],
      boundaries: [
        'Which boundary matters most today, and how will you protect it?',
        'Where was a line crossed recently, and what response feels right now?',
        'What limit supports your safety and values here?'
      ],
      safety: [
        'Is there any step to make things safer or steadier before anything else?',
        'How emotionally and physically safe do you feel right now?',
        'If you needed support, what would be your first move?'
      ],
      support: [
        'Who could witness this with care—no fixing—to help you feel less alone?',
        'What connection or resource could you lean on today?',
        'If you sent one honest message, what would it say?'
      ],
      future_self: [
        'By tonight, what tiny act would your future self thank you for?',
        'What would moving this forward by 5% look like?',
        'What is one gentle next step aligned with your values?'
      ],
    };

    let questions = [];
    let latestThemes = null;

  // Build a summary of recent history to inform dynamic question generation
  async function buildHistorySummary(limit = 6) {
    try {
      const items = await getHistory(limit);
      const texts = [];
      const themes = {};
      for (const it of items) {
        const combined = (summarizeAnswers(it.answers || '') + '\n' + (it.message || '')).toLowerCase();
        const t = detectTheme(combined);
        themes[t] = (themes[t] || 0) + 1;
        if (it.message) texts.push(it.message);
      }
      return { text: texts.join('\n'), themes };
    } catch {
      return { text: '', themes: latestThemes || {} };
    }
  }

  // Generate a varied, history-related set of questions regardless of mood
  function generateDynamicQuestions(mood, summary) {
    const base = (questionsByMood[mood] || []).map(q => ({ ...q }));
    const tKeys = Object.keys(summary?.themes || {}).sort((a, b) => (summary.themes[b] || 0) - (summary.themes[a] || 0));
    const priorityCats = [];
    if (tKeys.includes('relationship')) priorityCats.push('patterns', 'boundaries');
    if (tKeys.includes('loss')) priorityCats.push('support', 'future_self');
    if (tKeys.includes('overwhelm')) priorityCats.push('make_or_break', 'support');
    if (tKeys.includes('money')) priorityCats.push('non_negotiable');
    if (tKeys.includes('health')) priorityCats.push('safety');

    // Blend category templates into the pool
    const pool = [...base];
    Object.keys(categoryTemplates).forEach(cat => {
      categoryTemplates[cat].forEach(p => {
        pool.push({ id: `${cat}_${p.slice(0,8)}`.replace(/\W+/g,'_'), category: cat, prompt: p });
      });
    });

    // Stable ordering: priority categories first
    const ids = new Set(priorityCats);
    const ordered = [
      ...pool.filter(q => ids.has(q.category)),
      ...pool.filter(q => !ids.has(q.category)),
    ];

    // Pick a varied set and lightly tailor first question to last dominant theme
    const picks = pickMany(ordered, 8);
    if (tKeys[0] && picks[0]) {
      picks[0] = { ...picks[0], prompt: `${picks[0].prompt} (You mentioned ${tKeys[0]} before—does it show up here?)` };
    }
    return picks;
  }

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
      const chosenMood = btn.dataset.mood;
      currentMood = chosenMood;
        answers = {}; step = 0;
        qTitle.textContent = titleByMood[currentMood] || 'Let’s explore this together';
        messageArea.innerHTML = '';
        regenBtn.disabled = true;
        setQuestionsForMood(chosenMood);
        setupQuestionStep();
        switchScreen('questions');
        qInput.focus();
    });
  });

  async function aiGenerateQuestions(mood) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    try {
      const base = window._HER_API_BASE || 'http://localhost:3001';
      const res = await fetch(`${base}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mood }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Questions API ${res.status}`);
      const data = await res.json();
      const qs = Array.isArray(data.questions) ? data.questions : [];
      if (qs.length) return qs.map(q => ({ id: q.id, category: q.category || 'make_or_break', prompt: q.prompt }));
      throw new Error('No questions');
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  function setQuestionsForMood(mood) {
    const base = questionsByMood[mood] || [];
    // Immediate: use mood-specific as fallback
    questions = base.map(q => ({ ...q }));
    if (latestThemes) adaptQuestionsByHistory(latestThemes);
    // Try AI-generated questions next; fall back to dynamic local generation
    aiGenerateQuestions(mood).then(qs => {
      if (Array.isArray(qs) && qs.length) {
        questions = qs;
        if (step === 0 && questionsScreen.classList.contains('active')) setupQuestionStep();
      }
    }).catch(() => {
      buildHistorySummary().then(summary => {
        const dyn = generateDynamicQuestions(mood, summary);
        if (Array.isArray(dyn) && dyn.length) {
          questions = dyn;
          if (step === 0 && questionsScreen.classList.contains('active')) setupQuestionStep();
        }
      }).catch(() => {});
    });
  }

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
      // Adapt upcoming questions based on the response before advancing
      adaptQuestionsByResponses(answers);
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
        const asked = Array.isArray(questions) ? questions.map(q => ({ id: q.id, category: q.category, prompt: q.prompt })) : [];
        await saveConversation({ userId, mood: currentMood, answers, message: msg.body, questions: asked }).catch(() => {
          saveConversationLocal({ mood: currentMood, answers, message: msg.body });
        });
        // Refresh history panel
        try {
          const h = await getHistory(5);
          if (historyList) historyList._cache = h;
          renderHistory(h);
        } catch {}
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
  function pickMany(arr, n) {
    const out = [];
    const seen = new Set();
    const max = Math.min(n, arr.length);
    let guard = 0;
    while (out.length < max && guard++ < arr.length * 2) {
      const x = arr[Math.floor(Math.random() * arr.length)];
      const key = (x.id || '') + '|' + x.prompt;
      if (!seen.has(key)) { seen.add(key); out.push(x); }
    }
    return out;
  }

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
      // Store context of the opened conversation for adaptive continuation
      window._HER_last_context = it;
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

  // Choose a new mood inside the chat to continue
  if (continueMoods) {
    continueMoods.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mood]');
      if (!btn) return;
      const mood = btn.getAttribute('data-mood');
      // Boost themes using last context for stronger personalization
      const ctx = window._HER_last_context;
      if (ctx) {
        const txt = summarizeAnswers(ctx.answers || {}) + '\n' + (ctx.message || '');
        const t = detectTheme(txt);
        const boosted = { ...(latestThemes || {}) };
        boosted[t] = (boosted[t] || 0) + 3; // boost weight for last context theme
        latestThemes = boosted;
      }
      currentMood = mood;
      answers = {}; step = 0;
      qTitle.textContent = titleByMood[currentMood] || 'Let’s explore this together';
      setQuestionsForMood(currentMood);
      setupQuestionStep();
      switchScreen('questions');
      qInput.focus();
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
      ...questions.filter(q => ids.has(q.category)),
      ...questions.filter(q => !ids.has(q.category)),
    ];
    questions = reordered;
  }

  // Follow-up templates for tailoring next question based on the latest response
  const followUpTemplates = {
    general: [
      'Right now, what feels different compared to earlier today?',
      'What tiny step have you tried or considered so far?',
      'What feels a little clearer after naming this?',
    ],
    relationship: [
      'What have you learned about your needs in this relationship?',
      'What boundary would respect you here today?',
      'What support helps you meet this with care now?',
    ],
    loss: [
      'What have you been able to accept, even a little?',
      'What small act of care helped, or could help, today?',
      'Who could gently witness this with you?',
    ],
    overwhelm: [
      'If you shrink this to one step, what would it be?',
      'What would make today feel 5% lighter?',
      'Where could a boundary or pause help right now?',
    ],
    money: [
      'What single action would ease pressure today?',
      'Who or what resource could help with this?',
      'What limit protects your stability here?',
    ],
    health: [
      'Is there any safety step you want to take first?',
      'What support or care feels doable today?',
      'What would honoring your body look like right now?',
    ],
  };

  function nextFollowUp(theme) {
    const bank = followUpTemplates[theme] || followUpTemplates.general;
    return pick(bank);
  }

  // Reorder remaining questions and insert a targeted follow-up based on latest response
  function adaptQuestionsByResponses(ans) {
    try {
      // Determine last answered question
      const answeredKeys = Object.keys(ans || {});
      if (!answeredKeys.length) return;
      const lastKey = answeredKeys[answeredKeys.length - 1];
      const lastAnswer = ans[lastKey] || '';
      const theme = detectTheme(lastAnswer);

      // Build priority categories from the theme
      const priorityCats = [];
      if (theme === 'relationship') priorityCats.push('patterns', 'boundaries');
      if (theme === 'loss') priorityCats.push('support', 'future_self');
      if (theme === 'overwhelm') priorityCats.push('make_or_break', 'support');
      if (theme === 'money') priorityCats.push('non_negotiable');
      if (theme === 'health') priorityCats.push('safety');

      const ids = new Set(priorityCats);
      // Only reorder the remaining slice after current step
      const head = questions.slice(0, step + 1);
      const tail = questions.slice(step + 1);
      const reorderedTail = [
        ...tail.filter(q => ids.has(q.category)),
        ...tail.filter(q => !ids.has(q.category)),
      ];

      // Insert a direct follow-up next (avoid duplicates)
      const fuPrompt = nextFollowUp(theme);
      const followUp = { id: `fu_${Date.now()}`, category: priorityCats[0] || 'make_or_break', prompt: fuPrompt };
      // Prevent immediate duplicate prompts
      const existingNext = reorderedTail[0];
      if (!existingNext || (existingNext && existingNext.prompt !== fuPrompt)) {
        reorderedTail.unshift(followUp);
      }

      questions = head.concat(reorderedTail);
    } catch {}
  }

  // Fetch themes at startup; apply when a mood is selected
  showSplash();
  fetchThemes().then(t => { latestThemes = t; }).catch(() => {});

  // Rotate mood descriptions on home for variety
  const moodDescBank = {
    denial: [ 'It feels unreal or hard to accept.', 'Taking it slowly is okay.', 'Gentle orientation helps.' ],
    anger: [ 'Frustration, resentment, or rage.', 'Name the need underneath.', 'Pause widens choice.' ],
    bargaining: [ '"If only" thoughts and what‑ifs.', 'Shift toward influence.', 'Small commitments matter.' ],
    depression: [ 'Heavy sadness, loss of energy.', 'Shrink the day to tiny steps.', 'You don’t have to carry it alone.' ],
    acceptance: [ 'Grounded with room to heal.', 'Meet reality with care.', 'Choose one kind next step.' ],
  };

  function startMoodDescRotation() {
    const cards = moodScreen.querySelectorAll('.mood-card');
    function update() {
      cards.forEach(card => {
        const mood = card.dataset.mood;
        const descEl = card.querySelector('.mood-desc');
        const bank = moodDescBank[mood] || [descEl?.textContent || '' ];
        if (descEl) descEl.textContent = pick(bank);
      });
    }
    update();
    setInterval(update, 20000);
  }
  startMoodDescRotation();

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
