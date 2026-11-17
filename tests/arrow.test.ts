// Mũi tên phải đi theo đúng cách quân cờ đi.
import { describe, expect, it } from 'vitest';
import { arrowPath } from '../src/board/Board.ts';

/** Tách chuỗi polyline thành các điểm, làm tròn cho dễ so. */
const pts = (s: string | null) =>
  s === null ? null : s.split(' ').map((p) => p.split(',').map((n) => Math.round(Number(n))));

describe('đường mũi tên', () => {
  it('Xe đi thẳng: hai điểm', () => {
    expect(pts(arrowPath('a1', 'a8', 'w', 16))).toHaveLength(2);
  });

  it('Tượng đi chéo: hai điểm', () => {
    expect(pts(arrowPath('c1', 'h6', 'w', 16))).toHaveLength(2);
  });

  it('Mã đi chữ L: ba điểm, có chỗ gấp khúc', () => {
    const p = pts(arrowPath('g1', 'f3', 'w', 16))!;
    expect(p).toHaveLength(3);
  });

  it('Mã nhảy xa theo chiều ngang thì rẽ ngang trước', () => {
    // b1 -> d2: lệch 2 ô ngang, 1 ô dọc. Chỗ gấp phải cùng hàng với ô xuất phát.
    const [bắtĐầu, gấp] = pts(arrowPath('b1', 'd2', 'w', 16))!;
    expect(gấp[1]).toBe(bắtĐầu[1]); // cùng y, tức là đi ngang trước
  });

  it('Mã nhảy xa theo chiều dọc thì đi dọc trước', () => {
    // g1 -> f3: lệch 1 ô ngang, 2 ô dọc. Chỗ gấp phải cùng cột với ô xuất phát.
    const [bắtĐầu, gấp] = pts(arrowPath('g1', 'f3', 'w', 16))!;
    expect(gấp[0]).toBe(bắtĐầu[0]); // cùng x, tức là đi dọc trước
  });

  it('cả tám nước của Mã đều gấp khúc', () => {
    const từ = 'd4';
    const tới = ['e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5', 'c6'] as const;
    for (const t of tới) {
      expect(pts(arrowPath(từ, t, 'w', 16)), `d4->${t}`).toHaveLength(3);
    }
  });

  it('nước KHÔNG phải của Mã thì vẽ thẳng', () => {
    // Những ô quanh d4 mà Mã không tới được
    for (const t of ['d5', 'e5', 'd8', 'a1', 'h8', 'a4'] as const) {
      expect(pts(arrowPath('d4', t, 'w', 16)), `d4->${t}`).toHaveLength(2);
    }
  });

  it('lật bàn cờ thì mũi tên Mã vẫn gấp khúc, chỉ đổi chiều', () => {
    const trắng = pts(arrowPath('g1', 'f3', 'w', 16))!;
    const đen = pts(arrowPath('g1', 'f3', 'b', 16))!;
    expect(đen).toHaveLength(3);
    // Nhìn từ phía Đen thì mọi thứ lộn ngược
    expect(đen[0][0]).toBeCloseTo(400 - trắng[0][0], 0);
  });

  it('hai ô trùng nhau thì không có mũi tên', () => {
    expect(arrowPath('e4', 'e4', 'w', 16)).toBeNull();
  });

  it('mũi tên dừng trước tâm ô đích để chừa chỗ cho đầu nhọn', () => {
    const p = pts(arrowPath('a1', 'a8', 'w', 20))!;
    const cuối = p[p.length - 1];
    // Tâm a8 ở y = 25 trong hệ toạ độ bàn cờ; điểm cuối phải thấp hơn thế 20
    expect(cuối[1]).toBe(45);
  });
});
