'use strict';

/* ── Animal roster ─────────────────────────────────────────────── */
const ROSTER = [
  { id: 'ngua', emoji: '🐴', label: 'Ngựa',  color: '#f97316' },
  { id: 'vit',  emoji: '🦆', label: 'Vịt',   color: '#38bdf8' },
  { id: 'tho',  emoji: '🐇', label: 'Thỏ',   color: '#f472b6' },
  { id: 'rua',  emoji: '🐢', label: 'Rùa',   color: '#4ade80' },
  { id: 'ga',   emoji: '🐓', label: 'Gà',    color: '#facc15' },
  { id: 'cua',  emoji: '🦀', label: 'Cua',   color: '#ef4444' },
  { id: 'ech',  emoji: '🐸', label: 'Ếch',   color: '#a3e635' },
  { id: 'heo',  emoji: '🐷', label: 'Heo',   color: '#e879f9' },
];

/* ── State ──────────────────────────────────────────────────────── */
let selected   = [];
let racers     = [];
let winnerIdx  = -1;
let timer      = null;
let phase      = 'setup';
let raceStart  = 0;
let timerRAF   = null;

/* ── DOM refs ───────────────────────────────────────────────────── */
const setupEl    = document.getElementById('setup-phase');
const raceEl     = document.getElementById('race-phase');
const resultEl   = document.getElementById('result-phase');
const grid       = document.getElementById('animal-grid');
const nameWrap   = document.getElementById('name-inputs');
const startBtn   = document.getElementById('start-btn');
const track      = document.getElementById('track');
const countdown  = document.getElementById('countdown');
const resultMain = document.getElementById('result-main');
const raceAgain  = document.getElementById('race-again-btn');
const shareBtn   = document.getElementById('share-btn');
const raceTimer  = document.getElementById('race-timer');

/* ── Selection grid ─────────────────────────────────────────────── */
ROSTER.forEach((a, i) => {
  const btn = document.createElement('button');
  btn.className = 'animal-pick';
  btn.dataset.idx = i;
  btn.style.setProperty('--ac', a.color);
  btn.innerHTML =
    `<span class="pick-emoji">${a.emoji}</span>` +
    `<span class="pick-label">${a.label}</span>`;
  btn.addEventListener('click', () => toggleAnimal(i, btn));
  grid.appendChild(btn);
});

function toggleAnimal(i, btn) {
  const pos = selected.indexOf(i);
  if (pos >= 0) {
    selected.splice(pos, 1);
    btn.classList.remove('chosen');
  } else {
    if (selected.length >= 6) return;
    selected.push(i);
    btn.classList.add('chosen');
  }
  renderNameInputs();
  startBtn.disabled = selected.length < 2;
  document.getElementById('sel-count').textContent =
    selected.length ? `Đã chọn ${selected.length} con` : 'Chọn ít nhất 2 con';
}

function renderNameInputs() {
  nameWrap.innerHTML = '';
  selected.forEach((ri, si) => {
    const a = ROSTER[ri];
    const row = document.createElement('div');
    row.className = 'name-row';
    row.style.setProperty('--rc', a.color);
    row.innerHTML =
      `<span class="name-emoji">${a.emoji}</span>` +
      `<input type="text" class="name-input" data-si="${si}"` +
      ` placeholder="Tên ${a.label}..." maxlength="12" autocomplete="off">`;
    nameWrap.appendChild(row);
  });
}

/* ── Start ──────────────────────────────────────────────────────── */
startBtn.addEventListener('click', () => {
  if (selected.length < 2 || phase !== 'setup') return;
  phase = 'countdown';

  const inputs = nameWrap.querySelectorAll('.name-input');
  racers = selected.map((ri, si) => ({
    ...ROSTER[ri],
    name:    inputs[si]?.value.trim() || ROSTER[ri].label,
    pos:     0,
    stumble: 0,
    done:    false,
    finishT: 0,
  }));
  winnerIdx = Math.floor(Math.random() * racers.length);

  hide(setupEl);
  show(raceEl);
  buildTrack();
  raceTimer.textContent = '0.00s';
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
    else setTimeout(() => { countdown.style.display = 'none'; startRace(); }, 650);
  };
  tick();
}

/* ── Build track ────────────────────────────────────────────────── */
function buildTrack() {
  track.innerHTML = '';
  racers.forEach((r, i) => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.setProperty('--lc', r.color);

    lane.innerHTML = `
      <div class="rank-badge" id="rank-${i}">–</div>
      <div class="lane-body">
        <div class="lane-meta">
          <span class="lane-name">${escapeHtml(r.name)}</span>
          <span class="lane-pct" id="pct-${i}">0%</span>
        </div>
        <div class="road" id="road-${i}">
          <div class="road-lines"></div>
          <div class="finish-line"></div>
          <div class="finish-flag">🏁</div>
          <div class="racer" id="racer-${i}">
            <span class="racer-trail"></span>
            <span class="racer-emoji">${r.emoji}</span>
          </div>
        </div>
      </div>`;
    track.appendChild(lane);
  });
}

/* ── Position + live ranking update ─────────────────────────────── */
function updatePositions() {
  racers.forEach((r, i) => {
    const racer = document.getElementById(`racer-${i}`);
    const pct   = document.getElementById(`pct-${i}`);
    if (!racer) return;

    racer.style.left = `calc(${r.pos / 100} * (100% - 50px))`;
    if (pct) pct.textContent = `${Math.round(r.pos)}%`;

    racer.className = 'racer';
    if (r.done)         racer.classList.add('done');
    else if (r.stumble) racer.classList.add('stumbling');
    else                racer.classList.add('running');
  });

  // Live ranking
  const order = racers
    .map((r, i) => ({ i, pos: r.pos, done: r.done, finishT: r.finishT }))
    .sort((a, b) => {
      if (a.done && b.done) return a.finishT - b.finishT;
      if (a.done) return -1;
      if (b.done) return 1;
      return b.pos - a.pos;
    });

  order.forEach((o, rank) => {
    const badge = document.getElementById(`rank-${o.i}`);
    if (!badge) return;
    const labels = ['1', '2', '3', '4', '5', '6'];
    badge.textContent = labels[rank];
    badge.classList.toggle('rank-1', rank === 0);
    badge.classList.toggle('rank-2', rank === 1);
    badge.classList.toggle('rank-3', rank === 2);
  });
}

/* ── Timer ──────────────────────────────────────────────────────── */
function runTimer() {
  const update = () => {
    if (phase !== 'race') return;
    const elapsed = (performance.now() - raceStart) / 1000;
    raceTimer.textContent = `${elapsed.toFixed(2)}s`;
    timerRAF = requestAnimationFrame(update);
  };
  timerRAF = requestAnimationFrame(update);
}

/* ── Race engine ────────────────────────────────────────────────── */
function startRace() {
  phase = 'race';
  raceStart = performance.now();
  runTimer();
  timer = setInterval(tick, 60);
}

function tick() {
  let raceOver = false;

  racers.forEach((r, i) => {
    if (r.done) return;
    if (r.stumble > 0) { r.stumble--; return; }

    const isWinner = (i === winnerIdx);
    let speed = 1.2 + Math.random() * 1.8;

    const roll = Math.random();
    if      (roll < 0.04) speed = 5 + Math.random() * 5;
    else if (roll < 0.07) { r.stumble = 3 + Math.floor(Math.random() * 5); return; }

    if (isWinner) speed *= 1.12;
    const cap = isWinner ? 100 : (88 + Math.floor(Math.random() * 6));
    r.pos = Math.min(cap, r.pos + speed);

    if (r.pos >= 100) {
      r.pos = 100;
      r.done = true;
      r.finishT = performance.now() - raceStart;
      raceOver = true;
    }
  });

  updatePositions();

  if (raceOver) {
    clearInterval(timer);
    cancelAnimationFrame(timerRAF);
    const finalT = (performance.now() - raceStart) / 1000;
    raceTimer.textContent = `${finalT.toFixed(2)}s`;
    racers.forEach((r, i) => {
      if (!r.done) { r.done = true; r.finishT = 99999 + r.pos * -1; }
    });
    setTimeout(() => { updatePositions(); setTimeout(showResult, 550); }, 250);
  }
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

  hide(raceEl);
  show(resultEl);
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
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 140,
    vx: (Math.random() - 0.5) * 5,
    vy: 3 + Math.random() * 4,
    w: 7 + Math.random() * 9,
    h: 3 + Math.random() * 5,
    rot: Math.random() * 360,
    rv: (Math.random() - 0.5) * 11,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  let frame = 0;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rv;
    });
    if (++frame < 150) requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  })();
}

/* ── Share ──────────────────────────────────────────────────────── */
async function doShare(winner, sorted) {
  const lines = sorted.map((r, i) =>
    `${['🥇','🥈','🥉'][i] ?? `#${i + 1}`} ${r.emoji} ${r.name}`).join('\n');
  const text = `🏆 Kết quả Đua Thú!\n${lines}\n\nĐua thử tại latbai.vn/dua`;
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
  phase = 'setup'; selected = []; racers = []; winnerIdx = -1;
  track.innerHTML = ''; resultMain.innerHTML = ''; nameWrap.innerHTML = '';
  grid.querySelectorAll('.animal-pick').forEach(b => b.classList.remove('chosen'));
  startBtn.disabled = true;
  document.getElementById('sel-count').textContent = 'Chọn ít nhất 2 con';
  hide(resultEl); hide(raceEl); show(setupEl);
});

/* ── Utils ──────────────────────────────────────────────────────── */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
