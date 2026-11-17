// Chấm ván. Dùng engine giả với điểm số đặt sẵn, nên test chạy nhanh và
// kết quả không phụ thuộc vào Stockfish bản nào.
import { describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import { reviewGame, ReviewCancelled, mistakesOf, type Analyser } from '../src/analysis/review.ts';
import type { Score } from '../shared/winrate.ts';

/** PGN từ một dãy nước SAN. */
function pgnOf(...sans: string[]): string {
  const c = new Chess();
  for (const s of sans) c.move(s);
  return c.pgn();
}

/**
 * Engine giả: trả điểm theo thứ tự đã định sẵn cho từng thế cờ, và luôn nói
 * nước tốt nhất là `bestMoves[i]`.
 */
function fakeEngine(scores: Score[], bestMoves: string[] = []): Analyser {
  let i = 0;
  return {
    analyse: async () => {
      const score = scores[Math.min(i, scores.length - 1)];
      const best = bestMoves[Math.min(i, bestMoves.length - 1)] ?? 'a2a3';
      i++;
      return { lines: [{ uci: best, score }] };
    },
  };
}

describe('reviewGame', () => {
  it('ván rỗng thì không có gì để chấm', async () => {
    const r = await reviewGame('', fakeEngine([{ cp: 0 }]));
    expect(r.moves).toEqual([]);
    expect(r.accuracy).toEqual({ w: 100, b: 100 });
  });

  it('mỗi thế cờ chỉ phân tích một lần', async () => {
    const engine = fakeEngine([{ cp: 0 }]);
    const spy = vi.spyOn(engine, 'analyse');
    await reviewGame(pgnOf('e4', 'e5', 'Nf3'), engine);
    // 3 nước -> 4 thế cờ, không phải 6
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('điểm sau nước này chính là điểm trước nước sau', async () => {
    const r = await reviewGame(pgnOf('e4', 'e5'), fakeEngine([{ cp: 20 }, { cp: 30 }, { cp: 10 }]));
    expect(r.moves[0].scoreBefore).toEqual({ cp: 20 });
    expect(r.moves[0].scoreAfter).toEqual({ cp: 30 });
    expect(r.moves[1].scoreBefore).toEqual({ cp: 30 });
    expect(r.moves[1].scoreAfter).toEqual({ cp: 10 });
  });

  it('Trắng đánh rơi quân thì bị chấm là Sai nghiêm trọng', async () => {
    // Thế cờ ngoài sách khai cuộc để không bị tính là nước Sách
    const pgn = pgnOf('a4', 'h5', 'Ra3');
    const r = await reviewGame(pgn, fakeEngine([{ cp: 0 }, { cp: 0 }, { cp: 10 }, { cp: -800 }]));
    expect(r.moves[2].cls).toBe('blunder');
    expect(r.moves[2].side).toBe('w');
  });

  it('Đen làm Trắng hơn lên thì lỗi thuộc về Đen', async () => {
    const pgn = pgnOf('a4', 'h5', 'Ra3', 'Rh6');
    const r = await reviewGame(pgn, fakeEngine([{ cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: 900 }]));
    expect(r.moves[3].side).toBe('b');
    expect(r.moves[3].cls).toBe('blunder');
  });

  it('đi trúng nước engine chọn thì là Tốt nhất', async () => {
    const r = await reviewGame(pgnOf('a4'), fakeEngine([{ cp: 0 }, { cp: 0 }], ['a2a4']));
    expect(r.moves[0].cls).toBe('best');
  });

  it('độ chính xác: đi hoàn hảo là 100, đánh rơi quân thì tụt hẳn', async () => {
    const good = await reviewGame(pgnOf('a4'), fakeEngine([{ cp: 0 }, { cp: 0 }], ['a2a4']));
    expect(good.accuracy.w).toBe(100);

    const bad = await reviewGame(pgnOf('a4', 'h5', 'Ra3'), fakeEngine([{ cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: -900 }]));
    expect(bad.accuracy.w).toBeLessThan(70);
  });

  it('có nước tốt hơn kèm ký hiệu đọc được', async () => {
    const r = await reviewGame(pgnOf('a4'), fakeEngine([{ cp: 0 }, { cp: 0 }], ['e2e4']));
    expect(r.moves[0].best[0]).toMatchObject({ uci: 'e2e4', san: 'e4' });
  });

  it('báo tiến độ theo từng thế cờ', async () => {
    const seen: number[] = [];
    await reviewGame(pgnOf('e4', 'e5'), fakeEngine([{ cp: 0 }]), {
      onProgress: (done, total) => seen.push(done / total),
    });
    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('dừng được giữa chừng', async () => {
    let n = 0;
    await expect(
      reviewGame(pgnOf('e4', 'e5', 'Nf3', 'Nc6'), fakeEngine([{ cp: 0 }]), { cancelled: () => ++n > 2 }),
    ).rejects.toBeInstanceOf(ReviewCancelled);
  });

  it('chiếu hết cũng chấm được', async () => {
    const r = await reviewGame(
      pgnOf('f3', 'e5', 'g4', 'Qh4#'),
      fakeEngine([{ cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: 0 }, { mate: -1 }]),
    );
    expect(r.moves).toHaveLength(4);
    expect(r.moves[3].scoreAfter).toEqual({ mate: -1 });
  });
});

describe('mistakesOf', () => {
  it('chỉ lấy nước đáng đem ra ôn lại', async () => {
    const pgn = pgnOf('a4', 'h5', 'Ra3', 'Rh6');
    const r = await reviewGame(pgn, fakeEngine([{ cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: -800 }, { cp: 800 }]));
    expect(mistakesOf(r).length).toBeGreaterThan(0);
    expect(mistakesOf(r).every((m) => ['blunder', 'mistake', 'miss'].includes(m.cls))).toBe(true);
    expect(mistakesOf(r, 'w').every((m) => m.side === 'w')).toBe(true);
  });
});
