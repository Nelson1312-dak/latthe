// Database: migration chạy đúng một lần, và dữ liệu sống qua lần mở lại.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalUser, migrate, openDb, upsertGoogleUser, type Db } from '../server/db.ts';
import { createSession, userForSession } from '../server/auth.ts';

const tmpDirs: string[] = [];
function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'chess-test-'));
  tmpDirs.push(dir);
  return join(dir, 'chess.db');
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('migration', () => {
  it('tạo đủ bảng và chỉ chạy một lần', () => {
    const db: Db = openDb(':memory:');
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((r) => r.name)
      .sort();
    expect(names).toEqual(expect.arrayContaining(['migrations', 'sessions', 'users']));
    // Mở sẵn rồi gọi lại: không được chạy lại migration nào.
    expect(migrate(db)).toEqual([]);
    db.close();
  });

  it('bật khoá ngoại: xoá người thì phiên của họ đi theo', () => {
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'Nelson');
    const s = createSession(db, u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    expect(db.prepare('SELECT count(*) c FROM sessions').get()).toMatchObject({ c: 0 });
    expect(userForSession(db, s.token)).toBeNull();
    db.close();
  });
});

describe('dữ liệu sống qua lần mở lại', () => {
  it('đăng nhập xong, khởi động lại server vẫn còn phiên', () => {
    const file = tempDbPath();

    const first = openDb(file);
    const user = upsertGoogleUser(first, 'sub-1', 'Nelson', 'https://example.test/a.png');
    const session = createSession(first, user.id);
    first.close();

    // Giống hệt việc tắt server rồi bật lại.
    const second = openDb(file);
    const again = userForSession(second, session.token);
    expect(again?.id).toBe(user.id);
    expect(again?.display_name).toBe('Nelson');
    expect(migrate(second)).toEqual([]); // không chạy lại migration
    second.close();
  });
});

describe('người dùng', () => {
  it('tài khoản thử không có google_sub', () => {
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'Người chơi thử');
    expect(u.google_sub).toBeNull();
    expect(u.puzzle_rating).toBe(1000);
    db.close();
  });

  it('hai tài khoản Google khác nhau là hai người khác nhau', () => {
    const db = openDb(':memory:');
    const a = upsertGoogleUser(db, 'sub-1', 'Nelson');
    const b = upsertGoogleUser(db, 'sub-2', 'Hùng');
    expect(a.id).not.toBe(b.id);
    db.close();
  });
});
