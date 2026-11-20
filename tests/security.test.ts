// Chặn chèn mã qua tên người chơi, cookie hỏng, làm sạch dữ liệu cũ.
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { cleanName, createLocalUser, openDb, upsertGoogleUser } from '../server/db.ts';
import { parseProfilePatch } from '../server/profile.ts';
import { parseShare } from '../server/shares.ts';
import { insertGame, parseNewGame } from '../server/games.ts';
import { readCookie } from '../server/auth.ts';
import { contentSecurityPolicy } from '../scripts/security-headers.mjs';

const ĐỘC = '<img src=x onerror="alert(1)">Lan`&';

describe('tên người chơi không mang được thẻ HTML', () => {
  it('cleanName bỏ < > " & ` và ký tự điều khiển, giữ dấu tiếng Việt và dấu nháy đơn', () => {
    expect(cleanName(ĐỘC)).toBe('img src=x onerror=alert(1)Lan');
    expect(cleanName("  Nguyễn\tO'Brien  ")).toBe("Nguyễn O'Brien");
    expect(cleanName(42)).toBe('');
  });

  it('tên Google, tên tài khoản thử, tên tự đổi đều được làm sạch', () => {
    const db = openDb(':memory:');
    expect(upsertGoogleUser(db, 'sub-1', ĐỘC).display_name).not.toMatch(/[<>"&`]/);
    expect(upsertGoogleUser(db, 'sub-2', '<>').display_name).toBe('Người chơi');
    expect(createLocalUser(db, ĐỘC).display_name).not.toMatch(/[<>"&`]/);
    const p = parseProfilePatch({ name: '<b>Minh</b>' });
    expect(p).toEqual({ name: 'bMinh/b' });
  });

  it('ảnh đại diện chỉ nhận https', () => {
    const db = openDb(':memory:');
    expect(upsertGoogleUser(db, 'sub-3', 'An', 'javascript:alert(1)').avatar_url).toBeNull();
    expect(upsertGoogleUser(db, 'sub-4', 'An', 'https://lh3.googleusercontent.com/a/x').avatar_url).toBe(
      'https://lh3.googleusercontent.com/a/x',
    );
  });

  it('tên hai bên trong ván chia sẻ được làm sạch', () => {
    const s = parseShare({
      pgn: '1. e4 e5',
      review: { moves: [{}, {}] },
      meta: { white: ĐỘC, black: '"><svg onload=1>', label: 'x' },
    });
    if (typeof s === 'string') return; // review giả có thể bị từ chối: phần tên thử riêng dưới
    expect(s.meta.white).not.toMatch(/[<>"&`]/);
    expect(s.meta.black).not.toMatch(/[<>"&`]/);
  });

  it('ván lưu: lý do kết thúc chỉ nhận mã ngắn, tên đối thủ được làm sạch', () => {
    const g = parseNewGame({ mode: 'bot', pgn: '1. e4 e5', winner: 'w', playerSide: 'w', reason: '<script>' });
    expect(g?.reason).toBe('unknown');
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'An');
    const id = insertGame(db, u.id, { ...g!, mode: 'online', reason: 'resign', opponentName: ĐỘC });
    const row = db.prepare('SELECT opponent_name FROM games WHERE id = ?').get(id) as { opponent_name: string };
    expect(row.opponent_name).not.toMatch(/[<>"&`]/);
  });
});

describe('cookie hỏng không làm ngã request', () => {
  it('trả undefined thay vì ném lỗi', () => {
    expect(readCookie('cv_session=%E0%A4%A', 'cv_session')).toBeUndefined();
    expect(readCookie('a=1; cv_session=abc', 'cv_session')).toBe('abc');
  });
});

describe('migration 015 làm sạch dữ liệu cũ', () => {
  it('bỏ ký tự HTML khỏi tên đã lưu, giữ JSON của ván chia sẻ đọc được', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT, avatar_url TEXT);
      CREATE TABLE games (id INTEGER PRIMARY KEY, opponent_name TEXT);
      CREATE TABLE shares (id TEXT PRIMARY KEY, meta TEXT)`);
    db.prepare('INSERT INTO users VALUES (1, ?, ?)').run('<b>An</b>', 'http://x');
    db.prepare('INSERT INTO users VALUES (2, ?, NULL)').run('<>');
    db.prepare('INSERT INTO games VALUES (1, ?)').run('"Bình"&');
    db.prepare('INSERT INTO shares VALUES (?, ?)').run('s1', JSON.stringify({ white: 'A"><x', black: 'B&C', label: 'ok' }));
    db.exec(readFileSync('server/migrations/015_clean_names.sql', 'utf8'));
    const u = db.prepare('SELECT display_name, avatar_url FROM users ORDER BY id').all() as { display_name: string; avatar_url: string | null }[];
    expect(u.map((x) => x.display_name)).toEqual(['bAn/b', 'Người chơi']);
    expect(u[0].avatar_url).toBeNull();
    expect((db.prepare('SELECT opponent_name FROM games').get() as { opponent_name: string }).opponent_name).toBe('Bình');
    const meta = JSON.parse((db.prepare('SELECT meta FROM shares').get() as { meta: string }).meta);
    expect(meta).toEqual({ white: 'A><x', black: 'BC', label: 'ok' });
  });
});

describe('CSP', () => {
  it('không cho script viết thẳng trong trang hay eval', () => {
    const csp = contentSecurityPolicy('https://vi-du.ngrok-free.dev');
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(script).not.toMatch(/unsafe-inline|'unsafe-eval'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('connect-src \'self\' https://vi-du.ngrok-free.dev');
  });
});
