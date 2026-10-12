/**
 * js/portal.js — cổng khách hàng: nhận lời mời của môi giới, xem khuyến nghị, xác nhận hoặc từ chối phiếu lệnh,
 * xem tài sản của chính mình. Hiện với người dùng đã liên kết (hoặc đang mở link mời).
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m) => (typeof toast === 'function' ? toast(m) : console.log(m));
  const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
  const vnd = (v) => (num(v) == null ? '–' : Math.round(+v).toLocaleString('vi-VN') + ' đ');
  const k = (v) => { const n = num(v); return n == null ? null : n > 1000 ? n / 1000 : n; };
  const px = (v) => (k(v) == null ? '–' : k(v).toFixed(2));
  const when = (s) => { const d = new Date(s); return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); };
  const day = (s) => { const d = new Date(s); return Number.isNaN(+d) ? '' : d.toLocaleDateString('vi-VN'); };

  const P = { user: null, data: null, port: {}, busy: false, token: null, loading: false };
  const TOKEN_KEY = 'lb_invite';

  async function api(url, opts = {}) {
    const r = await fetch(url, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let j = null; try { j = await r.json(); } catch { /* rỗng */ }
    if (!r.ok) throw Object.assign(new Error(j?.error || `Lỗi ${r.status}`), { status: r.status, code: j?.code });
    return j;
  }

  /* ---------- Mã mời trên URL: ?moi=... ---------- */
  function captureToken() {
    const q = new URLSearchParams(location.search), t = q.get('moi');
    if (!t) return;
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* chặn lưu trữ */ }
    P.token = t;
    history.replaceState(null, '', location.pathname + (location.hash || ''));   // mã không nằm lại trên thanh địa chỉ
  }
  const savedToken = () => P.token || (() => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const clearToken = () => { P.token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } };

  async function acceptToken(token) {
    try {
      const r = await api('/api/portal/accept', { method: 'POST', body: { token } });
      clearToken();
      say(`Đã liên kết tiểu khoản ${r.account}${r.name ? ' của ' + r.name : ''} với môi giới.`);
      return true;
    } catch (e) {
      if (e.status !== 429) clearToken();
      say(e.message);
      return false;
    }
  }

  /* ---------- Hiển thị ---------- */
  const STATUS = { approved: 'Đã xác nhận, môi giới sẽ gửi lệnh', sent: 'Đã gửi lên DNSE', failed: 'Gửi lỗi', rejected: 'Bạn đã từ chối', expired: 'Hết hạn', cancelled: 'Môi giới đã hủy' };
  const tkText = (t) => `${t.side === 'B' ? 'MUA' : 'BÁN'} ${Number(t.qty).toLocaleString('vi-VN')} ${t.symbol} ${t.type === 'LO' ? 'giá ' + Number(t.price).toFixed(2) : 'lệnh ' + t.type}`;

  function pendingCard(t) {
    const exp = Math.max(0, Math.round((Date.parse(t.created_at) + 24 * 3600e3 - Date.now()) / 3600e3));
    const est = t.type === 'LO' ? Number(t.price) * 1000 * t.qty : null;
    return `<div class="pcard attn"><div class="pcard-body">
      <div class="ticket-big ${t.side === 'B' ? 'up' : 'down'}">${esc(tkText(t))}</div>
      <div class="pmeta">Tiểu khoản ${esc(t.account_no)} · môi giới đề xuất lúc ${esc(when(t.created_at))}${est ? ' · giá trị khoảng ' + vnd(est) : ''} · còn hiệu lực khoảng ${exp} giờ</div>
      <div class="pnote">Bấm <b>Xác nhận</b> nghĩa là bạn đồng ý để môi giới đặt đúng lệnh này trên tài khoản của bạn tại DNSE. Môi giới sẽ gửi trong vòng 15 phút sau khi bạn xác nhận. Lệnh có thể khớp ở giá khác giá bạn thấy nếu thị trường biến động. Nếu bạn không chắc, hãy bấm Từ chối và hỏi lại môi giới.</div>
      <div class="pactions"><button class="yes" data-decide="${t.id}" data-approve="1">Xác nhận lệnh</button><button class="no" data-decide="${t.id}" data-approve="0">Từ chối</button></div>
    </div></div>`;
  }
  function adviceCard(a) {
    const side = a.side === 'B' ? '<span class="role trade">Mua</span>' : a.side === 'S' ? '<span class="role view" style="background:rgba(246,70,93,.12);color:var(--down)">Bán</span>' : '<span class="role view">Theo dõi</span>';
    const entry = a.entry_low || a.entry_high ? `${a.entry_low ? Number(a.entry_low).toFixed(2) : '…'} – ${a.entry_high ? Number(a.entry_high).toFixed(2) : '…'}` : '–';
    return `<div class="pcard" data-advice="${a.id}"><div class="pcard-body">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><b style="font-size:16px">${a.seen ? '' : '<span class="new-dot" aria-label="Mới"></span>'}${esc(a.symbol)} ${side}</b><span class="pmeta" style="margin:0">${esc(day(a.created_at))}${a.expired ? ' · hết hiệu lực' : a.valid_until ? ' · đến ' + esc(day(a.valid_until)) : ''}</span></div>
      <div class="pnote" style="margin-top:8px;color:var(--text)">${esc(a.thesis).replace(/\n/g, '<br>')}</div></div>
      <div class="adv-grid"><div><span>Vùng giá vào</span><b>${entry}</b></div><div><span>Mục tiêu</span><b class="up">${a.target ? Number(a.target).toFixed(2) : '–'}</b></div><div><span>Cắt lỗ</span><b class="down">${a.stop ? Number(a.stop).toFixed(2) : '–'}</b></div></div>
    </div>`;
  }
  function ticketRow(t) {
    return `<div class="pcard"><div class="pcard-body" style="padding:11px 16px"><div style="display:flex;justify-content:space-between;gap:10px"><b class="${t.side === 'B' ? 'up' : 'down'}">${esc(tkText(t))}</b><span class="pmeta" style="margin:0">${esc(when(t.created_at))}</span></div>
      <div class="pmeta">${esc(STATUS[t.status] || t.status)}${t.dnse_order_id ? ' · lệnh #' + esc(t.dnse_order_id) : ''}${t.dnse_status ? ' · DNSE: ' + esc(t.dnse_status) : ''}</div></div></div>`;
  }
  function portfolioCard(acc) {
    const p = P.port[acc];
    if (!p) return '<div class="pmeta">Đang tải…</div>';
    if (p.error) return `<div class="msg warn">${esc(p.error)}</div>`;
    const st = p.balance?.stock || {};
    const list = (Array.isArray(p.positions) ? p.positions : p.positions?.deals || []).filter((x) => (x.status || 'OPEN') === 'OPEN');
    return `<div class="adv-grid" style="border-top:0"><div><span>Tiền khả dụng</span><b>${vnd(st.availableCash)}</b></div><div><span>Tổng tiền</span><b>${vnd(st.totalCash)}</b></div><div><span>Dư nợ</span><b>${vnd(st.totalDebt)}</b></div></div>`
      + (list.length ? `<table><thead><tr><th>Mã</th><th class="r">KL</th><th class="r">Giá vốn</th><th class="r">Giá TT</th><th class="r">Lãi/lỗ</th></tr></thead><tbody>${list.map((x) => {
        const q = num(x.openQuantity ?? x.accumulateQuantity) || 0, c = k(x.costPrice), m = k(x.marketPrice), pl = c != null && m != null ? (m - c) * 1000 * q : null;
        return `<tr><td><b>${esc(x.symbol)}</b></td><td class="r">${q.toLocaleString('vi-VN')}</td><td class="r">${px(x.costPrice)}</td><td class="r">${px(x.marketPrice)}</td><td class="r ${pl == null ? '' : pl >= 0 ? 'up' : 'down'}">${pl == null ? '–' : (pl >= 0 ? '+' : '') + Math.round(pl).toLocaleString('vi-VN')}</td></tr>`;
      }).join('')}</tbody></table>` : '<div class="pmeta" style="padding:0 16px 12px">Chưa nắm giữ mã nào.</div>');
  }

  function render() {
    const box = $('portal-body'), d = P.data;
    if (!P.user) { box.innerHTML = '<div><h1>Tài khoản của tôi</h1><p class="lead">Đăng nhập để xem khuyến nghị và xác nhận lệnh từ môi giới của bạn.</p></div>'; return; }
    if (P.loading && !d) { box.innerHTML = '<div class="empty">Đang tải…</div>'; return; }
    const tok = savedToken();
    const invite = `<div class="pcard"><div class="pcard-body invite-box"><div><b>Có mã mời từ môi giới?</b><div class="pmeta">Dán mã (hoặc mở link môi giới gửi) để liên kết tiểu khoản của bạn với Lật Bài.</div></div>
      <div class="row"><input class="inp" id="invite-code" placeholder="Mã mời" value="${esc(tok || '')}" autocomplete="off"><button class="btn-primary" id="invite-go" style="height:38px">Liên kết</button></div></div></div>`;
    if (!d || !d.linked) {
      box.innerHTML = `<div><h1>Tài khoản của tôi</h1><p class="lead">Khi liên kết với môi giới, bạn sẽ nhận khuyến nghị đầu tư, xác nhận lệnh môi giới đề xuất ngay trong ứng dụng, và xem tài sản của mình.</p></div>${invite}
        <div class="pnote">Để môi giới theo dõi hoặc đặt lệnh giúp bạn, bạn cũng cần tự cấp quyền cho môi giới trên App/Web Entrade X của DNSE. Lật Bài không bao giờ hỏi mật khẩu DNSE của bạn.</div>`;
      return;
    }
    box.innerHTML = `<div><h1>Tài khoản của tôi</h1><p class="lead">Bạn đã liên kết ${d.links.length} tiểu khoản. Mọi lệnh môi giới đặt thay bạn đều cần bạn xác nhận ở đây trước.</p></div>
      ${d.pending.length ? `<section><h2>Cần bạn xác nhận (${d.pending.length})</h2>${d.pending.map(pendingCard).join('')}</section>` : ''}
      <section><h2>Khuyến nghị từ môi giới</h2>${d.advice.length ? d.advice.map(adviceCard).join('') : '<div class="pmeta">Chưa có khuyến nghị nào.</div>'}</section>
      <section><h2>Tài sản của tôi</h2>${d.links.map((l) => `<div class="pcard"><div class="pcard-body" style="padding:11px 16px"><b>${esc(l.client_name || l.account_no)}</b><span class="pmeta"> · tiểu khoản ${esc(l.account_no)}</span></div>${portfolioCard(l.account_no)}</div>`).join('')}</section>
      ${d.tickets.length ? `<section><h2>Lệnh gần đây</h2>${d.tickets.slice(0, 15).map(ticketRow).join('')}</section>` : ''}
      <section><h2>Liên kết thêm</h2>${invite}</section>`;
  }

  /* ---------- Tải dữ liệu ---------- */
  async function load() {
    if (!P.user) { render(); return; }
    P.loading = true; if (!P.data) render();
    try { P.data = await api('/api/portal/summary'); } catch (e) { P.data = { linked: false, links: [], pending: [], tickets: [], advice: [] }; say(e.message); }
    P.loading = false;
    updateBadge(); render();
    (P.data.links || []).forEach((l) => loadPortfolio(l.account_no));
    // đánh dấu đã xem các khuyến nghị đang hiển thị
    (P.data.advice || []).filter((a) => !a.seen).forEach((a) => api('/api/portal/advice-seen', { method: 'POST', body: { id: a.id } }).catch(() => {}));
  }
  async function loadPortfolio(acc) {
    try { P.port[acc] = await api('/api/portal/portfolio?account=' + encodeURIComponent(acc)); }
    catch (e) { P.port[acc] = { error: e.message }; }
    if (!$('view-portal').hidden) render();
  }
  function updateBadge() {
    const n = P.data?.pending?.length || 0;
    $('portal-badge').textContent = n || '';
    $('nav-portal').hidden = !(P.user && (P.data?.linked || savedToken()));
  }

  async function decide(id, approve, btn) {
    if (P.busy) return; P.busy = true;
    document.querySelectorAll(`[data-decide="${id}"]`).forEach((b) => { b.disabled = true; });
    try {
      const r = await api('/api/portal/decide', { method: 'POST', body: { id, approve } });
      say(approve ? 'Đã xác nhận. Môi giới sẽ gửi lệnh trong vòng 15 phút.' : 'Đã từ chối lệnh.');
    } catch (e) { say(e.message); }
    P.busy = false;
    await load();
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.decide) {
      const approve = t.dataset.approve === '1';
      if (approve && !confirm('Xác nhận để môi giới đặt lệnh này trên tài khoản của bạn?')) return;
      return decide(Number(t.dataset.decide), approve);
    }
    if (t.id === 'invite-go') {
      const code = $('invite-code').value.trim();
      if (!code) return say('Dán mã mời vào ô trên.');
      t.disabled = true;
      if (await acceptToken(code)) { P.data = null; await load(); }
      t.disabled = false;
    }
  });

  document.addEventListener('lb:view', (e) => { if (e.detail === 'portal') load(); });
  document.addEventListener('lb:user', async (e) => {
    P.user = e.detail || null; P.data = null; P.port = {};
    if (!P.user) { updateBadge(); render(); if (!$('view-portal').hidden && typeof setView === 'function') setView('trade'); return; }
    const t = savedToken();
    if (t) { // vừa đăng nhập xong, nhận lời mời đang chờ
      if (await acceptToken(t) && typeof setView === 'function') {
        const wait = () => (typeof UNIVERSE !== 'undefined' && UNIVERSE.length ? setView('portal') : setTimeout(wait, 250));
        wait();
      }
    }
    try { P.data = await api('/api/portal/summary'); } catch { P.data = null; }
    updateBadge();
    if (P.data?.linked && location.hash === '#tai-khoan' && $('view-portal').hidden) {
      const wait = () => (typeof UNIVERSE !== 'undefined' && UNIVERSE.length ? setView('portal') : setTimeout(wait, 250));
      wait();
    }
  });

  // Mở link mời khi chưa đăng nhập: nhắc đăng nhập, mã được giữ lại trong sessionStorage
  captureToken();
  if (savedToken()) {
    const prompt = () => {
      const btn = $('btn-login');
      if (btn && !btn.hidden) { say('Bạn được môi giới mời liên kết. Hãy đăng nhập hoặc tạo tài khoản để tiếp tục.'); btn.click(); }
    };
    setTimeout(prompt, 1800);
  }

  // Làm mới định kỳ khi đang mở cổng
  setInterval(() => { if (P.user && !$('view-portal').hidden && !P.busy) load(); }, 30000);
})();
