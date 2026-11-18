// Gắn header "bỏ qua trang cảnh báo của ngrok" vào mọi lời gọi /api.
//
// Bản công khai: latbai.vn → Vercel → tunnel ngrok (gói miễn phí) → máy ở nhà.
// Gói miễn phí của ngrok chèn một trang HTML "You are about to visit..." trước
// MỌI request GET có User-Agent của trình duyệt. Trình duyệt hỏi /api/me thì
// nhận về trang HTML đó thay vì JSON — đăng nhập, ôn tập, đấu online đều chết,
// mà thử bằng curl thì không thấy (curl không phải trình duyệt). POST thì lọt.
//
// Có header `ngrok-skip-browser-warning` là ngrok cho qua. Gắn ở một chỗ duy
// nhất để không sót lời gọi nào. Chạy trong máy (không qua ngrok) thì header
// này vô hại.

export const NGROK_SKIP = 'ngrok-skip-browser-warning';

let installed = false;

export function installApiHeader(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(location.origin) ? url.slice(location.origin.length) : url;
    if (!path.startsWith('/api/')) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(NGROK_SKIP, '1');
    return original(input, { ...init, headers });
  };
}
