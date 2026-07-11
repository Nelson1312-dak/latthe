/**
 * scripts/build-congiap-pages.mjs — 12 trang tử vi con giáp năm Đinh Mùi 2027:
 *   /tuvi/tuoi-{slug}-2027.html
 * Nội dung luận giải: tuvi/js/congiap-2027-data.js (biên soạn tay).
 * Phần tính toán tự động: can chi + nạp âm năm sinh (bảng 60 hoa giáp),
 * tuổi mụ + sao hạn nam/nữ (bảng cửu diệu dân gian), tháng tốt/xấu theo
 * tam hợp – lục hợp – xung – hại với chi tuổi.
 * Run: node scripts/build-congiap-pages.mjs && npm run seo:lastmod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tuvi');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = 2027;

const { CONGIAP_2027 } = new Function(
  fs.readFileSync(path.join(ROOT, 'tuvi/js/congiap-2027-data.js'), 'utf8') + '; return { CONGIAP_2027 };'
)();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const canChi = (y) => `${CAN[((y - 4) % 10 + 10) % 10]} ${CHI[((y - 4) % 12 + 12) % 12]}`;

// Bảng nạp âm 60 hoa giáp (index cặp = ((year-1984)%60+60)%60 / 2)
const NAP_AM = [
  'Hải Trung Kim', 'Lô Trung Hỏa', 'Đại Lâm Mộc', 'Lộ Bàng Thổ', 'Kiếm Phong Kim',
  'Sơn Đầu Hỏa', 'Giản Hạ Thủy', 'Thành Đầu Thổ', 'Bạch Lạp Kim', 'Dương Liễu Mộc',
  'Tuyền Trung Thủy', 'Ốc Thượng Thổ', 'Tích Lịch Hỏa', 'Tùng Bách Mộc', 'Trường Lưu Thủy',
  'Sa Trung Kim', 'Sơn Hạ Hỏa', 'Bình Địa Mộc', 'Bích Thượng Thổ', 'Kim Bạch Kim',
  'Phúc Đăng Hỏa', 'Thiên Hà Thủy', 'Đại Trạch Thổ', 'Thoa Xuyến Kim', 'Tang Đố Mộc',
  'Đại Khê Thủy', 'Sa Trung Thổ', 'Thiên Thượng Hỏa', 'Thạch Lựu Mộc', 'Đại Hải Thủy',
];
const napAm = (y) => NAP_AM[Math.floor((((y - 1984) % 60 + 60) % 60) / 2)];

// Sao hạn cửu diệu theo tuổi mụ (bảng dân gian phổ thông, khởi 10 tuổi:
// nam La Hầu, nữ Kế Đô). Dư = tuổi mụ % 9 (dư 0 tính là 9).
const SAO_NAM = { 1: 'La Hầu', 2: 'Thổ Tú', 3: 'Thủy Diệu', 4: 'Thái Bạch', 5: 'Thái Dương', 6: 'Vân Hớn', 7: 'Kế Đô', 8: 'Thái Âm', 9: 'Mộc Đức' };
const SAO_NU  = { 1: 'Kế Đô', 2: 'Vân Hớn', 3: 'Mộc Đức', 4: 'Thái Âm', 5: 'Thổ Tú', 6: 'La Hầu', 7: 'Thái Dương', 8: 'Thái Bạch', 9: 'Thủy Diệu' };
const saoHan = (tuoiMu, table) => table[tuoiMu % 9 === 0 ? 9 : tuoiMu % 9];

// Quan hệ địa chi
const TAM_HOP = [[8, 0, 4], [5, 9, 1], [2, 6, 10], [11, 3, 7]];
const LUC_HOP = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
const LUC_HAI = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };
const tamHopOf = (chi) => TAM_HOP.find((g) => g.includes(chi)).filter((c) => c !== chi);

// Tháng âm m (1-12) mang chi (m+1)%12: tháng Giêng = Dần
const monthChi = (m) => (m + 1) % 12;
function monthsFor(chiIdx) {
  const good = [], caution = [];
  const hopSet = new Set([...tamHopOf(chiIdx), LUC_HOP[chiIdx]]);
  for (let m = 1; m <= 12; m++) {
    const mc = monthChi(m);
    if (hopSet.has(mc)) good.push(m);
    if (mc === (chiIdx + 6) % 12 || mc === LUC_HAI[chiIdx]) caution.push(m);
  }
  return { good, caution };
}

const SLUGS = Object.fromEntries(Object.entries(CONGIAP_2027).map(([chi, d]) => [chi, d.slug]));
const pageUrl = (chi) => `/tuvi/tuoi-${SLUGS[chi]}-2027`;

// Năm sinh hợp lý cho tra cứu (18–82 tuổi vào 2027)
function birthYears(chiIdx) {
  const ys = [];
  for (let y = 1945; y <= 2009; y++) if (((y - 4) % 12 + 12) % 12 === chiIdx) ys.push(y);
  return ys;
}

function buildPage(chiName) {
  const d = CONGIAP_2027[chiName];
  const chiIdx = CHI.indexOf(chiName);
  const url = `https://latbai.vn${pageUrl(chiName)}`;
  const title = `Tử Vi Tuổi ${chiName} Năm 2027 (Đinh Mùi): Sự Nghiệp, Tài Lộc, Tình Cảm | latbai.vn`;
  const desc = `Tử vi tuổi ${chiName} (${d.vat}) năm Đinh Mùi 2027 — ${d.quanHe.toLowerCase()}. Luận giải sự nghiệp, tài lộc, tình cảm, sức khỏe, sao hạn theo năm sinh và tháng tốt xấu của tuổi ${chiName}.`;

  const years = birthYears(chiIdx);
  const { good, caution } = monthsFor(chiIdx);
  const hopChi = tamHopOf(chiIdx).map((c) => CHI[c]);
  const isTamTai = [11, 3, 7].includes(chiIdx); // Hợi Mão Mùi — tam tai năm Mùi

  const faq = [
    { q: `Tuổi ${chiName} năm 2027 có phạm Thái Tuế không?`, a: `Năm 2027 là năm Đinh Mùi. Tuổi ${chiName} ở thế "${d.quanHe}" với Thái Tuế.${chiIdx === 7 ? ' Mùi là năm tuổi — phạm Thái Tuế trực tiếp, nên làm lễ cúng Thái Tuế đầu năm và giữ nhịp sống điều độ.' : chiIdx === 1 ? ' Sửu lục xung Thái Tuế — năm biến động, cần chủ động thích ứng và chọn ngày kỹ cho việc lớn.' : isTamTai ? ' Được tam hợp Thái Tuế nâng đỡ nhưng vẫn trong năm tam tai cuối của nhóm Hợi–Mão–Mùi — thuận lợi có điều kiện.' : ''}` },
    { q: `Tuổi ${chiName} năm 2027 làm ăn thế nào?`, a: d.taiLoc },
    { q: `Tuổi ${chiName} cưới hỏi năm 2027 được không?`, a: chiIdx === 7 ? 'Theo quan niệm dân gian, "hỷ sự trấn Thái Tuế" — cưới trong năm tuổi lại là cách hóa giải tốt, miễn chọn ngày chu đáo và hợp tuổi cả hai. Tham khảo công cụ Xem Ngày Tốt của latbai.vn.' : chiIdx === 1 ? 'Năm xung Thái Tuế nên cân nhắc kỹ: hoặc chọn ngày thật cẩn thận (tránh tháng xung), hoặc lùi sang 2028. Quan trọng nhất vẫn là tuổi và ngày của cả hai người.' : `Tuổi ${chiName} năm 2027 không vướng đại kỵ với Thái Tuế nên cưới hỏi bình thường — chọn ngày tránh các tháng cẩn trọng (tháng ${caution.join(', tháng ')} âm) và xem thêm ngày hợp tuổi hai người.` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: `Tử vi tuổi ${chiName} năm 2027 (Đinh Mùi)`, description: desc,
      image: 'https://latbai.vn/images/og-tuvi.png',
      author: { '@type': 'Organization', name: 'Ban biên tập latbai.vn' },
      publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
      mainEntityOfPage: url, dateModified: TODAY },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { '@type': 'ListItem', position: 2, name: 'Tử Vi', item: 'https://latbai.vn/tuvi/' },
      { '@type': 'ListItem', position: 3, name: `Tuổi ${chiName} 2027` },
    ] },
  ] };

  const prevChi = CHI[(chiIdx + 11) % 12];
  const nextChi = CHI[(chiIdx + 1) % 12];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-tuvi.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <script src="/js/mystic-fx.js" defer data-color="232,147,10" data-glyphs="✦✧☾" data-count="28"></script>
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">

  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/tuvi/">Tử Vi</a>
      <i class="ti ti-chevron-right"></i>
      <span>Tuổi ${esc(chiName)} 2027</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Tử Vi Tuổi ${esc(chiName)} Năm 2027 — Đinh Mùi</h1>
      <p style="color: var(--muted); font-size: 14px;">Con ${esc(d.vat)} · <strong>${esc(d.quanHe)}</strong> · Năm ${esc(canChi(YEAR))}, mệnh Thiên Hà Thủy</p>
    </article>

    <div class="article-body">
      <p>${esc(d.tongQuan)}</p>

      <h2 class="tuvi">1. Sự nghiệp tuổi ${esc(chiName)} năm 2027</h2>
      <p>${esc(d.suNghiep)}</p>

      <h2 class="tuvi">2. Tài lộc</h2>
      <p>${esc(d.taiLoc)}</p>

      <h2 class="tuvi">3. Tình cảm</h2>
      <p>${esc(d.tinhCam)}</p>

      <h2 class="tuvi">4. Sức khỏe</h2>
      <p>${esc(d.sucKhoe)}</p>

      <h2 class="tuvi">5. Tháng tốt – tháng cẩn trọng (âm lịch)</h2>
      <ul>
        <li><strong>Tháng thuận</strong> (tam hợp/lục hợp với ${esc(chiName)}): tháng ${good.join(', tháng ')} âm — hợp khởi sự, ký kết, cưới hỏi.</li>
        <li><strong>Tháng cẩn trọng</strong> (xung/hại với ${esc(chiName)}): tháng ${caution.join(', tháng ')} âm — tránh việc trọng đại, đi xa nên xem ngày kỹ tại <a href="/ngay-tot/">công cụ Xem Ngày Tốt</a>.</li>
      </ul>

      <h2 class="tuvi">6. Bảng tra theo năm sinh: can chi, mệnh, sao hạn 2027</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Năm sinh</th><th>Can chi</th><th>Mệnh nạp âm</th><th>Tuổi mụ 2027</th><th>Sao hạn nam</th><th>Sao hạn nữ</th></tr></thead>
          <tbody>
${years.map((y) => {
    const tm = YEAR - y + 1;
    return `            <tr><td><strong>${y}</strong></td><td>${canChi(y)}</td><td>${napAm(y)}</td><td>${tm}</td><td>${saoHan(tm, SAO_NAM)}</td><td>${saoHan(tm, SAO_NU)}</td></tr>`;
  }).join('\n')}
          </tbody>
        </table>
      </div>
      <p><em>Lưu ý: con giáp tính theo năm âm lịch — người sinh tháng 1–2 dương trước Tết thuộc con giáp của năm trước. Sao hạn cửu diệu tính theo tuổi mụ, là quan niệm dân gian mang tính tham khảo.</em></p>

      <h2 class="tuvi">7. Lời khuyên cho tuổi ${esc(chiName)} năm 2027</h2>
      <p>${esc(d.loiKhuyen)}</p>
      <p>Quý nhân tam hợp của bạn trong năm: người tuổi <strong>${esc(hopChi[0])}</strong> và tuổi <strong>${esc(hopChi[1])}</strong>.</p>

      <a href="/tuvi/" class="article-cta tuvi">
        <i class="ti ti-stars"></i> Lập lá số Tử Vi 12 cung chi tiết theo giờ sinh của bạn — miễn phí
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
        <p><strong>Lưu ý:</strong> Tử vi năm mang tính tham khảo &amp; chiêm nghiệm theo lịch pháp và quan niệm dân gian — vận trình thật được quyết định bởi lựa chọn của bạn.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
        <a href="${pageUrl(prevChi)}" class="related-item"><i class="ti ti-arrow-left"></i> Tử vi tuổi ${esc(prevChi)} 2027</a>
        <a href="${pageUrl(nextChi)}" class="related-item"><i class="ti ti-arrow-right"></i> Tử vi tuổi ${esc(nextChi)} 2027</a>
        <a href="/thuvien/han-tam-tai" class="related-item"><i class="ti ti-alert-triangle"></i> Hạn tam tai là gì, tuổi nào đang gặp?</a>
        <a href="/thuvien/12-con-giap" class="related-item"><i class="ti ti-paw"></i> Tam hợp – tứ hành xung của 12 con giáp</a>
        <a href="/bao-cao/" class="related-item"><i class="ti ti-file-star"></i> Báo cáo vận mệnh tổng hợp của bạn</a>
      </div>
    </div>

  </main>

  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/tuvi/">Tử Vi AI</a> ·
        <a href="/ngay-tot/">Ngày Tốt</a> ·
        <a href="/thuvien/">Thư Viện</a>
      </nav>
      <p>&copy; 2026 latbai.vn · <a href="/gioi-thieu">Giới thiệu</a> · <a href="/chinh-sach-bao-mat">Bảo mật</a> · <a href="/lien-he">Liên hệ</a></p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>
</body>
</html>
`;
}

// ---- Generate ----
const urls = [];
for (const chiName of CHI) {
  fs.writeFileSync(path.join(OUT, `tuoi-${SLUGS[chiName]}-2027.html`), buildPage(chiName), 'utf8');
  urls.push(`https://latbai.vn${pageUrl(chiName)}`);
}
console.log(`Generated ${urls.length} con giáp pages in /tuvi/`);

// ---- Sitemap block ----
const block = [
  '  <!-- congiap:start (generated by scripts/build-congiap-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`),
  '  <!-- congiap:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- congiap:start')) {
  sitemap = sitemap.replace(/ {2}<!-- congiap:start[\s\S]*?<!-- congiap:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
