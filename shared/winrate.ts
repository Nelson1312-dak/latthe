// Chấm nước đi theo công thức của Lichess.
// Điểm engine luôn tính theo góc nhìn bên Trắng: cp > 0 là Trắng hơn.

export type Score = { cp: number; mate?: undefined } | { mate: number; cp?: undefined };

export type MoveClass =
  | 'book' // Sách
  | 'best' // Tốt nhất
  | 'good' // Tốt
  | 'inaccuracy' // Thiếu chính xác ?!
  | 'mistake' // Sai ?
  | 'blunder' // Sai nghiêm trọng ??
  | 'miss'; // Bỏ lỡ

/** Cơ hội thắng của Trắng, từ -1 đến 1. */
export function winningChances(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 1 : -1;
  const cp = Math.max(-1000, Math.min(1000, s.cp));
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/** % thắng của Trắng, 0..100. */
export function winPercent(s: Score): number {
  return 50 + 50 * winningChances(s);
}

/** Độ chính xác của một nước, theo % thắng của bên vừa đi trước và sau nước đó. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const a = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export const THRESHOLD = { inaccuracy: 0.1, mistake: 0.2, blunder: 0.3 } as const;

export interface ClassifyInput {
  /** Điểm trước nước đi (góc nhìn Trắng). */
  before: Score;
  /** Điểm sau nước đi (góc nhìn Trắng). */
  after: Score;
  /** Bên vừa đi. */
  side: 'w' | 'b';
  /** Nước đã đi có trùng nước tốt nhất của engine không. */
  isBest: boolean;
  /** Nước đã đi có trong bảng khai cuộc không. */
  isBook?: boolean;
}

export function classify(i: ClassifyInput): MoveClass {
  if (i.isBook) return 'book';
  if (i.isBest) return 'best';
  const sign = i.side === 'w' ? 1 : -1;
  const before = sign * winningChances(i.before);
  const after = sign * winningChances(i.after);
  const loss = before - after;
  // Có chiếu hết cho mình mà không đi, và cũng không còn chiếu hết sau đó.
  const hadMate = i.before.mate !== undefined && sign * i.before.mate > 0;
  const stillMate = i.after.mate !== undefined && sign * i.after.mate > 0;
  if (hadMate && !stillMate) return 'miss';
  if (loss >= THRESHOLD.blunder) return 'blunder';
  if (loss >= THRESHOLD.mistake) return 'mistake';
  if (loss >= THRESHOLD.inaccuracy) return 'inaccuracy';
  return 'good';
}

/** Hiển thị điểm kiểu "+1.4", "-0.3", "M3", "-M2". */
export function formatScore(s: Score): string {
  if (s.mate !== undefined) return (s.mate < 0 ? '−M' : 'M') + Math.abs(s.mate);
  const v = Math.abs(s.cp / 100).toFixed(1); // làm tròn trước, để -0.02 không thành "−0.0"
  return (v === '0.0' ? '' : s.cp > 0 ? '+' : '−') + v;
}
