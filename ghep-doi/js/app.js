/**
 * ghep-doi/js/app.js — Ghép Đôi Thần Số: chấm độ hợp 2 người theo 4 lớp
 * (số chủ đạo, con giáp, ngũ hành nạp âm, số linh hồn) + share card canvas.
 * Cần profile.js (tùy chọn — tự điền người A).
 */
(function () {
  'use strict';

  // vẽ tim bằng path canvas — tránh phụ thuộc glyph font ('❤' bị iOS ép
  // thành emoji màu trên canvas, bỏ qua ctx.fillStyle).
  function drawHeart(ctx, cx, cy, size) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.3);
    ctx.bezierCurveTo(cx, cy - size * 0.1, cx - size * 0.5, cy - size * 0.5, cx - size * 0.5, cy - size * 0.1);
    ctx.bezierCurveTo(cx - size * 0.5, cy + size * 0.25, cx - size * 0.15, cy + size * 0.5, cx, cy + size * 0.7);
    ctx.bezierCurveTo(cx + size * 0.15, cy + size * 0.5, cx + size * 0.5, cy + size * 0.25, cx + size * 0.5, cy - size * 0.1);
    ctx.bezierCurveTo(cx + size * 0.5, cy - size * 0.5, cx, cy - size * 0.1, cx, cy + size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ==================== THẦN SỐ CƠ BẢN ====================
  function stripAccents(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
  }
  const PYTHAGOREAN = {
    A: 1, J: 1, S: 1, B: 2, K: 2, T: 2, C: 3, L: 3, U: 3, D: 4, M: 4, V: 4,
    E: 5, N: 5, W: 5, F: 6, O: 6, X: 6, G: 7, P: 7, Y: 7, H: 8, Q: 8, Z: 8, I: 9, R: 9
  };
  const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

  function reduce1(num) {
    while (num > 9) num = num.toString().split('').reduce((s, d) => s + parseInt(d), 0);
    return num;
  }
  function lifePathBase(d, m, y) {
    return reduce1(`${d}${m}${y}`.replace(/\D/g, '').split('').reduce((s, c) => s + parseInt(c), 0));
  }
  function soulNumber(name) {
    const clean = stripAccents(name).replace(/[^A-Z]/g, '');
    let sum = 0;
    for (const ch of clean) if (VOWELS.has(ch)) sum += PYTHAGOREAN[ch] || 0;
    return reduce1(sum || 1);
  }

  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  const GIAP = ['Chuột', 'Trâu', 'Hổ', 'Mèo', 'Rồng', 'Rắn', 'Ngựa', 'Dê', 'Khỉ', 'Gà', 'Chó', 'Lợn'];
  const chiOfYear = (y) => ((y - 4) % 12 + 12) % 12;

  // Mệnh nạp âm (công thức Can Chi chuẩn)
  function menhNapAm(year) {
    const can = ((year - 4) % 10 + 10) % 10;
    const chi = ((year - 4) % 12 + 12) % 12;
    let z = Math.floor(can / 2) + 1 + [0, 0, 1, 1, 2, 2][chi % 6];
    if (z > 5) z -= 5;
    return ['', 'Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'][z];
  }
  const SINH = { 'Kim': 'Thủy', 'Thủy': 'Mộc', 'Mộc': 'Hỏa', 'Hỏa': 'Thổ', 'Thổ': 'Kim' };

  // ==================== 4 LỚP CHẤM ĐIỂM ====================
  const TRIO = { 1: 0, 5: 0, 7: 0, 2: 1, 4: 1, 8: 1, 3: 2, 6: 2, 9: 2 }; // nhóm tư duy / thực tế / sáng tạo
  const LP_GREAT = { '2-8': 92, '3-9': 91, '1-5': 90, '6-9': 90, '2-6': 89, '4-8': 89, '5-7': 87, '1-7': 86, '3-6': 86 };
  const LP_HARD = { '1-8': 55, '4-5': 52, '1-4': 54, '5-6': 56, '7-8': 53, '3-4': 57 };

  function scoreLifePath(a, b) {
    const key = a <= b ? `${a}-${b}` : `${b}-${a}`;
    if (LP_GREAT[key]) return LP_GREAT[key];
    if (LP_HARD[key]) return LP_HARD[key];
    if (a === b) return 84;
    if (TRIO[a] === TRIO[b]) return 82;
    const pair = [TRIO[a], TRIO[b]].sort().join('');
    return { '02': 76, '12': 72, '01': 64 }[pair] || 68;
  }
  function lpText(score, a, b) {
    if (score >= 86) return `Số chủ đạo ${a} và ${b} là cặp năng lượng bổ trợ hiếm có — người này mạnh đúng chỗ người kia cần, càng ở lâu càng nể nhau.`;
    if (score >= 80) return `Số ${a} và ${b} cùng "tần số" tư duy — dễ hiểu ý nhau, ít phải giải thích, nhưng cũng dễ giống nhau cả điểm mù.`;
    if (score >= 65) return `Số ${a} và ${b} nhìn cuộc sống bằng hai lăng kính khác nhau — thú vị khi hẹn hò, cần kiên nhẫn khi về chung nhà.`;
    return `Số ${a} và ${b} là cặp "lửa gặp nước" — hoặc rất cuốn hoặc rất mệt. Chìa khóa: tôn trọng nhịp sống của nhau thay vì đòi thay đổi.`;
  }

  const TAM_HOP = [[8, 0, 4], [2, 6, 10], [11, 3, 7], [5, 9, 1]]; // Thân Tý Thìn / Dần Ngọ Tuất / Hợi Mão Mùi / Tỵ Dậu Sửu
  const LUC_HOP = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
  const LUC_HAI = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };

  function scoreGiap(ca, cb) {
    if (TAM_HOP.some(g => g.includes(ca) && g.includes(cb)) && ca !== cb) return 92;
    if (LUC_HOP[ca] === cb) return 88;
    if ((ca + 6) % 12 === cb) return 42; // lục xung
    if (LUC_HAI[ca] === cb) return 52;   // lục hại
    if (ca === cb) return 72;
    return 66;
  }
  function giapText(score, ca, cb) {
    const A = `${CHI[ca]} (${GIAP[ca]})`, B = `${CHI[cb]} (${GIAP[cb]})`;
    if (score >= 92) return `Tuổi ${A} và ${B} nằm trong thế Tam Hợp — quý nhân của nhau, làm gì cùng nhau cũng thuận, cưới hỏi làm ăn đều đẹp.`;
    if (score >= 88) return `Tuổi ${A} và ${B} thuộc Lục Hợp — âm thầm hỗ trợ nhau, kiểu tình cảm càng lâu càng đậm.`;
    if (score >= 66) return `Tuổi ${A} và ${B} không xung không hợp đặc biệt — độ bền của mối quan hệ nằm ở cách hai bạn cư xử, không phải con giáp.`;
    if (score >= 52) return `Tuổi ${A} và ${B} phạm Lục Hại nhẹ — dễ hiểu lầm vặt; nói thẳng nói thật với nhau là hóa giải được.`;
    return `Tuổi ${A} và ${B} phạm Lục Xung — cá tính đối đầu trực diện. Người xưa kiêng, nhưng thực tế nhiều cặp xung tuổi vẫn bền nhờ biết nhường đúng lúc.`;
  }

  function scoreHanh(ha, hb) {
    if (SINH[ha] === hb || SINH[hb] === ha) return 88;
    if (ha === hb) return 76;
    return 46; // còn lại là khắc (1 trong 2 chiều)
  }
  function hanhText(score, ha, hb, nameA, nameB) {
    if (score >= 88) {
      const giver = SINH[ha] === hb ? nameA : nameB;
      const taker = SINH[ha] === hb ? nameB : nameA;
      return `Mệnh ${ha} và ${hb} tương sinh — ${giver} là "đất lành" nuôi dưỡng ${taker}; ở cạnh nhau tự nhiên thấy đời dễ thở hơn.`;
    }
    if (score >= 76) return `Hai bạn cùng mệnh ${ha} — đồng điệu về nhịp sống, nhưng nhớ đừng cùng... cứng đầu một lúc.`;
    return `Mệnh ${ha} và ${hb} tương khắc — khác biệt sâu về cách phản ứng với cuộc sống. Khắc không phải án tử: hiểu luật chơi của nhau là chuyển khắc thành rèn.`;
  }

  function scoreSoul(sa, sb) {
    if (sa === sb) return 90;
    if (TRIO[sa] === TRIO[sb]) return 80;
    return 68;
  }
  function soulText(score, sa, sb) {
    if (score >= 90) return `Hai số linh hồn cùng là ${sa} — khao khát sâu kín giống hệt nhau, kiểu "nhìn nhau là hiểu".`;
    if (score >= 80) return `Số linh hồn ${sa} và ${sb} cùng một nhóm khát vọng — mong muốn bên trong khá đồng điệu.`;
    return `Số linh hồn ${sa} và ${sb} khao khát những điều khác nhau — hãy hỏi "em/anh thực sự muốn gì?" thường xuyên hơn.`;
  }

  function analyze(a, b) {
    const lpA = lifePathBase(a.d, a.m, a.y), lpB = lifePathBase(b.d, b.m, b.y);
    const chiA = chiOfYear(a.y), chiB = chiOfYear(b.y);
    const hA = menhNapAm(a.y), hB = menhNapAm(b.y);
    const sA = soulNumber(a.name), sB = soulNumber(b.name);

    const parts = [
      { key: 'lp',   icon: 'ti-hash',      label: 'Số Chủ Đạo',  vals: `${lpA} · ${lpB}`, score: scoreLifePath(lpA, lpB), text: lpText(scoreLifePath(lpA, lpB), lpA, lpB), w: 0.35 },
      { key: 'giap', icon: 'ti-paw',       label: 'Con Giáp',    vals: `${GIAP[chiA]} · ${GIAP[chiB]}`, score: scoreGiap(chiA, chiB), text: giapText(scoreGiap(chiA, chiB), chiA, chiB), w: 0.25 },
      { key: 'hanh', icon: 'ti-flame',     label: 'Ngũ Hành',    vals: `${hA} · ${hB}`, score: scoreHanh(hA, hB), text: hanhText(scoreHanh(hA, hB), hA, hB, firstName(a.name), firstName(b.name)), w: 0.25 },
      { key: 'soul', icon: 'ti-heartbeat', label: 'Số Linh Hồn', vals: `${sA} · ${sB}`, score: scoreSoul(sA, sB), text: soulText(scoreSoul(sA, sB), sA, sB), w: 0.15 }
    ];
    const total = Math.round(parts.reduce((s, p) => s + p.score * p.w, 0));
    let level, levelIcon;
    if (total >= 85)      { level = 'Trời sinh một cặp';        levelIcon = '💍'; }
    else if (total >= 75) { level = 'Rất hợp nhau';             levelIcon = '💘'; }
    else if (total >= 65) { level = 'Hợp — cần vun đắp';        levelIcon = '💕'; }
    else if (total >= 55) { level = 'Bù trừ cho nhau';          levelIcon = '🌗'; }
    else                  { level = 'Yêu là vượt thử thách';    levelIcon = '🔥'; }
    return { parts, total, level, levelIcon };
  }

  const firstName = (full) => full.trim().split(/\s+/).pop();

  // ==================== FORM ====================
  const P = window.LatbaiProfile || null;
  const form = document.getElementById('gd-form');
  const resultEl = document.getElementById('gd-result');
  let lastResult = null, lastNames = null;

  function fillSelects(prefix) {
    const d = document.getElementById(`${prefix}-day`);
    const m = document.getElementById(`${prefix}-month`);
    const y = document.getElementById(`${prefix}-year`);
    for (let i = 1; i <= 31; i++) d.innerHTML += `<option value="${i}">${i}</option>`;
    for (let i = 1; i <= 12; i++) m.innerHTML += `<option value="${i}">${i}</option>`;
    const nowY = new Date().getFullYear();
    for (let i = nowY; i >= 1940; i--) y.innerHTML += `<option value="${i}">${i}</option>`;
  }
  fillSelects('a');
  fillSelects('b');

  if (P) {
    const p = P.get();
    if (p) {
      document.getElementById('a-name').value = p.name;
      document.getElementById('a-day').value = String(p.day);
      document.getElementById('a-month').value = String(p.month);
      document.getElementById('a-year').value = String(p.year);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const a = {
      name: document.getElementById('a-name').value.trim(),
      d: parseInt(document.getElementById('a-day').value),
      m: parseInt(document.getElementById('a-month').value),
      y: parseInt(document.getElementById('a-year').value)
    };
    const b = {
      name: document.getElementById('b-name').value.trim(),
      d: parseInt(document.getElementById('b-day').value),
      m: parseInt(document.getElementById('b-month').value),
      y: parseInt(document.getElementById('b-year').value)
    };
    if (!a.name || !b.name || !a.d || !b.d || !a.y || !b.y || !a.m || !b.m) return;

    const r = analyze(a, b);
    lastResult = r;
    lastNames = { a: a.name, b: b.name };
    render(r, a, b);
  });

  function render(r, a, b) {
    const esc = window.LatbaiProfile.esc;
    resultEl.innerHTML = `
      <div class="gd-card gd-scorecard">
        <div class="gd-names"><span>${esc(a.name)}</span><span class="gd-amp">❤︎</span><span>${esc(b.name)}</span></div>
        <div class="gd-total"><span id="gd-total-val">0</span><span class="gd-pct">%</span></div>
        <p class="gd-level">${r.levelIcon} ${r.level}</p>
      </div>
      ${r.parts.map((p, i) => `
        <div class="gd-card gd-part" style="--gi:${i}">
          <div class="gd-part-head">
            <span class="gd-part-label"><i class="ti ${p.icon}"></i> ${p.label} <b>${p.vals}</b></span>
            <span class="gd-part-score">${p.score}%</span>
          </div>
          <div class="gd-bar"><span style="width:0%" data-w="${p.score}"></span></div>
          <p class="gd-part-text">${p.text}</p>
        </div>`).join('')}
      <div class="gd-actions">
        <button type="button" id="gd-share" class="gd-btn-main"><i class="ti ti-share"></i> Chia sẻ kết quả</button>
        <button type="button" id="gd-download" class="gd-btn-sub"><i class="ti ti-download"></i> Tải ảnh</button>
      </div>
      <p class="gd-disclaimer">Kết quả mang tính tham khảo & giải trí — tình yêu thật được xây bằng lắng nghe, không phải con số.</p>
    `;
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const totalEl = document.getElementById('gd-total-val');
    if (reduced) {
      totalEl.textContent = r.total;
    } else {
      const start = performance.now();
      (function tick(now) {
        const t = Math.min(1, (now - start) / 1200);
        totalEl.textContent = Math.round(r.total * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    }
    requestAnimationFrame(() => {
      resultEl.querySelectorAll('.gd-bar span').forEach(bar => {
        bar.style.width = bar.dataset.w + '%';
      });
    });

    document.getElementById('gd-share').addEventListener('click', () => shareCard(true));
    document.getElementById('gd-download').addEventListener('click', () => shareCard(false));
  }

  // ==================== SHARE CARD (canvas 1080×1350) ====================
  async function shareCard(wantShare) {
    if (!lastResult || !lastNames) return;
    await document.fonts.ready;

    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // nền kem + viền vàng kép
    ctx.fillStyle = '#fbf3e4';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, 0, 100, W / 2, 0, 900);
    grad.addColorStop(0, 'rgba(244, 114, 182, 0.14)');
    grad.addColorStop(1, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(217, 138, 10, 0.75)';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    const F = (size, weight = 800) => `${weight} ${size}px 'Be Vietnam Pro', sans-serif`;
    ctx.textAlign = 'center';

    ctx.fillStyle = '#a7887a';
    ctx.font = F(30, 800);
    ctx.fillText('GHÉP ĐÔI THẦN SỐ · LATBAI.VN', W / 2, 118);

    // tên 2 người
    ctx.fillStyle = '#2b1408';
    ctx.font = F(52, 900);
    const nameA = lastNames.a.length > 22 ? lastNames.a.slice(0, 21) + '…' : lastNames.a;
    const nameB = lastNames.b.length > 22 ? lastNames.b.slice(0, 21) + '…' : lastNames.b;
    ctx.fillText(nameA, W / 2, 212);
    // vẽ tim bằng path thay vì glyph font — iOS ép '❤' thành emoji màu
    // trên canvas và bỏ qua fillStyle (glyph còn có nguy cơ méo giữa font)
    ctx.fillStyle = '#e11d48';
    drawHeart(ctx, W / 2, 278, 26);
    ctx.fillStyle = '#2b1408';
    ctx.font = F(52, 900);
    ctx.fillText(nameB, W / 2, 348);

    // % lớn
    ctx.fillStyle = '#e11d48';
    ctx.font = F(230, 900);
    ctx.fillText(`${lastResult.total}%`, W / 2, 600);
    ctx.fillStyle = '#6b4030';
    ctx.font = F(44, 800);
    ctx.fillText(`${lastResult.levelIcon} ${lastResult.level}`, W / 2, 678);

    // 4 thanh chi tiết
    let yPos = 780;
    ctx.textAlign = 'left';
    lastResult.parts.forEach(p => {
      ctx.fillStyle = '#6b4030';
      ctx.font = F(30, 700);
      ctx.fillText(`${p.label}  ·  ${p.vals}`, 120, yPos);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e11d48';
      ctx.font = F(30, 800);
      ctx.fillText(`${p.score}%`, W - 120, yPos);
      ctx.textAlign = 'left';
      // track + fill
      ctx.fillStyle = 'rgba(160, 80, 70, 0.14)';
      roundRect(ctx, 120, yPos + 18, W - 240, 22, 11);
      ctx.fill();
      const fillGrad = ctx.createLinearGradient(120, 0, W - 120, 0);
      fillGrad.addColorStop(0, '#fb7185');
      fillGrad.addColorStop(1, '#e11d48');
      ctx.fillStyle = fillGrad;
      roundRect(ctx, 120, yPos + 18, (W - 240) * p.score / 100, 22, 11);
      ctx.fill();
      yPos += 108;
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7887a';
    ctx.font = F(28, 600);
    ctx.fillText('Xem độ hợp đôi của bạn tại  latbai.vn/ghep-doi', W / 2, H - 92);

    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const fileName = `ghep-doi-${lastResult.total}.png`;

    if (wantShare && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
      try {
        await navigator.share({
          files: [new File([blob], fileName, { type: 'image/png' })],
          title: 'Ghép Đôi Thần Số',
          text: `${lastNames.a} ❤ ${lastNames.b} — hợp nhau ${lastResult.total}%! Thử ngay tại latbai.vn/ghep-doi`
        });
        return;
      } catch (_) { /* người dùng hủy → rơi xuống tải ảnh */ }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
})();
