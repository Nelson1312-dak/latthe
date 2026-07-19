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
    linesArr.forEach((val, idx) => {
      const info = LINE_INFO[val] || LINE_INFO[7];
      const row  = document.createElement('div');
      let cls = 'result-line';
      if (val === 9) cls += ' moving';
      if (val === 6) cls += ' moving moving-yin';
      row.className = cls;
      row.style.setProperty('--li', idx); // stagger vẽ hào từ dưới lên
      // hào động ở quẻ chính: chạm để hỏi AI riêng về hào đó
      if ((val === 6 || val === 9) && containerId === 'hex-primary-lines') {
        row.title = `Hỏi AI về Hào ${idx + 1} động`;
        row.setAttribute('role', 'button');
        row.addEventListener('click', () => {
          sendMessage(`Hào ${idx + 1} động trong quẻ này có ý nghĩa gì đối với câu hỏi của tôi? Tôi cần hành động thế nào?`);
        });
      }
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

  // ---- Gieo 6 hào: auto (desktop, như cũ) hoặc manual (mobile: lắc/chạm từng hào) ----
  const castControls = document.getElementById('cast-controls');
  const btnCastLine  = document.getElementById('btn-cast-line');
  const castHint     = document.getElementById('cast-hint');
  const throwStatusBox = document.querySelector('.throw-status');

  let throwMode  = 'auto';   // 'auto' | 'manual'
  let throwState = 'idle';   // 'idle' | 'waiting' | 'casting'
  let pendingStep = 0;
  let lastShakeAt = 0;
  let lastMag = null;

  // Lắc = biến thiên độ lớn gia tốc (kể cả trọng trường) giữa 2 sample đủ lớn.
  // Chỉ nhận khi đang chờ tung (không nhận lúc xu quay) + tối thiểu 1.2s/lần.
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (lastMag !== null && Math.abs(mag - lastMag) > 14
        && throwState === 'waiting' && Date.now() - lastShakeAt > 1200) {
      lastShakeAt = Date.now();
      castNow();
    }
    lastMag = mag;
  }

  function attachShake()  { lastMag = null; window.addEventListener('devicemotion', onMotion); }
  function detachShake()  { window.removeEventListener('devicemotion', onMotion); }

  // Chờ MỘT cú lắc/chạm duy nhất — sau đó 6 hào tự gieo liên tục.
  // (Bản đầu bắt lắc 6 lần/6 hào — user feedback: mỏi tay.)
  function waitForCast(step) {
    pendingStep = step;
    throwState  = 'waiting';
    throwLineNum.textContent = step + 1;
    if (throwStatusText) {
      throwStatusText.textContent = castHint.classList.contains('no-shake')
        ? 'Chạm nút để gieo quẻ'
        : '📳 Lắc điện thoại để gieo quẻ';
    }
    if (throwStatusBox) throwStatusBox.classList.add('waiting');
    castControls.classList.remove('hidden');
  }

  function castNow() {
    if (throwState !== 'waiting') return;
    throwState = 'casting';
    throwMode  = 'auto'; // từ cú kích hoạt trở đi: gieo tự động cả 6 hào
    detachShake();
    castControls.classList.add('hidden');
    if (throwStatusBox) throwStatusBox.classList.remove('waiting');
    castLine(pendingStep);
  }

  function castLine(step) {
    if (step >= 6) {
      detachShake();
      throwState = 'idle';
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
      lineResultEl.classList.remove('hidden', 'pop');
      void lineResultEl.offsetWidth; // retrigger animation cho từng hào
      lineResultEl.classList.add('pop');
      lines.push(sum);
      addPreviewLine(sum);
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]); // haptic khi xu rơi (Android)

      if (step + 1 >= 6) {
        castLine(step + 1); // kết thúc → showResult sau 700ms
      } else {
        const t2 = setTimeout(() => castLine(step + 1), 900); // 900ms to read before next throw
        throwTimeouts.push(t2);
      }
    }, 850); // 850ms to allow all staggered coin spins to resolve
    throwTimeouts.push(t);
  }

  function startThrow(mode, motionOK) {
    throwMode = mode;
    lines = [];
    hexPreview.innerHTML = '';
    lineResultEl.classList.add('hidden');
    coinSlots.forEach(s => { s.className = 'coin-slot'; s.textContent = ''; });
    castControls.classList.add('hidden');
    if (throwStatusBox) throwStatusBox.classList.remove('waiting');
    detachShake();

    if (mode === 'manual') {
      castHint.classList.toggle('no-shake', !motionOK);
      if (motionOK) attachShake();
      waitForCast(0);
    } else {
      throwState = 'casting';
      castLine(0);
    }
  }

  btnStartThrow.addEventListener('click', async () => {
    const questionVal = gqQuestion.value.trim();
    if (!questionVal) {
      alert('Vui lòng nhập câu hỏi của bạn trước khi gieo quẻ! ☯');
      gqQuestion.focus();
      return;
    }
    throwTimeouts.forEach(clearTimeout);
    throwTimeouts = [];

    // Mobile: gieo từng hào bằng lắc/chạm. iOS 13+ phải xin quyền cảm biến
    // NGAY TRONG user gesture này; denied → vẫn manual nhưng chỉ chạm nút.
    let motionOK = false;
    const isTouch = 'ontouchstart' in window;
    if (isTouch && typeof DeviceMotionEvent !== 'undefined') {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try { motionOK = (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (_) {}
      } else {
        motionOK = true; // Android/trình duyệt không cần xin quyền
      }
    }

    showScreen('throw');
    btnRestart.classList.remove('hidden');
    startThrow(isTouch ? 'manual' : 'auto', motionOK);
  });

  btnCastLine.addEventListener('click', castNow);

  // ---- Show result ----
  function showResult() {
    const primary   = getHexagramFromLines(lines);
    const hasMoving = hasMovingLines(lines);
    const changed   = hasMoving ? getChangedHexagram(lines) : null;
    lastCast = { primary, hasMoving, changed, lines: [...lines] };

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

    // Reveal: quẻ chính trồi lên, symbol xoay hiện, 6 hào vẽ từ dưới lên;
    // quẻ biến (nếu có) vào trễ hơn một nhịp
    const primCard = document.getElementById('hex-primary');
    const chgCard  = document.getElementById('hex-changed');
    primCard.classList.remove('reveal');
    chgCard.classList.remove('reveal');
    void primCard.offsetWidth;
    primCard.classList.add('reveal');
    if (hasMoving && changed) chgCard.classList.add('reveal');

    // Gợi ý chạm hào động
    let haoHint = document.getElementById('hao-hint');
    if (!haoHint) {
      haoHint = document.createElement('p');
      haoHint.id = 'hao-hint';
      haoHint.className = 'hao-click-hint';
      haoHint.innerHTML = '<i class="ti ti-hand-click"></i> Chạm vào hào đang nhấp nháy để hỏi AI riêng về hào động đó';
    }
    document.getElementById('hex-primary-lines').after(haoHint);
    haoHint.style.display = hasMoving ? '' : 'none';

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

  // ---- Chips hỏi nhanh theo quẻ ----
  const chipsEl = document.getElementById('gq-chips');

  function buildChips(hasMoving) {
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    const defs = [
      { icon: 'ti-scale',          label: 'Nên hay không nên?',  q: 'Dựa trên quẻ này, tôi nên hay không nên làm điều tôi đang hỏi? Vì sao?' },
      { icon: 'ti-clock',          label: 'Thời điểm thuận lợi', q: 'Theo quẻ này, thời điểm nào thuận lợi nhất để tôi hành động?' },
      { icon: 'ti-alert-triangle', label: 'Cần tránh điều gì?',  q: 'Quẻ này cảnh báo tôi cần tránh hoặc đề phòng điều gì?' },
    ];
    if (hasMoving) {
      lines.forEach((val, idx) => {
        if (val === 6 || val === 9) {
          defs.push({
            icon: 'ti-bolt', hao: true,
            label: `Hào ${idx + 1} động`,
            q: `Hào ${idx + 1} động trong quẻ này có ý nghĩa gì đối với câu hỏi của tôi?`
          });
        }
      });
    }
    defs.forEach(d => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gq-chip' + (d.hao ? ' gq-chip-hao' : '');
      b.innerHTML = `<i class="ti ${d.icon}"></i> ${d.label}`;
      b.addEventListener('click', () => sendMessage(d.q));
      chipsEl.appendChild(b);
    });
  }

  function showAISection(primary, hasMoving, changed) {
    const q = gqQuestion.value.trim();
    if (!q) return;
    currentContext = buildGQContext(primary, hasMoving, changed);
    buildChips(hasMoving);
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
    detachShake();
    throwState = 'idle';
    castControls.classList.add('hidden');
    if (throwStatusBox) throwStatusBox.classList.remove('waiting');
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
    if (chipsEl) chipsEl.innerHTML = '';
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

  // ==================== SHARE CARD (canvas 1080×1350, scaffold dùng chung) ====================
  let lastCast = null;

  // Vẽ quẻ bằng 6 thanh thủ công thay vì glyph unicode ䷀ — glyph này thiếu
  // font trên nhiều máy (hiện ô vuông). values: 6 hào bottom→top (6/7/8/9).
  function drawHexagram(ctx, values, cx, topY, barW, barH, gapY, markMoving) {
    const segGap = Math.round(barW * 0.18);
    for (let i = 0; i < 6; i++) {
      const v = values[i];
      const info = LINE_INFO[v];
      const y = topY + (5 - i) * (barH + gapY); // hào 1 dưới cùng
      const moving = markMoving && info.moving;
      ctx.fillStyle = moving ? '#d98a0a' : '#20322b';
      if (info.yang) {
        window.LatbaiShareCard.roundRect(ctx, cx - barW / 2, y, barW, barH, barH / 2);
        ctx.fill();
      } else {
        const segW = (barW - segGap) / 2;
        window.LatbaiShareCard.roundRect(ctx, cx - barW / 2, y, segW, barH, barH / 2);
        ctx.fill();
        window.LatbaiShareCard.roundRect(ctx, cx + segGap / 2, y, segW, barH, barH / 2);
        ctx.fill();
      }
      if (moving) {
        ctx.beginPath();
        ctx.arc(cx + barW / 2 + 26, y + barH / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  async function shareCastCard(wantShare) {
    const SC = window.LatbaiShareCard;
    if (!SC || !lastCast) return;
    const { primary, hasMoving, changed, lines: castLines } = lastCast;

    const W = 1080, H = 1350;
    const { cv, ctx } = await SC.setup(W, H);
    SC.paintBase(ctx, W, H, '13,150,104');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7887a';
    ctx.font = SC.F(30, 800);
    ctx.fillText('GIEO QUẺ KINH DỊCH · LATBAI.VN', W / 2, 118);

    ctx.fillStyle = '#20322b';
    ctx.font = SC.F(44, 800);
    const q = gqQuestion.value.trim();
    SC.wrapText(ctx, q ? `“${q}”` : 'Quẻ dẫn đường hôm nay', W / 2, 210, W - 200, 58, 2);

    // Quẻ chính (— quẻ biến nếu có hào động)
    const barW = 300, barH = 24, gapY = 18;
    const hexH = 6 * barH + 5 * gapY; // 234
    const topY = 400;
    const single = !(hasMoving && changed);
    const cxPrimary = single ? W / 2 : W / 2 - 260;

    drawHexagram(ctx, castLines, cxPrimary, topY, barW, barH, gapY, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0d9668';
    ctx.font = SC.F(38, 900);
    ctx.fillText(primary.vn, cxPrimary, topY + hexH + 66);
    ctx.fillStyle = '#a7887a';
    ctx.font = SC.F(28, 700);
    ctx.fillText(`${primary.sign}  ·  ${primary.name}`, cxPrimary, topY + hexH + 110);

    if (!single) {
      ctx.fillStyle = '#d98a0a';
      ctx.font = SC.F(64, 800);
      ctx.fillText('→', W / 2, topY + hexH / 2 + 20);

      const cxChanged = W / 2 + 260;
      const stillLines = castLines.map(v => (v === 6 ? 7 : v === 9 ? 8 : v));
      drawHexagram(ctx, stillLines, cxChanged, topY, barW, barH, gapY, false);
      ctx.fillStyle = '#0d9668';
      ctx.font = SC.F(38, 900);
      ctx.fillText(changed.vn, cxChanged, topY + hexH + 66);
      ctx.fillStyle = '#a7887a';
      ctx.font = SC.F(28, 700);
      ctx.fillText(`${changed.sign}  ·  ${changed.name}`, cxChanged, topY + hexH + 110);
    }

    // Lời quẻ
    ctx.fillStyle = '#4a5d54';
    ctx.font = SC.F(30, 600);
    SC.wrapText(ctx, primary.meaning, W / 2, 960, W - 240, 44, 3);

    SC.footer(ctx, W, H, 'Gieo quẻ Kinh Dịch miễn phí tại  latbai.vn/gieoque');

    await SC.shareOrDownload(cv, {
      fileName: `gieoque-${Date.now()}.png`,
      title: 'Gieo Quẻ Kinh Dịch',
      text: `Quẻ ${primary.vn} vừa ứng với tôi ☯ — gieo thử tại latbai.vn/gieoque`,
      wantShare,
    });
  }

  document.getElementById('btn-share-cast').addEventListener('click', () => shareCastCard(true));
  document.getElementById('btn-download-cast').addEventListener('click', () => shareCastCard(false));

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
