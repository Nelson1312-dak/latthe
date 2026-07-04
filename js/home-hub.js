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
  function renderProfile() {
    const p = P.get();
    if (!p) {
      profileEl.innerHTML = `
        <div class="hub-card hub-create">
          <div class="hub-create-head">
            <span class="hub-create-icon"><i class="ti ti-user-star"></i></span>
            <div>
              <h2 class="hub-title">Tạo Hồ Sơ Huyền Học</h2>
              <p class="hub-sub">Nhập một lần — Tử Vi, Thần Số Học tự điền, nhận Vận Hôm Nay riêng của bạn. Lưu trên máy bạn, không gửi đi đâu.</p>
            </div>
          </div>
          <form id="hub-form" class="hub-form">
            <input type="text" id="hub-name" class="hub-input" placeholder="Họ và tên đầy đủ" required aria-label="Họ và tên">
            <div class="hub-date-row">
              <select id="hub-day" class="hub-select" required aria-label="Ngày sinh"><option value="">Ngày</option></select>
              <select id="hub-month" class="hub-select" required aria-label="Tháng sinh"><option value="">Tháng</option></select>
              <select id="hub-year" class="hub-select" required aria-label="Năm sinh"><option value="">Năm</option></select>
            </div>
            <button type="submit" class="hub-btn"><i class="ti ti-sparkles"></i> Kích hoạt hồ sơ</button>
          </form>
        </div>`;

      const dSel = document.getElementById('hub-day');
      const mSel = document.getElementById('hub-month');
      const ySel = document.getElementById('hub-year');
      for (let i = 1; i <= 31; i++) dSel.innerHTML += `<option value="${i}">${i}</option>`;
      for (let i = 1; i <= 12; i++) mSel.innerHTML += `<option value="${i}">${i}</option>`;
      const nowY = new Date().getFullYear();
      for (let i = nowY; i >= 1930; i--) ySel.innerHTML += `<option value="${i}">${i}</option>`;

      document.getElementById('hub-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('hub-name').value.trim();
        const day = parseInt(dSel.value), month = parseInt(mSel.value), year = parseInt(ySel.value);
        if (!name || !day || !month || !year) return;
        P.save({ name, day, month, year });
        renderProfile();
        renderDaily();
      });
      return;
    }

    const lp = P.lifePath(p.day, p.month, p.year);
    const cc = P.canChi(p.year);
    const py = P.personalYear(p.day, p.month, new Date().getFullYear());

    profileEl.innerHTML = `
      <div class="hub-card hub-me">
        <div class="hub-me-head">
          <span class="hub-avatar">${p.name.trim().charAt(0).toUpperCase()}</span>
          <div class="hub-me-info">
            <h2 class="hub-title">${p.name}</h2>
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
          <a class="hub-link" href="/tuvi/"><i class="ti ti-stars"></i> Lá số Tử Vi của bạn</a>
          <a class="hub-link" href="/thansohoc/"><i class="ti ti-hash"></i> Bản đồ Thần Số</a>
          <a class="hub-link" href="/gieoque/"><i class="ti ti-yin-yang"></i> Gieo quẻ đầu ngày</a>
        </div>
      </div>`;

    document.getElementById('hub-clear').addEventListener('click', () => {
      if (confirm('Xóa hồ sơ huyền học trên thiết bị này?')) {
        P.clear();
        renderProfile();
        renderDaily();
      }
    });
    document.getElementById('hub-edit').addEventListener('click', () => {
      P.clear();
      renderProfile();
      const nameInput = document.getElementById('hub-name');
      if (nameInput) { nameInput.value = p.name; nameInput.focus(); }
      const dSel = document.getElementById('hub-day');
      if (dSel) dSel.value = String(p.day);
      const mSel = document.getElementById('hub-month');
      if (mSel) mSel.value = String(p.month);
      const ySel = document.getElementById('hub-year');
      if (ySel) ySel.value = String(p.year);
    });
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

    dailyEl.innerHTML = `
      <div class="hub-daily-head">
        <h2 class="hub-daily-title"><i class="ti ti-sun-moon"></i> Vận Hôm Nay</h2>
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
          <img class="hd-card-img" src="/tarot/images/${card.img}.webp" alt="${card.vn}" loading="lazy" width="72" height="121">
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
