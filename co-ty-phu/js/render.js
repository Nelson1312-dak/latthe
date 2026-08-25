/* ============================================================
   render.js — Đọc state, ghi DOM. TUYỆT ĐỐI không gọi Engine.apply().
   Chiều đi một hướng: action → Engine.apply → state → Render.

   Chiến lược: dựng bàn MỘT LẦN rồi patch các ô "dirty", KHÔNG full re-render.
   Lý do cụ thể (không phải tối ưu non): quân di chuyển bằng CSS transform, mà
   `innerHTML =` sẽ hủy element giữa transition ⇒ quân teleport thay vì nhảy.
   ============================================================ */

(() => {
  'use strict';

  const W = window;
  const CTP = (W.CTP = W.CTP || {});

  /* ---------- tiện ích ---------- */
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* Tiền: đơn vị nội bộ = 1 triệu VNĐ.
     Chip cần ngắn (`1,25 tỷ`), sheet cần đầy đủ (`1.250 triệu`). */
  function fmtMoney(n) {
    const v = Math.round(n);
    if (Math.abs(v) >= 1000) {
      const ty = v / 1000;
      const s = (Math.abs(ty) < 10 ? ty.toFixed(2) : ty.toFixed(1)).replace(/[.,]?0+$/, '');
      return s.replace('.', ',') + ' tỷ';
    }
    return v + ' tr';
  }
  function fmtFull(n) {
    return Math.round(n).toLocaleString('vi-VN') + ' triệu';
  }

  /* ---------- vị trí ô trên lưới 11×11 ----------
     index 0 = XUẤT PHÁT ở góc DƯỚI-PHẢI, đi ngược chiều kim đồng hồ.
     Trả về chỉ số dòng/cột dạng 1-based của CSS grid + cạnh đang nằm.
     Đã kiểm: 0→(11,11) 10→(1,11) 20→(1,1) 30→(11,1) 39→(11,10) kề Xuất Phát. */
  function cellOf(i) {
    if (i <= 10) return { c: 11 - i, r: 11,      side: 'b' };
    if (i <= 20) return { c: 1,      r: 21 - i,  side: 'l' };
    if (i <= 30) return { c: i - 19, r: 1,       side: 't' };
    return                { c: 11,     r: i - 29,  side: 'r' };
  }
  const isCorner = (i) => i % 10 === 0;

  /* Màu nhóm / loại ô */
  function tileColor(t) {
    if (t.kind === 'dat') return CTP_GROUPS[t.nhom].mau;
    return CTP_KIND_COLORS[t.kind] || CTP_KIND_COLORS.goc;
  }

  /* ---------- dựng bàn (1 lần) ---------- */
  function buildBoard(boardEl) {
    boardEl.textContent = '';

    // tâm bàn trước, để nó nằm dưới các ô về thứ tự DOM
    const centre = el('div', 'mb-centre');
    centre.innerHTML = centreArt();
    const live = el('div', 'mb-centre-live');
    live.id = 'mb-centre-live';
    centre.appendChild(live);
    boardEl.appendChild(centre);

    for (const t of CTP_BOARD) {
      const { c, r, side } = cellOf(t.i);
      const btn = el('button', 'mb-tile');
      btn.type = 'button';
      // inline style attribute — CSP cho phép style-src 'unsafe-inline'
      btn.style.gridColumn = String(c);
      btn.style.gridRow = String(r);
      btn.dataset.i = String(t.i);
      btn.dataset.kind = t.kind;
      btn.dataset.side = side;
      if (isCorner(t.i)) btn.classList.add('is-corner');
      btn.style.setProperty('--grp', tileColor(t));

      const inn = el('div', 'mb-tile-in');

      if (isCorner(t.i)) {
        const cw = el('div', 'mb-corner');
        cw.appendChild(el('i', 'ti ' + t.icon + ' mb-corner-icon'));
        cw.appendChild(el('span', 'mb-corner-label', t.nhan));
        inn.appendChild(cw);
      } else {
        // Dải màu — màu lấy từ `--grp` đã set trên ô, KHÔNG set inline
        // `background`: inline sẽ đè background-image nên mất lớp gradient làm
        // dải có chiều sâu (dải phẳng một màu là thứ làm bàn trông nhạt).
        const band = el('div', 'mb-band');
        if (t.kind === 'dat') band.dataset.houses = '';
        inn.appendChild(band);
        const body = el('div', 'mb-body');
        if (t.icon) body.appendChild(el('i', 'ti ' + t.icon + ' mb-ticon'));
        // `nhan` = nhãn NGẮN cho mặt ô (vd "Cam Ranh"); `ten` đầy đủ vẫn dùng ở
        // deed + aria. Không có nhan thì dùng ten. Tên dài bị ellipsis mất chữ.
        body.appendChild(el('div', 'mb-name', t.nhan || t.ten));
        if (t.gia) body.appendChild(el('div', 'mb-price mb-num', String(t.gia)));
        else if (t.tien) body.appendChild(el('div', 'mb-price mb-num', String(t.tien)));
        inn.appendChild(body);
      }

      inn.appendChild(el('span', 'mb-flag'));
      btn.appendChild(inn);
      btn.setAttribute('aria-label', ariaFor(t, null));
      boardEl.appendChild(btn);
    }

    // lớp quân nằm trên cùng
    const toks = el('div', 'mb-tokens');
    toks.id = 'mb-tokens';
    boardEl.appendChild(toks);

    fitBoard(boardEl);
    return boardEl;
  }

  /* Nhãn a11y — đây là kênh truy cập chính cho bàn cờ chữ nhỏ */
  function ariaFor(t, st) {
    let s = t.ten;
    if (t.kind === 'dat') {
      s += ', nhóm ' + CTP_GROUPS[t.nhom].ten + ', giá ' + t.gia + ' triệu';
      if (st && st.owner != null) {
        s += ', chủ ' + st.ownerName;
        if (st.level > 0) s += ', ' + (st.level === 5 ? 'khách sạn' : st.level + ' nhà');
      } else s += ', chưa ai mua';
    } else if (t.kind === 'sanbay' || t.kind === 'tienich') {
      s += ', giá ' + t.gia + ' triệu';
      if (st && st.owner != null) s += ', chủ ' + st.ownerName;
    } else if (t.kind === 'thue') {
      s += ', nộp ' + t.tien + ' triệu';
    }
    return s;
  }

  /* ---------- thang hiển thị ----------
     Phải đo bằng JS: cạnh bàn phụ thuộc CẢ vw LẪN dvh nên media query không
     biểu diễn được.

     ⚠️ NGƯỠNG LÀ SỐ ĐO ĐƯỢC, KHÔNG PHẢI SỐ CẢM TÍNH — đừng chỉnh bằng mắt.
     Chỗ chứa chữ trong thân ô = d*(1-0.26 dải) - d*0.06 padding. Tên 2 dòng
     (7px × line-height 1.28) + giá (clamp ≥7px × 1.2) + gap 2% cần:
        vw 320 ⇒ --e 24.0px, cần 27.3px / có 26.5px ⇒ THIẾU ⇒ phải md
        vw 360 ⇒ --e 27.3px, cần 28.6px / có 29.9px ⇒ vừa  ⇒ lg
     Nên lg bắt đầu từ 26.5. Bản trước đặt `e < 34 = sm` nên MỌI điện thoại
     (vw 320–430 ⇒ --e chỉ 24–33px) đều rơi vào sm ⇒ 22 ô đất không có chữ
     NÀO, bàn trông trống rỗng. Đổi dải/font/padding thì phải tính lại 2 mốc
     trên rồi mới sửa ngưỡng. */
  function fitBoard(boardEl) {
    const side = boardEl.getBoundingClientRect().width;
    if (!side) return;
    const d = side * 0.128;
    const e = (side - 2 * d - 10) / 9;
    boardEl.dataset.size = e < 21 ? 'sm' : e < 26.5 ? 'md' : 'lg';
    // 0.64: to hơn bản cũ (0.62) cho quân dễ thấy, nhưng không lên 0.7 —
    // quân ở ô GÓC nằm đúng chỗ nhãn "XUẤT PHÁT"/"TRẠM GIAM" nên to quá là
    // che mất mốc. Góc vẫn còn icon + màu riêng để nhận ra.
    boardEl.style.setProperty('--tok', Math.max(12, Math.min(e, d) * 0.64) + 'px');
  }

  /* ---------- tranh tâm bàn ----------
     5 lớp: mây hoá (tái dùng idiom path của trang chủ index.html:196) ·
     vòng astrolabe (idiom images/logo.svg) · hoa văn trống đồng 12 cánh ·
     wordmark · 2 cọc thẻ. Tất cả inline SVG, aria-hidden, thuần trang trí. */
  function centreArt() {
    const petals = Array.from({ length: 12 }, (_, k) => {
      const a = (k * 30 * Math.PI) / 180;
      const x1 = 100 + Math.cos(a) * 15, y1 = 100 + Math.sin(a) * 15;
      const x2 = 100 + Math.cos(a) * 37, y2 = 100 + Math.sin(a) * 37;
      const pa = a + 0.13, pb = a - 0.13;
      const xa = 100 + Math.cos(pa) * 26, ya = 100 + Math.sin(pa) * 26;
      const xb = 100 + Math.cos(pb) * 26, yb = 100 + Math.sin(pb) * 26;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${xa.toFixed(1)} ${ya.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${xb.toFixed(1)} ${yb.toFixed(1)}Z`;
    }).join('');

    return `<svg class="mb-centre-art" viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="mbGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0c46a"/><stop offset=".55" stop-color="#d98a0a"/><stop offset="1" stop-color="#a86608"/>
    </linearGradient>
    <linearGradient id="mbInk" x1="0" y1="0" x2="1" y2="1">
      <stop offset=".25" stop-color="#1a0a00"/><stop offset=".6" stop-color="#7a3800"/><stop offset="1" stop-color="#e8930a"/>
    </linearGradient>
    <!-- Cánh sen chuyển đỏ sơn mài → vàng: một màu vàng đơn ở opacity thấp là
         thứ khiến hoa văn trống đồng biến mất hẳn trên nền kem. -->
    <linearGradient id="mbPetal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c0475c"/><stop offset=".5" stop-color="#d98a0a"/><stop offset="1" stop-color="#a86608"/>
    </linearGradient>
  </defs>
  <g stroke="#c07d28" stroke-width="1.3" stroke-linecap="round" opacity=".38" fill="none">
    <path d="M14 34c8-5 19-4 24 2 4-6 16-7 21-1 6-2 13 1 14 7"/>
    <path d="M28 39c6 2 14 1 19-2"/>
    <path d="M186 34c-8-5-19-4-24 2-4-6-16-7-21-1-6-2-13 1-14 7"/>
    <path d="M172 39c-6 2-14 1-19-2"/>
    <path d="M14 168c8-5 19-4 24 2 4-6 16-7 21-1"/>
    <path d="M186 168c-8-5-19-4-24 2-4-6-16-7-21-1"/>
  </g>
  <g class="mb-ring-spin" opacity=".6">
    <circle cx="100" cy="100" r="62" stroke="url(#mbGold)" stroke-width="1.4" stroke-dasharray="1 3.6"/>
    <circle cx="100" cy="100" r="52" stroke="url(#mbGold)" stroke-width="1" stroke-dasharray="8 6" opacity=".75"/>
  </g>
  <!-- ⚠️ petals là DỮ LIỆU path (chuỗi "M…L…Z"), PHẢI bọc trong <path d="">.
       Bản increment 1 nhổ thẳng ${petals} vào <g> nên 12 cánh sen thành text
       trần trong SVG ⇒ bị bỏ qua, chưa bao giờ hiện lên (đã xác nhận bằng
       probe DOM: nhóm có children=0). -->
  <g fill="url(#mbPetal)" opacity=".62"><path d="${petals}"/></g>
  <circle cx="100" cy="100" r="12.5" fill="none" stroke="url(#mbGold)" stroke-width="1.8" opacity=".8"/>
  <g opacity=".78">
    <rect x="34" y="118" width="17" height="24" rx="2.5" transform="rotate(-16 42 130)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
    <rect x="38" y="115" width="17" height="24" rx="2.5" transform="rotate(-8 46 127)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
    <rect x="149" y="118" width="17" height="24" rx="2.5" transform="rotate(16 158 130)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
    <rect x="145" y="115" width="17" height="24" rx="2.5" transform="rotate(8 154 127)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
  </g>
  <!-- Chữ nhường chỗ cho hoa văn: cánh sen chiếm y 63–137 (r 15–37 quanh tâm
       100,100) nên wordmark lên y=56 và watermark xuống y=152 để không ai đè ai.
       Trước đây đặt y=86/123 (giữa vùng cánh sen) chỉ "trông ổn" vì cánh sen
       chưa bao giờ render — sửa được bug path thì mới lộ ra chồng nhau. -->
  <text x="100" y="56" text-anchor="middle" fill="url(#mbInk)" font-family="'Be Vietnam Pro',sans-serif"
        font-size="17" font-weight="900" letter-spacing="1.4">CỜ TỶ PHÚ</text>
  <text x="100" y="152" text-anchor="middle" fill="#8a7256" font-family="'Be Vietnam Pro',sans-serif"
        font-size="6.4" font-weight="700" letter-spacing="2.6">LATBAI.VN</text>
</svg>`;
  }

  /* ---------- increment 2: sơn trạng thái sở hữu/nhà lên ô ---------- */
  function paintTile(boardEl, i, state) {
    const t = CTP_BOARD[i];
    const btn = boardEl.querySelector('.mb-tile[data-i="' + i + '"]');
    if (!btn) return;
    const st = state.tiles[i];
    if (st && st.owner != null) {
      btn.dataset.owner = String(st.owner);
      btn.style.setProperty('--own', CTP_TOKENS[st.owner].mau);
    } else {
      delete btn.dataset.owner;
      btn.style.removeProperty('--own');
    }
    if (t.kind === 'dat') {
      const band = btn.querySelector('.mb-band[data-houses]');
      if (band) {
        band.textContent = '';
        if (st && st.level > 0) {
          if (st.level === 5) band.appendChild(el('div', 'mb-hotel'));
          else for (let k = 0; k < st.level; k++) band.appendChild(el('div', 'mb-house'));
        }
      }
      // hairline trắng "độc quyền cả nhóm" — CSS có từ increment 1 nhưng chưa
      // ai set class, nên tín hiệu "sắp đau" chưa bao giờ hiện
      const group = CTP_GROUP_TILES[t.nhom];
      btn.classList.toggle('is-mono',
        !!st && st.owner != null && group.every((g) => state.tiles[g].owner === st.owner));
    }
    const ownerSt = st && st.owner != null ? { owner: st.owner, ownerName: state.players[st.owner].name, level: st.level } : null;
    btn.setAttribute('aria-label', ariaFor(t, ownerSt));
  }
  function paintAllTiles(boardEl, state) {
    for (let i = 0; i < 40; i++) paintTile(boardEl, i, state);
  }

  /* Đo toạ độ tâm 40 ô. PHẢI đo thật, không tính công thức: track `1fr` chia
     có làm tròn sub-pixel mà công thức không khớp.

     ⚠️ HÀM NÀY SỐNG Ở ĐÂY, KHÔNG PHẢI app.js. Trước đó nó nằm trong app.js và
     render.js đọc qua `CTP.measureSpots ? … : []`. Lúc app.js được viết lại ở
     increment 2, hàm bị xoá mất mà cái `? :` kia lặng lẽ nuốt lỗi ⇒ layoutTokens
     và moveTokenStep return sớm ⇒ CẢ 4 QUÂN nằm chồng ở góc trên-trái bàn và
     không bao giờ di chuyển, suốt cả bản đã deploy. Đọc DOM là việc của
     render.js nên để nó tự đo, không nhận từ ngoài, thì không thể mồ côi lần nữa. */
  function measureSpots(boardEl) {
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

  /* ---------- increment 2: quân — element BỀN VỮNG, chỉ đổi transform ----------
     Tạo 1 lần lúc vào ván; di chuyển = đổi transform (CSS transition lo phần
     mượt). Rebuild bằng innerHTML sẽ hủy element giữa lúc đang bay = quân
     teleport thay vì trượt (xem cảnh báo đầu file). */
  function buildTokens(boardEl, state) {
    const layer = boardEl.querySelector('.mb-tokens');
    if (!layer) return;
    layer.textContent = '';
    state.players.forEach((p, i) => {
      const t = el('div', 'mb-token');
      t.id = 'mb-tok-' + i;
      const body = el('div', 'mb-token-body');
      body.style.setProperty('--tk', CTP_TOKENS[i].mau);
      body.appendChild(el('i', 'ti ' + CTP_TOKENS[i].icon));
      t.appendChild(body);
      layer.appendChild(t);
    });
  }
  /* Đặt 1 quân vào TÂM một ô cụ thể, không tính fan — dùng cho bước nhảy
     trung gian lúc animate; layoutTokens() mới lo fan lúc quân đứng yên. */
  function moveTokenStep(boardEl, playerIdx, tileIdx) {
    const spots = measureSpots(boardEl);
    const sp = spots[tileIdx];
    const tEl = document.getElementById('mb-tok-' + playerIdx);
    if (!sp || !tEl) return;
    tEl.style.transform = 'translate(' + sp.x + 'px,' + sp.y + 'px)';
  }
  /* Xếp lại toàn bộ quân theo state.pos hiện tại (fan khi ≥2 quân chung ô) */
  function layoutTokens(boardEl, state) {
    const spots = measureSpots(boardEl);
    if (!spots.length) return;
    const groups = {};
    state.players.forEach((p, i) => { if (!p.bankrupt) (groups[p.pos] || (groups[p.pos] = [])).push(i); });
    const FAN = [[0, 0], [-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]];
    const base = parseFloat(getComputedStyle(boardEl).getPropertyValue('--tok')) || 16;
    Object.keys(groups).forEach((posKey) => {
      const idxs = groups[posKey];
      const sp = spots[Number(posKey)];
      const tok = idxs.length >= 3 ? base * 0.58 : base;
      idxs.forEach((pi, k) => {
        const tEl = document.getElementById('mb-tok-' + pi);
        if (!tEl || !sp) return;
        tEl.style.setProperty('--tok', tok + 'px');
        const f = FAN[Math.min(k, FAN.length - 1)];
        tEl.style.transform = 'translate(' + (sp.x + f[0] * tok * 1.7) + 'px,' + (sp.y + f[1] * tok * 1.7) + 'px)';
      });
    });
    state.players.forEach((p, i) => {
      const tEl = document.getElementById('mb-tok-' + i);
      if (!tEl) return;
      tEl.classList.toggle('is-turn', i === state.turn && !p.bankrupt);
      tEl.classList.toggle('is-out', p.bankrupt);
    });
  }

  CTP.Render = {
    buildBoard, fitBoard, cellOf, isCorner, tileColor,
    fmtMoney, fmtFull, ariaFor, el,
    paintTile, paintAllTiles, buildTokens, moveTokenStep, layoutTokens, measureSpots,
  };
})();
