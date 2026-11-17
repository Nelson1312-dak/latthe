// Dữ liệu cho các màn hình tĩnh ở giai đoạn thiết kế.
// Sinh bằng `npm run fixtures`: nước đi do chess.js kiểm tra, điểm số do Stockfish tính.
// Không có chữ giả, không có thế cờ bịa.

import raw from './fixtures.json';
import type { MoveClass, Score } from '../../shared/winrate.ts';
import type { Square } from '../../shared/fen.ts';

export interface FixtureMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  scoreBefore: Score;
  scoreAfter: Score;
  best: { san: string; score: Score; pv: string[] }[];
  cls: MoveClass;
  accuracy: number;
}

export interface Fixtures {
  generatedBy: string;
  game1: { moves: FixtureMove[]; pgn: string; accuracy: { w: number; b: number }; opening: string };
  online: { pgn: string; fen: string; history: string[]; lines: { san: string; score: Score; pv: string[] }[] };
  puzzles: { id: string; theme: string; rating: number; fen: string; lines: { san: string; score: Score; pv: string[] }[] }[];
}

export const fx = raw as unknown as Fixtures;

/** Tách nước đi dạng "f3g4" thành hai ô. Dữ liệu mẫu do engine sinh nên luôn hợp lệ. */
export const squaresOf = (uci: string): [Square, Square] => [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square];
