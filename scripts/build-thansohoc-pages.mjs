/**
 * scripts/build-thansohoc-pages.mjs — generate 12 life-path-number pages + hub.
 *
 * Reads NUM_MEANINGS from thansohoc/js/numerology-data.js and emits
 * /thansohoc/so-N.html for N in 1-9, 11, 22, 33 plus the hub
 * /thansohoc/so-chu-dao.html. Each page targets "thần số học số N" and stacks
 * FOUR indicator meanings (Chủ Đạo + Sứ Mệnh + Linh Hồn + Nhân Cách) for the
 * same number — deeper than competitors' single-meaning pages — plus a CTA
 * into the interactive calculator (20+ indices).
 *
 * Maintains the <!-- thansohoc:start/end --> block in sitemap-latbai.xml.
 *
 * Run:  node scripts/build-thansohoc-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'thansohoc');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

const src = fs.readFileSync(path.join(ROOT, 'thansohoc', 'js', 'numerology-data.js'), 'utf8');
const { NUM_MEANINGS } = new Function(`${src}; return { NUM_MEANINGS };`)();

// Display number -> data keys per group (master numbers differ between groups).
const NUMBERS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ n: String(n), lp: String(n), other: String(n), label: `Số ${n}` })),
  { n: '11', lp: '11',   other: '11', label: 'Số 11 (Master)' },
  { n: '22', lp: '22/4', other: '22', label: 'Số 22/4 (Master)' },
  { n: '33', lp: '33/6', other: '33', label: 'Số 33/6 (Master)' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const personaOf = (html) => {
  const m = html.match(/<h4>([^<]+)<\/h4>/);
  return m ? m[1].trim() : '';
};
const fileFor = (num) => `so-${num.n}.html`;
// cleanUrls:true canonicalizes the extensionless path; drop .html from URLs/links.
const linkFor = (num) => `/thansohoc/so-${num.n}`;
const HUB_LINK = '/thansohoc/so-chu-dao';

function buildPage(num, idx) {
  const lp = NUM_MEANINGS.lifepath[num.lp];
  const destiny = NUM_MEANINGS.destiny[num.other];
  const soul = NUM_MEANINGS.soul[num.other];
  const personality = NUM_MEANINGS.personality[num.other];
  const persona = personaOf(lp);

  const url = `https://latbai.vn${linkFor(num)}`;
  const title = `Thần Số Học Số ${num.n}${persona ? `: ${persona}` : ''} | latbai.vn`;
  const desc = `Ý nghĩa số chủ đạo ${num.n} trong Thần Số Học: tính cách, sứ mệnh, linh hồn, nhân cách và lời khuyên. Tra cứu thần số học online miễn phí hơn 20 chỉ số với AI.`;

  const prev = NUMBERS[(idx + NUMBERS.length - 1) % NUMBERS.length];
  const next = NUMBERS[(idx + 1) % NUMBERS.length];

  const lpText = stripTags(lp);
  const faq = [
    { q: `Số chủ đạo ${num.n} có ý nghĩa gì?`, a: lpText.slice(0, 300) + (lpText.length > 300 ? '…' : '') },
    { q: `Làm sao biết mình có số chủ đạo ${num.n}?`, a: `Cộng toàn bộ các chữ số trong ngày sinh dương lịch (ngày + tháng + năm) rồi rút gọn về một chữ số, trừ các số Master 11, 22, 33 được giữ nguyên. Ví dụ sinh 14/3/1996: 1+4+3+1+9+9+6 = 33 — giữ nguyên Master 33. Bạn có thể dùng công cụ tra cứu miễn phí của latbai.vn để tính tự động kèm hơn 20 chỉ số khác.` },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article',
        headline: `Thần Số Học Số ${num.n}${persona ? ` — ${persona}` : ''}`,
        description: desc,
        image: 'https://latbai.vn/images/og-main.png',
        author: { '@type': 'Organization', name: 'Ban biên tập Thần Số Học latbai.vn' },
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
        mainEntityOfPage: url },
      { '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
          { '@type': 'ListItem', position: 2, name: 'Thần Số Học', item: 'https://latbai.vn/thansohoc/' },
          { '@type': 'ListItem', position: 3, name: `Số ${num.n}` },
        ] },
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
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
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
      <a href="${HUB_LINK}">12 Số Chủ Đạo</a>
      <i class="ti ti-chevron-right"></i>
      <span>Số ${num.n}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Thần Số Học Số ${num.n}${persona ? ` — ${esc(persona)}` : ''}</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Thần Số Học</strong> · Biên soạn: <strong>Ban biên tập latbai.vn</strong></p>
    </article>

    <div class="article-body">

      <p style="text-align:center; font-size:64px; line-height:1; margin: 8px 0 4px;">${num.n}</p>
      <p style="text-align:center; color: var(--muted); margin-top:0;">${esc(num.label)} trong hệ thống Thần Số Học Pythagoras</p>

      <h2 class="thansohoc">1. Số Chủ Đạo ${num.n} (Life Path)</h2>
      ${lp}

      <h2 class="thansohoc">2. Số Sứ Mệnh ${num.n} (Expression)</h2>
      ${destiny}

      <h2 class="thansohoc">3. Số Linh Hồn ${num.n} (Soul Urge)</h2>
      ${soul}

      <h2 class="thansohoc">4. Số Nhân Cách ${num.n} (Personality)</h2>
      ${personality}

      <h2 class="thansohoc">5. Cách tính số chủ đạo của bạn</h2>
      <p>Cộng toàn bộ chữ số trong ngày sinh dương lịch rồi rút gọn về một chữ số (giữ nguyên các số Master 11, 22, 33). Ví dụ sinh ngày <strong>25/10/1998</strong>: 2+5+1+0+1+9+9+8 = 35 → 3+5 = <strong>8</strong>. Thay vì tính tay, bạn có thể dùng công cụ bên dưới — nhập tên và ngày sinh, hệ thống trả về số chủ đạo cùng hơn 20 chỉ số khác kèm AI luận giải.</p>

      <a href="/thansohoc/" class="article-cta thansohoc">
        <i class="ti ti-numbers"></i> Tra cứu Thần Số Học online miễn phí — hơn 20 chỉ số + AI luận giải
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
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn theo trường phái Pythagoras bởi <strong>Ban biên tập Thần Số Học latbai.vn</strong>.</p>
      </div>

    </div>

    <div class="related-articles">
      <h3 class="related-title">Số liền kề &amp; bài viết liên quan</h3>
      <div class="related-list">
        <a href="${linkFor(prev)}" class="related-item"><i class="ti ti-arrow-left"></i> Thần Số Học ${esc(prev.label)}</a>
        <a href="${linkFor(next)}" class="related-item"><i class="ti ti-arrow-right"></i> Thần Số Học ${esc(next.label)}</a>
        <a href="${HUB_LINK}" class="related-item"><i class="ti ti-list-numbers"></i> Tổng Quan 12 Số Chủ Đạo Thần Số Học</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/thansohoc/">Thần Số Học</a> ·
        <a href="/thuvien/">Thư Viện</a> ·
        <a href="/kinh-dich/">64 Quẻ</a> ·
        <a href="/la-bai-tarot/">78 Lá Bài</a>
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
  const url = `https://latbai.vn${HUB_LINK}`;
  const title = '12 Số Chủ Đạo Thần Số Học: Ý Nghĩa Từng Số & Cách Tính | latbai.vn';
  const desc = 'Tổng quan 12 số chủ đạo trong Thần Số Học Pythagoras: số 1-9 và các số Master 11, 22, 33. Ý nghĩa, tính cách từng số và công cụ tra cứu online miễn phí với AI.';

  const links = NUMBERS.map((num) => {
    const persona = personaOf(NUM_MEANINGS.lifepath[num.lp]);
    return `          <a href="${linkFor(num)}" class="related-item"><i class="ti ti-hash"></i> ${esc(num.label)}${persona ? ` — ${esc(persona)}` : ''}</a>`;
  }).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: '12 Số Chủ Đạo Thần Số Học', description: desc, url,
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } } },
      { '@type': 'ItemList',
        itemListElement: NUMBERS.map((num, i) => ({ '@type': 'ListItem', position: i + 1, name: `Thần số học ${num.label}`, url: `https://latbai.vn${linkFor(num)}` })) },
      { '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
          { '@type': 'ListItem', position: 2, name: '12 Số Chủ Đạo' },
        ] },
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
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
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
      <span>12 Số Chủ Đạo</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">12 Số Chủ Đạo Trong Thần Số Học — Ý Nghĩa Từng Số</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Thần Số Học</strong> · Biên soạn: <strong>Ban biên tập latbai.vn</strong></p>
    </article>

    <div class="article-body">
      <p>Trong Thần Số Học Pythagoras, <strong>số chủ đạo (Life Path)</strong> được tính từ ngày sinh và được xem là con số quan trọng nhất — tiết lộ bài học, hành trình và tiềm năng của cả cuộc đời. Hệ thống gồm 9 số cơ bản (1–9) và 3 <strong>số Master</strong> đặc biệt (11, 22, 33). Chọn số của bạn bên dưới để xem luận giải chi tiết — hoặc <a href="/thansohoc/">dùng công cụ tra cứu</a> để tính tự động kèm hơn 20 chỉ số khác.</p>

      <a href="/thansohoc/" class="article-cta thansohoc">
        <i class="ti ti-numbers"></i> Tra cứu Thần Số Học online miễn phí — AI luận giải tiếng Việt
      </a>

      <h2 class="thansohoc">Danh sách 12 số chủ đạo</h2>
      <div class="related-list" style="margin-bottom:18px;">
${links}
      </div>

      <div class="author-box">
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn theo trường phái Pythagoras bởi <strong>Ban biên tập Thần Số Học latbai.vn</strong>.</p>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/thansohoc/">Thần Số Học</a> ·
        <a href="/thuvien/">Thư Viện</a> ·
        <a href="/kinh-dich/">64 Quẻ</a> ·
        <a href="/la-bai-tarot/">78 Lá Bài</a>
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
const urls = [`https://latbai.vn${HUB_LINK}`];
NUMBERS.forEach((num, idx) => {
  fs.writeFileSync(path.join(OUT_DIR, fileFor(num)), buildPage(num, idx), 'utf8');
  urls.push(`https://latbai.vn${linkFor(num)}`);
});
fs.writeFileSync(path.join(OUT_DIR, 'so-chu-dao.html'), buildHub(), 'utf8');
console.log(`Generated ${urls.length} pages in /thansohoc/`);

// ---- Update sitemap block (idempotent) ----
const block = [
  '  <!-- thansohoc:start (generated by scripts/build-thansohoc-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.endsWith('/so-chu-dao') ? '0.8' : '0.6'}</priority>
  </url>`),
  '  <!-- thansohoc:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- thansohoc:start')) {
  sitemap = sitemap.replace(/ {2}<!-- thansohoc:start[\s\S]*?<!-- thansohoc:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
