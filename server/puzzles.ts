// Lấy bài tập theo độ khó và chủ đề, và tính lại độ khó của người học.

import { all, one, type Db } from './db.ts';

export interface PuzzleRow {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string;
}

export interface Puzzle {
  id: string;
  /** Thế cờ TRƯỚC nước của đối phương. */
  fen: string;
  /** Nước đầu là của đối phương, phần còn lại là lời giải. */
  moves: string[];
  rating: number;
  themes: string[];
}

const toPuzzle = (r: PuzzleRow): Puzzle => ({
  id: r.id,
  fen: r.fen,
  moves: r.moves.split(' '),
  rating: r.rating,
  themes: r.themes.split(' ').filter(Boolean),
});

export function puzzleCount(db: Db): number {
  try {
    return one<{ c: number }>(db, 'SELECT count(*) c FROM puzzles')?.c ?? 0;
  } catch {
    // Chưa chạy `npm run puzzles` thì bảng chưa tồn tại
    return 0;
  }
}

/**
 * Lấy một bài quanh mức `rating`. Không quét cả kho: chọn một mốc ngẫu nhiên
 * trong khoảng rồi lấy bài gần nhất theo chỉ mục.
 */
export function pickPuzzle(
  db: Db,
  opts: { rating: number; theme?: string; spread?: number; exclude?: string[]; random?: () => number } = {
    rating: 1000,
  },
): Puzzle | null {
  const spread = opts.spread ?? 150;
  const random = opts.random ?? Math.random;
  const target = Math.round(opts.rating - spread + random() * spread * 2);
  const exclude = opts.exclude ?? [];
  const placeholders = exclude.map(() => '?').join(',');
  const notIn = exclude.length ? ` AND p.id NOT IN (${placeholders})` : '';

  const sql = opts.theme
    ? `SELECT p.id, p.fen, p.moves, p.rating, p.themes FROM puzzle_themes t
         JOIN puzzles p ON p.id = t.puzzle_id
        WHERE t.theme = ?${notIn}
        ORDER BY abs(t.rating - ?) LIMIT 1`
    : `SELECT p.id, p.fen, p.moves, p.rating, p.themes FROM puzzles p
        WHERE 1 = 1${notIn}
        ORDER BY abs(p.rating - ?) LIMIT 1`;

  const params = opts.theme ? [opts.theme, ...exclude, target] : [...exclude, target];
  try {
    const row = one<PuzzleRow>(db, sql, ...params);
    return row ? toPuzzle(row) : null;
  } catch {
    return null;
  }
}

/** Các chủ đề có trong kho, kèm số bài. */
export function themeCounts(db: Db): { theme: string; count: number }[] {
  try {
    return all<{ theme: string; count: number }>(
      db,
      'SELECT theme, count(*) count FROM puzzle_themes GROUP BY theme ORDER BY count DESC',
    );
  } catch {
    return [];
  }
}

/* ---------------- Độ khó của người học ---------------- */

/** Hệ số K: lúc đầu nhảy nhanh cho mau về đúng mức, sau thì ổn định lại. */
export function kFactor(attempts: number): number {
  return attempts < 20 ? 40 : attempts < 60 ? 28 : 20;
}

/**
 * Elo đơn giản. `correct` là giải đúng ngay, không dùng gợi ý.
 * Trả về rating mới, làm tròn.
 */
export function newRating(playerRating: number, puzzleRating: number, correct: boolean, attempts: number): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400));
  const next = playerRating + kFactor(attempts) * ((correct ? 1 : 0) - expected);
  // Không cho tụt dưới 400 hay vọt quá 2600: ngoài khoảng đó kho bài không còn gì hợp
  return Math.max(400, Math.min(2600, Math.round(next)));
}

export function recordAttempt(
  db: Db,
  userId: number,
  puzzleId: string,
  puzzleRating: number,
  correct: boolean,
  now = new Date(),
): { rating: number; attempts: number } {
  const user = one<{ puzzle_rating: number }>(db, 'SELECT puzzle_rating FROM users WHERE id = ?', userId);
  const attempts = one<{ c: number }>(db, 'SELECT count(*) c FROM puzzle_attempts WHERE user_id = ?', userId)?.c ?? 0;
  const rating = newRating(user?.puzzle_rating ?? 1000, puzzleRating, correct, attempts);

  db.prepare(
    'INSERT INTO puzzle_attempts (user_id, puzzle_id, correct, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, puzzleId, correct ? 1 : 0, rating, now.toISOString());
  db.prepare('UPDATE users SET puzzle_rating = ? WHERE id = ?').run(rating, userId);
  return { rating, attempts: attempts + 1 };
}

/** Bài đã làm rồi thì đừng đưa lại ngay. */
export function recentAttemptIds(db: Db, userId: number, limit = 50): string[] {
  return all<{ puzzle_id: string }>(
    db,
    'SELECT puzzle_id FROM puzzle_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    userId,
    limit,
  ).map((r) => r.puzzle_id);
}

export interface PuzzleStats {
  rating: number;
  attempts: number;
  correct: number;
  /** Số ngày liên tiếp có luyện, tính tới hôm nay. */
  streak: number;
}

export function puzzleStats(db: Db, userId: number, now = new Date()): PuzzleStats {
  const user = one<{ puzzle_rating: number }>(db, 'SELECT puzzle_rating FROM users WHERE id = ?', userId);
  const agg = one<{ n: number; ok: number }>(
    db,
    'SELECT count(*) n, sum(correct) ok FROM puzzle_attempts WHERE user_id = ?',
    userId,
  );
  const days = all<{ d: string }>(
    db,
    'SELECT DISTINCT substr(created_at, 1, 10) d FROM puzzle_attempts WHERE user_id = ? ORDER BY d DESC LIMIT 400',
    userId,
  ).map((r) => r.d);

  let streak = 0;
  const day = new Date(now);
  for (;;) {
    const key = day.toISOString().slice(0, 10);
    if (!days.includes(key)) {
      // Hôm nay chưa luyện thì chuỗi vẫn còn nếu hôm qua có
      if (streak === 0 && key === now.toISOString().slice(0, 10)) {
        day.setDate(day.getDate() - 1);
        continue;
      }
      break;
    }
    streak++;
    day.setDate(day.getDate() - 1);
  }

  return { rating: user?.puzzle_rating ?? 1000, attempts: agg?.n ?? 0, correct: agg?.ok ?? 0, streak };
}
