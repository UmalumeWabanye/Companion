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
  // Emotion-first UI hooks
  const emotionPicker = document.getElementById('emotion-picker');
  const emotionWheel = document.getElementById('emotion-wheel');
  const emotionWheelSvg = document.getElementById('emotion-wheel-svg');
  const startEmotionsBtn = document.getElementById('start-emotions-btn');
  const continueWithEmotionsBtn = document.getElementById('continue-with-emotions-btn');
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
    let selectedEmotions = [];
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
        selectedEmotions = [];
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

  function emotionsFromMood(mood) {
    switch ((mood || '').toLowerCase()) {
      case 'anger': return ['anger'];
      case 'depression': return ['sadness'];
      case 'bargaining': return ['anticipation','trust'];
      case 'denial': return ['surprise','fear'];
      case 'acceptance': return ['trust','joy'];
      default: return [];
    }
  }

  async function aiGenerateQuestions(mood) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    try {
      const base = window._HER_API_BASE || 'http://localhost:3001';
      const emotions = emotionsFromMood(mood);
      const res = await fetch(`${base}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mood, emotions }),
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

  // Emotion-first: fetch questions by emotions only (no mood)
  async function aiGenerateQuestionsByEmotions(emotions) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    try {
      const base = window._HER_API_BASE || 'http://localhost:3001';
      const res = await fetch(`${base}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, emotions: normalizeEmotions(Array.isArray(emotions) ? emotions : []) }),
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

  // Emotion-first: set questions using selected emotions; fallback to dynamic neutral set
  function setQuestionsForEmotions(emotions) {
    questions = [];
    if (latestThemes) adaptQuestionsByHistory(latestThemes);
    aiGenerateQuestionsByEmotions(emotions).then(qs => {
      if (Array.isArray(qs) && qs.length) {
        questions = qs;
        if (step === 0 && questionsScreen.classList.contains('active')) setupQuestionStep();
      }
    }).catch(() => {
      buildHistorySummary().then(summary => {
        const dyn = generateDynamicQuestions('acceptance', summary);
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

  // Emotion picker wiring
  if (emotionPicker) {
    emotionPicker.addEventListener('click', (e) => {
      const chip = e.target.closest('.emotion-chip');
      if (!chip) return;
      const val = String(chip.getAttribute('data-emotion') || '').toLowerCase();
      chip.classList.toggle('selected');
      const set = new Set((selectedEmotions || []).map(s => String(s).toLowerCase()));
      if (chip.classList.contains('selected')) set.add(val); else set.delete(val);
      selectedEmotions = Array.from(set);
      if (startEmotionsBtn) startEmotionsBtn.disabled = selectedEmotions.length === 0;
    });
  }

  // Emotion wheel wiring is attached directly on created elements in the builder

  // Load wheel dataset and build a precise 3-ring, 6-sector SVG wheel with labels
  async function loadWheelData() {
    try {
      const res = await fetch('./data/wheel.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('wheel.json not found');
      return await res.json();
    } catch (e) {
      // Fallback minimal structure
      return { order: ['happy','surprise','fear','anger','disgust','sad'], labels: {} };
    }
  }

  function buildEmotionWheelFromData(data) {
    if (!emotionWheelSvg) return;
    const cx = 180, cy = 180;
    // Radii for rings (inner..outer)
    const rings = [
      // Fill to center: remove inner white circle by starting at r0 = 0
      { r0: 0, r1: 100, cls: 'ring-inner' },
      { r0: 100, r1: 140, cls: 'ring-mid' },
      { r0: 140, r1: 175, cls: 'ring-outer' },
    ];
    const emotionsOrder = Array.isArray(data?.order) && data.order.length ? data.order : ['happy','surprise','fear','anger','disgust','sad'];
    const labels = data?.labels || {};
    const palette = {
      happy: '#f5c84b', surprise: '#8bd2f0', fear: '#6c7db3', anger: '#b55b5b', disgust: '#ca8ed1', sad: '#5aa0d1'
    };
  const toRad = (deg) => (deg - 90) * Math.PI / 180; // rotate so 0° is up
    const pc = (r, ang) => ({ x: cx + r * Math.cos(toRad(ang)), y: cy + r * Math.sin(toRad(ang)) });
    const sectorPath = (r0, r1, a0, a1) => {
      const large = (a1 - a0) > 180 ? 1 : 0;
      const p1 = pc(r1, a0);
      const p2 = pc(r1, a1);
      if (r0 <= 0.1) {
        // Wedge to center (no inner arc)
        return [
          `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
          `A ${r1} ${r1} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
          `L ${cx.toFixed(2)} ${cy.toFixed(2)}`,
          'Z'
        ].join(' ');
      }
      const p3 = pc(r0, a1);
      const p4 = pc(r0, a0);
      return [
        `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
        `A ${r1} ${r1} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
        `A ${r0} ${r0} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
        'Z'
      ].join(' ');
    };

    // Estimate and fit text on a path by adjusting font-size and textLength
    function fitText(textElem, textPath, textStr, arcLen, opts = {}) {
      const base = opts.base || 10; // px
      const min = opts.min || 8;
      const max = opts.max || 12;
      // Rough width estimate per character at a given font-size
      // Inter assumes ~0.55em avg width per glyph
      const estPerChar = 0.55; // ems
      let size = base;
      const estWidth = (sz) => textStr.length * estPerChar * sz; // px
      // Shrink if needed
      while (estWidth(size) > (arcLen - 10) && size > min) size -= 0.5;
      // Grow a touch if much smaller than arc
      while (estWidth(size) < (arcLen - 24) && size < max) size += 0.5;
      size = Math.max(min, Math.min(max, size));
      textElem.style.fontSize = `${size}px`;
      // Constrain the path layout to arcLen minus small padding
      const targetLen = Math.max(arcLen - 8, 20);
      textPath.setAttribute('textLength', targetLen.toFixed(0));
      textPath.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }

    // Helpers to toggle selection for an entire primary
    function setPrimarySelected(emo, on) {
      const segs = emotionWheelSvg.querySelectorAll(`.seg[data-emotion="${emo}"]`);
      segs.forEach(s => {
        s.classList.toggle('selected', on);
        s.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const labelsEls = emotionWheelSvg.querySelectorAll(`.label[data-emotion="${emo}"]`);
      labelsEls.forEach(l => l.classList.toggle('selected', on));
      const set = new Set((selectedEmotions || []).map(s => String(s).toLowerCase()));
      if (on) set.add(emo); else set.delete(emo);
      selectedEmotions = Array.from(set);
      if (startEmotionsBtn) startEmotionsBtn.disabled = selectedEmotions.length === 0;
    }

    // Clear any existing content
    while (emotionWheelSvg.firstChild) emotionWheelSvg.removeChild(emotionWheelSvg.firstChild);

    // Draw rings and segments
    const step = 360 / emotionsOrder.length; // 60 degrees
    // Create defs for text paths
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    emotionWheelSvg.appendChild(defs);

    emotionsOrder.forEach((emo, i) => {
      const start = i * step;
      const end = start + step;
      // background segments for each ring
      rings.forEach((ring, ringIdx) => {
        const d = sectorPath(ring.r0, ring.r1, start, end);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', `seg ${emo} ${ring.cls}`);
        const base = palette[emo] || '#9aa5b1';
        const lighten = ringIdx === 0 ? 0 : (ringIdx === 1 ? 6 : 12);
        path.setAttribute('fill', base);
        if (lighten) path.style.filter = `brightness(${1 + lighten/100})`;
        path.setAttribute('data-emotion', emo);
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-pressed', 'false');
        // Click toggles whole primary
        path.addEventListener('click', () => setPrimarySelected(emo, !path.classList.contains('selected')));
        path.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); setPrimarySelected(emo, !path.classList.contains('selected')); }
        });
        emotionWheelSvg.appendChild(path);
      });

      // Primary label near inner ring mid-angle
      const midAng = start + (step / 2);
      const labelR = (rings[0].r0 + rings[0].r1) / 2;
      const lp = pc(labelR, midAng);
      const pText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      pText.setAttribute('x', lp.x.toFixed(0));
      pText.setAttribute('y', lp.y.toFixed(0));
      pText.setAttribute('text-anchor', 'middle');
      pText.setAttribute('dominant-baseline', 'middle');
      pText.setAttribute('class', 'label label-primary');
      pText.setAttribute('data-emotion', emo);
      pText.setAttribute('aria-label', `${emo} primary`);
      pText.setAttribute('tabindex', '0');
      pText.addEventListener('click', () => setPrimarySelected(emo, !pText.classList.contains('selected')));
      pText.addEventListener('keydown', (ke) => { if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); setPrimarySelected(emo, !pText.classList.contains('selected')); } });
      pText.textContent = emo === 'sad' ? 'Sad' : (emo.charAt(0).toUpperCase() + emo.slice(1));
      emotionWheelSvg.appendChild(pText);

      // Utility for arc paths used by curved text
      const arcPath = (r, a0, a1) => {
        const large = (a1 - a0) > 180 ? 1 : 0;
        const p1 = pc(r, a0);
        const p2 = pc(r, a1);
        return [
          `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
          `A ${r} ${r} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
        ].join(' ');
      };

      // Secondary labels (mid ring) as vertical rotated words, per-slot inside wedge
      const secs = Array.isArray(labels[emo]?.secondaries) ? labels[emo].secondaries : [];
      if (secs.length) {
        const sCount = secs.length;
        const sR = (rings[1].r0 + rings[1].r1) / 2;
        const padDeg = 10; // avoid touching boundaries a bit more
        const interDeg = 4; // spacing between vertical columns
        const totalSpan = Math.max(0, (end - start) - 2 * padDeg - Math.max(0, (sCount - 1) * interDeg));
        const slotSpan = sCount ? (totalSpan / sCount) : 0;
        for (let si = 0; si < sCount; si++) {
          const a0 = start + padDeg + si * (slotSpan + interDeg);
          const a1 = a0 + slotSpan;
          const mid = (a0 + a1) / 2;
          const pt = pc(sR, mid);
          const sText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          sText.setAttribute('class', 'label label-secondary');
          sText.setAttribute('data-emotion', emo);
          sText.setAttribute('tabindex', '0');
          sText.setAttribute('text-anchor', 'middle');
          sText.setAttribute('dominant-baseline', 'middle');
          sText.setAttribute('x', pt.x.toFixed(0));
          sText.setAttribute('y', pt.y.toFixed(0));
          // Rotate text so it reads vertically along the radial direction of the wedge
          sText.setAttribute('transform', `rotate(${(mid - 90).toFixed(2)} ${pt.x.toFixed(0)} ${pt.y.toFixed(0)})`);
          sText.textContent = secs[si];
          sText.addEventListener('click', () => setPrimarySelected(emo, !sText.classList.contains('selected')));
          sText.addEventListener('keydown', (ke) => { if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); setPrimarySelected(emo, !sText.classList.contains('selected')); } });
          emotionWheelSvg.appendChild(sText);
        }
      }

      // Tertiary pairs (outer ring) as two vertical rotated words per-slot
      const ters = Array.isArray(labels[emo]?.tertiaries) ? labels[emo].tertiaries : [];
      if (ters.length) {
        const tCount = ters.length;
        const padDeg = 10;
        const interDeg = 3; // spacing between tertiary columns
        const tCenter = (rings[2].r0 + rings[2].r1) / 2;
        const radialGap = 12; // spacing between top/bottom rows
        const topR = Math.max(rings[2].r0 + 6, tCenter - radialGap/2);
        const botR = Math.min(rings[2].r1 - 6, tCenter + radialGap/2);
        const totalSpan = Math.max(0, (end - start) - 2 * padDeg - Math.max(0, (tCount - 1) * interDeg));
        const slotSpan = tCount ? (totalSpan / tCount) : 0;

        for (let ti = 0; ti < tCount; ti++) {
          const a0 = start + padDeg + ti * (slotSpan + interDeg);
          const a1 = a0 + slotSpan;
          const mid = (a0 + a1) / 2;

          const p1 = pc(topR, mid);
          const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t1.setAttribute('class', 'label-outer');
          t1.setAttribute('text-anchor', 'middle');
          t1.setAttribute('dominant-baseline', 'middle');
          t1.setAttribute('x', p1.x.toFixed(0));
          t1.setAttribute('y', p1.y.toFixed(0));
          t1.setAttribute('transform', `rotate(${(mid - 90).toFixed(2)} ${p1.x.toFixed(0)} ${p1.y.toFixed(0)})`);
          t1.textContent = ters[ti][0] || '';

          const p2 = pc(botR, mid);
          const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t2.setAttribute('class', 'label-outer');
          t2.setAttribute('text-anchor', 'middle');
          t2.setAttribute('dominant-baseline', 'middle');
          t2.setAttribute('x', p2.x.toFixed(0));
          t2.setAttribute('y', p2.y.toFixed(0));
          t2.setAttribute('transform', `rotate(${(mid - 90).toFixed(2)} ${p2.x.toFixed(0)} ${p2.y.toFixed(0)})`);
          t2.textContent = ters[ti][1] || '';

          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('class', 'label label-tertiary');
          g.setAttribute('data-emotion', emo);
          g.setAttribute('tabindex', '0');
          g.addEventListener('click', () => setPrimarySelected(emo, !g.classList.contains('selected')));
          g.addEventListener('keydown', (ke) => { if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); setPrimarySelected(emo, !g.classList.contains('selected')); } });
          g.appendChild(t1);
          g.appendChild(t2);
          emotionWheelSvg.appendChild(g);
        }
      }
    });

  // No center label
  }

  (async function initWheel() {
    try {
      const data = await loadWheelData();
      buildEmotionWheelFromData(data);
    } catch (e) {
      // Build minimal wheel even if load fails
      buildEmotionWheelFromData({});
    }
  })();

  if (startEmotionsBtn) {
    startEmotionsBtn.addEventListener('click', () => {
      if (!selectedEmotions.length) return;
      currentMood = 'feelings'; // neutral label
      answers = {}; step = 0;
      qTitle.textContent = 'Let’s explore this together';
      messageArea.innerHTML = '';
      regenBtn.disabled = true;
      setQuestionsForEmotions(selectedEmotions);
      setupQuestionStep();
      switchScreen('questions');
      qInput.focus();
    });
  }

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
        const asked = Array.isArray(questions) ? questions.map(q => ({ id: q.id, category: q.category, prompt: q.prompt })) : [];
        const emotions = (Array.isArray(selectedEmotions) && selectedEmotions.length) ? selectedEmotions : emotionsFromMood(currentMood);
        await saveConversation({ userId, mood: currentMood, emotions, answers, message: msg.body, questions: asked }).catch(() => {
          saveConversationLocal({ mood: currentMood, answers, message: msg.body });
        });
        // Remember last context locally for continuation
        try {
          window._HER_last_context = { mood: currentMood, emotions, answers: { ...answers }, message: msg.body, ts: Date.now() };
        } catch {}
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

  // Normalize emotions to catalog tags (e.g., happy -> joy)
  function normalizeEmotions(list) {
    try {
      return (list || []).map(e => String(e).toLowerCase()).map(e => {
        if (e === 'happy') return 'joy';
        if (e === 'sad') return 'sadness';
        return e;
      });
    } catch { return list || []; }
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
        emotions: parseEmotions(r.emotions),
        message: r.message,
        answers: parseAnswers(r.answers),
        ts: Date.parse(r.created_at || Date.now()),
      }));
    } catch {
      // Fallback to localStorage
      try {
        const k = 'her_local_conversations';
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        return arr.slice(0, limit).map(r => ({ mood: r.mood, emotions: r.emotions || [], message: r.message, answers: r.answers, ts: r.ts }));
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

  function parseEmotions(e) {
    if (!e) return [];
    if (Array.isArray(e)) return e;
    try { return JSON.parse(e); } catch { return []; }
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

  // Continue with previous emotions (inside chat)
  if (continueWithEmotionsBtn) {
    continueWithEmotionsBtn.addEventListener('click', () => {
      const ctx = window._HER_last_context || {};
      const emos = Array.isArray(ctx.emotions) ? ctx.emotions : emotionsFromMood(ctx.mood || '');
      if (!emos || !emos.length) return;
      selectedEmotions = [...emos];
      currentMood = 'feelings';
      answers = {}; step = 0;
      qTitle.textContent = 'Let’s explore this together';
      setQuestionsForEmotions(selectedEmotions);
      setupQuestionStep();
      switchScreen('questions');
      qInput.focus();
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
