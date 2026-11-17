// Lộ trình bài học. Test ở đây chỉ kiểm tra tính nhất quán của nội dung —
// bài tập thì lấy từ kho Lichess nên không cần kiểm thế cờ.
import { describe, expect, it } from 'vitest';
import { CHAPTERS, LESSONS, lessonById } from '../src/training/lessons.ts';

/** Chủ đề mà script nạp kho giữ lại; bài học phải nằm trong số này. */
const THEMES_TRONG_KHO = new Set([
  'fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'doubleCheck',
  'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate',
  'deflection', 'attraction', 'clearance', 'interference', 'trappedPiece',
  'defensiveMove', 'capturingDefender', 'advancedPawn', 'promotion',
  'endgame', 'rookEndgame', 'pawnEndgame', 'queenEndgame', 'bishopEndgame', 'knightEndgame',
]);

describe('lộ trình bài học', () => {
  it('mã bài không trùng nhau', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  it('mọi chủ đề bài học đều có trong kho đã nạp', () => {
    for (const l of LESSONS) {
      expect(THEMES_TRONG_KHO.has(l.theme), `bài "${l.title}" dùng chủ đề ${l.theme}`).toBe(true);
    }
  });

  it('độ khó nằm trong khoảng kho bài tập đã lọc', () => {
    for (const l of LESSONS) {
      expect(l.maxRating).toBeGreaterThanOrEqual(600);
      expect(l.maxRating).toBeLessThanOrEqual(1800);
    }
  });

  it('bài nào cũng có đủ phần giải thích và điều cần nhớ', () => {
    for (const l of LESSONS) {
      expect(l.intro.length, l.title).toBeGreaterThan(80);
      expect(l.keyPoint.length, l.title).toBeGreaterThan(20);
      expect(l.count).toBeGreaterThanOrEqual(2);
    }
  });

  it('trong mỗi chương, bài sau không dễ hơn bài trước', () => {
    for (const ch of CHAPTERS) {
      const trong = LESSONS.filter((l) => l.chapter === ch);
      for (let i = 1; i < trong.length; i++) {
        expect(trong[i].maxRating, `${ch}: ${trong[i].title}`).toBeGreaterThanOrEqual(trong[i - 1].maxRating);
      }
    }
  });

  it('tra bài theo mã', () => {
    expect(lessonById('fork')?.title).toBe('Đòn đôi');
    expect(lessonById('khong-co')).toBeUndefined();
  });
});
