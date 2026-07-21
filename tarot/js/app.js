/**
 * tarot/js/app.js — Tarot module logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let selectedSpread = null;
  let drawnCards = [];

  // Bộ bài đầy đủ 78 lá: 22 Ẩn Chính (cards.js) + 56 Ẩn Phụ (cards-minor.js).
  // Chuẩn hóa lá Ẩn Phụ về cùng shape lá Ẩn Chính (thêm img/number/symbol/element)
  // để renderReading/showDetail/share/history dùng chung không phải rẽ nhánh.
  const FULL_DECK = (() => {
    const majors = TAROT_CARDS.map((c) => ({ ...c, img: String(c.id) }));
    if (typeof MINOR_ARCANA === 'undefined' || typeof SUITS === 'undefined') return majors;
    const RANK = { 1: 'Át', 11: 'Tiểu Đồng', 12: 'Hiệp Sĩ', 13: 'Hoàng Hậu', 14: 'Vua' };
    const minors = MINOR_ARCANA.map((c) => {
      const s = SUITS[c.suit] || {};
      const rank = parseInt(String(c.img).replace(/\D/g, ''), 10);
      const emoji = (s.element || '').trim().split(/\s+/)[0] || '🎴';
      return {
        ...c,
        id: c.img,          // giữ id duy nhất cho khóa
        img: c.img,         // đường dẫn ảnh images/<img>.webp
        number: RANK[rank] || String(rank),
        symbol: emoji,
        element: s.element || '',
      };
    });
    return majors.concat(minors);
  })();
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
  let currentMemory = '';

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
      // Câu hỏi không còn bắt buộc — rút nhanh được ngay. Nếu không nhập,
      // AI luận theo chính lá bài (câu hỏi mặc định theo kiểu trải, xem showAISection).
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
    const pool = [...FULL_DECK];
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
    window.scrollTo({ top: 0 });
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
    document.getElementById('t-share-actions').classList.add('hidden');

    drawnCards.forEach(({ card, reversed, revealed }, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'drawn-card';
      wrapper.dataset.index = index;
      // chia bài: mỗi lá bay vào theo thứ tự, nghiêng ngẫu nhiên
      wrapper.style.setProperty('--di', index);
      wrapper.style.setProperty('--dr', ((Math.random() * 16) - 8).toFixed(1) + 'deg');

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
            <img class="dc-card-img" src="images/${card.img}.webp" alt="${card.vn}" width="900" height="1510" decoding="async" loading="lazy">
            <span class="dc-vn-name">${card.vn}</span>
          </div>
        </div>
        <span class="dc-position-label">${spread.positions[index]}</span>
      `;

      wrapper.addEventListener('click', () => handleCardClick(index));
      cardsLayout.appendChild(wrapper);
    });

    // chạy animation chia bài rồi gỡ class để hover hoạt động lại
    cardsLayout.classList.add('dealing');
    setTimeout(() => cardsLayout.classList.remove('dealing'),
      drawnCards.length * 180 + 850);
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
          document.getElementById('t-share-actions').classList.remove('hidden');
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
  }

  // ---- AI Chat ----
  function buildTarotContext() {
    const spread = TAROT_SPREADS[selectedSpread];
    return drawnCards.map(({ card, reversed }, i) => {
      const dir = reversed ? 'Ngược' : 'Xuôi';
      return `• Vị trí "${spread.positions[i]}": ${card.vn} (${card.name}) — ${dir}\n  Ý nghĩa: ${reversed ? card.reversed : card.upright}`;
    }).join('\n\n');
  }

  const chat = Chat.createChat({ messagesEl: aiChatMessages, loadingEl: aiLoading, inputEl: aiChatInput, btnEl: btnAskAI });

  function sendMessage(question) {
    const q = question.trim();
    if (!q) return;

    aiError.classList.add('hidden');
    chat.sendWithUI({
      question: q,
      context: buildTarotContext(),
      type: 'tarot',
      history: chatHistory,
      memory: chatHistory.length === 0 ? currentMemory : '',
      onDone(answer) {
        chatHistory.push({ role: 'user', content: q });
        chatHistory.push({ role: 'assistant', content: answer });
        if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
        aiChatInput.value = '';
      },
    });
  }

  // ---- Chips hỏi nhanh: 3 câu chung + chip riêng từng lá đã rút ----
  const chipsEl = document.getElementById('t-chips');

  function buildChips() {
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    const spread = TAROT_SPREADS[selectedSpread];
    const defs = [
      { icon: 'ti-scale',          label: 'Nên hay không nên?', q: 'Dựa trên trải bài này, tôi nên hay không nên làm điều tôi đang hỏi? Vì sao?' },
      { icon: 'ti-bulb',           label: 'Tôi cần làm gì?',    q: 'Dựa trên các lá bài đã rút, tôi cần hành động cụ thể như thế nào?' },
      { icon: 'ti-alert-triangle', label: 'Cần lưu ý điều gì?', q: 'Trải bài này cảnh báo tôi cần lưu ý hoặc tránh điều gì?' },
    ];
    drawnCards.forEach(({ card, reversed }, i) => {
      defs.push({
        isCard: true, reversed,
        label: `${card.vn}${reversed ? ' ↓' : ''}`,
        q: `Lá ${card.vn} (${card.name}) ${reversed ? 'ngược' : 'xuôi'} ở vị trí "${spread.positions[i]}" nói lên điều gì về câu hỏi của tôi?`
      });
    });
    defs.forEach(d => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 't-chip' + (d.isCard ? ' t-chip-card' + (d.reversed ? ' is-reversed' : '') : '');
      b.innerHTML = d.icon ? `<i class="ti ${d.icon}"></i> ${d.label}` : d.label;
      b.addEventListener('click', () => sendMessage(d.q));
      chipsEl.appendChild(b);
    });
  }

  // Câu hỏi mặc định khi user rút nhanh mà không nhập gì — để AI vẫn có
  // trọng tâm luận giải theo kiểu trải bài.
  const DEFAULT_Q = {
    one:   'Thông điệp lá bài này muốn nhắn nhủ tôi lúc này là gì?',
    three: 'Trải bài Quá khứ – Hiện tại – Tương lai này đang nói lên điều gì về tôi?',
    five:  'Trải bài này đang phản ánh điều gì về tình huống hiện tại của tôi?',
  };

  function showAISection() {
    const q = tarotQuestion.value.trim() || DEFAULT_Q[selectedSpread] || 'Trải bài này đang nói lên điều gì về tôi?';
    buildChips();
    aiSection.classList.remove('hidden');
    aiQuestionDisp.textContent = `"${q}"`;
    aiChatMessages.innerHTML = '';
    aiError.classList.add('hidden');

    // Ký ức các lần xem TRƯỚC — build trước khi save, không thì lượt này lẫn vào
    currentMemory = (window.History && window.History.buildMemory) ? window.History.buildMemory() : '';

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
    if (chipsEl) chipsEl.innerHTML = '';
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

  // ==================== SHARE CARD (canvas 1080×1350, scaffold dùng chung) ====================
  async function shareReadingCard(wantShare) {
    const SC = window.LatbaiShareCard;
    if (!SC || !drawnCards.length) return;
    const spread = TAROT_SPREADS[selectedSpread];

    const W = 1080, H = 1350;
    const { cv, ctx } = await SC.setup(W, H);
    SC.paintBase(ctx, W, H, '124,58,237');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7887a';
    ctx.font = SC.F(30, 800);
    ctx.fillText('TRẢI BÀI TAROT · LATBAI.VN', W / 2, 118);

    // Câu hỏi (tối đa 2 dòng) hoặc tên spread nếu không nhập câu hỏi
    ctx.fillStyle = '#2b1d3a';
    ctx.font = SC.F(44, 800);
    const q = tarotQuestion.value.trim();
    SC.wrapText(ctx, q ? `“${q}”` : spread.name, W / 2, 210, W - 200, 58, 2);

    // Các lá bài — spread 1/3/5 lá nên kích thước phải co theo số lá
    // (5×270 + gap = 1530 sẽ tràn canvas 1080). Ảnh gốc 900×1510, giữ tỷ lệ.
    // Lá ngược xoay 180° (đúng nghĩa bài ngược, không chỉ ghi chữ).
    const n = drawnCards.length;
    const gap = n > 3 ? 24 : 45;
    const cardW = n === 1 ? 340 : n === 3 ? 270 : Math.floor((W - 180 - (n - 1) * gap) / n);
    const cardH = Math.round(cardW * 1510 / 900);
    const startX = (W - (n * cardW + (n - 1) * gap)) / 2;
    const topY = 400;

    const imgs = await Promise.all(
      drawnCards.map(({ card }) =>
        SC.loadImage(`images/${card.img}.webp`).catch(() => null))
    );

    drawnCards.forEach(({ card, reversed }, i) => {
      const x = startX + i * (cardW + gap);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#7c3aed';
      ctx.font = SC.F(cardW >= 200 ? 26 : 20, 800);
      ctx.fillText(spread.positions[i].toUpperCase(), x + cardW / 2, topY - 24);

      ctx.save();
      SC.roundRect(ctx, x, topY, cardW, cardH, 18);
      ctx.clip();
      const img = imgs[i];
      if (img) {
        if (reversed) {
          ctx.translate(x + cardW / 2, topY + cardH / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
        } else {
          ctx.drawImage(img, x, topY, cardW, cardH);
        }
      } else {
        // Ảnh lỗi → ô tím nhạt + số La Mã, card vẫn dùng được
        ctx.fillStyle = 'rgba(124,58,237,0.12)';
        ctx.fillRect(x, topY, cardW, cardH);
        ctx.fillStyle = '#7c3aed';
        ctx.font = SC.F(64, 900);
        ctx.fillText(card.number, x + cardW / 2, topY + cardH / 2 + 20);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(124,58,237,0.45)';
      ctx.lineWidth = 3;
      SC.roundRect(ctx, x, topY, cardW, cardH, 18);
      ctx.stroke();

      ctx.fillStyle = '#2b1d3a';
      ctx.font = SC.F(cardW >= 200 ? 30 : 22, 800);
      const yAfterName = SC.wrapText(ctx, card.vn, x + cardW / 2, topY + cardH + 46, cardW + 20, cardW >= 200 ? 36 : 28, 2);
      ctx.fillStyle = reversed ? '#d98a0a' : '#a7887a';
      ctx.font = SC.F(cardW >= 200 ? 24 : 19, 700);
      ctx.fillText(reversed ? '(Ngược)' : '(Xuôi)', x + cardW / 2, yAfterName + 8);
    });

    // Keywords lá giữa (Hiện Tại) / lá duy nhất — chốt cảm xúc cho card.
    // Card 1 lá cao hơn → dòng keywords bị đẩy xuống thấp, chỉ vẽ 1 dòng
    // để không chạm footer (y=H-92).
    const focus = drawnCards[Math.floor((n - 1) / 2)].card;
    const kwY = topY + cardH + 190;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b4f85';
    ctx.font = SC.F(30, 600);
    SC.wrapText(ctx, '✦ ' + focus.keywords.join(' · ') + ' ✦', W / 2, kwY, W - 240, 42, kwY > 1100 ? 1 : 2);

    SC.footer(ctx, W, H, 'Rải bài Tarot miễn phí tại  latbai.vn/tarot');

    await SC.shareOrDownload(cv, {
      fileName: `tarot-${Date.now()}.png`,
      title: 'Trải Bài Tarot',
      text: 'Trải bài Tarot của tôi 🔮 — thử ngay tại latbai.vn/tarot',
      wantShare,
    });
  }

  document.getElementById('btn-share-reading').addEventListener('click', () => shareReadingCard(true));
  document.getElementById('btn-download-reading').addEventListener('click', () => shareReadingCard(false));

  // ---- BLOCK 2 Guide Popup Toggle ----
  const btnOpenGuide = document.getElementById('btn-open-guide');
  const btnCloseGuide = document.getElementById('btn-close-guide');
  const guidePopup = document.getElementById('t-guide-popup');

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
