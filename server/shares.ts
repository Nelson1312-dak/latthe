// Ván chia sẻ: latbai.vn/van/<id>. Ai có link cũng xem được bàn cờ và bảng
// chấm ván. Không gắn với tài khoản nào, khách chưa đăng nhập cũng chia sẻ được.
//
// Không tin dữ liệu gửi lên: PGN phải đọc được và là ván hợp lệ, kết quả chấm
// phải khớp số nước, tên người chơi cắt ngắn và bỏ ký tự lạ.

import { randomBytes } from 'node:crypto';
import { one, type Db } from './db.ts';
import { Game } from '../shared/chess.ts';

export interface ShareMeta {
  white: string;
  black: string;
  /** "1-0", "0-1", "½-½" */
  result: string;
  /** Câu tả kết quả, ví dụ "Trắng thắng · chiếu hết". */
  label: string;
  /** Bên của người chia sẻ, để lật bàn cờ đúng phía. null là hai người một máy. */
  side: 'w' | 'b' | null;
}

export interface Share {
  id: string;
  pgn: string;
  review: unknown;
  meta: ShareMeta;
  views: number;
  createdAt: string;
}

const MAX_PGN = 20_000;
const MAX_REVIEW = 400_000;

const clean = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/** Kiểm dữ liệu gửi lên. Trả về chuỗi lỗi nếu không hợp lệ. */
export function parseShare(body: Record<string, unknown>): { pgn: string; review: string; meta: ShareMeta } | string {
  const pgn = typeof body.pgn === 'string' ? body.pgn.slice(0, MAX_PGN) : '';
  let plies = 0;
  try {
    plies = Game.fromPgn(pgn).length;
  } catch {
    return 'Ván cờ không hợp lệ';
  }
  if (plies < 2) return 'Ván quá ngắn để chia sẻ';

  const review = body.review as { moves?: unknown[] } | undefined;
  if (!review || typeof review !== 'object' || !Array.isArray(review.moves) || review.moves.length !== plies) {
    return 'Kết quả chấm không khớp với ván';
  }
  const json = JSON.stringify(review);
  if (json.length > MAX_REVIEW) return 'Kết quả chấm quá lớn';

  const m = (body.meta ?? {}) as Record<string, unknown>;
  const result = ['1-0', '0-1', '½-½'].includes(m.result as string) ? (m.result as string) : '';
  const side = m.side === 'w' || m.side === 'b' ? m.side : null;
  return {
    pgn,
    review: json,
    meta: {
      white: clean(m.white, 40) || 'Trắng',
      black: clean(m.black, 40) || 'Đen',
      result,
      label: clean(m.label, 80),
      side,
    },
  };
}

export function createShare(db: Db, s: { pgn: string; review: string; meta: ShareMeta }, now = new Date()): string {
  const id = randomBytes(6).toString('base64url');
  db.prepare('INSERT INTO shares (id, pgn, review, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    s.pgn,
    s.review,
    JSON.stringify(s.meta),
    now.toISOString(),
  );
  return id;
}

/** Lấy ván chia sẻ; mỗi lần mở tăng số lượt xem. */
export function getShare(db: Db, id: string): Share | null {
  if (!/^[A-Za-z0-9_-]{6,12}$/.test(id)) return null;
  const r = one<{ id: string; pgn: string; review: string; meta: string; views: number; created_at: string }>(
    db,
    'SELECT * FROM shares WHERE id = ?',
    id,
  );
  if (!r) return null;
  db.prepare('UPDATE shares SET views = views + 1 WHERE id = ?').run(id);
  return {
    id: r.id,
    pgn: r.pgn,
    review: JSON.parse(r.review),
    meta: JSON.parse(r.meta) as ShareMeta,
    views: r.views + 1,
    createdAt: r.created_at,
  };
}
