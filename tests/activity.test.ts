// Xu hướng người dùng hoạt động: mỗi người tính một lần mỗi kỳ, tuần bắt đầu thứ Hai,
// không tính tài khoản thử, lượt vào cộng đúng kỳ.
import { describe, expect, it } from 'vitest';
import { createLocalUser, openDb, upsertGoogleUser } from '../server/db.ts';
import { activityFor, bump } from '../server/stats.ts';
import { createSession, userForSession } from '../server/auth.ts';

// Thứ Tư 18/11/2026, 10 giờ sáng giờ Việt Nam
const NOW = new Date('2026-11-18T03:00:00Z');

describe('activityFor', () => {
  it('đếm người hoạt động theo ngày / tuần / tháng, mỗi người một lần mỗi kỳ', () => {
    const db = openDb(':memory:');
    const a = upsertGoogleUser(db, 'sub-a', 'A');
    const b = upsertGoogleUser(db, 'sub-b', 'B');
    const thử = createLocalUser(db, 'Thử');
    db.exec('DELETE FROM user_activity');
    const ghi = (u: number, day: string) => db.prepare('INSERT OR IGNORE INTO user_activity (user_id, day) VALUES (?, ?)').run(u, day);
    ghi(a.id, '2026-11-18'); // hôm nay (thứ Tư)
    ghi(a.id, '2026-11-16'); // thứ Hai tuần này
    ghi(b.id, '2026-11-15'); // Chủ nhật tuần trước
    ghi(b.id, '2026-10-20'); // tháng trước
    ghi(thử.id, '2026-11-18'); // tài khoản thử: không tính
    bump(db, 'visit', NOW);
    bump(db, 'visit', NOW);

    const r = activityFor(db, NOW);
    expect(r.days).toHaveLength(30);
    expect(r.days.at(-1)).toMatchObject({ key: '2026-11-18', users: 1, visits: 2 });
    expect(r.weeks.at(-1)).toMatchObject({ key: '2026-11-16', users: 1 }); // A hai ngày, tính một
    expect(r.weeks.at(-2)).toMatchObject({ key: '2026-11-09', users: 1 }); // B Chủ nhật 15/11
    expect(r.months.at(-1)).toMatchObject({ key: '2026-11', users: 2, label: 'T11/26' });
    expect(r.months.at(-2)).toMatchObject({ key: '2026-10', users: 1 });
    expect([r.dau, r.wau, r.mau]).toEqual([1, 2, 2]);
  });

  it('dùng app là được ghi một dòng hoạt động hôm nay', () => {
    const db = openDb(':memory:');
    const u = upsertGoogleUser(db, 'sub-x', 'X');
    db.exec('DELETE FROM user_activity');
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run('2026-11-01T00:00:00Z', u.id);
    const s = createSession(db, u.id);
    userForSession(db, s.token, NOW);
    userForSession(db, s.token, NOW);
    expect(db.prepare('SELECT day FROM user_activity WHERE user_id = ?').all(u.id)).toEqual([{ day: '2026-11-18' }]);
  });
});
