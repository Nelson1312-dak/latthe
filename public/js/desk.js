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
  /** Gộp các deal cùng mã thành một dòng: cộng khối lượng, giá vốn bình quân gia quyền (nghìn đồng). */
  function groupPositions(list) {
    const m = new Map();
    for (const p of list) {
      const q = num(p.openQuantity ?? p.accumulateQuantity ?? p.quantity) || 0;
      if (!q) continue;
      const g = m.get(p.symbol) || { symbol: p.symbol, qty: 0, costSum: 0, costQty: 0, mkt: null };
      g.qty += q;
      if (k(p.costPrice) != null) { g.costSum += k(p.costPrice) * q; g.costQty += q; }
      if (k(p.marketPrice) != null) g.mkt = k(p.marketPrice);
      m.set(p.symbol, g);
    }
    return [...m.values()].map((g) => ({ symbol: g.symbol, qty: g.qty, cost: g.costQty ? g.costSum / g.costQty : null, mkt: g.mkt }));
  }
  const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);

  const STATUS = {
    draft: ['Nháp', ''], pending_client: ['Chờ khách xác nhận', 'wait'], pending_broker: ['Chờ môi giới', 'wait'],
    approved: ['Đã duyệt, chờ gửi', 'approved'], sent: ['Đã gửi DNSE', 'sent'], failed: ['Gửi lỗi', 'failed'],
    unknown: ['Chưa rõ — cần đối soát', 'failed'],
    rejected: ['Khách từ chối', 'rejected'], expired: ['Hết hạn', 'cx'], cancelled: ['Đã hủy', 'cx'],
  };
  const SOURCE = { app: 'Khách xác nhận trong app', phone: 'Điện thoại', chat: 'Tin nhắn', in_person: 'Gặp trực tiếp' };

  const D = { broker: false, clients: [], sel: null, tickets: [], side: 'B', trading: { active: false, realTrading: false }, q: '', armed: null,
    invite: null, links: [], advice: [], rt: null, recon: {}, xemHet: false };

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
      <div class="dt-head-act"><button class="ghost" data-to-adv>Phân tích</button><button class="ghost" data-invite>Mời khách</button><button class="ghost" data-refresh-client>Làm mới</button></div></div>`;
    const linked = D.links.some((l) => l.account_no === c.accountNo);
    const inv = D.invite && D.invite.account === c.accountNo
      ? `<div class="dt-invite"><b>Link mời cho ${esc(c.name || c.accountNo)}</b><small>Gửi riêng cho khách (Zalo, SMS). Dùng được một lần, hết hạn ${esc(hhmm(D.invite.expiresAt))}. Link này chỉ hiện ở đây một lần.</small>
          <div class="copy-box"><input class="inp" readonly value="${esc(D.invite.link)}" id="invite-link" aria-label="Link mời"><button type="button" data-copy>Sao chép</button></div></div>`
      : linked ? '<div class="dt-invite"><small><span class="role trade">Đã liên kết Lật Bài</span> Khách thấy khuyến nghị và xác nhận phiếu lệnh trong app.</small></div>' : '';
    if (loading) { box.innerHTML = head + '<div class="empty">Đang tải dữ liệu từ DNSE…</div>'; return; }

    const st = balance?.stock || balance || {};
    const kv = balance?.error ? `<div class="msgs" style="padding:12px 18px"><div class="msg err">${esc(balance.error)}</div></div>`
      : `<div class="dt-kv"><div><span>Tiền khả dụng</span><b>${vnd(st.availableCash)}</b></div><div><span>Tổng tiền</span><b>${vnd(st.totalCash)}</b></div>
         <div><span>Có thể rút</span><b>${vnd(st.withdrawableCash)}</b></div><div><span>Dư nợ</span><b class="${num(st.totalDebt) ? 'down' : ''}">${vnd(st.totalDebt)}</b></div>
         <div><span>Tổng tài sản ròng</span><b>${vnd(c.nav.total)}</b></div></div>`;

    const pos = groupPositions(listOf(positions, ['deals', 'positions', 'data']).filter((p) => (p.status || 'OPEN') === 'OPEN'));
    const posHtml = positions?.error ? `<div class="msg err" style="margin:0 18px">${esc(positions.error)}</div>`
      : !pos.length ? '<div class="empty">Khách chưa nắm giữ mã nào.</div>'
      : `<table><thead><tr><th>Mã</th><th class="r">KL</th><th class="r">Giá vốn</th><th class="r">Giá TT</th><th class="r">Lãi/lỗ</th><th class="r">%</th></tr></thead><tbody>${pos.map((p) => {
          const q = p.qty, cost = p.cost, mkt = p.mkt;
          const pl = cost != null && mkt != null ? (mkt - cost) * 1000 * q : null, pct = cost ? (mkt - cost) / cost * 100 : null, cls = pl == null ? '' : pl >= 0 ? 'up' : 'down';
          return `<tr><td><button class="link" data-goto="${esc(p.symbol)}">${esc(p.symbol)}</button></td><td class="r">${q.toLocaleString('vi-VN')}</td><td class="r">${px(p.cost)}</td><td class="r">${px(p.mkt)}</td>
            <td class="r ${cls}">${pl == null ? '–' : (pl >= 0 ? '+' : '') + Math.round(pl).toLocaleString('vi-VN')}</td><td class="r ${cls}">${pct == null ? '–' : (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'}</td></tr>`;
        }).join('')}</tbody></table>`;

    // MỘT bảng sổ lệnh. Trước đây có hai bảng cạnh nhau — "Sổ lệnh trong ngày (DNSE)" lấy bằng
    // REST và "Sự kiện lệnh realtime (DNSE WebSocket)" — cùng nói về CÙNG những lệnh đó, chỉ khác
    // đường lấy về. Môi giới chỉ có một câu hỏi: hôm nay khách đặt những lệnh gì, đến đâu rồi.
    // Giờ lấy sổ lệnh REST làm gốc (đầy đủ) rồi phủ trạng thái realtime lên theo dnse_order_id khi
    // có, vì dòng realtime đến sớm hơn. Bản thân đường realtime rút về một chấm trạng thái: nó là
    // cách lấy dữ liệu, không phải thứ môi giới cần đọc thành bảng.
    const ords = listOf(orders, ['orders', 'data']);
    const evAll = (D.rt?.events || []).filter((x) => x.account_no === c.accountNo);
    const evTheoId = new Map(evAll.map((x) => [String(x.dnse_order_id), x]));
    const moiNhat = evAll.length ? evAll.reduce((a, x) => (Date.parse(x.event_at) > Date.parse(a.event_at) ? x : a)) : null;
    const ordHtml = orders?.error ? `<div class="msg err dt-pad">${esc(orders.error)}</div>`
      : !ords.length ? '<div class="empty">Chưa có lệnh nào trong ngày.</div>'
      : `<table><thead><tr><th>Giờ</th><th>Mã</th><th>Lệnh</th><th>Loại</th><th class="r">Giá</th><th class="r">KL</th><th class="r">Khớp</th><th>Trạng thái</th></tr></thead><tbody>${ords.map((o) => {
          const e = evTheoId.get(String(o.id));
          const khop = num(e?.fill_quantity) ?? num(o.fillQuantity) ?? 0;
          const tt = e?.status || o.orderStatus;
          return `<tr><td>${esc(hhmm(o.createdDate || o.transDate))}</td><td><b>${esc(o.symbol)}</b></td><td class="${o.side === 'NB' ? 'up' : 'down'}">${o.side === 'NB' ? 'Mua' : 'Bán'}</td><td>${esc(o.orderType)}</td>
          <td class="r">${o.orderType === 'LO' ? px(o.price) : esc(o.orderType)}</td><td class="r">${(num(o.quantity) || 0).toLocaleString('vi-VN')}</td><td class="r">${(khop || 0).toLocaleString('vi-VN')}</td>
          <td>${esc(tt)}${e ? ' <span class="rt-dot" title="Trạng thái vừa nhận qua realtime"></span>' : ''}</td></tr>`;
        }).join('')}</tbody></table>`;
    const rtNote = moiNhat
      ? `<div class="dt-note"><span class="rt-dot"></span>Realtime đang chạy, sự kiện gần nhất ${esc(hhmm(moiNhat.event_at))}.</div>`
      : '<div class="dt-note">Chưa nhận sự kiện realtime nào của khách này trong phiên.</div>';

    // Phiếu lệnh CỐ Ý không hiện ở đây nữa: cột phải đã có đúng danh sách đó, cùng một hàm vẽ,
    // nên khi chọn một khách thì phiếu của họ hiện HAI LẦN trên cùng màn hình. Cột phải là chỗ
    // đúng vì nó nằm ngay dưới form tạo phiếu.
    box.innerHTML = head + inv + kv
      + `<div class="dt-sec">Danh mục</div>${posHtml}`
      + `<div class="dt-sec">Sổ lệnh hôm nay</div>${ordHtml}${rtNote}`;
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
      ${t.status === 'unknown' ? reconHtml(t) : ''}
      ${canSend || canCancel ? `<div class="tk-actions">${canSend ? `<button class="go${D.armed === t.id ? ' arm' : ''}" data-send="${t.id}">${D.armed === t.id ? 'Bấm lần nữa để gửi' : 'Gửi lệnh'}</button>` : ''}${canCancel ? `<button data-cancel-ticket="${t.id}">Hủy phiếu</button>` : ''}</div>` : ''}
    </div>`;
  }

  /**
   * Phiếu "chưa rõ": lệnh có thể đã nằm trên sàn. Không bao giờ tự kết luận hộ môi giới —
   * chỉ lấy sổ lệnh của khách ra đối chiếu rồi để môi giới chọn.
   */
  function reconHtml(t) {
    const r = D.recon[t.id];
    if (!r) return `<div class="tk-actions"><button data-reconcile="${t.id}">Đối soát sổ lệnh</button></div>`;
    if (r.loading) return '<div><small>Đang đọc sổ lệnh của khách từ DNSE…</small></div>';
    if (r.error) return `<div class="tk-err">${esc(r.error)}</div><div class="tk-actions"><button data-reconcile="${t.id}">Thử lại</button></div>`;
    const list = r.candidates || [];
    return `<div><small>${list.length
      ? `Sổ lệnh hôm nay có ${list.length} lệnh khớp mô tả (trong tổng ${r.totalInBook}). Lệnh nào là của phiếu này?`
      : `Sổ lệnh hôm nay (${r.totalInBook} lệnh) không có lệnh nào khớp mô tả.`}</small></div>
      <div class="tk-actions">
        ${list.map((o) => `<button data-resolve="${t.id}" data-oid="${esc(o.id)}" data-ostatus="${esc(o.status || '')}">#${esc(o.id)}${o.price != null ? ' giá ' + esc(px(o.price)) : ''}${o.status ? ' · ' + esc(o.status) : ''}</button>`).join('')}
        <button data-resolve="${t.id}">Sổ lệnh không có lệnh nào</button>
      </div>`;
  }
  /* Phiếu lệnh giờ CHỈ hiện ở cột này (xem ghi chú trong renderDetail). Đang chọn một khách thì
     mặc định lọc theo khách đó — đứng ở màn của một khách mà danh sách phiếu lại trộn cả người
     khác thì rất dễ đọc nhầm phiếu. Vẫn xem được tất cả bằng một lần bấm. */
  function renderTickets() {
    const c = D.sel?.client;
    const cuaKhach = c ? D.tickets.filter((t) => t.account_no === c.accountNo) : [];
    const locTheoKhach = !!c && !D.xemHet;
    const ds = locTheoKhach ? cuaKhach : D.tickets;
    const sub = $('desk-tickets-sub');
    if (sub) {
      sub.innerHTML = !c ? `tất cả · ${D.tickets.length}`
        : locTheoKhach
          ? `${esc(c.name || c.accountNo)} · ${cuaKhach.length}${D.tickets.length > cuaKhach.length ? ` <button class="link" data-ticket-scope="het">Xem tất cả (${D.tickets.length})</button>` : ''}`
          : `tất cả · ${D.tickets.length} <button class="link" data-ticket-scope="khach">Chỉ khách này (${cuaKhach.length})</button>`;
    }
    $('desk-tickets').innerHTML = ds.length ? ds.slice(0, 30).map(ticketHtml).join('')
      : `<div class="empty">${locTheoKhach ? 'Khách này chưa có phiếu lệnh nào.' : 'Chưa có phiếu lệnh nào.'}</div>`;
    if (D.sel && !D.sel.loading) renderDetail();
  }

  function renderForm() {
    const c = D.sel?.client;
    $('desk-for').innerHTML = !c ? 'Chọn khách ở cột bên trái.'
      : c.canTrade ? `Đặt cho <b>${esc(c.name || c.accountNo)}</b> · ${esc(c.accountNo)}`
      : `<b>${esc(c.name || c.accountNo)}</b> chỉ ủy quyền theo dõi. Khách cần cấp quyền giao dịch trên Entrade X.`;
    $('dk-head-acc').textContent = c?.canTrade ? c.accountNo : '';
    $('dk-submit').disabled = !c || !c.canTrade;
    document.querySelectorAll('[data-dside]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.dside === D.side));
    $('dk-submit').className = 'cta ' + (D.side === 'B' ? 'buy' : 'sell');
    const laLO = $('dk-type').value === 'LO';
    $('dk-px').disabled = !laLO;

    // Nguồn chỉ thị 'app' thì khách tự bấm xác nhận trong cổng, không phải ghi tay
    const quaApp = $('dk-src').value === 'app';
    $('dk-instr').hidden = quaApp;
    $('dk-app-note').hidden = !quaApp;

    // Biên độ và giá trị lệnh — lấy từ bảng giá đang chạy của app.js, không gọi thêm API.
    // Chỉ là tham khảo khi soạn phiếu; trần/sàn RÀNG BUỘC vẫn do máy chủ lấy từ secdef DNSE
    // ngay lúc gửi, nên phiếu không bao giờ qua mặt được biên độ thật.
    const ma = $('dk-sym').value.trim().toUpperCase();
    const q = (typeof MKT !== 'undefined' && MKT.all) ? MKT.all[ma] : null;
    const band = $('dk-band');
    if (q && Number.isFinite(q.ceil)) {
      band.hidden = false;
      band.querySelector('.floor').textContent = 'Sàn ' + q.floor.toFixed(2);
      band.querySelector('.ref').textContent = 'TC ' + q.ref.toFixed(2);
      band.querySelector('.ceil').textContent = 'Trần ' + q.ceil.toFixed(2);
    } else band.hidden = true;

    const gia = laLO ? num($('dk-px').value) : (q ? q.last : null);
    const kl = num($('dk-qty').value);
    const sum = $('dk-sum');
    if (gia && kl) {
      sum.hidden = false;
      sum.querySelector('b').textContent = vnd(gia * 1000 * kl) + (laLO ? '' : ' (ước tính)');
    } else sum.hidden = true;
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
    loadExtras();
  }
  async function loadExtras() {
    const [inv, adv, rt] = await Promise.allSettled([api('/api/broker/invites'), api('/api/broker/advice'), api('/api/broker/realtime')]);
    if (inv.status === 'fulfilled') D.links = inv.value.links;
    if (adv.status === 'fulfilled') D.advice = adv.value.advice;
    if (rt.status === 'fulfilled') D.rt = rt.value;
    renderRealtime(); renderAdvice();
    if (D.sel && !D.sel.loading) renderDetail();
  }
  function renderRealtime() {
    const w = D.rt?.worker;
    $('desk-rt').innerHTML = !w ? '' : w.alive
      ? `<span class="dot"></span>Realtime: ${w.live ?? 0}/${w.connections ?? 0} khách đang kết nối, ${w.events ?? 0} sự kiện lệnh đã nhận.`
      : '<span class="dot off"></span>Worker realtime chưa chạy, trạng thái lệnh chỉ cập nhật khi bạn bấm Làm mới.';
  }
  function renderAdvice() {
    // Khối tư vấn đã tách hẳn sang tab Khuyến nghị; cột phiếu lệnh không còn phần tử này nữa.
    if (!$('advice-list')) return;
    $('advice-list').innerHTML = D.advice.length ? D.advice.slice(0, 15).map((a) => `<div class="tk"><div class="tk-top"><b class="${a.side === 'S' ? 'down' : a.side === 'B' ? 'up' : ''}">${esc(a.symbol)} ${a.side === 'B' ? 'Mua' : a.side === 'S' ? 'Bán' : 'Theo dõi'}</b><small>${esc(hhmm(a.created_at))}</small></div>
      <small>${a.outcome?.label ? `<b>${esc(a.outcome.label)}${a.outcome.retPct != null ? ` ${a.outcome.retPct > 0 ? '+' : ''}${String(a.outcome.retPct).replace('.', ',')}%` : ''}</b> · ` : ''}Mục tiêu ${a.target ? Number(a.target).toFixed(2) : '–'} · Cắt lỗ ${a.stop ? Number(a.stop).toFixed(2) : '–'} · đã xem ${a.seen}/${a.sent} khách</small></div>`).join('') : '<div class="empty">Chưa gửi khuyến nghị nào.</div>';
  }
  async function loadTickets() {
    try { D.tickets = (await api('/api/broker/tickets')).tickets; } catch (e) { D.tickets = []; }
    renderTickets();
  }
  async function selectClient(acc) {
    const c = D.clients.find((x) => x.accountNo === acc);
    if (!c) return;
    D.sel = { client: c, loading: true };
    document.dispatchEvent(new CustomEvent('lb:pick-client', { detail: { account: acc, from: 'desk' } }));
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

  async function reconcile(id) {
    D.recon[id] = { loading: true }; renderTickets();
    try {
      const r = await api('/api/broker/tickets', { method: 'POST', body: { action: 'reconcile', id } });
      D.recon[id] = { candidates: r.candidates || [], totalInBook: r.totalInBook ?? 0 };
    } catch (e) { D.recon[id] = { error: e.message }; }
    renderTickets();
  }
  async function resolve(id, dnseOrderId, dnseStatus) {
    try {
      await api('/api/broker/tickets', { method: 'POST', body: { action: 'resolve', id, dnseOrderId: dnseOrderId || null, dnseStatus: dnseStatus || null } });
      say(dnseOrderId ? `Đã chốt phiếu khớp với lệnh #${dnseOrderId}.` : 'Đã chốt: phiếu coi như chưa gửi.');
      delete D.recon[id];
    } catch (e) { say(e.message); }
    await loadTickets();
    if (D.sel) selectClient(D.sel.client.accountNo);
  }

  async function invite() {
    const c = D.sel?.client; if (!c) return;
    try {
      const r = await api('/api/broker/invites', { method: 'POST', body: { account: c.accountNo } });
      D.invite = { account: c.accountNo, link: r.link, expiresAt: r.expiresAt };
      renderDetail();
    } catch (e) { say(e.message); }
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
    if (t.dataset.ticketScope) { D.xemHet = t.dataset.ticketScope === 'het'; return renderTickets(); }
    if (t.hasAttribute('data-invite')) return invite();
    if (t.hasAttribute('data-copy')) {
      const el = $('invite-link'); el.select();
      return navigator.clipboard?.writeText(el.value).then(() => say('Đã sao chép link mời.')).catch(() => { document.execCommand('copy'); say('Đã sao chép link mời.'); });
    }
    if (t.dataset.client) return selectClient(t.dataset.client);
    if (t.dataset.dside) { D.side = t.dataset.dside; return renderForm(); }
    if (t.hasAttribute('data-refresh-client') && D.sel) return selectClient(D.sel.client.accountNo);
    if (t.dataset.send) return sendTicket(Number(t.dataset.send));
    if (t.dataset.reconcile) return reconcile(Number(t.dataset.reconcile));
    if (t.dataset.resolve) return resolve(Number(t.dataset.resolve), t.dataset.oid || null, t.dataset.ostatus || null);
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
      // Cả rổ 150 mã, không chỉ 32 mã có biểu đồ: môi giới hay đặt những mã ngoài rổ đó.
      const q = (typeof MKT !== 'undefined' && MKT.all) ? MKT.all[s] : null;
      if (q && Number.isFinite(q.last) && !$('dk-px').value) $('dk-px').value = q.last.toFixed(2);
    }
    // Biên độ và giá trị lệnh phải đổi theo từng ký tự gõ vào, như mọi phiếu đặt lệnh
    if (['dk-sym', 'dk-px', 'dk-qty'].includes(e.target.id)) renderForm();
  });
  document.addEventListener('change', (e) => { if (['dk-type', 'dk-src'].includes(e.target.id)) renderForm(); });

  document.addEventListener('lb:pick-client', (e) => { if (e.detail?.from !== 'desk') D.pending = e.detail.account; });
  document.addEventListener('lb:view', async (e) => {
    if (e.detail !== 'desk') return;
    if (!D.broker) { if (typeof setView === 'function') setView('trade'); return; }
    if (!$('dk-at').value) $('dk-at').value = localNow();
    renderDetail(); renderForm();
    await loadDesk();
    // Khách vừa chọn ở màn Tư vấn: mở luôn khách đó
    if (D.pending && D.pending !== D.sel?.client?.accountNo && D.clients.some((x) => x.accountNo === D.pending)) selectClient(D.pending);
    D.pending = null;
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
      openView('desk');
    }
  });

  // Làm mới danh sách phiếu mỗi 20 giây khi đang ở màn khách hàng
  setInterval(() => { if (D.broker && !$('view-desk').hidden) { loadTickets(); loadExtras(); } }, 15000);
})();
