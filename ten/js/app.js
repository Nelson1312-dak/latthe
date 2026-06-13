'use strict';

/* ── Deterministic hash: same name → same result ─────────────────── */
function hash(str, seed = 0) {
  let h = (seed + 0x9e3779b9) >>> 0;
  const s = str.trim().toLowerCase().normalize('NFC');
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9);
    h ^= (h >>> 16);
    h = h >>> 0;
  }
  return h;
}
function pick(arr, name, seed) {
  return arr[hash(name, seed) % arr.length];
}

/* ── Data ─────────────────────────────────────────────────────────── */
const NGU_HANH = [
  {
    id: 'moc', name: 'Mộc', char: '木', emoji: '🌿',
    color: '#4ade80', glow: 'rgba(74,222,128,0.25)',
    tagline: 'Cây xanh vươn lên không ngừng',
    traits: ['Sáng tạo', 'Nhân ái', 'Kiên trì', 'Bao dung'],
    desc: 'Tên bạn mang năng lượng Mộc — như cây xanh bám rễ sâu và vươn lên dưới ánh mặt trời. Bạn có trực giác mạnh, yêu cái đẹp và luôn biết cách nuôi dưỡng người xung quanh. Sức mạnh lớn nhất của bạn là sự kiên trì âm thầm mà không ai nhìn thấy cho đến khi hoa nở.',
    lucky_color: 'Xanh lá · Xanh teal',
    lucky_numbers: [3, 4, 8],
    lucky_dir: 'Đông · Đông Nam',
    lucky_stone: 'Ngọc bích · Mắt hổ',
    compatible: 'Thủy nuôi Mộc 💧→🌿',
    avoid: 'Kim khắc Mộc — tránh quyết định vội',
  },
  {
    id: 'hoa', name: 'Hỏa', char: '火', emoji: '🔥',
    color: '#f97316', glow: 'rgba(249,115,22,0.25)',
    tagline: 'Ngọn lửa tỏa sáng không tắt',
    traits: ['Nhiệt huyết', 'Lãnh đạo', 'Quyết đoán', 'Hào phóng'],
    desc: 'Tên bạn mang năng lượng Hỏa — như ngọn lửa rực cháy sưởi ấm tất cả xung quanh. Bạn sinh ra để dẫn đầu, có sức thu hút tự nhiên khiến người khác muốn đi theo. Chỉ cần học cách kiểm soát ngọn lửa bên trong — để nó soi đường, không phải thiêu rụi.',
    lucky_color: 'Đỏ · Cam · Hồng',
    lucky_numbers: [2, 7, 9],
    lucky_dir: 'Nam · Đông Nam',
    lucky_stone: 'Hồng ngọc · Thạch lựu',
    compatible: 'Mộc sinh Hỏa 🌿→🔥',
    avoid: 'Thủy khắc Hỏa — tránh môi trường tiêu cực',
  },
  {
    id: 'tho', name: 'Thổ', char: '土', emoji: '⛰️',
    color: '#eab308', glow: 'rgba(234,179,8,0.25)',
    tagline: 'Đất đai bao dung vạn vật',
    traits: ['Đáng tin cậy', 'Bền bỉ', 'Thực tế', 'Ổn định'],
    desc: 'Tên bạn mang năng lượng Thổ — như mảnh đất màu mỡ nuôi sống tất cả. Bạn là trụ cột mà mọi người tìm đến khi cần điểm tựa. Xây dựng chậm nhưng chắc, từng bước một — đó là con đường của bạn, và nó dẫn đến những thứ bền vững hơn bất kỳ con đường nào.',
    lucky_color: 'Vàng · Nâu đất · Be',
    lucky_numbers: [5, 0],
    lucky_dir: 'Trung tâm · Tây Nam',
    lucky_stone: 'Thạch anh vàng · Hổ phách',
    compatible: 'Hỏa sinh Thổ 🔥→⛰️',
    avoid: 'Mộc khắc Thổ — tránh căng thẳng kéo dài',
  },
  {
    id: 'kim', name: 'Kim', char: '金', emoji: '✨',
    color: '#a78bfa', glow: 'rgba(167,139,250,0.25)',
    tagline: 'Vàng ròng tinh luyện qua lửa',
    traits: ['Tinh tế', 'Nguyên tắc', 'Quyết tâm', 'Chính trực'],
    desc: 'Tên bạn mang năng lượng Kim — như lưỡi kiếm được tôi luyện, sắc bén và không khuất phục. Bạn có tư duy rõ ràng, thẩm mỹ cao và không chấp nhận sự giả dối. Học cách mềm mỏng đôi lúc — kim cương cứng nhất thế giới cũng phải qua tay người thợ khéo léo mới tỏa sáng.',
    lucky_color: 'Trắng · Bạc · Xám nhạt',
    lucky_numbers: [1, 6],
    lucky_dir: 'Tây · Tây Bắc',
    lucky_stone: 'Bạch ngọc · Đá mặt trăng',
    compatible: 'Thổ sinh Kim ⛰️→✨',
    avoid: 'Hỏa khắc Kim — tránh xung đột trực tiếp',
  },
  {
    id: 'thuy', name: 'Thủy', char: '水', emoji: '🌊',
    color: '#38bdf8', glow: 'rgba(56,189,248,0.25)',
    tagline: 'Dòng nước chảy không gì ngăn cản',
    traits: ['Trí tuệ', 'Linh hoạt', 'Sâu sắc', 'Nhạy cảm'],
    desc: 'Tên bạn mang năng lượng Thủy — như dòng nước không bao giờ ngừng chảy, luôn tìm được lối đi dù qua bao nhiêu hiểm trở. Bạn có chiều sâu nội tâm mà ít ai thấy hết, và khả năng đọc người xuất chúng. Cảm xúc phong phú không phải điểm yếu — đó là siêu năng lực của bạn.',
    lucky_color: 'Xanh biển · Đen · Tím đậm',
    lucky_numbers: [1, 6],
    lucky_dir: 'Bắc · Đông Bắc',
    lucky_stone: 'Aquamarine · Sapphire',
    compatible: 'Kim sinh Thủy ✨→🌊',
    avoid: 'Thổ khắc Thủy — tránh bảo thủ cứng nhắc',
  },
];

const SPIRIT_ANIMALS = [
  { name: 'Rồng', emoji: '🐉', desc: 'Quyền năng, may mắn, thiên phú phi thường — hiếm người mang linh vật này' },
  { name: 'Cọp Trắng', emoji: '🐯', desc: 'Dũng mãnh, tự do, không chịu khuất phục trước bất kỳ thế lực nào' },
  { name: 'Phượng Hoàng', emoji: '🦅', desc: 'Tái sinh từ tro tàn, cao quý — mỗi thất bại là bước đệm cho sự hồi sinh' },
  { name: 'Rùa Thần', emoji: '🐢', desc: 'Trí tuệ cổ đại, trường thọ — bạn thấy những điều mà người khác bỏ qua' },
  { name: 'Hạc Vàng', emoji: '🦢', desc: 'Thanh cao, cân bằng âm dương — sự hiện diện của bạn mang lại bình an' },
  { name: 'Cáo Linh', emoji: '🦊', desc: 'Thông minh, huyền bí, nhìn thấu bản chất mọi sự vật' },
  { name: 'Sói Bạc', emoji: '🐺', desc: 'Trung thành tuyệt đối, bản năng sắc bén — lãnh đạo trong bóng tối' },
  { name: 'Cá Koi Đỏ', emoji: '🐟', desc: 'Kiên trì ngược dòng, biến thử thách thành phúc — vận may theo bước chân bạn' },
  { name: 'Kỳ Lân', emoji: '🦄', desc: 'Hiếm có, thuần khiết — chỉ xuất hiện trong thời đại thịnh trị và tốt lành' },
  { name: 'Bướm Tím', emoji: '🦋', desc: 'Chuyển hóa liên tục, tự do đích thực — linh hồn bạn không bị bất kỳ lồng nào giam cầm' },
  { name: 'Đại Bàng Núi', emoji: '🦅', desc: 'Tầm nhìn xa rộng hơn bất kỳ ai — bạn thấy đích đến trước khi người khác biết đường đi' },
  { name: 'Rắn Ngọc', emoji: '🐍', desc: 'Trực giác siêu việt, khôn ngoan bẩm sinh — biết lúc nào tiến, lúc nào ẩn' },
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

/* ── Core analyze function ────────────────────────────────────────── */
function analyze(name) {
  const element  = NGU_HANH[hash(name, 0)    % NGU_HANH.length];
  const animal   = pick(SPIRIT_ANIMALS, name, 1337);
  const prophecy = pick(PROPHECIES,     name, 2025);
  const luckyNum = element.lucky_numbers[hash(name, 999) % element.lucky_numbers.length];
  return { element, animal, prophecy, luckyNum };
}

/* ── DOM ─────────────────────────────────────────────────────────── */
const inputPhase  = document.getElementById('input-phase');
const resultPhase = document.getElementById('result-phase');
const nameInput   = document.getElementById('name-input');
const revealBtn   = document.getElementById('reveal-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const shareBtn    = document.getElementById('share-btn');

function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

function renderResult(name) {
  const { element, animal, prophecy, luckyNum } = analyze(name);

  document.documentElement.style.setProperty('--accent', element.color);
  document.documentElement.style.setProperty('--glow',   element.glow);

  document.getElementById('r-element-emoji').textContent = element.emoji;
  document.getElementById('r-element-char').textContent  = element.char;
  document.getElementById('r-element-name').textContent  = `Hành ${element.name}`;
  document.getElementById('r-element-tagline').textContent = element.tagline;

  document.getElementById('r-name').textContent = name;
  document.getElementById('r-desc').textContent = element.desc;

  document.getElementById('r-traits').innerHTML = element.traits
    .map(t => `<span class="trait-badge">${t}</span>`).join('');

  document.getElementById('r-animal-emoji').textContent = animal.emoji;
  document.getElementById('r-animal-name').textContent  = animal.name;
  document.getElementById('r-animal-desc').textContent  = animal.desc;

  document.getElementById('r-prophecy').textContent = `"${prophecy}"`;

  document.getElementById('r-lucky-color').textContent  = element.lucky_color;
  document.getElementById('r-lucky-num').textContent    = luckyNum;
  document.getElementById('r-lucky-dir').textContent    = element.lucky_dir;
  document.getElementById('r-lucky-stone').textContent  = element.lucky_stone;
  document.getElementById('r-compatible').textContent   = element.compatible;
  document.getElementById('r-avoid').textContent        = element.avoid;
}

function reveal() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.classList.add('shake');
    setTimeout(() => nameInput.classList.remove('shake'), 500);
    return;
  }

  hide(inputPhase);
  renderResult(name);

  resultPhase.classList.remove('hidden');
  // stagger animation
  resultPhase.querySelectorAll('.anim').forEach((el, i) => {
    el.style.animationDelay = `${i * 0.08}s`;
    el.classList.add('fade-up');
  });

  shareBtn.onclick = () => doShare(name);
}

async function doShare(name) {
  const { element, animal } = analyze(name);
  const text = `✨ ${name} mang Hành ${element.name} ${element.emoji} — Linh vật: ${animal.name} ${animal.emoji}\nKhám phá vận mệnh theo tên tại latbai.vn/ten`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = '✓ Đã copy!';
      setTimeout(() => shareBtn.textContent = '📤 Chia sẻ kết quả', 2000);
    }
  } catch { /* user cancelled */ }
}

revealBtn.addEventListener('click', reveal);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') reveal(); });
tryAgainBtn.addEventListener('click', () => {
  hide(resultPhase);
  resultPhase.querySelectorAll('.anim').forEach(el => el.classList.remove('fade-up'));
  nameInput.value = '';
  show(inputPhase);
  nameInput.focus();
});
