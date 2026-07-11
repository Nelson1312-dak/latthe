/**
 * scripts/build-tarot-topic-pages.mjs — 6 trang chủ đề Tarot (topic hub):
 *   /la-bai-tarot/chu-de-tinh-yeu | chu-de-cong-viec | chu-de-tai-chinh |
 *   chu-de-suc-khoe | la-bai-dang-so-nhat | la-bai-tot-nhat
 * Mỗi trang curate các lá liên quan + lời bình theo ngữ cảnh (biên tập trong
 * TOPICS bên dưới), link vào 78 trang lá bài tĩnh — script fail nếu tên lá sai.
 * Run: node scripts/build-tarot-topic-pages.mjs && npm run seo:lastmod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'la-bai-tarot');
const SITEMAP = path.join(ROOT, 'sitemap-latbai.xml');
const TODAY = new Date().toISOString().slice(0, 10);

const TAROT_CARDS = new Function(fs.readFileSync(path.join(ROOT, 'tarot/js/cards.js'), 'utf8') + '; return TAROT_CARDS;')();
const { MINOR_ARCANA, SUITS } = new Function(fs.readFileSync(path.join(ROOT, 'tarot/js/cards-minor.js'), 'utf8') + '; return { MINOR_ARCANA, SUITS };')();

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BY_NAME = {};
for (const c of TAROT_CARDS) BY_NAME[c.name] = { name: c.name, vn: c.vn, symbol: c.symbol, keywords: c.keywords };
for (const c of MINOR_ARCANA) BY_NAME[c.name] = { name: c.name, vn: c.vn, symbol: SUITS[c.suit].symbol || '', keywords: c.keywords };
const card = (name) => {
  if (!BY_NAME[name]) throw new Error(`Không có lá bài tên "${name}"`);
  return BY_NAME[name];
};
const cardUrl = (name) => `/la-bai-tarot/${slugify(name)}`;

// ============================================================
// Nội dung biên tập theo chủ đề
// ============================================================
const TOPICS = [
  {
    slug: 'chu-de-tinh-yeu',
    title: 'Tarot Tình Yêu: Những Lá Bài Quan Trọng Nhất Về Tình Cảm',
    h1: 'Tarot Tình Yêu — Những Lá Bài Quan Trọng Nhất',
    desc: 'Những lá bài Tarot quan trọng nhất khi hỏi về tình yêu: lá báo hiệu tình cảm nở hoa, lá cảnh báo tổn thương và cách đọc chúng trong trải bài tình cảm.',
    intro: 'Hỏi Tarot về tình yêu là chủ đề phổ biến nhất trong mọi trải bài. Dưới đây là những lá bài "nặng ký" nhất khi xuất hiện trong câu hỏi tình cảm — chia theo nhóm tín hiệu tốt và nhóm nhắc bạn nhìn thẳng vào vết thương. Muốn trải bài ngay, dùng <a href="/tarot/">công cụ rút bài Tarot tình yêu online</a> hoặc đọc <a href="/thuvien/boi-tarot-tinh-yeu">cách đặt câu hỏi tình yêu cho Tarot</a>.',
    sections: [
      {
        h2: 'Những lá bài báo hiệu tình yêu nở hoa',
        cards: [
          ['The Lovers', 'Lá bài tình yêu số một của bộ Tarot — kết nối sâu sắc, giá trị hòa hợp, một lựa chọn quan trọng của trái tim.'],
          ['Two of Cups', 'Tình cảm hai chiều cân bằng, cùng cho và cùng nhận — lá đẹp nhất cho giai đoạn tìm hiểu.'],
          ['Ten of Cups', 'Hạnh phúc viên mãn kiểu "mái ấm" — tín hiệu của gắn bó lâu dài, gia đình êm ấm.'],
          ['Ace of Cups', 'Một dòng cảm xúc mới đang mở ra — tình yêu mới, hoặc chương mới trong mối quan hệ cũ.'],
          ['The Empress', 'Năng lượng nuôi dưỡng, được yêu chiều — mối quan hệ đang trong giai đoạn nảy nở.'],
          ['The Sun', 'Niềm vui, sự rõ ràng, không có gì phải giấu — cặp đôi minh bạch và ấm áp.'],
        ],
      },
      {
        h2: 'Những lá bài nhắc bạn nhìn thẳng',
        cards: [
          ['Three of Swords', 'Tổn thương, phản bội hoặc sự thật đau lòng — vết cắt cần được thừa nhận trước khi lành.'],
          ['The Tower', 'Nền móng mối quan hệ lung lay — đổ vỡ đột ngột nhưng thường là cần thiết.'],
          ['Five of Cups', 'Chìm trong tiếc nuối những gì đã mất mà quên hai chén tình cảm còn nguyên sau lưng.'],
          ['Eight of Cups', 'Đã đến lúc rời đi để tìm điều ý nghĩa hơn — lá bài của sự buông tay chủ động.'],
          ['The Devil', 'Ràng buộc không lành mạnh, lệ thuộc hoặc cám dỗ — yêu mà mất tự do thì cần xem lại.'],
        ],
      },
    ],
    related: [
      { href: '/thuvien/boi-tarot-tinh-yeu', icon: 'ti-article', label: 'Bói Tarot tình yêu: có nên tiếp tục mối quan hệ?' },
      { href: '/thuvien/the-lovers-tarot', icon: 'ti-article', label: 'Ý nghĩa lá The Lovers trong tình yêu' },
      { href: '/ghep-doi/', icon: 'ti-hearts', label: 'Ghép đôi theo tên & ngày sinh' },
    ],
    faq: [
      { q: 'Lá bài Tarot nào tốt nhất cho tình yêu?', a: 'The Lovers, Two of Cups và Ten of Cups là bộ ba đẹp nhất cho câu hỏi tình cảm — kết nối sâu sắc, tình cảm hai chiều và hạnh phúc bền lâu. Tuy nhiên ý nghĩa cuối cùng luôn phụ thuộc vị trí lá bài và câu hỏi cụ thể.' },
      { q: 'Rút được lá xấu trong trải bài tình yêu có đáng sợ không?', a: 'Không. Các lá như Three of Swords hay The Tower không phán "chia tay" — chúng chỉ ra vết thương hoặc nền móng cần nhìn thẳng. Tarot là tấm gương giúp bạn quyết định tỉnh táo, không phải bản án.' },
    ],
  },
  {
    slug: 'chu-de-cong-viec',
    title: 'Tarot Công Việc: Những Lá Bài Về Sự Nghiệp Và Thăng Tiến',
    h1: 'Tarot Công Việc — Những Lá Bài Về Sự Nghiệp',
    desc: 'Những lá bài Tarot quan trọng nhất khi hỏi về công việc, sự nghiệp: lá báo hiệu thăng tiến, khởi đầu mới, và lá cảnh báo kiệt sức hay trì trệ.',
    intro: 'Trải bài công việc thường xoay quanh ba câu hỏi: có nên nhảy việc, dự án này ra sao, và bao giờ được ghi nhận. Đây là những lá bài định hình câu trả lời — kèm nghĩa riêng trong ngữ cảnh sự nghiệp. Trải bài với câu hỏi của riêng bạn tại <a href="/tarot/">công cụ Tarot online</a>.',
    sections: [
      {
        h2: 'Những lá bài báo hiệu sự nghiệp khởi sắc',
        cards: [
          ['The Magician', 'Bạn có đủ công cụ và kỹ năng — thời điểm hành động, ra mắt, chốt deal.'],
          ['The Emperor', 'Quyền lực có cấu trúc — thăng chức, vai trò quản lý, xây hệ thống.'],
          ['The Chariot', 'Chiến thắng nhờ ý chí và kỷ luật — dự án về đích nếu bạn giữ tay lái chắc.'],
          ['Ace of Wands', 'Tia lửa khởi đầu — dự án mới, cơ hội mới, nguồn cảm hứng vừa nhen.'],
          ['Eight of Pentacles', 'Người thợ rèn tay nghề — giai đoạn mài giũa chuyên môn được đền đáp.'],
          ['Three of Pentacles', 'Teamwork được việc — hợp tác, được công nhận năng lực trong tập thể.'],
          ['Wheel of Fortune', 'Bánh xe đang quay — biến động lớn, thường mở ra cơ hội bất ngờ.'],
        ],
      },
      {
        h2: 'Những lá bài cảnh báo trong công việc',
        cards: [
          ['Ten of Wands', 'Ôm quá nhiều việc — kiệt sức đến gần, học cách san tải trước khi gãy.'],
          ['The Hanged Man', 'Treo lại để nhìn từ góc khác — giai đoạn chững có chủ đích, đừng ép tiến độ.'],
          ['Five of Pentacles', 'Cảm giác bị bỏ rơi, khó khăn tài chính-nghề nghiệp — nhưng cánh cửa giúp đỡ ở ngay cạnh.'],
          ['Seven of Swords', 'Cẩn trọng chuyện chính trị công sở — có người đi đường tắt sau lưng.'],
        ],
      },
    ],
    related: [
      { href: '/thuvien/gieo-que-su-nghiep', icon: 'ti-article', label: 'Gieo quẻ hỏi chuyện sự nghiệp' },
      { href: '/thuvien/cach-trai-bai-tarot', icon: 'ti-article', label: '4 kiểu trải bài Tarot cho người mới' },
      { href: '/thansohoc/', icon: 'ti-hash', label: 'Con số sự nghiệp trong thần số học' },
    ],
    faq: [
      { q: 'Lá bài nào báo hiệu thăng tiến trong công việc?', a: 'The Emperor (vai trò quản lý), The Chariot (về đích thắng lợi), Three of Pentacles (được công nhận) và Wheel of Fortune (bước ngoặt) là các lá mạnh nhất về thăng tiến khi xuất hiện xuôi trong trải bài công việc.' },
      { q: 'Nên hỏi Tarot về công việc như thế nào?', a: 'Hỏi về hành động của bạn thay vì đoán ý người khác: "Nếu tôi nhận vị trí này, điều gì chờ phía trước?" tốt hơn "Sếp có thích tôi không?". Câu hỏi càng cụ thể, lá bài trả lời càng rõ.' },
    ],
  },
  {
    slug: 'chu-de-tai-chinh',
    title: 'Tarot Tài Chính: Những Lá Bài Về Tiền Bạc Và Đầu Tư',
    h1: 'Tarot Tài Chính — Những Lá Bài Về Tiền Bạc',
    desc: 'Những lá bài Tarot nói về tiền bạc: bộ Tiền (Pentacles) và các lá báo hiệu thịnh vượng, tích lũy — cùng các lá cảnh báo rủi ro, mất mát tài chính.',
    intro: 'Trong Tarot, chuyện tiền bạc chủ yếu nằm ở <strong>bộ Tiền (Pentacles)</strong> — nguyên tố Đất, chủ về vật chất, công việc tay nghề và tích lũy. Dưới đây là những lá đáng chú ý nhất khi câu hỏi liên quan đến tài chính, đầu tư hay mua sắm lớn. Hỏi chuyện tiền bạc của riêng bạn tại <a href="/tarot/">trải bài Tarot online</a>.',
    sections: [
      {
        h2: 'Những lá bài thịnh vượng',
        cards: [
          ['Ace of Pentacles', 'Hạt giống tài chính mới — cơ hội thu nhập, lời mời làm ăn đáng nắm.'],
          ['Nine of Pentacles', 'Độc lập tài chính nhờ nỗ lực bản thân — tận hưởng thành quả xứng đáng.'],
          ['Ten of Pentacles', 'Thịnh vượng thế hệ — tài sản bền vững, chuyện nhà đất, thừa kế thuận lợi.'],
          ['King of Pentacles', 'Bậc thầy quản trị tài sản — đầu tư chín chắn, kinh doanh vững tay.'],
          ['Six of Pentacles', 'Dòng tiền cân bằng cho–nhận — trả nợ xong, được giúp đỡ, hoặc nên cho đi.'],
        ],
      },
      {
        h2: 'Những lá bài cảnh báo về tiền',
        cards: [
          ['Four of Pentacles', 'Giữ tiền quá chặt — an toàn nhưng nghẹt: tiền không sinh sôi khi bị ôm cứng.'],
          ['Five of Pentacles', 'Giai đoạn túng thiếu hoặc cảm giác thiếu thốn — tạm thời, và luôn có lối ra.'],
          ['Seven of Pentacles', 'Đầu tư chưa thấy quả — kiên nhẫn đánh giá lại, đừng nhổ cây non lên xem rễ.'],
          ['The Devil', 'Nợ nần, cờ bạc, ham muốn vật chất trói buộc — cần cắt xiềng trước khi nói chuyện làm giàu.'],
          ['Wheel of Fortune', 'May rủi đang xoay — tài chính biến động, tránh all-in vào một cửa.'],
        ],
      },
    ],
    related: [
      { href: '/thuvien/ace-of-pentacles', icon: 'ti-article', label: 'Ace of Pentacles — cơ hội tài chính mới' },
      { href: '/thuvien/gieo-que-tai-loc', icon: 'ti-article', label: 'Gieo quẻ hỏi chuyện tài lộc' },
      { href: '/sim/', icon: 'ti-device-mobile', label: 'Chấm điểm sim phong thủy hợp mệnh' },
    ],
    faq: [
      { q: 'Bộ nào trong Tarot nói về tiền bạc?', a: 'Bộ Tiền (Pentacles/Coins) — 14 lá thuộc nguyên tố Đất — chủ về tài chính, vật chất, công việc tay nghề và sức khỏe thể chất. Ace, Nine, Ten of Pentacles là ba lá thịnh vượng tiêu biểu nhất.' },
      { q: 'Tarot có đoán được trúng số hay giá cổ phiếu không?', a: 'Không. Tarot phản ánh năng lượng và xu hướng hành vi của bạn với tiền — giúp bạn nhìn rõ mình đang giữ quá chặt, liều quá tay hay đang gieo đúng hạt. Quyết định tài chính luôn cần dữ liệu thực tế.' },
    ],
  },
  {
    slug: 'chu-de-suc-khoe',
    title: 'Tarot Sức Khỏe Tinh Thần: Những Lá Bài Về Chữa Lành',
    h1: 'Tarot Sức Khỏe — Những Lá Bài Về Nghỉ Ngơi Và Chữa Lành',
    desc: 'Những lá bài Tarot về sức khỏe tinh thần: lá nhắc nghỉ ngơi, lá báo hiệu hồi phục và chữa lành — cùng cách đọc chủ đề sức khỏe một cách lành mạnh.',
    intro: 'Tarot không thay được bác sĩ — nhưng với sức khỏe <em>tinh thần</em>, những lá bài dưới đây là lời nhắc đúng lúc về nghỉ ngơi, hồi phục và tự chăm sóc. Nếu trải bài của bạn hay ra những lá này, cơ thể đang muốn nói điều gì đó.',
    sections: [
      {
        h2: 'Những lá bài chữa lành',
        cards: [
          ['The Star', 'Lá bài chữa lành đẹp nhất bộ Tarot — hy vọng quay lại sau giông bão, vết thương đang liền.'],
          ['Temperance', 'Điều độ và cân bằng — liều thuốc là nhịp sống chừng mực, không phải cực đoan.'],
          ['Strength', 'Sức mạnh mềm — kiên nhẫn với chính mình, thuần phục lo âu thay vì đánh nhau với nó.'],
          ['Four of Swords', 'Lá bài "được phép nghỉ" — tạm rút lui, ngủ đủ, tĩnh dưỡng trước trận kế tiếp.'],
          ['The Sun', 'Năng lượng sống quay trở lại — giai đoạn hồi phục rõ rệt, cả thân lẫn tâm.'],
        ],
      },
      {
        h2: 'Những lá bài nhắc bạn chậm lại',
        cards: [
          ['Nine of Swords', 'Đêm mất ngủ vì lo âu — nỗi sợ trong đầu thường lớn hơn thực tế ngoài kia.'],
          ['Ten of Wands', 'Gánh quá nặng quá lâu — kiệt sức không phải huy chương, hãy đặt bớt xuống.'],
          ['Four of Cups', 'Chán chường, mất hứng thú — dấu hiệu tâm trí cần được đổi gió và kết nối lại.'],
          ['The Hermit', 'Cần thời gian một mình đúng nghĩa — rút lui để sạc lại, nhưng đừng tự cô lập quá lâu.'],
        ],
      },
    ],
    related: [
      { href: '/thuvien/la-bai-the-star', icon: 'ti-article', label: 'The Star — hy vọng & chữa lành' },
      { href: '/thuvien/phong-thuy-phong-ngu', icon: 'ti-article', label: 'Phong thủy phòng ngủ cho giấc ngủ ngon' },
      { href: '/ngay-tot/', icon: 'ti-calendar-star', label: 'Chọn ngày lành khởi đầu thói quen mới' },
    ],
    faq: [
      { q: 'Tarot có xem được bệnh tật không?', a: 'Không — mọi vấn đề sức khỏe thể chất cần được bác sĩ chẩn đoán. Tarot chỉ hữu ích như tấm gương cho sức khỏe tinh thần: nhắc bạn nghỉ ngơi, nhận diện lo âu và kiệt sức sớm hơn.' },
      { q: 'Lá bài nào là lá chữa lành trong Tarot?', a: 'The Star là biểu tượng chữa lành kinh điển nhất — hy vọng sau đổ vỡ. Temperance (điều độ), Strength (sức mạnh mềm) và Four of Swords (nghỉ ngơi) cùng nhóm năng lượng hồi phục này.' },
    ],
  },
  {
    slug: 'la-bai-dang-so-nhat',
    title: 'Những Lá Bài Tarot "Đáng Sợ" Nhất — Và Vì Sao Không Đáng Sợ',
    h1: 'Những Lá Bài Tarot "Đáng Sợ" Nhất',
    desc: 'Death, The Tower, The Devil... — giải mã 6 lá bài Tarot bị sợ nhất: ý nghĩa thật của chúng và vì sao rút được chưa chắc là điềm xấu.',
    intro: 'Rút được Death hay The Tower, nhiều người tái mặt. Nhưng trong Tarot, những lá "đáng sợ" nhất lại thường mang thông điệp cần thiết nhất — về kết thúc, sự thật và giải phóng. Đây là 6 lá bị hiểu lầm nhiều nhất, xếp theo độ "gây hoảng".',
    sections: [
      {
        h2: 'Xếp hạng 6 lá bài gây hoảng nhất',
        cards: [
          ['Death', 'Không phải cái chết thể xác — là kết thúc một chương để chương mới bắt đầu. Lá bài của sự chuyển hóa mạnh nhất bộ Tarot.'],
          ['The Tower', 'Sụp đổ đột ngột của thứ xây trên nền móng sai — đau, nhưng dọn chỗ cho cái bền vững hơn.'],
          ['The Devil', 'Xiềng xích tự nguyện: nghiện, lệ thuộc, ràng buộc độc hại. Nhìn kỹ: xiềng trên cổ tay đủ rộng để tự tháo.'],
          ['Ten of Swords', 'Chạm đáy — nhưng là đáy có thật, nghĩa là từ đây chỉ còn đường đi lên. Bình minh đã ở đường chân trời của lá bài.'],
          ['Three of Swords', 'Trái tim bị ba lưỡi kiếm xuyên — nỗi đau được gọi đúng tên, và gọi đúng tên là bước đầu của lành lại.'],
          ['Nine of Swords', 'Cơn ác mộng lúc 3 giờ sáng — lá bài của lo âu. Điều nó nhắc: nỗi sợ trong đầu đang lớn hơn sự thật.'],
        ],
      },
    ],
    related: [
      { href: '/thuvien/la-bai-death-tarot', icon: 'ti-article', label: 'Death — kết thúc & tái sinh' },
      { href: '/thuvien/la-bai-the-tower', icon: 'ti-article', label: 'The Tower — sụp đổ để xây lại' },
      { href: '/la-bai-tarot/la-bai-tot-nhat', icon: 'ti-sparkles', label: 'Ngược lại: những lá bài tốt nhất bộ Tarot' },
    ],
    faq: [
      { q: 'Rút được lá Death có phải điềm chết chóc không?', a: 'Không. Death trong Tarot gần như không bao giờ nói về cái chết thể xác — nó nói về sự kết thúc của một giai đoạn, mối quan hệ hay phiên bản cũ của bạn, để chuyển hóa sang chương mới.' },
      { q: 'Lá bài nào xấu nhất trong Tarot?', a: 'Không có lá "xấu nhất" tuyệt đối — The Tower và Ten of Swords thường bị xem nặng nề nhất, nhưng cả hai đều mang nghĩa giải phóng: sụp đổ cái sai và chạm đáy để đi lên. Ngữ cảnh câu hỏi quyết định tất cả.' },
    ],
  },
  {
    slug: 'la-bai-tot-nhat',
    title: 'Những Lá Bài Tốt Nhất Trong Tarot — Top Lá Bài Ai Cũng Muốn Rút',
    h1: 'Những Lá Bài Tốt Nhất Trong Bộ Tarot',
    desc: 'The Sun, The World, Ten of Cups... — top những lá bài Tarot đẹp nhất, ý nghĩa của chúng trong tình yêu, công việc và vì sao rút được là tín hiệu vàng.',
    intro: 'Nếu có "bảng vàng" của 78 lá Tarot thì đây: những lá mà người trải bài nào cũng mỉm cười khi lật lên. Mỗi lá dưới đây là một kiểu "tốt" khác nhau — viên mãn, may mắn, khởi đầu hay hồi sinh.',
    sections: [
      {
        h2: 'Bảng vàng những lá bài đẹp nhất',
        cards: [
          ['The Sun', 'Lá bài tích cực nhất bộ Tarot — thành công, niềm vui, sự rõ ràng; gần như không có nghĩa xấu.'],
          ['The World', 'Vòng tròn khép lại viên mãn — hoàn thành mục tiêu lớn, đạt thành tựu trọn vẹn.'],
          ['Ten of Cups', 'Hạnh phúc "cầu vồng trên mái nhà" — gia đình êm ấm, tình cảm đủ đầy.'],
          ['Ace of Cups', 'Chén cảm xúc tràn đầy — tình yêu mới, sáng tạo mới, lòng biết ơn mới.'],
          ['The Star', 'Hy vọng và chữa lành — sau mọi Tower đổ nát, Star là ánh sáng dẫn đường.'],
          ['Wheel of Fortune', 'Vận may đang quay đến lượt bạn — bước ngoặt tích cực, thời điểm vàng.'],
          ['Nine of Cups', 'Lá bài "điều ước thành sự thật" — mãn nguyện, được toại nguyện điều đang mong.'],
        ],
      },
    ],
    related: [
      { href: '/thuvien/la-bai-the-sun', icon: 'ti-article', label: 'The Sun — thành công & niềm vui' },
      { href: '/thuvien/la-bai-the-star', icon: 'ti-article', label: 'The Star — hy vọng & chữa lành' },
      { href: '/la-bai-tarot/la-bai-dang-so-nhat', icon: 'ti-ghost', label: 'Ngược lại: những lá bài "đáng sợ" nhất' },
    ],
    faq: [
      { q: 'Lá bài nào tốt nhất trong Tarot?', a: 'The Sun được xem là lá tích cực nhất bộ Tarot — thành công, niềm vui và sự rõ ràng, gần như không có nghĩa tiêu cực kể cả khi ngược. The World và Ten of Cups xếp ngay sau về độ viên mãn.' },
      { q: 'Rút được lá tốt là chắc chắn mọi việc thuận lợi?', a: 'Lá tốt báo hiệu năng lượng thuận và cơ hội — nhưng Tarot mô tả xu hướng, không phải cam kết. Wheel of Fortune quay đến lượt bạn, còn nắm được hay không vẫn do hành động của bạn.' },
    ],
  },
];

// ============================================================
const HEAD = (title, desc, url, jsonLd) => `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)} | latbai.vn</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://latbai.vn/images/og-tarot.png">
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
        <a href="/tarot/">Bói Tarot</a> ·
        <a href="/la-bai-tarot/">78 Lá Bài</a> ·
        <a href="/thuvien/">Thư Viện</a>
      </nav>
      <p>&copy; 2026 latbai.vn · <a href="/gioi-thieu">Giới thiệu</a> · <a href="/chinh-sach-bao-mat">Bảo mật</a> · <a href="/lien-he">Liên hệ</a></p>
    </div>
  </footer>

  <script src="/js/shell.js" defer></script>
</body>
</html>
`;

function buildTopicPage(t) {
  const url = `https://latbai.vn/la-bai-tarot/${t.slug}`;
  const allCards = t.sections.flatMap((s) => s.cards);

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: t.h1, description: t.desc,
      image: 'https://latbai.vn/images/og-tarot.png',
      author: { '@type': 'Organization', name: 'Hội đồng Tarot latbai.vn' },
      publisher: { '@type': 'Organization', name: 'latbai.vn', logo: { '@type': 'ImageObject', url: 'https://latbai.vn/images/icon.svg' } },
      mainEntityOfPage: url },
    { '@type': 'ItemList', name: t.h1,
      itemListElement: allCards.map(([name], i) => ({
        '@type': 'ListItem', position: i + 1, name: `${card(name).name} (${card(name).vn})`,
        url: `https://latbai.vn${cardUrl(name)}`,
      })) },
    { '@type': 'FAQPage', mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { '@type': 'ListItem', position: 2, name: '78 Lá Bài Tarot', item: 'https://latbai.vn/la-bai-tarot/' },
      { '@type': 'ListItem', position: 3, name: t.h1 },
    ] },
  ] };

  return HEAD(t.title, t.desc, url, jsonLd) + `
  <main class="article-container">

    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/"><i class="ti ti-home"></i> Trang Chủ</a>
      <i class="ti ti-chevron-right"></i>
      <a href="/la-bai-tarot/">78 Lá Bài Tarot</a>
      <i class="ti ti-chevron-right"></i>
      <span>${esc(t.h1)}</span>
    </nav>

    <article class="article-header">
      <h1 class="article-h1">${esc(t.h1)}</h1>
      <p style="color: var(--muted); font-size: 14px;">Chuyên mục: <strong>Tarot</strong> · Biên soạn: <strong>Hội đồng Tarot latbai.vn</strong></p>
    </article>

    <div class="article-body">
      <p>${t.intro}</p>

${t.sections.map((s) => `      <h2 class="tarot">${esc(s.h2)}</h2>
${s.cards.map(([name, note]) => {
    const c = card(name);
    return `      <h3><a href="${cardUrl(name)}">${esc(c.name)} — ${esc(c.vn)}</a></h3>
      <p><em>${c.keywords.map(esc).join(' · ')}.</em> ${esc(note)} <a href="${cardUrl(name)}">Xem ý nghĩa đầy đủ (xuôi &amp; ngược) →</a></p>`;
  }).join('\n')}`).join('\n\n')}

      <a href="/tarot/" class="article-cta tarot">
        <i class="ti ti-wand"></i> Rút bài Tarot online với câu hỏi của riêng bạn — AI luận giải miễn phí
      </a>

      <div class="faq-section">
        <h3 class="faq-title">Câu hỏi thường gặp (FAQ)</h3>
        <div class="faq-list">
${t.faq.map((f) => `          <details class="faq-item">
            <summary class="faq-question">${esc(f.q)}</summary>
            <p class="faq-answer">${esc(f.a)}</p>
          </details>`).join('\n')}
        </div>
      </div>

      <div class="author-box">
        <p><strong>Thông tin kiểm duyệt:</strong> Nội dung biên soạn theo hệ thống Rider–Waite bởi <strong>Hội đồng Tarot latbai.vn</strong> — mang tính tham khảo &amp; chiêm nghiệm.</p>
      </div>
    </div>

    <div class="related-articles">
      <h3 class="related-title">Bài viết liên quan</h3>
      <div class="related-list">
${t.related.map((r) => `        <a href="${r.href}" class="related-item"><i class="ti ${r.icon}"></i> ${esc(r.label)}</a>`).join('\n')}
        <a href="/la-bai-tarot/" class="related-item"><i class="ti ti-cards"></i> Tra cứu đầy đủ 78 lá bài Tarot</a>
      </div>
    </div>

  </main>

` + FOOTER;
}

// ---- Generate ----
const urls = [];
for (const t of TOPICS) {
  fs.writeFileSync(path.join(OUT, `${t.slug}.html`), buildTopicPage(t), 'utf8');
  urls.push(`https://latbai.vn/la-bai-tarot/${t.slug}`);
}
console.log(`Generated ${urls.length} topic pages in /la-bai-tarot/`);

// ---- Sitemap block ----
const block = [
  '  <!-- tarot-topics:start (generated by scripts/build-tarot-topic-pages.mjs) -->',
  ...urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`),
  '  <!-- tarot-topics:end -->',
].join('\n');

let sitemap = fs.readFileSync(SITEMAP, 'utf8');
if (sitemap.includes('<!-- tarot-topics:start')) {
  sitemap = sitemap.replace(/ {2}<!-- tarot-topics:start[\s\S]*?<!-- tarot-topics:end -->/, block);
} else {
  sitemap = sitemap.replace('</urlset>', `${block}\n</urlset>`);
}
fs.writeFileSync(SITEMAP, sitemap, 'utf8');
console.log('Sitemap updated.');
