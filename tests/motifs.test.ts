// Nhận diện kiểu lỗi. Mỗi mô-típ có thế cờ CÓ lỗi và thế cờ KHÔNG có lỗi —
// nhận nhầm cũng tai hại như bỏ sót, vì lời bình sẽ nói sai.
import { describe, expect, it } from 'vitest';
import {
  backRankWeak,
  detectMotifs,
  forkAfter,
  hangingPieces,
  missedCaptures,
} from '../shared/advisor/motifs.ts';

describe('để hở quân', () => {
  it('Mã đứng một mình giữa bàn, bị Tốt đuổi', () => {
    // Mã trắng d5 bị tốt đen e6 tấn công, không ai bảo vệ
    const h = hangingPieces('4k3/8/4p3/3N4/8/8/8/4K3 b - - 0 1', 'w');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ square: 'd5', piece: 'Mã' });
  });

  it('quân được bảo vệ đủ thì không tính là hở', () => {
    // Mã d5 được Hậu d1 bảo vệ, kẻ tấn công là Xe (đắt hơn Mã)
    expect(hangingPieces('3rk3/8/8/3N4/8/8/8/3QK3 b - - 0 1', 'w')).toHaveLength(0);
  });

  it('quân không bị ai tấn công thì không phải hở', () => {
    expect(hangingPieces('4k3/8/8/3N4/8/8/8/4K3 b - - 0 1', 'w')).toHaveLength(0);
  });

  it('bị quân rẻ hơn tấn công vẫn tính là hở dù có người đỡ', () => {
    // Xe trắng d5 bị tốt đen e6 tấn công, chỉ có Vua đỡ — đổi Xe lấy Tốt là lỗ
    const h = hangingPieces('4k3/8/4p3/3R4/8/8/8/3K4 b - - 0 1', 'w');
    expect(h[0]).toMatchObject({ square: 'd5', piece: 'Xe' });
  });

  it('xếp quân đắt lên trước', () => {
    // Xe đen a1 nhắm Hậu a5, Xe đen h1 nhắm Mã h4; cả hai đều không ai đỡ
    const h = hangingPieces('7k/8/8/Q7/7N/4K3/8/r6r w - - 0 1', 'w');
    expect(h.map((x) => x.piece)).toEqual(['Hậu', 'Mã']);
  });
});

describe('bỏ lỡ nước ăn quân', () => {
  it('thấy nước ăn Hậu cho không', () => {
    // Trắng đi, Xe a1 ăn được Hậu a8 không ai đỡ
    const m = missedCaptures('q6k/8/8/8/8/8/8/R6K w - - 0 1');
    expect(m[0]).toMatchObject({ san: 'Rxa8+', piece: 'Hậu' });
  });

  it('ăn xong bị ăn lại thì không tính là quân cho không', () => {
    // Xe a1 ăn Hậu a8 nhưng Xe đen b8 ăn lại ngay
    expect(missedCaptures('qr5k/8/8/8/8/8/8/R6K w - - 0 1')).toHaveLength(0);
  });

  it('ăn Tốt không đáng gọi là bỏ lỡ', () => {
    expect(missedCaptures('7k/p7/8/8/8/8/8/R6K w - - 0 1')).toHaveLength(0);
  });
});

describe('đòn đôi', () => {
  it('Mã ăn hai: Vua và Xe', () => {
    // Sau Nxf7+, Mã f7 vừa chiếu Vua h8 vừa nhắm Hậu d8
    const fen = 'r2q3k/ppp2ppp/8/4N3/8/8/PPP2PPP/R2QK2R w KQ - 0 1';
    const fork = forkAfter(fen, 'e5f7');
    expect(fork?.kind).toBe('fork');
    expect(fork?.piece).toBe('Mã');
    expect(fork?.targets).toEqual(expect.arrayContaining(['h8', 'd8']));
  });

  it('nước chỉ nhắm một quân thì không phải đòn đôi', () => {
    expect(forkAfter('r2q3k/ppp2ppp/8/4N3/8/8/PPP2PPP/R2QK2R w KQ - 0 1', 'e5d3')).toBeNull();
  });

  it('nước không hợp lệ thì bỏ qua, không làm hỏng gì', () => {
    expect(forkAfter('r2q3k/ppp2ppp/8/4N3/8/8/PPP2PPP/R2QK2R w KQ - 0 1', 'a1a8')).toBeNull();
    expect(forkAfter('r2q3k/ppp2ppp/8/4N3/8/8/PPP2PPP/R2QK2R w KQ - 0 1', '')).toBeNull();
  });
});

describe('yếu hàng cuối', () => {
  it('Vua bị ba Tốt nhà chắn hết đường thoát', () => {
    const m = backRankWeak('6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1', 'b');
    expect(m).toMatchObject({ kind: 'backRank', square: 'g8' });
  });

  it('có lỗ thở thì không tính', () => {
    // Tốt h7 đã đi lên h6, Vua thoát được qua h7
    expect(backRankWeak('6k1/5pp1/7p/8/8/8/5PPP/3R2K1 b - - 0 1', 'b')).toBeNull();
  });

  it('đối phương không còn Xe hay Hậu thì không thành chuyện', () => {
    expect(backRankWeak('6k1/5ppp/8/8/8/8/5PPP/4B1K1 b - - 0 1', 'b')).toBeNull();
  });

  it('Vua không ở hàng cuối thì không tính', () => {
    expect(backRankWeak('8/5ppk/8/8/8/8/5PPP/3R2K1 b - - 0 1', 'b')).toBeNull();
  });
});

describe('detectMotifs', () => {
  const base = {
    fenBefore: 'r2qk2r/ppp2p2/3p1n1p/2b1p1p1/2BnP3/2NP1QBP/PPP2PP1/R3K2R w KQkq - 1 11',
    fenAfter: 'r2qk2r/ppp2p2/3p1n1p/2b1p1p1/2BnP1Q1/2NP2BP/PPP2PP1/R3K2R b KQkq - 2 11',
    san: 'Qg4',
    side: 'w' as const,
  };

  it('nước Qg4 thật trong ván: thấy lỗi', () => {
    const motifs = detectMotifs({ ...base, replyUci: 'd4c2' });
    expect(motifs.length).toBeGreaterThan(0);
  });

  it('bỏ lỡ chiếu hết', () => {
    const m = detectMotifs({ ...base, hadMate: true });
    expect(m.some((x) => x.kind === 'missedMate')).toBe(true);
  });

  it('để đối thủ chiếu hết thì đó là điều đáng nói nhất', () => {
    const m = detectMotifs({ ...base, allowsMate: true });
    expect(m[0].kind).toBe('hangsMate');
  });

  it('đổi quân thiệt', () => {
    const m = detectMotifs({ ...base, materialBefore: 0, materialAfter: -3 });
    expect(m.some((x) => x.kind === 'badTrade')).toBe(true);
  });

  it('nước bình thường ở thế cờ đầu: không bịa ra lỗi nào', () => {
    const m = detectMotifs({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      san: 'e4',
      side: 'w',
    });
    expect(m).toEqual([]);
  });
});
