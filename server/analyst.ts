// Người chấm ván ở máy chủ: chạy nền trên máy nhà, chấm mọi ván đã lưu của mọi
// người dùng mà trình duyệt chưa chấm (ván cũ, ván đóng trang trước khi chấm
// xong, ván online người chơi không mở lại), rồi tính tóm tắt lỗi từng ván
// (bảng game_insights) cho Huấn luyện viên (AI) đọc.
//
// Cùng thông số với trình duyệt (300ms/thế cờ, 2 dòng) nên kết quả như nhau.
// Mỗi lần một ván, nghỉ giữa các ván; engine riêng, không làm bot đứng chờ.

import { readFileSync } from 'node:fs';
import { reviewGame, type Analyser } from '../src/analysis/review.ts';
import { setOpenings } from '../src/analysis/openings.ts';
import { Game } from '../shared/chess.ts';
import type { Score } from '../shared/winrate.ts';
import { gameInsight, type CoachMove } from '../shared/coach.ts';
import { analysisEngine } from './live/bot-engine.ts';
import { getReview, makeCards, saveReview, type StoredReview } from './reviews.ts';
import { all, one, type Db } from './db.ts';

const MS = 300;
const PV = 2;
/** Ván vừa xong chưa tới ngần này thì để trình duyệt chấm (nó đã chấm ngầm gần xong). */
const NHƯỜNG_TRÌNH_DUYỆT_MS = 3 * 60_000;
/** Nghỉ giữa hai lần làm việc. */
const NHỊP_MS = 4_000;

/** Điểm engine (theo bên đang đi, chiếu hết quy ra ±100000) → điểm theo Trắng. */
function whitePov(cp: number, turn: 'w' | 'b'): Score {
  const s = turn === 'w' ? 1 : -1;
  if (cp >= 90_000) return { mate: s * (100_000 - cp) };
  if (cp <= -90_000) return { mate: -s * (cp + 100_000) };
  return { cp: s * cp };
}

/** Bộ chấm cho reviewGame, chạy Stockfish trên máy chủ. */
export const serverAnalyser: Analyser = {
  async analyse(fen) {
    const g = new Game(fen);
    // Hết cờ: không có nước nào để engine nói; tự ghi kết quả cho đúng
    const o = g.outcome();
    if (o) {
      if (o.winner === 'draw') return { lines: [] };
      return { lines: [{ uci: '', score: { mate: o.winner === 'w' ? 1 : -1 } }] };
    }
    const cands = await analysisEngine().search(fen, { movetimeMs: MS, multipv: PV });
    return { lines: cands.map((c) => ({ uci: c.uci, score: whitePov(c.cp, g.turn) })) };
  },
};

/** Tính (lại) tóm tắt lỗi của một ván đã chấm. */
export function saveInsight(db: Db, gameId: number): void {
  const g = one<{ user_id: number; mode: string; player_side: string; winner: string; created_at: string }>(
    db,
    'SELECT user_id, mode, player_side, winner, created_at FROM games WHERE id = ?',
    gameId,
  );
  const r = getReview(db, gameId);
  if (!g || !r || (g.player_side !== 'w' && g.player_side !== 'b')) return;
  const ins = gameInsight(
    { side: g.player_side, winner: g.winner as 'w' | 'b' | 'draw', moves: r.moves as unknown as CoachMove[] },
    gameId,
  );
  db.prepare(
    `INSERT INTO game_insights (game_id, user_id, mode, side, winner, data, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET data = excluded.data`,
  ).run(gameId, g.user_id, g.mode, g.player_side, g.winner, JSON.stringify(ins), g.created_at);
}

/** Bao nhiêu ván của người này đang chờ máy chủ chấm. */
export function pendingFor(db: Db, userId: number): number {
  return (
    one<{ c: number }>(
      db,
      `SELECT count(*) c FROM games g LEFT JOIN reviews r ON r.game_id = g.id
        WHERE g.user_id = ? AND r.game_id IS NULL AND g.move_count >= 2`,
      userId,
    )?.c ?? 0
  );
}

let chạy = false;
const hỏng = new Set<number>();

/** Một nhịp: bù tóm tắt còn thiếu, rồi chấm MỘT ván chưa chấm (mới nhất trước). */
export async function analystStep(db: Db, now = Date.now()): Promise<'idle' | 'insights' | number> {
  if (chạy) return 'idle';
  chạy = true;
  try {
    const thiếu = all<{ game_id: number }>(
      db,
      `SELECT r.game_id FROM reviews r LEFT JOIN game_insights i ON i.game_id = r.game_id
        WHERE i.game_id IS NULL LIMIT 200`,
    );
    for (const x of thiếu) saveInsight(db, x.game_id);

    const bỏQua = [...hỏng].join(',') || '0';
    const g = one<{ id: number; user_id: number; pgn: string; player_side: string }>(
      db,
      `SELECT g.id, g.user_id, g.pgn, g.player_side FROM games g LEFT JOIN reviews r ON r.game_id = g.id
        WHERE r.game_id IS NULL AND g.move_count >= 2 AND g.created_at < ? AND g.id NOT IN (${bỏQua})
        ORDER BY g.id DESC LIMIT 1`,
      new Date(now - NHƯỜNG_TRÌNH_DUYỆT_MS).toISOString(),
    );
    if (!g) return thiếu.length ? 'insights' : 'idle';
    try {
      const result = await reviewGame(g.pgn, serverAnalyser, { multipv: PV });
      // Trình duyệt có thể đã gửi kết quả lên trong lúc mình chấm: giữ của nó
      if (!getReview(db, g.id)) {
        saveReview(db, g.id, result as unknown as StoredReview);
        makeCards(db, g.user_id, g.id, result as unknown as StoredReview, g.player_side === 'b' ? 'b' : 'w');
      }
      saveInsight(db, g.id);
    } catch (err) {
      hỏng.add(g.id);
      console.error(`[chấm ván] ván ${g.id} lỗi:`, (err as Error).message);
    }
    return g.id;
  } finally {
    chạy = false;
  }
}

/** Bật người chấm nền (gọi một lần khi server chạy). */
export function startAnalyst(db: Db): void {
  try {
    setOpenings(JSON.parse(readFileSync('public/data/openings.json', 'utf8')) as Record<string, [string, string]>);
  } catch (err) {
    console.warn('[chấm ván] không đọc được bảng khai cuộc:', (err as Error).message);
  }
  const vòng = async () => {
    try {
      await analystStep(db);
    } catch (err) {
      console.error('[chấm ván]', (err as Error).message);
    }
    setTimeout(() => void vòng(), NHỊP_MS).unref();
  };
  setTimeout(() => void vòng(), 10_000).unref();
}
