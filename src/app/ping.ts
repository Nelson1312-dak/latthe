// Báo server đếm một lượt (thống kê ẩn danh cho chủ trang).
//
// Chỉ gửi tên sự kiện — không gửi gì về người dùng, server cũng không lưu ai
// gửi. Hỏng mạng thì thôi, không bao giờ làm phiền người chơi.

export type PingEvent =
  | 'visit'
  | 'play_start'
  | 'play_end'
  | 'share_open'
  | 'online_queue'
  | 'assist_hold'
  | 'assist_guide'
  | 'coach_open'
  | 'mini_open'
  | 'pwa_install';

export function ping(e: PingEvent): void {
  try {
    void fetch('/api/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ e }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* bỏ qua */
  }
}

/** Một lượt vào trang: mỗi phiên trình duyệt (tab) tính một lần. */
export function pingVisit(): void {
  try {
    if (sessionStorage.getItem('visited')) return;
    sessionStorage.setItem('visited', '1');
  } catch {
    /* chế độ riêng tư: vẫn đếm */
  }
  ping('visit');
}

/**
 * "Đang mở trang": để chủ trang thấy lúc này có bao nhiêu người trên trang và
 * đang ở mục nào. Mã ngẫu nhiên tạo mỗi lần mở tab, chỉ nằm trong bộ nhớ tab
 * (tải lại trang là mã mới) — không cookie, không gắn tài khoản. Tab bị ẩn thì
 * thôi gửi, nên server quên nó sau 2 phút.
 */
export function startPresence(where: () => string): void {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const gửi = () => {
    if (document.visibilityState !== 'visible') return;
    try {
      void fetch('/api/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, where: where() }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* bỏ qua */
    }
  };
  gửi();
  setInterval(gửi, 45_000);
  document.addEventListener('visibilitychange', gửi);
  window.addEventListener('hashchange', gửi);
}
