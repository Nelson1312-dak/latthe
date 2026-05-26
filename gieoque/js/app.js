/**
 * gieoque/js/app.js — I Ching module logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let lines = [];
  let throwTimeouts = [];
  let currentContext = '';

  const screens = {
    intro:  document.getElementById('screen-intro'),
    throw:  document.getElementById('screen-throw'),
    result: document.getElementById('screen-result'),
  };

  const btnStartThrow   = document.getElementById('btn-start-throw');
  const btnNewCast      = document.getElementById('btn-new-cast');
  const btnRestart      = document.getElementById('btn-restart');
  const throwLineNum    = document.getElementById('throw-line-num');
  const throwStatusText = document.getElementById('throw-status-text');
  const coinSlots       = [
    document.getElementById('coin-0'),
    document.getElementById('coin-1'),
    document.getElementById('coin-2'),
  ];
  const lineResultEl  = document.getElementById('line-result');
  const lineSymbolEl  = document.getElementById('line-result-symbol');
  const lineTextEl    = document.getElementById('line-result-text');
  const hexPreview    = document.getElementById('hexagram-preview');

  const aiSection      = document.getElementById('ai-section');
  const aiQuestionDisp = document.getElementById('ai-question-display');
  const aiChatMessages = document.getElementById('ai-chat-messages');
  const aiLoading      = document.getElementById('ai-loading');
  const aiError        = document.getElementById('ai-error');
  const aiChatInput    = document.getElementById('ai-chat-input');
  const btnAskAI       = document.getElementById('btn-ask-ai');
  const gqQuestion     = document.getElementById('gq-question');

  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
  }

  // ---- Line helpers ----
  const LINE_INFO = {
    6: { label: 'Lão Âm ⁻ ⁻ (hào động)', yang: false, moving: true,  cssClass: 'old-yin' },
    7: { label: 'Thiếu Dương ——',          yang: true,  moving: false, cssClass: 'yang' },
    8: { label: 'Thiếu Âm ⁻ ⁻',           yang: false, moving: false, cssClass: 'yin' },
    9: { label: 'Lão Dương —— (hào động)', yang: true,  moving: true,  cssClass: 'old-yang' },
  };

  function animateCoins(values) {
    coinSlots.forEach((slot, i) => {
      slot.className = 'coin-slot';
      slot.textContent = '';
      const t = setTimeout(() => {
        const isYang = values[i] === 3;
        slot.classList.add(isYang ? 'yang' : 'yin');
        slot.textContent = isYang ? '●' : '○';
      }, 80 + i * 80);
      throwTimeouts.push(t);
    });
  }

  function addPreviewLine(lineValue) {
    const info = LINE_INFO[lineValue];
    const row  = document.createElement('div');
    row.className = 'preview-line';
    if (info.yang) {
      const seg = document.createElement('div');
      seg.className = `preview-line-seg yang-seg ${info.cssClass}`;
      row.appendChild(seg);
    } else {
      ['yin-seg', 'yin-seg'].forEach((cls, idx) => {
        if (idx === 1) {
          const gap = document.createElement('div');
          gap.style.width = '12px';
          row.appendChild(gap);
        }
        const seg = document.createElement('div');
        seg.className = `preview-line-seg ${cls} ${info.cssClass}`;
        row.appendChild(seg);
      });
    }
    hexPreview.appendChild(row);
  }

  function renderHexLines(containerId, linesArr) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    linesArr.forEach(val => {
      const info = LINE_INFO[val] || LINE_INFO[7];
      const row  = document.createElement('div');
      let cls = 'result-line';
      if (val === 9) cls += ' moving';
      if (val === 6) cls += ' moving moving-yin';
      row.className = cls;
      if (info.yang) {
        const seg = document.createElement('div');
        seg.className = 'result-line-seg r-yang';
        row.appendChild(seg);
      } else {
        [0, 1].forEach(() => {
          const seg = document.createElement('div');
          seg.className = 'result-line-seg r-yin';
          row.appendChild(seg);
        });
      }
      container.appendChild(row);
    });
  }

  // ---- Auto-throw all 6 lines ----
  function autoThrow() {
    lines = [];
    hexPreview.innerHTML = '';
    lineResultEl.classList.add('hidden');
    coinSlots.forEach(s => { s.className = 'coin-slot'; s.textContent = ''; });

    function throwOne(step) {
      if (step >= 6) {
        const t = setTimeout(showResult, 700);
        throwTimeouts.push(t);
        return;
      }

      throwLineNum.textContent = step + 1;
      if (throwStatusText) throwStatusText.textContent = `Đang gieo hào ${step + 1}/6...`;

      const coinValues = [
        Math.random() < 0.5 ? 3 : 2,
        Math.random() < 0.5 ? 3 : 2,
        Math.random() < 0.5 ? 3 : 2,
      ];
      const sum  = coinValues.reduce((a, b) => a + b, 0);
      const info = LINE_INFO[sum];

      animateCoins(coinValues);

      const t = setTimeout(() => {
        lineSymbolEl.textContent = sum === 9 ? '🔴' : sum === 6 ? '🔵' : '⬜';
        lineTextEl.textContent   = info.label + (info.moving ? ' ✦' : '');
        lineResultEl.classList.remove('hidden');
        lines.push(sum);
        addPreviewLine(sum);

        const t2 = setTimeout(() => throwOne(step + 1), 380);
        throwTimeouts.push(t2);
      }, 300);
      throwTimeouts.push(t);
    }

    throwOne(0);
  }

  btnStartThrow.addEventListener('click', () => {
    throwTimeouts.forEach(clearTimeout);
    throwTimeouts = [];
    showScreen('throw');
    btnRestart.classList.remove('hidden');
    autoThrow();
  });

  // ---- Show result ----
  function showResult() {
    const primary   = getHexagramFromLines(lines);
    const hasMoving = hasMovingLines(lines);
    const changed   = hasMoving ? getChangedHexagram(lines) : null;

    document.getElementById('hex-primary-symbol').textContent  = primary.symbol || '䷀';
    document.getElementById('hex-primary-name').textContent    = `${primary.vn} (${primary.name})`;
    document.getElementById('hex-primary-meaning').textContent = primary.meaning;
    document.getElementById('hex-primary-advice').textContent  = primary.advice;
    renderHexLines('hex-primary-lines', lines);

    const changedSection = document.getElementById('hex-changed-section');
    if (hasMoving && changed) {
      document.getElementById('hex-changed-symbol').textContent  = changed.symbol || '䷀';
      document.getElementById('hex-changed-name').textContent    = `${changed.vn} (${changed.name})`;
      document.getElementById('hex-changed-meaning').textContent = changed.meaning;
      document.getElementById('hex-changed-advice').textContent  = changed.advice;
      renderHexLines('hex-changed-lines', lines.map(v => v === 6 ? 7 : v === 9 ? 8 : v));
      changedSection.classList.remove('hidden');
    } else {
      changedSection.classList.add('hidden');
    }

    showAISection(primary, hasMoving, changed);
    showScreen('result');
  }

  // ---- AI Chat ----
  function buildGQContext(primary, hasMoving, changed) {
    let ctx = `Quẻ chính: ${primary.vn} (${primary.name})\nÝ nghĩa: ${primary.meaning}\nLời khuyên: ${primary.advice}`;
    if (hasMoving && changed) {
      ctx += `\n\nQuẻ biến thành: ${changed.vn} (${changed.name})\nÝ nghĩa: ${changed.meaning}`;
    }
    return ctx;
  }

  function appendBubble(role, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble chat-${role}`;
    div.textContent = text;
    aiChatMessages.appendChild(div);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    return div;
  }

  function sendMessage(question) {
    const q = question.trim();
    if (!q) return;

    appendBubble('user', q);
    const aiBubble = appendBubble('ai', '');
    aiLoading.classList.remove('hidden');
    aiError.classList.add('hidden');
    aiChatInput.disabled = true;
    btnAskAI.disabled = true;

    askAI({
      question: q,
      context: currentContext,
      type: 'gieoque',
      onToken: (token) => {
        aiLoading.classList.add('hidden');
        aiBubble.textContent += token;
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
      },
      onDone: () => {
        aiLoading.classList.add('hidden');
        aiChatInput.disabled = false;
        btnAskAI.disabled = false;
        aiChatInput.value = '';
      },
      onError: (msg) => {
        aiLoading.classList.add('hidden');
        aiBubble.textContent = '⚠️ ' + msg;
        aiBubble.classList.add('chat-error');
        aiChatInput.disabled = false;
        btnAskAI.disabled = false;
      },
    });
  }

  function showAISection(primary, hasMoving, changed) {
    const q = gqQuestion.value.trim();
    if (!q) return;
    currentContext = buildGQContext(primary, hasMoving, changed);
    aiSection.classList.remove('hidden');
    aiQuestionDisp.textContent = `"${q}"`;
    aiChatMessages.innerHTML = '';
    aiError.classList.add('hidden');
    sendMessage(q);
  }

  btnAskAI.addEventListener('click', () => sendMessage(aiChatInput.value));
  aiChatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(aiChatInput.value); }
  });

  // ---- Reset ----
  function resetAll() {
    throwTimeouts.forEach(clearTimeout);
    throwTimeouts = [];
    lines = [];
    currentContext = '';
    btnRestart.classList.add('hidden');
    aiSection.classList.add('hidden');
    aiChatMessages.innerHTML = '';
    showScreen('intro');
  }

  btnNewCast.addEventListener('click', resetAll);
  btnRestart.addEventListener('click', resetAll);
});
