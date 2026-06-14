'use strict';

/* ── Deterministic hash ─────────────────────────────────────────── */
function hash(str, seed = 0) {
  let h = (seed + 0x9e3779b9) >>> 0;
  const s = String(str).trim().toLowerCase().normalize('NFC');
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9);
    h ^= (h >>> 16); h = h >>> 0;
  }
  return h;
}
function pick(arr, name, seed) { return arr[hash(name, seed) % arr.length]; }

/* ── Data ───────────────────────────────────────────────────────── */
const NGU_HANH = [
  { id:'moc', name:'Mộc', char:'木', emoji:'🌿', color:'#4ade80', glow:'rgba(74,222,128,.25)',
    tagline:'Cây xanh vươn lên không ngừng',
    traits:['Sáng tạo','Nhân ái','Kiên trì','Bao dung'],
    desc:'Tên bạn mang năng lượng Mộc — như cây xanh bám rễ sâu và vươn lên dưới ánh mặt trời. Bạn có trực giác mạnh, yêu cái đẹp và luôn biết cách nuôi dưỡng người xung quanh. Sức mạnh lớn nhất của bạn là sự kiên trì âm thầm mà không ai thấy cho đến khi hoa nở.',
    lucky_color:'Xanh lá · Xanh teal', lucky_numbers:[3,4,8], lucky_dir:'Đông · Đông Nam', lucky_stone:'Ngọc bích · Mắt hổ' },
  { id:'hoa', name:'Hỏa', char:'火', emoji:'🔥', color:'#f97316', glow:'rgba(249,115,22,.25)',
    tagline:'Ngọn lửa tỏa sáng không tắt',
    traits:['Nhiệt huyết','Lãnh đạo','Quyết đoán','Hào phóng'],
    desc:'Tên bạn mang năng lượng Hỏa — như ngọn lửa rực cháy sưởi ấm tất cả. Bạn sinh ra để dẫn đầu, có sức thu hút tự nhiên khiến người khác muốn đi theo. Chỉ cần học cách kiểm soát ngọn lửa bên trong — để nó soi đường, không phải thiêu rụi.',
    lucky_color:'Đỏ · Cam · Hồng', lucky_numbers:[2,7,9], lucky_dir:'Nam · Đông Nam', lucky_stone:'Hồng ngọc · Thạch lựu' },
  { id:'tho', name:'Thổ', char:'土', emoji:'⛰️', color:'#eab308', glow:'rgba(234,179,8,.25)',
    tagline:'Đất đai bao dung vạn vật',
    traits:['Đáng tin cậy','Bền bỉ','Thực tế','Ổn định'],
    desc:'Tên bạn mang năng lượng Thổ — như mảnh đất màu mỡ nuôi sống tất cả. Bạn là trụ cột mà mọi người tìm đến khi cần điểm tựa. Xây dựng chậm nhưng chắc, từng bước — đó là con đường của bạn, dẫn đến những thứ bền vững hơn bất kỳ con đường nào.',
    lucky_color:'Vàng · Nâu đất · Be', lucky_numbers:[5,0], lucky_dir:'Trung tâm · Tây Nam', lucky_stone:'Thạch anh vàng · Hổ phách' },
  { id:'kim', name:'Kim', char:'金', emoji:'✨', color:'#a78bfa', glow:'rgba(167,139,250,.25)',
    tagline:'Vàng ròng tinh luyện qua lửa',
    traits:['Tinh tế','Nguyên tắc','Quyết tâm','Chính trực'],
    desc:'Tên bạn mang năng lượng Kim — như lưỡi kiếm được tôi luyện, sắc bén và không khuất phục. Bạn có tư duy rõ ràng, thẩm mỹ cao và không chấp nhận sự giả dối. Học cách mềm mỏng đôi lúc — kim cương cứng nhất cũng phải qua tay người thợ khéo mới tỏa sáng.',
    lucky_color:'Trắng · Bạc · Xám nhạt', lucky_numbers:[1,6], lucky_dir:'Tây · Tây Bắc', lucky_stone:'Bạch ngọc · Đá mặt trăng' },
  { id:'thuy', name:'Thủy', char:'水', emoji:'🌊', color:'#38bdf8', glow:'rgba(56,189,248,.25)',
    tagline:'Dòng nước chảy không gì ngăn cản',
    traits:['Trí tuệ','Linh hoạt','Sâu sắc','Nhạy cảm'],
    desc:'Tên bạn mang năng lượng Thủy — như dòng nước không bao giờ ngừng chảy, luôn tìm được lối đi dù qua bao hiểm trở. Bạn có chiều sâu nội tâm ít ai thấy hết và khả năng đọc người xuất chúng. Cảm xúc phong phú không phải điểm yếu — đó là siêu năng lực của bạn.',
    lucky_color:'Xanh biển · Đen · Tím đậm', lucky_numbers:[1,6], lucky_dir:'Bắc · Đông Bắc', lucky_stone:'Aquamarine · Sapphire' },
];

const SPIRIT_ANIMALS = [
  { name:'Rồng', emoji:'🐉', desc:'Quyền năng, may mắn, thiên phú phi thường — hiếm người mang linh vật này' },
  { name:'Cọp Trắng', emoji:'🐯', desc:'Dũng mãnh, tự do, không chịu khuất phục trước bất kỳ thế lực nào' },
  { name:'Phượng Hoàng', emoji:'🦅', desc:'Tái sinh từ tro tàn, cao quý — mỗi thất bại là bước đệm cho sự hồi sinh' },
  { name:'Rùa Thần', emoji:'🐢', desc:'Trí tuệ cổ đại, trường thọ — bạn thấy những điều người khác bỏ qua' },
  { name:'Hạc Vàng', emoji:'🦢', desc:'Thanh cao, cân bằng âm dương — sự hiện diện của bạn mang lại bình an' },
  { name:'Cáo Linh', emoji:'🦊', desc:'Thông minh, huyền bí, nhìn thấu bản chất mọi sự vật' },
  { name:'Sói Bạc', emoji:'🐺', desc:'Trung thành tuyệt đối, bản năng sắc bén — lãnh đạo trong bóng tối' },
  { name:'Cá Koi Đỏ', emoji:'🐟', desc:'Kiên trì ngược dòng, biến thử thách thành phúc — vận may theo bước chân bạn' },
  { name:'Kỳ Lân', emoji:'🦄', desc:'Hiếm có, thuần khiết — chỉ xuất hiện trong thời đại thịnh trị và tốt lành' },
  { name:'Bướm Tím', emoji:'🦋', desc:'Chuyển hóa liên tục, tự do đích thực — linh hồn không bị lồng nào giam cầm' },
  { name:'Đại Bàng Núi', emoji:'🦅', desc:'Tầm nhìn xa rộng — bạn thấy đích đến trước khi người khác biết đường đi' },
  { name:'Rắn Ngọc', emoji:'🐍', desc:'Trực giác siêu việt, khôn ngoan bẩm sinh — biết lúc nào tiến, lúc nào ẩn' },
];

const PROPHECIES = [
  'Cánh cửa bạn chưa dám gõ đang chờ được mở từ bên trong.',
  'Thứ bạn tìm kiếm cũng đang tìm kiếm bạn — hãy đứng yên một chút.',
  'Sức mạnh thực sự của bạn ẩn trong điều bạn nghĩ là điểm yếu.',
  'Một cơ hội đang ngụy trang dưới hình dạng của thất bại.',
  'Người đang đứng bên cạnh bạn quan trọng hơn bạn đang nghĩ.',
  'Điều bạn trì hoãn lâu nhất chính là điều cần làm đầu tiên.',
  'Vũ trụ đã chuẩn bị một bước ngoặt — bạn chỉ cần mở mắt.',
  'Hãy tin vào trực giác lúc này — nó chính xác hơn mọi phân tích.',
  'Thứ bạn buông bỏ sẽ mở ra không gian cho điều tốt hơn đến.',
  'Bạn đang ở đúng nơi, đúng thời điểm — dù chưa thấy rõ tại sao.',
  'Điều tưởng chừng kết thúc thực ra là một khởi đầu mới.',
  'Có người đang âm thầm ngưỡng mộ bạn từ khoảng cách xa.',
  'Năng lượng bạn gieo hôm nay sẽ gặt hái trong 30 ngày tới.',
  'Hãy kiên nhẫn thêm — mọi thứ đang được sắp xếp theo cách bạn chưa thấy.',
  'Tài năng lớn nhất của bạn chưa được thế giới biết đến — và nó sắp xuất hiện.',
  'Một cuộc hội ngộ tình cờ sắp thay đổi hướng đi của bạn.',
  'Đừng thu nhỏ mình để vừa với không gian người khác tạo ra cho bạn.',
  'Điều bạn cần không xa — nó chỉ đang chờ bạn nhìn đúng hướng.',
];

const SCORE_TITLES = [
  { min:90, t:'Thiên Mệnh Phi Phàm 🌟' },
  { min:78, t:'Vận Khí Cường Thịnh 🔥' },
  { min:66, t:'Cát Tinh Chiếu Mệnh ✨' },
  { min:50, t:'Vững Vàng Bền Bỉ 🌱' },
  { min:0,  t:'Tiềm Năng Đang Ngủ 🌙' },
];

/* ── Analyze single ─────────────────────────────────────────────── */
function analyze(name) {
  const element  = NGU_HANH[hash(name, 0) % NGU_HANH.length];
  const animal   = pick(SPIRIT_ANIMALS, name, 1337);
  const prophecy = pick(PROPHECIES, name, 2025);
  const luckyNum = element.lucky_numbers[hash(name, 999) % element.lucky_numbers.length];
  const score    = 58 + (hash(name, 314) % 42); // 58–99
  const title    = SCORE_TITLES.find(s => score >= s.min).t;
  return { element, animal, prophecy, luckyNum, score, title };
}

/* ── Element relationship (sinh / khắc) ─────────────────────────── */
// order: moc0, hoa1, tho2, kim3, thuy4 ; sinh:(i+1)%5 ; khắc:(i+2)%5
function relation(a, b) {
  if (a === b) return { kind:'same', txt:'đồng hành', bonus:8,
    note:'cùng tần số — hiểu nhau gần như không cần lời.' };
  if ((a + 1) % 5 === b || (b + 1) % 5 === a) return { kind:'sinh', txt:'tương sinh', bonus:14,
    note:'nuôi dưỡng và nâng đỡ nhau cùng lớn lên.' };
  if ((a + 2) % 5 === b || (b + 2) % 5 === a) return { kind:'khac', txt:'tương khắc', bonus:-10,
    note:'nhiều va chạm — nhưng chính sự khác biệt tạo nên sức hút khó cưỡng.' };
  return { kind:'neutral', txt:'trung hòa', bonus:0,
    note:'cần thời gian điều chỉnh, nhưng tiềm năng rất rộng mở.' };
}

const VERDICTS = [
  { min:90, t:'Định mệnh trời sinh 🔥', s:'Hai bạn như được vũ trụ sắp đặt sẵn cho nhau.' },
  { min:78, t:'Cực kỳ ăn ý 💕', s:'Một cặp đôi khiến ai cũng phải ghen tị.' },
  { min:64, t:'Rất hợp nhau 😊', s:'Nền tảng vững — chỉ cần vun đắp là bền lâu.' },
  { min:50, t:'Có duyên cần nuôi 🌱', s:'Hợp ở nhiều mặt, vài chỗ cần thấu hiểu thêm.' },
  { min:0,  t:'Đối nghịch hút nhau ⚡', s:'Khác biệt lớn — nhưng đôi khi đó lại là định mệnh kiểu khác.' },
];

function compat(a, b) {
  const key  = [a.trim().toLowerCase().normalize('NFC'), b.trim().toLowerCase().normalize('NFC')].sort().join('💞');
  const base = 52 + (hash(key, 77) % 38);          // 52–89
  const ea = hash(a, 0) % 5, eb = hash(b, 0) % 5;
  const rel = relation(ea, eb);
  const score = Math.max(38, Math.min(99, base + rel.bonus));

  const cats = [
    { label:'Tình cảm',     icon:'💗', seed:11 },
    { label:'Thấu hiểu',    icon:'🧠', seed:22 },
    { label:'Tài lộc chung',icon:'💰', seed:33 },
    { label:'Bền lâu',      icon:'⏳', seed:44 },
  ].map(c => ({ ...c, val: Math.max(30, Math.min(99, score + (hash(key, c.seed) % 27) - 13)) }));

  const verdict = VERDICTS.find(v => score >= v.min);
  return { score, cats, verdict, ea: NGU_HANH[ea], eb: NGU_HANH[eb], rel };
}

/* ── DOM ────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const tabs = document.querySelectorAll('.tab');
const panelSingle = $('panel-single'), panelCouple = $('panel-couple');
const resSingle = $('result-single'),  resCouple = $('result-couple');
const scanning = $('scanning'), scanName = $('scan-name');

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function setAccent(color, glow) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--glow', glow);
}
function staggerIn(section) {
  section.querySelectorAll('.anim').forEach((el, i) => {
    el.style.animation = 'none'; void el.offsetWidth;
    el.style.animationDelay = `${i * 0.07}s`;
    el.style.animation = '';
    el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
  });
}

/* ── Tabs ───────────────────────────────────────────────────────── */
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.toggle('on', x === t));
  const single = t.dataset.tab === 'single';
  hide(resSingle); hide(resCouple);
  panelSingle.classList.toggle('hidden', !single);
  panelCouple.classList.toggle('hidden', single);
}));

/* ── Scanning then reveal ───────────────────────────────────────── */
function scanThen(label, accentColor, doReveal) {
  if (accentColor) setAccent(accentColor.color, accentColor.glow);
  scanName.textContent = label;
  show(scanning);
  scanning.classList.remove('out'); void scanning.offsetWidth;
  setTimeout(() => {
    hide(scanning);
    doReveal();
  }, 1250);
}

/* ── Single ─────────────────────────────────────────────────────── */
$('s-go').addEventListener('click', () => {
  const name = $('s-name').value.trim();
  if (!name) return wiggle($('s-name'));
  const data = analyze(name);
  scanThen(name, data.element, () => renderSingle(name, data));
});
$('s-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('s-go').click(); });

function renderSingle(name, d) {
  const e = d.element;
  setAccent(e.color, e.glow);

  $('r-el-emoji').textContent = e.emoji;
  $('r-el-char').textContent  = e.char;
  $('r-el-name').textContent  = `Hành ${e.name}`;
  $('r-el-tag').textContent   = e.tagline;
  $('r-name').textContent     = name;

  // score ring
  $('r-score').textContent = d.score;
  $('r-score-title').textContent = d.title;
  ring($('r-score-ring'), d.score, e.color);

  $('r-desc').textContent = e.desc;
  $('r-traits').innerHTML = e.traits.map(t => `<span class="trait">${t}</span>`).join('');

  $('r-animal-emoji').textContent = d.animal.emoji;
  $('r-animal-name').textContent  = d.animal.name;
  $('r-animal-desc').textContent  = d.animal.desc;

  $('r-prophecy').textContent = `“${d.prophecy}”`;

  $('r-color').textContent = e.lucky_color;
  $('r-num').textContent   = d.luckyNum;
  $('r-dir').textContent   = e.lucky_dir;
  $('r-stone').textContent = e.lucky_stone;

  hide(panelSingle);
  show(resSingle);
  staggerIn(resSingle);
  $('s-share').onclick = () => shareText(
    `✨ ${name} mang Hành ${e.name} ${e.emoji} — Điểm vận mệnh ${d.score}/100\nLinh vật: ${d.animal.name} ${d.animal.emoji}\nGiải mã tên bạn tại latbai.vn/ten`);
}

$('s-again').addEventListener('click', () => {
  hide(resSingle); show(panelSingle); $('s-name').value = ''; $('s-name').focus();
});

/* ── Couple ─────────────────────────────────────────────────────── */
$('c-go').addEventListener('click', () => {
  const a = $('c-a').value.trim(), b = $('c-b').value.trim();
  if (!a) return wiggle($('c-a'));
  if (!b) return wiggle($('c-b'));
  const data = compat(a, b);
  scanThen(`${a} 💞 ${b}`, null, () => renderCouple(a, b, data));
});

function renderCouple(a, b, d) {
  setAccent('#f472b6', 'rgba(244,114,182,.25)');
  $('rc-a').textContent = a;
  $('rc-b').textContent = b;
  $('rc-pct').textContent = `${d.score}%`;
  ring($('rc-ring'), d.score, '#f472b6');

  $('rc-verdict').innerHTML = `<div class="vt">${d.verdict.t}</div><div class="vs">${d.verdict.s}</div>`;

  $('rc-bars').innerHTML = d.cats.map(c => `
    <div class="bar-row">
      <div class="bar-top"><span>${c.icon} ${c.label}</span><span class="bar-val">${c.val}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:0%" data-w="${c.val}"></div></div>
    </div>`).join('');

  $('rc-element').innerHTML =
    `Hành <b style="color:${d.ea.color}">${d.ea.name} ${d.ea.emoji}</b> của <b>${escapeHtml(a)}</b> và ` +
    `Hành <b style="color:${d.eb.color}">${d.eb.name} ${d.eb.emoji}</b> của <b>${escapeHtml(b)}</b> — ` +
    `<b>${d.rel.txt}</b>: ${d.rel.note}`;

  hide(panelCouple);
  show(resCouple);
  staggerIn(resCouple);
  // animate bars
  setTimeout(() => resCouple.querySelectorAll('.bar-fill').forEach(f => { f.style.width = f.dataset.w + '%'; }), 250);
  if (d.score >= 78) confetti('#f472b6');

  $('c-share').onclick = () => shareText(
    `💞 ${a} & ${b} hợp nhau ${d.score}%!\n${d.verdict.t}\nĐo độ hợp tên tại latbai.vn/ten`);
}

$('c-again').addEventListener('click', () => {
  hide(resCouple); show(panelCouple); $('c-a').value = ''; $('c-b').value = ''; $('c-a').focus();
});

/* ── Score / match ring (conic) ─────────────────────────────────── */
function ring(el, pct, color) {
  const deg = Math.round(pct / 100 * 360);
  el.style.background = `conic-gradient(${color} ${deg}deg, rgba(120,80,25,.13) ${deg}deg)`;
}

/* ── Share ──────────────────────────────────────────────────────── */
async function shareText(text) {
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast('✓ Đã copy kết quả!'); }
  } catch { /**/ }
}
let toastT = null;
function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ── Confetti ───────────────────────────────────────────────────── */
function confetti(color) {
  const canvas = $('confetti'); const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight; canvas.style.display = 'block';
  const COLORS = [color, '#fff', '#facc15', '#a78bfa', '#38bdf8'];
  const pieces = Array.from({ length: 110 }, () => ({
    x: Math.random()*canvas.width, y: -20 - Math.random()*120,
    vx:(Math.random()-.5)*5, vy:3+Math.random()*4, w:6+Math.random()*8, h:3+Math.random()*4,
    rot:Math.random()*360, rv:(Math.random()-.5)*11, color:COLORS[Math.floor(Math.random()*COLORS.length)],
  }));
  let f = 0;
  (function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180); ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore(); p.x+=p.vx; p.y+=p.vy; p.vy+=.12; p.rot+=p.rv; });
    if (++f < 150) requestAnimationFrame(draw); else canvas.style.display='none';
  })();
}

/* ── Utils ──────────────────────────────────────────────────────── */
function wiggle(el) { el.classList.add('wiggle'); setTimeout(() => el.classList.remove('wiggle'), 450); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
