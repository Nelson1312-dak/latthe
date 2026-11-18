// Vẽ trên bàn cờ và huy hiệu hết ván.
import { describe, expect, it } from 'vitest';
import { arrowDests } from '../shared/premove.ts';
import { endBadgesFor } from '../src/board/Board.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('arrowDests: mũi tên đi đúng đường quân đi', () => {
  it('Tốt h2 không vẽ được tới f7 (ảnh chụp người dùng gửi)', () => {
    const d = arrowDests(START, 'h2');
    expect(d).not.toContain('f7');
    expect(d.sort()).toEqual(['g3', 'h3', 'h4']);
  });

  it('Mã chỉ có hình chữ L', () => {
    expect(arrowDests(START, 'g1').sort()).toEqual(['e2', 'f3', 'h3']);
  });

  it('Tốt đen đi xuống, không đi lên', () => {
    const d = arrowDests(START, 'e7');
    expect(d).toContain('e5');
    expect(d).not.toContain('e8');
  });

  it('ô trống: đường của Hậu và của Mã', () => {
    const d = arrowDests(START, 'e4');
    expect(d).toContain('e8'); // dọc
    expect(d).toContain('a8'); // chéo
    expect(d).toContain('f6'); // Mã
    expect(d).not.toContain('f7'); // không đường nào tới
  });
});

describe('endBadgesFor: huy hiệu trên ô Vua', () => {
  // Chiếu hết kiểu "ngốc": Đen thắng
  const MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';

  it('chiếu hết: vương miện cho bên thắng, dấu # cho bên thua', () => {
    const b = endBadgesFor(MATE, { winner: 'b', reason: 'checkmate' });
    expect(b).toContainEqual({ square: 'e8', kind: 'win' });
    expect(b).toContainEqual({ square: 'e1', kind: 'mate' });
  });

  it('đầu hàng và hết giờ có hình riêng', () => {
    expect(endBadgesFor(START, { winner: 'w', reason: 'resign' })).toContainEqual({ square: 'e8', kind: 'resign' });
    expect(endBadgesFor(START, { winner: 'w', reason: 'timeout' })).toContainEqual({ square: 'e8', kind: 'timeout' });
  });

  it('hòa: cả hai Vua cùng một dấu', () => {
    const b = endBadgesFor(START, { winner: 'draw', reason: 'stalemate' });
    expect(b.map((x) => x.kind)).toEqual(['draw', 'draw']);
  });
});
