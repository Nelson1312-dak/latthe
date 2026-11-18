// Bài tập của ngày: cùng ngày cùng bài, chuỗi ngày, chỉ tính lần đầu.
import { describe, expect, it } from 'vitest';
import { createLocalUser, openDb, type Db } from '../server/db.ts';
import { dailyCount, dailyMe, dailyPuzzle, recordDaily } from '../server/daily.ts';

function withPuzzles(): Db {
  const db = openDb(':memory:');
  db.exec(`CREATE TABLE puzzles (
    id TEXT PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL,
    rating INTEGER NOT NULL, themes TEXT NOT NULL, popularity INTEGER NOT NULL)`);
  const p = db.prepare('INSERT INTO puzzles VALUES (?, ?, ?, ?, ?, ?)');
  for (let r = 1000; r <= 1600; r += 5) p.run(`p${r}`, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8 g8g7', r, 'mate', 90);
  return db;
}

describe('dailyPuzzle', () => {
  it('cùng một ngày luôn ra cùng một bài', () => {
    const db = withPuzzles();
    const a = dailyPuzzle(db, '2026-11-20');
    expect(a).not.toBeNull();
    expect(dailyPuzzle(withPuzzles(), '2026-11-20')?.id).toBe(a!.id); // cả khi server khởi động lại
  });

  it('các ngày khác nhau thường ra bài khác nhau, độ khó vừa phải', () => {
    const db = withPuzzles();
    const ids = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const p = dailyPuzzle(db, `2026-12-${String(d).padStart(2, '0')}`)!;
      ids.add(p.id);
      expect(p.rating).toBeGreaterThanOrEqual(1000);
      expect(p.rating).toBeLessThanOrEqual(1600);
    }
    expect(ids.size).toBeGreaterThan(10);
  });
});

describe('chuỗi ngày', () => {
  it('đếm những ngày giải đúng liên tiếp; hôm nay chưa làm thì chưa mất chuỗi', () => {
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'An');
    recordDaily(db, u.id, '2026-11-15', true);
    recordDaily(db, u.id, '2026-11-16', true);
    recordDaily(db, u.id, '2026-11-17', true);
    expect(dailyMe(db, u.id, '2026-11-18')).toEqual({ done: false, correct: false, streak: 3 });
    recordDaily(db, u.id, '2026-11-18', true);
    expect(dailyMe(db, u.id, '2026-11-18')).toEqual({ done: true, correct: true, streak: 4 });
  });

  it('bỏ một ngày hoặc giải sai là chuỗi về 0', () => {
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'An');
    recordDaily(db, u.id, '2026-11-14', true);
    recordDaily(db, u.id, '2026-11-16', true); // bỏ ngày 15
    expect(dailyMe(db, u.id, '2026-11-17').streak).toBe(1);
    recordDaily(db, u.id, '2026-11-17', false);
    expect(dailyMe(db, u.id, '2026-11-17')).toEqual({ done: true, correct: false, streak: 0 });
  });

  it('chỉ tính lần đầu: sai rồi thử lại đúng thì vẫn là sai', () => {
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'An');
    expect(recordDaily(db, u.id, '2026-11-18', false)).toBe(true);
    expect(recordDaily(db, u.id, '2026-11-18', true)).toBe(false);
    expect(dailyMe(db, u.id, '2026-11-18').correct).toBe(false);
    expect(dailyCount(db, '2026-11-18')).toEqual({ tried: 1, solved: 0 });
  });
});
