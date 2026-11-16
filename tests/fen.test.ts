import { describe, expect, it } from 'vitest';
import { material, piecesFromFen } from '../shared/fen';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('piecesFromFen', () => {
  it('thế cờ đầu có 32 quân', () => {
    const p = piecesFromFen(START);
    expect(p.size).toBe(32);
    expect(p.get('e1')).toBe('wk');
    expect(p.get('d8')).toBe('bq');
    expect(p.get('a2')).toBe('wp');
    expect(p.get('e4')).toBeUndefined();
  });

  it('bỏ qua phần sau của FEN', () => {
    expect(piecesFromFen('8/8/8/8/8/8/8/K6k w - - 0 1').size).toBe(2);
  });

  it('báo lỗi khi hàng sai độ dài', () => {
    expect(() => piecesFromFen('rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toThrow(/phải là 8/);
  });

  it('báo lỗi khi thiếu hàng', () => {
    expect(() => piecesFromFen('8/8/8')).toThrow(/8 hàng/);
  });
});

describe('material', () => {
  it('thế cờ đầu là cân bằng', () => {
    const m = material(START);
    expect(m.diff).toBe(0);
    expect(m.whiteTook).toEqual([]);
    expect(m.blackTook).toEqual([]);
  });

  it('Trắng mất một Mã', () => {
    const m = material('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1');
    expect(m.diff).toBe(-3);
    expect(m.blackTook).toEqual(['wn']);
  });
});
