// Lưu và dọn ván đã chơi.

import { all, type Db } from './db.ts';

/** Giữ bao nhiêu ván gần nhất cho mỗi người. */
export const KEEP_GAMES = 20;
/** Ván online giữ ít hơn, theo đúng kế hoạch: 5 ván gần nhất. */
export const KEEP_ONLINE = 5;

export interface GameRow {
  id: number;
  mode: string;
  level: number | null;
  player_side: string;
  winner: string;
  reason: string;
  move_count: number;
  created_at: string;
  opponent_name: string | null;
  opponent_rating: number | null;
  rating_before: number | null;
  rating_after: number | null;
}

export interface NewGame {
  mode: 'bot' | 'human' | 'online';
  level: number | null;
  playerSide: 'w' | 'b';
  pgn: string;
  winner: 'w' | 'b' | 'draw';
  reason: string;
  /** Chỉ ván online mới có. */
  opponentName?: string;
  opponentRating?: number;
  ratingBefore?: number;
  ratingAfter?: number;
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
  opponentName: g.opponent_name,
  opponentRating: g.opponent_rating,
  ratingBefore: g.rating_before,
  ratingAfter: g.rating_after,
});

/**
 * Đọc dữ liệu ván từ trình duyệt gửi lên. Trả về null nếu thiếu hoặc sai kiểu —
 * không tin gì ở phía trình duyệt cả.
 */
export function parseNewGame(body: Record<string, unknown>): NewGame | null {
  const pgn = typeof body.pgn === 'string' ? body.pgn.trim() : '';
  // Cố tình KHÔNG nhận 'online' ở đây: ván online do server tự lưu sau khi
  // trọng tài xong, chứ trình duyệt không được tự khai mình vừa thắng ai.
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
      `INSERT INTO games (user_id, mode, level, player_side, pgn, winner, reason, move_count, created_at,
                          opponent_name, opponent_rating, rating_before, rating_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      g.mode,
      g.level,
      g.playerSide,
      g.pgn,
      g.winner,
      g.reason,
      countMoves(g.pgn),
      now.toISOString(),
      g.opponentName ?? null,
      g.opponentRating ?? null,
      g.ratingBefore ?? null,
      g.ratingAfter ?? null,
    );
  pruneGames(db, userId);
  return Number(info.lastInsertRowid);
}

/**
 * Xoá ván cũ. Hai nhóm đếm riêng: ván online chỉ giữ 5 (kế hoạch nói vậy, cho
 * nhẹ hệ thống), ván với máy giữ 20. Nếu đếm chung thì chơi vài ván với máy là
 * ván online bị đẩy đi mất.
 */
export function pruneGames(db: Db, userId: number, keep = KEEP_GAMES, keepOnline = KEEP_ONLINE): number {
  let xoá = 0;
  for (const [điềuKiện, giữ] of [
    ["mode = 'online'", keepOnline],
    ["mode <> 'online'", keep],
  ] as const) {
    const info = db
      .prepare(
        `DELETE FROM games WHERE user_id = ? AND ${điềuKiện} AND id NOT IN (
           SELECT id FROM games WHERE user_id = ? AND ${điềuKiện} ORDER BY created_at DESC, id DESC LIMIT ?
         )`,
      )
      .run(userId, userId, giữ);
    xoá += Number(info.changes);
  }
  return xoá;
}

export function listGames(db: Db, userId: number, limit = KEEP_GAMES) {
  return all<GameRow>(
    db,
    `SELECT id, mode, level, player_side, winner, reason, move_count, created_at,
            opponent_name, opponent_rating, rating_before, rating_after
       FROM games WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    userId,
    limit,
  ).map(publicGame);
}
