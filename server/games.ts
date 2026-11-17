// Lưu và dọn ván đã chơi.

import { all, type Db } from './db.ts';

/** Giữ bao nhiêu ván gần nhất cho mỗi người. Ván qua mạng sẽ có hạn riêng (5). */
export const KEEP_GAMES = 20;

export interface GameRow {
  id: number;
  mode: string;
  level: number | null;
  player_side: string;
  winner: string;
  reason: string;
  move_count: number;
  created_at: string;
}

export interface NewGame {
  mode: 'bot' | 'human';
  level: number | null;
  playerSide: 'w' | 'b';
  pgn: string;
  winner: 'w' | 'b' | 'draw';
  reason: string;
}

export const publicGame = (g: GameRow) => ({
  id: g.id,
  mode: g.mode,
  level: g.level,
  playerSide: g.player_side,
  winner: g.winner,
  reason: g.reason,
  moveCount: g.move_count,
  createdAt: g.created_at,
});

/**
 * Đọc dữ liệu ván từ trình duyệt gửi lên. Trả về null nếu thiếu hoặc sai kiểu —
 * không tin gì ở phía trình duyệt cả.
 */
export function parseNewGame(body: Record<string, unknown>): NewGame | null {
  const pgn = typeof body.pgn === 'string' ? body.pgn.trim() : '';
  const mode = body.mode === 'bot' || body.mode === 'human' ? body.mode : null;
  const winner = body.winner === 'w' || body.winner === 'b' || body.winner === 'draw' ? body.winner : null;
  const playerSide = body.playerSide === 'w' || body.playerSide === 'b' ? body.playerSide : null;
  if (!pgn || !mode || !winner || !playerSide) return null;
  return {
    mode,
    winner,
    playerSide,
    pgn,
    level: Number.isInteger(body.level) ? (body.level as number) : null,
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 40) : 'unknown',
  };
}

/** Đếm nước từ PGN, không tin con số trình duyệt gửi lên. */
export function countMoves(pgn: string): number {
  return (pgn.match(/\d+\.\s*\S+/g) ?? []).length;
}

export function insertGame(db: Db, userId: number, g: NewGame, now = new Date()): number {
  const info = db
    .prepare(
      `INSERT INTO games (user_id, mode, level, player_side, pgn, winner, reason, move_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, g.mode, g.level, g.playerSide, g.pgn, g.winner, g.reason, countMoves(g.pgn), now.toISOString());
  pruneGames(db, userId);
  return Number(info.lastInsertRowid);
}

/** Xoá ván cũ, chỉ giữ KEEP_GAMES ván gần nhất của người đó. */
export function pruneGames(db: Db, userId: number, keep = KEEP_GAMES): number {
  const info = db
    .prepare(
      `DELETE FROM games WHERE user_id = ? AND id NOT IN (
         SELECT id FROM games WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
       )`,
    )
    .run(userId, userId, keep);
  return Number(info.changes);
}

export function listGames(db: Db, userId: number, limit = KEEP_GAMES) {
  return all<GameRow>(
    db,
    `SELECT id, mode, level, player_side, winner, reason, move_count, created_at
       FROM games WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    userId,
    limit,
  ).map(publicGame);
}
