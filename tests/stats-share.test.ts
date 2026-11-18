// Thống kê ẩn danh và ván chia sẻ.
import { describe, expect, it } from 'vitest';
import { createLocalUser, openDb, upsertGoogleUser } from '../server/db.ts';
import { insertGame, parseNewGame } from '../server/games.ts';
import { bump, statsFor, vnDay } from '../server/stats.ts';
import { createShare, getShare, parseShare } from '../server/shares.ts';

const NOW = new Date('2026-11-18T05:00:00Z'); // 12 giờ trưa giờ Việt Nam

describe('vnDay', () => {
  it('tính ngày theo giờ Việt Nam (UTC+7)', () => {
    expect(vnDay('2026-11-17T16:59:00Z')).toBe('2026-11-17'); // 23:59 tối 17
    expect(vnDay('2026-11-17T17:00:00Z')).toBe('2026-11-18'); // 0:00 sáng 18
  });
});

describe('statsFor', () => {
  it('cộng lượt đếm theo ngày, đủ số ngày, cũ trước mới sau', () => {
    const db = openDb(':memory:');
    bump(db, 'visit', NOW);
    bump(db, 'visit', NOW);
    bump(db, 'play_start', NOW);
    const s = statsFor(db, 7, NOW);
    expect(s.days).toHaveLength(7);
    expect(s.days.at(-1)!.day).toBe('2026-11-18');
    expect(s.days.at(-1)!.visit).toBe(2);
    expect(s.days.at(-1)!.play_start).toBe(1);
    expect(s.days[0].visit).toBe(0);
  });

  it('chỉ tính ván của tài khoản Google thật; tách ván với AI khỏi ván với người', () => {
    const db = openDb(':memory:');
    const thật = upsertGoogleUser(db, 'sub-1', 'Hiên');
    const thử = createLocalUser(db, 'Thử');
    const ván = (userId: number, o: Record<string, unknown>) =>
      insertGame(
        db,
        userId,
        { ...(parseNewGame({ mode: 'bot', level: 2, playerSide: 'w', pgn: '1. e4 e5', winner: 'w', reason: 'resign' }) as object), ...o } as never,
        NOW,
      );
    ván(thật.id, {});
    ván(thật.id, { mode: 'online', level: null, opponentName: 'Steady (AI)' });
    ván(thật.id, { mode: 'online', level: null, opponentName: 'An' });
    ván(thử.id, {});
    const d = statsFor(db, 7, NOW).days.at(-1)!;
    expect(d.games_bot).toBe(1);
    expect(d.games_ai).toBe(1);
    expect(d.games_online).toBe(1);
    expect(statsFor(db, 7, NOW).users.total).toBe(1);
  });
});

describe('ván chia sẻ', () => {
  /** Kết quả chấm thật (đúng cấu trúc app gửi lên) cho ván 1. e4 e5. */
  const move = (ply: number, san: string, uci: string, side: 'w' | 'b') => ({
    ply,
    san,
    uci,
    side,
    fenBefore: 'x',
    fenAfter: 'y',
    scoreBefore: { cp: 20 },
    scoreAfter: { cp: 30 },
    best: [{ uci, san, score: { cp: 30 } }],
    cls: 'book',
    accuracy: 100,
  });
  const review = { moves: [move(1, 'e4', 'e2e4', 'w'), move(2, 'e5', 'e7e5', 'b')], accuracy: { w: 90, b: 80 }, opening: null };

  it('nhận ván hợp lệ, làm sạch tên người chơi', () => {
    const s = parseShare({ pgn: '1. e4 e5', review, meta: { white: '<b>Hiên</b>', black: 'Steady (AI)', result: '1-0', side: 'w' } });
    expect(typeof s).toBe('object');
    if (typeof s === 'string') return;
    expect(s.meta.white).toBe('bHiên/b');
    expect(s.meta.side).toBe('w');
  });

  it('từ chối PGN hỏng, ván quá ngắn, kết quả chấm không khớp số nước', () => {
    expect(parseShare({ pgn: '1. e4 e9', review })).toBe('Ván cờ không hợp lệ');
    expect(parseShare({ pgn: '1. e4', review: { moves: [{}] } })).toBe('Ván quá ngắn để chia sẻ');
    expect(parseShare({ pgn: '1. e4 e5 2. Nf3', review })).toBe('Kết quả chấm không khớp với ván');
  });

  it('từ chối kết quả chấm méo mó (để link chia sẻ không làm hỏng trang người xem)', () => {
    const méo = (f: (m: Record<string, unknown>) => void) => {
      const r = structuredClone(review) as { moves: Record<string, unknown>[] };
      f(r.moves[1]);
      return parseShare({ pgn: '1. e4 e5', review: r });
    };
    expect(parseShare({ pgn: '1. e4 e5', review: { moves: [{}, {}], accuracy: { w: 1, b: 1 } } })).toBe('Kết quả chấm không hợp lệ');
    expect(méo((m) => (m.san = 'd5'))).toBe('Kết quả chấm không hợp lệ'); // không khớp ván
    expect(méo((m) => (m.cls = 'hack'))).toBe('Kết quả chấm không hợp lệ');
    expect(méo((m) => delete m.scoreAfter)).toBe('Kết quả chấm không hợp lệ');
    expect(méo((m) => (m.uci = '<script>'))).toBe('Kết quả chấm không hợp lệ');
  });

  it('tạo rồi mở lại được; mỗi lần mở tăng lượt xem; id lạ thì không có', () => {
    const db = openDb(':memory:');
    const s = parseShare({ pgn: '1. e4 e5', review, meta: {} });
    if (typeof s === 'string') throw new Error(s);
    const id = createShare(db, s, NOW);
    expect(getShare(db, id)!.views).toBe(1);
    expect(getShare(db, id)!.views).toBe(2);
    expect(getShare(db, id)!.meta.white).toBe('Trắng');
    expect(getShare(db, 'không-có')).toBeNull();
    expect(getShare(db, "x' OR 1=1")).toBeNull();
  });
});
