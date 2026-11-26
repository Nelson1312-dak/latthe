// Đọc hiểu dòng chữ engine in ra. Đây là chỗ dễ sai âm thầm: đọc nhầm dấu của
// điểm số thì cả thanh đánh giá lẫn phần chấm nước đều sai mà không báo lỗi.
import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo, splitUci, toWhitePov } from '../src/engine/uci.ts';
import { LEVELS, chooseLine, levelById, levelRating, scoreValue, type Candidate } from '../src/engine/levels.ts';

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
      const [a, b] = [LEVELS[i - 1], LEVELS[i]];
      expect(b.moveTimeMs).toBeGreaterThanOrEqual(a.moveTimeMs);
      expect(b.rating).toBeGreaterThan(a.rating);
      expect(b.spreadCp).toBeLessThanOrEqual(a.spreadCp);
      expect(b.maxLossCp).toBeLessThanOrEqual(a.maxLossCp);
      expect(b.slipChance).toBeLessThanOrEqual(a.slipChance);
    }
  });

  it('cấp 8 là Stockfish đầy sức: một dòng, không chọn lệch', () => {
    const l = levelById(8);
    expect(l.multipv).toBe(1);
    expect(l.spreadCp).toBe(0);
    expect(l.depth).toBeUndefined();
  });

  it('id lạ thì rơi về cấp mặc định', () => {
    expect(levelById(99).id).toBe(4);
    expect(levelById(1).id).toBe(1);
  });

  it('Elo hiện cạnh tên: cấp thấp để ước chừng', () => {
    expect(levelRating(1)).toBe('~800');
    expect(levelRating(6)).toBe(1800);
  });
});

describe('máy chọn nước', () => {
  const cp = (uci: string, v: number): Candidate => ({ uci, score: { cp: v } });
  const mate = (uci: string, m: number): Candidate => ({ uci, score: { mate: m } });

  it('chiếu hết sớm hơn là tốt hơn, bị chiếu hết sớm hơn là tệ hơn', () => {
    expect(scoreValue({ mate: 1 })).toBeGreaterThan(scoreValue({ mate: 3 }));
    expect(scoreValue({ mate: 3 })).toBeGreaterThan(scoreValue({ cp: 2000 }));
    expect(scoreValue({ mate: -1 })).toBeLessThan(scoreValue({ mate: -3 }));
    expect(scoreValue({ mate: -3 })).toBeLessThan(scoreValue({ cp: -2000 }));
  });

  it('cấp 8 luôn đi nước tốt nhất', () => {
    expect(chooseLine(levelById(8), [cp('a', 50), cp('b', 49)], () => 0.99)).toBe(0);
  });

  it('chỉ có một nước thì phải đi nước đó', () => {
    expect(chooseLine(levelById(1), [cp('a', -300)], () => 0.99)).toBe(0);
  });

  it('cấp 1 không bỏ qua nước bắt Hậu (lỗi cũ: bỏ lỡ 12/12 lần)', () => {
    const lines = [cp('Nxf7', 900), cp('a', 40), cp('b', 30), cp('c', 0), cp('d', -50)];
    for (let i = 0; i < 100; i++) expect(chooseLine(levelById(1), lines, () => i / 100)).toBe(0);
  });

  it('thấy chiếu hết thì đi, dù ở cấp 1', () => {
    const lines = [mate('Qh7', 1), cp('a', 600), cp('b', 500)];
    for (let i = 0; i < 100; i++) expect(chooseLine(levelById(1), lines, () => i / 100)).toBe(0);
  });

  it('không bao giờ đi nước để bị chiếu hết khi còn nước khác', () => {
    const lines = [cp('a', 0), cp('b', -20), mate('c', -1)];
    for (let i = 0; i < 100; i++) expect(chooseLine(levelById(1), lines, () => i / 100)).not.toBe(2);
  });

  it('các nước gần bằng nhau thì cấp thấp đổi nước, cấp cao gần như luôn đi nước tốt nhất', () => {
    const lines = [cp('a', 30), cp('b', 15), cp('c', 0), cp('d', -10)];
    const bestRate = (id: number) => {
      let n = 0;
      for (let i = 0; i < 1000; i++) {
        let k = 0;
        const r = () => [((i * 7919) % 1000) / 1000, (i % 1000) / 1000][k++ % 2];
        if (chooseLine(levelById(id), lines, r) === 0) n++;
      }
      return n / 1000;
    };
    expect(bestRate(1)).toBeLessThan(0.4);
    expect(bestRate(7)).toBeGreaterThan(0.7);
    expect(bestRate(7)).toBeGreaterThan(bestRate(4));
    expect(bestRate(4)).toBeGreaterThan(bestRate(1));
  });

  it('sơ suất chỉ xảy ra khi rút trúng, và vẫn có giới hạn', () => {
    const l = levelById(1);
    const lines = [cp('a', 0), cp('b', -400), cp('c', -800)];
    // Không sơ suất (lần rút đầu ≥ slipChance): nước thiệt 400 vượt ngưỡng 250
    expect(chooseLine(l, lines, (() => { let k = 0; return () => [0.99, 0.99][k++]; })())).toBe(0);
    // Sơ suất: nước thiệt 400 được phép, thiệt 800 thì không
    expect(chooseLine(l, lines, (() => { let k = 0; return () => [0, 0.99][k++]; })())).toBe(1);
  });
});
