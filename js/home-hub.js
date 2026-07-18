/**
 * js/home-hub.js — Trang chủ: Hồ Sơ Huyền Học + widget "Vận Hôm Nay".
 * Cần load sau: /js/profile.js và /js/daily-data.js (DAILY_HEX, DAILY_TAROT).
 * Render vào 2 placeholder: #hub-profile và #hub-daily trong index.html.
 */
(function () {
  'use strict';

  const P = window.LatbaiProfile;
  if (!P) return;

  const profileEl = document.getElementById('hub-profile');
  const dailyEl = document.getElementById('hub-daily');
  if (!profileEl || !dailyEl) return;

  const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  const DAY_VIBES = {
    1: 'Ngày khởi đầu — hợp bắt tay việc mới, quyết định dứt khoát.',
    2: 'Ngày kết nối — ưu tiên lắng nghe, hợp tác, vun đắp quan hệ.',
    3: 'Ngày tỏa sáng — giao tiếp, sáng tạo và gặp gỡ đều thuận.',
    4: 'Ngày củng cố — dọn dẹp, hoàn thiện, làm việc có hệ thống.',
    5: 'Ngày chuyển động — đón thay đổi, ra ngoài, thử cái mới.',
    6: 'Ngày tổ ấm — dành thời gian cho gia đình và người thương.',
    7: 'Ngày lắng đọng — đi chậm, học hỏi, nghe tiếng nói bên trong.',
    8: 'Ngày bứt phá — việc lớn, tiền bạc, đàm phán đều được ủng hộ.',
    9: 'Ngày khép lại — hoàn tất việc dở dang, buông bỏ, cho đi.'
  };

  const LUCKY_COLORS = [
    { name: 'Vàng Kim', css: '#e8930a' },
    { name: 'Xanh Ngọc', css: '#0d9668' },
    { name: 'Tím Huyền Bí', css: '#7c3aed' },
    { name: 'Xanh Biển Sâu', css: '#2563eb' },
    { name: 'Đỏ Son', css: '#dc2626' },
    { name: 'Hồng Đào', css: '#db2777' },
    { name: 'Nâu Trầm', css: '#92400e' },
    { name: 'Bạc Sương', css: '#64748b' }
  ];

  // ---------- Hồ Sơ ----------
  // Hỗ trợ nhiều hồ sơ / 1 thiết bị: bản thân + người nhà.
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function shortName(name) {
    return escHtml(String(name).trim().split(/\s+/).pop());
  }

  // form tạo/sửa hồ sơ; editing = hồ sơ đang sửa (null = thêm mới),
  // cancelable = có nút quay lại (khi đã có hồ sơ khác)
  function renderForm(editing, cancelable) {
    const isEdit = !!editing;
    profileEl.innerHTML = `
      <div class="hub-card hub-create">
        <div class="hub-create-head">
          <span class="hub-create-icon"><i class="ti ti-user-star"></i></span>
          <div>
            <h2 class="hub-title">${isEdit ? 'Sửa hồ sơ' : 'Tạo Hồ Sơ Huyền Học'}</h2>
            <p class="hub-sub">${isEdit
              ? 'Cập nhật tên hoặc ngày sinh cho hồ sơ này.'
              : 'Nhập một lần — Tử Vi, Thần Số Học tự điền, nhận Vận Hôm Nay riêng. Lập được nhiều hồ sơ cho cả nhà, lưu trên máy bạn, không gửi đi đâu.'}</p>
          </div>
        </div>
        <form id="hub-form" class="hub-form">
          <input type="text" id="hub-name" class="hub-input" placeholder="Họ và tên đầy đủ" required aria-label="Họ và tên">
          <div class="hub-date-row">
            <select id="hub-day" class="hub-select" required aria-label="Ngày sinh"><option value="">Ngày</option></select>
            <select id="hub-month" class="hub-select" required aria-label="Tháng sinh"><option value="">Tháng</option></select>
            <select id="hub-year" class="hub-select" required aria-label="Năm sinh"><option value="">Năm</option></select>
          </div>
          <button type="submit" class="hub-btn"><i class="ti ti-sparkles"></i> ${isEdit ? 'Lưu thay đổi' : 'Kích hoạt hồ sơ'}</button>
          ${cancelable ? '<button type="button" id="hub-cancel" class="hub-btn-ghost"><i class="ti ti-arrow-left"></i> Quay lại</button>' : ''}
        </form>
      </div>`;

    const dSel = document.getElementById('hub-day');
    const mSel = document.getElementById('hub-month');
    const ySel = document.getElementById('hub-year');
    for (let i = 1; i <= 31; i++) dSel.innerHTML += `<option value="${i}">${i}</option>`;
    for (let i = 1; i <= 12; i++) mSel.innerHTML += `<option value="${i}">${i}</option>`;
    const nowY = new Date().getFullYear();
    for (let i = nowY; i >= 1930; i--) ySel.innerHTML += `<option value="${i}">${i}</option>`;

    if (isEdit) {
      document.getElementById('hub-name').value = editing.name;
      dSel.value = String(editing.day);
      mSel.value = String(editing.month);
      ySel.value = String(editing.year);
    }

    document.getElementById('hub-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('hub-name').value.trim();
      const day = parseInt(dSel.value), month = parseInt(mSel.value), year = parseInt(ySel.value);
      if (!name || !day || !month || !year) return;
      P.save(isEdit ? { id: editing.id, name, day, month, year } : { name, day, month, year });
      renderProfile();
      renderDaily();
    });

    const cancelBtn = document.getElementById('hub-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', renderProfile);
  }

  function renderProfile() {
    const p = P.get();
    if (!p) { renderForm(null, false); return; }

    const all = P.list();
    const lp = P.lifePath(p.day, p.month, p.year);
    const cc = P.canChi(p.year);
    const py = P.personalYear(p.day, p.month, new Date().getFullYear());

    // thanh chuyển hồ sơ: hiện khi có >1 hồ sơ, kèm nút thêm người nhà
    const switcher = `
      <div class="hub-people" role="tablist" aria-label="Chọn hồ sơ">
        ${all.map((q) => `
          <button type="button" class="hub-person ${q.id === p.id ? 'is-active' : ''}" data-pid="${q.id}" role="tab" aria-selected="${q.id === p.id}" title="${escHtml(q.name)}">
            <span class="hub-person-av">${escHtml(q.name.trim().charAt(0).toUpperCase())}</span>
            <span class="hub-person-nm">${shortName(q.name)}</span>
          </button>`).join('')}
        <button type="button" class="hub-person hub-person-add" id="hub-add" title="Thêm hồ sơ người nhà">
          <span class="hub-person-av">＋</span>
          <span class="hub-person-nm">Thêm</span>
        </button>
      </div>`;

    profileEl.innerHTML = `
      <div class="hub-card hub-me">
        ${switcher}
        <div class="hub-me-head">
          <span class="hub-avatar">${escHtml(p.name.trim().charAt(0).toUpperCase())}</span>
          <div class="hub-me-info">
            <h2 class="hub-title">${escHtml(p.name)}</h2>
            <p class="hub-sub">${p.day}/${p.month}/${p.year} · Tuổi ${cc.text} (${cc.giap})</p>
          </div>
          <div class="hub-me-actions">
            <button type="button" id="hub-edit" class="hub-icon-btn" title="Sửa hồ sơ" aria-label="Sửa hồ sơ"><i class="ti ti-pencil"></i></button>
            <button type="button" id="hub-clear" class="hub-icon-btn" title="Xóa hồ sơ" aria-label="Xóa hồ sơ"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div class="hub-stats">
          <span class="hub-stat"><b>${lp}</b> Số chủ đạo</span>
          <span class="hub-stat"><b>${py}</b> Năm cá nhân</span>
          <span class="hub-stat"><b>${cc.giap}</b> Con giáp</span>
        </div>
        <div class="hub-links">
          <a class="hub-link" href="/bao-cao/"><i class="ti ti-file-star"></i> Báo cáo vận mệnh tổng hợp</a>
          <a class="hub-link" href="/tuvi/"><i class="ti ti-stars"></i> Lá số Tử Vi của bạn</a>
          <a class="hub-link" href="/thansohoc/"><i class="ti ti-hash"></i> Bản đồ Thần Số</a>
          <a class="hub-link" href="/gieoque/"><i class="ti ti-yin-yang"></i> Gieo quẻ đầu ngày</a>
        </div>
        <div class="hub-push" id="hub-push" hidden></div>
      </div>`;

    profileEl.querySelectorAll('.hub-person[data-pid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        P.setActive(btn.dataset.pid);
        renderProfile();
        renderDaily();
      });
    });
    document.getElementById('hub-add').addEventListener('click', () => renderForm(null, true));
    document.getElementById('hub-edit').addEventListener('click', () => renderForm(p, true));
    document.getElementById('hub-clear').addEventListener('click', () => {
      if (confirm(`Xóa hồ sơ của ${p.name}?`)) {
        P.remove(p.id);
        renderProfile();
        renderDaily();
      }
    });

    renderPush();
  }

  // ---------- Bật/tắt thông báo Vận Hôm Nay ----------
  async function renderPush() {
    const box = document.getElementById('hub-push');
    const Push = window.LatbaiPush;
    if (!box || !Push || !Push.isSupported()) return;

    // Hiện nút ngay khi biết trình duyệt hỗ trợ (không đợi SW/subscription —
    // tránh treo UI ở lần tải đầu khi SW còn đang activate).
    box.hidden = false;
    paint('off');
    const state = await Push.getState();

    function paint(s, msg) {
      if (s === 'on') {
        box.innerHTML = `<button type="button" class="hub-push-btn is-on" id="hub-push-toggle">
            <i class="ti ti-bell-ringing"></i> Đang nhắc Vận Hôm Nay mỗi sáng — tắt</button>` +
          (msg ? `<span class="hub-push-msg">${msg}</span>` : '');
      } else if (s === 'blocked') {
        box.innerHTML = `<span class="hub-push-msg"><i class="ti ti-bell-off"></i> Bạn đã chặn thông báo cho latbai.vn. Hãy bật lại trong cài đặt trình duyệt để nhận Vận Hôm Nay.</span>`;
        return;
      } else {
        box.innerHTML = `<button type="button" class="hub-push-btn" id="hub-push-toggle">
            <i class="ti ti-bell"></i> Nhắc tôi xem Vận Hôm Nay mỗi sáng</button>` +
          (msg ? `<span class="hub-push-msg">${msg}</span>` : '');
      }
      const btn = document.getElementById('hub-push-toggle');
      if (btn) btn.addEventListener('click', onToggle);
    }

    async function onToggle() {
      const btn = document.getElementById('hub-push-toggle');
      const cur = await Push.getState();
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
      if (cur === 'on') {
        await Push.disable();
        paint('off', 'Đã tắt nhắc hằng ngày.');
      } else {
        const r = await Push.enable();
        if (r.ok) {
          paint('on', 'Tuyệt! Sáng mai bạn sẽ nhận quẻ dẫn đường đầu tiên 🔮');
        } else {
          const reasons = {
            blocked: 'Bạn đã từ chối quyền thông báo — bật lại trong cài đặt trình duyệt.',
            dismissed: 'Bạn chưa cấp quyền thông báo. Thử lại khi sẵn sàng nhé.',
            notconfigured: 'Tính năng đang được kích hoạt, vui lòng quay lại sau.',
            network: 'Lỗi kết nối, thử lại sau ít phút.',
          };
          paint(r.reason === 'blocked' ? 'blocked' : 'off', reasons[r.reason] || 'Chưa bật được, thử lại sau.');
        }
      }
    }

    paint(state);
  }

  // ---------- Vận Hôm Nay ----------
  function renderDaily() {
    if (typeof DAILY_HEX === 'undefined' || typeof DAILY_TAROT === 'undefined') return;

    const p = P.get();
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const personalKey = p ? `|${p.name}|${p.day}/${p.month}/${p.year}` : '';

    const hex = DAILY_HEX[P.seedHash(dateKey + personalKey + '#que') % DAILY_HEX.length];
    const card = DAILY_TAROT[P.seedHash(dateKey + personalKey + '#tarot') % DAILY_TAROT.length];
    const lucky = P.seedHash(dateKey + personalKey + '#lucky') % 99 + 1;
    const color = LUCKY_COLORS[P.seedHash(dateKey + personalKey + '#color') % LUCKY_COLORS.length];

    let vibeCard;
    if (p) {
      const pd = P.personalDay(p.day, p.month, now);
      vibeCard = `
        <div class="hub-daily-card hub-vibe">
          <span class="hd-label">Nhịp ngày của bạn</span>
          <span class="hd-big">${pd}</span>
          <span class="hd-name">Ngày Cá Nhân ${pd}</span>
          <p class="hd-desc">${DAY_VIBES[pd] || ''}</p>
          <p class="hd-lucky">May mắn: số <b>${lucky}</b> · màu <b style="color:${color.css}">${color.name}</b></p>
        </div>`;
    } else {
      vibeCard = `
        <div class="hub-daily-card hub-vibe hub-vibe-empty">
          <span class="hd-label">Nhịp ngày của bạn</span>
          <span class="hd-big">?</span>
          <p class="hd-desc">Tạo hồ sơ phía trên để nhận Ngày Cá Nhân, số và màu may mắn riêng của bạn.</p>
        </div>`;
    }

    const st = window.LatbaiStreak && window.LatbaiStreak.get();
    const streakBadge = st && st.count >= 1
      ? `<span class="hub-streak${st.count >= 30 ? ' is-legend' : st.count >= 7 ? ' is-hot' : ''}" title="Kỷ lục của bạn: ${st.best} ngày">
           <i class="ti ti-flame"></i>${st.count === 1 ? 'Bắt đầu chuỗi!' : `${st.count} ngày liền`}</span>`
      : '';

    dailyEl.innerHTML = `
      <div class="hub-daily-head">
        <h2 class="hub-daily-title"><i class="ti ti-sun-moon"></i> Vận Hôm Nay${streakBadge}</h2>
        <span class="hub-daily-date">${WEEKDAYS[now.getDay()]}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}${p ? ' · dành riêng cho ' + p.name.split(' ').pop() : ''}</span>
      </div>
      <div class="hub-daily-grid">
        <a class="hub-daily-card hub-hex" href="/kinh-dich/${hex.slug}">
          <span class="hd-label">Quẻ dẫn đường</span>
          <span class="hd-big hd-hexsym">${hex.sym}</span>
          <span class="hd-name">${hex.vn}</span>
          <p class="hd-desc">${hex.m}</p>
          <span class="hd-more">Xem luận giải quẻ <i class="ti ti-arrow-right"></i></span>
        </a>
        <a class="hub-daily-card hub-tarot" href="/la-bai-tarot/${card.slug}">
          <span class="hd-label">Lá bài hộ mệnh</span>
          <img class="hd-card-img" src="/tarot/images/thumbs/${card.img}.webp" alt="${card.vn}" loading="lazy" width="72" height="121">
          <span class="hd-name">${card.vn}</span>
          <p class="hd-desc">${card.m}</p>
          <span class="hd-more">Xem ý nghĩa lá bài <i class="ti ti-arrow-right"></i></span>
        </a>
        ${vibeCard}
      </div>`;
  }

  function boot() {
    renderProfile();
    renderDaily();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
