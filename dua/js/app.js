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
let selected  = [];   // roster indices user picked
let racers    = [];   // active racers this race
let winnerIdx = -1;
let timer     = null;
let phase     = 'setup';

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

/* ── Build selection grid — only selected animals race ─────────── */
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
    pos:     0,   // 0–100
    stumble: 0,
    done:    false,
  }));
  winnerIdx = Math.floor(Math.random() * racers.length);

  hide(setupEl);
  show(raceEl);
  buildTrack();
  doCountdown();
});

/* ── Countdown ──────────────────────────────────────────────────── */
function doCountdown() {
  countdown.style.display = 'flex';
  const steps = ['3', '2', '1', '🏁 Xuất phát!'];
  let i = 0;
  const tick = () => {
    countdown.textContent = steps[i];
    countdown.classList.remove('pop');
    void countdown.offsetWidth; // reflow to restart animation
    countdown.classList.add('pop');
    i++;
    if (i < steps.length) setTimeout(tick, 800);
    else setTimeout(() => { countdown.style.display = 'none'; startRace(); }, 700);
  };
  tick();
}

/* ── Build track — one lane per selected animal ─────────────────── */
function buildTrack() {
  track.innerHTML = '';
  racers.forEach((r, i) => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.setProperty('--lc', r.color);

    // Label row
    const meta = document.createElement('div');
    meta.className = 'lane-meta';
    meta.innerHTML = `<span class="lane-name">${r.name}</span>`;

    // Road
    const road = document.createElement('div');
    road.className = 'road';
    road.id = `road-${i}`;

    // Finish flag (static, right side)
    const flag = document.createElement('div');
    flag.className = 'finish-flag';
    flag.textContent = '🏁';

    // Racer element
    const racer = document.createElement('div');
    racer.className = 'racer';
    racer.id = `racer-${i}`;
    racer.innerHTML = `<span class="racer-emoji">${r.emoji}</span>`;

    road.appendChild(flag);
    road.appendChild(racer);
    lane.appendChild(meta);
    lane.appendChild(road);
    track.appendChild(lane);
  });
}

/* ── Update positions — key fix: correct CSS calc ───────────────── */
function updatePositions() {
  racers.forEach((r, i) => {
    const racer = document.getElementById(`racer-${i}`);
    if (!racer) return;

    // pos 0–100 mapped to 0 → (100% - 48px) so emoji stays in bounds
    racer.style.left = `calc(${r.pos / 100} * (100% - 48px))`;

    // Animation state
    racer.className = 'racer';
    if (r.done)         racer.classList.add('done');
    else if (r.stumble) racer.classList.add('stumbling');
    else                racer.classList.add('running');
  });
}

/* ── Race tick ──────────────────────────────────────────────────── */
function startRace() {
  phase = 'race';
  timer = setInterval(tick, 60);
}

function tick() {
  let raceOver = false;

  racers.forEach((r, i) => {
    if (r.done) return;
    if (r.stumble > 0) { r.stumble--; return; }

    const isWinner = (i === winnerIdx);
    let speed = 1.2 + Math.random() * 1.8; // 1.2–3.0% per tick

    // Random events
    const roll = Math.random();
    if      (roll < 0.04) speed = 5 + Math.random() * 5; // burst!
    else if (roll < 0.07) { r.stumble = 3 + Math.floor(Math.random() * 5); return; }

    // Winner bonus; non-winners capped at 88–93%
    if (isWinner) speed *= 1.12;
    const cap = isWinner ? 100 : (88 + Math.floor(Math.random() * 6));
    r.pos = Math.min(cap, r.pos + speed);

    if (r.pos >= 100) { r.pos = 100; r.done = true; raceOver = true; }
  });

  updatePositions();

  if (raceOver) {
    clearInterval(timer);
    racers.forEach(r => { r.done = true; });
    setTimeout(() => { updatePositions(); setTimeout(showResult, 500); }, 200);
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
      <div class="winner-emoji">${winner.emoji}</div>
      <div class="winner-crown">👑</div>
      <div class="winner-name">${winner.name}</div>
      <div class="winner-sub">Về đích đầu tiên!</div>
    </div>
    <div class="podium-list">
      ${sorted.map((r, i) => `
        <div class="podium-row ${r === winner ? 'p-winner' : ''}">
          <span class="p-medal">${medals[i] ?? '🔸'}</span>
          <span class="p-emoji">${r.emoji}</span>
          <span class="p-name">${r.name}</span>
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
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 120,
    vx: (Math.random() - 0.5) * 5,
    vy: 3 + Math.random() * 4,
    w: 7 + Math.random() * 8,
    h: 3 + Math.random() * 4,
    rot: Math.random() * 360,
    rv: (Math.random() - 0.5) * 10,
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
    if (++frame < 130) requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  })();
}

/* ── Share ──────────────────────────────────────────────────────── */
async function doShare(winner, sorted) {
  const lines = sorted.map((r, i) =>
    `${['🥇','🥈','🥉'][i] ?? '🔸'} ${r.emoji} ${r.name}`).join('\n');
  const text = `🏆 Kết quả Đua Thú!\n${lines}\n\nlatbai.vn/dua`;
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
