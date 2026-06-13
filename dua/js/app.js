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
let selected = [];   // array of roster indices
let racers   = [];   // [{...roster, name, pos, stumble, done}]
let winnerIdx = -1;
let timer     = null;
let phase     = 'setup'; // setup | countdown | race | result

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

/* ── Setup: render animal grid ──────────────────────────────────── */
ROSTER.forEach((a, i) => {
  const btn = document.createElement('button');
  btn.className = 'animal-pick';
  btn.dataset.idx = i;
  btn.style.setProperty('--ac', a.color);
  btn.innerHTML = `<span class="pick-emoji">${a.emoji}</span><span class="pick-label">${a.label}</span>`;
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
}

function renderNameInputs() {
  nameWrap.innerHTML = '';
  selected.forEach((ri, si) => {
    const a = ROSTER[ri];
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `
      <span class="name-emoji" style="color:${a.color}">${a.emoji}</span>
      <input type="text" class="name-input" data-si="${si}"
             placeholder="Tên ${a.label}..." maxlength="16"
             value="" autocomplete="off">`;
    nameWrap.appendChild(row);
  });
}

/* ── Start flow ─────────────────────────────────────────────────── */
startBtn.addEventListener('click', () => {
  if (selected.length < 2 || phase !== 'setup') return;
  phase = 'countdown';

  // Build racers
  const inputs = nameWrap.querySelectorAll('.name-input');
  racers = selected.map((ri, si) => ({
    ...ROSTER[ri],
    name:    inputs[si]?.value.trim() || ROSTER[ri].label,
    pos:     0,
    stumble: 0,
    done:    false,
  }));

  // Pick winner now (random)
  winnerIdx = Math.floor(Math.random() * racers.length);

  show(raceEl); hide(setupEl);
  renderTrack();
  doCountdown();
});

function doCountdown() {
  countdown.style.display = 'flex';
  const steps = ['3', '2', '1', 'Xuất phát! 🏁'];
  let i = 0;
  const tick = () => {
    countdown.textContent = steps[i];
    countdown.classList.add('pop');
    setTimeout(() => countdown.classList.remove('pop'), 400);
    i++;
    if (i < steps.length) {
      setTimeout(tick, 800);
    } else {
      setTimeout(() => { countdown.style.display = 'none'; startRace(); }, 600);
    }
  };
  tick();
}

/* ── Track render ───────────────────────────────────────────────── */
function renderTrack() {
  track.innerHTML = '';
  racers.forEach((r, i) => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.setProperty('--lc', r.color);

    const label = document.createElement('div');
    label.className = 'lane-label';
    label.textContent = r.name;

    const road = document.createElement('div');
    road.className = 'road';

    const racer = document.createElement('div');
    racer.className = 'racer';
    racer.id = `racer-${i}`;
    racer.innerHTML = `<span class="racer-emoji">${r.emoji}</span>`;

    const finish = document.createElement('div');
    finish.className = 'finish-flag';
    finish.textContent = '🏁';

    road.appendChild(racer);
    road.appendChild(finish);
    lane.appendChild(label);
    lane.appendChild(road);
    track.appendChild(lane);
  });
}

function updateTrack() {
  racers.forEach((r, i) => {
    const el = document.getElementById(`racer-${i}`);
    if (!el) return;
    // pos goes 0-100, mapped to 0% - calc(100% - 40px)
    el.style.left = `calc(${r.pos}% * (100% - 44px) / 100)`;
    if (r.stumble > 0) {
      el.classList.add('stumbling');
    } else {
      el.classList.remove('stumbling');
      if (!r.done) el.classList.add('running');
    }
    if (r.done) {
      el.classList.remove('running', 'stumbling');
      el.classList.add('done');
    }
  });
}

/* ── Race engine ────────────────────────────────────────────────── */
function startRace() {
  phase = 'race';
  timer = setInterval(tick, 80);
}

function tick() {
  let winnerDone = false;

  racers.forEach((r, i) => {
    if (r.done) return;

    // Stumble counter
    if (r.stumble > 0) { r.stumble--; return; }

    const isWinner = i === winnerIdx;
    let speed = 1.4 + Math.random() * 1.6; // 1.4–3.0% base

    // Random events
    const roll = Math.random();
    if (roll < 0.04)       { speed = 5.0 + Math.random() * 4; } // burst!
    else if (roll < 0.08)  { r.stumble = 3 + Math.floor(Math.random() * 4); return; } // stumble

    // Winner advantage
    if (isWinner) speed *= 1.15;

    // Non-winner cap: stop at 88–92% so winner wins clearly
    const cap = isWinner ? 100 : (88 + Math.floor(Math.random() * 5));
    r.pos = Math.min(cap, r.pos + speed);

    if (r.pos >= 100) { r.done = true; winnerDone = true; }
  });

  updateTrack();

  if (winnerDone) {
    clearInterval(timer);
    // Brief delay so animation settles
    setTimeout(() => {
      // Mark all as done
      racers.forEach(r => { r.done = true; });
      updateTrack();
      setTimeout(showResult, 400);
    }, 300);
  }
}

/* ── Result ─────────────────────────────────────────────────────── */
function showResult() {
  phase = 'result';
  const winner = racers[winnerIdx];

  // Sort by pos for podium (winner is always 1st)
  const sorted = [...racers]
    .sort((a, b) => (b === winner ? 1 : a === winner ? -1 : b.pos - a.pos));

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
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 3 + Math.random() * 4,
    size: 6 + Math.random() * 8,
    color: [color, '#fff', '#facc15', '#f472b6', '#38bdf8'][Math.floor(Math.random() * 5)],
    rot: Math.random() * 360,
    rotv: (Math.random() - 0.5) * 8,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.rotv;
    });
    frame++;
    if (frame < 120) requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  }
  requestAnimationFrame(draw);
}

/* ── Share ──────────────────────────────────────────────────────── */
async function doShare(winner, sorted) {
  const lines = sorted.map((r, i) => `${['🥇','🥈','🥉'][i] ?? '🔸'} ${r.name} ${r.emoji}`).join('\n');
  const text  = `🏆 Kết quả đua thú!\n${lines}\n\nĐua thú vui tại latbai.vn/dua`;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = '✓ Đã copy!';
      setTimeout(() => shareBtn.textContent = '📤 Chia sẻ kết quả', 2000);
    }
  } catch { /* cancelled */ }
}

/* ── Race again ─────────────────────────────────────────────────── */
raceAgain.addEventListener('click', () => {
  clearInterval(timer);
  phase    = 'setup';
  selected = [];
  racers   = [];
  winnerIdx = -1;
  track.innerHTML = '';
  resultMain.innerHTML = '';
  nameWrap.innerHTML = '';
  grid.querySelectorAll('.animal-pick').forEach(b => b.classList.remove('chosen'));
  startBtn.disabled = true;
  hide(resultEl); hide(raceEl);
  show(setupEl);
});

/* ── Utils ──────────────────────────────────────────────────────── */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
