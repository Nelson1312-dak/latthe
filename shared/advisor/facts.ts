// Gói dữ kiện cho Huấn luyện viên.
//
// Đây là TẤT CẢ những gì mô hình ngôn ngữ được biết. Nó không được thêm nước đi,
// ô cờ hay con số nào ngoài gói này — bộ kiểm duyệt sẽ chặn nếu nó cố.

import type { Motif } from './motifs.ts';
import type { MoveClass, Score } from '../winrate.ts';

export interface Facts {
  /** "Trắng" hoặc "Đen". */
  ben: string;
  /** Nước đã đi, dạng SAN kèm số nước, ví dụ "11.Qg4". */
  nuocDaDi: string;
  /** Xếp loại bằng tiếng Việt. */
  xepLoai: string;
  /** Các nước engine thấy tốt hơn, dạng SAN. */
  nuocTotHon: string[];
  /** Dòng nước đi engine dự tính, dạng SAN. */
  dongChinh: string[];
  /** Kiểu lỗi đã nhận ra. */
  the: Motif[];
  /** Chênh lệch vật chất trước và sau, theo góc nhìn bên đi. */
  vatChat?: { truoc: number; sau: number };
  /**
   * Nhận định đã kiểm chứng, tính bằng luật cờ. Mô hình chỉ được diễn đạt lại
   * câu này chứ không được tự phân tích.
   */
  suThat?: string;
}

/** Tên quân mà lời bình được phép nhắc tới. */
export function allowedPieces(f: Facts): Set<string> {
  const out = new Set<string>();
  const LETTER: Record<string, string> = { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã' };
  const addSan = (san: string) => {
    const bare = san.replace(/^\d+\.{1,3}\s*/, '');
    out.add(LETTER[bare[0]] ?? 'Tốt');
  };
  addSan(f.nuocDaDi);
  f.nuocTotHon.forEach(addSan);
  f.dongChinh.forEach(addSan);
  for (const m of f.the) {
    if (m.piece) out.add(m.piece);
    if (m.san) addSan(m.san);
    // Đòn đôi thì nhắc tới Vua là hợp lý
    if (m.kind === 'fork' || m.kind === 'backRank' || m.kind === 'missedMate' || m.kind === 'hangsMate') out.add('Vua');
  }
  return out;
}

/** Mọi nước đi được phép nhắc tới trong lời bình. */
export function allowedMoves(f: Facts): Set<string> {
  const out = new Set<string>();
  const add = (san: string) => {
    if (!san) return;
    out.add(san);
    // Bỏ số nước ở đầu: "11.Qg4" -> "Qg4"
    const bare = san.replace(/^\d+\.{1,3}\s*/, '');
    if (bare) out.add(bare);
  };
  add(f.nuocDaDi);
  f.nuocTotHon.forEach(add);
  f.dongChinh.forEach(add);
  f.the.forEach((m) => m.san && add(m.san));
  return out;
}

/** Mọi ô cờ được phép nhắc tới. */
export function allowedSquares(f: Facts): Set<string> {
  const out = new Set<string>();
  // Không dùng ranh giới từ ở đây: trong "Qg4" thì g4 dính liền chữ Q,
  // mà đó vẫn là ô cờ mà lời bình được phép nhắc tới.
  const addFrom = (text: string) => {
    for (const m of text.matchAll(/([a-h][1-8])/g)) out.add(m[1]);
  };
  addFrom(f.nuocDaDi);
  f.nuocTotHon.forEach(addFrom);
  f.dongChinh.forEach(addFrom);
  for (const m of f.the) {
    if (m.square) out.add(m.square);
    m.targets?.forEach((t) => out.add(t));
    if (m.san) addFrom(m.san);
  }
  return out;
}

export const CLASS_VI: Record<MoveClass, string> = {
  book: 'Sách',
  best: 'Tốt nhất',
  good: 'Tốt',
  inaccuracy: 'Thiếu chính xác',
  mistake: 'Sai',
  blunder: 'Sai nghiêm trọng',
  miss: 'Bỏ lỡ',
};

export interface BuildFactsInput {
  side: 'w' | 'b';
  ply: number;
  san: string;
  cls: MoveClass;
  best: { san: string; score: Score }[];
  pv: string[];
  motifs: Motif[];
  material?: { truoc: number; sau: number };
}

export function buildFacts(i: BuildFactsInput): Facts {
  const moveNo = Math.ceil(i.ply / 2);
  return {
    ben: i.side === 'w' ? 'Trắng' : 'Đen',
    nuocDaDi: `${moveNo}.${i.side === 'b' ? '..' : ''}${i.san}`,
    xepLoai: CLASS_VI[i.cls],
    // Nước mình vừa đi không tính là "tốt hơn"
    nuocTotHon: i.best.filter((b) => b.san && b.san !== i.san).map((b) => b.san).slice(0, 2),
    dongChinh: i.pv.slice(0, 6),
    the: i.motifs,
    vatChat: i.material,
  };
}
