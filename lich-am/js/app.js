/**
 * lich-am/js/app.js — Lịch Âm / Lịch Vạn Niên.
 * Cần: js/amlich.js (window.AmLich), lich-am/js/licham-data.js (LICHAM_DATA).
 * Tuỳ chọn: js/profile.js (LatbaiProfile) để cảnh báo ngày xung tuổi.
 */
(function () {
  'use strict';

  const A = window.AmLich;
  const D = window.LICHAM_DATA;
  if (!A || !D) return;                        // thiếu engine hoặc data thì thoát êm

  const P = window.LatbaiProfile || null;
  const DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const MIN_Y = 1900, MAX_Y = 2100;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dayPath = (d, m, y) => `/lich-am/ngay-${d}-${m}-${y}`;
  const tkBySlug = Object.fromEntries(D.TIET_KHI.map((t) => [t.i, t]));

  // scripts/build-licham-pages.mjs chỉ sinh trang cho cửa sổ MONTHS_AHEAD tháng kể
  // từ tháng hiện tại. Ngoài cửa sổ thì KHÔNG được hiện link, nếu không là 404.
  // Cố ý dè dặt: trang của các tháng đã qua vẫn nằm trên đĩa (generator quét lại đĩa)
  // nhưng client không biết chắc nên bỏ qua — thà thiếu link còn hơn link gãy.
  const MONTHS_AHEAD = 6;
  function hasDayPage(d, m, y) {
    const cur = T.y * 12 + (T.m - 1);
    const k = y * 12 + (m - 1);
    return k >= cur && k < cur + MONTHS_AHEAD;
  }

  // "Hôm nay" theo giờ VN, không phụ thuộc múi giờ máy người dùng.
  function todayVN() {
    const n = new Date(Date.now() + 7 * 3600e3);
    return { d: n.getUTCDate(), m: n.getUTCMonth() + 1, y: n.getUTCFullYear() };
  }
  const T = todayVN();

  let viewY = T.y, viewM = T.m;

  // Lễ rơi vào một ngày cụ thể (khớp cả lịch âm lẫn dương)
  function holidaysOn(info) {
    return D.LE_TET.filter((l) => l.lich === 'duong'
      ? (l.d === info.solar.day && l.m === info.solar.month)
      : (l.d === info.lunar.day && l.m === info.lunar.month && !info.lunar.leap));
  }

  // ==================== HÔM NAY ====================
  function renderToday() {
    const info = A.dayInfo(T.d, T.m, T.y);
    const tk = info.tietKhi;
    const tkData = tkBySlug[tk.index];
    const nextTk = tk.nextJdn ? A.jdToDate(tk.nextJdn) : null;
    const le = holidaysOn(info);

    $('la-today').innerHTML = `
      <div class="la-sec-head"><i class="ti ti-sun-moon"></i> Hôm nay</div>
      <div class="la-today-top">
        <div class="la-today-big">${T.d}</div>
        <div>
          <div class="la-today-dow">${DOW[info.weekday]}</div>
          <div class="la-today-md">${T.d}/${T.m}/${T.y}</div>
          <div class="la-today-lunar">Âm lịch <b>${info.lunar.day}/${info.lunar.month}${info.lunar.leap ? ' nhuận' : ''}</b> · năm <b>${info.yearCanChi.text}</b></div>
        </div>
      </div>
      <div class="la-rows">
        <div class="la-row"><span>Ngày</span><b>${info.dayCanChi.text}</b></div>
        <div class="la-row"><span>Tháng</span><b>${info.monthCanChi.text}</b></div>
        <div class="la-row"><span>Trực</span><b>${info.truc.name}</b></div>
        <div class="la-row"><span>Sao</span><b class="${info.god.good ? 'la-good' : 'la-bad'}">${info.god.name}</b></div>
        <div class="la-row"><span>Nạp âm</span><b>${info.napAm.name}</b></div>
        <div class="la-row"><span>Xung tuổi</span><b>${info.xungChi}</b></div>
      </div>
      <p class="la-tk-line">
        <i class="ti ti-sun" style="color:var(--gold)"></i>
        Đang trong tiết <a href="/lich-am/tiet-khi-${tkData.slug}"><b>${tkData.ten}</b></a>
        (ngày thứ ${tk.dayInTerm})${nextTk ? ` · tiết sau <b>${tk.nextName}</b> ngày ${nextTk.day}/${nextTk.month}` : ''}.
        ${esc(tkData.tomTat)}
      </p>
      ${le.length ? `<p class="la-tk-line"><i class="ti ti-confetti" style="color:var(--bad)"></i> Hôm nay là <b>${esc(le[0].ten)}</b>.</p>` : ''}
      <div class="la-hour-chips">${info.goodHours.map((h) => `<span class="la-hour-chip">${h}</span>`).join('')}</div>
      <a class="la-perma" href="${dayPath(T.d, T.m, T.y)}"><i class="ti ti-external-link"></i> Trang chi tiết ngày hôm nay</a>
    `;
  }

  // ==================== LỊCH THÁNG ====================
  function renderMonth() {
    $('la-month-label').textContent = `Tháng ${viewM}/${viewY}`;
    $('la-jump-m').value = String(viewM);
    $('la-jump-y').value = String(viewY);

    const first = new Date(Date.UTC(viewY, viewM - 1, 1));
    const startCol = (first.getUTCDay() + 6) % 7;                 // lịch bắt đầu từ Thứ Hai
    const days = new Date(Date.UTC(viewY, viewM, 0)).getUTCDate();
    const tkList = A.tietKhiOfYear(viewY);
    const tkByJdn = Object.fromEntries(tkList.map((t) => [t.jdn, t]));

    let html = '';
    for (let i = 0; i < startCol; i++) html += '<div class="la-cell-empty"></div>';
    for (let d = 1; d <= days; d++) {
      const info = A.dayInfo(d, viewM, viewY);
      const isToday = d === T.d && viewM === T.m && viewY === T.y;
      const isSun = info.weekday === 0;
      const isFirst = info.lunar.day === 1;
      const hasTk = !!tkByJdn[info.jdn];
      const hasLe = holidaysOn(info).length > 0;
      const cls = ['la-day'];
      if (isToday) cls.push('is-today');
      if (isSun) cls.push('is-sun');
      if (isFirst) cls.push('is-first');
      html += `<button type="button" class="${cls.join(' ')}" data-d="${d}" aria-label="Ngày ${d}/${viewM}/${viewY}">
        <span class="la-solar">${d}</span>
        <span class="la-lunar">${isFirst ? `${info.lunar.day}/${info.lunar.month}` : info.lunar.day}</span>
        <span class="la-marks">${hasTk ? '<i class="la-mark la-mark-tk"></i>' : ''}${hasLe ? '<i class="la-mark la-mark-le"></i>' : ''}</span>
      </button>`;
    }
    $('la-grid').innerHTML = html;
    $('la-grid').querySelectorAll('.la-day').forEach((b) => {
      b.addEventListener('click', () => openSheet(parseInt(b.dataset.d, 10), viewM, viewY));
    });

    renderTietKhiStrip();
    renderHolidays();
  }

  function renderTietKhiStrip() {
    const list = A.tietKhiOfYear(viewY);
    const todayJdn = A.jdFromDate(T.d, T.m, T.y);
    const cur = A.tietKhiOfDay(todayJdn);
    $('la-tk-year').textContent = `năm ${viewY}`;
    $('la-tk-strip').innerHTML = list.map((t) => {
      const data = tkBySlug[t.index];
      const isNow = viewY === T.y && t.index === cur.index;
      return `<a class="la-tk-chip${isNow ? ' is-now' : ''}" href="/lich-am/tiet-khi-${data.slug}">${t.name} <span>${t.day}/${t.month}</span></a>`;
    }).join('');
  }

  function renderHolidays() {
    const days = new Date(Date.UTC(viewY, viewM, 0)).getUTCDate();
    const rows = [];
    for (let d = 1; d <= days; d++) {
      const info = A.dayInfo(d, viewM, viewY);
      for (const l of holidaysOn(info)) {
        rows.push(`<div class="la-le">
          <span class="la-le-date">${d}/${viewM}</span>
          <span><span class="la-le-name">${esc(l.ten)}</span>
          <span class="la-le-sub"> — ${l.lich === 'am' ? `${l.d}/${l.m} âm lịch` : 'dương lịch'}</span></span>
        </div>`);
      }
    }
    $('la-holidays').innerHTML = rows.length ? rows.join('')
      : '<p class="la-empty">Tháng này không có lễ tết lớn trong danh sách.</p>';
  }

  // ==================== SHEET CHI TIẾT ====================
  const sheet = $('la-sheet');
  function openSheet(d, m, y) {
    const info = A.dayInfo(d, m, y);
    const tk = info.tietKhi;
    const tkData = tkBySlug[tk.index];
    const le = holidaysOn(info);
    const notes = [];
    if (info.kieng.tamNuong) notes.push(['warn', 'Ngày Tam Nương (mùng 3, 7, 13, 18, 22, 27 âm) — tục kiêng dân gian, nên thận trọng với việc trọng đại.']);
    if (info.kieng.nguyetKy) notes.push(['warn', 'Ngày Nguyệt Kỵ (mùng 5, 14, 23 âm) — dân gian kiêng khởi sự lớn.']);
    if (info.kieng.duongCong) notes.push(['warn', 'Dương công kỵ nhật — ngày kiêng theo lịch cổ, thường tránh động thổ, cưới hỏi.']);
    if (info.lunar.day === 1) notes.push(['', 'Mùng một âm lịch — nhiều gia đình thắp hương, ăn chay.']);
    if (info.lunar.day === 15) notes.push(['', 'Ngày rằm — trăng tròn, dịp lễ chùa.']);
    for (const l of le) notes.push(['', `${l.ten}: ${l.mo}`]);
    if (P) {
      const p = P.get && P.get();
      if (p && p.year) {
        const cc = P.canChi(p.year);
        if ((info.dayCanChi.chi + 6) % 12 === cc.chiIdx) {
          notes.push(['warn', `Ngày này lục xung với tuổi ${cc.text} của bạn — nên cân nhắc nếu định làm việc lớn.`]);
        }
      }
    }

    $('las-title').textContent = `${DOW[info.weekday]}, ${d}/${m}/${y}`;
    $('las-sub').textContent = `Âm lịch ${info.lunar.day}/${info.lunar.month}${info.lunar.leap ? ' nhuận' : ''} · năm ${info.yearCanChi.text}`;
    $('las-body').innerHTML = `
      <div class="la-rows">
        <div class="la-row"><span>Ngày</span><b>${info.dayCanChi.text}</b></div>
        <div class="la-row"><span>Tháng</span><b>${info.monthCanChi.text}</b></div>
        <div class="la-row"><span>Năm</span><b>${info.yearCanChi.text}</b></div>
        <div class="la-row"><span>Trực</span><b>${info.truc.name}</b></div>
        <div class="la-row"><span>Sao</span><b class="${info.god.good ? 'la-good' : 'la-bad'}">${info.god.name} (${info.god.good ? 'hoàng đạo' : 'hắc đạo'})</b></div>
        <div class="la-row"><span>Nạp âm</span><b>${info.napAm.name}</b></div>
        <div class="la-row"><span>Tiết khí</span><b>${tkData.ten}</b></div>
        <div class="la-row"><span>Xung tuổi</span><b>${info.xungChi}</b></div>
        <div class="la-row"><span>Hỷ thần</span><b>${info.huong.hyThan}</b></div>
        <div class="la-row"><span>Tài thần</span><b>${info.huong.taiThan}</b></div>
        <div class="la-row"><span>Hạc thần</span><b>${info.huong.hacThan}</b></div>
      </div>
      <div class="la-sec-head" style="margin-top:16px"><i class="ti ti-clock"></i> 12 canh giờ</div>
      <div class="las-hours">
        ${info.hours.map((h) => `<div class="las-hour${h.good ? ' good' : ''}"><b>${h.chi}</b>${h.range}</div>`).join('')}
      </div>
      ${notes.length ? `<div class="las-notes">${notes.map(([c, t]) => `<div class="las-note ${c}">• ${esc(t)}</div>`).join('')}</div>` : ''}
      <div class="las-actions">
        ${hasDayPage(d, m, y) ? `<a class="las-cta" href="${dayPath(d, m, y)}">Trang chi tiết ngày này</a>` : ''}
        <a class="las-cta alt" href="/ngay-tot/">Ngày này hợp việc gì?</a>
      </div>
    `;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('is-open'));
  }
  function closeSheet() {
    sheet.classList.remove('is-open');
    setTimeout(() => { sheet.hidden = true; }, 220);
  }
  $('la-sheet-backdrop').addEventListener('click', closeSheet);
  $('la-sheet-close').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // ==================== ĐỔI NGÀY ====================
  function showOut(html) { $('la-out').innerHTML = html; }
  function outErr(msg) { showOut(`<p class="la-out-err">⚠ ${esc(msg)}</p>`); }

  function outFromSolar(d, m, y) {
    const info = A.dayInfo(d, m, y);
    const tkData = tkBySlug[info.tietKhi.index];
    const inWindow = hasDayPage(d, m, y);
    showOut(`
      <p class="la-out-big">${d}/${m}/${y} dương → <b>${info.lunar.day}/${info.lunar.month}${info.lunar.leap ? ' nhuận' : ''}</b> âm lịch</p>
      <p>${DOW[info.weekday]} · năm ${info.yearCanChi.text} · ngày ${info.dayCanChi.text} · tháng ${info.monthCanChi.text}</p>
      <p>Trực ${info.truc.name} · <span class="${info.god.good ? 'la-good' : 'la-bad'}">${info.god.name}</span> · tiết ${tkData.ten}</p>
      <p>Giờ hoàng đạo: ${info.goodHours.join(', ')}</p>
      ${inWindow ? `<a class="la-perma" href="${dayPath(d, m, y)}"><i class="ti ti-external-link"></i> Trang chi tiết ngày này</a>` : ''}
    `);
  }

  $('la-tab-s2l').addEventListener('click', () => switchTab('s2l'));
  $('la-tab-l2s').addEventListener('click', () => switchTab('l2s'));
  function switchTab(which) {
    const isS = which === 's2l';
    $('la-tab-s2l').classList.toggle('is-active', isS);
    $('la-tab-l2s').classList.toggle('is-active', !isS);
    $('la-tab-s2l').setAttribute('aria-selected', String(isS));
    $('la-tab-l2s').setAttribute('aria-selected', String(!isS));
    $('la-pane-s2l').classList.toggle('is-active', isS);
    $('la-pane-l2s').classList.toggle('is-active', !isS);
    showOut('');
  }

  const num = (id) => parseInt($(id).value, 10);

  $('la-s-go').addEventListener('click', () => {
    const d = num('la-s-d'), m = num('la-s-m'), y = num('la-s-y');
    if (!d || !m || !y) return outErr('Nhập đủ ngày, tháng, năm dương lịch.');
    if (y < MIN_Y || y > MAX_Y) return outErr(`Chỉ hỗ trợ năm ${MIN_Y}–${MAX_Y}.`);
    if (m < 1 || m > 12) return outErr('Tháng phải từ 1 đến 12.');
    const maxD = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d < 1 || d > maxD) return outErr(`Tháng ${m}/${y} chỉ có ${maxD} ngày.`);
    outFromSolar(d, m, y);
  });

  $('la-l-go').addEventListener('click', () => {
    const d = num('la-l-d'), m = num('la-l-m'), y = num('la-l-y');
    const leap = $('la-l-leap').checked ? 1 : 0;
    if (!d || !m || !y) return outErr('Nhập đủ ngày, tháng, năm âm lịch.');
    if (y < MIN_Y || y > MAX_Y) return outErr(`Chỉ hỗ trợ năm ${MIN_Y}–${MAX_Y}.`);
    if (m < 1 || m > 12) return outErr('Tháng phải từ 1 đến 12.');
    const info = A.isLeapYear(y);
    if (leap && (!info.hasLeap || info.leapMonth !== m)) {
      return outErr(info.hasLeap
        ? `Năm âm ${y} nhuận tháng ${info.leapMonth}, không nhuận tháng ${m}.`
        : `Năm âm ${y} không có tháng nhuận.`);
    }
    const len = A.lunarMonthDays(m, y, leap);
    if (len && d > len) return outErr(`Tháng ${m}${leap ? ' nhuận' : ''} năm ${y} âm chỉ có ${len} ngày.`);
    const s = A.lunar2solar(d, m, y, leap);
    if (!s) return outErr('Không đổi được ngày này — kiểm tra lại tháng nhuận.');
    outFromSolar(s.day, s.month, s.year);
  });

  // ==================== NAV ====================
  $('la-prev').addEventListener('click', () => {
    viewM--; if (viewM < 1) { viewM = 12; viewY--; }
    if (viewY < MIN_Y) { viewY = MIN_Y; viewM = 1; }
    renderMonth();
  });
  $('la-next').addEventListener('click', () => {
    viewM++; if (viewM > 12) { viewM = 1; viewY++; }
    if (viewY > MAX_Y) { viewY = MAX_Y; viewM = 12; }
    renderMonth();
  });
  $('la-btn-today').addEventListener('click', () => { viewY = T.y; viewM = T.m; renderMonth(); });
  $('la-jump-m').addEventListener('change', (e) => { viewM = parseInt(e.target.value, 10); renderMonth(); });
  $('la-jump-y').addEventListener('change', (e) => { viewY = parseInt(e.target.value, 10); renderMonth(); });

  // ==================== BOOT ====================
  (function fillJump() {
    const mSel = $('la-jump-m'), ySel = $('la-jump-y');
    for (let i = 1; i <= 12; i++) mSel.innerHTML += `<option value="${i}">Tháng ${i}</option>`;
    for (let y = MAX_Y; y >= MIN_Y; y--) ySel.innerHTML += `<option value="${y}">${y}</option>`;
  })();

  // điền sẵn ô đổi ngày bằng hôm nay cho đỡ phải gõ
  $('la-s-d').value = T.d; $('la-s-m').value = T.m; $('la-s-y').value = T.y;

  renderToday();
  renderMonth();
})();
