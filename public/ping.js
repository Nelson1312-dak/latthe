// Đếm một lượt xem trang đọc (bài học, bài tập, hướng dẫn) — ẩn danh, chỉ là con số theo
// ngày. Tên loại trang lấy từ thuộc tính data-e của chính thẻ <script> này. Để thành
// file riêng (không viết thẳng trong trang) để chính sách CSP chặn được mọi script lạ.
(function () {
  try {
    var e = document.currentScript && document.currentScript.getAttribute('data-e');
    if (!/^[a-z_]{1,30}$/.test(e || '')) return;
    fetch('/api/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ e: e }),
      keepalive: true,
    }).catch(function () {});
  } catch (_) {}
})();
