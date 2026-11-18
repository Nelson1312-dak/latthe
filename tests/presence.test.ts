// Đang mở trang: chỉ đếm mã hợp lệ, quên sau 2 phút, gom mục lạ vào "khác".
import { beforeEach, describe, expect, it } from 'vitest';
import { presenceBeat, presenceNow, resetPresence } from '../server/presence.ts';

describe('presence', () => {
  beforeEach(() => resetPresence());

  it('đếm từng tab, theo mục đang xem', () => {
    const t = 1_000_000;
    presenceBeat('aaaaaaaa-1111', 'choi', t);
    presenceBeat('bbbbbbbb-2222', 'online', t);
    presenceBeat('aaaaaaaa-1111', 'hoc', t + 1000); // cùng tab, đổi mục
    const n = presenceNow(t + 2000);
    expect(n.total).toBe(2);
    expect(n.byWhere.hoc).toBe(1);
    expect(n.byWhere.online).toBe(1);
    expect(n.byWhere.choi).toBe(0);
  });

  it('quá 2 phút không gửi là quên', () => {
    presenceBeat('aaaaaaaa-1111', 'choi', 0);
    expect(presenceNow(119_000).total).toBe(1);
    expect(presenceNow(121_000).total).toBe(0);
  });

  it('bỏ mã sai dạng, mục lạ thành "khác"', () => {
    expect(presenceBeat('x', 'choi', 0)).toBe(false);
    expect(presenceBeat({ id: 1 }, 'choi', 0)).toBe(false);
    expect(presenceBeat('cccccccc-3333', '<script>', 0)).toBe(true);
    expect(presenceNow(1).byWhere.khac).toBe(1);
  });
});
