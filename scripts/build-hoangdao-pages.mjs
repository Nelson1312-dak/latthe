/**
 * scripts/build-hoangdao-pages.mjs — sinh 90 trang cung hoàng đạo tĩnh:
 *   - 12 trang cung:  /hoang-dao/cung-{slug}.html   ("cung bạch dương")
 *   - 78 trang cặp:   /hoang-dao/{a}-va-{b}.html    ("bạch dương và sư tử có hợp nhau không")
 * Dữ liệu: hoang-dao/js/zodiac-data.js (ZODIAC). Điểm hợp tái tạo đúng
 * logic matchOf trong hoang-dao/js/app.js (FNV-1a seed → deterministic).
 * Run: node scripts/build-hoangdao-pages.mjs  (rồi npm run seo:lastmod)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'hoang-dao');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Nạp dữ liệu nguồn ----
const zdSrc = fs.readFileSync(path.join(ROOT, 'hoang-dao', 'js', 'zodiac-data.js'), 'utf8');
const { ZODIAC } = new Function(`${zdSrc}; return { ZODIAC };`)();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// FNV-1a — giống LatbaiProfile.seedHash (js/profile.js)
function seedHash(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// giống matchOf trong hoang-dao/js/app.js
function matchOf(a, bName) {
  let score, verdict;
  if (a.hop.includes(bName)) { score = 82 + (seedHash(a.en + bName) % 14); verdict = 'Rất hợp'; }
  else if (a.khac.includes(bName)) { score = 44 + (seedHash(a.en + bName) % 14); verdict = 'Cần dung hòa'; }
  else { score = 62 + (seedHash(a.en + bName) % 18); verdict = 'Khá hợp'; }
  return { score, verdict };
}

const SLUG = {
  'Bạch Dương': 'bach-duong', 'Kim Ngưu': 'kim-nguu', 'Song Tử': 'song-tu',
  'Cự Giải': 'cu-giai', 'Sư Tử': 'su-tu', 'Xử Nữ': 'xu-nu',
  'Thiên Bình': 'thien-binh', 'Bọ Cạp': 'bo-cap', 'Nhân Mã': 'nhan-ma',
  'Ma Kết': 'ma-ket', 'Bảo Bình': 'bao-binh', 'Song Ngư': 'song-ngu',
};
const slugOf = (z) => SLUG[z.ten];
const cungUrl = (z) => `/hoang-dao/cung-${slugOf(z)}`;
const idxOf = (z) => ZODIAC.indexOf(z);
const pairPath = (a, b) => {
  const [x, y] = idxOf(a) <= idxOf(b) ? [a, b] : [b, a];
  return `/hoang-dao/${slugOf(x)}-va-${slugOf(y)}`;
};

// ---- Tương tác nguyên tố (10 tổ hợp) ----
const EL_KEY = (a, b) => [a, b].sort().join('+');
const ELEMENTS = {
  'Hỏa+Hỏa': 'Hai ngọn lửa gặp nhau — đam mê bùng nổ, năng lượng lúc nào cũng ở mức cao và cả hai đều hiểu khát khao hành động của đối phương. Rủi ro duy nhất: hai cái tôi cùng nóng, cãi nhau cũng... bùng nổ không kém. Học cách nhường lượt là chìa khóa.',
  'Hỏa+Thổ': 'Lửa muốn cháy nhanh, đất muốn xây chậm — đây là cặp khác nhịp điệu. Người Thổ thấy người Hỏa liều lĩnh, người Hỏa thấy người Thổ chần chừ. Nhưng nếu kiên nhẫn, Thổ cho Hỏa nền móng để cháy bền, Hỏa cho Thổ can đảm để bứt phá.',
  'Hỏa+Khí': 'Gió thổi bùng ngọn lửa — tổ hợp tự nhiên hợp nhau bậc nhất hoàng đạo. Khí mang ý tưởng, Hỏa mang hành động; ở cạnh nhau cả hai thấy mình sống động hơn. Chỉ cần một người chịu giữ chân trên mặt đất khi cả hai cùng bay quá cao.',
  'Hỏa+Thủy': 'Nước và lửa — hấp dẫn kiểu đối cực. Cảm xúc sâu của Thủy có thể làm dịu (hoặc dập tắt) sự bốc đồng của Hỏa; nhiệt của Hỏa có thể sưởi ấm (hoặc làm sôi trào) nội tâm Thủy. Cặp này cần nhiều đối thoại và tôn trọng khác biệt hơn mức trung bình.',
  'Thổ+Thổ': 'Ổn định gặp ổn định — nền móng kép vững như bàn thạch. Cả hai cùng ngôn ngữ về tiền bạc, cam kết và tương lai. Điều cần đề phòng là sự an toàn quá mức khiến mối quan hệ thành thói quen; thỉnh thoảng cần một chuyến đi không kế hoạch.',
  'Thổ+Khí': 'Đất và gió sống ở hai tần số: Khí bay bổng với ý tưởng, Thổ bám rễ vào thực tế. Dễ có cảm giác "người kia không hiểu mình". Bù lại, nếu chịu học nhau — Khí dạy Thổ sự cởi mở, Thổ dạy Khí cách biến ý tưởng thành kết quả.',
  'Thổ+Thủy': 'Nước tưới cho đất — một trong những tổ hợp nuôi dưỡng nhau tự nhiên nhất. Thủy mang cảm xúc và trực giác, Thổ mang sự vững chãi để cảm xúc ấy có nơi neo đậu. Cặp này thường bền, chỉ cần Thổ đừng quá khô khan và Thủy đừng quá dâng trào.',
  'Khí+Khí': 'Hai luồng gió gặp nhau — cuộc trò chuyện không có hồi kết, ý tưởng nảy liên tục, tự do được cả hai tôn trọng tuyệt đối. Điểm mù của cặp này là thiếu người "giữ đất": kế hoạch nhiều mà triển khai ít, cảm xúc sâu đôi khi bị né tránh.',
  'Khí+Thủy': 'Gió gợn sóng trên mặt nước — thú vị và giàu cảm hứng, nhưng là cuộc đối thoại giữa lý trí và cảm xúc. Khí phân tích điều Thủy chỉ muốn được cảm nhận. Khi hiểu ra người kia "xử lý thế giới" khác mình, đây lại là cặp bổ khuyết đẹp.',
  'Thủy+Thủy': 'Hai đại dương hòa vào nhau — thấu cảm gần như ngoại cảm, không cần nói cũng hiểu. Đây là kết nối cảm xúc sâu nhất hoàng đạo, nhưng cũng dễ cùng chìm khi cả hai đồng thời xuống tinh thần. Cần ít nhất một người giữ vai trò mặt trời.',
};

const QUALITY_NOTE = {
  'Thống Lĩnh+Thống Lĩnh': 'Cả hai đều thuộc nhóm Thống Lĩnh — ai cũng muốn cầm lái, nên phân vai rõ ràng sẽ tránh được 90% va chạm.',
  'Kiên Định+Kiên Định': 'Cả hai đều thuộc nhóm Kiên Định — cam kết cực bền, nhưng khi bất đồng thì không ai chịu lùi; hãy quy ước trước cách "xuống thang".',
  'Linh Hoạt+Linh Hoạt': 'Cả hai đều thuộc nhóm Linh Hoạt — thích nghi giỏi, ít cãi vã, nhưng cần chủ động đặt mục tiêu chung kẻo mối quan hệ trôi tự do.',
  'Kiên Định+Thống Lĩnh': 'Một người khởi xướng (Thống Lĩnh), một người duy trì (Kiên Định) — phân vai tự nhiên khá đẹp nếu tôn trọng lãnh địa của nhau.',
  'Linh Hoạt+Thống Lĩnh': 'Người Thống Lĩnh dẫn đường, người Linh Hoạt điều chỉnh theo — cặp vai trò mượt, miễn là người linh hoạt không thấy mình luôn phải nhường.',
  'Kiên Định+Linh Hoạt': 'Người Kiên Định giữ hướng, người Linh Hoạt xoay xở tình huống — bổ khuyết tốt, chỉ cần bên kiên định đừng xem sự linh hoạt là "ba phải".',
};
const qualityOf = (t) => t.replace(/\s*\(.+\)/, '').trim(); // 'Thống Lĩnh (Cardinal)' → 'Thống Lĩnh'
const qualityNote = (a, b) => QUALITY_NOTE[[qualityOf(a.tinhChat), qualityOf(b.tinhChat)].sort().join('+')] || '';

const HEAD = (title, desc, url, jsonLd) => `<!DOCTYPE html>
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
  <meta property="og:image" content="https://latbai.vn/images/og-main.png">
  <meta property="og:site_name" content="latbai.vn">
  <link rel="icon" type="image/svg+xml" href="/images/icon.svg">
  <link rel="apple-touch-icon" href="/images/icon.svg">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/thuvien/css/thuvien.css">
  <script src="/js/mystic-fx.js" defer data-color="124,58,237" data-glyphs="✦✧☾" data-count="28"></script>
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}
  </script>
</head>
<body class="light-theme thuvien-theme">
`;

const FOOTER = `  <footer class="footer">
    <div class="container">
      <nav class="footer-nav">
        <a href="/">Trang Chủ</a> ·
        <a href="/hoang-dao/">Cung Hoàng Đạo</a> ·
        <a href="/ghep-doi/">Ghép Đôi</a> ·
        <a href="/thuvien/">Thư Viện</a>
      </nav>
      <p>&copy; 2026 latbai.vn · <a href="/gioi-thieu">Giới thiệu</a> · <a href="/chinh-sach-bao-mat">Bảo mật</a> · <a href="/lien-he">Liên hệ</a></p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>
</body>
</html>
`;

const breadcrumbLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.name, ...(it.item ? { item: it.item } : {}),
  })),
});
const articleLd = (headline, desc, url) => ({
  '@type': 'Article', headline, description: desc,
  image: 'https://latbai.vn/images/og-main.png',
  author: { '@type': 'Organization', name: 'Ban biên tập latbai.vn' },
  publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
  mainEntityOfPage: url,
});
const faqLd = (faq) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

// ============================================================
// Trang cung: /hoang-dao/cung-{slug}.html
// ============================================================
function buildSignPage(z) {
  const url = `https://latbai.vn${cungUrl(z)}`;
  const title = `Cung ${z.ten} (${z.range}): Tính Cách, Tình Yêu, Sự Nghiệp | latbai.vn`;
  const desc = `Cung ${z.ten} (${z.en}, ${z.range}) — nguyên tố ${z.nguyeTo}, ${z.sao} chiếu mệnh. Giải mã tính cách, tình yêu, sự nghiệp, tài chính và độ hợp của ${z.ten} với 11 cung còn lại.`;

  const rows = ZODIAC.filter((o) => o !== z).map((o) => {
    const r = matchOf(z, o.ten);
    return { o, ...r };
  }).sort((x, y) => y.score - x.score);

  const faq = [
    { q: `Cung ${z.ten} sinh ngày nào?`, a: `Cung ${z.ten} (${z.en}) gồm những người sinh từ ${z.range} dương lịch, thuộc nguyên tố ${z.nguyeTo}, nhóm ${z.tinhChat}, được ${z.sao} chiếu mệnh.` },
    { q: `Cung ${z.ten} hợp với cung nào nhất?`, a: `${z.ten} hợp tự nhiên nhất với ${z.hop.join(', ')} — các cung cùng hoặc bổ trợ nguyên tố ${z.nguyeTo}. Hợp không có nghĩa đảm bảo, mà là hai năng lượng dễ cộng hưởng.` },
    { q: `Cung ${z.ten} khắc cung nào?`, a: `${z.ten} thường cần dung hòa nhiều nhất với ${z.khac.join(' và ')}. "Khắc" không phải không thể yêu — chỉ là hai nhịp sống khác nhau, cần đối thoại nhiều hơn.` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Cung ${z.ten} — hồ sơ đầy đủ`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Cung Hoàng Đạo', item: 'https://latbai.vn/hoang-dao/' },
      { name: `Cung ${z.ten}` },
    ]),
  ] };

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/hoang-dao/">Cung Hoàng Đạo</a>
      <i class="ti ti-chevron-right"></i>
      <span>${esc(z.ten)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">Cung ${esc(z.ten)} (${esc(z.range)}): Tính Cách, Tình Yêu, Sự Nghiệp</h1>
      <p style="color: var(--muted); font-size: 14px;">${esc(z.en)} · Nguyên tố <strong>${esc(z.nguyeTo)}</strong> · ${esc(z.sao)}</p>
    </article>

    <div class="article-body">
      <p style="text-align:center; font-size:56px; line-height:1; margin: 8px 0 4px;">${z.sym}</p>
      <p style="text-align:center; color: var(--muted); margin-top:0;">${esc(z.bieuTuong)} · ${esc(z.range)}</p>

      <p>${esc(z.tongQuan)}</p>

      <div class="table-responsive">
        <table class="seo-table">
          <tbody>
            <tr><td><strong>Ngày sinh</strong></td><td>${esc(z.range)}</td></tr>
            <tr><td><strong>Nguyên tố</strong></td><td>${esc(z.nguyeTo)}</td></tr>
            <tr><td><strong>Nhóm tính chất</strong></td><td>${esc(z.tinhChat)}</td></tr>
            <tr><td><strong>Sao chiếu mệnh</strong></td><td>${esc(z.sao)}</td></tr>
            <tr><td><strong>Màu may mắn</strong></td><td>${esc(z.mau)}</td></tr>
            <tr><td><strong>Số may mắn</strong></td><td>${esc(z.so)}</td></tr>
            <tr><td><strong>Ngày may mắn</strong></td><td>${esc(z.ngay)}</td></tr>
            <tr><td><strong>Đá hộ mệnh</strong></td><td>${esc(z.da)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 class="tuvi">1. Điểm mạnh và điểm yếu của ${esc(z.ten)}</h2>
      <p><strong>Điểm mạnh:</strong></p>
      <ul>${z.manh.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <p><strong>Điểm cần hoàn thiện:</strong></p>
      <ul>${z.yeu.map((y) => `<li>${esc(y)}</li>`).join('')}</ul>

      <h2 class="tuvi">2. ${esc(z.ten)} trong tình yêu</h2>
      <p>${esc(z.tinhYeu)}</p>
      <p>Hợp tự nhiên nhất với ${z.hop.map((n) => { const o = ZODIAC.find((s) => s.ten === n); return `<a href="${pairPath(z, o)}">${esc(n)}</a>`; }).join(', ')}; cần dung hòa nhiều nhất với ${z.khac.map((n) => { const o = ZODIAC.find((s) => s.ten === n); return `<a href="${pairPath(z, o)}">${esc(n)}</a>`; }).join(' và ')}.</p>

      <h2 class="tuvi">3. Sự nghiệp và tài chính</h2>
      <p><strong>Sự nghiệp:</strong> ${esc(z.suNghiep)}</p>
      <p><strong>Tài chính:</strong> ${esc(z.taiChinh)}</p>

      <h2 class="tuvi">4. Độ hợp của ${esc(z.ten)} với 11 cung</h2>
      <div class="table-responsive">
        <table class="seo-table">
          <thead><tr><th>Cặp đôi</th><th>Độ hợp</th><th>Nhận định</th></tr></thead>
          <tbody>
${rows.map(({ o, score, verdict }) => `            <tr><td><a href="${pairPath(z, o)}">${esc(z.ten)} × ${esc(o.ten)}</a></td><td><strong>${score}%</strong></td><td>${esc(verdict)}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>

      <a href="/hoang-dao/" class="article-cta tuvi">
        <i class="ti ti-stars"></i> Xem tử vi hôm nay của ${esc(z.ten)} — cập nhật mỗi ngày
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
        <p><strong>Lưu ý:</strong> Nội dung theo chiêm tinh phương Tây, mang tính tham khảo &amp; chiêm nghiệm — con người luôn nhiều màu sắc hơn một chòm sao.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Khám phá tiếp</h3>
      <div class="related-list">
        <a href="/sinh-ngay/" class="related-item"><i class="ti ti-calendar"></i> Tra cứu ngày sinh của bạn</a>
        <a href="/ghep-doi/" class="related-item"><i class="ti ti-hearts"></i> Ghép đôi theo tên &amp; ngày sinh</a>
        <a href="/bao-cao/" class="related-item"><i class="ti ti-file-star"></i> Báo cáo vận mệnh tổng hợp</a>
        <a href="/tuvi/" class="related-item"><i class="ti ti-stars"></i> Lá số Tử Vi Đẩu Số</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ============================================================
// Trang cặp: /hoang-dao/{a}-va-{b}.html  (a, b theo thứ tự hoàng đạo)
// ============================================================
function buildPairPage(a, b) {
  const same = a === b;
  const { score, verdict } = matchOf(a, b.ten);
  const urlPath = pairPath(a, b);
  const url = `https://latbai.vn${urlPath}`;
  const title = same
    ? `${a.ten} và ${a.ten} Có Hợp Nhau Không? Độ Hợp ${score}% | latbai.vn`
    : `${a.ten} và ${b.ten} Có Hợp Nhau Không? Độ Hợp ${score}% | latbai.vn`;
  const desc = `Độ hợp ${a.ten} và ${b.ten}: ${score}% — ${verdict.toLowerCase()}. Phân tích tình yêu, tính cách và những điểm cần dung hòa giữa ${a.ten} (${a.nguyeTo}) và ${b.ten} (${b.nguyeTo}).`;

  const elText = ELEMENTS[EL_KEY(a.nguyeTo, b.nguyeTo)] || '';
  const qNote = same
    ? `Cả hai cùng nhóm ${qualityOf(a.tinhChat)} — hiểu nhau tận gốc, nhưng cũng "giống nhau đến mức khó chịu" ở chính những điểm yếu chung.`
    : qualityNote(a, b);

  const openLine = same
    ? `Hai người cùng cung ${a.ten} đến với nhau giống như soi gương: mọi điểm mạnh được nhân đôi, và mọi góc khuất cũng vậy. Độ hợp ước tính <strong>${score}%</strong> — ${verdict.toLowerCase()}.`
    : `${a.ten} (${a.range}) và ${b.ten} (${b.range}) là cặp ${a.nguyeTo} × ${b.nguyeTo}, độ hợp ước tính <strong>${score}%</strong> — ${verdict.toLowerCase()}.`;

  const advice = score >= 80
    ? 'Nền tảng cộng hưởng đã có sẵn — việc của hai bạn là đừng để sự "quá hợp" thành chủ quan. Vẫn hẹn hò, vẫn lắng nghe, vẫn nói lời cảm ơn như thuở đầu.'
    : score >= 62
      ? 'Đây là cặp đôi "xây được" — không tự nhiên hoàn hảo nhưng đủ nguyên liệu tốt. Đầu tư vào đối thoại thẳng thắn và tôn trọng nhịp sống của nhau, điểm số này sẽ tự tăng theo năm tháng.'
      : 'Hai nhịp sống khác nhau rõ rệt — nhưng chính những cặp "khắc" khi vượt qua được giai đoạn dung hòa lại thường bền hơn cả, vì họ đã học được cách yêu một người khác mình. Chậm lại, hỏi nhiều hơn phán xét.';

  const faq = [
    { q: `${a.ten} và ${b.ten} có hợp nhau không?`, a: `Độ hợp ${a.ten} – ${b.ten} ước tính ${score}% (${verdict.toLowerCase()}). ${elText.split('.')[0]}. Kết quả mang tính tham khảo theo chiêm tinh phương Tây.` },
    { q: `${a.ten} và ${b.ten} trong công việc thì sao?`, a: `${a.ten}: ${a.suNghiep} ${b.ten}: ${b.suNghiep} Khi làm việc chung, hãy phân vai theo đúng thế mạnh tự nhiên này.` },
    { q: `Cặp ${a.ten} – ${b.ten} cần lưu ý gì nhất?`, a: `${a.ten} cần để ý xu hướng "${a.yeu[0].toLowerCase()}", còn ${b.ten} là "${b.yeu[0].toLowerCase()}". Gọi tên được điểm yếu của chính mình là 80% của sự dung hòa.` },
  ];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    articleLd(`Độ hợp ${a.ten} và ${b.ten}`, desc, url),
    faqLd(faq),
    breadcrumbLd([
      { name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { name: 'Cung Hoàng Đạo', item: 'https://latbai.vn/hoang-dao/' },
      { name: `${a.ten} và ${b.ten}` },
    ]),
  ] };

  const others = a.hop.filter((n) => n !== b.ten).slice(0, 2).map((n) => ZODIAC.find((s) => s.ten === n));

  return HEAD(title, desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/hoang-dao/">Cung Hoàng Đạo</a>
      <i class="ti ti-chevron-right"></i>
      <span>${esc(a.ten)} &amp; ${esc(b.ten)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">${esc(a.ten)} và ${esc(b.ten)} Có Hợp Nhau Không?</h1>
      <p style="color: var(--muted); font-size: 14px;">${esc(a.nguyeTo)} × ${esc(b.nguyeTo)} · Độ hợp <strong>${score}%</strong> · ${esc(verdict)}</p>
    </article>

    <div class="article-body">
      <p style="text-align:center; font-size:44px; line-height:1; margin: 8px 0 4px;">${a.sym} ❤︎ ${b.sym}</p>
      <p style="text-align:center; color: var(--muted); margin-top:0;"><a href="${cungUrl(a)}">${esc(a.ten)}</a> (${esc(a.range)}) · <a href="${cungUrl(b)}">${esc(b.ten)}</a> (${esc(b.range)})</p>

      <p>${openLine}</p>

      <h2 class="tuvi">1. Năng lượng ${esc(a.nguyeTo)} gặp ${esc(b.nguyeTo)}</h2>
      <p>${esc(elText)}</p>
      ${qNote ? `<p>${esc(qNote)}</p>` : ''}

      <h2 class="tuvi">2. Khi ${esc(a.ten)} yêu ${esc(b.ten)}</h2>
      <p><strong>${esc(a.ten)}:</strong> ${esc(a.tinhYeu)}</p>
      ${same ? '' : `<p><strong>${esc(b.ten)}:</strong> ${esc(b.tinhYeu)}</p>`}
      <p><strong>Điểm cộng của cặp này:</strong> ${esc(a.ten)} mang ${esc(a.manh[0].toLowerCase())} và ${esc(a.manh[1].toLowerCase())}; ${esc(b.ten)} góp ${esc(b.manh[0].toLowerCase())} và ${esc(b.manh[1].toLowerCase())}.</p>
      <p><strong>Điểm cần dung hòa:</strong> xu hướng ${esc(a.yeu[0].toLowerCase())} của ${esc(a.ten)} ${same ? 'khi nhân đôi sẽ cần cả hai cùng tỉnh táo' : `có thể va vào ${esc(b.yeu[0].toLowerCase())} của ${esc(b.ten)}`} — biết trước để không bất ngờ.</p>

      <h2 class="tuvi">3. Lời khuyên cho cặp ${esc(a.ten)} – ${esc(b.ten)}</h2>
      <p>${advice}</p>

      <a href="/ghep-doi/" class="article-cta tuvi">
        <i class="ti ti-hearts"></i> Xem độ hợp chi tiết theo tên &amp; ngày sinh của hai bạn
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
        <p><strong>Lưu ý:</strong> Độ hợp cung hoàng đạo mang tính tham khảo &amp; giải trí — tình cảm thật được xây bằng lắng nghe và thấu hiểu.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Xem thêm</h3>
      <div class="related-list">
        <a href="${cungUrl(a)}" class="related-item"><i class="ti ti-stars"></i> Hồ sơ đầy đủ cung ${esc(a.ten)}</a>
        ${same ? '' : `<a href="${cungUrl(b)}" class="related-item"><i class="ti ti-stars"></i> Hồ sơ đầy đủ cung ${esc(b.ten)}</a>`}
${others.map((o) => `        <a href="${pairPath(a, o)}" class="related-item"><i class="ti ti-hearts"></i> ${esc(a.ten)} và ${esc(o.ten)} có hợp nhau không?</a>`).join('\n')}
        <a href="/hoang-dao/" class="related-item"><i class="ti ti-zodiac-leo"></i> Tử vi hôm nay của 12 cung</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ---- Generate ----
const urls = [];

for (const z of ZODIAC) {
  fs.writeFileSync(path.join(OUT, `cung-${slugOf(z)}.html`), buildSignPage(z), 'utf8');
  urls.push(`https://latbai.vn${cungUrl(z)}`);
}

for (let i = 0; i < ZODIAC.length; i++) {
  for (let j = i; j < ZODIAC.length; j++) {
    const a = ZODIAC[i], b = ZODIAC[j];
    fs.writeFileSync(path.join(OUT, `${pairPath(a, b).split('/').pop()}.html`), buildPairPage(a, b), 'utf8');
    urls.push(`https://latbai.vn${pairPath(a, b)}`);
  }
}
console.log(`Generated ${urls.length} pages in /hoang-dao/`);

// ---- Sitemap block (idempotent) ----
const block = [
  '  <!-- hoangdao:start (generated by scripts/build-hoangdao-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>${u.includes('/cung-') ? '0.6' : '0.5'}</priority>
  </url>`),
  '  <!-- hoangdao:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- hoangdao:start')) {
  sitemap = sitemap.replace(/ {2}<!-- hoangdao:start[\s\S]*?<!-- hoangdao:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log(`Sitemap updated: +${urls.length} URLs`);
