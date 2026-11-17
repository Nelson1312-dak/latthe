// Lưu kết quả chấm ván, và sinh thẻ ôn tập từ những nước sai.

import { all, one, type Db } from './db.ts';

/** Hộp Leitner: giải đúng thì lên một hộp, sai thì về hộp 1. */
export const BOX_DAYS = [1, 3, 7, 16, 35];
export const MAX_BOX = BOX_DAYS.length;
/** Nhiều quá thì ôn không xuể; bỏ thẻ đã thuộc lâu nhất. */
export const MAX_CARDS = 2000;

export interface StoredMove {
  ply: number;
  san: string;
  uci: string;
  side: 'w' | 'b';
  fenBefore: string;
  cls: string;
  accuracy: number;
  scoreAfter: { cp?: number; mate?: number };
  best?: { uci: string; san: string }[];
}

export interface StoredReview {
  moves: StoredMove[];
  accuracy: { w: number; b: number };
  opening: { eco: string; name: string; ply: number } | null;
}

/** Nước đáng đem ra ôn lại. */
const WORTH_REVIEWING = new Set(['blunder', 'mistake', 'miss']);

/** Đọc kết quả chấm ván trình duyệt gửi lên. Trả về null nếu sai dạng. */
export function parseReview(body: unknown): StoredReview | null {
  const b = body as Partial<StoredReview>;
  if (!b || !Array.isArray(b.moves) || !b.accuracy) return null;
  const { w, b: black } = b.accuracy as { w: unknown; b: unknown };
  if (typeof w !== 'number' || typeof black !== 'number') return null;
  // Giới hạn độ dài để không ai nhét cả quyển sách vào database
  if (b.moves.length > 600) return null;
  for (const m of b.moves) {
    if (typeof m.ply !== 'number' || typeof m.san !== 'string' || typeof m.fenBefore !== 'string') return null;
    if (m.side !== 'w' && m.side !== 'b') return null;
  }
  return {
    moves: b.moves,
    accuracy: { w, b: black },
    opening: b.opening ?? null,
  };
}

export function saveReview(db: Db, gameId: number, review: StoredReview, now = new Date()): void {
  db.prepare(
    `INSERT INTO reviews (game_id, data, accuracy_w, accuracy_b, opening, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET
       data = excluded.data, accuracy_w = excluded.accuracy_w,
       accuracy_b = excluded.accuracy_b, opening = excluded.opening`,
  ).run(
    gameId,
    JSON.stringify(review),
    review.accuracy.w,
    review.accuracy.b,
    review.opening ? `${review.opening.eco} ${review.opening.name}` : null,
    now.toISOString(),
  );
}

export function getReview(db: Db, gameId: number): StoredReview | null {
  const row = one<{ data: string }>(db, 'SELECT data FROM reviews WHERE game_id = ?', gameId);
  if (!row) return null;
  try {
    return JSON.parse(row.data) as StoredReview;
  } catch {
    return null;
  }
}

export interface CardRow {
  id: number;
  fen: string;
  played_uci: string;
  best_uci: string;
  best_san: string;
  cls: string;
  box: number;
  due_at: string;
  wrong_count: number;
}

/**
 * Sinh thẻ ôn tập từ những nước sai của CHÍNH người chơi (không phải của máy).
 * Trùng thế cờ thì bỏ qua — gặp lại đúng thế đó không học thêm được gì.
 * Trả về số thẻ mới tạo.
 */
export function makeCards(
  db: Db,
  userId: number,
  gameId: number,
  review: StoredReview,
  playerSide: 'w' | 'b',
  now = new Date(),
): number {
  const due = new Date(now.getTime() + BOX_DAYS[0] * 86400_000).toISOString();
  let made = 0;
  for (const m of review.moves) {
    if (m.side !== playerSide || !WORTH_REVIEWING.has(m.cls)) continue;
    const best = m.best?.[0];
    if (!best?.uci) continue;
    const info = db
      .prepare(
        `INSERT INTO cards (user_id, game_id, fen, played_uci, best_uci, best_san, cls, box, due_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(user_id, fen) DO NOTHING`,
      )
      .run(userId, gameId, m.fenBefore, m.uci, best.uci, best.san, m.cls, due, now.toISOString());
    made += Number(info.changes);
  }
  if (made) pruneCards(db, userId);
  return made;
}

/** Thẻ đến hạn ôn hôm nay. */
export function dueCards(db: Db, userId: number, limit = 20, now = new Date()): CardRow[] {
  return all<CardRow>(
    db,
    `SELECT id, fen, played_uci, best_uci, best_san, cls, box, due_at, wrong_count
       FROM cards WHERE user_id = ? AND due_at <= ? ORDER BY due_at LIMIT ?`,
    userId,
    now.toISOString(),
    limit,
  );
}

export function countCards(db: Db, userId: number, now = new Date()): { total: number; due: number } {
  const total = one<{ c: number }>(db, 'SELECT count(*) c FROM cards WHERE user_id = ?', userId)?.c ?? 0;
  const due =
    one<{ c: number }>(db, 'SELECT count(*) c FROM cards WHERE user_id = ? AND due_at <= ?', userId, now.toISOString())
      ?.c ?? 0;
  return { total, due };
}

/** Trả lời một thẻ: đúng thì lên hộp, sai thì về hộp 1. */
export function answerCard(db: Db, userId: number, cardId: number, correct: boolean, now = new Date()): CardRow | null {
  const card = one<CardRow>(db, 'SELECT * FROM cards WHERE id = ? AND user_id = ?', cardId, userId);
  if (!card) return null;
  const box = correct ? Math.min(card.box + 1, MAX_BOX) : 1;
  const due = new Date(now.getTime() + BOX_DAYS[box - 1] * 86400_000).toISOString();
  db.prepare('UPDATE cards SET box = ?, due_at = ?, wrong_count = wrong_count + ? WHERE id = ?').run(
    box,
    due,
    correct ? 0 : 1,
    cardId,
  );
  return { ...card, box, due_at: due, wrong_count: card.wrong_count + (correct ? 0 : 1) };
}

/** Giữ số thẻ trong giới hạn: bỏ thẻ đã thuộc nhất (hộp cao) và cũ nhất trước. */
export function pruneCards(db: Db, userId: number, keep = MAX_CARDS): number {
  const info = db
    .prepare(
      `DELETE FROM cards WHERE user_id = ? AND id NOT IN (
         SELECT id FROM cards WHERE user_id = ? ORDER BY box ASC, created_at DESC LIMIT ?
       )`,
    )
    .run(userId, userId, keep);
  return Number(info.changes);
}
