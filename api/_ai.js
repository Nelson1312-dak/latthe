/**
 * api/_ai.js — prompt cho AI local (Qwen qua Ollama) và kiểm tra số liệu trong câu trả lời. Hàm thuần.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Nguyên tắc: AI chỉ diễn giải số liệu hệ thống đã tính sẵn, viết cho MÔI GIỚI đọc. Không tự đưa khuyến nghị mua/bán
 * cho khách, không hứa lợi nhuận. Mọi con số % AI viết ra được đối chiếu lại với dữ kiện đầu vào.
 */

export const KINDS = ['portfolio_review', 'rebalance_note', 'advice_draft', 'client_note', 'symbol_brief'];
/** Việc soạn nội dung cho khách đọc (sau khi môi giới sửa) dùng giọng khác việc viết cho môi giới. */
const FOR_CLIENT = new Set(['advice_draft', 'client_note', 'symbol_brief']);

const RULES = `Quy tắc bắt buộc:
- Chỉ dùng số liệu có trong DỮ KIỆN. Không tự thêm giá, tin tức, sự kiện hay số liệu nào khác. Thiếu dữ liệu thì nói là thiếu.
- Viết tiếng Việt, ngắn gọn, giọng chuyên nghiệp, dành cho môi giới đọc (không phải gửi thẳng cho khách).
- Không hứa hẹn lợi nhuận, không dự báo giá. Không viết "chắc chắn", "đảm bảo".
- Hiệu suất "giữ nguyên" là giả định (giữ đúng danh mục hiện tại trong quá khứ), phải nói rõ khi nhắc tới.
- Khi so với VN-Index, chép nguyên văn câu trong trường "so_voi_vnindex" của kỳ đó (không tự tính, không đổi "tốt hơn"/"kém hơn"); nhắc cả kỳ 1M và kỳ dài nhất có (1Y hoặc 6M).
- Độ lệch hiện tại so với danh mục mẫu là "do_lech_lon_nhat_hien_tai"; đừng nhầm với độ lệch sau khi thực hiện đề xuất.
- Số phần trăm viết dạng 12,5%.`;

const TASK = {
  portfolio_review: `Viết nhận xét danh mục, tối đa 220 chữ, đúng 4 mục có tiêu đề:
1. Tình trạng: 2-3 câu về cơ cấu và hiệu suất so với VN-Index (dùng câu so sánh có sẵn).
2. Rủi ro chính: tối đa 3 gạch đầu dòng, ưu tiên các mục trong "canh_bao".
3. So với khẩu vị và danh mục mẫu: độ phù hợp, độ lệch.
4. Gợi ý trao đổi với khách: 2-3 câu hỏi hoặc điểm môi giới nên trao đổi.`,
  rebalance_note: `Viết ghi chú giải thích đề xuất tái phân bổ, tối đa 160 chữ: vì sao cần (độ lệch, rủi ro), các lệnh chính, và lưu ý khi thực hiện (lô lẻ, cổ phiếu chưa về, tiền không đủ nếu có trong "luu_y"). Môi giới sẽ sửa lại trước khi gửi khách.`,
  advice_draft: `Viết luận điểm khuyến nghị cho mã trong DỮ KIỆN, tối đa 130 chữ, đúng 3 đoạn, mỗi đoạn bắt đầu bằng đúng tiêu đề "Luận điểm:", "Kế hoạch:", "Rủi ro:" (không thêm tiêu đề khác):
Luận điểm: nếu có "y_chinh_cua_moi_gioi" thì câu đầu viết lại ý đó thành một câu hoàn chỉnh, rõ nghĩa (giữ nguyên ý, không thêm số). Tiếp theo chép nguyên văn "cau_dan_chung". Nếu có "cau_nguoc_xu_huong" thì chép nguyên văn ở cuối đoạn.
Kế hoạch: chép nguyên văn "cau_ke_hoach" (có thể thêm "Khuyến nghị" + "chieu" ở đầu câu).
Rủi ro: 1-2 câu ngắn: mức biến động của cổ phiếu ("muc_rui_ro_co_phieu") và khả năng giá thủng cắt lỗ; nếu có "luu_y" thì nhắc ngắn.
Chỉ dùng từ ngữ tài chính thông dụng. Không nói về kết quả kinh doanh, tin tức, định giá vì DỮ KIỆN không có.`,
  client_note: `Viết thư ngắn gửi khách về danh mục của khách, tối đa 180 chữ, xưng "em", gọi khách là "anh/chị", lời lẽ dễ hiểu (không dùng từ chuyên môn như beta, độ lệch chuẩn):
- Câu 1: chép nguyên văn "cau_so_sanh_vnindex" (nếu có).
- Câu 2: mã hoặc ngành chiếm tỷ trọng lớn nhất.
- Điểm cần lưu ý: tối đa 2 điểm từ "canh_bao".
- Nếu "tai_phan_bo" có lệnh: nói em đề xuất cân đối lại và sẽ gửi phiếu lệnh để anh/chị xem, xác nhận trong ứng dụng. KHÔNG tự viết lệnh mua/bán cụ thể.
- Kết thư: mời anh/chị trao đổi thêm.
Không chào hỏi dài dòng, không hứa lợi nhuận.`,
  symbol_brief: `Ghép các câu có sẵn trong "cau_viet_san" thành bản tóm tắt một mã chứng khoán, đúng 3 đoạn, mỗi đoạn mở đầu bằng đúng tiêu đề "Doanh nghiệp:", "Cơ bản:", "Kỹ thuật:":
Doanh nghiệp: "cau_doanh_nghiep", rồi "cau_gioi_thieu" nếu có.
Cơ bản: "cau_co_ban", "cau_loi_nhuan", "cau_co_tuc", "cau_so_huu" (bỏ câu nào không có).
Kỹ thuật: "cau_ky_thuat". Không có thì ghi "Chưa đủ dữ liệu giá để đánh giá kỹ thuật."
Chỉ được CHÉP NGUYÊN VĂN các câu đó và nối lại; chỉ được thêm liên từ cho trôi chảy.
TUYỆT ĐỐI không thêm câu mới, không mô tả hoạt động kinh doanh nếu không có "cau_gioi_thieu", không thêm hay sửa bất kỳ con số nào, không nhận định mua bán, không dự báo giá.`,
};

export function buildMessages(kind, facts) {
  if (!KINDS.includes(kind)) throw new Error('kind không hợp lệ');
  const forClient = FOR_CLIENT.has(kind);
  const who = forClient
    ? 'Bạn soạn nháp nội dung tư vấn cho môi giới chứng khoán tại Việt Nam. Môi giới sẽ đọc, sửa rồi mới gửi khách.'
    : 'Bạn là trợ lý phân tích danh mục cho môi giới chứng khoán tại Việt Nam.';
  const rules = forClient ? RULES.replace('dành cho môi giới đọc (không phải gửi thẳng cho khách)', 'dành cho khách đọc') : RULES;
  return [
    { role: 'system', content: `${who}\n${rules}` },
    { role: 'user', content: `${TASK[kind]}\n\nDỮ KIỆN (JSON):\n${JSON.stringify(facts)}` },
  ];
}

/** Bỏ phần suy nghĩ <think>…</think> mà một số model Qwen in ra. */
export const stripThinking = (s) => String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<think>[\s\S]*$/i, '').trim();

/**
 * Những từ có nghĩa xuất hiện trong câu trả lời nhưng không có trong dữ kiện. Với việc chỉ ghép câu có sẵn
 * (symbol_brief), từ lạ nghĩa là AI tự thêm nội dung. Bỏ qua từ nối và từ thuộc khuôn mẫu của đề bài.
 */
const BO_QUA = new Set(('và của là có các với trong cho trên dưới theo từ đến khi nếu thì mà hoặc những một này đó ở về như do nên vì ra vào được cùng tại sau trước giữa cả còn đã sẽ cũng rất hơn nhất bị bởi qua đang qua doanh nghiệp cơ bản kỹ thuật chưa đủ dữ liệu giá để đánh đang hiện nay hoạt động lĩnh vực công ty tập đoàn ngân hàng chứng khoán').split(' '));
export function novelWords(text, facts) {
  const norm = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const known = new Set(norm(JSON.stringify(facts)));
  const out = [];
  for (const w of norm(text)) {
    if (w.length < 3 || known.has(w) || BO_QUA.has(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

/** Mọi số trong dữ kiện (đệ quy). */
function factNumbers(v, out = []) {
  if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => factNumbers(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => factNumbers(x, out));
  else if (typeof v === 'string') for (const m of v.matchAll(/-?\d+(?:[.,]\d+)?/g)) out.push(parseFloat(m[0].replace(',', '.')));
  return out;
}

/**
 * Tìm các số phần trăm trong câu trả lời không khớp số nào trong dữ kiện (lệch quá 0,15 điểm, tính cả trị tuyệt đối
 * vì AI hay viết "giảm 5,2%" cho số -5,2). Trả danh sách chuỗi để hiện cảnh báo cho môi giới.
 */
export function unknownPercents(text, facts) {
  const known = factNumbers(facts);
  const bad = [];
  for (const m of String(text).matchAll(/(-?\d{1,3}(?:[.,]\d{1,2})?)\s?%/g)) {
    const v = parseFloat(m[1].replace(',', '.'));
    const ok = known.some((k) => Math.abs(Math.abs(k) - Math.abs(v)) <= 0.15);
    if (!ok && !bad.includes(m[0])) bad.push(m[0]);
  }
  return bad;
}
