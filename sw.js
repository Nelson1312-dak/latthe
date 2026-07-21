/**
 * sw.js — Service Worker for Lật Bài
 * Strategy:
 *   - Cache-first for static shell (HTML, CSS, JS, icons, fonts)
 *   - Network-first for /api/* (always try server, fall back to error)
 *
 * Bump CACHE_VERSION whenever the shell changes meaningfully.
 */

const CACHE_VERSION = 'v131-2026-07-21';
const SHELL_CACHE = `latthe-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `latthe-runtime-${CACHE_VERSION}`;

const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/images/icon.svg',
  '/images/icon-maskable.svg',
  '/images/logo.svg',
  '/css/landing.css',
  '/css/common.css',
  '/fonts/tabler-icons-subset.woff2',
  '/css/fonts.css',
  '/fonts/be-vietnam-pro-vietnamese-400.woff2',
  '/fonts/be-vietnam-pro-latin-400.woff2',
  '/fonts/be-vietnam-pro-vietnamese-700.woff2',
  '/fonts/be-vietnam-pro-vietnamese-800.woff2',
  '/js/ai.js',
  '/js/chat.js',
  '/js/share-card.js',
  '/js/history.js',
  '/js/shell.js',
  '/js/landing-fx.js',
  '/js/mystic-fx.js',
  '/js/profile.js',
  '/js/daily-data.js',
  '/js/home-hub.js',
  '/js/push.js',
  // Ngày Tốt module
  '/ngay-tot/',
  '/ngay-tot/index.html',
  '/ngay-tot/css/ngaytot.css',
  '/ngay-tot/js/amlich.js',
  '/ngay-tot/js/app.js',
  // Phong Thủy Sim module
  '/sim/',
  '/sim/index.html',
  '/sim/css/sim.css',
  '/sim/js/app.js',
  // Ghép Đôi module
  '/ghep-doi/',
  '/ghep-doi/index.html',
  '/ghep-doi/css/ghepdoi.css',
  '/ghep-doi/js/app.js',
  // Thư Viện module
  '/thuvien/',
  '/thuvien/index.html',
  '/thuvien/css/thuvien.css',
  '/thuvien/js/toc.js',
  '/thuvien/js/group.js',
  // Gieo Que module
  '/gieoque/',
  '/gieoque/index.html',
  '/gieoque/css/gieoque.css',
  '/gieoque/js/hexagrams.js',
  '/gieoque/js/app.js',
  // Tarot module
  '/tarot/',
  '/tarot/index.html',
  '/tarot/css/tarot.css',
  '/tarot/js/cards.js',
  '/tarot/js/app.js',
  // Drinking module (React SPA — hashed JS/CSS cached at runtime, not precached)
  '/drinking/',
  '/drinking/index.html',
  // Tu Vi module
  '/tuvi/',
  '/tuvi/index.html',
  '/tuvi/css/tuvi_viewer.css',
  '/tuvi/js/tuvi.js',
  '/tuvi/js/page.js',
  // Than So Hoc module
  '/thansohoc/',
  '/thansohoc/index.html',
  '/thansohoc/css/thansohoc.css',
  '/thansohoc/js/numerology-data.js',
  '/thansohoc/js/app.js',
  // Giai Ma Ten module
  '/ten/',
  '/ten/index.html',
  '/ten/css/ten.css',
  '/ten/js/app.js',
  // Dua Thu module
  '/dua/',
  '/dua/index.html',
  '/dua/css/dua.css',
  '/dua/js/app.js',
  // Bao Cao Van Menh module
  '/bao-cao/',
  '/bao-cao/index.html',
  '/bao-cao/css/baocao.css',
  '/bao-cao/js/report-data.js',
  '/bao-cao/js/app.js',
  // Cung Hoang Dao module
  '/hoang-dao/',
  '/hoang-dao/index.html',
  '/hoang-dao/css/hoangdao.css',
  '/hoang-dao/js/zodiac-data.js',
  '/hoang-dao/js/app.js',
  // Xin Xam module
  '/xin-xam/',
  '/xin-xam/index.html',
  '/xin-xam/css/xinxam.css',
  '/xin-xam/js/xam-data.js',
  '/xin-xam/js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL).catch(() => {/* ignore individual failures */})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Web Push: hiển thị "Vận Hôm Nay" ----
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Lật Bài — Vận Hôm Nay';
  const options = {
    body: data.body || 'Quẻ dẫn đường hôm nay của bạn đã sẵn sàng.',
    icon: '/images/icon-maskable.svg',
    badge: '/images/icon.svg',
    tag: data.tag || 'van-hom-nay',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API responses
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for HTML so deploys are picked up fast
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first for everything else same-origin
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});
