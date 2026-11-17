import { describe, expect, it } from 'vitest';
import { snapSize } from '../src/board/snap.ts';

describe('snapSize: mỗi ô là số nguyên điểm ảnh thật', () => {
  it('màn thường: làm tròn xuống bội số của 8', () => {
    expect(snapSize(658, 1)).toBe(656);
    expect(snapSize(640, 1)).toBe(640);
  });

  it('màn phóng 125%: ô cờ nguyên điểm ảnh THẬT, không phải px CSS', () => {
    const px = snapSize(658, 1.25);
    const device = px * 1.25;
    expect(device % 8).toBe(0);
    expect(Number.isInteger(device / 8)).toBe(true);
    expect(px).toBeLessThanOrEqual(658);
    expect(658 - px).toBeLessThan(8 / 1.25 + 1e-9);
  });

  it('màn 150% và 200%', () => {
    for (const dpr of [1.5, 2, 1.75]) {
      const px = snapSize(375, dpr);
      expect(Number.isInteger(Math.round(px * dpr * 1e6) / 1e6 / 8)).toBe(true);
      expect(px).toBeLessThanOrEqual(375);
    }
  });

  it('không âm, không hỏng với dpr lạ', () => {
    expect(snapSize(5, 1)).toBe(0);
    expect(snapSize(100, 0)).toBe(96);
  });
});
