// Kiểm duyệt lời bình do mô hình ngôn ngữ viết.
//
// Mô hình 8B KHÔNG biết đánh cờ. Nếu để nó tự do, nó sẽ nói những câu nghe rất
// trôi chảy nhưng sai hoàn toàn: nhắc nước không tồn tại, ô không liên quan, con
// số tự nghĩ ra. Người mới học không có cách nào biết là sai — đó mới là nguy
// hiểm. Nên lời bình nào không qua được đây thì bỏ, dùng câu mẫu.

import { allowedMoves, allowedPieces, allowedSquares, type Facts } from './facts.ts';

export interface Verdict {
  ok: boolean;
  /** Lý do từ chối, để ghi log và đo chất lượng. */
  reason?: string;
}

export const MAX_LENGTH = 400;
export const MIN_LENGTH = 15;

/** Ký hiệu nước đi trong câu, ví dụ Nf3, exd5, O-O, Qxf7+, e8=Q. */
const SAN_PATTERN = /\b(O-O-O|O-O|(?:[KQRBN][a-h1-8]?x?[a-h][1-8]|[a-h]x?[a-h][1-8]|[a-h][1-8])(?:=[QRBN])?[+#]?)\b/g;
const SQUARE_PATTERN = /\b([a-h][1-8])\b/g;
/** Con số có vẻ là điểm số hoặc phần trăm. */
const NUMBER_PATTERN = /(?<![a-h])[-+−]?\d+[.,]\d+|\b\d+\s*%/g;

/** Số nước, ví dụ "11." hoặc "6...". */
const MOVE_NUMBER_PATTERN = /\b(\d+)\.{1,3}(?!\d)/g;
const PIECE_WORDS = ['Vua', 'Hậu', 'Xe', 'Tượng', 'Mã', 'Tốt'];

/** Vài từ cho thấy mô hình đang bịa ra chuyện ngoài phạm vi. */
const BANNED_PHRASES =[/theo (lý thuyết|sách) .{0,20}(Elo|rating)/i, /\bStockfish\b/i, /tôi (nghĩ|đoán|cho rằng)/i];

export function validateComment(text: string, f: Facts): Verdict {
  const t = text.trim();
  if (t.length < MIN_LENGTH) return { ok: false, reason: 'quá ngắn' };
  if (t.length > MAX_LENGTH) return { ok: false, reason: 'quá dài' };

  // Phải là tiếng Việt: dấu tiếng Việt hoặc ít nhất vài từ Việt thường gặp
  if (!/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(t)) {
    return { ok: false, reason: 'không phải tiếng Việt' };
  }

  // "Rxa8" và "Rxa8+" là cùng một nước; dấu chiếu không làm nên khác biệt
  const bare = (san: string) => san.replace(/[+#]$/, '');
  const moves = new Set([...allowedMoves(f)].map(bare));
  const squares = allowedSquares(f);

  for (const m of t.matchAll(SAN_PATTERN)) {
    const san = m[1];
    // Bỏ qua thứ chỉ là tên ô (đã kiểm riêng ở dưới)
    if (/^[a-h][1-8]$/.test(san)) continue;
    if (!moves.has(bare(san))) return { ok: false, reason: `nhắc nước không có trong dữ kiện: ${san}` };
  }

  for (const m of t.matchAll(SQUARE_PATTERN)) {
    if (!squares.has(m[1])) return { ok: false, reason: `nhắc ô không có trong dữ kiện: ${m[1]}` };
  }

  for (const m of t.matchAll(NUMBER_PATTERN)) {
    return { ok: false, reason: `nêu con số không có trong dữ kiện: ${m[0].trim()}` };
  }

  // Số nước: mô hình hay tự đổi "11.Qg4" thành "6.Qg4"
  const dungSoNuoc = /^(\d+)/.exec(f.nuocDaDi)?.[1];
  for (const m of t.matchAll(MOVE_NUMBER_PATTERN)) {
    if (m[1] !== dungSoNuoc) return { ok: false, reason: `nêu sai số nước: ${m[0]}` };
  }

  // Tên quân: mô hình hay gán sự kiện cho con quân khác
  const pieces = allowedPieces(f);
  for (const word of PIECE_WORDS) {
    if (new RegExp(`\b${word}\b`).test(t) && !pieces.has(word)) {
      return { ok: false, reason: `nhắc quân không có trong dữ kiện: ${word}` };
    }
  }

  for (const re of BANNED_PHRASES) {
    if (re.test(t)) return { ok: false, reason: 'nói chuyện ngoài phạm vi' };
  }

  return { ok: true };
}

/** Đọc câu trả lời JSON của mô hình. Trả về null nếu không đúng dạng. */
export function parseModelReply(raw: string): string | null {
  const text = raw.trim();
  try {
    const obj = JSON.parse(text) as { giaiThich?: unknown };
    if (typeof obj.giaiThich === 'string' && obj.giaiThich.trim()) return obj.giaiThich.trim();
    return null;
  } catch {
    // Mô hình hay kèm chữ thừa quanh JSON; thử vớt phần trong ngoặc
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const obj = JSON.parse(text.slice(start, end + 1)) as { giaiThich?: unknown };
        if (typeof obj.giaiThich === 'string' && obj.giaiThich.trim()) return obj.giaiThich.trim();
      } catch {
        /* chịu */
      }
    }
    return null;
  }
}
