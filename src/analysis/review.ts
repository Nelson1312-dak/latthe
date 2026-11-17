// Chấm cả ván cờ.
//
// Điểm mấu chốt về tốc độ: mỗi THẾ CỜ chỉ phân tích đúng một lần. Điểm sau nước
// thứ i cũng chính là điểm trước nước thứ i+1, nên ván n nước chỉ cần n+1 lần
// phân tích chứ không phải 2n.

import { Game, type Side } from '../../shared/chess.ts';
import { classify, moveAccuracy, winPercent, type MoveClass, type Score } from '../../shared/winrate.ts';
import { openingAt, type Opening } from './openings.ts';

export interface ReviewedMove {
  /** 1 là nước đầu của Trắng. */
  ply: number;
  san: string;
  uci: string;
  side: Side;
  fenBefore: string;
  fenAfter: string;
  /** Điểm theo góc nhìn Trắng. */
  scoreBefore: Score;
  scoreAfter: Score;
  /** Các nước engine thấy tốt nhất ở thế cờ TRƯỚC nước này. */
  best: { uci: string; san: string; score: Score }[];
  cls: MoveClass;
  /** Độ chính xác của riêng nước này, 0..100. */
  accuracy: number;
}

export interface ReviewResult {
  moves: ReviewedMove[];
  accuracy: { w: number; b: number };
  opening: (Opening & { ply: number }) | null;
}

/** Thứ `reviewGame` cần từ engine; tách ra để test không cần chạy Stockfish. */
export interface Analyser {
  analyse(
    fen: string,
    opts: { movetimeMs?: number; multipv?: number },
  ): Promise<{ lines: { uci: string; score: Score }[] }>;
}

export interface ReviewOptions {
  /** Thời gian nghĩ mỗi thế cờ. Càng lâu càng chính xác, càng chậm. */
  movetimeMs?: number;
  multipv?: number;
  /** Báo tiến độ: done/total thế cờ. */
  onProgress?: (done: number, total: number) => void;
  /** Trả về true để dừng giữa chừng. */
  cancelled?: () => boolean;
}

/** Lỗi ném ra khi người dùng dừng việc phân tích. */
export class ReviewCancelled extends Error {
  constructor() {
    super('Đã dừng phân tích');
    this.name = 'ReviewCancelled';
  }
}

export async function reviewGame(pgn: string, engine: Analyser, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const { movetimeMs = 600, multipv = 3, onProgress, cancelled } = opts;

  const game = Game.fromPgn(pgn);
  const history = [...game.history];
  if (!history.length) return { moves: [], accuracy: { w: 100, b: 100 }, opening: null };

  // Thế cờ 0 là trước nước đầu, thế cờ i là sau nước thứ i
  const fens = [Game.fromPgn('').fen, ...history.map((m) => m.fen)];
  const total = fens.length;
  const analyses: { uci: string; score: Score }[][] = [];

  for (let i = 0; i < total; i++) {
    if (cancelled?.()) throw new ReviewCancelled();
    // Thế cờ cuối không cần biết nước tốt nhất, chỉ cần điểm
    const a = await engine.analyse(fens[i], { movetimeMs, multipv: i === total - 1 ? 1 : multipv });
    analyses.push(a.lines);
    onProgress?.(i + 1, total);
  }

  const moves: ReviewedMove[] = history.map((m, i) => {
    const before = analyses[i];
    const after = analyses[i + 1];
    const scoreBefore = before[0]?.score ?? { cp: 0 };
    const scoreAfter = after[0]?.score ?? { cp: 0 };
    const isBest = before[0]?.uci === m.uci;
    // Nước nằm trong sách khai cuộc thì không chấm là hay hay dở
    const isBook = Boolean(openingAt(m.fen));

    const sign = m.side === 'w' ? 1 : -1;
    const winBefore = sign > 0 ? winPercent(scoreBefore) : 100 - winPercent(scoreBefore);
    const winAfter = sign > 0 ? winPercent(scoreAfter) : 100 - winPercent(scoreAfter);

    return {
      ply: i + 1,
      san: m.san,
      uci: m.uci,
      side: m.side,
      fenBefore: fens[i],
      fenAfter: m.fen,
      scoreBefore,
      scoreAfter,
      best: before.slice(0, multipv).map((l) => ({ uci: l.uci, san: sanOf(fens[i], l.uci), score: l.score })),
      cls: classify({ before: scoreBefore, after: scoreAfter, side: m.side, isBest, isBook }),
      accuracy: Math.round(moveAccuracy(winBefore, winAfter) * 10) / 10,
    };
  });

  const avg = (side: Side) => {
    const xs = moves.filter((m) => m.side === side).map((m) => m.accuracy);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 100;
  };

  // Khai cuộc: thế cờ sâu nhất còn nằm trong sách
  let opening: (Opening & { ply: number }) | null = null;
  for (let i = 0; i < history.length; i++) {
    const o = openingAt(history[i].fen);
    if (o) opening = { ...o, ply: i + 1 };
  }

  return { moves, accuracy: { w: avg('w'), b: avg('b') }, opening };
}

/** Đổi nước UCI sang ký hiệu SAN ở một thế cờ. Trả về chính nó nếu không hợp lệ. */
function sanOf(fen: string, uci: string): string {
  if (!uci) return '';
  try {
    const g = new Game(fen);
    const m = g.move(uci.slice(0, 2) as never, uci.slice(2, 4) as never, uci[4]);
    return m?.san ?? uci;
  } catch {
    return uci;
  }
}

/** Những nước đáng đem ra ôn lại. */
export const WORTH_REVIEWING: MoveClass[] = ['blunder', 'mistake', 'miss'];

export function mistakesOf(review: ReviewResult, side?: Side): ReviewedMove[] {
  return review.moves.filter((m) => WORTH_REVIEWING.includes(m.cls) && (!side || m.side === side));
}
