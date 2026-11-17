// Bộ kiểm duyệt lời bình. Đây là lớp chắn cuối cùng giữa người học và một mô
// hình không biết đánh cờ, nên test ở đây là test quan trọng nhất của GĐ5.
import { describe, expect, it } from 'vitest';
import { buildFacts, type Facts } from '../shared/advisor/facts.ts';
import { parseModelReply, validateComment } from '../shared/advisor/validate.ts';
import { templateComment, hintSteps } from '../shared/advisor/templates.ts';

const facts: Facts = buildFacts({
  side: 'w',
  ply: 21,
  san: 'Qg4',
  cls: 'blunder',
  best: [
    { san: 'Qd1', score: { cp: -2 } },
    { san: 'Bxf7+', score: { cp: -506 } },
  ],
  pv: ['Qd1', 'Qe7', 'Ne2'],
  motifs: [{ kind: 'hanging', square: 'c2', piece: 'Tốt' }],
  material: { truoc: 0, sau: -5 },
});

const ok = (s: string) => validateComment(s, facts);

describe('lời bình hợp lệ', () => {
  it('nhắc đúng nước và ô có trong dữ kiện', () => {
    expect(ok('Hậu đi sang g4 nhưng bỏ trống ô c2. Nước Qd1 giữ được thế cờ.')).toMatchObject({ ok: true });
  });

  it('không nhắc nước nào cũng được', () => {
    expect(ok('Nước này làm hỏng thế cờ vì để hở một quân quan trọng.')).toMatchObject({ ok: true });
  });

  it('nhắc nước trong dòng chính là được', () => {
    expect(ok('Sau Qd1 rồi Qe7, thế cờ vẫn cân bằng cho bạn.')).toMatchObject({ ok: true });
  });
});

describe('chặn lời bình bịa', () => {
  it('bịa nước đi không có trong dữ kiện', () => {
    const v = ok('Bạn nên đi Nf3 để phát triển quân.');
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('Nf3');
  });

  it('bịa ô cờ không liên quan', () => {
    const v = ok('Quân của bạn ở h7 đang gặp nguy hiểm lắm.');
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('h7');
  });

  it('bịa điểm số', () => {
    expect(ok('Nước này làm bạn mất 2.5 điểm quân ngay lập tức.').ok).toBe(false);
  });

  it('bịa phần trăm', () => {
    expect(ok('Cơ hội thắng của bạn giảm còn 30% sau nước đi này.').ok).toBe(false);
  });

  it('nói chuyện ngoài phạm vi', () => {
    expect(ok('Stockfish đánh giá thế cờ này rất tệ cho bạn.').ok).toBe(false);
    expect(ok('Tôi nghĩ bạn nên cẩn thận hơn với quân Hậu của mình.').ok).toBe(false);
  });

  it('không phải tiếng Việt', () => {
    expect(ok('This move hangs a piece and loses material quickly.').ok).toBe(false);
  });

  it('quá ngắn hoặc quá dài', () => {
    expect(ok('Sai rồi.').ok).toBe(false);
    expect(ok('Nước này rất tệ. '.repeat(40)).ok).toBe(false);
  });

  it('nhập thành không có trong dữ kiện cũng bị chặn', () => {
    expect(ok('Lẽ ra bạn nên nhập thành O-O để Vua được an toàn hơn.').ok).toBe(false);
  });
});

describe('đọc câu trả lời của mô hình', () => {
  it('JSON đúng dạng', () => {
    expect(parseModelReply('{"giaiThich":"Hậu bị bắt."}')).toBe('Hậu bị bắt.');
  });

  it('mô hình kèm chữ thừa quanh JSON', () => {
    expect(parseModelReply('Đây là câu trả lời:\n{"giaiThich":"Hậu bị bắt."}\nHết.')).toBe('Hậu bị bắt.');
  });

  it('không phải JSON thì bỏ', () => {
    expect(parseModelReply('Hậu bị bắt.')).toBeNull();
    expect(parseModelReply('{"khac":"gi do"}')).toBeNull();
    expect(parseModelReply('')).toBeNull();
  });
});

describe('câu mẫu', () => {
  it('luôn viết ra được một câu dùng được, và câu đó tự nó qua kiểm duyệt', () => {
    const text = templateComment(facts);
    expect(text.length).toBeGreaterThan(20);
    expect(validateComment(text, facts)).toMatchObject({ ok: true });
  });

  it('câu mẫu cho mọi kiểu lỗi đều qua được kiểm duyệt', () => {
    const kinds = ['hanging', 'fork', 'missedCapture', 'missedMate', 'hangsMate', 'backRank', 'badTrade'] as const;
    for (const kind of kinds) {
      const f = buildFacts({
        side: 'w',
        ply: 21,
        san: 'Qg4',
        cls: 'blunder',
        best: [{ san: 'Qd1', score: { cp: -2 } }],
        pv: ['Qd1'],
        motifs: [{ kind, square: 'c2', piece: 'Mã', targets: ['c2', 'g4'], san: 'Qd1' }],
        material: { truoc: 0, sau: -3 },
      });
      const text = templateComment(f);
      const v = validateComment(text, f);
      expect(v, `câu mẫu cho ${kind}: ${text} — ${v.reason}`).toMatchObject({ ok: true });
    }
  });

  it('gợi ý ba nấc đi từ ý tưởng tới nước cụ thể', () => {
    const [idea, which, exact] = hintSteps(facts);
    expect(idea).not.toContain('Qd1'); // nấc 1 chưa được lộ nước
    expect(which).not.toContain('Qd1'); // nấc 2 chỉ nói quân nào
    expect(which).toContain('Hậu');
    expect(exact).toContain('Qd1');
  });
});

describe('phạm vi dữ kiện', () => {
  it('nước mình vừa đi không nằm trong danh sách nước tốt hơn', () => {
    expect(facts.nuocTotHon).not.toContain('Qg4');
    expect(facts.nuocTotHon).toEqual(['Qd1', 'Bxf7+']);
  });

  it('ghi đúng số nước và bên đi', () => {
    expect(facts.nuocDaDi).toBe('11.Qg4');
    const den = buildFacts({ side: 'b', ply: 22, san: 'Nxc2+', cls: 'good', best: [], pv: [], motifs: [] });
    expect(den.nuocDaDi).toBe('11...Nxc2+');
    expect(den.ben).toBe('Đen');
  });
});
