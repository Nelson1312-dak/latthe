// Nhận diện kiểu lỗi trong một nước đi.
//
// Đây là phần QUAN TRỌNG NHẤT của Huấn luyện viên: nó tính bằng luật cờ, kiểm
// thử được, và là nguồn sự thật duy nhất cho lời bình. Mô hình ngôn ngữ chỉ được
// diễn đạt lại những gì ở đây, không được tự nghĩ ra.

import { Chess } from 'chess.js';
import type { Square } from '../fen.ts';

export type MotifKind =
  | 'hanging' // để hở quân
  | 'missedCapture' // bỏ lỡ nước ăn quân không được bảo vệ
  | 'missedMate' // bỏ lỡ chiếu hết
  | 'fork' // bị đòn đôi
  | 'backRank' // yếu hàng cuối
  | 'badTrade' // đổi quân thiệt
  | 'hangsMate'; // nước đi để đối thủ chiếu hết

export interface Motif {
  kind: MotifKind;
  /** Ô liên quan chính (quân bị hở, ô đòn đôi…). */
  square?: Square;
  /** Tên quân tiếng Việt, ví dụ "Mã". */
  piece?: string;
  /** Ô bị tấn công, dùng cho đòn đôi. */
  targets?: Square[];
  /** Nước đi liên quan, dạng SAN. */
  san?: string;
}

export const PIECE_NAME: Record<string, string> = {
  k: 'Vua',
  q: 'Hậu',
  r: 'Xe',
  b: 'Tượng',
  n: 'Mã',
  p: 'Tốt',
};

const VALUE: Record<string, number> = { k: 100, q: 9, r: 5, b: 3, n: 3, p: 1 };

type Side = 'w' | 'b';
const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');

/**
 * Quân của `side` đang bị bỏ hở: bị tấn công mà không được bảo vệ, hoặc bị một
 * quân rẻ hơn tấn công. Bỏ qua Vua (bị chiếu là chuyện khác).
 */
export function hangingPieces(fen: string, side: Side): { square: Square; piece: string; value: number }[] {
  const board = new Chess(fen);
  const out: { square: Square; piece: string; value: number }[] = [];
  for (const row of board.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== side || cell.type === 'k') continue;
      const sq = cell.square as Square;
      const attackers = board.attackers(sq, other(side));
      if (!attackers.length) continue;
      const defenders = board.attackers(sq, side);
      const value = VALUE[cell.type];
      // Không ai đỡ, hoặc kẻ tấn công rẻ hơn quân bị tấn công
      const cheapestAttacker = Math.min(...attackers.map((a) => VALUE[board.get(a as Square)!.type]));
      if (!defenders.length || cheapestAttacker < value) {
        out.push({ square: sq, piece: PIECE_NAME[cell.type], value });
      }
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Nước ăn quân "không mất gì" mà bên đi đã bỏ qua. */
export function missedCaptures(fen: string, minValue = 3): { san: string; square: Square; piece: string }[] {
  const board = new Chess(fen);
  const side = board.turn() as Side;
  const out: { san: string; square: Square; piece: string }[] = [];
  for (const m of board.moves({ verbose: true })) {
    if (!m.captured) continue;
    if (VALUE[m.captured] < minValue) continue;
    // Ăn xong mà ô đó không bị ăn lại thì đúng là quân cho không
    const after = new Chess(fen);
    after.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (after.attackers(m.to as Square, other(side)).length) continue;
    out.push({ san: m.san, square: m.to as Square, piece: PIECE_NAME[m.captured] });
  }
  return out;
}

/**
 * Nước đi của đối thủ tấn công cùng lúc từ hai quân giá trị trở lên.
 * `replyUci` là nước engine cho là mạnh nhất sau nước vừa đi.
 */
export function forkAfter(fenAfter: string, replyUci: string): Motif | null {
  if (!replyUci || replyUci.length < 4) return null;
  const board = new Chess(fenAfter);
  const mover = board.turn() as Side;
  let moved;
  try {
    moved = board.move({ from: replyUci.slice(0, 2), to: replyUci.slice(2, 4), promotion: replyUci[4] });
  } catch {
    return null;
  }
  const to = moved.to as Square;
  const victim = other(mover);
  const targets: Square[] = [];
  for (const row of board.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== victim) continue;
      if (VALUE[cell.type] < 3 && cell.type !== 'k') continue;
      // Quân vừa đi có nhắm vào ô này không
      if (board.attackers(cell.square as Square, mover).includes(to)) targets.push(cell.square as Square);
    }
  }
  if (targets.length < 2) return null;
  return { kind: 'fork', square: to, piece: PIECE_NAME[moved.piece], targets, san: moved.san };
}

/** Vua của `side` kẹt ở hàng cuối: không có ô nào để thoát khi bị chiếu ngang. */
export function backRankWeak(fen: string, side: Side): Motif | null {
  const board = new Chess(fen);
  let kingSq: Square | null = null;
  for (const row of board.board()) {
    for (const cell of row) {
      if (cell?.type === 'k' && cell.color === side) kingSq = cell.square as Square;
    }
  }
  if (!kingSq) return null;
  const rank = Number(kingSq[1]);
  if (rank !== (side === 'w' ? 1 : 8)) return null;

  // Ô thoát phía trước có bị quân nhà chắn hết không
  const file = kingSq[0];
  const forward = side === 'w' ? 2 : 7;
  const files = 'abcdefgh';
  const i = files.indexOf(file);
  const escapes = [i - 1, i, i + 1]
    .filter((x) => x >= 0 && x < 8)
    .map((x) => `${files[x]}${forward}` as Square)
    .filter((sq) => {
      const p = board.get(sq);
      return !p || p.color !== side;
    });
  if (escapes.length) return null;

  // Đối phương có Xe hoặc Hậu không — không có thì không thành chuyện
  const heavy = board
    .board()
    .flat()
    .some((c) => c && c.color === other(side) && (c.type === 'r' || c.type === 'q'));
  if (!heavy) return null;
  return { kind: 'backRank', square: kingSq, piece: 'Vua' };
}

export interface MoveContext {
  fenBefore: string;
  fenAfter: string;
  /** Nước vừa đi, dạng SAN. */
  san: string;
  side: Side;
  /** Nước engine cho là mạnh nhất của ĐỐI THỦ sau nước vừa đi. */
  replyUci?: string;
  /** Có chiếu hết trong tầm tay trước nước này không. */
  hadMate?: boolean;
  /** Sau nước này đối thủ có chiếu hết được không. */
  allowsMate?: boolean;
  /** Chênh lệch vật chất trước và sau, theo góc nhìn bên đi. */
  materialBefore?: number;
  materialAfter?: number;
}

/**
 * Tìm các kiểu lỗi của một nước đi, xếp theo mức quan trọng.
 * Trả về mảng rỗng nếu không thấy gì đáng nói — khi đó dùng câu mẫu chung.
 */
export function detectMotifs(ctx: MoveContext): Motif[] {
  const found: Motif[] = [];

  if (ctx.allowsMate) {
    found.push({ kind: 'hangsMate' });
  }

  if (ctx.hadMate && !ctx.allowsMate) {
    found.push({ kind: 'missedMate' });
  }

  // Quân mình bị bỏ hở sau nước đi
  const hanging = hangingPieces(ctx.fenAfter, ctx.side);
  if (hanging.length && hanging[0].value >= 3) {
    found.push({ kind: 'hanging', square: hanging[0].square, piece: hanging[0].piece });
  }

  if (ctx.replyUci) {
    const fork = forkAfter(ctx.fenAfter, ctx.replyUci);
    if (fork) found.push(fork);
  }

  // Trước nước này có nước ăn quân cho không mà bỏ qua
  const missed = missedCaptures(ctx.fenBefore);
  if (missed.length && missed[0].san !== ctx.san) {
    found.push({ kind: 'missedCapture', san: missed[0].san, square: missed[0].square, piece: missed[0].piece });
  }

  const backRank = backRankWeak(ctx.fenAfter, ctx.side);
  if (backRank) found.push(backRank);

  if (
    ctx.materialBefore !== undefined &&
    ctx.materialAfter !== undefined &&
    ctx.materialAfter <= ctx.materialBefore - 2
  ) {
    found.push({ kind: 'badTrade' });
  }

  return found;
}
