// Luật cờ, dùng chung cho trình duyệt và server.
//
// Bọc chess.js lại để phần còn lại của app chỉ nói chuyện với một chỗ duy nhất,
// và để lý do kết thúc ván nói bằng tiếng Việt.

import { Chess, type Move } from 'chess.js';
import type { Square } from './fen.ts';

export type { Square };
export type Side = 'w' | 'b';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty-move'
  | 'insufficient'
  | 'resign'
  | 'timeout'
  | 'agreement';

export const END_TEXT: Record<EndReason, string> = {
  checkmate: 'chiếu hết',
  stalemate: 'hết nước đi',
  threefold: '3 lần lặp',
  'fifty-move': 'luật 50 nước',
  insufficient: 'thiếu quân chiếu hết',
  resign: 'đầu hàng',
  timeout: 'hết giờ',
  agreement: 'thỏa thuận',
};

export interface Outcome {
  /** 'w' | 'b' thắng, hoặc 'draw'. */
  winner: Side | 'draw';
  reason: EndReason;
}

export interface PlayedMove {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  promotion?: string;
  /** Có ăn quân không — dùng để chọn tiếng. */
  captured: boolean;
  /** Thế cờ SAU nước đi. */
  fen: string;
  side: Side;
}

function toPlayed(m: Move, fen: string): PlayedMove {
  return {
    san: m.san,
    uci: m.from + m.to + (m.promotion ?? ''),
    from: m.from as Square,
    to: m.to as Square,
    promotion: m.promotion,
    captured: Boolean(m.captured),
    fen,
    side: m.color as Side,
  };
}

/**
 * Một ván cờ đang chơi, có lịch sử xem lại được.
 *
 * `cursor` là vị trí đang XEM (0 = thế cờ đầu, n = sau nước thứ n). Đi quân khi
 * đang xem lại giữa chừng sẽ cắt bỏ phần sau — giống như đánh lại từ thế đó.
 */
export class Game {
  /**
   * Ván đầy đủ từ đầu tới nước mới nhất. Phải giữ nguyên một bản như thế
   * (chứ không dựng lại từ FEN mỗi nước) vì luật lặp ba lần và PGN cần biết
   * cả quá trình, không chỉ thế cờ hiện tại.
   */
  private live: Chess;
  private moves: PlayedMove[] = [];
  private startFen: string;
  private cursor = 0;

  constructor(fen: string = START_FEN) {
    this.startFen = fen;
    this.live = new Chess(fen);
  }

  /** Dựng lại ván đầy đủ từ đầu, dùng khi phải cắt bỏ nước ở cuối. */
  private rebuildLive(): void {
    this.live = new Chess(this.startFen);
    for (const m of this.moves) this.live.move({ from: m.from, to: m.to, promotion: m.promotion });
  }

  /** Thế cờ tại vị trí đang xem. */
  get fen(): string {
    return this.cursor === 0 ? this.startFen : this.moves[this.cursor - 1].fen;
  }

  get turn(): Side {
    return this.fen.split(' ')[1] as Side;
  }

  get ply(): number {
    return this.cursor;
  }

  get length(): number {
    return this.moves.length;
  }

  get history(): readonly PlayedMove[] {
    return this.moves;
  }

  /** Đang xem đúng nước mới nhất (chứ không phải đang tua lại). */
  get atLive(): boolean {
    return this.cursor === this.moves.length;
  }

  get lastMove(): PlayedMove | null {
    return this.cursor > 0 ? this.moves[this.cursor - 1] : null;
  }

  /** Một bản chess.js đặt đúng thế cờ đang xem. */
  private viewed(): Chess {
    return new Chess(this.fen);
  }

  /** Các ô đi được từ `from`, tách riêng nước ăn quân để vẽ khác nhau. */
  legalFrom(from: Square): { quiet: Square[]; captures: Square[] } {
    const quiet: Square[] = [];
    const captures: Square[] = [];
    for (const m of this.viewed().moves({ square: from, verbose: true })) {
      // Bắt tốt qua đường cũng là ăn quân, dù ô đến đang trống
      (m.captured ? captures : quiet).push(m.to as Square);
    }
    return { quiet, captures };
  }

  /** Nước này có phải phong cấp không (để hỏi người chơi chọn quân). */
  needsPromotion(from: Square, to: Square): boolean {
    return this.viewed()
      .moves({ square: from, verbose: true })
      .some((m) => m.to === to && Boolean(m.promotion));
  }

  /** Đi một nước. Trả về null nếu không hợp lệ. */
  move(from: Square, to: Square, promotion?: string): PlayedMove | null {
    // Đi khi đang tua lại thì bỏ phần sau, coi như đánh lại từ thế đó
    if (this.cursor < this.moves.length) {
      this.moves = this.moves.slice(0, this.cursor);
      this.rebuildLive();
    }
    let m: Move;
    try {
      m = this.live.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return null;
    }
    const played = toPlayed(m, this.live.fen());
    this.moves.push(played);
    this.cursor = this.moves.length;
    return played;
  }

  /** Lùi lại một nước đã đi (khác với tua xem: nước bị xoá hẳn). */
  undo(): PlayedMove | null {
    if (!this.moves.length) return null;
    const removed = this.moves.pop()!;
    this.live.undo();
    this.cursor = Math.min(this.cursor, this.moves.length);
    return removed;
  }

  /* ---------------- Xem lại ---------------- */

  goTo(ply: number): void {
    this.cursor = Math.max(0, Math.min(ply, this.moves.length));
  }
  first(): void {
    this.goTo(0);
  }
  prev(): void {
    this.goTo(this.cursor - 1);
  }
  next(): void {
    this.goTo(this.cursor + 1);
  }
  last(): void {
    this.goTo(this.moves.length);
  }

  /* ---------------- Trạng thái ---------------- */

  get inCheck(): boolean {
    return this.viewed().inCheck();
  }

  /** Ô của Vua đang bị chiếu, để tô đỏ. */
  get checkedKing(): Square | null {
    const board = this.viewed();
    if (!board.inCheck()) return null;
    const side = board.turn();
    for (const row of board.board()) {
      for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === side) return sq.square as Square;
      }
    }
    return null;
  }

  /** Ván đã kết thúc chưa, và vì sao. Chỉ xét ở nước mới nhất. */
  outcome(): Outcome | null {
    const board = this.live;
    if (board.isCheckmate()) {
      // Bên phải đi mà bị chiếu hết là bên thua
      return { winner: board.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
    }
    if (board.isStalemate()) return { winner: 'draw', reason: 'stalemate' };
    if (board.isThreefoldRepetition()) return { winner: 'draw', reason: 'threefold' };
    if (board.isInsufficientMaterial()) return { winner: 'draw', reason: 'insufficient' };
    if (board.isDrawByFiftyMoves?.()) return { winner: 'draw', reason: 'fifty-move' };
    return null;
  }

  /* ---------------- Vào ra ---------------- */

  pgn(): string {
    return this.live.pgn();
  }

  static fromPgn(pgn: string): Game {
    const board = new Chess();
    board.loadPgn(pgn);
    const game = new Game();
    for (const m of board.history({ verbose: true })) {
      game.move(m.from as Square, m.to as Square, m.promotion);
    }
    return game;
  }
}

/** Kết quả ván viết thành câu, ví dụ "Trắng thắng · chiếu hết". */
export function outcomeText(o: Outcome): string {
  const who = o.winner === 'draw' ? 'Hòa' : o.winner === 'w' ? 'Trắng thắng' : 'Đen thắng';
  return `${who} · ${END_TEXT[o.reason]}`;
}
