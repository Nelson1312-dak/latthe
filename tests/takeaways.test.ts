// Ba điều rút ra từ ván: đúng sự thật trong kết quả chấm.
import { describe, expect, it } from 'vitest';
import { sanVi, takeaways } from '../src/analysis/takeaways.ts';
import type { ReviewResult, ReviewedMove } from '../src/analysis/review.ts';
import type { MoveClass } from '../shared/winrate.ts';

function mv(ply: number, san: string, cls: MoveClass, acc = 95, before = 0, after = 0, best = 'e4'): ReviewedMove {
  return {
    ply,
    san,
    uci: 'a2a3',
    side: ply % 2 ? 'w' : 'b',
    fenBefore: '',
    fenAfter: '',
    scoreBefore: { cp: before },
    scoreAfter: { cp: after },
    best: [{ uci: 'e2e4', san: best, score: { cp: 0 } }],
    cls,
    accuracy: acc,
  };
}

describe('sanVi', () => {
  it('viết nước đi bằng chữ', () => {
    expect(sanVi('Nxf6+')).toBe('Mã f6');
    expect(sanVi('exd5')).toBe('Tốt d5');
    expect(sanVi('O-O')).toBe('nhập thành gần');
    expect(sanVi('e8=Q#')).toBe('Tốt e8 phong Hậu');
  });
});

describe('takeaways', () => {
  it('nước ngoặt là nước hỏng nặng nhất của mình, kèm nước nên đi và thế cờ đổi ra sao', () => {
    const r: ReviewResult = {
      moves: [mv(1, 'e4', 'book'), mv(2, 'e5', 'book'), mv(3, 'Qh5', 'mistake', 60, 30, -150, 'Nf3'), mv(4, 'Nc6', 'good'), mv(5, 'Bc4', 'blunder', 20, 0, -900, 'Nf3')],
      accuracy: { w: 70, b: 95 },
      opening: null,
    };
    const t = takeaways(r, 'w');
    expect(t[0].text).toContain('nước 3: bạn đi Tượng c4');
    expect(t[0].text).toContain('nên đi Mã f3');
    expect(t[0].text).toContain('thua rõ');
    expect(t[0].ply).toBe(5);
  });

  it('không có nước hỏng thì khen ván sạch', () => {
    const r: ReviewResult = { moves: [mv(1, 'e4', 'best'), mv(2, 'e5', 'best')], accuracy: { w: 100, b: 100 }, opening: null };
    expect(takeaways(r, 'w')[0].text).toContain('không có nước hỏng');
  });

  it('chỉ ra cơ hội bỏ lỡ khi đối thủ đi hỏng mà mình đáp không chính xác', () => {
    const r: ReviewResult = {
      moves: [mv(1, 'e4', 'book'), mv(2, 'Qh4', 'blunder', 10, 0, 800), mv(3, 'a3', 'inaccuracy', 70, 800, 300, 'Nf3')],
      accuracy: { w: 80, b: 10 },
      opening: null,
    };
    const t = takeaways(r, 'w');
    expect(t.some((x) => x.text.includes('chưa tận dụng') && x.text.includes('Mã f3'))).toBe(true);
  });

  it('không quá ba điều', () => {
    const moves: ReviewedMove[] = [];
    for (let i = 1; i <= 90; i++) moves.push(mv(i, 'a3', i % 7 === 0 ? 'mistake' : 'good', i < 30 ? 95 : 60));
    expect(takeaways({ moves, accuracy: { w: 80, b: 80 }, opening: null }, 'w').length).toBeLessThanOrEqual(3);
  });
});

describe('validateSummary: Huấn luyện viên chỉ được viết lại, không thêm', async () => {
  const { validateSummary } = await import('../shared/advisor/summary.ts');
  const gốc = ['Nước ngoặt ở nước 12: bạn đi Mã f6, lẽ ra nên đi Tượng c4.', 'Bạn chơi chắc nhất ở khai cuộc (92%) nhưng hụt hơi ở trung cuộc (61%).'];

  it('nhận bản viết lại giữ nguyên ô cờ và con số', () => {
    const ok = validateSummary(gốc, [
      'Bước ngoặt đến ở nước 12, khi bạn chọn Mã f6 — Tượng c4 mới là nước hay.',
      'Khai cuộc bạn chơi rất chắc (92%), sang trung cuộc thì hụt hơi (61%).',
    ]);
    expect(ok).toHaveLength(2);
  });

  it('bỏ bản viết lại nếu thêm ô cờ hay con số không có trong câu gốc', () => {
    expect(validateSummary(gốc, ['Ở nước 12 bạn đi Mã f6, nên đi Tượng c4 rồi Hậu h5.', gốc[1]])).toBeNull();
    expect(validateSummary(gốc, [gốc[0], 'Khai cuộc 95%, trung cuộc 61%.'])).toBeNull();
    expect(validateSummary(gốc, [gốc[0]])).toBeNull(); // thiếu một câu
    expect(validateSummary(gốc, 'không phải danh sách')).toBeNull();
  });
});

describe('validateSummary: không đoán kết cục', async () => {
  const { validateSummary } = await import('../shared/advisor/summary.ts');
  it('bỏ câu viết lại có "sẽ không thua", "sẽ thắng"', () => {
    const gốc = ['Nước ngoặt ở nước 6: bạn đi Tốt a3, lẽ ra nên đi Hậu h4.'];
    expect(validateSummary(gốc, ['Ở nước 6 nếu đi Hậu h4 thay vì Tốt a3 thì bạn sẽ không thua.'])).toBeNull();
    expect(validateSummary(gốc, ['Nước 6 đi Hậu h4 là bạn sẽ thắng, đừng đi Tốt a3.'])).toBeNull();
  });
});
