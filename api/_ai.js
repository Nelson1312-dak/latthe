/**
 * api/_ai.js — prompt cho AI local (Qwen qua Ollama) và kiểm tra số liệu trong câu trả lời. Hàm thuần.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Nguyên tắc: AI chỉ diễn giải số liệu hệ thống đã tính sẵn, viết cho MÔI GIỚI đọc. Không tự đưa khuyến nghị mua/bán
 * cho khách, không hứa lợi nhuận. Mọi con số % AI viết ra được đối chiếu lại với dữ kiện đầu vào.
 */

export const KINDS = ['portfolio_review', 'rebalance_note'];

const RULES = `Quy tắc bắt buộc:
- Chỉ dùng số liệu có trong DỮ KIỆN. Không tự thêm giá, tin tức, sự kiện hay số liệu nào khác. Thiếu dữ liệu thì nói là thiếu.
- Viết tiếng Việt, ngắn gọn, giọng chuyên nghiệp, dành cho môi giới đọc (không phải gửi thẳng cho khách).
- Không hứa hẹn lợi nhuận, không dự báo giá. Không viết "chắc chắn", "đảm bảo".
- Hiệu suất "giữ nguyên" là giả định (giữ đúng danh mục hiện tại trong quá khứ), phải nói rõ khi nhắc tới.
- Số phần trăm viết dạng 12,5%.`;

const TASK = {
  portfolio_review: `Viết nhận xét danh mục, tối đa 220 chữ, đúng 4 mục có tiêu đề:
1. Tình trạng: 2-3 câu về cơ cấu và hiệu suất so với VN-Index.
2. Rủi ro chính: tối đa 3 gạch đầu dòng, ưu tiên các mục trong "canh_bao".
3. So với khẩu vị và danh mục mẫu: độ phù hợp, độ lệch.
4. Gợi ý trao đổi với khách: 2-3 câu hỏi hoặc điểm môi giới nên trao đổi.`,
  rebalance_note: `Viết ghi chú giải thích đề xuất tái phân bổ, tối đa 160 chữ: vì sao cần (độ lệch, rủi ro), các lệnh chính, và lưu ý khi thực hiện (lô lẻ, cổ phiếu chưa về, tiền không đủ nếu có trong "luu_y"). Môi giới sẽ sửa lại trước khi gửi khách.`,
};

export function buildMessages(kind, facts) {
  if (!KINDS.includes(kind)) throw new Error('kind không hợp lệ');
  return [
    { role: 'system', content: `Bạn là trợ lý phân tích danh mục cho môi giới chứng khoán tại Việt Nam.\n${RULES}` },
    { role: 'user', content: `${TASK[kind]}\n\nDỮ KIỆN (JSON):\n${JSON.stringify(facts)}` },
  ];
}

/** Bỏ phần suy nghĩ <think>…</think> mà một số model Qwen in ra. */
export const stripThinking = (s) => String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<think>[\s\S]*$/i, '').trim();

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
