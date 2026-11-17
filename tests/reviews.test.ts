// Lưu kết quả chấm ván và sinh thẻ ôn tập.
import { describe, expect, it } from 'vitest';
import { createLocalUser, openDb, type Db } from '../server/db.ts';
import { insertGame, parseNewGame } from '../server/games.ts';
import {
  BOX_DAYS,
  MAX_BOX,
  answerCard,
  countCards,
  dueCards,
  getReview,
  makeCards,
  parseReview,
  pruneCards,
  saveReview,
  type StoredReview,
} from '../server/reviews.ts';

function setup(): { db: Db; userId: number; gameId: number } {
  const db = openDb(':memory:');
  const userId = createLocalUser(db, 'Nelson').id;
  const gameId = insertGame(
    db,
    userId,
    parseNewGame({ mode: 'bot', level: 3, playerSide: 'w', pgn: '1. e4 e5', winner: 'b', reason: 'checkmate' })!,
  );
  return { db, userId, gameId };
}

const move = (over: Partial<StoredReview['moves'][number]> = {}) => ({
  ply: 1,
  san: 'Qg4',
  uci: 'f3g4',
  side: 'w' as const,
  fenBefore: 'r2qk2r/ppp2p2/3p1n1p/2b1p1p1/2BnP3/2NP1QBP/PPP2PP1/R3K2R w KQkq - 1 11',
  cls: 'blunder',
  accuracy: 12.3,
  scoreAfter: { cp: -709 },
  best: [{ uci: 'f3d1', san: 'Qd1' }],
  ...over,
});

const review = (over: Partial<StoredReview> = {}): StoredReview => ({
  moves: [move()],
  accuracy: { w: 90.6, b: 96.1 },
  opening: { eco: 'C55', name: 'Italian Game: Two Knights Defense', ply: 6 },
  ...over,
});

describe('parseReview', () => {
  it('nhận kết quả hợp lệ', () => {
    expect(parseReview(review())?.accuracy).toEqual({ w: 90.6, b: 96.1 });
  });

  it('từ chối dữ liệu sai dạng', () => {
    expect(parseReview(null)).toBeNull();
    expect(parseReview({})).toBeNull();
    expect(parseReview({ moves: [], accuracy: { w: 'a', b: 1 } })).toBeNull();
    expect(parseReview({ moves: [{ ply: 1 }], accuracy: { w: 1, b: 1 } })).toBeNull();
    expect(parseReview({ moves: [move({ side: 'x' as never })], accuracy: { w: 1, b: 1 } })).toBeNull();
  });

  it('từ chối ván dài vô lý', () => {
    expect(parseReview({ moves: Array.from({ length: 601 }, () => move()), accuracy: { w: 1, b: 1 } })).toBeNull();
  });
});

describe('lưu kết quả chấm', () => {
  it('lưu rồi đọc lại', () => {
    const { db, gameId } = setup();
    saveReview(db, gameId, review());
    expect(getReview(db, gameId)?.accuracy.w).toBe(90.6);
    db.close();
  });

  it('chấm lại thì ghi đè, không tạo bản thứ hai', () => {
    const { db, gameId } = setup();
    saveReview(db, gameId, review());
    saveReview(db, gameId, review({ accuracy: { w: 50, b: 50 } }));
    expect(db.prepare('SELECT count(*) c FROM reviews').get()).toMatchObject({ c: 1 });
    expect(getReview(db, gameId)?.accuracy.w).toBe(50);
    db.close();
  });

  it('xoá ván thì kết quả chấm đi theo', () => {
    const { db, gameId } = setup();
    saveReview(db, gameId, review());
    db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
    expect(getReview(db, gameId)).toBeNull();
    db.close();
  });

  it('chưa chấm thì không có gì', () => {
    const { db, gameId } = setup();
    expect(getReview(db, gameId)).toBeNull();
    db.close();
  });
});

describe('sinh thẻ ôn tập', () => {
  it('chỉ lấy nước sai của chính người chơi', () => {
    const { db, userId, gameId } = setup();
    const r = review({
      moves: [
        move({ side: 'w', cls: 'blunder' }),
        move({ side: 'b', cls: 'blunder', fenBefore: 'khac-1' }), // của đối thủ
        move({ side: 'w', cls: 'good', fenBefore: 'khac-2' }), // nước tốt
      ],
    });
    expect(makeCards(db, userId, gameId, r, 'w')).toBe(1);
    db.close();
  });

  it('cầm Đen thì lấy nước sai của Đen', () => {
    const { db, userId, gameId } = setup();
    const r = review({ moves: [move({ side: 'w' }), move({ side: 'b', fenBefore: 'khac' })] });
    expect(makeCards(db, userId, gameId, r, 'b')).toBe(1);
    expect(dueCards(db, userId, 20, new Date(Date.now() + 2 * 86400_000))[0].fen).toBe('khac');
    db.close();
  });

  it('cùng một thế cờ không tạo hai thẻ', () => {
    const { db, userId, gameId } = setup();
    makeCards(db, userId, gameId, review(), 'w');
    expect(makeCards(db, userId, gameId, review(), 'w')).toBe(0);
    expect(countCards(db, userId).total).toBe(1);
    db.close();
  });

  it('không có nước tốt hơn thì không tạo thẻ (không biết dạy gì)', () => {
    const { db, userId, gameId } = setup();
    expect(makeCards(db, userId, gameId, review({ moves: [move({ best: [] })] }), 'w')).toBe(0);
    db.close();
  });

  it('thẻ mới hẹn gặp lại sau 1 ngày', () => {
    const { db, userId, gameId } = setup();
    const now = new Date('2026-11-17T00:00:00Z');
    makeCards(db, userId, gameId, review(), 'w', now);
    expect(dueCards(db, userId, 20, now)).toHaveLength(0); // chưa đến hạn
    expect(dueCards(db, userId, 20, new Date('2026-11-18T01:00:00Z'))).toHaveLength(1);
    db.close();
  });
});

describe('trả lời thẻ', () => {
  it('đúng thì lên hộp, hẹn xa hơn', () => {
    const { db, userId, gameId } = setup();
    makeCards(db, userId, gameId, review(), 'w');
    const [card] = dueCards(db, userId, 20, new Date(Date.now() + 2 * 86400_000));
    const after = answerCard(db, userId, card.id, true);
    expect(after?.box).toBe(2);
    expect(new Date(after!.due_at).getTime() - Date.now()).toBeGreaterThan(BOX_DAYS[1] * 86400_000 * 0.9);
    db.close();
  });

  it('sai thì về hộp 1 và đếm số lần sai', () => {
    const { db, userId, gameId } = setup();
    makeCards(db, userId, gameId, review(), 'w');
    const [card] = dueCards(db, userId, 20, new Date(Date.now() + 2 * 86400_000));
    answerCard(db, userId, card.id, true);
    answerCard(db, userId, card.id, true);
    const after = answerCard(db, userId, card.id, false);
    expect(after?.box).toBe(1);
    expect(after?.wrong_count).toBe(1);
    db.close();
  });

  it('không lên quá hộp cuối', () => {
    const { db, userId, gameId } = setup();
    makeCards(db, userId, gameId, review(), 'w');
    const [card] = dueCards(db, userId, 20, new Date(Date.now() + 2 * 86400_000));
    for (let i = 0; i < 10; i++) answerCard(db, userId, card.id, true);
    expect(answerCard(db, userId, card.id, true)?.box).toBe(MAX_BOX);
    db.close();
  });

  it('không trả lời được thẻ của người khác', () => {
    const { db, userId, gameId } = setup();
    const other = createLocalUser(db, 'Hùng').id;
    makeCards(db, userId, gameId, review(), 'w');
    const [card] = dueCards(db, userId, 20, new Date(Date.now() + 2 * 86400_000));
    expect(answerCard(db, other, card.id, true)).toBeNull();
    db.close();
  });
});

describe('giới hạn số thẻ', () => {
  it('vượt hạn thì bỏ thẻ đã thuộc nhất trước', () => {
    const { db, userId, gameId } = setup();
    const moves = Array.from({ length: 30 }, (_, i) => move({ fenBefore: `the-co-${i}` }));
    makeCards(db, userId, gameId, review({ moves }), 'w');
    // Cho vài thẻ lên hộp cao rồi siết giới hạn xuống 10
    const cards = dueCards(db, userId, 50, new Date(Date.now() + 2 * 86400_000));
    for (const c of cards.slice(0, 5)) for (let i = 0; i < 4; i++) answerCard(db, userId, c.id, true);
    pruneCards(db, userId, 10);
    const left = db.prepare('SELECT box FROM cards WHERE user_id = ?').all(userId) as { box: number }[];
    expect(left).toHaveLength(10);
    expect(left.every((c) => c.box === 1)).toBe(true); // thẻ hộp cao bị bỏ trước
    db.close();
  });
});
