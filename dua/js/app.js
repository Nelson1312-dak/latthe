'use strict';

/* ── Modes ──────────────────────────────────────────────────────── */
const MODES = {
  horse: {
    emoji: '🏇', label: 'Ngựa', boostFx: '🚀', slowFx: '💫',
    title: '🏇 Đường đua ngựa',
    lines: {
      boost:  n => `🚀 ${n} phi nước đại bứt phá!`,
      stumble:n => `💫 ${n} chùng chân, mất đà!`,
      lead:   n => `👑 ${n} bứt lên dẫn đầu!`,
      finish: n => `🏁 ${n.toUpperCase()} VỀ ĐÍCH ĐẦU TIÊN! 🎉`,
      start:  '🚦 Tiếng còi vang lên — bầy ngựa lao đi!',
      ready:  '🎙️ Bầy ngựa đã vào vạch xuất phát...',
    },
  },
  duck: {
    emoji: '🦆', label: 'Vịt', boostFx: '💦', slowFx: '🌀',
    title: '🏊 Hồ bơi đua vịt',
    lines: {
      boost:  n => `💦 ${n} rẽ nước tăng tốc vùn vụt!`,
      stumble:n => `🌀 ${n} sặc nước, chững lại!`,
      lead:   n => `👑 ${n} bơi vươn lên dẫn đầu!`,
      finish: n => `🏁 ${n.toUpperCase()} CHẠM THÀNH ĐẦU TIÊN! 🎉`,
      start:  '🌊 Còi hơi vang — đàn vịt lao xuống nước!',
      ready:  '🎙️ Đàn vịt đã sẵn sàng trên thành hồ...',
    },
  },
};

const PALETTE = [
  '#f97316', '#38bdf8', '#f472b6', '#4ade80', '#facc15', '#ef4444',
  '#a3e635', '#e879f9', '#fb923c', '#22d3ee', '#c084fc', '#34d399',
];

const TICK_MS = 60;

/* ── State ──────────────────────────────────────────────────────── */
let raceMode    = null;
let durationSec = 10;
let names       = ['', ''];
let racers      = [];
let winnerIdx   = -1;
let timer       = null;
let phase       = 'setup';
let raceStart   = 0;
let timerRAF    = null;
let totalTicks  = 0;
let curTick     = 0;
let curLeader   = -1;
let photoShown  = false;
let finishCount = 0;

/* ── DOM ────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const setupEl   = $('setup');
const raceEl    = $('race');
const resultEl  = $('result');
const modeCards = document.querySelectorAll('.mode-card');
const configEl  = $('config');
const racersWrap= $('racers');
const addBtn    = $('add-racer');
const playersLbl= $('players-label');
const durBtns   = document.querySelectorAll('#duration button');
const startBtn  = $('start');
const track     = $('track');
const raceTitle = $('race-title');
const timerEl   = $('timer');
const ticker    = $('ticker');
const resultBody= $('result-body');
const againBtn  = $('again');
const shareBtn  = $('share');
const countdown = $('countdown');
const photoEl   = $('photo');

/* ── Mode select ────────────────────────────────────────────────── */
modeCards.forEach(card => {
  card.addEventListener('click', () => {
    raceMode = card.dataset.mode;
    modeCards.forEach(c => c.classList.toggle('on', c === card));
    configEl.classList.remove('hidden');
    renderRacers();
    configEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});

/* ── Duration ───────────────────────────────────────────────────── */
durBtns.forEach(b => {
  b.addEventListener('click', () => {
    durationSec = +b.dataset.sec;
    durBtns.forEach(x => x.classList.toggle('on', x === b));
  });
});

/* ── Racer rows ─────────────────────────────────────────────────── */
function renderRacers() {
  const m = MODES[raceMode];
  racersWrap.innerHTML = '';
  names.forEach((nm, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const row = document.createElement('div');
    row.className = 'racer-row';
    row.style.setProperty('--rc', color);
    row.innerHTML = `
      <span class="r-emoji">${m.emoji}</span>
      <input class="r-input" type="text" data-idx="${idx}" maxlength="14"
             placeholder="Tên ${m.label} ${idx + 1}..." value="${escapeHtml(nm)}" autocomplete="off">
      ${names.length > 2 ? `<button class="r-del" data-idx="${idx}" title="Xóa">✕</button>` : ''}`;
    racersWrap.appendChild(row);
  });
  racersWrap.querySelectorAll('.r-input').forEach(inp => {
    inp.addEventListener('input', e => { names[+e.target.dataset.idx] = e.target.value; });
  });
  racersWrap.querySelectorAll('.r-del').forEach(b => {
    b.addEventListener('click', () => { names.splice(+b.dataset.idx, 1); renderRacers(); });
  });
  playersLbl.textContent = `2 · Người chơi (${names.length})`;
}

addBtn.addEventListener('click', () => {
  syncNames();
  names.push('');
  renderRacers();
});

function syncNames() {
  racersWrap.querySelectorAll('.r-input').forEach(inp => { names[+inp.dataset.idx] = inp.value; });
}

/* ── Plan: per-tick speeds summing to a target finish position ──── */
function buildPlan(ticks, targetEnd) {
  const seg = 7;
  const raw = [];
  let level = 0.6 + Math.random() * 1.4;
  for (let t = 0; t < ticks; t++) {
    if (t % seg === 0) {
      const e = Math.random();
      if (e < 0.12)      level = 3.0 + Math.random() * 1.6;   // surge
      else if (e < 0.20) level = 0.12 + Math.random() * 0.18; // stall
      else               level = 0.6 + Math.random() * 1.4;   // cruise
    }
    raw.push(level);
  }
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map(x => (x / sum) * targetEnd);
}

/* ── Start ──────────────────────────────────────────────────────── */
startBtn.addEventListener('click', () => {
  if (phase !== 'setup' || !raceMode) return;
  syncNames();

  const m = MODES[raceMode];
  winnerIdx  = Math.floor(Math.random() * names.length);
  totalTicks = Math.max(40, Math.round(durationSec * 1000 / TICK_MS));

  racers = names.map((nm, idx) => {
    const targetEnd = (idx === winnerIdx) ? 100 : (70 + Math.random() * 23);
    return {
      emoji: m.emoji, color: PALETTE[idx % PALETTE.length],
      name:  nm.trim() || `${m.label} ${idx + 1}`,
      pos: 0, state: 'run', boost: 0, done: false, ended: false, finishT: 0,
      plan: buildPlan(totalTicks, targetEnd), avg: targetEnd / totalTicks,
    };
  });

  phase = 'countdown';
  curTick = 0; curLeader = -1; photoShown = false; finishCount = 0;
  ticker.innerHTML = '';
  raceTitle.textContent = m.title;
  track.className = `mode-${raceMode}`;

  hide(setupEl); show(raceEl);
  buildTrack();
  timerEl.textContent = '0.00s';
  pushTick(m.lines.ready, '#8b93a7');
  doCountdown();
});

/* ── Countdown ──────────────────────────────────────────────────── */
function doCountdown() {
  countdown.style.display = 'flex';
  const steps = [
    { t: '3', c: '#ef4444' }, { t: '2', c: '#f59e0b' },
    { t: '1', c: '#4ade80' }, { t: 'GO! 🏁', c: '#38bdf8' },
  ];
  let i = 0;
  const step = () => {
    const s = steps[i];
    countdown.style.setProperty('--cd', s.c);
    countdown.querySelector('.cd-text').textContent = s.t;
    countdown.classList.remove('pop'); void countdown.offsetWidth; countdown.classList.add('pop');
    i++;
    if (i < steps.length) setTimeout(step, 750);
    else setTimeout(() => { countdown.style.display = 'none'; pushTick(MODES[raceMode].lines.start, '#38bdf8'); startRace(); }, 650);
  };
  step();
}

/* ── Build track ────────────────────────────────────────────────── */
function buildTrack() {
  track.innerHTML = '';

  const sky = document.createElement('div');
  sky.className = 'track-sky';
  track.appendChild(sky);

  const course = document.createElement('div');
  course.className = 'track-course';

  const gate = document.createElement('div');
  gate.className = 'start-gate';
  course.appendChild(gate);

  const post = document.createElement('div');
  post.className = 'finish-post';
  post.innerHTML = '<span class="flag">🏁</span>';
  course.appendChild(post);

  racers.forEach((r, i) => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.setProperty('--lc', r.color);
    lane.innerHTML = `
      <div class="racer" id="racer-${i}">
        <span class="pill"><b class="rank" id="rank-${i}">–</b><span class="pname">${escapeHtml(r.name)}</span></span>
        <span class="fx" id="fx-${i}"></span>
        <span class="trail"></span>
        <span class="shadow"></span>
        <span class="racer-emoji">${r.emoji}</span>
      </div>`;
    course.appendChild(lane);
  });

  track.appendChild(course);
}

/* ── Update positions + ranking ─────────────────────────────────── */
function updatePositions() {
  racers.forEach((r, i) => {
    const el = $(`racer-${i}`);
    if (!el) return;
    el.style.left = `calc(${r.pos / 100} * (100% - 66px))`;
    el.classList.remove('running', 'stumbling', 'boosting', 'done', 'idle');
    if (r.ended)             el.classList.add(i === winnerIdx ? 'done' : 'idle');
    else if (r.state === 'slow') el.classList.add('stumbling');
    else { el.classList.add('running'); if (r.boost > 0) el.classList.add('boosting'); }
  });
  liveOrder().forEach((o, rank) => {
    const badge = $(`rank-${o.i}`);
    if (!badge) return;
    badge.textContent = String(rank + 1);
    badge.classList.toggle('r1', rank === 0);
    badge.classList.toggle('r2', rank === 1);
    badge.classList.toggle('r3', rank === 2);
  });
}

function liveOrder() {
  return racers.map((r, i) => ({ i, pos: r.pos, done: r.done, finishT: r.finishT }))
    .sort((a, b) => {
      if (a.done && b.done) return a.finishT - b.finishT;
      if (a.done) return -1; if (b.done) return 1;
      return b.pos - a.pos;
    });
}

/* ── Timer ──────────────────────────────────────────────────────── */
function runTimer() {
  const update = () => {
    if (phase !== 'race') return;
    timerEl.textContent = `${((performance.now() - raceStart) / 1000).toFixed(2)}s`;
    timerRAF = requestAnimationFrame(update);
  };
  timerRAF = requestAnimationFrame(update);
}

/* ── Engine ─────────────────────────────────────────────────────── */
function startRace() {
  phase = 'race';
  raceStart = performance.now();
  track.classList.add('racing');
  runTimer();
  timer = setInterval(tick, TICK_MS);
}

function tick() {
  curTick++;
  const L = MODES[raceMode].lines;
  const last = curTick >= totalTicks;

  racers.forEach((r, i) => {
    if (r.boost > 0) r.boost--;
    const delta = r.plan[curTick - 1] ?? 0;
    const prev = r.state;
    r.pos = Math.min(100, r.pos + delta);
    r.state = delta > r.avg * 1.9 ? 'boost' : (delta < r.avg * 0.45 ? 'slow' : 'run');

    if (r.state === 'boost' && prev !== 'boost') {
      r.boost = 5;
      popFx(i, MODES[raceMode].boostFx, 'go');
      maybeTick(L.boost(r.name), r.color, 0.45);
    } else if (r.state === 'slow' && prev !== 'slow') {
      popFx(i, MODES[raceMode].slowFx, 'go');
      maybeTick(L.stumble(r.name), r.color, 0.4);
    }
  });

  detectDrama();
  updatePositions();
  if (last) { clearInterval(timer); cancelAnimationFrame(timerRAF); finishRace(); }
}

function finishRace() {
  racers[winnerIdx].pos = 100;
  timerEl.textContent = `${durationSec.toFixed(2)}s`;
  const order = [...racers].sort((a, b) => (b === racers[winnerIdx] ? 1 : a === racers[winnerIdx] ? -1 : b.pos - a.pos));
  order.forEach((r, idx) => { r.done = true; r.ended = true; r.finishT = idx; });
  popFx(winnerIdx, '🏆', 'go');
  pushTick(MODES[raceMode].lines.finish(racers[winnerIdx].name), racers[winnerIdx].color);
  shake();
  track.classList.remove('racing');
  updatePositions();
  setTimeout(showResult, 700);
}

/* ── Drama ──────────────────────────────────────────────────────── */
function detectDrama() {
  const order = liveOrder();
  if (!order.length) return;
  const L = MODES[raceMode].lines;

  const lead = order[0].i;
  if (curLeader !== -1 && lead !== curLeader && order[0].pos > 14) {
    maybeTick(L.lead(racers[lead].name), racers[lead].color, 0.8);
    flashRank(lead);
  }
  curLeader = lead;

  if (!photoShown && order.length >= 2) {
    const a = order[0], b = order[1];
    if (a.pos >= 82 && Math.abs(a.pos - b.pos) <= 5) {
      photoShown = true;
      track.classList.add('photo');
      photoEl.classList.add('show');
      pushTick(`📸 SÁT NÚT! ${racers[a.i].name} vs ${racers[b.i].name}!`, '#facc15');
      setTimeout(() => { track.classList.remove('photo'); photoEl.classList.remove('show'); }, 1600);
    }
  }
}

/* ── FX ─────────────────────────────────────────────────────────── */
function popFx(i, text, cls) {
  const fx = $(`fx-${i}`);
  if (!fx) return;
  fx.textContent = text;
  fx.className = 'fx';
  void fx.offsetWidth;
  fx.classList.add(cls);
  setTimeout(() => { fx.classList.remove(cls); fx.textContent = ''; }, 700);
}
function flashRank(i) {
  const b = $(`rank-${i}`);
  if (!b) return;
  b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
}
let shakeT = null;
function shake() {
  raceEl.classList.add('shake');
  clearTimeout(shakeT);
  shakeT = setTimeout(() => raceEl.classList.remove('shake'), 280);
}

/* ── Ticker ─────────────────────────────────────────────────────── */
function pushTick(text, color) {
  const line = document.createElement('div');
  line.className = 'ticker-line';
  line.style.setProperty('--cc', color || '#eef1f6');
  line.textContent = text;
  ticker.prepend(line);
  while (ticker.children.length > 3) ticker.removeChild(ticker.lastChild);
  [...ticker.children].forEach((el, i) => { el.style.opacity = i === 0 ? '1' : i === 1 ? '0.55' : '0.3'; });
}
function maybeTick(text, color, prob) { if (Math.random() < prob) pushTick(text, color); }

/* ── Result ─────────────────────────────────────────────────────── */
function showResult() {
  phase = 'result';
  const w = racers[winnerIdx];
  const sorted = [...racers].sort((a, b) => (a === w ? -1 : b === w ? 1 : b.pos - a.pos));
  const medals = ['🥇', '🥈', '🥉'];
  resultBody.innerHTML = `
    <div class="winner" style="--wc:${w.color}">
      <div class="win-rays"></div>
      <div class="win-emoji">${w.emoji}</div>
      <div class="win-crown">👑</div>
      <div class="win-name">${escapeHtml(w.name)}</div>
      <div class="win-sub">🏆 VÔ ĐỊCH · Về đích đầu tiên!</div>
    </div>
    <div class="board">
      ${sorted.map((r, i) => `
        <div class="board-row ${r === w ? 'win' : ''}" style="--pc:${r.color}">
          <span class="medal">${medals[i] ?? `#${i + 1}`}</span>
          <span class="b-emoji">${r.emoji}</span>
          <span class="b-name">${escapeHtml(r.name)}</span>
        </div>`).join('')}
    </div>`;
  hide(raceEl); show(resultEl);
  confetti(w.color);
  shareBtn.onclick = () => doShare(w, sorted);
}

/* ── Confetti ───────────────────────────────────────────────────── */
function confetti(color) {
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
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
async function doShare(w, sorted) {
  const lines = sorted.map((r, i) => `${['🥇','🥈','🥉'][i] ?? `#${i + 1}`} ${r.emoji} ${r.name}`).join('\n');
  const text = `🏆 Kết quả ${raceMode === 'duck' ? 'Đua Vịt' : 'Đua Ngựa'}!\n${lines}\n\nĐua thử tại latbai.vn/dua`;
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); shareBtn.textContent = '✓ Đã copy!'; setTimeout(() => shareBtn.textContent = '📤 Chia sẻ kết quả', 2000); }
  } catch { /**/ }
}

/* ── Again ──────────────────────────────────────────────────────── */
againBtn.addEventListener('click', () => {
  clearInterval(timer); cancelAnimationFrame(timerRAF);
  phase = 'setup'; racers = []; winnerIdx = -1;
  track.innerHTML = ''; track.className = ''; ticker.innerHTML = ''; resultBody.innerHTML = '';
  photoEl.classList.remove('show');
  hide(resultEl); hide(raceEl); show(setupEl);
  if (raceMode) renderRacers();
});

/* ── Utils ──────────────────────────────────────────────────────── */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
