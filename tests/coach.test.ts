// Huấn luyện viên: nhận định tính từ lịch sử ván phải đúng sự thật, và AI chỉ
// được viết lại, không được thêm con số hay ô cờ nào.
import { describe, expect, it } from 'vitest';
import { sanVi, thếCờ } from '../src/analysis/words.ts';
import {
  COACH_MIN_GAMES,
  coachFacts,
  gameInsight,
  factLines,
  lessonsFor,
  templateAdvice,
  validateAdvice,
  type CoachGame,
  type CoachMove,
} from '../shared/coach.ts';
import { createLocalUser, openDb } from '../server/db.ts';
import { insertGame } from '../server/games.ts';
import { saveReview } from '../server/reviews.ts';
import { coachReport, communityReport } from '../server/coach.ts';
import { saveInsight } from '../server/analyst.ts';

describe('sanVi, thếCờ', () => {
  it('viết nước đi bằng chữ', () => {
    expect(sanVi('Nxf6+')).toBe('Mã f6');
    expect(sanVi('exd5')).toBe('Tốt d5');
    expect(sanVi('O-O')).toBe('nhập thành gần');
    expect(sanVi('e8=Q#')).toBe('Tốt e8 phong Hậu');
  });
  it('thế cờ nhìn từ đúng phía', () => {
    expect(thếCờ({ cp: -1900 }, 'b')).toBe('thắng rõ');
    expect(thếCờ({ cp: -1900 }, 'w')).toBe('thua rõ');
    expect(thếCờ({ cp: 0 }, 'w')).toBe('ngang ngửa');
  });
});

// Trắng đưa Hậu vào d7, sát Vua đen, không ai bảo vệ: để hở Hậu
const HỞ_HẬU: CoachMove = {
  ply: 1,
  san: 'Qd7+',
  uci: 'd1d7',
  side: 'w',
  fenBefore: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
  cls: 'blunder',
  accuracy: 5,
  scoreBefore: { cp: 900 },
  scoreAfter: { cp: 0 },
  best: [{ uci: 'd1d2', san: 'Qd2' }],
};
const tốt = (ply: number, side: 'w' | 'b'): CoachMove => ({
  ply,
  san: 'Kf1',
  uci: 'e1f1',
  side,
  fenBefore: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
  cls: 'good',
  accuracy: 95,
  scoreAfter: { cp: 0 },
});
const ván = (winner: CoachGame['winner']): CoachGame => ({
  side: 'w',
  winner,
  moves: [HỞ_HẬU, tốt(2, 'b'), tốt(3, 'w')],
});

describe('coachFacts', () => {
  it('đếm đúng thắng thua, lỗi sai nghiêm trọng, và kiểu lỗi lặp lại', () => {
    const f = coachFacts([ván('b'), ván('b'), ván('w')].map((g) => gameInsight(g)));
    expect(f.games).toBe(3);
    expect([f.wins, f.losses, f.draws]).toEqual([1, 2, 0]);
    expect(f.perGame.blunder).toBe(1);
    expect(f.motifs[0]).toEqual({ kind: 'hanging', count: 3, games: 3 });
    expect(f.accuracy).toBe(50); // (5 + 95) / 2
  });

  it('chỉ tính nước của người chơi, không tính nước đối thủ', () => {
    const g = ván('draw');
    g.side = 'b';
    const f = coachFacts([gameInsight(g)]);
    expect(f.motifs).toHaveLength(0);
    expect(f.perGame.blunder).toBe(0);
  });

  it('bài học đi theo lỗi hay gặp nhất, bỏ bài đã học xong', () => {
    const f = coachFacts([ván('b'), ván('b'), ván('b')].map((g) => gameInsight(g)));
    expect(lessonsFor(f)[0]).toBe('hanging');
    expect(lessonsFor(f, new Set(['hanging']))).not.toContain('hanging');
    expect(lessonsFor(f)).toHaveLength(3);
  });
});

describe('validateAdvice: AI chỉ được viết lại nhận định', () => {
  const f = coachFacts([ván('b'), ván('b'), ván('w')].map((g) => gameInsight(g)));
  const lines = factLines(f);

  it('nhận lời khuyên dùng đúng con số trong nhận định', () => {
    const ok = validateAdvice(lines, 2, {
      nhanXet: 'Trong 3 ván gần nhất, bạn hay để quân không ai bảo vệ — 3 lần. Đó là chỗ cần sửa trước tiên.',
      loTrinh: ['Bài này giúp bạn nhìn ra quân nào đang hở.', 'Học cách đếm quân bảo vệ trước khi ăn.'],
    });
    expect(ok?.loTrinh).toHaveLength(2);
  });

  it('bỏ lời khuyên có con số lạ, ô cờ, hứa hẹn kết quả, hay sai số bài', () => {
    const base = { nhanXet: 'Bạn hay để quân không ai bảo vệ, cần sửa trước tiên.', loTrinh: ['Bài này rất hợp với bạn.'] };
    expect(validateAdvice(lines, 1, base)).not.toBeNull();
    expect(validateAdvice(lines, 1, { ...base, nhanXet: 'Bạn mất 17 quân vì để hở quân.' })).toBeNull();
    expect(validateAdvice(lines, 1, { ...base, nhanXet: 'Hậu ở d7 hay bị ăn, cần cẩn thận.' })).toBeNull();
    expect(validateAdvice(lines, 1, { ...base, nhanXet: 'Học xong bài này bạn sẽ thắng nhiều hơn.' })).toBeNull();
    expect(validateAdvice(lines, 2, base)).toBeNull();
    expect(validateAdvice(lines, 1, 'không phải đối tượng')).toBeNull();
  });

  it('lời viết sẵn luôn có đủ một câu cho mỗi bài', () => {
    const a = templateAdvice(f, [{ title: 'Quân không ai bảo vệ', keyPoint: 'Trước mỗi nước, nhìn quân nào đang hở.' }]);
    expect(a.loTrinh).toHaveLength(1);
    expect(a.nhanXet).toContain('để quân không ai bảo vệ');
  });
});

describe('coachReport (server)', () => {
  it('chưa đủ ván đã chấm thì báo còn thiếu bao nhiêu; đủ thì có nhận định và bài học', () => {
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'Nam');
    const thêmVán = () => {
      const id = insertGame(db, u.id, { mode: 'bot', level: 3, playerSide: 'w', pgn: '1. e4 e5', winner: 'b', reason: 'checkmate' });
      saveReview(db, id, { moves: ván('b').moves as never, accuracy: { w: 50, b: 95 }, opening: null });
      saveInsight(db, id);
    };
    thêmVán();
    expect(coachReport(db, u.id)).toMatchObject({ facts: null, need: COACH_MIN_GAMES - 1 });
    thêmVán();
    thêmVán();
    const r = coachReport(db, u.id);
    expect(r.facts?.games).toBe(3);
    expect(r.lessons[0]).toMatchObject({ id: 'hanging', title: expect.any(String) });
    // Ví dụ gần nhất của lỗi để hở quân: đúng ván, đúng nước
    expect(r.facts?.examples.hanging).toMatchObject({ ply: 1, san: 'Qd7+' });
    // Toàn trang: gộp được, không mang ván cụ thể của ai
    const all = communityReport(db, 30);
    expect(all.players).toBe(1);
    expect(all.facts?.games).toBe(3);
    expect(all.facts?.examples).toEqual({});
  });
});

describe('người chấm nền (server/analyst.ts) — chạy Stockfish thật', () => {
  it('tự chấm ván chưa chấm, lưu kết quả, thẻ ôn tập và tóm tắt lỗi', async () => {
    const { analystStep } = await import('../server/analyst.ts');
    const { getReview } = await import('../server/reviews.ts');
    const db = openDb(':memory:');
    const u = createLocalUser(db, 'Lan');
    // Ván "chiếu hết nhanh nhất": Trắng đi hỏng hai nước liền. Ván cũ (để máy chủ chấm, không nhường trình duyệt)
    const id = insertGame(
      db,
      u.id,
      { mode: 'bot', level: 1, playerSide: 'w', pgn: '1. f3 e5 2. g4 Qh4#', winner: 'b', reason: 'checkmate' },
      new Date(Date.now() - 3600_000),
    );
    expect(await analystStep(db)).toBe(id);
    const r = getReview(db, id);
    expect(r?.moves).toHaveLength(4);
    expect(r?.moves[2].cls).toBe('blunder'); // 2.g4?? để Hậu chiếu hết
    expect(r?.moves[3].cls).toBe('best'); // 2...Qh4# đúng nước tốt nhất
    const ins = db.prepare('SELECT data FROM game_insights WHERE game_id = ?').get(id) as { data: string } | undefined;
    expect(JSON.parse(ins!.data)).toMatchObject({ side: 'w', blunder: 1 });
    const thẻ = db.prepare('SELECT count(*) c FROM cards WHERE user_id = ?').get(u.id) as { c: number };
    expect(thẻ.c).toBeGreaterThan(0);
    expect(await analystStep(db)).toBe('idle'); // hết việc
  }, 60_000);
});
