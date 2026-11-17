// Lưu ván: không tin dữ liệu trình duyệt gửi lên, và không để database phình mãi.
import { describe, expect, it } from 'vitest';
import { openDb, createLocalUser, type Db } from '../server/db.ts';
import { KEEP_GAMES, countMoves, insertGame, listGames, parseNewGame, pruneGames } from '../server/games.ts';

const PGN = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5';

function setup(): { db: Db; userId: number } {
  const db = openDb(':memory:');
  return { db, userId: createLocalUser(db, 'Nelson').id };
}

const sample = (over: Record<string, unknown> = {}) => ({
  mode: 'bot',
  level: 3,
  playerSide: 'w',
  pgn: PGN,
  winner: 'b',
  reason: 'checkmate',
  ...over,
});

describe('parseNewGame', () => {
  it('nhận dữ liệu hợp lệ', () => {
    expect(parseNewGame(sample())).toEqual({
      mode: 'bot',
      level: 3,
      playerSide: 'w',
      pgn: PGN,
      winner: 'b',
      reason: 'checkmate',
    });
  });

  it('từ chối khi thiếu hoặc sai kiểu', () => {
    expect(parseNewGame(sample({ pgn: '' }))).toBeNull();
    expect(parseNewGame(sample({ pgn: '   ' }))).toBeNull();
    expect(parseNewGame(sample({ mode: 'hack' }))).toBeNull();
    expect(parseNewGame(sample({ winner: 'x' }))).toBeNull();
    expect(parseNewGame(sample({ playerSide: 'z' }))).toBeNull();
    expect(parseNewGame({})).toBeNull();
  });

  it('cấp độ không phải số nguyên thì bỏ qua', () => {
    expect(parseNewGame(sample({ level: 'ba' }))?.level).toBeNull();
    expect(parseNewGame(sample({ level: 2.5 }))?.level).toBeNull();
    expect(parseNewGame(sample({ level: undefined }))?.level).toBeNull();
  });

  it('cắt ngắn lý do kết thúc để không ai nhét cả quyển sách vào', () => {
    const long = 'x'.repeat(500);
    expect(parseNewGame(sample({ reason: long }))?.reason).toHaveLength(40);
  });
});

describe('countMoves', () => {
  it('đếm theo số nước, không phải số lượt', () => {
    expect(countMoves(PGN)).toBe(3);
    expect(countMoves('1. f3 e5 2. g4 Qh4#')).toBe(2);
    expect(countMoves('')).toBe(0);
  });
});

describe('lưu và dọn ván', () => {
  it('lưu rồi đọc lại ra đúng ván', () => {
    const { db, userId } = setup();
    insertGame(db, userId, parseNewGame(sample())!);
    const [g] = listGames(db, userId);
    expect(g).toMatchObject({ mode: 'bot', level: 3, winner: 'b', reason: 'checkmate', moveCount: 3 });
    db.close();
  });

  it('chỉ giữ 20 ván gần nhất', () => {
    const { db, userId } = setup();
    for (let i = 0; i < KEEP_GAMES + 7; i++) {
      insertGame(db, userId, parseNewGame(sample())!, new Date(Date.now() + i * 1000));
    }
    expect(db.prepare('SELECT count(*) c FROM games').get()).toMatchObject({ c: KEEP_GAMES });
    db.close();
  });

  it('dọn ván của người này không đụng ván người khác', () => {
    const { db, userId } = setup();
    const other = createLocalUser(db, 'Hùng').id;
    for (let i = 0; i < 3; i++) insertGame(db, other, parseNewGame(sample())!, new Date(Date.now() + i * 1000));
    for (let i = 0; i < KEEP_GAMES + 5; i++) {
      insertGame(db, userId, parseNewGame(sample())!, new Date(Date.now() + i * 1000));
    }
    expect(listGames(db, other)).toHaveLength(3);
    expect(listGames(db, userId)).toHaveLength(KEEP_GAMES);
    db.close();
  });

  it('ván mới nhất đứng đầu danh sách', () => {
    const { db, userId } = setup();
    insertGame(db, userId, parseNewGame(sample({ reason: 'cu' }))!, new Date('2026-01-01'));
    insertGame(db, userId, parseNewGame(sample({ reason: 'moi' }))!, new Date('2026-06-01'));
    expect(listGames(db, userId)[0].reason).toBe('moi');
    db.close();
  });

  it('xoá người thì ván của họ đi theo', () => {
    const { db, userId } = setup();
    insertGame(db, userId, parseNewGame(sample())!);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    expect(db.prepare('SELECT count(*) c FROM games').get()).toMatchObject({ c: 0 });
    db.close();
  });

  it('chưa có ván nào thì dọn không làm gì', () => {
    const { db, userId } = setup();
    expect(pruneGames(db, userId)).toBe(0);
    db.close();
  });
});
