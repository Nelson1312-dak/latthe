/**
 * js/account.js — tài khoản Lật Bài (đăng nhập hệ thống hoặc Google) và kết nối công ty chứng khoán.
 * Chạy trong IIFE để không đụng biến toàn cục của js/app.js.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const vnd = (n) => (Number.isFinite(+n) ? Math.round(+n).toLocaleString('vi-VN') + ' đ' : '—');
  const say = (m) => (window.toast ? window.toast(m) : console.log(m));

  const S = { user: null, brokers: [], mode: 'login', busy: false };

  async function api(url, opts = {}) {
    const r = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let j = null; try { j = await r.json(); } catch { /* không phải JSON */ }
    if (!r.ok) throw Object.assign(new Error(j?.error || `Lỗi ${r.status}`), { status: r.status, code: j?.code });
    return j;
  }
  const errBox = (el, msg, kind = 'err') => { el.innerHTML = msg ? `<div class="msg ${kind}">${esc(msg)}</div>` : ''; };

  /* ---------- Thanh tài khoản ---------- */
  function renderAccount() {
    const u = S.user;
    $('btn-login').hidden = !!u;
    $('acct-btn').hidden = !u;
    if (!u) { $('acct-menu').hidden = true; return; }
    const name = u.display_name || u.username;
    $('acct-name').textContent = name;
    $('acct-avatar').innerHTML = u.avatar_url
      ? `<img src="${esc(u.avatar_url)}" alt="" referrerpolicy="no-referrer">`
      : esc(name.trim().charAt(0).toUpperCase() || '?');
    $('menu-name').textContent = name;
    $('menu-sub').textContent = u.email || '@' + u.username;
  }

  async function loadMe() {
    try {
      const me = await api('/api/me');
      S.user = me.user || null;
    } catch (e) {
      S.user = null;
      if (e.status !== 401) console.warn('[me]', e.message);
    }
    renderAccount();
    document.dispatchEvent(new CustomEvent('lb:user', { detail: S.user }));
  }

  /* ---------- Đăng nhập / đăng ký ---------- */
  function setMode(mode) {
    S.mode = mode;
    document.querySelectorAll('[data-auth-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.authTab === mode));
    $('auth-display-wrap').hidden = mode !== 'register';
    $('auth-submit').textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
    $('auth-pass').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    $('auth-pass').placeholder = mode === 'login' ? 'Mật khẩu' : 'Ít nhất 8 ký tự';
    errBox($('auth-msg'), '');
  }
  function openAuth(mode = 'login') {
    setMode(mode);
    $('auth-form').reset();
    $('dlg-auth').showModal();
    setTimeout(() => $('auth-user').focus(), 50);
  }

  async function submitAuth(e) {
    e.preventDefault();
    if (S.busy) return;
    const username = $('auth-user').value.trim().toLowerCase();
    const password = $('auth-pass').value;
    const body = { username, password };
    if (S.mode === 'register') body.display_name = $('auth-display').value.trim() || username;
    S.busy = true; $('auth-submit').disabled = true; errBox($('auth-msg'), '');
    try {
      const r = await api(`/api/auth/${S.mode}`, { method: 'POST', body });
      S.user = r.user;
      $('dlg-auth').close();
      renderAccount();
      document.dispatchEvent(new CustomEvent('lb:user', { detail: S.user }));
      say(S.mode === 'login' ? `Chào ${S.user.display_name || S.user.username}.` : 'Đã tạo tài khoản.');
    } catch (err) {
      errBox($('auth-msg'), err.message);
    } finally {
      S.busy = false; $('auth-submit').disabled = false;
    }
  }

  /* ---------- Công ty chứng khoán ---------- */
  function brokerCard(b) {
    const status = b.connected
      ? `<div class="broker-acc">Đã kết nối${b.display ? ` · <b>${esc(b.display)}</b>` : ''}${b.accountNo ? ` · ${esc(b.accountNo)}` : ''}</div>`
      : '';
    let actions = '';
    if (!b.available) {
      actions = '<div class="broker-acc">Chưa mở cho tài khoản của bạn.</div>';
    } else if (b.id === 'dnse') {
      actions = `<div class="broker-actions"><button data-view-broker="dnse" class="primary">Xem tài khoản</button>${
        b.can.trade ? '<button data-otp-broker="dnse">Xác thực OTP để giao dịch</button>' : ''}</div>`;
    } else if (b.connected) {
      actions = `<div class="broker-actions"><button data-view-broker="shs" class="primary">Xem tài khoản</button><button data-disconnect="shs">Ngắt kết nối</button></div>`;
    } else {
      actions = `<form data-login-broker="shs">
        <label>Tài khoản SHS<input class="inp" name="username" autocomplete="off" placeholder="Số tài khoản hoặc tên đăng nhập"></label>
        <label>Mật khẩu<input class="inp" name="password" type="password" autocomplete="off"></label>
        <div class="broker-actions"><button type="submit" class="primary">Kết nối</button></div>
      </form>`;
    }
    return `<div class="broker" data-broker="${b.id}">
      <div class="broker-top">
        <div class="broker-logo">${esc(b.name)}</div>
        <div class="broker-info"><b>${esc(b.full)}</b><p>${esc(b.note)}</p>${status}</div>
      </div>
      ${actions}
    </div>`;
  }

  async function openBrokers() {
    $('dlg-brokers').showModal();
    $('broker-list').innerHTML = '<p class="dlg-sub">Đang tải…</p>';
    errBox($('broker-msg'), '');
    try {
      const r = await api('/api/brokers');
      S.brokers = r.brokers;
      $('broker-list').innerHTML = r.brokers.map(brokerCard).join('');
      if (r.note) errBox($('broker-msg'), r.note, 'warn');
    } catch (e) {
      $('broker-list').innerHTML = '';
      errBox($('broker-msg'), e.message);
    }
  }

  async function connectShs(form) {
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) return errBox($('broker-msg'), 'Nhập tài khoản và mật khẩu SHS.');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Đang kết nối…'; errBox($('broker-msg'), '');
    try {
      await api('/api/shs/connect', { method: 'POST', body: { username, password } });
      form.password.value = '';
      say('Đã kết nối tài khoản SHS.');
      await openBrokers();
    } catch (e) {
      errBox($('broker-msg'), e.message);
      btn.disabled = false; btn.textContent = 'Kết nối';
    }
  }

  async function showBrokerAccount(id) {
    errBox($('broker-msg'), 'Đang tải tài khoản…', 'warn');
    try {
      const d = id === 'dnse' ? await api('/api/dnse/account') : await api('/api/shs/account');
      const cash = id === 'dnse'
        ? d.balance?.stock?.availableCash ?? d.balance?.stock?.totalCash
        : d.cash?.depositAmount;
      const n = (id === 'dnse' ? d.positions?.deals || d.positions : d.positions) || [];
      errBox($('broker-msg'),
        `${d.profile?.display || d.profile?.name || id.toUpperCase()} · Tiền: ${vnd(cash)} · ${Array.isArray(n) ? n.length : 0} mã đang nắm giữ`
        + (d.canTrade === false ? ' · chỉ xem' : ''), 'warn');
    } catch (e) {
      errBox($('broker-msg'), e.message);
    }
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) {
      if (!e.target.closest('.acct')) { $('acct-menu').hidden = true; $('acct-btn').setAttribute('aria-expanded', 'false'); }
      return;
    }
    if (t.id === 'btn-login') return openAuth('login');
    if (t.id === 'acct-btn') {
      const open = $('acct-menu').hidden;
      $('acct-menu').hidden = !open;
      t.setAttribute('aria-expanded', String(open));
      return;
    }
    if (t.dataset.authTab) return setMode(t.dataset.authTab);
    if (t.id === 'auth-cancel') return $('dlg-auth').close();
    if (t.id === 'btn-google') { location.href = '/api/auth/google?next=' + encodeURIComponent(location.pathname + location.hash); return; }
    if (t.hasAttribute('data-open-brokers')) { $('acct-menu').hidden = true; return openBrokers(); }
    if (t.id === 'brokers-close') return $('dlg-brokers').close();
    if (t.dataset.viewBroker) return showBrokerAccount(t.dataset.viewBroker);
    if (t.dataset.disconnect) {
      return api(`/api/brokers?broker=${t.dataset.disconnect}`, { method: 'DELETE' })
        .then(() => { say('Đã ngắt kết nối.'); openBrokers(); })
        .catch((err) => errBox($('broker-msg'), err.message));
    }
    if (t.dataset.otpBroker === 'dnse') {
      const otp = prompt('Nhập mã OTP từ email hoặc Smart OTP của DNSE:');
      if (!otp) return;
      return api('/api/dnse/otp', { method: 'POST', body: { action: 'verify', otp: otp.trim() } })
        .then(() => { say('Đã mở phiên giao dịch DNSE.'); openBrokers(); })
        .catch((err) => errBox($('broker-msg'), err.message));
    }
    if (t.id === 'menu-logout') {
      return api('/api/auth/logout', { method: 'POST' }).finally(() => {
        S.user = null; $('acct-menu').hidden = true; renderAccount();
        document.dispatchEvent(new CustomEvent('lb:user', { detail: null }));
        say('Đã đăng xuất.');
      });
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'auth-form') return submitAuth(e);
    if (e.target.dataset.loginBroker === 'shs') { e.preventDefault(); return connectShs(e.target); }
  });

  // Lỗi quay về từ Google nằm ở ?loi=
  const q = new URLSearchParams(location.search);
  if (q.get('loi')) {
    say(q.get('loi'));
    history.replaceState(null, '', location.pathname + location.hash);
  }
  loadMe();
})();
