/**
 * tarot/js/app.js — Tarot module logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let selectedSpread = null;
  let drawnCards = [];
  let holdTimer = null;
  let holdDone = false;

  const screens = {
    spread:  document.getElementById('screen-spread'),
    shuffle: document.getElementById('screen-shuffle'),
    reading: document.getElementById('screen-reading'),
  };
  const spreadBtns      = document.querySelectorAll('.spread-btn');
  const deckVisual      = document.getElementById('deck-visual');
  const holdProgressBar = document.getElementById('hold-progress-bar');
  const shuffleHintEl   = document.getElementById('shuffle-hint');
  const btnDraw         = document.getElementById('btn-draw');
  const spreadLabel     = document.getElementById('spread-label');
  const cardsLayout     = document.getElementById('cards-layout');
  const readingDetail   = document.getElementById('reading-detail');
  const btnNewReading   = document.getElementById('btn-new-reading');
  const btnRestart      = document.getElementById('btn-restart');

  let chatHistory = []; // [{role:'user'|'assistant', content:'...'}]

  const aiSection      = document.getElementById('ai-section');
  const aiQuestionDisp = document.getElementById('ai-question-display');
  const aiChatMessages = document.getElementById('ai-chat-messages');
  const aiLoading      = document.getElementById('ai-loading');
  const aiError        = document.getElementById('ai-error');
  const aiChatInput    = document.getElementById('ai-chat-input');
  const btnAskAI       = document.getElementById('btn-ask-ai');
  const tarotQuestion  = document.getElementById('tarot-question');

  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
  }

  // ---- Spread selection ----
  spreadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSpread = btn.dataset.spread;
      resetShuffle();
      showScreen('shuffle');
    });
  });

  // ---- Hold-to-shuffle ----
  function resetShuffle() {
    holdDone = false;
    drawnCards = [];
    clearTimeout(holdTimer);
    holdProgressBar.style.transition = 'none';
    holdProgressBar.style.width = '0%';
    deckVisual.classList.remove('holding', 'shuffle-done');
    shuffleHintEl.textContent = 'Giữ bộ bài để xáo...';
    btnDraw.classList.add('hidden');
  }

  function settleDeckCards() {
    deckVisual.querySelectorAll('.deck-card').forEach((c, i) => {
      c.style.transition = 'transform 0.45s cubic-bezier(.34,1.56,.64,1)';
      const angle = i === 0 ? -3 : i === 1 ? 0 : 3;
      const ty    = i === 0 ?  0 : i === 1 ? -4 : -8;
      c.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(${ty}px)`;
    });
  }

  function startHold() {
    if (holdDone) return;
    deckVisual.classList.add('holding');

    deckVisual.querySelectorAll('.deck-card').forEach(c => {
      c.style.transition = 'transform 0.3s ease';
      const angle = (Math.random() - 0.5) * 50;
      const tx    = (Math.random() - 0.5) * 70;
      c.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateX(${tx}px)`;
    });

    holdProgressBar.style.transition = 'width 2000ms linear';
    holdProgressBar.style.width = '100%';

    holdTimer = setTimeout(() => {
      holdDone = true;
      deckVisual.classList.remove('holding');
      deckVisual.classList.add('shuffle-done');
      settleDeckCards();
      shuffleHintEl.textContent = 'Bài đã được xáo ✨';
      btnDraw.classList.remove('hidden');
    }, 2000);
  }

  function cancelHold() {
    if (holdDone) return;
    clearTimeout(holdTimer);
    deckVisual.classList.remove('holding');
    holdProgressBar.style.transition = 'width 0.3s ease';
    holdProgressBar.style.width = '0%';
    settleDeckCards();
  }

  deckVisual.addEventListener('mousedown', startHold);
  deckVisual.addEventListener('touchstart', startHold, { passive: true });
  document.addEventListener('mouseup', cancelHold);
  document.addEventListener('touchend', cancelHold);
  document.addEventListener('touchcancel', cancelHold);

  // ---- Draw cards ----
  btnDraw.addEventListener('click', () => {
    const spread = TAROT_SPREADS[selectedSpread];
    const pool   = [...TAROT_CARDS].sort(() => Math.random() - 0.5);
    drawnCards   = pool.slice(0, spread.positions.length).map(card => ({
      card,
      reversed: Math.random() < 0.35,
    }));
    renderReading();
    showScreen('reading');
    btnRestart.classList.remove('hidden');
    showAISection();
  });

  // ---- Render reading ----
  function renderReading() {
    const spread = TAROT_SPREADS[selectedSpread];
    spreadLabel.textContent = spread.name;
    cardsLayout.innerHTML = '';
    readingDetail.classList.add('hidden');

    drawnCards.forEach(({ card, reversed }, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'drawn-card';

      const face = document.createElement('div');
      face.className = 'dc-face revealed' + (reversed ? ' reversed' : '');
      face.innerHTML = `
        <span class="dc-symbol">${card.symbol}</span>
        <span class="dc-vn-name">${card.vn}</span>
        <span class="dc-reveal-hint">Nhấn xem</span>
      `;

      const label = document.createElement('span');
      label.className = 'dc-position-label';
      label.textContent = spread.positions[index];

      wrapper.appendChild(face);
      wrapper.appendChild(label);
      wrapper.addEventListener('click', () => showDetail(index));
      cardsLayout.appendChild(wrapper);
    });

    setTimeout(() => showDetail(0), 400);
  }

  function showDetail(index) {
    const { card, reversed } = drawnCards[index];
    document.querySelectorAll('.drawn-card').forEach((el, i) => {
      el.classList.toggle('active-card', i === index);
    });

    const spread      = TAROT_SPREADS[selectedSpread];
    const meaning     = reversed ? card.reversed : card.upright;
    const orientation = reversed ? 'Ngược' : 'Xuôi';

    document.getElementById('detail-symbol').textContent   = card.symbol;
    document.getElementById('detail-position').textContent = spread.positions[index];
    document.getElementById('detail-name').textContent     = `${card.vn} (${card.name})`;
    document.getElementById('detail-number').textContent   = `Lá ${card.number} • ${card.element}`;

    const orientEl = document.getElementById('detail-orientation');
    orientEl.textContent = orientation;
    orientEl.className   = 'detail-orientation ' + (reversed ? 'reversed' : 'upright');

    document.getElementById('detail-keywords').innerHTML = card.keywords
      .map(k => `<span class="keyword-tag">${k}</span>`).join('');
    document.getElementById('detail-meaning').textContent = meaning;
    document.getElementById('detail-advice').textContent  = card.advice;
    document.getElementById('detail-element').textContent = card.element;

    readingDetail.classList.remove('hidden');
    readingDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- AI Chat ----
  function buildTarotContext() {
    const spread = TAROT_SPREADS[selectedSpread];
    return drawnCards.map(({ card, reversed }, i) => {
      const dir = reversed ? 'Ngược' : 'Xuôi';
      return `• Vị trí "${spread.positions[i]}": ${card.vn} (${card.name}) — ${dir}\n  Ý nghĩa: ${reversed ? card.reversed : card.upright}`;
    }).join('\n\n');
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
      context: buildTarotContext(),
      type: 'tarot',
      history: chatHistory,
      onToken: (token) => {
        aiLoading.classList.add('hidden');
        aiBubble.textContent += token;
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
      },
      onDone: (fullAnswer) => {
        aiLoading.classList.add('hidden');
        chatHistory.push({ role: 'user', content: q });
        chatHistory.push({ role: 'assistant', content: fullAnswer });
        if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
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

  function showAISection() {
    const q = tarotQuestion.value.trim();
    if (!q) return;
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
  function goNewReading() {
    resetShuffle();
    chatHistory = [];
    btnRestart.classList.add('hidden');
    aiSection.classList.add('hidden');
    aiChatMessages.innerHTML = '';
    showScreen('spread');
  }

  btnNewReading.addEventListener('click', goNewReading);
  btnRestart.addEventListener('click', goNewReading);
});
