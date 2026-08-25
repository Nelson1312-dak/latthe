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
        // dải màu (ô đất) — nơi chứa pip nhà
        if (t.kind === 'dat') {
          const band = el('div', 'mb-band');
          band.dataset.houses = '';
          inn.appendChild(band);
        } else {
          const band = el('div', 'mb-band');
          band.style.background = tileColor(t);
          inn.appendChild(band);
        }
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
     biểu diễn được. E < 34px thì chữ tên không đọc nổi ⇒ chỉ dải + icon. */
  function fitBoard(boardEl) {
    const side = boardEl.getBoundingClientRect().width;
    if (!side) return;
    const d = side * 0.128;
    const e = (side - 2 * d - 10) / 9;
    boardEl.dataset.size = e < 34 ? 'sm' : e < 46 ? 'md' : 'lg';
    boardEl.style.setProperty('--tok', Math.max(11, Math.min(e, d) * 0.62) + 'px');
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
  </defs>
  <g stroke="#d99a3a" stroke-width="1.1" stroke-linecap="round" opacity=".2" fill="none">
    <path d="M14 34c8-5 19-4 24 2 4-6 16-7 21-1 6-2 13 1 14 7"/>
    <path d="M28 39c6 2 14 1 19-2"/>
    <path d="M186 34c-8-5-19-4-24 2-4-6-16-7-21-1-6-2-13 1-14 7"/>
    <path d="M172 39c-6 2-14 1-19-2"/>
    <path d="M14 168c8-5 19-4 24 2 4-6 16-7 21-1"/>
    <path d="M186 168c-8-5-19-4-24 2-4-6-16-7-21-1"/>
  </g>
  <g class="mb-ring-spin" opacity=".34">
    <circle cx="100" cy="100" r="62" stroke="url(#mbGold)" stroke-width="1" stroke-dasharray="1 3.6"/>
    <circle cx="100" cy="100" r="52" stroke="url(#mbGold)" stroke-width=".7" stroke-dasharray="8 6" opacity=".7"/>
  </g>
  <g fill="url(#mbGold)" opacity=".42">${petals}</g>
  <circle cx="100" cy="100" r="12.5" fill="none" stroke="url(#mbGold)" stroke-width="1.4" opacity=".55"/>
  <g opacity=".5">
    <rect x="34" y="118" width="17" height="24" rx="2.5" transform="rotate(-16 42 130)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
    <rect x="38" y="115" width="17" height="24" rx="2.5" transform="rotate(-8 46 127)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
    <rect x="149" y="118" width="17" height="24" rx="2.5" transform="rotate(16 158 130)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
    <rect x="145" y="115" width="17" height="24" rx="2.5" transform="rotate(8 154 127)" fill="#fffdf8" stroke="#d98a0a" stroke-width=".8"/>
  </g>
  <text x="100" y="86" text-anchor="middle" fill="url(#mbInk)" font-family="'Be Vietnam Pro',sans-serif"
        font-size="17" font-weight="900" letter-spacing="1.4">CỜ TỶ PHÚ</text>
  <text x="100" y="123" text-anchor="middle" fill="#a7937a" font-family="'Be Vietnam Pro',sans-serif"
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
    }
    const ownerSt = st && st.owner != null ? { owner: st.owner, ownerName: state.players[st.owner].name, level: st.level } : null;
    btn.setAttribute('aria-label', ariaFor(t, ownerSt));
  }
  function paintAllTiles(boardEl, state) {
    for (let i = 0; i < 40; i++) paintTile(boardEl, i, state);
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
    const spots = CTP.measureSpots ? CTP.measureSpots() : [];
    const sp = spots[tileIdx];
    const tEl = document.getElementById('mb-tok-' + playerIdx);
    if (!sp || !tEl) return;
    tEl.style.transform = 'translate(' + sp.x + 'px,' + sp.y + 'px)';
  }
  /* Xếp lại toàn bộ quân theo state.pos hiện tại (fan khi ≥2 quân chung ô) */
  function layoutTokens(boardEl, state) {
    const spots = CTP.measureSpots ? CTP.measureSpots() : [];
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
    paintTile, paintAllTiles, buildTokens, moveTokenStep, layoutTokens,
  };
})();
