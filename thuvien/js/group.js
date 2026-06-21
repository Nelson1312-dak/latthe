    (function () {
      var source = document.getElementById('lib-source');
      var grouped = document.getElementById('lib-grouped');
      var filters = document.getElementById('lib-filters');
      if (!source || !grouped) return;

      // Display order + icon for each category (matches badge text).
      var ORDER = [
        { key: 'Kinh Dịch', icon: 'ti-yin-yang' },
        { key: 'Bài Tarot', icon: 'ti-wand' },
        { key: 'Tử Vi AI',  icon: 'ti-stars' },
        { key: 'Cổ Học',    icon: 'ti-books' }
      ];

      var cards = Array.prototype.slice.call(source.querySelectorAll('.article-card'));
      var buckets = {};
      cards.forEach(function (card) {
        var badge = card.querySelector('.badge');
        var cat = badge ? badge.textContent.trim() : 'Khác';
        (buckets[cat] = buckets[cat] || []).push(card);
      });

      // Any category not in ORDER gets appended at the end.
      Object.keys(buckets).forEach(function (k) {
        if (!ORDER.some(function (o) { return o.key === k; })) ORDER.push({ key: k, icon: 'ti-article' });
      });

      var sections = [];
      ORDER.forEach(function (o) {
        var list = buckets[o.key];
        if (!list || !list.length) return;
        var sec = document.createElement('section');
        sec.className = 'lib-group';
        sec.dataset.cat = o.key;

        var h2 = document.createElement('h2');
        h2.className = 'lib-group-title';
        h2.innerHTML = '<i class="ti ' + o.icon + '"></i> ' + o.key +
                       ' <span class="lib-group-count">' + list.length + '</span>';
        sec.appendChild(h2);

        var grid = document.createElement('div');
        grid.className = 'article-grid';
        list.forEach(function (c) { grid.appendChild(c); });
        sec.appendChild(grid);
        grouped.appendChild(sec);
        sections.push(sec);
      });

      source.remove();

      // Filter chips: "Tất cả" + one per category.
      if (filters) {
        var mk = function (label, cat) {
          var b = document.createElement('button');
          b.className = 'lib-chip' + (cat === null ? ' active' : '');
          b.textContent = label;
          b.addEventListener('click', function () {
            filters.querySelectorAll('.lib-chip').forEach(function (x) { x.classList.remove('active'); });
            b.classList.add('active');
            sections.forEach(function (s) {
              s.style.display = (cat === null || s.dataset.cat === cat) ? '' : 'none';
            });
          });
          return b;
        };
        filters.appendChild(mk('Tất cả', null));
        ORDER.forEach(function (o) {
          if (buckets[o.key] && buckets[o.key].length) filters.appendChild(mk(o.key, o.key));
        });
      }
    })();
