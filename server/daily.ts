// Bài tập của ngày: mỗi ngày (giờ Việt Nam) cả trang giải chung một bài.
//
// Lý do để quay lại mỗi ngày: giải được thì chuỗi ngày +1, bỏ một ngày là chuỗi
// về 0. Bài được chọn CỐ ĐỊNH theo ngày (hạt giống ngẫu nhiên lấy từ ngày), nên
// ai mở cũng thấy cùng một bài, server khởi động lại cũng không đổi bài.
// Chỉ tính lần giải ĐẦU TIÊN mỗi ngày: sai rồi thử lại đúng thì không tính.

import { all, one, type Db } from './db.ts';
import { pickPuzzle, type Puzzle } from './puzzles.ts';
import { vnDay } from './stats.ts';

/** Bài của ngày nằm trong khoảng độ khó này: đủ khó để đáng giải, không quá sức người mới. */
const RATING_MIN = 1100;
const RATING_MAX = 1500;

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống thì cùng dãy số. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDay(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
}

const nhớ = new Map<string, Puzzle | null>();

/** Bài của một ngày (YYYY-MM-DD). Cùng ngày luôn ra cùng một bài. */
export function dailyPuzzle(db: Db, day: string): Puzzle | null {
  if (nhớ.has(day)) return nhớ.get(day)!;
  const rnd = seeded(hashDay(day));
  const rating = Math.round(RATING_MIN + rnd() * (RATING_MAX - RATING_MIN));
  const p = pickPuzzle(db, { rating, spread: 100, random: rnd });
  if (nhớ.size > 30) nhớ.clear();
  nhớ.set(day, p);
  return p;
}

/** Ghi lần giải đầu tiên trong ngày. Trả về false nếu hôm nay đã ghi rồi. */
export function recordDaily(db: Db, userId: number, day: string, correct: boolean, now = new Date()): boolean {
  const r = db
    .prepare('INSERT OR IGNORE INTO daily_solves (user_id, day, correct, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, day, correct ? 1 : 0, now.toISOString());
  return Number(r.changes) > 0;
}

export interface DailyMe {
  /** Hôm nay đã làm chưa, và có đúng không. */
  done: boolean;
  correct: boolean;
  /** Số ngày liên tiếp giải đúng, tính tới hôm nay (hoặc hôm qua nếu hôm nay chưa làm). */
  streak: number;
}

const ngàyTrước = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);

/**
 * Chuỗi ngày: đếm lùi từ hôm nay những ngày giải đúng liên tiếp. Hôm nay chưa
 * làm thì chưa mất chuỗi — đếm từ hôm qua (người ta còn cả ngày để giải).
 */
export function dailyMe(db: Db, userId: number, today: string): DailyMe {
  const rows = all<{ day: string; correct: number }>(
    db,
    'SELECT day, correct FROM daily_solves WHERE user_id = ? AND day <= ? ORDER BY day DESC LIMIT 400',
    userId,
    today,
  );
  const map = new Map(rows.map((r) => [r.day, r.correct === 1]));
  const hômNay = map.get(today);
  let streak = 0;
  let d = hômNay === undefined ? ngàyTrước(today) : today;
  while (map.get(d) === true) {
    streak++;
    d = ngàyTrước(d);
  }
  return { done: hômNay !== undefined, correct: hômNay === true, streak };
}

/** Hôm nay bao nhiêu người đã giải, bao nhiêu người giải đúng — cho vui. */
export function dailyCount(db: Db, day: string): { tried: number; solved: number } {
  const r = one<{ tried: number; solved: number }>(
    db,
    'SELECT count(*) AS tried, coalesce(sum(correct), 0) AS solved FROM daily_solves WHERE day = ?',
    day,
  );
  return { tried: Number(r?.tried ?? 0), solved: Number(r?.solved ?? 0) };
}

export const today = (now: Date | number = Date.now()) => vnDay(now);
