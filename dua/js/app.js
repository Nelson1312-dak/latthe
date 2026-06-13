'use strict';

/* ── Modes ──────────────────────────────────────────────────────── */
const MODES = {
  horse: {
    emoji: '🏇', label: 'Ngựa', verb: 'phi', boostFx: '🚀',
    title: '🏇 Đường Đua Ngựa',
    lines: {
      boost:  n => `🚀 ${n} phi nước đại bứt phá!`,
      stumble:n => `💫 ${n} vấp ngã, mất đà!`,
      lead:   n => `👑 ${n} bứt lên dẫn đầu!`,
      finish: n => `🏁 ${n.toUpperCase()} VỀ ĐÍCH ĐẦU TIÊN! 🎉`,
      start:  '🚦 TIẾNG CÒI VANG LÊN — BẦY NGỰA LAO ĐI!',
    },
  },
  duck: {
    emoji: '🦆', label: 'Vịt', verb: 'bơi', boostFx: '💦',
    title: '🏊 Hồ Bơi Đua Vịt',
    lines: {
      boost:  n => `💦 ${n} rẽ nước tăng tốc vùn vụt!`,
      stumble:n => `🌀 ${n} sặc nước, chững lại!`,
      lead:   n => `👑 ${n} bơi vươn lên dẫn đầu!`,
      finish: n => `🏁 ${n.toUpperCase()} CHẠM THÀNH ĐẦU TIÊN! 🎉`,
      start:  '🌊 CÒI HƠI VANG — ĐÀN VỊT LAO XUỐNG NƯỚC!',
    },
  },
};

const PALETTE = [
  '#f97316', '#38bdf8', '#f472b6', '#4ade80', '#facc15', '#ef4444',
  '#a3e635', '#e879f9', '#fb923c', '#22d3ee', '#c084fc', '#34d399',
];

/* ── State ──────────────────────────────────────────────────────── */
let raceMode  = null;       // 'horse' | 'duck'
let names     = ['', ''];   // editable player names
let racers    = [];
let winnerIdx = -1;
let timer     = null;
let phase     = 'setup';
let raceStart = 0;
let timerRAF  = null;

let tickCount   = 0;
let curLeader   = -1;
let photoShown  = false;
let finishCount = 0;

/* ── DOM refs ───────────────────────────────────────────────────── */
const setupEl     = document.getElementById('setup-phase');
const raceEl      = document.getElementById('race-phase');
const resultEl    = document.getElementById('result-phase');
const modeBtns    = document.querySelectorAll('.mode-btn');
const configEl    = document.getElementById('racer-config');
const nameWrap    = document.getElementById('name-inputs');
const addRacerBtn = document.getElementById('add-racer');
const countLabel  = document.getElementById('racer-count-label');
const startBtn    = document.getElementById('start-btn');
const track       = document.getElementById('track');
const raceTitle   = document.getElementById('race-title');
const countdown   = document.getElementById('countdown');
const resultMain  = document.getElementById('result-main');
const raceAgain   = document.getElementById('race-again-btn');
const shareBtn    = document.getElementById('share-btn');
const raceTimer   = document.getElementById('race-timer');
const commentary  = document.getElementById('commentary');
const photoBanner = document.getElementById('photo-finish');

/* ── Mode select ────────────────────────────────────────────────── */
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    raceMode = btn.dataset.mode;
    modeBtns.forEach(b => b.classList.toggle('chosen', b === btn));
    configEl.classList.remove('hidden');
    renderNameInputs();
  });
});

/* ── Name inputs (unlimited) ────────────────────────────────────── */
function renderNameInputs() {
  const m = MODES[raceMode];
  nameWrap.innerHTML = '';
  names.forEach((nm, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const row = document.createElement('div');
    row.className = 'name-row';
    row.style.setProperty('--rc', color);
    row.innerHTML = `
      <span class="name-emoji">${m.emoji}</span>
      <input type="text" class="name-input" data-idx="${idx}"
             placeholder="Tên ${m.label} ${idx + 1}..." maxlength="14"
             value="${escapeHtml(nm)}" autocomplete="off">
      ${names.length > 2
        ? `<button class="remove-racer" data-idx="${idx}" title="Xóa">✕</button>`
        : ''}`;
    nameWrap.appendChild(row);
  });

  // wire inputs
  nameWrap.querySelectorAll('.name-input').forEach(inp => {
    inp.addEventListener('input', e => {
      names[+e.target.dataset.idx] = e.target.value;
    });
  });
  nameWrap.querySelectorAll('.remove-racer').forEach(b => {
    b.addEventListener('click', () => {
      names.splice(+b.dataset.idx, 1);
      renderNameInputs();
    });
  });

  countLabel.textContent = `${names.length} ${MODES[raceMode].label}`;
}

addRacerBtn.addEventListener('click', () => {
  // capture current values first
  nameWrap.querySelectorAll('.name-input').forEach(inp => {
    names[+inp.dataset.idx] = inp.value;
  });
  names.push('');
  renderNameInputs();
  // no auto-focus — avoids popping the mobile keyboard on every add
});

/* ── Start ──────────────────────────────────────────────────────── */
startBtn.addEventListener('click', () => {
  if (phase !== 'setup' || !raceMode) return;
  // sync names from inputs
  nameWrap.querySelectorAll('.name-input').forEach(inp => {
    names[+inp.dataset.idx] = inp.value;
  });

  const m = MODES[raceMode];
  racers = names.map((nm, idx) => ({
    emoji:   m.emoji,
    color:   PALETTE[idx % PALETTE.length],
    name:    nm.trim() || `${m.label} ${idx + 1}`,
    pos: 0, stumble: 0, done: false, finishT: 0, boost: 0,
  }));
  winnerIdx = Math.floor(Math.random() * racers.length);

  phase = 'countdown';
  tickCount = 0; curLeader = -1; photoShown = false; finishCount = 0;
  commentary.innerHTML = '';

  raceTitle.textContent = m.title;
  track.className = `mode-${raceMode}`;

  hide(setupEl);
  show(raceEl);
  buildTrack();
  raceTimer.textContent = '0.00s';
  pushComment(raceMode === 'duck'
    ? '🎙️ Đàn vịt đã sẵn sàng trên thành hồ...'
    : '🎙️ Bầy ngựa đã vào vạch xuất phát...', '#8888aa');
  doCountdown();
});

/* ── Countdown ──────────────────────────────────────────────────── */
function doCountdown() {
  countdown.style.display = 'flex';
  const steps = [
    { t: '3', c: '#ef4444' },
    { t: '2', c: '#f59e0b' },
    { t: '1', c: '#4ade80' },
    { t: 'GO! 🏁', c: '#38bdf8' },
  ];
  let i = 0;
  const tick = () => {
    const s = steps[i];
    countdown.style.setProperty('--cd-color', s.c);
    countdown.querySelector('.cd-text').textContent = s.t;
    countdown.classList.remove('pop');
    void countdown.offsetWidth;
    countdown.classList.add('pop');
    i++;
    if (i < steps.length) setTimeout(tick, 750);
    else setTimeout(() => {
      countdown.style.display = 'none';
      pushComment(MODES[raceMode].lines.start, '#38bdf8');
      startRace();
    }, 650);
  };
  tick();
}

/* ── Build track ────────────────────────────────────────────────── */
function buildTrack() {
  track.innerHTML = '';

  // shared finish post spanning every lane
  const post = document.createElement('div');
  post.className = 'finish-post';
  post.innerHTML = '<span class="finish-flag">🏁</span>';
  track.appendChild(post);

  racers.forEach((r, i) => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.setProperty('--lc', r.color);
    lane.innerHTML = `
      <div class="racer" id="racer-${i}">
        <span class="name-pill">
          <b class="rank" id="rank-${i}">–</b>
          <span class="pill-name">${escapeHtml(r.name)}</span>
        </span>
        <span class="racer-trail"></span>
        <span class="racer-fx" id="fx-${i}"></span>
        <span class="racer-emoji">${r.emoji}</span>
      </div>`;
    track.appendChild(lane);
  });
}

/* ── Position + ranking ─────────────────────────────────────────── */
function updatePositions() {
  racers.forEach((r, i) => {
    const racer = document.getElementById(`racer-${i}`);
    if (!racer) return;
    racer.style.left = `calc(${r.pos / 100} * (100% - 66px))`;
    racer.classList.remove('running', 'stumbling', 'done', 'boosting');
    if (r.done)         racer.classList.add('done');
    else if (r.stumble) racer.classList.add('stumbling');
    else { racer.classList.add('running'); if (r.boost > 0) racer.classList.add('boosting'); }
  });

  liveOrder().forEach((o, rank) => {
    const badge = document.getElementById(`rank-${o.i}`);
    if (!badge) return;
    badge.textContent = String(rank + 1);
    badge.classList.toggle('rank-1', rank === 0);
    badge.classList.toggle('rank-2', rank === 1);
    badge.classList.toggle('rank-3', rank === 2);
  });
}

function liveOrder() {
  return racers
    .map((r, i) => ({ i, pos: r.pos, done: r.done, finishT: r.finishT }))
    .sort((a, b) => {
      if (a.done && b.done) return a.finishT - b.finishT;
      if (a.done) return -1;
      if (b.done) return 1;
      return b.pos - a.pos;
    });
}

/* ── Timer ──────────────────────────────────────────────────────── */
function runTimer() {
  const update = () => {
    if (phase !== 'race') return;
    raceTimer.textContent = `${((performance.now() - raceStart) / 1000).toFixed(2)}s`;
    timerRAF = requestAnimationFrame(update);
  };
  timerRAF = requestAnimationFrame(update);
}

/* ── Engine ─────────────────────────────────────────────────────── */
function startRace() {
  phase = 'race';
  raceStart = performance.now();
  runTimer();
  timer = setInterval(tick, 60);
}

function tick() {
  tickCount++;
  const L = MODES[raceMode].lines;
  let raceOver = false;

  racers.forEach((r, i) => {
    if (r.boost > 0) r.boost--;
    if (r.done) return;
    if (r.stumble > 0) { r.stumble--; return; }

    const isWinner = (i === winnerIdx);
    let speed = 1.2 + Math.random() * 1.8;

    const roll = Math.random();
    if (roll < 0.035) {
      speed = 5 + Math.random() * 4;
      r.boost = 5;
      popFx(i, MODES[raceMode].boostFx, 'fx-boost');
      maybeComment(L.boost(r.name), r.color, 0.5);
    } else if (roll < 0.06) {
      r.stumble = 3 + Math.floor(Math.random() * 4);
      popFx(i, raceMode === 'duck' ? '🌀' : '💫', 'fx-stumble');
      maybeComment(L.stumble(r.name), r.color, 0.45);
      return;
    }

    if (isWinner) speed *= 1.12;
    const cap = isWinner ? 100 : (88 + Math.floor(Math.random() * 6));
    r.pos = Math.min(cap, r.pos + speed);

    if (r.pos >= 100) {
      r.pos = 100; r.done = true;
      r.finishT = performance.now() - raceStart;
      finishCount++;
      if (finishCount === 1) {
        popFx(i, '🏆', 'fx-win');
        pushComment(L.finish(r.name), r.color);
        shake();
      }
      raceOver = true;
    }
  });

  detectDrama();
  updatePositions();

  if (raceOver) {
    clearInterval(timer);
    cancelAnimationFrame(timerRAF);
    raceTimer.textContent = `${((performance.now() - raceStart) / 1000).toFixed(2)}s`;
    racers.forEach(r => { if (!r.done) { r.done = true; r.finishT = 99999 - r.pos; } });
    setTimeout(() => { updatePositions(); setTimeout(showResult, 600); }, 280);
  }
}

/* ── Drama ──────────────────────────────────────────────────────── */
function detectDrama() {
  const order = liveOrder();
  if (!order.length) return;
  const L = MODES[raceMode].lines;

  const newLeader = order[0].i;
  if (finishCount === 0 && curLeader !== -1 && newLeader !== curLeader && order[0].pos > 12) {
    const r = racers[newLeader];
    maybeComment(L.lead(r.name), r.color, 0.85);
    flashLead(newLeader);
  }
  curLeader = newLeader;

  if (!photoShown && finishCount === 0 && order.length >= 2) {
    const a = order[0], b = order[1];
    if (!a.done && a.pos >= 80 && Math.abs(a.pos - b.pos) <= 6) {
      photoShown = true;
      track.classList.add('photo');
      photoBanner.classList.add('show');
      pushComment(`📸 SÁT NÚT! ${racers[a.i].name} vs ${racers[b.i].name}!`, '#facc15');
      setTimeout(() => {
        track.classList.remove('photo');
        photoBanner.classList.remove('show');
      }, 1600);
    }
  }
}

/* ── FX helpers ─────────────────────────────────────────────────── */
function popFx(i, text, cls) {
  const fx = document.getElementById(`fx-${i}`);
  if (!fx) return;
  fx.textContent = text;
  fx.className = `racer-fx ${cls}`;
  void fx.offsetWidth;
  fx.classList.add('pop');
  setTimeout(() => { fx.classList.remove('pop'); fx.textContent = ''; }, 700);
}
function flashLead(i) {
  const badge = document.getElementById(`rank-${i}`);
  if (!badge) return;
  badge.classList.remove('flash');
  void badge.offsetWidth;
  badge.classList.add('flash');
}
let shakeT = null;
function shake() {
  raceEl.classList.add('shake');
  clearTimeout(shakeT);
  shakeT = setTimeout(() => raceEl.classList.remove('shake'), 280);
}

/* ── Commentary ─────────────────────────────────────────────────── */
function pushComment(text, color) {
  const line = document.createElement('div');
  line.className = 'comment-line';
  line.style.setProperty('--cc', color || '#e8e8f0');
  line.textContent = text;
  commentary.prepend(line);
  while (commentary.children.length > 3) commentary.removeChild(commentary.lastChild);
  [...commentary.children].forEach((el, idx) => {
    el.style.opacity = idx === 0 ? '1' : idx === 1 ? '0.55' : '0.3';
  });
}
function maybeComment(text, color, prob) {
  if (Math.random() < prob) pushComment(text, color);
}

/* ── Result ─────────────────────────────────────────────────────── */
function showResult() {
  phase = 'result';
  const winner = racers[winnerIdx];
  const sorted = [...racers].sort((a, b) => {
    if (a === winner) return -1;
    if (b === winner) return 1;
    return b.pos - a.pos;
  });
  const medals = ['🥇', '🥈', '🥉'];
  resultMain.innerHTML = `
    <div class="winner-box" style="--wc:${winner.color}">
      <div class="winner-rays"></div>
      <div class="winner-emoji">${winner.emoji}</div>
      <div class="winner-crown">👑</div>
      <div class="winner-name">${escapeHtml(winner.name)}</div>
      <div class="winner-sub">🏆 VÔ ĐỊCH · Về đích đầu tiên!</div>
    </div>
    <div class="podium-list">
      ${sorted.map((r, i) => `
        <div class="podium-row ${r === winner ? 'p-winner' : ''}" style="--pc:${r.color}">
          <span class="p-medal">${medals[i] ?? `#${i + 1}`}</span>
          <span class="p-emoji">${r.emoji}</span>
          <span class="p-name">${escapeHtml(r.name)}</span>
        </div>`).join('')}
    </div>`;
  hide(raceEl); show(resultEl);
  launchConfetti(winner.color);
  shareBtn.onclick = () => doShare(winner, sorted);
}

/* ── Confetti ───────────────────────────────────────────────────── */
function launchConfetti(color) {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const COLORS = [color, '#fff', '#facc15', '#f472b6', '#38bdf8', '#4ade80'];
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * 140,
    vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 4,
    w: 7 + Math.random() * 9, h: 3 + Math.random() * 5,
    rot: Math.random() * 360, rv: (Math.random() - 0.5) * 11,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  let frame = 0;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rv;
    });
    if (++frame < 160) requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  })();
}

/* ── Share ──────────────────────────────────────────────────────── */
async function doShare(winner, sorted) {
  const lines = sorted.map((r, i) =>
    `${['🥇','🥈','🥉'][i] ?? `#${i + 1}`} ${r.emoji} ${r.name}`).join('\n');
  const text = `🏆 Kết quả ${raceMode === 'duck' ? 'Đua Vịt' : 'Đua Ngựa'}!\n${lines}\n\nĐua thử tại latbai.vn/dua`;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = '✓ Đã copy!';
      setTimeout(() => shareBtn.textContent = '📤 Chia sẻ kết quả', 2000);
    }
  } catch { /**/ }
}

/* ── Race again ─────────────────────────────────────────────────── */
raceAgain.addEventListener('click', () => {
  clearInterval(timer);
  cancelAnimationFrame(timerRAF);
  phase = 'setup'; racers = []; winnerIdx = -1;
  track.innerHTML = ''; resultMain.innerHTML = ''; commentary.innerHTML = '';
  track.classList.remove('photo');
  photoBanner.classList.remove('show');
  hide(resultEl); hide(raceEl); show(setupEl);
  // keep mode + names so user can re-race the same crew quickly
  if (raceMode) renderNameInputs();
});

/* ── Utils ──────────────────────────────────────────────────────── */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
