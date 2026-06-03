/**
 * gieoque/js/app.js — I Ching module logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let lines = [];
  let throwTimeouts = [];
  let currentContext = '';
  let chatHistory = [];
  let questionsAsked = 0;

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
      slot.className = 'coin-slot rolling';
      slot.textContent = '';
      const t = setTimeout(() => {
        slot.classList.remove('rolling');
        const isYang = values[i] === 3;
        slot.classList.add(isYang ? 'yang' : 'yin');
        slot.textContent = isYang ? '乾' : '坤';
      }, 400 + i * 150); // Staggered stops: 400ms, 550ms, 700ms
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

        const t2 = setTimeout(() => throwOne(step + 1), 900); // 900ms to read before next throw
        throwTimeouts.push(t2);
      }, 850); // 850ms to allow all staggered coin spins to resolve
      throwTimeouts.push(t);
    }

    throwOne(0);
  }

  btnStartThrow.addEventListener('click', () => {
    const questionVal = gqQuestion.value.trim();
    if (!questionVal) {
      alert('Vui lòng nhập câu hỏi của bạn trước khi gieo quẻ! ☯');
      gqQuestion.focus();
      return;
    }
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
    let mutatedLinesStr = 'Không có';
    let mutatedTextStr = 'Không có';
    
    if (hasMoving && changed) {
      const movingIndices = [];
      lines.forEach((val, idx) => {
        if (val === 6 || val === 9) {
          movingIndices.push(idx + 1);
        }
      });
      if (movingIndices.length > 0) {
        mutatedLinesStr = movingIndices.map(num => `Hào ${num}`).join(', ');
        mutatedTextStr = `Biến đổi thành quẻ ${changed.vn} (${changed.meaning}). Lời khuyên: ${changed.advice}`;
      }
    }

    return JSON.stringify({
      mainName: primary.vn,
      mainText: `${primary.meaning}. Lời khuyên: ${primary.advice}`,
      mutatedHao: mutatedLinesStr,
      mutatedHaoText: mutatedTextStr
    });
  }

  const chat = Chat.createChat({ messagesEl: aiChatMessages, loadingEl: aiLoading, inputEl: aiChatInput, btnEl: btnAskAI });

  function sendMessage(question) {
    const q = question.trim();
    if (!q) return;

    const isFollowUp = chatHistory.length > 0;
    if (isFollowUp) {
      if (questionsAsked >= 5) {
        alert("Bạn đã đặt tối đa 5 câu hỏi phụ cho quẻ này. Vui lòng bấm 'Gieo Quẻ Mới' để thực hiện lần gieo mới.");
        return;
      }
      questionsAsked++;
    }

    aiError.classList.add('hidden');
    chat.sendWithUI({
      question: q,
      context: currentContext,
      type: 'gieoque',
      history: chatHistory,
      onDone(answer) {
        chatHistory.push({ role: 'user', content: q });
        chatHistory.push({ role: 'assistant', content: answer });
        if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
        if (questionsAsked >= 5) {
          aiChatInput.placeholder = "Đã đạt giới hạn 5 câu hỏi bổ sung...";
          aiChatInput.disabled = true;
          btnAskAI.disabled = true;
          chat.appendBubble('ai', '💡 *Thông báo:* Bạn đã gửi đủ 5 câu hỏi bổ sung cho quẻ này. Để tiếp tục hỏi thêm các câu hỏi khác, bạn vui lòng bấm nút **Gieo Quẻ Mới** ở bên dưới nhé!');
        } else {
          aiChatInput.value = '';
        }
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
    questionsAsked = 0;
    aiChatInput.disabled = false;
    btnAskAI.disabled = false;
    aiChatInput.value = '';
    aiChatInput.placeholder = "Hỏi thêm về quẻ...";

    if (window.History) {
      window.History.save('gieoque', {
        question: q,
        mainSymbol: primary.symbol || '䷀',
        mainName: primary.vn,
        mainNameEn: primary.name,
        meaning: primary.meaning,
        hasMoving,
        changedSymbol: hasMoving && changed ? changed.symbol : null,
        changedName: hasMoving && changed ? changed.vn : null,
      });
    }

    sendMessage(q);
  }

  // ---- History modal ----
  const btnHistory = document.getElementById('btn-history');
  if (btnHistory && window.History) {
    btnHistory.addEventListener('click', () => {
      window.History.openModal({
        type: 'gieoque',
        title: '📜 Lịch sử gieo quẻ',
        formatItem: (item) => {
          const wrap = document.createElement('div');
          const head = document.createElement('div');
          head.className = 'history-item-head';
          head.innerHTML = `<span class="history-symbol">${item.mainSymbol}</span><span class="history-name">${item.mainName}</span>`;
          if (item.hasMoving && item.changedSymbol) {
            head.innerHTML += `<span class="history-arrow">→</span><span class="history-symbol">${item.changedSymbol}</span><span class="history-name">${item.changedName}</span>`;
          }
          const q = document.createElement('p');
          q.className = 'history-question';
          q.textContent = `"${item.question}"`;
          wrap.appendChild(head);
          wrap.appendChild(q);
          return wrap;
        },
      });
    });
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
    chatHistory = [];
    questionsAsked = 0;
    aiChatInput.disabled = false;
    btnAskAI.disabled = false;
    aiChatInput.value = '';
    aiChatInput.placeholder = "Hỏi thêm về quẻ...";
    btnRestart.classList.add('hidden');
    aiSection.classList.add('hidden');
    aiChatMessages.innerHTML = '';
    showScreen('intro');
  }

  // ---- Suggested question tags click handler ----
  document.querySelectorAll('.sq-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      gqQuestion.value = tag.dataset.q;
      gqQuestion.focus();
    });
  });

  btnNewCast.addEventListener('click', resetAll);
  btnRestart.addEventListener('click', resetAll);

  // ---- BLOCK 2 Guide Popup Toggle ----
  const btnOpenGuide = document.getElementById('btn-open-guide');
  const btnCloseGuide = document.getElementById('btn-close-guide');
  const guidePopup = document.getElementById('gq-guide-popup');

  if (btnOpenGuide && btnCloseGuide && guidePopup) {
    btnOpenGuide.addEventListener('click', () => {
      guidePopup.classList.remove('hidden');
    });
    btnCloseGuide.addEventListener('click', () => {
      guidePopup.classList.add('hidden');
    });
    guidePopup.addEventListener('click', (e) => {
      if (e.target === guidePopup) {
        guidePopup.classList.add('hidden');
      }
    });
  }
});
