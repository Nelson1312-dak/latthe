// Báo server đếm một lượt (thống kê ẩn danh cho chủ trang).
//
// Chỉ gửi tên sự kiện — không gửi gì về người dùng, server cũng không lưu ai
// gửi. Hỏng mạng thì thôi, không bao giờ làm phiền người chơi.

export type PingEvent = 'visit' | 'play_start' | 'play_end' | 'report_detail' | 'share_open' | 'online_queue';

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
