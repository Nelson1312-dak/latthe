/* ============================================================
   app.js — Wiring. Increment 1: dựng bàn + màn setup + đo lại khi resize.
   Engine/bot/anim sẽ cắm vào ở increment 2-3.
   ============================================================ */

(() => {
  'use strict';

  const W = window;
  const CTP = (W.CTP = W.CTP || {});
  const R = CTP.Render;
  const $ = (id) => document.getElementById(id);

  const boardEl = $('mb-board');
  const railEl = $('mb-rail');
  const tickEl = $('mb-tick');

  /* ---------- cấu hình ván (increment 2 sẽ chuyển vào engine) ---------- */
  const cfg = {
    mode: CTP_DEFAULTS.mode,
    seats: [
      { name: 'Bạn',      kind: 'human', tier: null },
      { name: 'Con Buôn', kind: 'bot',   tier: 'thuong' },
      null,
      null,
    ],
  };

  const TIERS = [
    { v: 'human',  label: 'Người thật' },
    { v: 'taymo',  label: 'Bot · Tay Mơ' },
    { v: 'thuong', label: 'Bot · Con Buôn' },
    { v: 'camap',  label: 'Bot · Cá Mập' },
    { v: 'off',    label: '— Trống —' },
  ];

  /* ---------- màn setup ---------- */
  function renderSeats() {
    const box = $('mb-seats');
    box.textContent = '';
    for (let i = 0; i < 4; i++) {
      const seat = cfg.seats[i] || null;
      const row = R.el('div', 'mb-seat');

      const dot = R.el('span', 'mb-seat-dot');
      dot.style.setProperty('--tk', CTP_TOKENS[i].mau);
      row.appendChild(dot);

      const inp = R.el('input', 'mb-input');
      inp.type = 'text';
      inp.maxLength = 12;
      inp.placeholder = 'Tên người chơi ' + (i + 1);
      inp.value = seat ? seat.name : '';
      inp.disabled = !seat;
      inp.addEventListener('input', () => { if (cfg.seats[i]) cfg.seats[i].name = inp.value; });
      row.appendChild(inp);

      const sel = R.el('select', 'mb-select');
      for (const t of TIERS) {
        // 2 ghế đầu không được bỏ trống — cần tối thiểu 2 người chơi
        if (t.v === 'off' && i < 2) continue;
        const o = R.el('option', null, t.label);
        o.value = t.v;
        sel.appendChild(o);
      }
      sel.value = !seat ? 'off' : seat.kind === 'human' ? 'human' : seat.tier;
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === 'off') cfg.seats[i] = null;
        else if (v === 'human') cfg.seats[i] = { name: inp.value || 'Người ' + (i + 1), kind: 'human', tier: null };
        else {
          const lbl = TIERS.find(t => t.v === v).label.replace('Bot · ', '');
          cfg.seats[i] = { name: inp.value || lbl, kind: 'bot', tier: v };
        }
        renderSeats();
      });
      row.appendChild(sel);

      box.appendChild(row);
    }
  }

  function bindMode() {
    const box = $('mb-mode');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.mb-seg-b');
      if (!b) return;
      cfg.mode = b.dataset.mode;
      box.querySelectorAll('.mb-seg-b').forEach(x => x.classList.toggle('is-on', x === b));
    });
  }

  function showScreen(which) {
    $('mb-screen-setup').classList.toggle('is-on', which === 'setup');
    $('mb-screen-play').classList.toggle('is-on', which === 'play');
  }

  function pushTick(txt) {
    tickEl.textContent = '';
    tickEl.appendChild(R.el('div', 'mb-tick-line', txt));
  }

  /* ---------- rail người chơi (bản tĩnh cho increment 1) ---------- */
  function renderRail() {
    const seats = cfg.seats.filter(Boolean);
    railEl.style.setProperty('--n', String(seats.length));
    railEl.dataset.n = String(seats.length);
    railEl.textContent = '';
    seats.forEach((s, i) => {
      const b = R.el('button', 'mb-pl' + (i === 0 ? ' is-turn' : ''));
      b.type = 'button';
      const top = R.el('div', 'mb-pl-top');
      const dot = R.el('span', 'mb-pl-dot');
      dot.style.setProperty('--tk', CTP_TOKENS[i].mau);
      top.appendChild(dot);
      top.appendChild(R.el('span', 'mb-pl-name', s.name));
      if (s.kind === 'bot') top.appendChild(R.el('span', 'mb-pl-bot', 'bot'));
      b.appendChild(top);
      b.appendChild(R.el('div', 'mb-pl-cash mb-num', R.fmtMoney(CTP_DEFAULTS.startCash)));
      const strip = R.el('div', 'mb-pl-strip');
      Object.keys(CTP_GROUPS).forEach(() => strip.appendChild(R.el('span', 'mb-pl-seg')));
      b.appendChild(strip);
      railEl.appendChild(b);
    });
  }

  /* Đo toạ độ tâm 40 ô. PHẢI đo thật, không tính công thức: track `1fr`
     chia có làm tròn sub-pixel mà công thức không khớp. */
  function measureSpots() {
    const b = boardEl.getBoundingClientRect();
    if (!b.width) return [];
    const out = [];
    for (let i = 0; i < 40; i++) {
      const t = boardEl.querySelector('.mb-tile[data-i="' + i + '"]');
      if (!t) return [];
      const r = t.getBoundingClientRect();
      out.push({ x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 });
    }
    return out;
  }
  CTP.measureSpots = measureSpots;

  /* ---------- quân (bản tĩnh cho increment 1) ---------- */
  function placeTokensStatic() {
    const layer = $('mb-tokens');
    if (!layer) return;
    const spots = measureSpots();
    if (!spots.length) return;
    const seats = cfg.seats.filter(Boolean);
    const FAN = [[0, 0], [-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]];
    const base = parseFloat(getComputedStyle(boardEl).getPropertyValue('--tok')) || 16;
    // ≥3 quân chung 1 ô: thu nhỏ để còn đọc được trên ô góc
    const tok = seats.length >= 3 ? base * 0.58 : base;
    layer.textContent = '';
    seats.forEach((s, i) => {
      const t = R.el('div', 'mb-token' + (i === 0 ? ' is-turn' : ''));
      t.style.setProperty('--tok', tok + 'px');
      const body = R.el('div', 'mb-token-body');
      body.style.setProperty('--tk', CTP_TOKENS[i].mau);
      body.appendChild(R.el('i', 'ti ' + CTP_TOKENS[i].icon));
      t.appendChild(body);
      const f = FAN[Math.min(i, FAN.length - 1)];
      const sp = spots[0];   // mọi quân bắt đầu ở Xuất Phát
      t.style.transform = 'translate(' + (sp.x + f[0] * tok * 1.7) + 'px,' + (sp.y + f[1] * tok * 1.7) + 'px)';
      layer.appendChild(t);
    });
  }

  /* ---------- sheet ---------- */
  function openSheet(build) {
    const body = $('mb-sheet-body');
    body.textContent = '';
    build(body);
    $('mb-sheet-back').classList.add('is-on');
  }
  function closeSheet() {
    $('mb-sheet-back').classList.remove('is-on');
    boardEl.querySelectorAll('.mb-tile.is-focus').forEach(x => x.classList.remove('is-focus'));
  }

  function sheetTile(i) {
    const t = CTP_BOARD[i];
    openSheet((body) => {
      const deed = R.el('div', 'mb-deed');
      deed.style.setProperty('--grp', R.tileColor(t));
      const head = R.el('div', 'mb-deed-head');
      const kindLabel = {
        dat: 'Ô đất · ' + (t.nhom ? CTP_GROUPS[t.nhom].ten : ''),
        sanbay: 'Sân bay', tienich: 'Dịch vụ công', cohoi: 'Thẻ Cơ Hội',
        vanmenh: 'Thẻ Vận Mệnh', thue: 'Thuế', goc: 'Ô đặc biệt',
      }[t.kind];
      head.appendChild(R.el('div', 'mb-deed-kind', kindLabel));
      head.appendChild(R.el('div', 'mb-deed-name', t.ten));
      deed.appendChild(head);

      const rows = R.el('div', 'mb-deed-rows');
      const add = (k, v) => {
        const r = R.el('div', 'mb-deed-row');
        r.appendChild(R.el('span', null, k));
        r.appendChild(R.el('b', 'mb-num', v));
        rows.appendChild(r);
      };
      if (t.kind === 'dat') {
        add('Giá mua', R.fmtFull(t.gia));
        add('Thuê (đất trống)', R.fmtFull(t.rent[0]));
        for (let k = 1; k <= 4; k++) add(k + ' nhà', R.fmtFull(t.rent[k]));
        add('Khách sạn', R.fmtFull(t.rent[5]));
        add('Giá mỗi nhà', R.fmtFull(t.xay));
        add('Bán lại nhà băng', R.fmtFull(t.gia / 2));
      } else if (t.kind === 'sanbay') {
        add('Giá mua', R.fmtFull(t.gia));
        [1, 2, 3, 4].forEach(n => add('Khi có ' + n + ' sân bay', R.fmtFull(25 * Math.pow(2, n - 1))));
      } else if (t.kind === 'tienich') {
        add('Giá mua', R.fmtFull(t.gia));
        add('Có 1 dịch vụ', 'xúc xắc × 4');
        add('Có 2 dịch vụ', 'xúc xắc × 10');
      } else if (t.kind === 'thue') {
        add('Phải nộp', R.fmtFull(t.tien));
      } else {
        rows.appendChild(R.el('p', 'mb-sheet-sub',
          t.i === 0 ? 'Mỗi lần đi qua đây nhận ' + CTP_DEFAULTS.goSalary + ' triệu.'
          : t.i === 10 ? 'Ghé thăm thì không mất gì. Chỉ mất lượt khi bị bắt vào tù.'
          : t.i === 20 ? 'Ô an toàn — không mất gì, không được gì.'
          : 'Vào thẳng Trạm Giam, không đi qua Xuất Phát, không nhận lương.'));
      }
      deed.appendChild(rows);
      body.appendChild(deed);
    });
  }

  function sheetList() {
    openSheet((body) => {
      body.appendChild(R.el('p', 'mb-sheet-title', 'Danh sách 40 ô'));
      body.appendChild(R.el('p', 'mb-sheet-sub', 'Bản đọc được của bàn cờ — chạm để xem chi tiết từng ô.'));
      const list = R.el('div', 'mb-list');
      for (const t of CTP_BOARD) {
        const it = R.el('button', 'mb-list-it');
        it.type = 'button';
        const sw = R.el('span', 'mb-list-sw');
        sw.style.setProperty('--grp', R.tileColor(t));
        it.appendChild(sw);
        it.appendChild(R.el('span', 'mb-list-nm', t.ten));
        it.appendChild(R.el('span', 'mb-list-meta',
          t.gia ? t.gia + ' tr' : t.tien ? '−' + t.tien + ' tr' : ''));
        it.addEventListener('click', () => sheetTile(t.i));
        list.appendChild(it);
      }
      body.appendChild(list);
    });
  }

  /* ---------- khởi động ---------- */
  function startGame() {
    const seats = cfg.seats.filter(Boolean);
    if (seats.length < 2) return;
    seats.forEach((s, i) => { if (!String(s.name).trim()) s.name = 'Người ' + (i + 1); });
    showScreen('play');
    R.buildBoard(boardEl);
    renderRail();
    // chờ 1 frame cho layout xong rồi mới đo toạ độ ô
    requestAnimationFrame(() => { R.fitBoard(boardEl); placeTokensStatic(); });
    pushTick('🎲 Ván mới — ' + seats.map(s => s.name).join(' · '));
  }

  /* Đo lại khi bàn đổi kích thước: iOS co giãn URL bar, quay ngang máy… */
  new ResizeObserver(() => {
    if (!$('mb-screen-play').classList.contains('is-on')) return;
    R.fitBoard(boardEl);
    placeTokensStatic();
  }).observe(boardEl);

  boardEl.addEventListener('click', (e) => {
    const t = e.target.closest('.mb-tile');
    if (!t) return;
    boardEl.querySelectorAll('.mb-tile.is-focus').forEach(x => x.classList.remove('is-focus'));
    t.classList.add('is-focus');
    sheetTile(Number(t.dataset.i));
  });

  $('mb-sheet-back').addEventListener('click', (e) => {
    if (e.target === $('mb-sheet-back')) closeSheet();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  $('mb-start').addEventListener('click', startGame);
  $('mb-menu').addEventListener('click', sheetList);

  renderSeats();
  bindMode();

  /* API cho increment 2 (khôi phục ván đã lưu) — và để kiểm thử render bàn
     mà không phải bấm qua màn setup. */
  CTP.startGame = startGame;
  CTP.cfg = cfg;
})();
