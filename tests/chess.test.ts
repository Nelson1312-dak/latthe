// Luật cờ: những nước dễ sai nhất (nhập thành, bắt tốt qua đường, phong cấp)
// và bốn kiểu hòa. Đây là phần không được phép sai, nên test kỹ.
import { describe, expect, it } from 'vitest';
import { Game, outcomeText, START_FEN, type Square } from '../shared/chess.ts';

/** Đi một loạt nước bằng ô, ví dụ ['e2e4', 'e7e5']. */
function play(g: Game, ...uci: string[]): void {
  for (const u of uci) {
    const m = g.move(u.slice(0, 2) as Square, u.slice(2, 4) as Square, u[4]);
    if (!m) throw new Error(`Nước không hợp lệ: ${u} ở ${g.fen}`);
  }
}

describe('đi quân cơ bản', () => {
  it('thế cờ đầu, Trắng đi trước', () => {
    const g = new Game();
    expect(g.fen).toBe(START_FEN);
    expect(g.turn).toBe('w');
    expect(g.length).toBe(0);
  });

  it('từ chối nước không hợp lệ mà không làm hỏng ván', () => {
    const g = new Game();
    expect(g.move('e2', 'e5')).toBeNull();
    expect(g.move('e7', 'e5')).toBeNull(); // không phải lượt Đen
    expect(g.length).toBe(0);
    expect(g.turn).toBe('w');
  });

  it('ô đi được của Mã đầu ván (e2 bị tốt nhà chắn)', () => {
    const { quiet, captures } = new Game().legalFrom('g1');
    expect(quiet.sort()).toEqual(['f3', 'h3']);
    expect(captures).toEqual([]);
  });

  it('phân biệt nước ăn quân với nước thường', () => {
    const g = new Game();
    play(g, 'e2e4', 'd7d5');
    const { quiet, captures } = g.legalFrom('e4');
    expect(captures).toEqual(['d5']);
    expect(quiet).toEqual(['e5']);
  });
});

describe('nhập thành', () => {
  it('nhập thành gần, Vua và Xe đổi chỗ đúng', () => {
    const g = new Game('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const m = g.move('e1', 'g1');
    expect(m?.san).toBe('O-O');
    expect(g.fen.split(' ')[0]).toContain('R4RK1');
  });

  it('nhập thành xa', () => {
    const g = new Game('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    expect(g.move('e1', 'c1')?.san).toBe('O-O-O');
  });

  it('không nhập thành được khi Vua đang bị chiếu', () => {
    const g = new Game('r3k2r/pppppppp/8/8/8/8/PPPP1PPP/R3K2R w KQkq - 0 1');
    play(g, 'a1b1'); // nước chờ
    const g2 = new Game('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1'); // Xe đen chiếu dọc cột e
    expect(g2.move('e1', 'g1')).toBeNull();
  });

  it('không nhập thành qua ô bị kiểm soát', () => {
    // Xe đen ở f8 kiểm soát f1, Vua trắng không đi qua được
    const g = new Game('4kr2/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(g.move('e1', 'g1')).toBeNull();
  });
});

describe('bắt tốt qua đường', () => {
  it('ăn được ngay nước sau', () => {
    const g = new Game();
    play(g, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    const { captures } = g.legalFrom('e5');
    expect(captures).toContain('d6'); // ô đến đang trống nhưng vẫn là nước ăn
    const m = g.move('e5', 'd6');
    expect(m?.san).toBe('exd6');
    expect(m?.captured).toBe(true);
    expect(g.fen.split(' ')[0]).not.toContain('p3'); // tốt d5 đã bị nhấc đi
  });

  it('quá một nước là hết quyền', () => {
    const g = new Game();
    play(g, 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'a2a3', 'a6a5');
    expect(g.move('e5', 'd6')).toBeNull();
  });
});

describe('phong cấp', () => {
  it('báo đúng là nước cần chọn quân', () => {
    const g = new Game('8/P6k/8/8/8/8/8/7K w - - 0 1');
    expect(g.needsPromotion('a7', 'a8')).toBe(true);
    expect(g.needsPromotion('h1', 'g1')).toBe(false);
  });

  it('phong thành Hậu và thành Mã', () => {
    const q = new Game('8/P6k/8/8/8/8/8/7K w - - 0 1');
    expect(q.move('a7', 'a8', 'q')?.san).toBe('a8=Q');

    const n = new Game('8/P6k/8/8/8/8/8/7K w - - 0 1');
    expect(n.move('a7', 'a8', 'n')?.san).toBe('a8=N');
    expect(n.fen.split(' ')[0]).toContain('N');
  });

  it('không chọn gì thì mặc định là Hậu', () => {
    const g = new Game('8/P6k/8/8/8/8/8/7K w - - 0 1');
    expect(g.move('a7', 'a8')?.san).toBe('a8=Q');
  });
});

describe('kết thúc ván', () => {
  it('chiếu hết kiểu thằng ngốc', () => {
    const g = new Game();
    play(g, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(g.outcome()).toEqual({ winner: 'b', reason: 'checkmate' });
    expect(outcomeText(g.outcome()!)).toBe('Đen thắng · chiếu hết');
  });

  it('hết nước đi là hòa', () => {
    const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.outcome()).toEqual({ winner: 'draw', reason: 'stalemate' });
  });

  it('thiếu quân chiếu hết là hòa', () => {
    const g = new Game('7k/8/6K1/8/8/8/8/7B w - - 0 1');
    expect(g.outcome()).toEqual({ winner: 'draw', reason: 'insufficient' });
  });

  it('lặp ba lần là hòa', () => {
    const g = new Game();
    // Hai Mã đi ra rồi về, ba lần lặp lại thế cờ
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(g.outcome()).toEqual({ winner: 'draw', reason: 'threefold' });
  });

  it('ván đang chơi thì chưa có kết quả', () => {
    const g = new Game();
    play(g, 'e2e4');
    expect(g.outcome()).toBeNull();
  });
});

describe('chiếu', () => {
  it('biết đang bị chiếu và Vua nào', () => {
    const g = new Game();
    play(g, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(g.inCheck).toBe(true);
    expect(g.checkedKing).toBe('e1');
  });

  it('bình thường thì không có Vua nào bị chiếu', () => {
    expect(new Game().checkedKing).toBeNull();
  });
});

describe('xem lại', () => {
  it('tua về trước rồi tiến lại', () => {
    const g = new Game();
    play(g, 'e2e4', 'e7e5', 'g1f3');
    expect(g.ply).toBe(3);
    expect(g.atLive).toBe(true);

    g.prev();
    expect(g.ply).toBe(2);
    expect(g.atLive).toBe(false);
    expect(g.turn).toBe('w');

    g.first();
    expect(g.fen).toBe(START_FEN);
    g.last();
    expect(g.ply).toBe(3);
  });

  it('không tua quá hai đầu', () => {
    const g = new Game();
    play(g, 'e2e4');
    g.prev();
    g.prev();
    expect(g.ply).toBe(0);
    g.next();
    g.next();
    expect(g.ply).toBe(1);
  });

  it('đi quân khi đang tua lại thì cắt bỏ phần sau', () => {
    const g = new Game();
    play(g, 'e2e4', 'e7e5', 'g1f3');
    g.goTo(2); // sau 1...e5
    g.move('f1', 'c4'); // đánh khác đi
    expect(g.length).toBe(3);
    expect(g.history[2].san).toBe('Bc4');
    expect(g.atLive).toBe(true);
  });

  it('lùi một nước thì nước đó mất hẳn', () => {
    const g = new Game();
    play(g, 'e2e4', 'e7e5');
    expect(g.undo()?.san).toBe('e5');
    expect(g.length).toBe(1);
    expect(g.turn).toBe('b');
    expect(g.legalFrom('e7').quiet).toContain('e5'); // đi lại được
  });
});

describe('PGN', () => {
  it('ghi ra rồi đọc lại vẫn đúng ván', () => {
    const g = new Game();
    play(g, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6');
    const again = Game.fromPgn(g.pgn());
    expect(again.history.map((m) => m.san)).toEqual(g.history.map((m) => m.san));
    expect(again.fen).toBe(g.fen);
  });
});
