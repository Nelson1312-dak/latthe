// Đồng hồ ván online. Server giữ giờ, trình duyệt chỉ vẽ lại.
//
// Mọi hàm ở đây nhận `now` làm tham số chứ không tự gọi Date.now(), để test
// tua được thời gian mà không phải giả lập đồng hồ hệ thống.

import type { Side } from '../../shared/chess.ts';
import type { TimeControl } from '../../shared/protocol.ts';

export interface Clock {
  /** Giờ còn lại của Trắng lúc bắt đầu lượt hiện tại. */
  whiteMs: number;
  blackMs: number;
  /** Bên đang bị trừ giờ. */
  turn: Side;
  /** Lúc lượt hiện tại bắt đầu được tính (epoch ms). */
  since: number;
}

export function startClock(tc: TimeControl, now: number): Clock {
  return { whiteMs: tc.initialMs, blackMs: tc.initialMs, turn: 'w', since: now };
}

/** Giờ còn lại của một bên ngay lúc `now`. Không bao giờ trả về số âm. */
export function remaining(c: Clock, side: Side, now: number): number {
  const base = side === 'w' ? c.whiteMs : c.blackMs;
  if (side !== c.turn) return base;
  return Math.max(0, base - Math.max(0, now - c.since));
}

/**
 * Sau khi bên đang đi đánh xong một nước: trừ thời gian đã dùng, cộng
 * increment, rồi chuyển lượt.
 */
export function afterMove(c: Clock, tc: TimeControl, now: number): Clock {
  const left = remaining(c, c.turn, now) + tc.incrementMs;
  const next: Clock = {
    whiteMs: c.turn === 'w' ? left : c.whiteMs,
    blackMs: c.turn === 'b' ? left : c.blackMs,
    turn: c.turn === 'w' ? 'b' : 'w',
    since: now,
  };
  return next;
}

/** Bên nào đã hết giờ, hoặc null nếu chưa ai. Chỉ bên đang đi mới rơi cờ được. */
export function flagged(c: Clock, now: number): Side | null {
  return remaining(c, c.turn, now) <= 0 ? c.turn : null;
}

/**
 * Hết giờ nhưng đối thủ không còn đủ quân để chiếu hết thì xử hòa, không xử
 * thua — luật FIDE 6.9, và cả chess.com lẫn Lichess đều làm vậy. Người chơi
 * mới hay thắc mắc chỗ này nên để hẳn một hàm riêng cho dễ thấy.
 */
export function timeoutWinner(flaggedSide: Side, opponentCanMate: boolean): Side | 'draw' {
  if (!opponentCanMate) return 'draw';
  return flaggedSide === 'w' ? 'b' : 'w';
}
