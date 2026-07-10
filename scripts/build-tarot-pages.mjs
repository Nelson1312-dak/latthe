/**
 * scripts/build-tarot-pages.mjs — generate 78 static tarot card pages + hub.
 *
 * Reads TAROT_CARDS (22 Major, tarot/js/cards.js) and MINOR_ARCANA (56,
 * tarot/js/cards-minor.js), emits /la-bai-tarot/<slug>.html per card plus
 * /la-bai-tarot/index.html. Targets long-tail keywords "lá bài X", "X ngược"
 * — the gap competitors leave (their 78 meanings sit in one combined article).
 * Each page embeds a CTA into the interactive 3-card reading tool.
 *
 * Maintains the <!-- tarot-cards:start/end --> block in sitemap-latbai.xml.
 *
 * Run:  node scripts/build-tarot-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'la-bai-tarot');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Load card data from browser scripts ----
const majorSrc = fs.readFileSync(path.join(ROOT, 'tarot', 'js', 'cards.js'), 'utf8');
const minorSrc = fs.readFileSync(path.join(ROOT, 'tarot', 'js', 'cards-minor.js'), 'utf8');
const TAROT_CARDS = new Function(`${majorSrc}; return TAROT_CARDS;`)();
const { MINOR_ARCANA, SUITS } = new Function(`${minorSrc}; return { MINOR_ARCANA, SUITS };`)();

// Existing deep editorial articles in /thuvien/ (cross-link, do not duplicate).
const DEEP_ARTICLES = {
  'The Fool':        { href: '/thuvien/la-bai-the-fool.html',   title: 'Lá Bài The Fool — Phân Tích Chuyên Sâu' },
  'The Lovers':      { href: '/thuvien/the-lovers-tarot.html',  title: 'The Lovers Tarot — Tình Yêu & Lựa Chọn' },
  'Death':           { href: '/thuvien/la-bai-death-tarot.html', title: 'Lá Bài Death — Kết Thúc & Tái Sinh' },
  'The Tower':       { href: '/thuvien/la-bai-the-tower.html',  title: 'Lá Bài The Tower — Sụp Đổ Để Xây Lại' },
  'The Star':        { href: '/thuvien/la-bai-the-star.html',   title: 'Lá Bài The Star — Hy Vọng & Chữa Lành' },
  'The Moon':        { href: '/thuvien/la-bai-the-moon.html',   title: 'Lá Bài The Moon — Ảo Ảnh & Trực Giác' },
  'The Sun':         { href: '/thuvien/la-bai-the-sun.html',    title: 'Lá Bài The Sun — Thành Công & Niềm Vui' },
  'Ace of Pentacles':{ href: '/thuvien/ace-of-pentacles.html',  title: 'Ace of Pentacles — Cơ Hội Tài Chính Mới' },
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- Unified 78-card list (Major first, then suits in deck order) ----
const ALL = [
  ...TAROT_CARDS.map((c) => ({
    img: String(c.id), name: c.name, vn: c.vn, keywords: c.keywords,
    upright: c.upright, reversed: c.reversed, advice: c.advice,
    group: 'major', groupLabel: 'Ẩn Chính (Major Arcana)', element: c.element,
    sub: `Lá số ${c.number} bộ Ẩn Chính`,
  })),
  ...MINOR_ARCANA.map((c) => {
    const s = SUITS[c.suit];
    return {
      img: c.img, name: c.name, vn: c.vn, keywords: c.keywords,
      upright: c.upright, reversed: c.reversed, advice: c.advice,
      group: c.suit, groupLabel: `Bộ ${s.vn} (${s.en})`, element: s.element,
      sub: `Bộ ${s.vn} — chủ về ${s.domain}`,
    };
  }),
];

const fileFor = (card) => `${slugify(card.name)}.html`;
// cleanUrls:true canonicalizes the extensionless path; drop .html from URLs/links.
const linkFor = (card) => `/la-bai-tarot/${slugify(card.name)}`;

function buildPage(card, idx) {
  const url = `https://latbai.vn${linkFor(card)}`;
  const title = `Lá Bài ${card.name} (${card.vn}): Ý Nghĩa Xuôi & Ngược | latbai.vn`;
  const desc = `Ý nghĩa lá bài ${card.name} (${card.vn}) trong Tarot: giải nghĩa xuôi, nghĩa ngược, từ khóa và lời khuyên. Rút bài Tarot online miễn phí với AI luận giải tiếng Việt.`;

  const prev = ALL[(idx + ALL.length - 1) % ALL.length];
  const next = ALL[(idx + 1) % ALL.length];
  const deep = DEEP_ARTICLES[card.name];
  const deepLink = deep
    ? `\n        <a href="${deep.href}" class="related-item"><i class="ti ti-article"></i> ${esc(deep.title)}</a>`
    : '';

  const faq = [
    { q: `Lá bài ${card.name} xuôi có ý nghĩa gì?`, a: card.upright },
    { q: `Lá bài ${card.name} ngược có ý nghĩa gì?`, a: card.reversed },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: `Lá Bài ${card.name} (${card.vn}): Ý Nghĩa Xuôi & Ngược`,
        description: desc,
        image: `https://latbai.vn/tarot/images/${card.img}.webp`,
        author: { '@type': 'Organization', name: 'Hội đồng Tarot latbai.vn' },
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
          { '@type': 'ListItem', position: 2, name: '78 Lá Bài Tarot', item: 'https://latbai.vn/la-bai-tarot/' },
          { '@type': 'ListItem', position: 3, name: card.name },
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
  <meta property="og:image" content="https://latbai.vn/tarot/images/${card.img}.webp">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
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
      <a href="/la-bai-tarot/">78 Lá Bài Tarot</a>
      <i class="ti ti-chevron-right"></i>
      <span>${esc(card.name)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Lá Bài ${esc(card.name)} (${esc(card.vn)}): Ý Nghĩa Xuôi &amp; Ngược</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Bài Tarot</strong> · Biên soạn: <strong>Hội đồng Tarot latbai.vn</strong></p>
    </article>

    <div class="article-body">

      <p style="text-align:center;">
        <img src="/tarot/images/${card.img}.webp" alt="Lá bài ${esc(card.name)} — ${esc(card.vn)}" width="270" height="453" loading="lazy" decoding="async" style="border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,.18); max-width:100%; height:auto;">
      </p>
      <p style="text-align:center; color: var(--muted); margin-top:4px;">${esc(card.sub)} · Nguyên tố: ${card.element}</p>
      <p style="text-align:center;"><strong>Từ khóa:</strong> ${card.keywords.map(esc).join(' · ')}</p>

      <h2 class="tarot">1. Ý nghĩa lá ${esc(card.name)} xuôi</h2>
      <p>${esc(card.upright)}</p>

      <h2 class="tarot">2. Ý nghĩa lá ${esc(card.name)} ngược</h2>
      <p>${esc(card.reversed)}</p>

      <h2 class="tarot">3. Lời khuyên từ lá bài</h2>
      <p>${esc(card.advice)}</p>

      <a href="/tarot/" class="article-cta tarot">
        <i class="ti ti-wand"></i> Rút 3 lá Tarot online miễn phí — AI luận giải riêng cho câu hỏi của bạn
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
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn theo hệ thống Rider–Waite bởi <strong>Hội đồng Tarot latbai.vn</strong>.</p>
      </div>

    </div>

    <div class="related-articles">
      <h3 class="related-title">Lá liền kề &amp; bài viết liên quan</h3>
      <div class="related-list">
        <a href="${linkFor(prev)}" class="related-item"><i class="ti ti-arrow-left"></i> ${esc(prev.name)} (${esc(prev.vn)})</a>
        <a href="${linkFor(next)}" class="related-item"><i class="ti ti-arrow-right"></i> ${esc(next.name)} (${esc(next.vn)})</a>${deepLink}
        <a href="/thuvien/y-nghia-78-la-bai-tarot.html" class="related-item"><i class="ti ti-article"></i> Ý Nghĩa 78 Lá Bài Tarot — Tổng Quan Major &amp; Minor Arcana</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/la-bai-tarot/">78 Lá Bài</a> ·
        <a href="/tarot/">Rút Bài Tarot</a> ·
        <a href="/thuvien/">Thư Viện</a> ·
        <a href="/gieoque/">Gieo Quẻ</a>
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
  const url = 'https://latbai.vn/la-bai-tarot/';
  const title = 'Ý Nghĩa 78 Lá Bài Tarot: Tra Cứu Từng Lá Xuôi & Ngược | latbai.vn';
  const desc = 'Tra cứu ý nghĩa đầy đủ 78 lá bài Tarot theo hệ Rider–Waite: 22 lá Ẩn Chính và 56 lá Ẩn Phụ, giải nghĩa xuôi - ngược từng lá. Rút bài Tarot online miễn phí với AI.';

  const groups = [
    { key: 'major', label: '22 Lá Ẩn Chính (Major Arcana)' },
    { key: 'wands', label: `Bộ Gậy (Wands) — ${SUITS.wands.element}` },
    { key: 'cups', label: `Bộ Cốc (Cups) — ${SUITS.cups.element}` },
    { key: 'swords', label: `Bộ Kiếm (Swords) — ${SUITS.swords.element}` },
    { key: 'pentacles', label: `Bộ Xu (Pentacles) — ${SUITS.pentacles.element}` },
  ];

  const sections = groups.map((g) => {
    const cards = ALL.filter((c) => c.group === g.key);
    const links = cards.map((c) =>
      `          <a href="${linkFor(c)}" class="related-item"><i class="ti ti-cards"></i> ${esc(c.name)} (${esc(c.vn)})</a>`
    ).join('\n');
    return `      <h2 class="tarot">${esc(g.label)}</h2>
      <div class="related-list" style="margin-bottom:18px;">
${links}
      </div>`;
  }).join('\n\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'Ý Nghĩa 78 Lá Bài Tarot — Tra cứu từng lá', description: desc, url,
        publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } } },
      { '@type': 'ItemList',
        itemListElement: ALL.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: `https://latbai.vn${linkFor(c)}` })) },
      { '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
          { '@type': 'ListItem', position: 2, name: '78 Lá Bài Tarot' },
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
  <meta property="og:image" content="https://latbai.vn/images/og-tarot.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
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
      <span>78 Lá Bài Tarot</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Ý Nghĩa 78 Lá Bài Tarot — Tra Cứu Từng Lá</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Bài Tarot</strong> · Biên soạn: <strong>Hội đồng Tarot latbai.vn</strong></p>
    </article>

    <div class="article-body">
      <p>Bộ bài Tarot chuẩn Rider–Waite gồm <strong>78 lá</strong>: 22 lá <strong>Ẩn Chính</strong> (Major Arcana) nói về những bài học lớn của đời người, và 56 lá <strong>Ẩn Phụ</strong> (Minor Arcana) chia thành 4 bộ Gậy – Cốc – Kiếm – Xu phản ánh đời sống hằng ngày. Chọn lá bài bên dưới để xem giải nghĩa xuôi/ngược chi tiết — hoặc <a href="/tarot/">rút 3 lá Tarot online</a> để AI luận giải trực tiếp cho câu hỏi của bạn.</p>

      <a href="/tarot/" class="article-cta tarot">
        <i class="ti ti-wand"></i> Rút 3 lá Tarot online miễn phí — AI luận giải tiếng Việt
      </a>

${sections}

      <div class="author-box">
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn theo hệ thống Rider–Waite bởi <strong>Hội đồng Tarot latbai.vn</strong>.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Bài viết liên quan</h3>
      <div class="related-list">
        <a href="/thuvien/y-nghia-78-la-bai-tarot.html" class="related-item"><i class="ti ti-article"></i> Ý Nghĩa 78 Lá Bài Tarot — Tổng Quan Major &amp; Minor Arcana</a>
        <a href="/thuvien/cach-trai-bai-tarot.html" class="related-item"><i class="ti ti-article"></i> Cách Trải Bài Tarot Cho Người Mới Bắt Đầu</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/tarot/">Rút Bài Tarot</a> ·
        <a href="/thuvien/">Thư Viện</a> ·
        <a href="/kinh-dich/">64 Quẻ</a> ·
        <a href="/gieoque/">Gieo Quẻ</a>
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

const urls = ['https://latbai.vn/la-bai-tarot/'];
ALL.forEach((card, idx) => {
  fs.writeFileSync(path.join(OUT_DIR, fileFor(card)), buildPage(card, idx), 'utf8');
  urls.push(`https://latbai.vn${linkFor(card)}`);
});
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), buildHub(), 'utf8');
console.log(`Generated ${urls.length} pages in /la-bai-tarot/`);

// ---- Update sitemap block (idempotent) ----
const block = [
  '  <!-- tarot-cards:start (generated by scripts/build-tarot-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.endsWith('/la-bai-tarot/') ? '0.8' : '0.6'}</priority>
  </url>`),
  '  <!-- tarot-cards:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- tarot-cards:start')) {
  sitemap = sitemap.replace(/ {2}<!-- tarot-cards:start[\s\S]*?<!-- tarot-cards:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
