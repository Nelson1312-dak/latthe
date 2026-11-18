import { describe, expect, it } from 'vitest';
import { classify, formatScore, moveAccuracy, winningChances, winPercent } from '../shared/winrate';

describe('winrate', () => {
  it('cân bằng là 50%', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50, 6);
  });

  it('đối xứng giữa hai bên', () => {
    expect(winningChances({ cp: 250 })).toBeCloseTo(-winningChances({ cp: -250 }), 9);
  });

  it('chiếu hết là chắc thắng', () => {
    expect(winningChances({ mate: 3 })).toBe(1);
    expect(winningChances({ mate: -1 })).toBe(-1);
  });

  it('độ chính xác 100 khi không mất gì', () => {
    expect(moveAccuracy(60, 60)).toBe(100);
    expect(moveAccuracy(60, 70)).toBe(100);
  });

  it('độ chính xác giảm khi mất % thắng', () => {
    expect(moveAccuracy(60, 50)).toBeLessThan(70);
    expect(moveAccuracy(80, 20)).toBeLessThan(10);
  });
});

describe('classify', () => {
  it('Trắng đánh rơi Hậu là Sai nghiêm trọng', () => {
    expect(classify({ before: { cp: 30 }, after: { cp: -800 }, side: 'w', isBest: false })).toBe('blunder');
  });

  it('Đen làm Trắng hơn lên là lỗi của Đen', () => {
    // 0 -> +1.2: cơ hội thắng của Đen giảm khoảng 0,22
    expect(classify({ before: { cp: 0 }, after: { cp: 120 }, side: 'b', isBest: false })).toBe('mistake');
    expect(classify({ before: { cp: 0 }, after: { cp: 250 }, side: 'b', isBest: false })).toBe('blunder');
  });

  it('mất ít là Tốt', () => {
    expect(classify({ before: { cp: 20 }, after: { cp: 0 }, side: 'w', isBest: false })).toBe('good');
  });

  it('bỏ lỡ chiếu hết', () => {
    expect(classify({ before: { mate: 2 }, after: { cp: 600 }, side: 'w', isBest: false })).toBe('miss');
    // Bỏ chiếu hết nhưng vẫn hơn cả Hậu: không phải bỏ lỡ (Đen, -19 vẫn thắng chắc)
    expect(classify({ before: { mate: -6 }, after: { cp: -1900 }, side: 'b', isBest: false })).not.toBe('miss');
    expect(classify({ before: { mate: -6 }, after: { cp: -1900 }, side: 'b', isBest: false })).toBe('good');
  });

  it('nước tốt nhất và nước sách', () => {
    expect(classify({ before: { cp: 0 }, after: { cp: 0 }, side: 'w', isBest: true })).toBe('best');
    expect(classify({ before: { cp: 0 }, after: { cp: 0 }, side: 'w', isBest: false, isBook: true })).toBe('book');
  });
});

describe('formatScore', () => {
  it('định dạng', () => {
    expect(formatScore({ cp: 140 })).toBe('+1.4');
    expect(formatScore({ cp: -30 })).toBe('−0.3');
    expect(formatScore({ cp: 0 })).toBe('0.0');
    expect(formatScore({ cp: -2 })).toBe('0.0'); // không hiện "−0.0"
    expect(formatScore({ cp: 4 })).toBe('0.0');
    expect(formatScore({ mate: 3 })).toBe('M3');
    expect(formatScore({ mate: -2 })).toBe('−M2');
  });
});
