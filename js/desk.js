/**
 * js/desk.js — bàn làm việc môi giới: khách hàng ủy quyền (DNSE care-by), tài sản từng khách, phiếu lệnh.
 * Chỉ hiện với tài khoản môi giới. Chạy trong IIFE để không đụng biến của js/app.js.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m) => (typeof toast === 'function' ? toast(m) : console.log(m));
  const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
  const vnd = (v) => (num(v) == null ? '–' : Math.round(+v).toLocaleString('vi-VN') + ' đ');
  const big = (v) => { const n = num(v); if (n == null) return '–'; return n >= 1e9 ? (n / 1e9).toFixed(2) + ' tỷ' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' tr' : Math.round(n).toLocaleString('vi-VN'); };
  // DNSE có thể trả giá theo đồng hoặc nghìn đồng: quy về nghìn đồng để hiển thị như bảng giá
  const k = (v) => { const n = num(v); return n == null ? null : n > 1000 ? n / 1000 : n; };
  const px = (v) => (k(v) == null ? '–' : k(v).toFixed(2));
  const hhmm = (s) => { const d = new Date(s); return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); };
  const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);

  const STATUS = {
    draft: ['Nháp', ''], pending_client: ['Chờ khách xác nhận', 'wait'], pending_broker: ['Chờ môi giới', 'wait'],
    approved: ['Đã duyệt, chờ gửi', 'approved'], sent: ['Đã gửi DNSE', 'sent'], failed: ['Gửi lỗi', 'failed'],
    rejected: ['Khách từ chối', 'rejected'], expired: ['Hết hạn', 'cx'], cancelled: ['Đã hủy', 'cx'],
  };
  const SOURCE = { app: 'Khách xác nhận trong app', phone: 'Điện thoại', chat: 'Tin nhắn', in_person: 'Gặp trực tiếp' };

  const D = { broker: false, clients: [], sel: null, tickets: [], side: 'B', trading: { active: false, realTrading: false }, q: '', armed: null };

  async function api(url, opts = {}) {
    const r = await fetch(url, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let j = null; try { j = await r.json(); } catch { /* rỗng */ }
    if (!r.ok) throw Object.assign(new Error(j?.error || `Lỗi ${r.status}`), { status: r.status, code: j?.code });
    return j;
  }
  const msg = (el, text, kind = 'err') => { el.innerHTML = text ? `<div class="msg ${kind}">${esc(text)}</div>` : ''; };

  /* ---------- Danh sách khách ---------- */
  function renderClients() {
    const q = D.q.trim().toLowerCase();
    const list = D.clients.filter((c) => !q || [c.name, c.accountNo, c.custodyCode].some((x) => String(x || '').toLowerCase().includes(q)));
    $('desk-count').textContent = D.clients.length ? `${D.clients.length} tiểu khoản` : '';
    $('desk-clients').innerHTML = list.length ? list.map((c) => `
      <button class="cl" data-client="${esc(c.accountNo)}" aria-current="${D.sel?.client?.accountNo === c.accountNo}">
        <span class="cl-name">${esc(c.name || c.accountNo)}</span><span class="cl-nav">${big(c.nav.total)}</span>
        <span class="cl-sub">${esc(c.accountNo)}${c.custodyCode ? ' · ' + esc(c.custodyCode) : ''}</span>
        <span>${c.canTrade ? '<span class="role trade">Giao dịch</span>' : '<span class="role view">Theo dõi</span>'}</span>
      </button>`).join('')
      : `<div class="empty">${D.clients.length ? 'Không có khách khớp tìm kiếm.' : '<b>Chưa có khách nào</b>Khách cần liên kết với bạn trên App/Web Entrade X và chọn phạm vi ủy quyền. Sau đó bấm Làm mới.'}</div>`;
  }
  function renderSummary(s) {
    $('desk-sum').innerHTML = `<div><span>Tổng tài sản</span><b>${big(s.nav)}</b></div><div><span>Ủy quyền GD</span><b>${s.canTrade}</b></div><div><span>Chỉ theo dõi</span><b>${s.viewOnly}</b></div>`;
  }

  /* ---------- Phiên giao dịch (OTP môi giới) ---------- */
  function renderOtp() {
    const t = D.trading;
    const head = !t.realTrading
      ? '<div class="msg warn">Đặt lệnh thật đang TẮT trên máy chủ. Vẫn tạo và lưu phiếu lệnh được.</div>' : '';
    $('desk-otp').innerHTML = head + (t.active
      ? `<div class="row-end"><span>Phiên giao dịch DNSE <b class="up">đang mở</b></span><button type="button" data-otp="end">Kết thúc phiên</button></div>`
      : `<div>Cần OTP của bạn để gửi lệnh lên DNSE (hiệu lực 8 giờ).</div>
         <div class="row-end"><button type="button" data-otp="send">Gửi OTP qua email</button>
           <select class="inp" id="otp-type" aria-label="Loại OTP"><option value="email">OTP email</option><option value="smart">Smart OTP</option></select></div>
         <div class="row-end"><input class="inp" id="otp-code" inputmode="numeric" maxlength="8" placeholder="Mã OTP" aria-label="Mã OTP"><button type="button" data-otp="verify">Xác thực</button></div>`);
  }

  /* ---------- Chi tiết khách ---------- */
  function listOf(v, keys) {
    if (Array.isArray(v)) return v;
    for (const key of keys) if (Array.isArray(v?.[key])) return v[key];
    return [];
  }
  function renderDetail() {
    const box = $('desk-detail');
    if (!D.sel) { box.innerHTML = '<div class="empty"><b>Chọn một khách hàng</b>Tài sản, danh mục và sổ lệnh của khách sẽ hiện ở đây.</div>'; return; }
    const { client: c, balance, positions, orders, loading } = D.sel;
    const head = `<div class="dt-head"><div><h1>${esc(c.name || c.accountNo)}</h1>
      <p>Tiểu khoản ${esc(c.accountNo)}${c.custodyCode ? ' · Lưu ký ' + esc(c.custodyCode) : ''} · ${c.canTrade ? '<span class="role trade">Ủy quyền giao dịch</span>' : '<span class="role view">Chỉ theo dõi</span>'}</p></div>
      <button class="ghost" data-refresh-client style="height:32px;padding:0 12px">Làm mới</button></div>`;
    if (loading) { box.innerHTML = head + '<div class="empty">Đang tải dữ liệu từ DNSE…</div>'; return; }

    const st = balance?.stock || balance || {};
    const kv = balance?.error ? `<div class="msgs" style="padding:12px 18px"><div class="msg err">${esc(balance.error)}</div></div>`
      : `<div class="dt-kv"><div><span>Tiền khả dụng</span><b>${vnd(st.availableCash)}</b></div><div><span>Tổng tiền</span><b>${vnd(st.totalCash)}</b></div>
         <div><span>Có thể rút</span><b>${vnd(st.withdrawableCash)}</b></div><div><span>Dư nợ</span><b class="${num(st.totalDebt) ? 'down' : ''}">${vnd(st.totalDebt)}</b></div>
         <div><span>Tổng tài sản ròng</span><b>${vnd(c.nav.total)}</b></div></div>`;

    const pos = listOf(positions, ['deals', 'positions', 'data']).filter((p) => (p.status || 'OPEN') === 'OPEN');
    const posHtml = positions?.error ? `<div class="msg err" style="margin:0 18px">${esc(positions.error)}</div>`
      : !pos.length ? '<div class="empty">Khách chưa nắm giữ mã nào.</div>'
      : `<table><thead><tr><th>Mã</th><th class="r">KL</th><th class="r">Giá vốn</th><th class="r">Giá TT</th><th class="r">Lãi/lỗ</th><th class="r">%</th></tr></thead><tbody>${pos.map((p) => {
          const q = num(p.openQuantity ?? p.accumulateQuantity ?? p.quantity) || 0, cost = k(p.costPrice), mkt = k(p.marketPrice);
          const pl = cost != null && mkt != null ? (mkt - cost) * 1000 * q : null, pct = cost ? (mkt - cost) / cost * 100 : null, cls = pl == null ? '' : pl >= 0 ? 'up' : 'down';
          return `<tr><td><button class="link" data-goto="${esc(p.symbol)}">${esc(p.symbol)}</button></td><td class="r">${q.toLocaleString('vi-VN')}</td><td class="r">${px(p.costPrice)}</td><td class="r">${px(p.marketPrice)}</td>
            <td class="r ${cls}">${pl == null ? '–' : (pl >= 0 ? '+' : '') + Math.round(pl).toLocaleString('vi-VN')}</td><td class="r ${cls}">${pct == null ? '–' : (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'}</td></tr>`;
        }).join('')}</tbody></table>`;

    const ords = listOf(orders, ['orders', 'data']);
    const ordHtml = orders?.error ? `<div class="msg err" style="margin:0 18px">${esc(orders.error)}</div>`
      : !ords.length ? '<div class="empty">Chưa có lệnh nào trong ngày.</div>'
      : `<table><thead><tr><th>Giờ</th><th>Mã</th><th>Lệnh</th><th>Loại</th><th class="r">Giá</th><th class="r">KL</th><th class="r">Khớp</th><th>Trạng thái</th></tr></thead><tbody>${ords.map((o) => `
          <tr><td>${esc(hhmm(o.createdDate || o.transDate))}</td><td><b>${esc(o.symbol)}</b></td><td class="${o.side === 'NB' ? 'up' : 'down'}">${o.side === 'NB' ? 'Mua' : 'Bán'}</td><td>${esc(o.orderType)}</td>
          <td class="r">${o.orderType === 'LO' ? px(o.price) : esc(o.orderType)}</td><td class="r">${(num(o.quantity) || 0).toLocaleString('vi-VN')}</td><td class="r">${(num(o.fillQuantity) || 0).toLocaleString('vi-VN')}</td><td>${esc(o.orderStatus)}</td></tr>`).join('')}</tbody></table>`;

    const mine = D.tickets.filter((t) => t.account_no === c.accountNo);
    box.innerHTML = head + kv + `<div class="dt-sec">Danh mục</div>${posHtml}<div class="dt-sec">Sổ lệnh trong ngày (DNSE)</div>${ordHtml}`
      + `<div class="dt-sec">Phiếu lệnh của khách trên Lật Bài</div>${mine.length ? mine.map(ticketHtml).join('') : '<div class="empty">Chưa có phiếu lệnh.</div>'}`;
  }

  /* ---------- Phiếu lệnh ---------- */
  function ticketHtml(t) {
    const [label, cls] = STATUS[t.status] || [t.status, ''];
    const text = `${t.side === 'B' ? 'Mua' : 'Bán'} ${Number(t.qty).toLocaleString('vi-VN')} ${t.symbol} ${t.type === 'LO' ? 'giá ' + Number(t.price).toFixed(2) : t.type}`;
    const canSend = t.status === 'approved', canCancel = ['draft', 'pending_client', 'pending_broker', 'approved'].includes(t.status);
    return `<div class="tk"><div class="tk-top"><b class="${t.side === 'B' ? 'up' : 'down'}">${esc(text)}</b><span class="pill ${cls}">${esc(label)}</span></div>
      <small>${esc(t.client_name || t.account_no)} · ${esc(SOURCE[t.source] || t.source)}${t.instructed_at ? ' lúc ' + esc(hhmm(t.instructed_at)) : ''}${t.dnse_order_id ? ' · Lệnh DNSE #' + esc(t.dnse_order_id) : ''}</small>
      ${t.instruction_note ? `<div><small>“${esc(t.instruction_note)}”</small></div>` : ''}
      ${t.error ? `<div class="tk-err">${esc(t.error)}</div>` : ''}
      ${canSend || canCancel ? `<div class="tk-actions">${canSend ? `<button class="go${D.armed === t.id ? ' arm' : ''}" data-send="${t.id}">${D.armed === t.id ? 'Bấm lần nữa để gửi' : 'Gửi lệnh'}</button>` : ''}${canCancel ? `<button data-cancel-ticket="${t.id}">Hủy phiếu</button>` : ''}</div>` : ''}
    </div>`;
  }
  function renderTickets() {
    $('desk-tickets').innerHTML = D.tickets.length ? D.tickets.slice(0, 30).map(ticketHtml).join('') : '<div class="empty">Chưa có phiếu lệnh nào.</div>';
    if (D.sel && !D.sel.loading) renderDetail();
  }

  function renderForm() {
    const c = D.sel?.client;
    $('desk-for').innerHTML = !c ? 'Chọn khách ở cột bên trái.'
      : c.canTrade ? `Đặt cho <b>${esc(c.name || c.accountNo)}</b> · ${esc(c.accountNo)}`
      : `<b>${esc(c.name || c.accountNo)}</b> chỉ ủy quyền theo dõi. Khách cần cấp quyền giao dịch trên Entrade X.`;
    $('dk-submit').disabled = !c || !c.canTrade;
    document.querySelectorAll('[data-dside]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.dside === D.side));
    $('dk-submit').className = 'cta ' + (D.side === 'B' ? 'buy' : 'sell');
    $('dk-px').disabled = $('dk-type').value !== 'LO';
    $('dk-instr').hidden = $('dk-src').value === 'app';
  }

  /* ---------- Tải dữ liệu ---------- */
  async function loadDesk(fresh = false) {
    $('desk-clients').innerHTML = '<div class="empty">Đang tải danh sách khách…</div>';
    try {
      const r = await api('/api/broker/clients' + (fresh ? '?fresh=1' : ''));
      D.clients = r.clients; D.trading = r.trading;
      renderSummary(r.summary); renderClients(); renderOtp();
    } catch (e) {
      D.clients = [];
      $('desk-sum').innerHTML = '';
      $('desk-clients').innerHTML = `<div class="empty"><b>Không tải được danh sách khách</b>${esc(e.message)}</div>`;
    }
    await loadTickets();
  }
  async function loadTickets() {
    try { D.tickets = (await api('/api/broker/tickets')).tickets; } catch (e) { D.tickets = []; }
    renderTickets();
  }
  async function selectClient(acc) {
    const c = D.clients.find((x) => x.accountNo === acc);
    if (!c) return;
    D.sel = { client: c, loading: true };
    renderClients(); renderDetail(); renderForm();
    try {
      const d = await api('/api/broker/client?account=' + encodeURIComponent(acc));
      if (D.sel?.client.accountNo !== acc) return; // đã chọn khách khác trong lúc chờ
      D.sel = { client: d.client, balance: d.balance, positions: d.positions, orders: d.orders };
    } catch (e) {
      D.sel = { client: c, balance: { error: e.message }, positions: { error: e.message }, orders: { error: e.message } };
    }
    renderDetail(); renderForm();
  }

  /* ---------- Thao tác ---------- */
  async function createTicket(e) {
    e.preventDefault();
    const c = D.sel?.client; if (!c) return;
    const type = $('dk-type').value, source = $('dk-src').value;
    const body = {
      action: 'create', account: c.accountNo, symbol: $('dk-sym').value.trim().toUpperCase(), side: D.side, type,
      qty: parseInt($('dk-qty').value.replace(/[^\d]/g, ''), 10), source,
      ...(type === 'LO' ? { price: parseFloat($('dk-px').value.replace(',', '.')) } : {}),
      ...(source !== 'app' ? { instructedAt: $('dk-at').value ? new Date($('dk-at').value).toISOString() : null, note: $('dk-note').value.trim() } : {}),
    };
    $('dk-submit').disabled = true; msg($('dk-msg'), '');
    try {
      const r = await api('/api/broker/tickets', { method: 'POST', body });
      msg($('dk-msg'), `Đã tạo phiếu: ${r.preview.text}, khoảng ${vnd(r.preview.estValueVnd)}.${r.ticket.status === 'pending_client' ? ' Đang chờ khách xác nhận.' : ''}`, 'warn');
      $('dk-note').value = ''; $('dk-at').value = localNow();
      await loadTickets();
    } catch (err) { msg($('dk-msg'), err.message); }
    finally { renderForm(); }
  }

  async function sendTicket(id) {
    if (D.armed !== id) { // hai lần bấm: tránh gửi nhầm lệnh thật
      D.armed = id; renderTickets();
      setTimeout(() => { if (D.armed === id) { D.armed = null; renderTickets(); } }, 5000);
      return;
    }
    D.armed = null;
    try {
      const r = await api('/api/broker/send', { method: 'POST', body: { id } });
      say(`Đã gửi lệnh lên DNSE${r.ticket?.dnse_order_id ? ' (#' + r.ticket.dnse_order_id + ')' : ''}.`);
    } catch (e) {
      say(e.message);
      if (e.code === 'need_otp') { D.trading.active = false; renderOtp(); }
    }
    await loadTickets();
    if (D.sel) selectClient(D.sel.client.accountNo);
  }

  async function otp(action) {
    try {
      if (action === 'send') { await api('/api/dnse/otp', { method: 'POST', body: { action: 'send' } }); say('Đã gửi OTP về email đăng ký với DNSE.'); return; }
      if (action === 'verify') {
        const code = $('otp-code').value.trim();
        await api('/api/dnse/otp', { method: 'POST', body: { action: 'verify', otp: code, type: $('otp-type').value } });
        D.trading.active = true; say('Đã mở phiên giao dịch DNSE (8 giờ).');
      }
      if (action === 'end') { await api('/api/dnse/otp', { method: 'POST', body: { action: 'end' } }); D.trading.active = false; say('Đã kết thúc phiên giao dịch.'); }
    } catch (e) { say(e.message); }
    renderOtp();
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !t.closest('#view-desk')) return;
    if (t.hasAttribute('data-refresh-list')) return loadDesk(true);
    if (t.dataset.client) return selectClient(t.dataset.client);
    if (t.dataset.dside) { D.side = t.dataset.dside; return renderForm(); }
    if (t.hasAttribute('data-refresh-client') && D.sel) return selectClient(D.sel.client.accountNo);
    if (t.dataset.send) return sendTicket(Number(t.dataset.send));
    if (t.dataset.cancelTicket) {
      return api('/api/broker/tickets', { method: 'POST', body: { action: 'cancel', id: Number(t.dataset.cancelTicket) } })
        .then(() => { say('Đã hủy phiếu.'); loadTickets(); }).catch((err) => say(err.message));
    }
    if (t.dataset.otp) return otp(t.dataset.otp);
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'desk-form') createTicket(e); });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'desk-q') { D.q = e.target.value; renderClients(); }
    if (e.target.id === 'dk-sym') { // gợi ý giá theo giá khớp hiện tại nếu mã có trên bảng giá
      const s = e.target.value.trim().toUpperCase();
      if (typeof M !== 'undefined' && M[s] && !$('dk-px').value) $('dk-px').value = (M[s].lastU / 100).toFixed(2);
    }
  });
  document.addEventListener('change', (e) => { if (['dk-type', 'dk-src'].includes(e.target.id)) renderForm(); });

  document.addEventListener('lb:view', (e) => {
    if (e.detail !== 'desk') return;
    if (!D.broker) { if (typeof setView === 'function') setView('trade'); return; }
    if (!$('dk-at').value) $('dk-at').value = localNow();
    renderDetail(); renderForm(); loadDesk();
  });

  document.addEventListener('lb:user', async (e) => {
    D.broker = false;
    if (e.detail) {
      try { D.broker = !!(await api('/api/brokers')).owner; } catch { D.broker = false; }
    }
    $('nav-desk').hidden = !D.broker;
    const onDesk = !$('view-desk').hidden;
    if (!D.broker && onDesk && typeof setView === 'function') setView('trade');
    if (D.broker && location.hash === '#khach-hang') { // mở thẳng màn khách hàng khi bảng giá đã sẵn sàng
      let n = 0; const tryOpen = () => { if (typeof UNIVERSE !== 'undefined' && UNIVERSE.length) setView('desk'); else if (++n < 40) setTimeout(tryOpen, 250); };
      tryOpen();
    }
  });

  // Làm mới danh sách phiếu mỗi 20 giây khi đang ở màn khách hàng
  setInterval(() => { if (D.broker && !$('view-desk').hidden) loadTickets(); }, 20000);
})();
