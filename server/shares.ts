// Ván chia sẻ: latbai.vn/van/<id>. Ai có link cũng xem được bàn cờ và bảng
// chấm ván. Không gắn với tài khoản nào, khách chưa đăng nhập cũng chia sẻ được.
//
// Không tin dữ liệu gửi lên: PGN phải đọc được và là ván hợp lệ, kết quả chấm
// phải khớp số nước, tên người chơi cắt ngắn và bỏ ký tự lạ.

import { randomBytes } from 'node:crypto';
import { one, type Db } from './db.ts';
import { Game, START_FEN } from '../shared/chess.ts';

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
  let history: readonly { san: string; fen: string }[] = [];
  try {
    history = Game.fromPgn(pgn).history;
  } catch {
    return 'Ván cờ không hợp lệ';
  }
  const plies = history.length;
  if (plies < 2) return 'Ván quá ngắn để chia sẻ';

  const review = body.review as { moves?: unknown[]; accuracy?: unknown } | undefined;
  if (!review || typeof review !== 'object' || !Array.isArray(review.moves) || review.moves.length !== plies) {
    return 'Kết quả chấm không khớp với ván';
  }
  // Ai mở link cũng phải vẽ được trang: từng nước phải đủ trường và khớp đúng ván.
  // Không kiểm thì một kết quả chấm méo mó (cố ý hay không) làm hỏng trang người xem.
  const acc = review.accuracy as { w?: unknown; b?: unknown } | undefined;
  if (!acc || typeof acc.w !== 'number' || typeof acc.b !== 'number') return 'Kết quả chấm không hợp lệ';
  for (let i = 0; i < plies; i++) {
    if (!validMove(review.moves[i], i, history[i].san)) return 'Kết quả chấm không hợp lệ';
  }
  // Thế cờ trước/sau mỗi nước: server tự tính lại từ ván, không tin dữ liệu gửi lên
  for (let i = 0; i < plies; i++) {
    const m = review.moves[i] as Record<string, unknown>;
    m.fenBefore = i === 0 ? START_FEN : history[i - 1].fen;
    m.fenAfter = history[i].fen;
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

const CLASSES = new Set(['book', 'best', 'good', 'inaccuracy', 'mistake', 'blunder', 'miss']);
const isScore = (v: unknown) => {
  const o = v as { cp?: unknown; mate?: unknown } | null;
  return Boolean(o) && typeof o === 'object' && (typeof o!.cp === 'number' || typeof o!.mate === 'number');
};

/** Một nước trong kết quả chấm: đủ trường cần để vẽ, và đúng là nước thứ i của ván. */
function validMove(v: unknown, i: number, san: string): boolean {
  const m = v as Record<string, unknown> | null;
  if (!m || typeof m !== 'object') return false;
  return (
    m.ply === i + 1 &&
    m.san === san &&
    typeof m.uci === 'string' &&
    /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.uci) &&
    (m.side === 'w' || m.side === 'b') &&
    typeof m.fenBefore === 'string' &&
    typeof m.fenAfter === 'string' &&
    isScore(m.scoreBefore) &&
    isScore(m.scoreAfter) &&
    Array.isArray(m.best) &&
    m.best.every((b) => b && typeof b === 'object' && typeof (b as { uci?: unknown }).uci === 'string' && typeof (b as { san?: unknown }).san === 'string' && isScore((b as { score?: unknown }).score)) &&
    typeof m.cls === 'string' &&
    CLASSES.has(m.cls) &&
    typeof m.accuracy === 'number'
  );
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
