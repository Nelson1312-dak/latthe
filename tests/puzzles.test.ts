// Lấy bài tập và tính độ khó của người học.
import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalUser, openDb, type Db } from '../server/db.ts';
import {
  kFactor,
  newRating,
  pickPuzzle,
  puzzleCount,
  puzzleStats,
  recentAttemptIds,
  recordAttempt,
  resetPuzzleCount,
  themeCounts,
} from '../server/puzzles.ts';

/** Kho bài giả: bảng puzzles do script nạp tạo, nên test tự dựng lấy. */
function withPuzzles(db: Db, rows: { id: string; rating: number; themes: string }[]): void {
  db.exec(`CREATE TABLE puzzles (
    id TEXT PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL,
    rating INTEGER NOT NULL, themes TEXT NOT NULL, popularity INTEGER NOT NULL)`);
  db.exec('CREATE TABLE puzzle_themes (theme TEXT NOT NULL, puzzle_id TEXT NOT NULL, rating INTEGER NOT NULL)');
  const p = db.prepare('INSERT INTO puzzles VALUES (?, ?, ?, ?, ?, ?)');
  const t = db.prepare('INSERT INTO puzzle_themes VALUES (?, ?, ?)');
  for (const r of rows) {
    p.run(r.id, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8 g8g7', r.rating, r.themes, 90);
    for (const theme of r.themes.split(' ')) t.run(theme, r.id, r.rating);
  }
}

let db: Db;
let userId: number;
beforeEach(() => {
  db = openDb(':memory:');
  userId = createLocalUser(db, 'Nelson').id;
  resetPuzzleCount(); // số bài được nhớ một phút, test nào cũng phải bắt đầu sạch
});

describe('lấy bài tập', () => {
  it('chưa nạp kho thì không ngã, chỉ không có bài', () => {
    expect(puzzleCount(db)).toBe(0);
    expect(pickPuzzle(db, { rating: 1000 })).toBeNull();
    expect(themeCounts(db)).toEqual([]);
  });

  it('lấy bài gần mức khó của người học', () => {
    withPuzzles(db, [
      { id: 'de', rating: 700, themes: 'fork' },
      { id: 'vua', rating: 1200, themes: 'fork' },
      { id: 'kho', rating: 1800, themes: 'fork' },
    ]);
    // random cố định ở giữa khoảng -> đúng mức yêu cầu
    const p = pickPuzzle(db, { rating: 1200, random: () => 0.5 });
    expect(p?.id).toBe('vua');
  });

  it('lọc theo chủ đề', () => {
    withPuzzles(db, [
      { id: 'a', rating: 1000, themes: 'fork' },
      { id: 'b', rating: 1000, themes: 'backRankMate' },
    ]);
    expect(pickPuzzle(db, { rating: 1000, theme: 'backRankMate', random: () => 0.5 })?.id).toBe('b');
  });

  it('không đưa lại bài vừa làm', () => {
    withPuzzles(db, [
      { id: 'a', rating: 1000, themes: 'fork' },
      { id: 'b', rating: 1010, themes: 'fork' },
    ]);
    const p = pickPuzzle(db, { rating: 1000, exclude: ['a'], random: () => 0.5 });
    expect(p?.id).toBe('b');
  });

  it('cùng một chủ đề và mức khó vẫn ra nhiều bài khác nhau', () => {
    // Nếu lấy "bài gần mốc nhất" thì lần nào cũng đúng một bài, học chán ngay.
    withPuzzles(
      db,
      Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, rating: 980 + (i % 20), themes: 'fork' })),
    );
    const ra = new Set<string>();
    for (let i = 0; i < 30; i++) ra.add(pickPuzzle(db, { rating: 1000, theme: 'fork' })?.id ?? '');
    expect(ra.size).toBeGreaterThan(5);
  });

  it('nhớ số bài trong kho, nạp thêm thì phải quên đi mới thấy', () => {
    withPuzzles(db, [{ id: 'a', rating: 1000, themes: 'fork' }]);
    expect(puzzleCount(db)).toBe(1);
    db.prepare('INSERT INTO puzzles VALUES (?, ?, ?, ?, ?, ?)').run('b', '8/8/8/8/8/8/8/K6k w - - 0 1', 'a1a2', 1000, 'fork', 90);
    expect(puzzleCount(db)).toBe(1); // vẫn là con số đã nhớ
    resetPuzzleCount();
    expect(puzzleCount(db)).toBe(2);
  });

  it('tách nước đi: nước đầu là của đối phương', () => {
    withPuzzles(db, [{ id: 'a', rating: 1000, themes: 'fork' }]);
    const p = pickPuzzle(db, { rating: 1000, random: () => 0.5 });
    expect(p?.moves).toEqual(['d1d8', 'g8g7']);
    expect(p?.themes).toEqual(['fork']);
  });

  it('đếm bài theo chủ đề', () => {
    withPuzzles(db, [
      { id: 'a', rating: 1000, themes: 'fork pin' },
      { id: 'b', rating: 1000, themes: 'fork' },
    ]);
    expect(themeCounts(db)).toEqual([
      { theme: 'fork', count: 2 },
      { theme: 'pin', count: 1 },
    ]);
  });
});

describe('độ khó của người học', () => {
  it('giải đúng bài khó thì lên nhiều, bài dễ thì lên ít', () => {
    const lenNhieu = newRating(1000, 1400, true, 0) - 1000;
    const lenIt = newRating(1000, 700, true, 0) - 1000;
    expect(lenNhieu).toBeGreaterThan(lenIt);
    expect(lenIt).toBeGreaterThan(0);
  });

  it('sai bài dễ thì tụt nhiều hơn sai bài khó', () => {
    const tutNhieu = 1000 - newRating(1000, 700, false, 0);
    const tutIt = 1000 - newRating(1000, 1400, false, 0);
    expect(tutNhieu).toBeGreaterThan(tutIt);
  });

  it('lúc mới tập thì nhảy nhanh hơn', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(30));
    expect(kFactor(30)).toBeGreaterThan(kFactor(100));
    expect(newRating(1000, 1000, true, 0) - 1000).toBeGreaterThan(newRating(1000, 1000, true, 100) - 1000);
  });

  it('thua bài quá khó thì gần như không mất điểm', () => {
    // Đúng tinh thần Elo: thua người mạnh hơn nhiều không phải là điều đáng trách
    expect(420 - newRating(420, 2000, false, 100)).toBeLessThan(1);
  });

  it('không tụt dưới 400 hay vọt quá 2600', () => {
    // Thua liên tục bài ngang sức mới thật sự tụt
    let r = 450;
    for (let i = 0; i < 60; i++) r = newRating(r, r, false, 100);
    expect(r).toBe(400);
    let h = 2500;
    for (let i = 0; i < 60; i++) h = newRating(h, h, true, 100);
    expect(h).toBe(2600);
  });

  it('về đúng mức sau khoảng 30 bài', () => {
    // Người thật sức 1400: giải đúng bài dưới 1400, sai bài trên
    let r = 1000;
    for (let i = 0; i < 30; i++) {
      const puzzle = 1200 + (i % 7) * 100;
      r = newRating(r, puzzle, puzzle <= 1400, i);
    }
    expect(r).toBeGreaterThan(1150);
    expect(r).toBeLessThan(1700);
  });
});

describe('ghi nhận lần làm bài', () => {
  beforeEach(() => withPuzzles(db, [{ id: 'a', rating: 1200, themes: 'fork' }]));

  it('cập nhật độ khó của người học và lưu lại', () => {
    const r1 = recordAttempt(db, userId, 'a', 1200, true);
    expect(r1.rating).toBeGreaterThan(1000);
    expect(r1.attempts).toBe(1);
    const stats = puzzleStats(db, userId);
    expect(stats.rating).toBe(r1.rating);
    expect(stats.attempts).toBe(1);
    expect(stats.correct).toBe(1);
  });

  it('nhớ bài đã làm để không đưa lại', () => {
    recordAttempt(db, userId, 'a', 1200, false);
    expect(recentAttemptIds(db, userId)).toEqual(['a']);
  });

  it('xoá người thì lịch sử làm bài đi theo', () => {
    recordAttempt(db, userId, 'a', 1200, true);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    expect(db.prepare('SELECT count(*) c FROM puzzle_attempts').get()).toMatchObject({ c: 0 });
  });
});

describe('chuỗi ngày luyện', () => {
  const ngay = (lech: number) => new Date(Date.now() - lech * 86400_000);

  it('ba ngày liên tiếp là chuỗi 3', () => {
    withPuzzles(db, [{ id: 'a', rating: 1000, themes: 'fork' }]);
    for (const d of [0, 1, 2]) recordAttempt(db, userId, 'a', 1000, true, ngay(d));
    expect(puzzleStats(db, userId).streak).toBe(3);
  });

  it('hôm nay chưa luyện nhưng hôm qua có thì chuỗi vẫn còn', () => {
    withPuzzles(db, [{ id: 'a', rating: 1000, themes: 'fork' }]);
    for (const d of [1, 2]) recordAttempt(db, userId, 'a', 1000, true, ngay(d));
    expect(puzzleStats(db, userId).streak).toBe(2);
  });

  it('đứt một ngày thì chuỗi tính lại', () => {
    withPuzzles(db, [{ id: 'a', rating: 1000, themes: 'fork' }]);
    for (const d of [0, 3, 4]) recordAttempt(db, userId, 'a', 1000, true, ngay(d));
    expect(puzzleStats(db, userId).streak).toBe(1);
  });

  it('chưa làm bài nào thì chuỗi bằng 0', () => {
    expect(puzzleStats(db, userId).streak).toBe(0);
  });
});
