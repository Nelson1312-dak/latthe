// "Ba điều rút ra từ ván này": Huấn luyện viên (mô hình ngôn ngữ) VIẾT LẠI các
// nhận định đã tính sẵn từ engine cho tự nhiên hơn — không được thêm sự thật nào.
//
// Kiểm chặt: mọi ô cờ (e4, f6…) và mọi con số trong câu viết lại phải có sẵn
// trong câu gốc tương ứng. Sai một chỗ là bỏ cả bản viết lại, dùng câu gốc.

export const SUMMARY_VERSION = 's3';

export const SUMMARY_PROMPT = `Bạn là huấn luyện viên cờ vua, nói tiếng Việt, đang nhận xét ván vừa xong cho một người mới học.

Bạn nhận một danh sách nhận định ĐÃ ĐƯỢC KIỂM CHỨNG về ván cờ. Với TỪNG nhận định, hãy:
1. Diễn đạt lại bằng lời của bạn, giọng ấm áp như thầy giáo ngồi cạnh (đừng chép nguyên câu).
2. Thêm MỘT lời khuyên chung, ngắn, để lần sau làm tốt hơn — ví dụ thói quen kiểm tra quân bị tấn công,
   tận dụng sai lầm của đối thủ, giữ an toàn cho Vua. Lời khuyên KHÔNG được nhắc nước đi, ô cờ hay con số nào.

Quy tắc bắt buộc:
- Giữ đúng thứ tự và đúng số lượng nhận định; mỗi mục tối đa hai câu.
- Mọi nước đi, ô cờ, số thứ tự nước và phần trăm phải giữ đúng như nhận định. Không thêm cái nào khác.
- Không thêm sự kiện mới về ván cờ, không nhắc tên engine.
- Không đoán điều gì SẼ xảy ra nếu đi khác (không viết kiểu "thì sẽ thắng", "sẽ không thua", "sẽ cân bằng").
  Chỉ nói lại đúng điều nhận định đã nói.
- Xưng "bạn" với người học.

Trả lời đúng dạng JSON: {"y": ["...", "..."]}`;

export function summaryUserPrompt(items: string[]): string {
  return `Các nhận định:\n${items.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
}

const ô = (s: string) => new Set(s.match(/\b[a-h][1-8]\b/g) ?? []);
const số = (s: string) => new Set(s.match(/\d+/g) ?? []);

/**
 * Kiểm bản viết lại. Trả về danh sách câu dùng được, hoặc null nếu phải bỏ.
 */
export function validateSummary(orig: string[], out: unknown): string[] | null {
  if (!Array.isArray(out) || out.length !== orig.length) return null;
  const kq: string[] = [];
  for (let i = 0; i < orig.length; i++) {
    const t = out[i];
    if (typeof t !== 'string') return null;
    const s = t.replace(/\s+/g, ' ').trim();
    if (s.length < 8 || s.length > 320) return null;
    const ôGốc = ô(orig[i]);
    for (const x of ô(s)) if (!ôGốc.has(x)) return null;
    const sốGốc = số(orig[i]);
    for (const x of số(s)) if (!sốGốc.has(x)) return null;
    // Đoán kết cục ("sẽ thắng", "sẽ không thua"...) là thêm sự thật engine không nói
    if (/sẽ\s+(không\s+)?(thắng|thua|hòa|hoà)/i.test(s)) return null;
    kq.push(s);
  }
  return kq;
}
