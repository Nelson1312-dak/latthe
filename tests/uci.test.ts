// Đọc hiểu dòng chữ engine in ra. Đây là chỗ dễ sai âm thầm: đọc nhầm dấu của
// điểm số thì cả thanh đánh giá lẫn phần chấm nước đều sai mà không báo lỗi.
import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo, splitUci, toWhitePov } from '../src/engine/uci.ts';
import { LEVELS, levelById, pickLine } from '../src/engine/levels.ts';

describe('parseInfo', () => {
  it('đọc dòng info đầy đủ', () => {
    const line =
      'info depth 14 seldepth 23 multipv 1 score cp -32 nodes 47992 nps 271141 time 177 pv e7e5 g1f3 b8c6';
    expect(parseInfo(line)).toEqual({
      depth: 14,
      multipv: 1,
      score: { cp: -32 },
      pv: ['e7e5', 'g1f3', 'b8c6'],
      nodes: 47992,
      timeMs: 177,
    });
  });

  it('đọc điểm chiếu hết', () => {
    const r = parseInfo('info depth 10 multipv 1 score mate 3 pv d1d8');
    expect(r?.score).toEqual({ mate: 3 });
    expect(r?.pv).toEqual(['d1d8']);
  });

  it('không có multipv thì mặc định là 1', () => {
    expect(parseInfo('info depth 5 score cp 10 pv e2e4')?.multipv).toBe(1);
  });

  it('bỏ qua dòng không dùng được', () => {
    expect(parseInfo('info depth 1 currmove e2e4 currmovenumber 1')).toBeNull(); // không có pv
    expect(parseInfo('info depth 5 pv e2e4')).toBeNull(); // không có điểm
    expect(parseInfo('info string NNUE evaluation using nn-xxx.nnue')).toBeNull();
    expect(parseInfo('bestmove e2e4')).toBeNull();
    expect(parseInfo('')).toBeNull();
  });

  it('không nhầm số của trường khác thành depth', () => {
    // 'seldepth' đứng trước nhưng depth thật là 7
    const r = parseInfo('info depth 7 seldepth 19 score cp 5 pv a2a3');
    expect(r?.depth).toBe(7);
  });
});

describe('parseBestMove', () => {
  it('đọc nước đi và nước đoán', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ best: 'e2e4', ponder: 'e7e5' });
  });

  it('không có ponder cũng được', () => {
    expect(parseBestMove('bestmove g1f3')).toEqual({ best: 'g1f3', ponder: undefined });
  });

  it('hết nước đi', () => {
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeNull();
  });
});

describe('đổi góc nhìn điểm số', () => {
  it('Trắng đi thì giữ nguyên', () => {
    expect(toWhitePov({ cp: 120 }, 'w')).toEqual({ cp: 120 });
    expect(toWhitePov({ mate: 2 }, 'w')).toEqual({ mate: 2 });
  });

  it('Đen đi thì đảo dấu — engine luôn nói theo bên đang đi', () => {
    expect(toWhitePov({ cp: 120 }, 'b')).toEqual({ cp: -120 });
    expect(toWhitePov({ mate: 2 }, 'b')).toEqual({ mate: -2 });
    expect(toWhitePov({ cp: -45 }, 'b')).toEqual({ cp: 45 });
  });
});

describe('splitUci', () => {
  it('tách nước thường và nước phong cấp', () => {
    expect(splitUci('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
    expect(splitUci('g7h8n')).toEqual({ from: 'g7', to: 'h8', promotion: 'n' });
  });
});

describe('cấp độ máy', () => {
  it('có đủ 8 cấp, mạnh dần', () => {
    expect(LEVELS).toHaveLength(8);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].moveTimeMs).toBeGreaterThanOrEqual(LEVELS[i - 1].moveTimeMs);
    }
  });

  it('ba cấp đầu cố ý đi kém, các cấp sau dùng giới hạn Elo', () => {
    for (const l of LEVELS.slice(0, 3)) {
      expect(l.weights).toBeDefined();
      expect(l.elo).toBeUndefined();
    }
    for (const l of LEVELS.slice(3)) {
      expect(l.elo).toBeGreaterThanOrEqual(1320); // mức thấp nhất Stockfish nhận
      expect(l.weights).toBeUndefined();
    }
  });

  it('id lạ thì rơi về cấp mặc định', () => {
    expect(levelById(99).id).toBe(4);
    expect(levelById(1).id).toBe(1);
  });

  it('cấp không có trọng số thì luôn lấy nước tốt nhất', () => {
    expect(pickLine(levelById(8), 5, () => 0.99)).toBe(0);
  });

  it('cấp 1 thường bỏ qua nước tốt nhất', () => {
    const l = levelById(1); // trọng số [1,3,4,4,4], tổng 16
    expect(pickLine(l, 5, () => 0)).toBe(0); // đầu dải vẫn là nước tốt nhất
    expect(pickLine(l, 5, () => 0.5)).toBeGreaterThan(0);
    expect(pickLine(l, 5, () => 0.99)).toBe(4);
  });

  it('engine chỉ đưa ra một nước thì phải chọn nước đó', () => {
    expect(pickLine(levelById(1), 1, () => 0.99)).toBe(0);
  });

  it('chọn đúng theo trọng số về lâu dài', () => {
    const l = levelById(1);
    let best = 0;
    for (let i = 0; i < 1000; i++) if (pickLine(l, 5, () => i / 1000) === 0) best++;
    // trọng số nước tốt nhất là 1/16 ≈ 6%
    expect(best).toBeGreaterThan(40);
    expect(best).toBeLessThan(90);
  });
});
