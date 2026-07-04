/**
 * sim/js/app.js — Phong Thủy Sim: chấm điểm số điện thoại theo
 * 81 linh số Kinh Dịch + cân bằng âm dương + nút + ngũ hành hợp mệnh
 * + cặp số dân gian. Cần profile.js (tùy chọn, lấy năm sinh).
 */
(function () {
  'use strict';

  // ==================== BẢNG 81 LINH SỐ (rating: 2 đại cát · 1 cát · 0 bình · -1 hung · -2 đại hung) ====================
  const LINH_SO = {
    1:  ['Thái Cực Vượng Khí', 2, 'Khởi đầu của vạn số — tiền đồ rộng mở, danh lợi song toàn, phú quý vinh hoa.'],
    2:  ['Lưỡng Nghi Phân Ly', -1, 'Khí số dao động, dễ hao tán và thiếu quyết đoán, thành bại thất thường.'],
    3:  ['Tiến Thủ Như Rồng', 1, 'Như rồng gặp mây — chí lớn được thi triển, danh vọng lên nhanh.'],
    4:  ['Khốn Khó Trắc Trở', -1, 'Nhiều gập ghềnh thử thách, làm mười được năm, cần nỗ lực gấp đôi.'],
    5:  ['Âm Dương Giao Hòa', 1, 'Phúc lộc thọ đủ đầy, gia đạo êm ấm, quý nhân che chở.'],
    6:  ['Thiên Đức An Ổn', 1, 'Trời ban đức dày, mọi việc hanh thông, càng về sau càng vượng.'],
    7:  ['Cương Nghị Quả Cảm', 1, 'Ý chí sắt đá, vượt mọi chông gai để đạt mục tiêu — hợp người làm chủ.'],
    8:  ['Kiên Trì Ắt Thành', 1, 'Bền bỉ như đá mài — chậm mà chắc, sự nghiệp vững bền.'],
    9:  ['Cùng Cực Hao Tổn', -2, 'Vận khí suy kiệt, dễ gặp cảnh dở dang, tiền tài khó giữ.'],
    10: ['Tối Tăm Mờ Mịt', -2, 'Khí số u ám, làm việc thiếu người nâng đỡ, nên tránh.'],
    11: ['Vạn Vật Hồi Xuân', 1, 'Âm dương hòa hợp trở lại — vận xấu qua đi, phúc lành kéo đến.'],
    12: ['Bạc Nhược Ý Chí', -1, 'Sức yếu gánh nặng, dễ bỏ cuộc giữa chừng, không hợp việc lớn.'],
    13: ['Trí Tuệ Mưu Lược', 1, 'Thông minh hơn người, giỏi ứng biến — thành công nhờ đầu óc.'],
    14: ['Phá Tan Giữa Chừng', -2, 'Công việc dễ đổ vỡ khi sắp thành, hao tài tốn của.'],
    15: ['Phúc Thọ Song Toàn', 1, 'Đức dày phúc lớn, được người kính trọng, tuổi già an nhàn.'],
    16: ['Được Người Trọng Vọng', 1, 'Có quý nhân nâng đỡ, dễ lên vị trí cao, gánh vác được việc lớn.'],
    17: ['Quyền Uy Vượt Khó', 1, 'Cứng rắn vượt nghịch cảnh — càng khó khăn càng tỏa sáng.'],
    18: ['Hữu Chí Cánh Thành', 1, 'Có chí thì nên — mọi kế hoạch đều có thể hoàn thành nếu quyết tâm.'],
    19: ['Đa Tài Đa Nạn', -2, 'Tài giỏi nhưng lận đận, dễ gặp biến cố bất ngờ về tiền bạc, tình cảm.'],
    20: ['Hư Không Bất Định', -2, 'Vận số trống rỗng, mọi thứ khó tích lũy, thành rồi lại bại.'],
    21: ['Trăng Rằm Độc Lập', 1, 'Tự lực thành danh, như trăng rằm tỏa sáng — hợp người lãnh đạo.'],
    22: ['Thu Tàn Cô Quạnh', -2, 'Như cỏ cây mùa thu — cô đơn, trắc trở, sức không theo kịp chí.'],
    23: ['Mặt Trời Mọc', 2, 'Vượng khí bậc nhất — như mặt trời bình minh, sự nghiệp thăng tiến rực rỡ.'],
    24: ['Tay Trắng Làm Nên', 2, 'Từ không thành có, tài lộc tự thân tích lũy, gia sản ngày càng dày.'],
    25: ['Anh Tuấn Tài Lộc', 1, 'Tư chất thông tuệ, tài năng đi cùng tài lộc — cần giữ khiêm tốn.'],
    26: ['Biến Quái Chìm Nổi', -1, 'Đời nhiều sóng gió thăng trầm, anh hùng gian nan.'],
    27: ['Nửa Đường Gãy Gánh', -2, 'Khởi đầu thuận rồi gặp biến, dễ dở dang — cần đề phòng nửa sau.'],
    28: ['Ly Tán Phong Ba', -2, 'Sóng gió chia lìa, thị phi vây quanh, khó tụ tài.'],
    29: ['Thành Đạt Như Ý', 2, 'Trí lực đầy đủ, cầu gì được nấy, sự nghiệp như thuyền thuận nước.'],
    30: ['Được Ăn Cả Ngã Về Không', -1, 'Số may rủi cực đoan — hợp người mạo hiểm nhưng khó bền.'],
    31: ['Trí Dũng Thống Lĩnh', 2, 'Trí, dũng, đức đủ cả — số của người đứng đầu, được lòng người.'],
    32: ['Quý Nhân Phù Trợ', 2, 'May mắn bất ngờ liên tiếp, gặp dữ hóa lành, được che chở.'],
    33: ['Vượng Phát Tột Đỉnh', 2, 'Quyền uy danh vọng lên tột đỉnh — khí số quá thịnh, nên giữ đức.'],
    34: ['Phá Gia Tai Ương', -2, 'Hung số nặng — biến cố dồn dập, hao tài tán của, nên tránh.'],
    35: ['Ôn Hòa Hưởng Phúc', 1, 'Bình an thanh nhã, hợp người làm văn hóa, nghệ thuật, giáo dục.'],
    36: ['Hào Hiệp Ba Đào', -1, 'Nghĩa khí giúp người nhưng đời mình gian truân, dễ ôm việc thiên hạ.'],
    37: ['Trung Chính Uy Tín', 1, 'Chính trực được tín nhiệm, làm ăn có chữ tín nên bền vững.'],
    38: ['Nghệ Thuật Thành Danh', 0, 'Quyền thế kém nhưng tài hoa — hợp nghề sáng tạo, kỹ thuật chuyên sâu.'],
    39: ['Mưa Tạnh Trời Quang', 2, 'Qua cơn bĩ cực đến hồi thái lai — phú quý vinh hoa kéo dài.'],
    40: ['Khôn Cùng Mạo Hiểm', -1, 'Thông minh nhưng thích phiêu lưu, được mất khó lường.'],
    41: ['Đức Vọng Tiếng Thơm', 2, 'Có đức có tài, danh tiếng lan xa, số phú quý trời cho.'],
    42: ['Đa Tài Bất Tinh', -1, 'Biết nhiều nghề mà không tinh một nghề — dễ dở dang, nên tập trung.'],
    43: ['Hào Nhoáng Tán Tài', -1, 'Vẻ ngoài rực rỡ nhưng trong rỗng, tiền vào cửa trước ra cửa sau.'],
    44: ['Bi Ai Tan Mộng', -2, 'Mộng lớn khó thành, nhiều nỗi lo ngầm — hung số cần tránh.'],
    45: ['Thuận Buồm Xuôi Gió', 2, 'Vượt sóng lớn mà đi — mưu sự ắt thành, danh lợi đều thu.'],
    46: ['Trầm Luân Khốn Khó', -1, 'Chìm nổi cực nhọc, cần ý chí phi thường mới vượt được vận.'],
    47: ['Khai Hoa Cát Tường', 2, 'Hoa nở đúng mùa — điềm lành mọi mặt, gia đạo hưng thịnh, con cháu nhờ.'],
    48: ['Trí Đức Cố Vấn', 1, 'Số của quân sư — trí tuệ và đức độ khiến người tìm đến xin lời khuyên.'],
    49: ['Chuyển Biến Khó Lường', -1, 'Đứng giữa lằn ranh cát hung — gặp cát thành cát, gặp hung thành hung.'],
    50: ['Một Thành Một Bại', -1, 'Thành công rồi thất bại đan xen, cuối đời dễ trắng tay nếu không giữ.'],
    51: ['Thịnh Suy Đan Xen', 0, 'Lúc lên rất cao lúc xuống rất sâu — cần tích lũy khi thịnh để phòng suy.'],
    52: ['Nhìn Xa Trông Rộng', 1, 'Có con mắt tiên kiến, đầu tư đúng chỗ, một vốn bốn lời.'],
    53: ['Ngoài Cười Trong Khóc', -1, 'Bề ngoài êm đẹp mà trong nhiều ưu phiền, tiền tài bất ổn.'],
    54: ['Gian Khổ Đa Nạn', -2, 'Trắc trở nối tiếp, tâm sức hao mòn — hung số nên tránh.'],
    55: ['Cực Thịnh Chuyển Suy', 0, 'Đẹp bề ngoài, ẩn lo bên trong — thịnh cực ắt suy, cần khiêm nhường.'],
    56: ['Thiếu Quyết Đoán', -1, 'Như thuyền giữa sóng thiếu tay lái — muốn mà không dám, lỡ thời cơ.'],
    57: ['Tuyết Hàn Gặp Xuân', 1, 'Qua đông giá rét ắt gặp mùa xuân — sau gian nan là phúc lớn.'],
    58: ['Tiên Khổ Hậu Ngọt', 0, 'Nửa đời đầu vất vả, nửa sau an nhàn — càng già càng có hậu.'],
    59: ['Hàn Thiền Thiếu Lực', -1, 'Như ve sầu cuối thu — thiếu nghị lực và kiên nhẫn, khó nên việc lớn.'],
    60: ['Tối Tăm Phập Phồng', -1, 'Vô mưu vô định, làm việc thiếu kế hoạch nên khó tụ thành quả.'],
    61: ['Danh Lợi Song Thu', 1, 'Vừa có danh vừa có lợi — nhưng cần tu dưỡng để tránh kiêu căng đổ vỡ.'],
    62: ['Suy Đồi Khó Bền', -2, 'Cơ nghiệp khó giữ, trong ngoài không hòa — hung số.'],
    63: ['Cá Chép Hóa Rồng', 2, 'Chuyển vận ngoạn mục — như cá gặp nước, vạn sự hanh thông, con cháu hưởng phúc.'],
    64: ['Phù Trầm Bất Định', -1, 'Nổi chìm thất thường, dễ gặp tai ương bất ngờ, cần thận trọng.'],
    65: ['Quang Minh Chính Đại', 2, 'Đường đời rộng mở sáng sủa — gia vận hưng long, thọ khang phú quý.'],
    66: ['Tiến Thoái Lưỡng Nan', -1, 'Trong ngoài bất hòa, tiến không được lùi không xong — cần bớt ôm đồm.'],
    67: ['Trời Ban Thời Cơ', 2, 'Được thiên thời — mọi việc thông đạt, sự nghiệp tự nhiên nở rộ.'],
    68: ['Lộc Phát Phát Minh', 2, 'Trí tuệ chu đáo, sáng tạo sinh tài — số "lộc phát" ai cũng mong.'],
    69: ['Phi Nghiệp Phi Lực', -2, 'Danh không thành, lực không đủ — dừng trệ bất an, nên tránh.'],
    70: ['Tàn Tạ Hiểm Nạn', -2, 'Khí số tàn úa, đời nhiều hiểm nạn ưu sầu — hung số nặng.'],
    71: ['Kiên Trì Thì An', 0, 'Có đức có sức nhưng hay ngại khó — kiên trì đến cùng thì được an lành.'],
    72: ['Ngoài Cát Trong Hung', -1, 'Âm dương lẫn lộn — nhìn thuận mà nghịch ngầm, tiền bạc dễ đội nón ra đi.'],
    73: ['Chí Cao Lực Nhỏ', 0, 'Mơ lớn nhưng sức chưa theo kịp — an phận tu thân thì hưởng yên ổn.'],
    74: ['Ngồi Không Khó Bền', -1, 'Hưởng lộc mà không tạo lộc — dễ sinh nhàn cư vi bất thiện.'],
    75: ['Thủ Tắc An', 0, 'Giữ thì yên, tiến thì hối — hợp người sống ổn định, không hợp mạo hiểm.'],
    76: ['Ly Tán Trước Hung', -1, 'Nửa đầu sóng gió chia lìa, nửa sau mới dần ổn định.'],
    77: ['Trước Cát Hậu Hung', 0, 'Nửa đời đầu được che chở, nửa sau tự lực — cần tích phúc sớm.'],
    78: ['Giữa Đời Chuyển Suy', 0, 'Thông minh thành công sớm nhưng trung vận dễ chững — cần làm mới mình.'],
    79: ['Tinh Thần Bạc Nhược', -1, 'Thiếu khí lực về cuối, dễ buông xuôi — cần bạn đồng hành tiếp sức.'],
    80: ['Cả Đời Sóng Gió', -1, 'Trắc trở triền miên — người xưa khuyên nên sống thiện, tu tâm để hóa giải.'],
    81: ['Hoàn Nguyên Thái Cực', 2, 'Trở về khởi nguyên — vượng khí như số 1, phúc lộc thọ toàn vẹn.']
  };

  const RATING_LABEL = { 2: 'Đại Cát', 1: 'Cát', 0: 'Bình', '-1': 'Hung', '-2': 'Đại Hung' };

  // Cặp số dân gian
  const GOOD_PAIRS = {
    '39': 'Thần Tài nhỏ', '79': 'Thần Tài lớn', '38': 'Ông Địa nhỏ', '78': 'Ông Địa lớn',
    '68': 'Lộc Phát', '86': 'Phát Lộc', '66': 'Song Lộc', '88': 'Song Phát',
    '99': 'Trường Trường Cửu', '89': 'Phát Cửu'
  };
  const BAD_PAIRS = { '49': 'Hạn 49', '53': 'Hạn 53' };

  // Ngũ hành theo Hà Đồ: 1-6 Thủy, 2-7 Hỏa, 3-8 Mộc, 4-9 Kim, 5-0 Thổ
  const DIGIT_HANH = { 1: 'Thủy', 6: 'Thủy', 2: 'Hỏa', 7: 'Hỏa', 3: 'Mộc', 8: 'Mộc', 4: 'Kim', 9: 'Kim', 5: 'Thổ', 0: 'Thổ' };
  const SINH = { 'Kim': 'Thủy', 'Thủy': 'Mộc', 'Mộc': 'Hỏa', 'Hỏa': 'Thổ', 'Thổ': 'Kim' };
  const KHAC = { 'Kim': 'Mộc', 'Mộc': 'Thổ', 'Thổ': 'Thủy', 'Thủy': 'Hỏa', 'Hỏa': 'Kim' };
  const HANH_COLOR = { 'Kim': '#94a3b8', 'Thủy': '#2563eb', 'Mộc': '#0d9668', 'Hỏa': '#dc2626', 'Thổ': '#b45309' };

  // Mệnh nạp âm theo năm sinh (công thức chuẩn Can + Chi)
  function menhNapAm(year) {
    const can = ((year - 4) % 10 + 10) % 10;
    const chi = ((year - 4) % 12 + 12) % 12;
    const x = Math.floor(can / 2) + 1;              // Giáp/Ất=1 … Nhâm/Quý=5
    const y = [0, 0, 1, 1, 2, 2][chi % 6];          // Tý Sửu=0, Dần Mão=1, Thìn Tỵ=2 (lặp)
    let z = x + y;
    if (z > 5) z -= 5;
    return ['', 'Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'][z];
  }

  // ==================== PHÂN TÍCH ====================
  function analyze(phone, birthYear) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 11) return null;

    // 1. Linh số Kinh Dịch: 4 số cuối mod 80 (0 → 80)
    const last4 = parseInt(digits.slice(-4));
    let lsNum = last4 % 80;
    if (lsNum === 0) lsNum = 80;
    const ls = LINH_SO[lsNum];
    const lsScore = { 2: 3, 1: 2.25, 0: 1.5, '-1': 0.75, '-2': 0 }[ls[1]];

    // 2. Cân bằng âm dương (chẵn = âm, lẻ = dương)
    const digitArr = digits.split('').map(Number);
    const duong = digitArr.filter(d => d % 2 === 1).length;
    const am = digitArr.length - duong;
    const ratio = Math.min(duong, am);
    const half = digitArr.length / 2;
    let adScore;
    if (ratio >= Math.floor(half)) adScore = 2;
    else if (ratio >= half - 1) adScore = 1.5;
    else if (ratio >= half - 2) adScore = 1;
    else adScore = 0.5;

    // 3. Tổng nút
    const total = digitArr.reduce((s, d) => s + d, 0);
    const nut = total % 10;
    const nutScore = { 9: 2, 8: 1.5, 7: 1.25, 6: 1, 0: 0.25 }[nut] !== undefined
      ? { 9: 2, 8: 1.5, 7: 1.25, 6: 1, 0: 0.25 }[nut] : 0.75;

    // 4. Ngũ hành sim (số cuối) vs mệnh chủ
    const simHanh = DIGIT_HANH[digitArr[digitArr.length - 1]];
    let hanhScore = 1, hanhText = '', menhHanh = null;
    if (birthYear) {
      menhHanh = menhNapAm(birthYear);
      if (SINH[simHanh] === menhHanh) { hanhScore = 2; hanhText = `Sim ${simHanh} SINH mệnh ${menhHanh} — đại cát, sim nuôi dưỡng bản mệnh.`; }
      else if (simHanh === menhHanh) { hanhScore = 1.75; hanhText = `Sim ${simHanh} cùng hành mệnh ${menhHanh} — tương trợ, thêm vững vàng.`; }
      else if (SINH[menhHanh] === simHanh) { hanhScore = 1; hanhText = `Mệnh ${menhHanh} sinh sim ${simHanh} — bạn phải "nuôi" sim, hao khí nhẹ.`; }
      else if (KHAC[menhHanh] === simHanh) { hanhScore = 0.75; hanhText = `Mệnh ${menhHanh} khắc sim ${simHanh} — bạn chế ngự được sim, tạm dùng.`; }
      else { hanhScore = 0; hanhText = `Sim ${simHanh} KHẮC mệnh ${menhHanh} — nên cân nhắc đổi số đuôi.`; }
    } else {
      hanhText = `Số cuối thuộc hành ${simHanh}. Nhập năm sinh để xét sinh khắc với bản mệnh.`;
    }

    // 5. Cặp số dân gian
    const goodPairs = [], badPairs = [];
    for (let i = 0; i < digits.length - 1; i++) {
      const pair = digits.slice(i, i + 2);
      if (GOOD_PAIRS[pair] && !goodPairs.find(p => p.pair === pair)) goodPairs.push({ pair, name: GOOD_PAIRS[pair], idx: i });
      if (BAD_PAIRS[pair] && !badPairs.find(p => p.pair === pair)) badPairs.push({ pair, name: BAD_PAIRS[pair], idx: i });
    }
    const pairScore = Math.max(-0.5, Math.min(1, goodPairs.length * 0.5 - badPairs.length * 0.5));

    let score = lsScore + adScore + nutScore + hanhScore + pairScore;
    score = Math.max(0.5, Math.min(10, Math.round(score * 10) / 10));

    return {
      digits, lsNum, ls, lsScore, duong, am, adScore, total, nut, nutScore,
      simHanh, menhHanh, hanhScore, hanhText, goodPairs, badPairs, score
    };
  }

  // ==================== UI ====================
  const P = window.LatbaiProfile || null;
  const form = document.getElementById('sim-form');
  const phoneInput = document.getElementById('sim-phone');
  const yearSelect = document.getElementById('sim-year');
  const resultEl = document.getElementById('sim-result');

  // năm sinh dropdown + prefill từ hồ sơ
  const nowY = new Date().getFullYear();
  for (let y = nowY; y >= 1930; y--) {
    yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  }
  if (P) {
    const p = P.get();
    if (p && p.year) yearSelect.value = String(p.year);
  }

  function hanhChip(h) {
    return `<b style="color:${HANH_COLOR[h]}">${h}</b>`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = analyze(phoneInput.value, parseInt(yearSelect.value) || null);
    if (!r) {
      alert('Vui lòng nhập số điện thoại hợp lệ (9–11 chữ số).');
      phoneInput.focus();
      return;
    }

    // dãy số: tô màu ngũ hành từng số + gạch chân cặp đẹp/xấu
    const marks = new Array(r.digits.length).fill(null);
    r.goodPairs.forEach(p => { marks[p.idx] = 'g'; marks[p.idx + 1] = 'g'; });
    r.badPairs.forEach(p => { marks[p.idx] = 'b'; marks[p.idx + 1] = 'b'; });
    const digitsHTML = r.digits.split('').map((d, i) =>
      `<span class="sim-digit${marks[i] === 'g' ? ' dg' : marks[i] === 'b' ? ' db' : ''}" style="--di:${i};color:${HANH_COLOR[DIGIT_HANH[parseInt(d)]]}">${d}</span>`
    ).join('');

    const ratingCls = r.ls[1] >= 1 ? 'sr-good' : r.ls[1] === 0 ? 'sr-mid' : 'sr-bad';

    resultEl.innerHTML = `
      <div class="sim-card sim-scorecard">
        <div class="sim-digits">${digitsHTML}</div>
        <div class="sim-score-wrap">
          <span class="sim-score" id="sim-score-val">0</span>
          <span class="sim-score-max">/10</span>
        </div>
        <p class="sim-verdict">${r.score >= 8 ? 'Số rất đẹp — giữ chặt nhé!' : r.score >= 6.5 ? 'Số khá tốt, dùng ổn định.' : r.score >= 5 ? 'Số trung bình — không xấu nhưng chưa vượng.' : 'Số chưa hợp — cân nhắc đổi nếu tin phong thủy.'}</p>
      </div>

      <div class="sim-card">
        <div class="sim-sec-head"><i class="ti ti-yin-yang"></i> Quẻ Linh Số <span class="sim-badge ${ratingCls}">${RATING_LABEL[r.ls[1]]}</span></div>
        <p class="sim-quename">Số ${r.lsNum} — ${r.ls[0]}</p>
        <p class="sim-desc">${r.ls[2]}</p>
        <p class="sim-note">4 số cuối ${r.digits.slice(-4)} chia 80 dư ${r.lsNum === 80 ? '0 (tính là 80)' : r.lsNum} → tra bảng 81 linh số Kinh Dịch.</p>
      </div>

      <div class="sim-grid2">
        <div class="sim-card">
          <div class="sim-sec-head"><i class="ti ti-scale"></i> Âm Dương</div>
          <div class="sim-ad-bar"><span class="sim-ad-duong" style="width:${(r.duong / r.digits.length) * 100}%"></span></div>
          <p class="sim-desc"><b>${r.duong}</b> dương (lẻ) · <b>${r.am}</b> âm (chẵn) — ${r.adScore >= 2 ? 'cân bằng hoàn hảo' : r.adScore >= 1.5 ? 'khá cân bằng' : 'lệch, năng lượng thiên một phía'}.</p>
        </div>
        <div class="sim-card">
          <div class="sim-sec-head"><i class="ti ti-sum"></i> Tổng Nút</div>
          <p class="sim-quename">${r.total} → ${r.nut} nút</p>
          <p class="sim-desc">${r.nut >= 8 ? 'Nút cao — dân gian rất chuộng.' : r.nut >= 6 ? 'Nút khá.' : 'Nút thấp — bù lại bằng quẻ và ngũ hành.'}</p>
        </div>
      </div>

      <div class="sim-card">
        <div class="sim-sec-head"><i class="ti ti-flame"></i> Ngũ Hành ${r.menhHanh ? `— mệnh ${hanhChip(r.menhHanh)}` : ''}</div>
        <p class="sim-desc">${r.hanhText.replace(r.simHanh, hanhChip(r.simHanh))}</p>
      </div>

      ${(r.goodPairs.length || r.badPairs.length) ? `
      <div class="sim-card">
        <div class="sim-sec-head"><i class="ti ti-star"></i> Cặp Số Dân Gian</div>
        <div class="sim-pairs">
          ${r.goodPairs.map(p => `<span class="sim-pair pg">${p.pair} · ${p.name}</span>`).join('')}
          ${r.badPairs.map(p => `<span class="sim-pair pb">${p.pair} · ${p.name}</span>`).join('')}
        </div>
      </div>` : ''}

      <p class="sim-disclaimer">Kết quả mang tính tham khảo & giải trí theo quan niệm dân gian — giá trị của bạn không nằm ở dãy số.</p>
    `;

    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // điểm đếm lên
    const scoreEl = document.getElementById('sim-score-val');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const start = performance.now();
      (function tick(now) {
        const t = Math.min(1, (now - start) / 900);
        const eased = 1 - Math.pow(1 - t, 3);
        scoreEl.textContent = (r.score * eased).toFixed(1);
        if (t < 1) requestAnimationFrame(tick);
        else scoreEl.textContent = r.score.toFixed(1);
      })(start);
    } else {
      scoreEl.textContent = r.score.toFixed(1);
    }
  });
})();
