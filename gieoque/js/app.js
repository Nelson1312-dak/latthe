/**
 * gieoque/js/app.js — I Ching module logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let lines = [];      // array of 6 values (6,7,8,9) bottom→top
  let throwStep = 0;

  const screens = {
    intro:  document.getElementById('screen-intro'),
    throw:  document.getElementById('screen-throw'),
    result: document.getElementById('screen-result'),
  };

  const btnStartThrow  = document.getElementById('btn-start-throw');
  const btnThrow       = document.getElementById('btn-throw');
  const btnNewCast     = document.getElementById('btn-new-cast');
  const btnRestart     = document.getElementById('btn-restart');
  const throwLineNum   = document.getElementById('throw-line-num');
  const throwBtnNum    = document.getElementById('throw-btn-num');
  const coinSlots      = [
    document.getElementById('coin-0'),
    document.getElementById('coin-1'),
    document.getElementById('coin-2'),
  ];
  const lineResultEl   = document.getElementById('line-result');
  const lineSymbolEl   = document.getElementById('line-result-symbol');
  const lineTextEl     = document.getElementById('line-result-text');
  const hexPreview     = document.getElementById('hexagram-preview');

  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
  }

  // ---- Line type helpers ----
  const LINE_INFO = {
    6: { label: 'Lão Âm ⁻ ⁻ (hào động)', symbol: '⁻ ⁻', yang: false, moving: true,  cssClass: 'old-yin' },
    7: { label: 'Thiếu Dương ——',          symbol: '——',  yang: true,  moving: false, cssClass: 'yang' },
    8: { label: 'Thiếu Âm ⁻ ⁻',           symbol: '⁻ ⁻', yang: false, moving: false, cssClass: 'yin' },
    9: { label: 'Lão Dương —— (hào động)', symbol: '——',  yang: true,  moving: true,  cssClass: 'old-yang' },
  };

  function animateCoins(values) {
    coinSlots.forEach((slot, i) => {
      slot.className = 'coin-slot';
      slot.textContent = '';
      // small random spin delay
      setTimeout(() => {
        const isYang = values[i] === 3;
        slot.classList.add(isYang ? 'yang' : 'yin');
        slot.textContent = isYang ? '●' : '○';
      }, 80 + i * 80);
    });
  }

  function addPreviewLine(lineValue) {
    const info = LINE_INFO[lineValue];
    const row = document.createElement('div');
    row.className = 'preview-line';

    if (info.yang) {
      const seg = document.createElement('div');
      seg.className = 'preview-line-seg yang-seg ' + info.cssClass;
      row.appendChild(seg);
    } else {
      const seg1 = document.createElement('div');
      seg1.className = 'preview-line-seg yin-seg ' + info.cssClass;
      const gap = document.createElement('div');
      gap.style.width = '12px';
      const seg2 = document.createElement('div');
      seg2.className = 'preview-line-seg yin-seg ' + info.cssClass;
      row.appendChild(seg1);
      row.appendChild(gap);
      row.appendChild(seg2);
    }
    hexPreview.appendChild(row);
  }

  function renderHexLines(containerId, linesArr) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    linesArr.forEach((val, i) => {
      const info = LINE_INFO[val] || LINE_INFO[7];
      const row = document.createElement('div');
      let rowClass = 'result-line';
      if (val === 9) rowClass += ' moving';
      if (val === 6) rowClass += ' moving moving-yin';
      row.className = rowClass;

      if (info.yang) {
        const seg = document.createElement('div');
        seg.className = 'result-line-seg r-yang';
        row.appendChild(seg);
      } else {
        ['r-yin','r-yin'].forEach(() => {
          const seg = document.createElement('div');
          seg.className = 'result-line-seg r-yin';
          row.appendChild(seg);
        });
      }
      container.appendChild(row);
    });
  }

  // ---- Start ----
  btnStartThrow.addEventListener('click', () => {
    lines = [];
    throwStep = 0;
    hexPreview.innerHTML = '';
    lineResultEl.classList.add('hidden');
    coinSlots.forEach(s => { s.className = 'coin-slot'; s.textContent = ''; });
    throwLineNum.textContent = '1';
    throwBtnNum.textContent = '1';
    showScreen('throw');
    btnRestart.classList.remove('hidden');
  });

  btnThrow.addEventListener('click', () => {
    if (throwStep >= 6) return;

    // Generate 3 coin tosses
    const coinValues = [
      Math.random() < 0.5 ? 3 : 2,
      Math.random() < 0.5 ? 3 : 2,
      Math.random() < 0.5 ? 3 : 2,
    ];
    const sum = coinValues.reduce((a, b) => a + b, 0); // 6, 7, 8, or 9
    const info = LINE_INFO[sum];

    animateCoins(coinValues);

    setTimeout(() => {
      // Show result
      lineSymbolEl.textContent = sum === 9 ? '🔴' : sum === 6 ? '🔵' : sum === 7 ? '⬜' : '⬜';
      lineTextEl.textContent = info.label + (info.moving ? ' ✦' : '');
      lineResultEl.classList.remove('hidden');

      lines.push(sum);
      addPreviewLine(sum);
      throwStep++;

      if (throwStep < 6) {
        throwLineNum.textContent = throwStep + 1;
        throwBtnNum.textContent = throwStep + 1;
      } else {
        // All 6 lines done — show result
        setTimeout(showResult, 700);
      }
    }, 350);
  });

  function showResult() {
    const primary = getHexagramFromLines(lines);
    const hasMoving = hasMovingLines(lines);
    const changed = hasMoving ? getChangedHexagram(lines) : null;

    // Primary hexagram
    document.getElementById('hex-primary-symbol').textContent = primary.symbol || '䷀';
    document.getElementById('hex-primary-name').textContent = `${primary.vn} (${primary.name})`;
    document.getElementById('hex-primary-meaning').textContent = primary.meaning;
    document.getElementById('hex-primary-advice').textContent = primary.advice;
    renderHexLines('hex-primary-lines', lines);

    // Changed hexagram
    const changedSection = document.getElementById('hex-changed-section');
    if (hasMoving && changed) {
      document.getElementById('hex-changed-symbol').textContent = changed.symbol || '䷀';
      document.getElementById('hex-changed-name').textContent = `${changed.vn} (${changed.name})`;
      document.getElementById('hex-changed-meaning').textContent = changed.meaning;
      document.getElementById('hex-changed-advice').textContent = changed.advice;
      // Changed lines: swap old yin↔yang
      const changedLines = lines.map(v => v === 6 ? 7 : v === 9 ? 8 : v);
      renderHexLines('hex-changed-lines', changedLines);
      changedSection.classList.remove('hidden');
    } else {
      changedSection.classList.add('hidden');
    }

    showScreen('result');
  }

  function resetAll() {
    lines = [];
    throwStep = 0;
    btnRestart.classList.add('hidden');
    showScreen('intro');
  }

  btnNewCast.addEventListener('click', resetAll);
  btnRestart.addEventListener('click', resetAll);
});
