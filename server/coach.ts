// Huấn luyện viên: đọc bảng game_insights (tóm tắt lỗi từng ván, server/analyst.ts
// tính) để nói lỗi bạn hay lặp lại và nên học gì tiếp. Lời khuyên bằng chữ do
// advisor.ts lo (AI viết, code kiểm).
//
// Có hai góc nhìn trên cùng một dữ liệu:
// - coachReport: các ván gần nhất của MỘT người (tab Huấn luyện viên).
// - communityReport: ván của MỌI người trong N ngày, gộp lại không tên — chỉ chủ
//   trang xem, để biết người chơi đang vướng gì mà làm thêm bài học cho trúng.

import { all, one, type Db } from './db.ts';
import {
  COACH_GAMES,
  COACH_MIN_GAMES,
  coachFacts,
  lessonsFor,
  type CoachFacts,
  type GameInsight,
} from '../shared/coach.ts';
import { LESSONS } from '../src/training/lessons.ts';
import { pendingFor } from './analyst.ts';

export interface CoachLesson {
  id: string;
  title: string;
  keyPoint: string;
  done?: boolean;
}

export interface CoachReport {
  /** null là chưa đủ ván đã chấm. */
  facts: CoachFacts | null;
  /** Còn thiếu ngần này ván đã chấm. */
  need: number;
  /** Số ván đang chờ máy chủ chấm. */
  pending: number;
  lessons: CoachLesson[];
}

function đọc(rows: { data: string }[]): GameInsight[] {
  const out: GameInsight[] = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.data) as GameInsight);
    } catch {
      /* bản ghi hỏng: bỏ qua */
    }
  }
  return out;
}

const bàiHọc = (ids: string[]): CoachLesson[] =>
  ids
    .map((id) => LESSONS.find((l) => l.id === id))
    .filter((l) => l !== undefined)
    .map((l) => ({ id: l.id, title: l.title, keyPoint: l.keyPoint }));

export function coachReport(db: Db, userId: number): CoachReport {
  // Ván hai người một máy không phải ván "của mình" trọn vẹn: không tính
  const xs = đọc(
    all<{ data: string }>(
      db,
      `SELECT data FROM game_insights WHERE user_id = ? AND mode != 'human'
        ORDER BY played_at DESC, game_id DESC LIMIT ?`,
      userId,
      COACH_GAMES,
    ),
  );
  const pending = pendingFor(db, userId);
  if (xs.length < COACH_MIN_GAMES) return { facts: null, need: COACH_MIN_GAMES - xs.length, pending, lessons: [] };

  const facts = coachFacts(xs);
  const done = new Set(
    all<{ lesson_id: string }>(db, 'SELECT lesson_id FROM lesson_progress WHERE user_id = ?', userId).map((x) => x.lesson_id),
  );
  return { facts, need: 0, pending, lessons: bàiHọc(lessonsFor(facts, done)) };
}

export interface CommunityReport {
  days: number;
  players: number;
  facts: CoachFacts | null;
  lessons: CoachLesson[];
  /** Ván trong khoảng này còn chờ máy chủ chấm. */
  pending: number;
}

/** Gộp ván của mọi người chơi trong `days` ngày gần nhất. Không có tên ai. */
export function communityReport(db: Db, days = 30, now = new Date()): CommunityReport {
  const từ = new Date(now.getTime() - days * 86400_000).toISOString();
  const xs = đọc(
    all<{ data: string }>(
      db,
      `SELECT data FROM game_insights WHERE mode != 'human' AND played_at >= ? ORDER BY played_at DESC`,
      từ,
    ),
  );
  // Gộp nhiều người: bỏ ví dụ (ví dụ là ván của một người cụ thể)
  for (const x of xs) delete x.gameId;
  const players =
    one<{ c: number }>(
      db,
      `SELECT count(DISTINCT user_id) c FROM game_insights WHERE mode != 'human' AND played_at >= ?`,
      từ,
    )?.c ?? 0;
  const pending =
    one<{ c: number }>(
      db,
      `SELECT count(*) c FROM games g LEFT JOIN reviews r ON r.game_id = g.id
        WHERE r.game_id IS NULL AND g.move_count >= 2 AND g.created_at >= ?`,
      từ,
    )?.c ?? 0;
  if (!xs.length) return { days, players, facts: null, lessons: [], pending };
  const facts = coachFacts(xs);
  return { days, players, facts, lessons: bàiHọc(lessonsFor(facts)), pending };
}
