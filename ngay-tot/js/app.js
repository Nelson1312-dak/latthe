/**
 * ngay-tot/js/app.js — Xem Ngày Tốt: chấm điểm ngày theo loại việc,
 * lịch tháng tương tác, chi tiết ngày (trực, hoàng đạo, giờ tốt, xung tuổi).
 * Cần amlich.js (AmLich) + profile.js (LatbaiProfile, tùy chọn).
 */
(function () {
  'use strict';

  const A = window.AmLich;
  if (!A) return;

  // ==================== DỮ LIỆU LUẬN GIẢI ====================
  const EVENTS = {
    cuoi:       { icon: 'ti-heart',        label: 'Cưới hỏi' },
    khaitruong: { icon: 'ti-building-store', label: 'Khai trương' },
    dongtho:    { icon: 'ti-shovel',       label: 'Động thổ' },
    nhaptrach:  { icon: 'ti-home-move',    label: 'Về nhà mới' },
    xuathanh:   { icon: 'ti-plane-departure', label: 'Xuất hành' },
    kyhopdong:  { icon: 'ti-signature',    label: 'Ký kết' },
    muasam:     { icon: 'ti-car',          label: 'Mua sắm lớn' },
    cautai:     { icon: 'ti-coins',        label: 'Cầu tài lộc' }
  };

  // Trực → việc hợp / kỵ (theo thông lệ lịch vạn niên)
  const TRUC_INFO = {
    'Kiến': { good: ['xuathanh', 'kyhopdong', 'cautai'], bad: ['dongtho'],
      desc: 'Trực Kiến — khí mới khởi dựng: tốt cho khởi sự, ra mắt, xuất hành; kỵ động thổ.' },
    'Trừ':  { good: ['xuathanh'], bad: ['cuoi', 'khaitruong'],
      desc: 'Trực Trừ — trừ bỏ cái cũ: hợp dọn dẹp, chữa bệnh, giải quyết tồn đọng; kỵ khởi sự lớn.' },
    'Mãn':  { good: ['cautai', 'muasam', 'khaitruong'], bad: ['cuoi'],
      desc: 'Trực Mãn — đầy đủ sung túc: tốt cho cầu tài, thu nạp, mở kho; hôn sự nên tránh.' },
    'Bình': { good: ['cuoi', 'xuathanh', 'kyhopdong'], bad: [],
      desc: 'Trực Bình — bằng phẳng êm hòa: mọi việc giao tiếp, hòa giải, cưới gả đều thuận.' },
    'Định': { good: ['cuoi', 'kyhopdong', 'nhaptrach', 'muasam'], bad: ['xuathanh'],
      desc: 'Trực Định — ổn định vững vàng: đại lợi cho cưới hỏi, ký kết, an cư; kỵ di chuyển xa.' },
    'Chấp': { good: ['dongtho'], bad: ['xuathanh', 'khaitruong', 'cautai'],
      desc: 'Trực Chấp — nắm giữ chắc chắn: hợp xây sửa, tu tạo; kỵ khai trương, xuất hành.' },
    'Phá':  { good: [], bad: ['cuoi', 'khaitruong', 'dongtho', 'nhaptrach', 'kyhopdong', 'muasam', 'cautai'],
      desc: 'Trực Phá — phá vỡ đổ nát: chỉ hợp phá dỡ công trình cũ; đại kỵ mọi việc trọng đại.' },
    'Nguy': { good: [], bad: ['xuathanh', 'dongtho', 'muasam'],
      desc: 'Trực Nguy — nguy hiểm rình rập: nên tĩnh dưỡng, tránh mạo hiểm, đi xa, việc lớn.' },
    'Thành': { good: ['cuoi', 'khaitruong', 'nhaptrach', 'kyhopdong', 'cautai'], bad: [],
      desc: 'Trực Thành — thành tựu viên mãn: ngày đẹp bậc nhất cho cưới hỏi, khai trương, nhập trạch.' },
    'Thu':  { good: ['cautai', 'muasam'], bad: ['xuathanh'],
      desc: 'Trực Thu — thu hoạch tích trữ: tốt cho thu tiền, mua vào, cất trữ; kỵ xuất hành.' },
    'Khai': { good: ['khaitruong', 'cuoi', 'xuathanh', 'dongtho'], bad: [],
      desc: 'Trực Khai — khai mở hanh thông: đại lợi khai trương, động thổ, cưới gả, đi xa.' },
    'Bế':   { good: [], bad: ['khaitruong', 'xuathanh', 'nhaptrach'],
      desc: 'Trực Bế — bế tắc đóng kín: hợp đắp đê, lấp hố, kết thúc; kỵ mở cửa hàng, dọn nhà.' }
  };

  // Ngày âm kỵ chung
  const TAM_NUONG = new Set([3, 7, 13, 18, 22, 27]);
  const NGUYET_KY = new Set([5, 14, 23]);

  const P = window.LatbaiProfile || null;

  // ==================== CHẤM ĐIỂM NGÀY ====================
  function analyzeDay(dd, mm, yy, eventKey, profileChiIdx) {
    const lunar = A.solar2lunar(dd, mm, yy);
    const dc = A.dayCanChi(lunar.jdn);
    const trucName = A.TRUC[A.trucOfDay(dc.chi, lunar.month)];
    const truc = TRUC_INFO[trucName];
    const god = A.dayGod(dc.chi, lunar.month);

    let score = 0;
    const notes = [];

    if (god.good) { score += 3; }
    else { score -= 3; }

    if (truc.good.includes(eventKey)) { score += 2; notes.push(`Trực ${trucName} hợp việc này`); }
    if (truc.bad.includes(eventKey))  { score -= 2; notes.push(`Trực ${trucName} kỵ việc này`); }

    if (TAM_NUONG.has(lunar.day)) { score -= 2; notes.push(`Ngày Tam Nương (${lunar.day} âm) — kỵ khởi sự`); }
    if (NGUYET_KY.has(lunar.day)) { score -= 2; notes.push(`Ngày Nguyệt Kỵ (${lunar.day} âm) — "mùng năm, mười bốn, hai ba"`); }

    let xungTuoi = false;
    if (profileChiIdx !== null && profileChiIdx !== undefined) {
      if ((dc.chi + 6) % 12 === profileChiIdx) {
        xungTuoi = true;
        score -= 3;
        notes.push(`Ngày ${A.CHI[dc.chi]} xung tuổi ${A.CHI[profileChiIdx]} của bạn`);
      }
    }

    let rating; // 3 tốt, 2 khá, 1 bình, 0 xấu
    if (score >= 4) rating = 3;
    else if (score >= 2) rating = 2;
    else if (score > -2) rating = 1;
    else rating = 0;

    return { lunar, dc, trucName, truc, god, score, rating, notes, xungTuoi };
  }

  // ==================== STATE + DOM ====================
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth() + 1;
  let curEvent = 'cuoi';

  const chipsEl = document.getElementById('nt-events');
  const gridEl = document.getElementById('nt-grid');
  const monthLabel = document.getElementById('nt-month-label');
  const bestEl = document.getElementById('nt-best');
  const profileNote = document.getElementById('nt-profile-note');

  function profileChi() {
    if (!P) return null;
    const p = P.get();
    if (!p) return null;
    return P.canChi(p.year).chiIdx;
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    Object.entries(EVENTS).forEach(([key, ev]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nt-chip' + (key === curEvent ? ' active' : '');
      b.innerHTML = `<i class="ti ${ev.icon}"></i> ${ev.label}`;
      b.addEventListener('click', () => { curEvent = key; render(); });
      chipsEl.appendChild(b);
    });
  }

  const RATING_META = [
    { cls: 'r-bad',  label: 'Ngày xấu' },
    { cls: 'r-mid',  label: 'Bình thường' },
    { cls: 'r-ok',   label: 'Khá tốt' },
    { cls: 'r-good', label: 'Ngày tốt' }
  ];

  function render() {
    renderChips();
    const chiIdx = profileChi();

    if (profileNote) {
      profileNote.innerHTML = chiIdx !== null
        ? `<i class="ti ti-user-check"></i> Đang lọc theo tuổi <b>${A.CHI[chiIdx]}</b> từ Hồ Sơ Huyền Học của bạn — ngày xung tuổi bị trừ điểm.`
        : `<i class="ti ti-user-plus"></i> <a href="/">Tạo Hồ Sơ Huyền Học</a> ở trang chủ để lọc thêm ngày xung tuổi của riêng bạn.`;
    }

    monthLabel.textContent = `Tháng ${viewMonth}/${viewYear}`;

    const first = new Date(viewYear, viewMonth - 1, 1);
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const startCol = (first.getDay() + 6) % 7; // T2 = 0

    gridEl.innerHTML = '';
    ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].forEach(d => {
      const h = document.createElement('div');
      h.className = 'nt-dow';
      h.textContent = d;
      gridEl.appendChild(h);
    });
    for (let i = 0; i < startCol; i++) {
      gridEl.appendChild(document.createElement('div'));
    }

    const results = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const r = analyzeDay(d, viewMonth, viewYear, curEvent, chiIdx);
      results.push({ d, r });

      const cell = document.createElement('button');
      cell.type = 'button';
      const isToday = d === now.getDate() && viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear();
      cell.className = `nt-day ${RATING_META[r.rating].cls}${isToday ? ' nt-today' : ''}`;
      cell.innerHTML =
        `<span class="nt-solar">${d}</span>` +
        `<span class="nt-lunar">${r.lunar.day === 1 ? `${r.lunar.day}/${r.lunar.month}` : r.lunar.day}</span>` +
        `<span class="nt-dot" aria-hidden="true"></span>`;
      cell.title = `${RATING_META[r.rating].label} cho ${EVENTS[curEvent].label}`;
      cell.addEventListener('click', () => openDetail(d, r));
      gridEl.appendChild(cell);
    }

    // Top ngày tốt nhất tháng
    const best = results
      .filter(x => x.r.rating === 3 && x.r.score >= 4)
      .sort((a, b) => b.r.score - a.r.score)
      .slice(0, 3);
    bestEl.innerHTML = best.length
      ? `<span class="nt-best-label"><i class="ti ti-award"></i> Tốt nhất cho ${EVENTS[curEvent].label}:</span> ` +
        best.map(x =>
          `<button type="button" class="nt-best-day" data-d="${x.d}">${x.d}/${viewMonth} · ${x.r.dc.text}</button>`
        ).join('')
      : `<span class="nt-best-label"><i class="ti ti-info-circle"></i> Tháng này không có ngày thật sự đẹp cho ${EVENTS[curEvent].label} — xem tháng kế tiếp.</span>`;
    bestEl.querySelectorAll('.nt-best-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = parseInt(btn.dataset.d);
        openDetail(d, analyzeDay(d, viewMonth, viewYear, curEvent, chiIdx));
      });
    });
  }

  // ==================== SHEET CHI TIẾT NGÀY ====================
  const sheet = document.getElementById('nt-sheet');

  function openDetail(d, r) {
    const ev = EVENTS[curEvent];
    const mc = A.monthCanChi(r.lunar.month, r.lunar.year);
    const yc = A.yearCanChi(r.lunar.year);
    const goodList = r.truc.good.map(k => EVENTS[k].label).join(', ') || '—';
    const badList = r.truc.bad.map(k => EVENTS[k].label).join(', ') || '—';

    document.getElementById('nts-title').textContent = `${d}/${viewMonth}/${viewYear}`;
    document.getElementById('nts-rating').className = `nts-rating ${RATING_META[r.rating].cls}`;
    document.getElementById('nts-rating').textContent = `${RATING_META[r.rating].label} · ${ev.label}`;
    document.getElementById('nts-body').innerHTML = `
      <div class="nts-row"><span>Âm lịch</span><b>${r.lunar.day}/${r.lunar.month}${r.lunar.leap ? ' (nhuận)' : ''} năm ${yc.text}</b></div>
      <div class="nts-row"><span>Ngày</span><b>${r.dc.text}</b></div>
      <div class="nts-row"><span>Tháng</span><b>${mc.text}</b></div>
      <div class="nts-row"><span>Trực</span><b>${r.trucName}</b></div>
      <div class="nts-row"><span>Sao</span><b class="${r.god.good ? 'nts-good' : 'nts-bad'}">${r.god.name} (${r.god.good ? 'Hoàng đạo' : 'Hắc đạo'})</b></div>
      <p class="nts-desc">${r.truc.desc}</p>
      <div class="nts-block"><span class="nts-label">Hợp</span> ${goodList}</div>
      <div class="nts-block"><span class="nts-label nts-label-bad">Kỵ</span> ${badList}</div>
      ${r.notes.length ? `<div class="nts-notes">${r.notes.map(n => `<p><i class="ti ti-alert-triangle"></i> ${n}</p>`).join('')}</div>` : ''}
      <div class="nts-hours"><span class="nts-label">Giờ hoàng đạo</span>
        <div class="nts-hour-chips">${A.goodHoursOfDay(r.dc.chi).map(h => `<span>${h}</span>`).join('')}</div>
      </div>`;
    sheet.hidden = false;
  }

  sheet.querySelector('.nts-backdrop').addEventListener('click', () => { sheet.hidden = true; });
  sheet.querySelector('.nts-close').addEventListener('click', () => { sheet.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') sheet.hidden = true; });

  // ==================== ĐIỀU HƯỚNG THÁNG ====================
  document.getElementById('nt-prev').addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 1) { viewMonth = 12; viewYear--; }
    render();
  });
  document.getElementById('nt-next').addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 12) { viewMonth = 1; viewYear++; }
    render();
  });

  render();
})();
