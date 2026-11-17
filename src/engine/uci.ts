// Đọc hiểu giao thức UCI của Stockfish.
//
// Phần thuần tuý (đọc dòng chữ) tách riêng khỏi phần chạy Worker để test được
// mà không cần tải cả engine.

import type { Score } from '../../shared/winrate.ts';

export interface InfoLine {
  depth: number;
  /** Số thứ tự dòng khi bật MultiPV (1 là nước tốt nhất). */
  multipv: number;
  /** Điểm theo góc nhìn BÊN ĐANG ĐI, đúng như engine trả về. */
  score: Score;
  /** Dòng nước đi dạng UCI, ví dụ ['e2e4', 'e7e5']. */
  pv: string[];
  nodes?: number;
  timeMs?: number;
}

/**
 * Đọc một dòng `info ... pv ...`. Trả về null nếu dòng không có đủ thông tin
 * (engine còn in nhiều loại dòng khác, ví dụ `info depth 1 currmove ...`).
 */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  const depth = Number(/ depth (\d+)/.exec(line)?.[1]);
  if (!Number.isFinite(depth)) return null;

  const cp = / score cp (-?\d+)/.exec(line);
  const mate = / score mate (-?\d+)/.exec(line);
  if (!cp && !mate) return null;

  const pv = line.split(' pv ')[1].trim().split(/\s+/);
  if (!pv.length || !pv[0]) return null;

  return {
    depth,
    multipv: Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1),
    score: cp ? { cp: Number(cp[1]) } : { mate: Number(mate![1]) },
    pv,
    nodes: Number(/ nodes (\d+)/.exec(line)?.[1]) || undefined,
    timeMs: Number(/ time (\d+)/.exec(line)?.[1]) || undefined,
  };
}

/** Đọc dòng `bestmove e2e4 ponder e7e5`. Trả về null khi engine chịu thua/bí. */
export function parseBestMove(line: string): { best: string; ponder?: string } | null {
  if (!line.startsWith('bestmove')) return null;
  const parts = line.trim().split(/\s+/);
  const best = parts[1];
  if (!best || best === '(none)') return null;
  return { best, ponder: parts[3] };
}

/**
 * Đổi điểm từ góc nhìn bên đang đi sang góc nhìn Trắng — cả app dùng góc nhìn
 * Trắng, còn engine thì không.
 */
export function toWhitePov(score: Score, sideToMove: 'w' | 'b'): Score {
  if (sideToMove === 'w') return score;
  return score.mate !== undefined ? { mate: -score.mate } : { cp: -score.cp };
}

/** Nước đi UCI tách thành ô đi, ô đến và quân phong cấp. */
export function splitUci(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}
