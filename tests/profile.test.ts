// Hồ sơ người chơi: tên gọi, trình độ lần đầu, tuỳ chọn, thống kê, tự xoá tài khoản.
import { describe, expect, it } from 'vitest';
import { openDb, one, upsertGoogleUser, type Db, type User } from '../server/db.ts';
import { insertGame, parseNewGame } from '../server/games.ts';
import { createSession, userForSession } from '../server/auth.ts';
import {
  applyProfile,
  deleteUser,
  parsePrefs,
  parseProfilePatch,
  profileStats,
  readPrefs,
  savePrefs,
} from '../server/profile.ts';

function setup(): { db: Db; user: User } {
  const db = openDb(':memory:');
  return { db, user: upsertGoogleUser(db, 'sub-1', 'Do Manh Hien', 'https://x/a.png') };
}
const reload = (db: Db, id: number) => one<User>(db, 'SELECT * FROM users WHERE id = ?', id)!;

describe('parseProfilePatch', () => {
  it('gọn khoảng trắng, chặn tên quá ngắn / quá dài', () => {
    expect(parseProfilePatch({ name: '  Hiên   cờ  ' })).toEqual({ name: 'Hiên cờ' });
    expect(parseProfilePatch({ name: 'a' })).toBe('Tên cần ít nhất 2 ký tự');
    expect(parseProfilePatch({ name: 'x'.repeat(31) })).toBe('Tên dài tối đa 30 ký tự');
    expect(parseProfilePatch({ name: 42 })).toBe('Tên không hợp lệ');
  });
  it('trình độ chỉ nhận các mức đã định', () => {
    expect(parseProfilePatch({ level: 'club' })).toEqual({ level: 'club' });
    expect(parseProfilePatch({ level: 'toString' })).toBe('Trình độ không hợp lệ');
    expect(parseProfilePatch({ level: 'gm' })).toBe('Trình độ không hợp lệ');
  });
});

describe('applyProfile', () => {
  it('màn chào mừng: đặt tên gọi, điểm khởi đầu theo trình độ, đánh dấu đã xong', () => {
    const { db, user } = setup();
    const u = applyProfile(db, user, { name: 'Hiên', level: 'club' });
    expect(u.display_name).toBe('Hiên');
    expect(u.game_rating).toBe(1200);
    expect(u.puzzle_rating).toBe(1300);
    expect(u.onboarded).toBe(1);
  });

  it('đã qua màn chào mừng thì không tự nâng điểm được nữa', () => {
    const { db, user } = setup();
    const u1 = applyProfile(db, user, { level: 'new' });
    const u2 = applyProfile(db, u1, { level: 'strong' });
    expect(u2.game_rating).toBe(600);
  });

  it('tên tự đặt không bị tên Google đè lên ở lần đăng nhập sau', () => {
    const { db, user } = setup();
    applyProfile(db, user, { name: 'Hiên cờ' });
    const again = upsertGoogleUser(db, 'sub-1', 'Do Manh Hien', 'https://x/b.png');
    expect(again.display_name).toBe('Hiên cờ');
    expect(again.avatar_url).toBe('https://x/b.png');
  });

  it('chưa tự đặt tên thì vẫn lấy tên Google mới', () => {
    const { db } = setup();
    expect(upsertGoogleUser(db, 'sub-1', 'Hien Do', undefined).display_name).toBe('Hien Do');
  });
});

describe('tuỳ chọn hiển thị', () => {
  it('chỉ giữ đúng các khoá đã biết', () => {
    expect(parsePrefs({ prefs: { board: 'wood', sound: false, coords: true, evil: 'x', theme: 'light' } })).toEqual({
      board: 'wood',
      sound: false,
      coords: true,
      theme: 'light',
    });
    expect(parsePrefs({ prefs: { board: '<script>' } })).toEqual({});
    expect(parsePrefs({})).toBe('Thiếu tuỳ chọn');
  });
  it('lưu rồi đọc lại', () => {
    const { db, user } = setup();
    savePrefs(db, user.id, { board: 'blue', autoQueen: true });
    expect(readPrefs(reload(db, user.id))).toEqual({ board: 'blue', autoQueen: true });
  });
});

describe('profileStats', () => {
  it('đếm thắng/hòa/thua, bỏ qua ván hai người một máy', () => {
    const { db, user } = setup();
    const add = (o: Record<string, unknown>) =>
      insertGame(
        db,
        user.id,
        parseNewGame({ mode: 'bot', level: 2, playerSide: 'w', pgn: '1. e4 e5', reason: 'checkmate', ...o }) as never,
      );
    add({ winner: 'w' });
    add({ winner: 'b' });
    add({ winner: 'draw', reason: 'stalemate' });
    add({ mode: 'human', winner: 'w' });
    const s = profileStats(db, user);
    expect(s.games).toMatchObject({ total: 4, bot: 3, wins: 1, draws: 1, losses: 1 });
  });
});

describe('deleteUser', () => {
  it('xoá người dùng kéo theo ván cờ và phiên đăng nhập', () => {
    const { db, user } = setup();
    insertGame(
      db,
      user.id,
      parseNewGame({ mode: 'bot', level: 1, playerSide: 'w', pgn: '1. e4 e5', winner: 'w', reason: 'resign' }) as never,
    );
    const s = createSession(db, user.id);
    deleteUser(db, user.id);
    expect(one(db, 'SELECT * FROM users WHERE id = ?', user.id)).toBeUndefined();
    expect(one<{ n: number }>(db, 'SELECT count(*) AS n FROM games WHERE user_id = ?', user.id)!.n).toBe(0);
    expect(userForSession(db, s.token)).toBeNull();
  });
});
