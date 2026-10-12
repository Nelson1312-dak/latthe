/**
 * js/board.js — Bảng giá và thông tin thị trường.
 * Mọi số liệu lấy từ M / UNIVERSE / MKT của js/app.js (giá thật từ /api/market); không có số nào được tự bịa.
 * Thống kê "toàn sàn" chỉ hiện khi có từ DNSE WebSocket; còn lại chỉ tính trên rổ VN30 và ghi rõ như vậy.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '–');
  const sg = (n, d = 2) => (Number.isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) : '–');
  const big = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' tỷ' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' tr' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));

  const B = { group: 'vn30', sector: '', q: '', sort: { key: 'sym', dir: 1 }, prev: new Map(), built: false };

  const COLS = [
    ['sym', 'Mã', 's'], ['ref', 'TC', 'n'], ['ceil', 'Trần', 'n'], ['floor', 'Sàn', 'n'], ['last', 'Giá', 'n'], ['chg', '+/-', 'n'], ['pct', '%', 'n'],
    ['vol', 'KL', 'n'], ['bid', 'Mua', 'n'], ['ask', 'Bán', 'n'], ['high', 'Cao', 'n'], ['low', 'Thấp', 'n'],
  ];

  /** Gom số liệu một mã từ mô hình của app.js (giá lưu theo đơn vị 10 đồng, chia 100 ra nghìn đồng). */
  function rowOf(x) {
    const m = M[x.s]; if (!m) return null;
    const ref = m.refU / 100, last = m.lastU / 100;
    const best = (a) => (a && a.length ? a[0] : null);
    const bid = best(m.depth?.bid), ask = best(m.depth?.offer);
    return {
      sym: x.s, name: x.name, sector: x.sector || '', vn30: !!x.vn30, watch: !!x.watch, cls: cls(m, m.lastU),
      ref, ceil: m.ceilU / 100, floor: m.floorU / 100, last, chg: last - ref, pct: ref ? (last / ref - 1) * 100 : 0,
      vol: m.vol || 0, high: m.hiU / 100, low: m.loU / 100,
      bid: bid ? bid.u / 100 : null, bidq: bid ? bid.q : null, ask: ask ? ask.u / 100 : null, askq: ask ? ask.q : null,
      lastU: m.lastU, hasDepth: !!bid || !!ask,
    };
  }
  const allRows = () => UNIVERSE.map(rowOf).filter(Boolean);
  const inGroup = (r) => (B.group === 'vn30' ? r.vn30 : B.group === 'watch' ? r.watch : true);

  /* ---------- Thẻ chỉ số ---------- */
  function renderCards(vn30Rows) {
    const idx = (MKT.indices || []).filter((i) => ['VNINDEX', 'VN30', 'HNX', 'UPCOM'].includes(i.s));
    const live = MKT.session !== 'closed';
    $('mkt-cards').innerHTML = idx.map((i) => {
      const up = i.pct >= 0, c = i.pct === 0 ? 'ref' : up ? 'up' : 'down';
      const b = i.breadth && Number.isFinite(i.breadth.up) ? i.breadth : null;
      const tot = b ? (b.up || 0) + (b.down || 0) + (b.flat || 0) : 0;
      const bar = b && tot ? `<div class="breadth" title="Tăng ${b.up} · Đứng ${b.flat} · Giảm ${b.down}"><i class="u" style="width:${(b.up / tot) * 100}%"></i><i class="f" style="width:${(b.flat / tot) * 100}%"></i><i class="d" style="width:${(b.down / tot) * 100}%"></i></div>
        <div class="mc-sub"><span class="up">${b.up} tăng</span> · <span class="ref">${b.flat} đứng</span> · <span class="down">${b.down} giảm</span>${b.ceil ? ` · <span class="ceil">${b.ceil} trần</span>` : ''}${b.floor ? ` · <span class="floor">${b.floor} sàn</span>` : ''}</div>` : '';
      const liq = Number.isFinite(i.valueTraded) ? `<div class="mc-sub">GTGD ${big(i.valueTraded * 1e9)} đ · KL ${big(i.volume || 0)}</div>` : '';
      return `<div class="mc"><div class="mc-n">${esc(i.s)}${live ? '' : ' <small>đóng cửa</small>'}</div><div class="mc-v ${c}">${f2(i.last)}</div>
        <div class="mc-d ${c}">${sg(i.last - i.ref)} (${sg(i.pct)}%)</div>${bar}${liq}</div>`;
    }).join('');
  }

  /* ---------- Bảng giá ---------- */
  function sortRows(rows) {
    const { key, dir } = B.sort;
    const val = (r) => (key === 'sym' ? r.sym : key === 'bid' ? (r.bid ?? -1) : key === 'ask' ? (r.ask ?? 1e9) : r[key]);
    return rows.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir || a.sym.localeCompare(b.sym);
    });
  }
  function renderTable(rows) {
    const q = B.q.trim().toUpperCase();
    const list = sortRows(rows.filter((r) => inGroup(r) && (!B.sector || r.sector === B.sector) && (!q || r.sym.includes(q) || r.name.toUpperCase().includes(q))));
    const arrow = (k) => (B.sort.key === k ? (B.sort.dir > 0 ? ' ▲' : ' ▼') : '');
    $('bd-table').innerHTML = `<thead><tr>${COLS.map(([k, t, ty]) => `<th class="${ty === 'n' ? 'r' : ''}"><button class="th" data-bsort="${k}" aria-label="Sắp xếp theo ${t}">${t}${arrow(k)}</button></th>`).join('')}</tr></thead><tbody>${
      list.length ? list.map((r) => {
        const changed = B.prev.has(r.sym) && B.prev.get(r.sym) !== r.lastU;
        const d = r.chg;
        return `<tr class="${changed ? 'flash' : ''}"><td class="sym"><button class="link" data-goto="${esc(r.sym)}" title="${esc(r.name)}">${esc(r.sym)}</button><small>${esc(r.sector)}</small></td>
          <td class="r ref">${f2(r.ref)}</td><td class="r ceil">${f2(r.ceil)}</td><td class="r floor">${f2(r.floor)}</td>
          <td class="r px ${r.cls}">${f2(r.last)}</td><td class="r ${r.cls}">${sg(d)}</td><td class="r ${r.cls}">${sg(r.pct)}%</td>
          <td class="r">${big(r.vol)}</td>
          <td class="r ${r.bid != null ? 'up' : ''}" title="${r.bidq != null ? 'KL ' + r.bidq.toLocaleString('vi-VN') : ''}">${r.bid != null ? f2(r.bid) : '–'}</td>
          <td class="r ${r.ask != null ? 'down' : ''}" title="${r.askq != null ? 'KL ' + r.askq.toLocaleString('vi-VN') : ''}">${r.ask != null ? f2(r.ask) : '–'}</td>
          <td class="r">${f2(r.high)}</td><td class="r">${f2(r.low)}</td></tr>`;
      }).join('') : `<tr><td colspan="${COLS.length}" class="empty">Không có mã nào khớp bộ lọc.</td></tr>`}</tbody>`;
    rows.forEach((r) => B.prev.set(r.sym, r.lastU));
    const any = list.some((r) => r.hasDepth);
    const srcTxt = MKT.session === 'closed' ? 'Ngoài giờ giao dịch' : MKT.source === 'ws' ? 'DNSE realtime' : MKT.source === 'mixed' ? 'Realtime một phần' : 'Giá trễ khoảng 1 phút';
    $('bd-src').textContent = srcTxt + (any ? '' : ' · chưa có giá mua/bán');
    $('bd-src').className = 'bd-src ' + (MKT.source === 'ws' && MKT.session !== 'closed' ? 'on' : '');
  }

  /* ---------- Thông tin thị trường (tính trên rổ VN30) ---------- */
  function renderSide(vn30) {
    if (!vn30.length) { $('bd-side').innerHTML = ''; return; }
    const up = vn30.filter((r) => r.last > r.ref && r.last < r.ceil).length;
    const down = vn30.filter((r) => r.last < r.ref && r.last > r.floor).length;
    const ceil = vn30.filter((r) => r.last >= r.ceil).length, floor = vn30.filter((r) => r.last <= r.floor).length;
    const flat = vn30.length - up - down - ceil - floor;
    const T = vn30.length, w = (n) => (n / T) * 100;
    const list = (rows, fmt) => rows.map((r) => `<button class="mv" data-goto="${esc(r.sym)}"><b>${esc(r.sym)}</b><span class="${r.cls}">${f2(r.last)}</span><span class="${r.cls}">${fmt(r)}</span></button>`).join('');
    const gain = vn30.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
    const lose = vn30.filter((r) => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5);
    const vol = vn30.slice().sort((a, b) => b.vol * b.last - a.vol * a.last).slice(0, 5);
    const sec = new Map();
    vn30.forEach((r) => { const s = sec.get(r.sector) || { n: 0, sum: 0, vol: 0 }; s.n++; s.sum += r.pct; s.vol += r.vol * r.last * 1000; sec.set(r.sector, s); });
    const tiles = [...sec.entries()].map(([name, s]) => ({ name, n: s.n, avg: s.sum / s.n, val: s.vol })).sort((a, b) => b.avg - a.avg);
    const tile = (t) => {
      const a = Math.min(Math.abs(t.avg) / 3, 1) * 0.55 + 0.08, c = t.avg >= 0 ? '46,189,133' : '246,70,93';
      return `<button class="hm" data-bsector="${esc(t.name)}" style="background:rgba(${c},${a})" aria-label="Lọc ngành ${esc(t.name)}"><b>${esc(t.name)}</b><span>${sg(t.avg)}%</span><small>${t.n} mã · ${big(t.val)} đ</small></button>`;
    };
    const val = vn30.reduce((a, r) => a + r.vol * r.last * 1000, 0);
    $('bd-side').innerHTML = `
      <div class="bd-card"><h3>Độ rộng rổ VN30</h3>
        <div class="breadth big"><i class="c" style="width:${w(ceil)}%"></i><i class="u" style="width:${w(up)}%"></i><i class="f" style="width:${w(flat)}%"></i><i class="d" style="width:${w(down)}%"></i><i class="fl" style="width:${w(floor)}%"></i></div>
        <div class="mc-sub"><span class="ceil">${ceil} trần</span> · <span class="up">${up} tăng</span> · <span class="ref">${flat} đứng</span> · <span class="down">${down} giảm</span> · <span class="floor">${floor} sàn</span></div>
        <div class="mc-sub">Tổng giá trị giao dịch 30 mã: <b>${big(val)} đ</b></div></div>
      <div class="bd-card"><h3>Tăng mạnh nhất</h3>${gain.length ? list(gain, (r) => sg(r.pct) + '%') : '<p class="bd-none">Chưa có mã tăng.</p>'}</div>
      <div class="bd-card"><h3>Giảm mạnh nhất</h3>${lose.length ? list(lose, (r) => sg(r.pct) + '%') : '<p class="bd-none">Chưa có mã giảm.</p>'}</div>
      <div class="bd-card"><h3>Thanh khoản cao nhất</h3>${list(vol, (r) => big(r.vol * r.last * 1000) + ' đ')}</div>
      <div class="bd-card"><h3>Nhóm ngành (trung bình % của các mã VN30)</h3><div class="hm-grid">${tiles.map(tile).join('')}</div>
        <p class="bd-none">Bấm một nhóm để lọc bảng giá.</p></div>`;
  }

  function buildSectors() {
    const sel = $('bd-sector'), secs = [...new Set(UNIVERSE.map((x) => x.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    sel.innerHTML = '<option value="">Mọi ngành</option>' + secs.map((s) => `<option>${esc(s)}</option>`).join('');
    sel.value = B.sector; B.built = true;
  }

  function render() {
    if ($('view-board').hidden || typeof UNIVERSE === 'undefined' || !UNIVERSE.length) return;
    if (!B.built) buildSectors();
    const rows = allRows();
    renderCards(rows.filter((r) => r.vn30));
    renderTable(rows);
    renderSide(rows.filter((r) => r.vn30));
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.bgroup) {
      B.group = t.dataset.bgroup;
      document.querySelectorAll('[data-bgroup]').forEach((b) => b.setAttribute('aria-pressed', b === t));
      return render();
    }
    if (t.dataset.bsort) {
      const k = t.dataset.bsort;
      B.sort = B.sort.key === k ? { key: k, dir: -B.sort.dir } : { key: k, dir: k === 'sym' ? 1 : -1 };
      return render();
    }
    if (t.dataset.bsector) { B.sector = B.sector === t.dataset.bsector ? '' : t.dataset.bsector; $('bd-sector').value = B.sector; return render(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'bd-q') { B.q = e.target.value; render(); } });
  document.addEventListener('change', (e) => { if (e.target.id === 'bd-sector') { B.sector = e.target.value; render(); } });
  document.addEventListener('lb:view', (e) => { if (e.detail === 'board') { B.prev.clear(); render(); } });
  document.addEventListener('lb:tick', render);

  // Mở thẳng từ địa chỉ #bang-gia khi dữ liệu giá đã sẵn sàng
  if (location.hash === '#bang-gia') {
    let n = 0;
    const open = () => { if (typeof UNIVERSE !== 'undefined' && UNIVERSE.length && typeof setView === 'function') setView('board'); else if (++n < 60) setTimeout(open, 250); };
    open();
  }
})();
