/**
 * js/shell.js — Shared app shell bootstrap.
 *
 * Replaces ~25 lines of boilerplate that was copy-pasted into every module's
 * index.html: the floating navigation dock, the service-worker registration,
 * and the Vercel analytics shim. Each page now only needs:
 *
 *     <script src="/js/shell.js?v=1" defer></script>
 *
 * The active dock item is derived from location.pathname, so adding or
 * reordering a module is a one-file change here instead of editing 7 pages.
 */
(() => {
  const DOCK = [
    { href: '/',           module: 'home',      icon: 'ti-home',     label: 'Trang chủ' },
    { href: '/tuvi/',      module: 'tuvi',      icon: 'ti-stars',    label: 'Tử Vi AI' },
    { href: '/gieoque/',   module: 'gieoque',   icon: 'ti-yin-yang', label: 'Gieo Quẻ' },
    { href: '/tarot/',     module: 'tarot',     icon: 'ti-wand',     label: 'Bài Tarot' },
    { href: '/thansohoc/', module: 'thansohoc', icon: 'ti-hash',     label: 'Thần Số Học' },
    { href: '/drinking/',  module: 'drinking',  icon: 'ti-beer',     label: 'Drinking Game' },
    { divider: true },
    { href: '/thuvien/',   module: 'thuvien',   icon: 'ti-books',    label: 'Thư Viện' },
  ];

  // Longest-prefix match of the current path against module hrefs.
  // '/' (home) only matches the bare root so module pages don't fall back to it.
  function activeModule() {
    const p = location.pathname;
    if (p === '/' || p === '/index.html') return 'home';
    let best = '';
    for (const item of DOCK) {
      if (!item.href || item.href === '/') continue;
      if (p.startsWith(item.href) && item.href.length > best.length) best = item.href;
    }
    const hit = DOCK.find((i) => i.href === best);
    return hit ? hit.module : 'home';
  }

  function renderDock() {
    // Respect a hand-written dock if a page still ships one.
    if (document.querySelector('.floating-dock')) return;
    const active = activeModule();
    const nav = document.createElement('nav');
    nav.className = 'floating-dock';
    nav.setAttribute('aria-label', 'Điều hướng nhanh');
    nav.innerHTML = DOCK.map((item) => {
      if (item.divider) return '<div class="dock-divider"></div>';
      const cls = 'dock-item' + (item.module === active ? ' active' : '');
      const current = item.module === active ? ' aria-current="page"' : '';
      return `<a href="${item.href}" class="${cls}" data-module="${item.module}" title="${item.label}"${current}>`
        + `<i class="ti ${item.icon}"></i><span class="dock-label">${item.label}</span></a>`;
    }).join('');
    document.body.appendChild(nav);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }

  function bootAnalytics() {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    for (const src of ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js']) {
      const s = document.createElement('script');
      s.defer = true;
      s.src = src;
      document.head.appendChild(s);
    }
  }

  bootAnalytics();
  registerSW();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDock);
  } else {
    renderDock();
  }
})();
