// Service worker của Lật Cờ: cho app cài lên điện thoại/máy tính như một app,
// mở nhanh hơn từ lần thứ hai, và vẫn mở được (chơi với máy) khi mất mạng.
//
// Nguyên tắc — đừng làm người chơi kẹt ở bản cũ:
// - Trang (điều hướng): LẤY MẠNG TRƯỚC, mạng chậm quá vài giây hoặc mất mạng mới
//   dùng bản đã lưu. Nên mỗi lần deploy, lần mở tiếp theo là có bản mới.
// - /api/*: KHÔNG BAO GIỜ đụng tới (đăng nhập Google, ván online, chấm điểm...).
// - /assets/* (tên file có mã băm, đổi nội dung là đổi tên), engine, font, quân cờ:
//   lấy từ bộ nhớ trước. Engine đổi phiên bản thì tên file cũng đổi.
// - Dữ liệu khai cuộc, icon: dùng bản lưu cho nhanh rồi lặng lẽ cập nhật.
//
// Đổi cách lưu thì tăng PHIÊN_BẢN để xoá bộ nhớ cũ.

const PHIÊN_BẢN = 'v1';
const TRANG = `latco-trang-${PHIÊN_BẢN}`;
const TĨNH = `latco-tinh-${PHIÊN_BẢN}`;
const CHỜ_MẠNG_MS = 4000;
const TỐI_ĐA_TĨNH = 80;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(TRANG)
      .then((c) => c.add('/'))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('latco-') && k !== TRANG && k !== TĨNH).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    e.respondWith(trang(req, url));
  } else if (/^\/(assets|engine|fonts|pieces)\//.test(url.pathname)) {
    e.respondWith(lưuTrước(req));
  } else if (/^\/(data|icons|board)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    e.respondWith(dùngLưuRồiCậpNhật(req, e));
  }
});

/** Trang nào được giữ lại để mở khi mất mạng: app và các trang tĩnh, không giữ /van/<id>. */
const giữTrang = (p) => p === '/' || p === '/index.html' || /^\/(hoc|cham-van-co-vua|chinh-sach-rieng-tu)(\/|$)/.test(p);

async function trang(req, url) {
  const cache = await caches.open(TRANG);
  const mạng = fetch(req).then((res) => {
    if (res.ok && !res.redirected && giữTrang(url.pathname)) cache.put(url.pathname, res.clone());
    return res;
  });
  mạng.catch(() => {}); // đã dùng bản lưu thì lỗi mạng sau đó không cần báo
  // Bản lưu: đúng trang đó, không có thì vỏ app (app tự đọc đường dẫn)
  const lưu = async () => (await cache.match(url.pathname)) ?? (await cache.match('/'));
  const quáLâu = new Promise((ok) => setTimeout(ok, CHỜ_MẠNG_MS)).then(lưu);
  try {
    const r = await Promise.race([mạng, quáLâu]);
    return r ?? (await mạng);
  } catch {
    const r = await lưu();
    if (r) return r;
    return new Response('<h1>Không có mạng</h1><p>Kết nối lại rồi tải lại trang.</p>', {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}

async function lưuTrước(req) {
  const cache = await caches.open(TĨNH);
  const có = await cache.match(req);
  if (có) return có;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    await cache.put(req, res.clone());
    void dọn(cache);
  }
  return res;
}

async function dùngLưuRồiCậpNhật(req, e) {
  const cache = await caches.open(TĨNH);
  const có = await cache.match(req);
  const mới = fetch(req)
    .then(async (res) => {
      if (res.ok && res.type === 'basic') await cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (có) {
    e.waitUntil(mới);
    return có;
  }
  return (await mới) ?? Response.error();
}

/** Bỏ bớt file cũ (các bản build trước để lại /assets/ khác tên). */
async function dọn(cache) {
  const ks = await cache.keys();
  for (const k of ks.slice(0, Math.max(0, ks.length - TỐI_ĐA_TĨNH))) await cache.delete(k);
}
