/**
 * sw.js — Service Worker for Lật Bài
 * Strategy:
 *   - Cache-first for static shell (HTML, CSS, JS, icons, fonts)
 *   - Network-first for /api/* (always try server, fall back to error)
 *   - Stale-while-revalidate for fonts.gstatic.com woff2
 *
 * Bump CACHE_VERSION whenever the shell changes meaningfully.
 */

const CACHE_VERSION = 'v111-2026-07-04';
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
  '/js/ai.js',
  '/js/chat.js',
  '/js/history.js',
  '/js/shell.js',
  '/js/landing-fx.js',
  '/js/mystic-fx.js',
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

  // Stale-while-revalidate for Google Fonts woff2
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
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
