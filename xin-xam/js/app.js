/**
 * xin-xam/js/app.js — Xin Xăm module logic.
 * Flow: nhập câu hỏi → lắc ống xăm (DeviceMotion 1 cú lắc / chạm nút,
 * pattern như gieoque) → que xăm rơi → thẻ xăm → AI Thầy Xăm + chat →
 * share card + history.
 */

document.addEventListener('DOMContentLoaded', () => {
  let chatHistory = [];
  let questionsAsked = 0;
  let currentXam = null;
  let currentMemory = '';

  const screens = {
    intro:  document.getElementById('screen-intro'),
    shake:  document.getElementById('screen-shake'),
    result: document.getElementById('screen-result'),
  };
  const xxQuestion    = document.getElementById('xx-question');
  const btnStartShake = document.getElementById('btn-start-shake');
  const btnRestart    = document.getElementById('btn-restart');
  const btnNewXam     = document.getElementById('btn-new-xam');
  const shakeControls = document.getElementById('shake-controls');
  const btnShakeNow   = document.getElementById('btn-shake-now');
  const shakeHint     = document.getElementById('shake-hint');
  const tubeEl        = document.getElementById('xam-tube');
  const shakeStatus   = document.getElementById('shake-status-text');

  const aiSection      = document.getElementById('ai-section');
  const aiQuestionDisp = document.getElementById('ai-question-display');
  const aiChatMessages = document.getElementById('ai-chat-messages');
  const aiLoading      = document.getElementById('ai-loading');
  const aiError        = document.getElementById('ai-error');
  const aiChatInput    = document.getElementById('ai-chat-input');
  const btnAskAI       = document.getElementById('btn-ask-ai');
  const chipsEl        = document.getElementById('xx-chips');

  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
  }

  // ---- Lắc ống xăm: 1 cú lắc (hoặc chạm) → animation → ra xăm ----
  let shakeState = 'idle'; // 'idle' | 'waiting' | 'shaking'
  let lastMag = null;

  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (lastMag !== null && Math.abs(mag - lastMag) > 14 && shakeState === 'waiting') {
      shakeNow();
    }
    lastMag = mag;
  }
  function attachShake() { lastMag = null; window.addEventListener('devicemotion', onMotion); }
  function detachShake() { window.removeEventListener('devicemotion', onMotion); }

  function waitForShake(motionOK) {
    shakeState = 'waiting';
    shakeHint.classList.toggle('no-shake', !motionOK);
    if (shakeStatus) {
      shakeStatus.textContent = motionOK
        ? '📳 Lắc điện thoại để xin xăm'
        : 'Chạm nút để xin xăm';
    }
    shakeControls.classList.remove('hidden');
    if (motionOK) attachShake();
  }

  function shakeNow() {
    if (shakeState !== 'waiting') return;
    shakeState = 'shaking';
    detachShake();
    shakeControls.classList.add('hidden');
    if (shakeStatus) shakeStatus.textContent = 'Ống xăm đang lắc, thành tâm chờ quẻ...';
    tubeEl.classList.add('shaking');
    if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 30]);

    // ống rung ~1.6s → que trồi ra ~1.2s → hiện kết quả
    setTimeout(() => {
      tubeEl.classList.remove('shaking');
      tubeEl.classList.add('stick-out');
      if (navigator.vibrate) navigator.vibrate(80);
      if (shakeStatus) shakeStatus.textContent = 'Một que xăm đã rơi ra...';
      setTimeout(() => {
        currentXam = XAM_DATA[Math.floor(Math.random() * XAM_DATA.length)];
        showResult();
      }, 1200);
    }, 1600);
  }

  btnShakeNow.addEventListener('click', shakeNow);

  btnStartShake.addEventListener('click', async () => {
    const q = xxQuestion.value.trim();
    if (!q) {
      alert('Con hãy nhập điều muốn hỏi trước khi xin xăm nhé! 🙏');
      xxQuestion.focus();
      return;
    }

    // iOS 13+ phải xin quyền cảm biến trong chính cú click này
    let motionOK = false;
    const isTouch = 'ontouchstart' in window;
    if (isTouch && typeof DeviceMotionEvent !== 'undefined') {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try { motionOK = (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (_) {}
      } else {
        motionOK = true;
      }
    }

    tubeEl.classList.remove('stick-out', 'shaking');
    showScreen('shake');
    btnRestart.classList.remove('hidden');
    window.scrollTo({ top: 0 });

    if (isTouch) {
      waitForShake(motionOK);
    } else {
      // desktop: tự lắc sau một nhịp ngắn
      shakeState = 'waiting';
      shakeControls.classList.add('hidden');
      setTimeout(shakeNow, 800);
    }
  });

  // ---- Render thẻ xăm ----
  const HANG_CLASS = {
    'thuong-thuong': 'hang-tt', 'thuong-cat': 'hang-tc',
    'trung-binh': 'hang-tb', 'ha': 'hang-h', 'ha-ha': 'hang-hh',
  };

  function showResult() {
    const x = currentXam;
    document.getElementById('xam-so').textContent = `Xăm số ${x.so}`;
    const hangEl = document.getElementById('xam-hang');
    hangEl.textContent = x.hangLabel;
    hangEl.className = `xam-hang ${HANG_CLASS[x.hang] || ''}`;
    document.getElementById('xam-ten').textContent = x.ten;
    document.getElementById('xam-tho').innerHTML = x.tho.map(l => `<span>${l}</span>`).join('');
    document.getElementById('xam-y').textContent = x.y;
    document.getElementById('xam-dienco').textContent = x.dienco;
    document.getElementById('lv-giadao').textContent = x.linhvuc.giadao;
    document.getElementById('lv-tailoc').textContent = x.linhvuc.tailoc;
    document.getElementById('lv-tinhduyen').textContent = x.linhvuc.tinhduyen;
    document.getElementById('lv-suckhoe').textContent = x.linhvuc.suckhoe;

    const card = document.getElementById('xam-card');
    card.classList.remove('reveal');
    void card.offsetWidth;
    card.classList.add('reveal');

    shakeState = 'idle';
    showScreen('result');
    window.scrollTo({ top: 0 });
    showAISection();
  }

  // ---- AI Thầy Xăm ----
  const chat = Chat.createChat({ messagesEl: aiChatMessages, loadingEl: aiLoading, inputEl: aiChatInput, btnEl: btnAskAI });

  function buildXXContext() {
    const x = currentXam;
    return JSON.stringify({
      so: x.so, ten: x.ten, hang: x.hangLabel,
      tho: x.tho.join(' / '), y: x.y, dienco: x.dienco,
    });
  }

  function sendMessage(question) {
    const q = question.trim();
    if (!q) return;

    const isFollowUp = chatHistory.length > 0;
    if (isFollowUp) {
      if (questionsAsked >= 5) {
        alert('Con đã hỏi đủ 5 câu cho quẻ xăm này. Muốn hỏi tiếp, hãy thành tâm xin một quẻ mới nhé! 🙏');
        return;
      }
      questionsAsked++;
    }

    aiError.classList.add('hidden');
    chat.sendWithUI({
      question: q,
      context: buildXXContext(),
      type: 'xinxam',
      history: chatHistory,
      memory: chatHistory.length === 0 ? currentMemory : '',
      onDone(answer) {
        chatHistory.push({ role: 'user', content: q });
        chatHistory.push({ role: 'assistant', content: answer });
        if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
        if (questionsAsked >= 5) {
          aiChatInput.placeholder = 'Đã đủ 5 câu hỏi thêm cho quẻ này...';
          aiChatInput.disabled = true;
          btnAskAI.disabled = true;
        } else {
          aiChatInput.value = '';
        }
      },
    });
  }

  function buildChips() {
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    const defs = [
      { icon: 'ti-bulb',             label: 'Nên làm gì?',      q: 'Theo quẻ xăm này, con nên làm gì cụ thể cho việc con đang hỏi?' },
      { icon: 'ti-alert-triangle',   label: 'Cần kiêng gì?',    q: 'Quẻ xăm này dặn con cần kiêng kỵ hay đề phòng điều gì?' },
      { icon: 'ti-message-question', label: 'Bao giờ ứng?',     q: 'Điềm của quẻ xăm này thường ứng nghiệm trong khoảng thời gian nào?' },
    ];
    defs.forEach(d => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'xx-chip';
      b.innerHTML = `<i class="ti ${d.icon}"></i> ${d.label}`;
      b.addEventListener('click', () => sendMessage(d.q));
      chipsEl.appendChild(b);
    });
  }

  function showAISection() {
    const q = xxQuestion.value.trim();
    if (!q) return;
    buildChips();
    aiSection.classList.remove('hidden');
    aiQuestionDisp.textContent = `"${q}"`;
    aiChatMessages.innerHTML = '';
    aiError.classList.add('hidden');
    questionsAsked = 0;
    chatHistory = [];
    aiChatInput.disabled = false;
    btnAskAI.disabled = false;
    aiChatInput.value = '';
    aiChatInput.placeholder = 'Hỏi thêm thầy về quẻ xăm...';

    // Ký ức các lần xem TRƯỚC — build trước khi save, không thì lượt này lẫn vào
    currentMemory = (window.History && window.History.buildMemory) ? window.History.buildMemory() : '';

    if (window.History) {
      window.History.save('xinxam', {
        question: q,
        so: currentXam.so,
        ten: currentXam.ten,
        hangLabel: currentXam.hangLabel,
        hang: currentXam.hang,
      });
    }

    sendMessage(q);
  }

  btnAskAI.addEventListener('click', () => sendMessage(aiChatInput.value));
  aiChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(aiChatInput.value); }
  });

  // ---- Reset ----
  function resetAll() {
    detachShake();
    shakeState = 'idle';
    shakeControls.classList.add('hidden');
    tubeEl.classList.remove('shaking', 'stick-out');
    chatHistory = [];
    questionsAsked = 0;
    currentXam = null;
    aiChatInput.disabled = false;
    btnAskAI.disabled = false;
    aiChatInput.value = '';
    aiSection.classList.add('hidden');
    aiChatMessages.innerHTML = '';
    if (chipsEl) chipsEl.innerHTML = '';
    btnRestart.classList.add('hidden');
    showScreen('intro');
    window.scrollTo({ top: 0 });
  }
  btnRestart.addEventListener('click', resetAll);
  btnNewXam.addEventListener('click', resetAll);

  // ---- History modal ----
  const btnHistory = document.getElementById('btn-history');
  if (btnHistory && window.History) {
    btnHistory.addEventListener('click', () => {
      window.History.openModal({
        type: 'xinxam',
        title: '🏮 Lịch sử xin xăm',
        formatItem: (item) => {
          const div = document.createElement('div');
          const head = document.createElement('div');
          head.className = 'history-item-head';
          head.textContent = `Xăm số ${item.so} — ${item.ten || ''} (${item.hangLabel || ''})`;
          const qEl = document.createElement('div');
          qEl.className = 'history-question';
          qEl.textContent = item.question;
          div.appendChild(head);
          div.appendChild(qEl);
          return div;
        },
      });
    });
  }

  // ---- Gợi ý câu hỏi nhanh ở intro ----
  document.querySelectorAll('.sq-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      xxQuestion.value = tag.dataset.q;
      xxQuestion.focus();
    });
  });

  // ==================== SHARE CARD (scaffold dùng chung) ====================
  const HANG_COLOR = {
    'thuong-thuong': '#d98a0a', 'thuong-cat': '#b91c1c',
    'trung-binh': '#6b7280', 'ha': '#1e3a8a', 'ha-ha': '#1f2937',
  };

  async function shareXamCard(wantShare) {
    const SC = window.LatbaiShareCard;
    if (!SC || !currentXam) return;
    const x = currentXam;

    const W = 1080, H = 1350;
    const { cv, ctx } = await SC.setup(W, H);
    SC.paintBase(ctx, W, H, '185,28,28');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7887a';
    ctx.font = SC.F(30, 800);
    ctx.fillText('XIN XĂM QUAN ÂM · LATBAI.VN', W / 2, 118);

    ctx.fillStyle = '#3b1d1d';
    ctx.font = SC.F(42, 800);
    const q = xxQuestion.value.trim();
    SC.wrapText(ctx, q ? `“${q}”` : 'Quẻ xăm dẫn đường', W / 2, 200, W - 200, 54, 2);

    // Số xăm lớn + badge hạng
    ctx.fillStyle = '#b91c1c';
    ctx.font = SC.F(150, 900);
    ctx.fillText(`Xăm ${x.so}`, W / 2, 480);
    const hangColor = HANG_COLOR[x.hang] || '#6b7280';
    ctx.font = SC.F(40, 800);
    const hw = ctx.measureText(x.hangLabel).width + 76;
    ctx.fillStyle = hangColor;
    SC.roundRect(ctx, (W - hw) / 2, 520, hw, 74, 37);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(x.hangLabel, W / 2, 570);

    // Tên điển cố
    ctx.fillStyle = '#6b4030';
    ctx.font = SC.F(36, 800);
    ctx.fillText(x.ten, W / 2, 668);

    // Thơ 4 câu
    ctx.fillStyle = '#3b1d1d';
    ctx.font = `italic 600 34px 'Be Vietnam Pro', sans-serif`;
    x.tho.forEach((line, i) => ctx.fillText(line, W / 2, 748 + i * 52));

    // Ý nghĩa
    ctx.fillStyle = '#5a4a3a';
    ctx.font = SC.F(29, 600);
    SC.wrapText(ctx, x.y, W / 2, 1020, W - 220, 42, 4);

    SC.footer(ctx, W, H, 'Xin xăm online miễn phí tại  latbai.vn/xin-xam');

    await SC.shareOrDownload(cv, {
      fileName: `xin-xam-${x.so}.png`,
      title: 'Xin Xăm Quan Âm',
      text: `Tôi vừa rút được xăm số ${x.so} — ${x.hangLabel} 🏮 Xin thử tại latbai.vn/xin-xam`,
      wantShare,
    });
  }

  document.getElementById('btn-share-xam').addEventListener('click', () => shareXamCard(true));
  document.getElementById('btn-download-xam').addEventListener('click', () => shareXamCard(false));
});
