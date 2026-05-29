/**
 * toc.js — Auto table-of-contents ("Mục lục") for Thư Viện article pages.
 * Scans .article-body h2, builds an anchored nav, smooth-scrolls and
 * highlights the section in view. Renders inline at the top on narrow
 * screens and as a sticky panel in the right gutter on wide desktop.
 */
(function () {
  'use strict';

  function slugify(str, index) {
    var base = (str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip Vietnamese tones
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return (base || 'muc') + '-' + index;
  }

  function build() {
    var body = document.querySelector('.article-body');
    if (!body) return;

    var headings = Array.prototype.slice.call(body.querySelectorAll('h2'));
    if (headings.length < 2) return; // not worth a TOC

    headings.forEach(function (h, i) {
      if (!h.id) h.id = slugify(h.textContent, i + 1);
      h.style.scrollMarginTop = '24px';
    });

    var nav = document.createElement('nav');
    nav.className = 'article-toc';
    nav.setAttribute('aria-label', 'Mục lục bài viết');

    var head = document.createElement('div');
    head.className = 'toc-head';
    head.innerHTML = '<i class="ti ti-list"></i> Mục lục';
    nav.appendChild(head);

    var list = document.createElement('ul');
    list.className = 'toc-list';

    var links = [];
    headings.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/\s+/g, ' ').trim();
      a.addEventListener('click', function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + h.id);
      });
      li.appendChild(a);
      list.appendChild(li);
      links.push({ a: a, target: h });
    });

    nav.appendChild(list);

    var container = document.querySelector('.article-container');
    var header = container && container.querySelector('.article-header');
    if (header && header.nextSibling) {
      container.insertBefore(nav, header.nextSibling);
    } else if (body.parentNode) {
      body.parentNode.insertBefore(nav, body);
    }

    // Scrollspy — highlight the section currently in view.
    if ('IntersectionObserver' in window) {
      var visible = {};
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting;
        });
        var activeId = null;
        for (var i = 0; i < links.length; i++) {
          if (visible[links[i].target.id]) { activeId = links[i].target.id; break; }
        }
        links.forEach(function (l) {
          l.a.classList.toggle('active', l.target.id === activeId);
        });
      }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 });
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
