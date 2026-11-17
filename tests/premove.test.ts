// Ô được phép đi trước, và độ dài trượt quân phải khớp giữa CSS và TS.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ownsSquare, premoveDests } from '../shared/premove.ts';
import { START_FEN } from '../shared/chess.ts';
import { PIECE_SLIDE_MS } from '../src/board/timing.ts';

const sorted = (a: string[]) => [...a].sort();

describe('ô đi trước', () => {
  it('Mã ở g1', () => {
    expect(sorted(premoveDests(START_FEN, 'g1'))).toEqual(['e2', 'f3', 'h3']);
  });

  it('Tốt Trắng ở hàng 2: một ô, hai ô, và hai ô chéo', () => {
    expect(sorted(premoveDests(START_FEN, 'e2'))).toEqual(['d3', 'e3', 'e4', 'f3']);
  });

  it('Tốt Đen đi xuống', () => {
    expect(sorted(premoveDests(START_FEN, 'e7'))).toEqual(['d6', 'e5', 'e6', 'f6']);
  });

  it('Xe đi hết đường thẳng, kể cả qua quân đang chắn', () => {
    // Trên bàn khai cuộc, Xe a1 bị chắn hết — nhưng đi trước thì chưa biết
    // lúc tới lượt còn ai chắn không, nên vẫn cho chọn đủ 14 ô
    expect(premoveDests(START_FEN, 'a1')).toHaveLength(14);
  });

  it('cho đi vào ô quân mình đang đứng, để ăn lại', () => {
    expect(premoveDests(START_FEN, 'g1')).toContain('e2');
  });

  it('Vua còn quyền nhập thành thì được chọn c1 và g1', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(sorted(premoveDests(fen, 'e1'))).toEqual(['c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1']);
  });

  it('mất quyền nhập thành thì thôi', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1';
    expect(premoveDests(fen, 'e1')).not.toContain('g1');
  });

  it('ô trống thì không có gì', () => {
    expect(premoveDests(START_FEN, 'e4')).toEqual([]);
  });

  it('biết quân nào của ai', () => {
    expect(ownsSquare(START_FEN, 'e2', 'w')).toBe(true);
    expect(ownsSquare(START_FEN, 'e7', 'w')).toBe(false);
    expect(ownsSquare(START_FEN, 'e4', 'w')).toBe(false);
  });
});

describe('thời gian trượt quân', () => {
  it('CSS và TS nói cùng một con số', () => {
    // Màn hình chờ PIECE_SLIDE_MS rồi mới vẽ lại; CSS trượt trong --t-piece.
    // Hai số lệch nhau là vẽ lại giữa lúc quân đang trượt, quân giật cục.
    const css = readFileSync('src/ui/tokens.css', 'utf8');
    const m = /--t-piece:\s*(\d+)ms/.exec(css);
    expect(Number(m?.[1])).toBe(PIECE_SLIDE_MS);
  });
});
