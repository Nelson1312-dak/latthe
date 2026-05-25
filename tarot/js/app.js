/**
 * tarot/js/app.js — Tarot module logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let selectedSpread = null;
  let drawnCards = [];
  let shuffleCount = 0;
  let activeDetailIndex = 0;
  const REQUIRED_SHUFFLES = 3;

  // ---- Element refs ----
  const screens = {
    spread:   document.getElementById('screen-spread'),
    shuffle:  document.getElementById('screen-shuffle'),
    reading:  document.getElementById('screen-reading'),
  };
  const spreadBtns    = document.querySelectorAll('.spread-btn');
  const deckVisual    = document.getElementById('deck-visual');
  const shuffleDots   = document.querySelectorAll('.sdot');
  const shuffleText   = document.getElementById('shuffle-count-text');
  const btnDraw       = document.getElementById('btn-draw');
  const spreadLabel   = document.getElementById('spread-label');
  const cardsLayout   = document.getElementById('cards-layout');
  const readingDetail = document.getElementById('reading-detail');
  const btnNewReading = document.getElementById('btn-new-reading');
  const btnRestart    = document.getElementById('btn-restart');

  // ---- Screen navigation ----
  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
  }

  // ---- Spread selection ----
  spreadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSpread = btn.dataset.spread;
      shuffleCount = 0;
      drawnCards = [];
      updateShuffleUI();
      showScreen('shuffle');
    });
  });

  // ---- Shuffle ----
  function updateShuffleUI() {
    shuffleDots.forEach((dot, i) => {
      dot.classList.toggle('done', i < shuffleCount);
    });
    shuffleText.textContent = `Xáo ${shuffleCount}/${REQUIRED_SHUFFLES} lần`;
    if (shuffleCount >= REQUIRED_SHUFFLES) {
      btnDraw.classList.remove('hidden');
    }
  }

  deckVisual.addEventListener('click', () => {
    if (shuffleCount >= REQUIRED_SHUFFLES) return;
    shuffleCount++;

    // Animate cards
    const cards = deckVisual.querySelectorAll('.deck-card');
    cards.forEach((c, i) => {
      c.style.transition = 'transform 0.25s ease';
      const angle = (Math.random() - 0.5) * 40;
      const tx = (Math.random() - 0.5) * 60;
      c.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateX(${tx}px)`;
    });
    setTimeout(() => {
      cards.forEach((c, i) => {
        c.style.transition = 'transform 0.4s cubic-bezier(.34,1.56,.64,1)';
        const base = i === 0 ? -3 : i === 1 ? 0 : 3;
        const ty = i === 0 ? 0 : i === 1 ? -4 : -8;
        c.style.transform = `translate(-50%, -50%) rotate(${base}deg) translateY(${ty}px)`;
      });
      updateShuffleUI();
    }, 300);
  });

  // ---- Draw cards ----
  btnDraw.addEventListener('click', () => {
    const spread = TAROT_SPREADS[selectedSpread];
    const count = spread.positions.length;

    // Pick unique random cards with random orientation
    const pool = [...TAROT_CARDS].sort(() => Math.random() - 0.5);
    drawnCards = pool.slice(0, count).map(card => ({
      card,
      reversed: Math.random() < 0.35
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
      wrapper.dataset.index = index;

      const face = document.createElement('div');
      face.className = 'dc-face' + (reversed ? ' reversed' : '');
      face.innerHTML = `
        <span class="dc-symbol">${card.symbol}</span>
        <span class="dc-vn-name">${card.vn}</span>
        <span class="dc-reveal-hint">Nhấn xem</span>
      `;
      face.classList.add('revealed');

      const label = document.createElement('span');
      label.className = 'dc-position-label';
      label.textContent = spread.positions[index];

      wrapper.appendChild(face);
      wrapper.appendChild(label);
      wrapper.addEventListener('click', () => showDetail(index));
      cardsLayout.appendChild(wrapper);
    });

    // Auto-show first card detail
    setTimeout(() => showDetail(0), 400);
  }

  function showDetail(index) {
    const { card, reversed } = drawnCards[index];
    activeDetailIndex = index;

    // Highlight active card
    document.querySelectorAll('.drawn-card').forEach((el, i) => {
      el.classList.toggle('active-card', i === index);
    });

    const spread = TAROT_SPREADS[selectedSpread];
    const meaning = reversed ? card.reversed : card.upright;
    const orientation = reversed ? 'Ngược' : 'Xuôi';

    document.getElementById('detail-symbol').textContent = card.symbol;
    document.getElementById('detail-position').textContent = spread.positions[index];
    document.getElementById('detail-name').textContent = `${card.vn} (${card.name})`;
    document.getElementById('detail-number').textContent = `Lá ${card.number} • ${card.element}`;

    const orientEl = document.getElementById('detail-orientation');
    orientEl.textContent = orientation;
    orientEl.className = 'detail-orientation ' + (reversed ? 'reversed' : 'upright');

    const kwContainer = document.getElementById('detail-keywords');
    kwContainer.innerHTML = card.keywords
      .map(k => `<span class="keyword-tag">${k}</span>`)
      .join('');

    document.getElementById('detail-meaning').textContent = meaning;
    document.getElementById('detail-advice').textContent = card.advice;
    document.getElementById('detail-element').textContent = card.element;

    readingDetail.classList.remove('hidden');
    readingDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- AI interpretation ----
  const aiSection      = document.getElementById('ai-section');
  const aiQuestionDisp = document.getElementById('ai-question-display');
  const aiLoading      = document.getElementById('ai-loading');
  const aiText         = document.getElementById('ai-text');
  const aiError        = document.getElementById('ai-error');
  const btnAskAI       = document.getElementById('btn-ask-ai');
  const tarotQuestion  = document.getElementById('tarot-question');

  function buildTarotContext() {
    const spread = TAROT_SPREADS[selectedSpread];
    return drawnCards.map(({ card, reversed }, i) => {
      const pos = spread.positions[i];
      const dir = reversed ? 'Ngược' : 'Xuôi';
      return `• Vị trí "${pos}": ${card.vn} (${card.name}) — ${dir}\n  Ý nghĩa: ${reversed ? card.reversed : card.upright}`;
    }).join('\n\n');
  }

  function showAISection() {
    const q = tarotQuestion.value.trim();
    if (!q) return; // no question, no AI section
    aiSection.classList.remove('hidden');
    aiQuestionDisp.textContent = `"${q}"`;
    aiText.textContent = '';
    aiError.classList.add('hidden');
    aiLoading.style.display = 'none';
    btnAskAI.disabled = false;
  }

  btnAskAI.addEventListener('click', () => {
    const q = tarotQuestion.value.trim();
    if (!q) return;

    btnAskAI.disabled = true;
    aiText.textContent = '';
    aiError.classList.add('hidden');
    aiLoading.style.display = 'flex';

    askAI({
      question: q,
      context: buildTarotContext(),
      type: 'tarot',
      onToken: (token) => {
        aiLoading.style.display = 'none';
        aiText.textContent += token;
      },
      onDone: () => {
        aiLoading.style.display = 'none';
        btnAskAI.textContent = '🔄 Hỏi Lại';
        btnAskAI.disabled = false;
      },
      onError: (msg) => {
        aiLoading.style.display = 'none';
        aiError.textContent = '⚠️ ' + msg;
        aiError.classList.remove('hidden');
        btnAskAI.disabled = false;
      }
    });
  });

  // ---- New reading ----
  function goNewReading() {
    shuffleCount = 0;
    drawnCards = [];
    updateShuffleUI();
    btnDraw.classList.add('hidden');
    btnRestart.classList.add('hidden');
    aiSection.classList.add('hidden');
    aiText.textContent = '';
    btnAskAI.textContent = '✨ Hỏi AI Luận Giải';
    showScreen('spread');
  }

  btnNewReading.addEventListener('click', goNewReading);
  btnRestart.addEventListener('click', goNewReading);
});
