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
      const questionVal = tarotQuestion.value.trim();
      if (!questionVal) {
        alert('Vui lòng nhập câu hỏi của bạn trước khi chọn kiểu rải bài! ✨');
        tarotQuestion.focus();
        return;
      }
      selectedSpread = btn.dataset.spread;
      resetShuffle();
      showScreen('shuffle');
    });
  });

  // ---- Hold-to-shuffle ----
  let isShuffling = false;

  function resetShuffle() {
    holdDone = false;
    isShuffling = false;
    drawnCards = [];
    clearTimeout(holdTimer);
    holdProgressBar.style.transition = 'none';
    holdProgressBar.style.width = '0%';
    deckVisual.classList.remove('holding', 'shuffle-done');
    shuffleHintEl.textContent = 'Chạm vào bộ bài để truyền năng lượng & xáo bài... ✨';
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

  function startShuffle() {
    if (holdDone || isShuffling) return;
    isShuffling = true;
    deckVisual.classList.add('holding');
    shuffleHintEl.textContent = 'Đang truyền năng lượng & xáo bài... ✨';

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
      isShuffling = false;
      deckVisual.classList.remove('holding');
      deckVisual.classList.add('shuffle-done');
      settleDeckCards();
      shuffleHintEl.textContent = 'Bài đã được xáo & truyền năng lượng xong ✨';
      btnDraw.classList.remove('hidden');
    }, 2000);
  }

  deckVisual.addEventListener('click', startShuffle);

  // ---- Draw cards ----
  btnDraw.addEventListener('click', () => {
    const spread = TAROT_SPREADS[selectedSpread];
    
    // Fisher-Yates shuffle
    const pool = [...TAROT_CARDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    drawnCards = pool.slice(0, spread.positions.length).map(card => ({
      card,
      reversed: Math.random() < 0.35,
      revealed: false
    }));
    
    renderReading();
    showScreen('reading');
    btnRestart.classList.remove('hidden');
  });

  // ---- Render reading ----
  function renderReading() {
    const spread = TAROT_SPREADS[selectedSpread];
    spreadLabel.textContent = spread.name;
    cardsLayout.innerHTML = '';
    readingDetail.classList.add('hidden');
    aiSection.classList.add('hidden');
    btnNewReading.classList.add('hidden');

    drawnCards.forEach(({ card, reversed, revealed }, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'drawn-card';
      wrapper.dataset.index = index;

      wrapper.innerHTML = `
        <div class="dc-card-inner">
          <div class="dc-card-back">
            <svg class="dc-back-pattern" viewBox="0 0 100 140" aria-hidden="true">
              <defs>
                <radialGradient id="dcGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#c084fc" stop-opacity="0.55"/>
                  <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <rect x="6" y="6" width="88" height="128" rx="8"
                    fill="none" stroke="#c084fc" stroke-width="0.5" stroke-opacity="0.45"/>
              <rect x="10" y="10" width="80" height="120" rx="6"
                    fill="none" stroke="#d4a642" stroke-width="0.4" stroke-opacity="0.55"/>
              <circle cx="50" cy="70" r="32" fill="url(#dcGlow)"/>
              <g stroke="#d4a642" stroke-width="0.7" stroke-opacity="0.85" fill="none">
                <circle cx="50" cy="70" r="18"/>
                <path d="M 50 52 L 53 67 L 68 70 L 53 73 L 50 88 L 47 73 L 32 70 L 47 67 Z" fill="#d4a642" fill-opacity="0.4"/>
                <circle cx="50" cy="70" r="3" fill="#d4a642" fill-opacity="0.9"/>
              </g>
              <g fill="#c084fc" fill-opacity="0.7">
                <circle cx="50" cy="30" r="1.3"/>
                <circle cx="30" cy="50" r="1.1"/>
                <circle cx="70" cy="50" r="1.1"/>
                <circle cx="30" cy="90" r="1.1"/>
                <circle cx="70" cy="90" r="1.1"/>
                <circle cx="50" cy="110" r="1.3"/>
              </g>
            </svg>
            <span class="dc-reveal-hint">Lật thẻ</span>
          </div>
          <div class="dc-card-front${reversed ? ' reversed' : ''}">
            <img class="dc-card-img" src="images/${card.id}.jpg" alt="${card.vn}">
            <span class="dc-vn-name">${card.vn}</span>
          </div>
        </div>
        <span class="dc-position-label">${spread.positions[index]}</span>
      `;

      wrapper.addEventListener('click', () => handleCardClick(index));
      cardsLayout.appendChild(wrapper);
    });
  }

  function handleCardClick(index) {
    const cardObj = drawnCards[index];
    const wrapper = cardsLayout.querySelector(`.drawn-card[data-index="${index}"]`);

    if (!cardObj.revealed) {
      cardObj.revealed = true;
      wrapper.classList.add('revealed');
      
      // Check if all cards are now revealed
      const allRevealed = drawnCards.every(c => c.revealed);
      if (allRevealed) {
        setTimeout(() => {
          showAISection();
          btnNewReading.classList.remove('hidden');
        }, 800); // Delay AI section slightly to let flip animation finish
      }
    }

    // Toggle active card styling and show details
    document.querySelectorAll('.drawn-card').forEach((el, i) => {
      el.classList.toggle('active-card', i === index);
    });
    
    showDetail(index);
  }

  function showDetail(index) {
    const { card, reversed, revealed } = drawnCards[index];
    
    // Only show detail if card is revealed
    if (!revealed) return;

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
    readingDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- AI Chat ----
  function buildTarotContext() {
    const spread = TAROT_SPREADS[selectedSpread];
    return drawnCards.map(({ card, reversed }, i) => {
      const dir = reversed ? 'Ngược' : 'Xuôi';
      return `• Vị trí "${spread.positions[i]}": ${card.vn} (${card.name}) — ${dir}\n  Ý nghĩa: ${reversed ? card.reversed : card.upright}`;
    }).join('\n\n');
  }

  function parseMarkdown(text) {
    if (!text) return '';
    let lines = text.split('\n');
    let result = [];
    let inList = false;

    for (let line of lines) {
      let trimmed = line.trim();
      
      // Convert bold: **text** -> <strong>text</strong>
      trimmed = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      
      if (trimmed.startsWith('###')) {
        if (inList) { result.push('</ul>'); inList = false; }
        const content = trimmed.substring(3).trim();
        result.push(`<h3 class="chat-heading">${content}</h3>`);
      } else if (trimmed.startsWith('##')) {
        if (inList) { result.push('</ul>'); inList = false; }
        const content = trimmed.substring(2).trim();
        result.push(`<h2 class="chat-heading">${content}</h2>`);
      } else if (trimmed.startsWith('#')) {
        if (inList) { result.push('</ul>'); inList = false; }
        const content = trimmed.substring(1).trim();
        result.push(`<h1 class="chat-heading">${content}</h1>`);
      } else if (trimmed === '---') {
        if (inList) { result.push('</ul>'); inList = false; }
        result.push('<hr class="chat-hr">');
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        if (!inList) {
          result.push('<ul class="chat-list">');
          inList = true;
        }
        const content = trimmed.substring(2).trim();
        result.push(`<li>${content}</li>`);
      } else if (trimmed === '') {
        if (inList) { result.push('</ul>'); inList = false; }
        result.push('<div class="chat-break"></div>');
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        result.push(`<p class="chat-p">${trimmed}</p>`);
      }
    }
    if (inList) {
      result.push('</ul>');
    }

    return result.join('\n');
  }

  function appendBubble(role, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble chat-${role}`;
    if (role === 'ai') {
      div.innerHTML = parseMarkdown(text);
    } else {
      div.textContent = text;
    }
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

    let aiResponseText = '';

    askAI({
      question: q,
      context: buildTarotContext(),
      type: 'tarot',
      history: chatHistory,
      onToken: (token) => {
        aiLoading.classList.add('hidden');
        aiResponseText += token;
        aiBubble.innerHTML = parseMarkdown(aiResponseText);
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
      },
      onDone: (fullAnswer) => {
        aiLoading.classList.add('hidden');
        aiBubble.innerHTML = parseMarkdown(fullAnswer);
        chatHistory.push({ role: 'user', content: q });
        chatHistory.push({ role: 'assistant', content: fullAnswer });
        if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
        aiChatInput.disabled = false;
        btnAskAI.disabled = false;
        aiChatInput.value = '';
      },
      onError: (err) => {
        aiLoading.classList.add('hidden');
        aiBubble.innerHTML = '';
        aiBubble.classList.add('chat-error');

        const text = document.createElement('div');
        text.textContent = '⚠️ ' + err.message;
        aiBubble.appendChild(text);

        if (err.retryable) {
          const retry = document.createElement('button');
          retry.className = 'btn-retry';
          retry.textContent = 'Thử lại';
          retry.onclick = () => {
            aiBubble.remove();
            const userBubbles = aiChatMessages.querySelectorAll('.chat-bubble.chat-user');
            if (userBubbles.length) userBubbles[userBubbles.length - 1].remove();
            sendMessage(q);
          };
          aiBubble.appendChild(retry);
        }

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

    if (window.History) {
      window.History.save('tarot', {
        question: q,
        cards: drawnCards.map(({ card, reversed }) => ({
          name: card.vn || card.name,
          reversed: !!reversed,
        })),
      });
    }

    sendMessage(q);
  }

  // ---- History modal ----
  const btnHistory = document.getElementById('btn-history');
  if (btnHistory && window.History) {
    btnHistory.addEventListener('click', () => {
      window.History.openModal({
        type: 'tarot',
        title: '📜 Lịch sử trải bài',
        formatItem: (item) => {
          const wrap = document.createElement('div');
          const cards = document.createElement('div');
          cards.className = 'history-item-head';
          cards.innerHTML = (item.cards || [])
            .map(c => `<span class="history-card">${c.reversed ? '↓ ' : ''}${c.name}</span>`)
            .join('');
          const q = document.createElement('p');
          q.className = 'history-question';
          q.textContent = `"${item.question}"`;
          wrap.appendChild(cards);
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
  function goNewReading() {
    resetShuffle();
    chatHistory = [];
    btnRestart.classList.add('hidden');
    aiSection.classList.add('hidden');
    aiChatMessages.innerHTML = '';
    showScreen('spread');
  }

  // ---- Suggested question tags click handler ----
  document.querySelectorAll('.sq-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      tarotQuestion.value = tag.dataset.q;
      tarotQuestion.focus();
    });
  });

  btnNewReading.addEventListener('click', goNewReading);
  btnRestart.addEventListener('click', goNewReading);
});
