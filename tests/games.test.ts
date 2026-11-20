// Lưu ván: không tin dữ liệu trình duyệt gửi lên, và không để database phình mãi.
import { describe, expect, it } from 'vitest';
import { openDb, createLocalUser, type Db } from '../server/db.ts';
import { KEEP_GAMES, KEEP_ONLINE, countMoves, insertGame, listGames, parseNewGame, pruneGames } from '../server/games.ts';

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

  it('lý do kết thúc chỉ nhận mã ngắn: dài quá hay có ký tự lạ thì thành unknown', () => {
    expect(parseNewGame(sample({ reason: 'x'.repeat(500) }))?.reason).toBe('unknown');
    expect(parseNewGame(sample({ reason: '<b>' }))?.reason).toBe('unknown');
    expect(parseNewGame(sample({ reason: 'fifty-move' }))?.reason).toBe('fifty-move');
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

  it('ván online chỉ giữ 5, và đếm riêng với ván đánh máy', () => {
    const { db, userId } = setup();
    const online = (i: number) =>
      insertGame(
        db,
        userId,
        {
          mode: 'online' as const,
          level: null,
          playerSide: 'w' as const,
          pgn: '1. e4 e5 2. Nf3',
          winner: 'w' as const,
          reason: 'resign',
          opponentName: `Hùng ${i}`,
          opponentRating: 1200,
          ratingBefore: 1000,
          ratingAfter: 1008,
        },
        new Date(Date.now() + i * 1000),
      );

    for (let i = 0; i < KEEP_ONLINE + 4; i++) online(i);
    // Chơi thêm thật nhiều ván với máy: không được đẩy ván online đi mất
    for (let i = 0; i < KEEP_GAMES + 3; i++) {
      insertGame(db, userId, parseNewGame(sample())!, new Date(Date.now() + 100_000 + i * 1000));
    }

    const ds = listGames(db, userId, 100);
    expect(ds.filter((g) => g.mode === 'online')).toHaveLength(KEEP_ONLINE);
    expect(ds.filter((g) => g.mode !== 'online')).toHaveLength(KEEP_GAMES);
    // Giữ đúng 5 ván MỚI nhất
    const giữ = ds.filter((g) => g.mode === 'online').map((g) => g.opponentName);
    expect(giữ).toEqual(['Hùng 8', 'Hùng 7', 'Hùng 6', 'Hùng 5', 'Hùng 4']);
    db.close();
  });

  it('ván online nhớ đối thủ và Elo trước/sau', () => {
    const { db, userId } = setup();
    insertGame(db, userId, {
      mode: 'online',
      level: null,
      playerSide: 'b',
      pgn: '1. e4 e5',
      winner: 'b',
      reason: 'checkmate',
      opponentName: 'Minh',
      opponentRating: 1310,
      ratingBefore: 1200,
      ratingAfter: 1216,
    });
    expect(listGames(db, userId)[0]).toMatchObject({
      mode: 'online',
      opponentName: 'Minh',
      opponentRating: 1310,
      ratingBefore: 1200,
      ratingAfter: 1216,
    });
    db.close();
  });

  it('trình duyệt không tự khai được ván online', () => {
    // Ván online do server lưu sau khi trọng tài xong; nhận 'online' từ trình
    // duyệt là mở đường cho người ta tự cộng Elo cho mình.
    expect(parseNewGame({ ...sample(), mode: 'online' })).toBeNull();
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
