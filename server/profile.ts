// Hồ sơ người chơi: màn chào mừng, tên gọi, tuỳ chọn đi theo tài khoản,
// thống kê, và tự xoá tài khoản.

import { all, one, type Db, type User } from './db.ts';
import { BOTS } from './live/bots.ts';

/** Trình độ tự nhận ở màn chào mừng → điểm khởi đầu và cấp máy gợi ý. */
export const START_LEVELS = {
  new: { game: 600, puzzle: 800, bot: 1 },
  basic: { game: 800, puzzle: 1000, bot: 2 },
  club: { game: 1200, puzzle: 1300, bot: 4 },
  strong: { game: 1600, puzzle: 1700, bot: 6 },
} as const;
export type StartLevel = keyof typeof START_LEVELS;

export interface ProfilePatch {
  name?: string;
  level?: StartLevel;
}

/** Kiểm tra dữ liệu gửi lên. Trả về chuỗi lỗi nếu không hợp lệ. */
export function parseProfilePatch(body: Record<string, unknown>): ProfilePatch | string {
  const out: ProfilePatch = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return 'Tên không hợp lệ';
    // Bỏ ký tự điều khiển, gộp khoảng trắng
    const name = body.name
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 2) return 'Tên cần ít nhất 2 ký tự';
    if (name.length > 30) return 'Tên dài tối đa 30 ký tự';
    out.name = name;
  }
  if (body.level !== undefined) {
    if (typeof body.level !== 'string' || !Object.hasOwn(START_LEVELS, body.level)) return 'Trình độ không hợp lệ';
    out.level = body.level as StartLevel;
  }
  return out;
}

/**
 * Lưu hồ sơ. Trình độ tự nhận chỉ đặt điểm khởi đầu khi người đó CHƯA qua màn
 * chào mừng và chưa đấu ván online nào — đã có điểm thật thì không tự sửa được.
 */
export function applyProfile(db: Db, user: User, patch: ProfilePatch): User {
  if (patch.name) {
    db.prepare('UPDATE users SET display_name = ?, custom_name = 1 WHERE id = ?').run(patch.name, user.id);
  }
  if (patch.level && !user.onboarded && user.game_count === 0) {
    const s = START_LEVELS[patch.level];
    db.prepare('UPDATE users SET game_rating = ? WHERE id = ?').run(s.game, user.id);
    const tried = one<{ n: number }>(db, 'SELECT count(*) AS n FROM puzzle_attempts WHERE user_id = ?', user.id)?.n ?? 0;
    if (tried === 0) db.prepare('UPDATE users SET puzzle_rating = ? WHERE id = ?').run(s.puzzle, user.id);
  }
  db.prepare('UPDATE users SET onboarded = 1 WHERE id = ?').run(user.id);
  return one<User>(db, 'SELECT * FROM users WHERE id = ?', user.id)!;
}

const BOARDS = new Set(['green', 'wood', 'blue', 'stone', 'teal']);

/** Tuỳ chọn hiển thị: chỉ nhận đúng các khoá đã biết, bỏ hết phần lạ. */
export function parsePrefs(body: Record<string, unknown>): Record<string, string | boolean> | string {
  const p = body.prefs;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Thiếu tuỳ chọn';
  const src = p as Record<string, unknown>;
  const out: Record<string, string | boolean> = {};
  if (typeof src.board === 'string' && BOARDS.has(src.board)) out.board = src.board;
  if (src.theme === 'dark' || src.theme === 'light') out.theme = src.theme;
  for (const k of ['coords', 'legal', 'autoQueen', 'assist', 'sound']) {
    if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  }
  return out;
}

export function savePrefs(db: Db, userId: number, prefs: Record<string, string | boolean>): void {
  db.prepare('UPDATE users SET prefs = ? WHERE id = ?').run(JSON.stringify(prefs), userId);
}

export function readPrefs(user: User): Record<string, unknown> | null {
  if (!user.prefs) return null;
  try {
    return JSON.parse(user.prefs) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface ProfileStats {
  memberSince: string;
  games: { total: number; online: number; bot: number; wins: number; draws: number; losses: number };
  puzzles: { tried: number; solved: number };
  lessonsDone: number;
}

/** Thống kê cho màn Hồ sơ. Ván "hai người một máy" không tính thắng thua. */
export function profileStats(db: Db, user: User): ProfileStats {
  const rows = all<{ mode: string; player_side: string; winner: string }>(
    db,
    'SELECT mode, player_side, winner FROM games WHERE user_id = ?',
    user.id,
  );
  const g = { total: rows.length, online: 0, bot: 0, wins: 0, draws: 0, losses: 0 };
  for (const r of rows) {
    if (r.mode === 'online') g.online++;
    if (r.mode === 'bot') g.bot++;
    if (r.mode === 'human') continue;
    if (r.winner === 'draw') g.draws++;
    else if (r.winner === r.player_side) g.wins++;
    else g.losses++;
  }
  const pz = one<{ tried: number; solved: number }>(
    db,
    'SELECT count(*) AS tried, coalesce(sum(correct), 0) AS solved FROM puzzle_attempts WHERE user_id = ?',
    user.id,
  ) ?? { tried: 0, solved: 0 };
  const lessons = one<{ n: number }>(db, 'SELECT count(*) AS n FROM lesson_progress WHERE user_id = ?', user.id)?.n ?? 0;
  return {
    memberSince: user.created_at,
    games: g,
    puzzles: { tried: Number(pz.tried), solved: Number(pz.solved) },
    lessonsDone: Number(lessons),
  };
}

/**
 * Xoá hẳn tài khoản. Ván cờ, chấm ván, thẻ ôn tập, bài tập, bài học, phiên
 * đăng nhập đi theo nhờ ON DELETE CASCADE (foreign_keys đã bật trong db.ts).
 */
export function deleteUser(db: Db, userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

export interface LadderStep {
  id: string;
  name: string;
  elo: number;
  blurb: string;
  /** Đã thắng bot này ít nhất một lần. */
  beaten: boolean;
}

/**
 * Bậc thang AI: sáu bot từ yếu tới mạnh, đánh dấu bot nào người này đã thắng.
 * Đọc từ ván đã lưu (ván với bot lưu tên "<Bot> (AI)").
 */
export function botLadder(db: Db, userId: number | null): LadderStep[] {
  const thắng = new Set<string>();
  if (userId !== null) {
    for (const r of all<{ opponent_name: string }>(
      db,
      `SELECT DISTINCT opponent_name FROM games
        WHERE user_id = ? AND mode = 'online' AND winner = player_side AND opponent_name LIKE '% (AI)'`,
      userId,
    )) {
      thắng.add(r.opponent_name.replace(/ \(AI\)$/, ''));
    }
  }
  return BOTS.map((b) => ({ id: b.id, name: b.name, elo: b.elo, blurb: b.blurb, beaten: thắng.has(b.name) }));
}

export interface EloPoint {
  /** Thời điểm, ISO. */
  t: string;
  r: number;
}

/** Elo theo thời gian: đấu online (sau mỗi ván) và bài tập (sau mỗi bài). Tối đa 300 điểm mỗi loại. */
export function eloHistory(db: Db, userId: number): { online: EloPoint[]; puzzles: EloPoint[] } {
  const online = all<{ created_at: string; rating_after: number }>(
    db,
    `SELECT created_at, rating_after FROM games
      WHERE user_id = ? AND mode = 'online' AND rating_after IS NOT NULL ORDER BY created_at DESC LIMIT 300`,
    userId,
  ).reverse();
  const puzzles = all<{ created_at: string; rating_after: number }>(
    db,
    'SELECT created_at, rating_after FROM puzzle_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 300',
    userId,
  ).reverse();
  return {
    online: online.map((r) => ({ t: r.created_at, r: r.rating_after })),
    puzzles: puzzles.map((r) => ({ t: r.created_at, r: r.rating_after })),
  };
}
