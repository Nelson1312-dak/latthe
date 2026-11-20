// Header bảo mật cho mọi trang trên latbai.vn (scripts/deploy.mjs ghi vào vercel.json).
// Tách riêng để scripts/check-csp.mjs thử đúng bộ header này trên bản build trước khi deploy.
//
// CSP (Content-Security-Policy) chỉ cho chạy script của chính trang và thư viện đăng
// nhập của Google; script chèn vào trang bằng cách nào khác (ví dụ một cái tên người
// chơi có thẻ <script>) đều bị trình duyệt chặn. Vì vậy trang không được có script
// viết thẳng trong HTML hay onclick="..." (đếm lượt ở trang đọc nằm trong /ping.js).

/** @param {string} upstream địa chỉ server ở nhà (luồng ván online đi thẳng tới đó), có thể rỗng */
export function contentSecurityPolicy(upstream = '') {
  return [
    "default-src 'self'",
    // wasm-unsafe-eval: engine Stockfish là WebAssembly; không cho eval() thường
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
    // style-src cần unsafe-inline: giao diện đặt style trực tiếp (kích thước bàn cờ, màu...)
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    // Ảnh đại diện Google; data:/blob: cho ảnh tóm tắt ván tự vẽ
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self'${upstream ? ` ${upstream}` : ''} https://accounts.google.com/gsi/`,
    // 'self': bàn cờ nổi (src/app/mini.ts) là cửa sổ nhỏ nhúng chính latbai.vn vào một khung
    "frame-src 'self' https://accounts.google.com/gsi/",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Chỉ chính latbai.vn được nhúng trang này (bàn cờ nổi); trang khác thì không
    "frame-ancestors 'self'",
  ].join('; ');
}

/** @param {string} upstream */
export function securityHeaders(upstream = '') {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(upstream) },
    // Trình duyệt cũ chưa hiểu frame-ancestors: chặn trang khác nhúng latbai.vn vào iframe
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Bấm link ra ngoài chỉ để lộ tên miền, không lộ đường dẫn (ví dụ mã ván chia sẻ)
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ];
}
