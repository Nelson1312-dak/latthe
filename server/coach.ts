// Huấn luyện viên (Hồ sơ): đọc các ván gần nhất đã chấm của người chơi, tính ra
// lỗi hay lặp lại (shared/coach.ts) và chọn bài học nên làm tiếp.
// Lời khuyên bằng chữ do advisor.ts lo (AI viết, code kiểm).

import { all, type Db } from './db.ts';
import {
  COACH_GAMES,
  COACH_MIN_GAMES,
  coachFacts,
  lessonsFor,
  type CoachFacts,
  type CoachGame,
  type CoachMove,
} from '../shared/coach.ts';
import { LESSONS } from '../src/training/lessons.ts';

export interface CoachLesson {
  id: string;
  title: string;
  keyPoint: string;
}

export interface CoachReport {
  /** null là chưa đủ ván đã chấm. */
  facts: CoachFacts | null;
  /** Còn thiếu ngần này ván đã chấm. */
  need: number;
  lessons: CoachLesson[];
}

export function coachReport(db: Db, userId: number): CoachReport {
  // Ván hai người một máy không phải ván "của mình" trọn vẹn: không tính
  const rows = all<{ side: string; winner: string; data: string }>(
    db,
    `SELECT g.player_side AS side, g.winner, r.data FROM games g JOIN reviews r ON r.game_id = g.id
      WHERE g.user_id = ? AND g.mode != 'human' ORDER BY g.created_at DESC, g.id DESC LIMIT ?`,
    userId,
    COACH_GAMES,
  );
  const games: CoachGame[] = [];
  for (const r of rows) {
    try {
      const moves = (JSON.parse(r.data) as { moves?: CoachMove[] }).moves;
      if (!Array.isArray(moves) || !moves.length) continue;
      if (r.side !== 'w' && r.side !== 'b') continue;
      games.push({ side: r.side, winner: r.winner as CoachGame['winner'], moves });
    } catch {
      /* bản ghi hỏng: bỏ qua */
    }
  }
  if (games.length < COACH_MIN_GAMES) return { facts: null, need: COACH_MIN_GAMES - games.length, lessons: [] };

  const facts = coachFacts(games);
  const done = new Set(
    all<{ lesson_id: string }>(db, 'SELECT lesson_id FROM lesson_progress WHERE user_id = ?', userId).map((x) => x.lesson_id),
  );
  const lessons = lessonsFor(facts, done)
    .map((id) => LESSONS.find((l) => l.id === id))
    .filter((l) => l !== undefined)
    .map((l) => ({ id: l.id, title: l.title, keyPoint: l.keyPoint }));
  return { facts, need: 0, lessons };
}
