/**
 * scripts/build-que-pages.mjs — generate 64 static hexagram pages + hub.
 *
 * Reads HEXAGRAMS from gieoque/js/hexagrams.js (single source of truth) and
 * emits /kinh-dich/que-N-slug.html per hexagram plus /kinh-dich/index.html.
 * Differentiator vs competitors: every page embeds a "Gieo quẻ ngay" CTA into
 * the interactive tool, plus AI interpretation — not just a reference table.
 *
 * Also maintains the <!-- kinh-dich:start/end --> block in sitemap-latbai.xml
 * so re-runs stay idempotent.
 *
 * Run:  node scripts/build-que-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'kinh-dich');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Load HEXAGRAMS from the browser script (no module exports there) ----
const hexSrc = fs.readFileSync(path.join(ROOT, 'gieoque', 'js', 'hexagrams.js'), 'utf8');
const HEXAGRAMS = new Function(`${hexSrc}; return HEXAGRAMS;`)();

// ---- Trigram reference (sign char -> data). First sign char = upper trigram. ----
const TRIGRAMS = {
  '☰': { name: 'Càn',  nature: 'Trời',  element: 'Kim' },
  '☷': { name: 'Khôn', nature: 'Đất',   element: 'Thổ' },
  '☳': { name: 'Chấn', nature: 'Sấm',   element: 'Mộc' },
  '☴': { name: 'Tốn',  nature: 'Gió',   element: 'Mộc' },
  '☵': { name: 'Khảm', nature: 'Nước',  element: 'Thủy' },
  '☲': { name: 'Ly',   nature: 'Lửa',   element: 'Hỏa' },
  '☶': { name: 'Cấn',  nature: 'Núi',   element: 'Thổ' },
  '☱': { name: 'Đoài', nature: 'Đầm',   element: 'Kim' },
};

// Deeper editorial articles that already exist in /thuvien/ for specific quẻ.
const DEEP_ARTICLES = {
  1:  { href: '/thuvien/que-thuan-can-vi-thien.html', title: 'Ý Nghĩa Quẻ Thuần Càn (Quẻ Số 1) — Quẻ Mạnh Nhất Kinh Dịch' },
  2:  { href: '/thuvien/que-thuan-khon.html',         title: 'Ý Nghĩa Quẻ Thuần Khôn (Quẻ Số 2) — Đức Dày Của Đất' },
  31: { href: '/thuvien/que-trach-son-ham.html',      title: 'Ý Nghĩa Quẻ Trạch Sơn Hàm (Quẻ Số 31)' },
};

function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON-LD strings: JSON.stringify handles escaping.

function fileNameFor(num, hex) {
  return `que-${num}-${slugify(hex.vn)}.html`;
}

// cleanUrls:true serves and canonicalizes the extensionless path (the .html
// 308-redirects to it), so every URL/link/sitemap entry must drop .html.
const linkFor = (num, hex) => `/kinh-dich/${fileNameFor(num, hex).replace(/\.html$/, '')}`;

function buildPage(num, hex) {
  const url = `https://latbai.vn${linkFor(num, hex)}`;
  const upper = TRIGRAMS[hex.sign[0]];
  const lower = TRIGRAMS[hex.sign[1]];
  const title = `Quẻ ${hex.vn} (Quẻ Số ${num}) — Ý Nghĩa & Lời Khuyên | latbai.vn`;
  const desc = `Luận giải quẻ ${hex.vn} — quẻ số ${num} trong 64 quẻ Kinh Dịch: ý nghĩa tổng quát, lời khuyên khi gieo được quẻ ${hex.name} và gieo quẻ online miễn phí với AI.`;

  const prevNum = num === 1 ? 64 : num - 1;
  const nextNum = num === 64 ? 1 : num + 1;
  const prev = HEXAGRAMS[prevNum];
  const next = HEXAGRAMS[nextNum];

  // First sentence of meaning -> "tốt hay xấu" FAQ seed.
  const firstSentence = hex.meaning.split('.')[0] + '.';

  const deep = DEEP_ARTICLES[num];
  const deepLink = deep
    ? `\n        <a href="${deep.href}" class="related-item"><i class="ti ti-article"></i> ${esc(deep.title)}</a>`
    : '';

  const faq = [
    {
      q: `Quẻ ${hex.vn} tốt hay xấu?`,
      a: `${firstSentence} Quẻ ${hex.name} không đơn thuần tốt hay xấu — Kinh Dịch luận theo thời vận: hiểu đúng tượng quẻ và hành xử hợp thời thì hung cũng hóa cát.`,
    },
    {
      q: `Gieo được quẻ ${hex.name} nên làm gì?`,
      a: hex.advice,
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: `Quẻ ${hex.vn} (Quẻ Số ${num}) — Ý Nghĩa & Lời Khuyên`,
        description: desc,
        image: 'https://latbai.vn/images/og-gieoque.png',
        author: { '@type': 'Person', name: 'Trần Đạo Nhân', jobTitle: 'Học giả Cổ học Phương Đông' },
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
        mainEntityOfPage: url,
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
          { '@type': 'ListItem', position: 2, name: '64 Quẻ Kinh Dịch', item: 'https://latbai.vn/kinh-dich/' },
          { '@type': 'ListItem', position: 3, name: `Quẻ ${hex.vn}` },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-gieoque.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">

  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">

  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/kinh-dich/">64 Quẻ Kinh Dịch</a>
      <i class="ti ti-chevron-right"></i>
      <span>Quẻ ${esc(hex.vn)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Quẻ ${esc(hex.vn)} (Quẻ Số ${num}) — Ý Nghĩa &amp; Lời Khuyên</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Kinh Dịch</strong> · Biên soạn: <strong>Ban biên tập Dịch học latbai.vn</strong></p>
    </article>

    <div class="article-body">

      <p style="text-align:center; font-size:64px; line-height:1; margin: 8px 0 4px;">${hex.symbol}</p>
      <p style="text-align:center; color: var(--muted); margin-top:0;">${hex.sign} — Quẻ số ${num} / 64 quẻ Kinh Dịch</p>

      <h2 class="gieoque">1. Cấu tạo quẻ ${esc(hex.vn)}</h2>
      <p>Quẻ <strong>${esc(hex.vn)}</strong> gồm ngoại quái <strong>${upper.name}</strong> (${hex.sign[0]} ${upper.nature} — hành ${upper.element}) ở trên và nội quái <strong>${lower.name}</strong> (${hex.sign[1]} ${lower.nature} — hành ${lower.element}) ở dưới. Tượng quẻ là <strong>${upper.nature} trên ${lower.nature}</strong>, đứng thứ ${num} trong trật tự 64 quẻ của Chu Dịch.</p>

      <h2 class="gieoque">2. Ý nghĩa tổng quát</h2>
      <p>${esc(hex.meaning)}</p>

      <h2 class="gieoque">3. Lời khuyên khi gieo được quẻ ${esc(hex.name)}</h2>
      <p>${esc(hex.advice)}</p>

      <a href="/gieoque/" class="article-cta gieoque">
        <i class="ti ti-yin-yang"></i> Gieo Quẻ Kinh Dịch online — AI luận giải riêng cho câu hỏi của bạn
      </a>

      <div class="faq-section">
        <h3 class="faq-title">Câu hỏi thường gặp (FAQ)</h3>
        <div class="faq-list">
${faq.map((f) => `          <details class="faq-item">
            <summary class="faq-question">${esc(f.q)}</summary>
            <p class="faq-answer">${esc(f.a)}</p>
          </details>`).join('\n')}
        </div>
      </div>

      <div class="author-box">
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn bởi Ban biên tập Dịch học <strong>latbai.vn</strong>.</p>
        <p><strong>Chuyên gia hiệu đính:</strong> Học giả <strong>Trần Đạo Nhân</strong> (Viện Nghiên cứu Cổ học Phương Đông).</p>
      </div>

    </div>

    <div class="related-articles">
      <h3 class="related-title">Quẻ liền kề &amp; bài viết liên quan</h3>
      <div class="related-list">
        <a href="${linkFor(prevNum, prev)}" class="related-item"><i class="ti ti-arrow-left"></i> Quẻ ${prevNum}: ${esc(prev.vn)}</a>
        <a href="${linkFor(nextNum, next)}" class="related-item"><i class="ti ti-arrow-right"></i> Quẻ ${nextNum}: ${esc(next.vn)}</a>${deepLink}
        <a href="/thuvien/64-que-kinh-dich.html" class="related-item"><i class="ti ti-article"></i> 64 Quẻ Kinh Dịch: Ý Nghĩa, Cấu Tạo &amp; Cách Tra Cứu</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/kinh-dich/">64 Quẻ</a> ·
        <a href="/gieoque/">Gieo Quẻ</a> ·
        <a href="/thuvien/">Thư Viện</a> ·
        <a href="/tarot/">Tarot</a>
      </nav>
      <p>&copy; 2026 latbai.vn. Tất cả quyền được bảo lưu.</p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>

</body>
</html>
`;
}

function buildHub() {
  const url = 'https://latbai.vn/kinh-dich/';
  const title = '64 Quẻ Kinh Dịch: Tra Cứu Ý Nghĩa Từng Quẻ & Gieo Quẻ Online | latbai.vn';
  const desc = 'Tra cứu đầy đủ 64 quẻ Kinh Dịch: tên quẻ, tượng quẻ, ý nghĩa và lời khuyên từng quẻ. Gieo quẻ online miễn phí bằng 3 đồng xu với AI luận giải tiếng Việt.';

  const rows = Object.entries(HEXAGRAMS).map(([n, h]) => {
    const num = Number(n);
    return `            <tr>
              <td><strong>${num}</strong></td>
              <td style="font-size:22px;">${h.symbol}</td>
              <td><a href="${linkFor(num, h)}">${esc(h.vn)}</a></td>
              <td>${h.sign}</td>
            </tr>`;
  }).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: '64 Quẻ Kinh Dịch — Tra cứu ý nghĩa từng quẻ',
        description: desc,
        url,
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
      },
      {
        '@type': 'ItemList',
        itemListElement: Object.entries(HEXAGRAMS).map(([n, h]) => ({
          '@type': 'ListItem', position: Number(n),
          name: `Quẻ ${h.vn}`,
          url: `https://latbai.vn${linkFor(Number(n), h)}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
          { '@type': 'ListItem', position: 2, name: '64 Quẻ Kinh Dịch' },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-gieoque.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">

  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">

  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <span>64 Quẻ Kinh Dịch</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">64 Quẻ Kinh Dịch — Tra Cứu Ý Nghĩa Từng Quẻ</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Kinh Dịch</strong> · Biên soạn: <strong>Ban biên tập Dịch học latbai.vn</strong></p>
    </article>

    <div class="article-body">
      <p>Kinh Dịch (Chu Dịch) gồm <strong>64 quẻ kép</strong>, mỗi quẻ hợp thành từ hai trong tám quẻ đơn (Bát Quái). Mỗi quẻ mang một tượng, một thời vận và một lời khuyên riêng. Chọn quẻ trong bảng dưới đây để xem luận giải chi tiết — hoặc <a href="/gieoque/">gieo quẻ online bằng 3 đồng xu</a> để AI luận giải trực tiếp cho câu hỏi của bạn.</p>

      <a href="/gieoque/" class="article-cta gieoque">
        <i class="ti ti-yin-yang"></i> Gieo Quẻ Kinh Dịch online miễn phí — AI luận giải tiếng Việt
      </a>

      <h2 class="gieoque">Bảng tra cứu 64 quẻ Kinh Dịch</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead>
            <tr><th>Số</th><th>Tượng</th><th>Tên quẻ</th><th>Quái</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>

      <div class="author-box">
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn bởi Ban biên tập Dịch học <strong>latbai.vn</strong>.</p>
        <p><strong>Chuyên gia hiệu đính:</strong> Học giả <strong>Trần Đạo Nhân</strong> (Viện Nghiên cứu Cổ học Phương Đông).</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Bài viết liên quan</h3>
      <div class="related-list">
        <a href="/thuvien/64-que-kinh-dich.html" class="related-item"><i class="ti ti-article"></i> 64 Quẻ Kinh Dịch: Ý Nghĩa, Cấu Tạo &amp; Cách Tra Cứu</a>
        <a href="/thuvien/gieo-que-su-nghiep.html" class="related-item"><i class="ti ti-article"></i> Hướng Dẫn Gieo Quẻ Kinh Dịch Hỏi Về Công Việc, Sự Nghiệp</a>
        <a href="/thuvien/am-duong-ngu-hanh.html" class="related-item"><i class="ti ti-article"></i> Âm Dương Ngũ Hành Là Gì? Quy Luật Tương Sinh Tương Khắc</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/gieoque/">Gieo Quẻ</a> ·
        <a href="/thuvien/">Thư Viện</a> ·
        <a href="/tarot/">Tarot</a> ·
        <a href="/drinking/">Drinking Game</a>
      </nav>
      <p>&copy; 2026 latbai.vn. Tất cả quyền được bảo lưu.</p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>

</body>
</html>
`;
}

// ---- Generate ----
fs.mkdirSync(OUT_DIR, { recursive: true });

const urls = ['https://latbai.vn/kinh-dich/'];
for (const [n, hex] of Object.entries(HEXAGRAMS)) {
  const num = Number(n);
  fs.writeFileSync(path.join(OUT_DIR, fileNameFor(num, hex)), buildPage(num, hex), 'utf8');
  urls.push(`https://latbai.vn${linkFor(num, hex)}`);
}
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), buildHub(), 'utf8');
console.log(`Generated ${urls.length} pages in /kinh-dich/`);

// ---- Update sitemap block (idempotent) ----
const block = [
  '  <!-- kinh-dich:start (generated by scripts/build-que-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.endsWith('/kinh-dich/') ? '0.8' : '0.6'}</priority>
  </url>`),
  '  <!-- kinh-dich:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- kinh-dich:start')) {
  sitemap = sitemap.replace(/ {2}<!-- kinh-dich:start[\s\S]*?<!-- kinh-dich:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
