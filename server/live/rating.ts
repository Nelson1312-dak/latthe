// Elo cho ván đấu với người, tách khỏi Elo bài tập.
//
// Hai thứ đo hai việc khác nhau: giải bài tập là nhìn ra đòn chiến thuật trong
// thế đã dọn sẵn, còn chơi cả ván là chuyện khác hẳn. Gộp chung thì cả hai con
// số đều sai.

export const START_RATING = 1000;
const FLOOR = 400;
const CEIL = 2800;

/**
 * Hệ số K: mới chơi thì nhảy nhanh cho mau về đúng mức, chơi nhiều rồi thì
 * ổn định lại.
 */
export function gameK(played: number): number {
  return played < 30 ? 40 : played < 100 ? 24 : 16;
}

/** Xác suất thắng kỳ vọng của bên có Elo `a` khi gặp bên có Elo `b`. */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

export type Score = 1 | 0.5 | 0;

export interface RatingChange {
  whiteBefore: number;
  blackBefore: number;
  whiteAfter: number;
  blackAfter: number;
  whiteChange: number;
  blackChange: number;
}

/**
 * Elo mới của hai bên sau một ván.
 *
 * `scoreWhite` là 1 nếu Trắng thắng, 0.5 nếu hòa, 0 nếu thua. Hai bên có thể
 * có hệ số K khác nhau (một người mới, một người chơi lâu rồi), nên số điểm
 * ăn và mất không nhất thiết bằng nhau — đúng như Elo chuẩn.
 */
export function rateGame(
  white: { rating: number; played: number },
  black: { rating: number; played: number },
  scoreWhite: Score,
): RatingChange {
  const clamp = (n: number) => Math.max(FLOOR, Math.min(CEIL, Math.round(n)));
  const eWhite = expectedScore(white.rating, black.rating);
  const whiteAfter = clamp(white.rating + gameK(white.played) * (scoreWhite - eWhite));
  const blackAfter = clamp(black.rating + gameK(black.played) * (1 - scoreWhite - (1 - eWhite)));
  return {
    whiteBefore: white.rating,
    blackBefore: black.rating,
    whiteAfter,
    blackAfter,
    whiteChange: whiteAfter - white.rating,
    blackChange: blackAfter - black.rating,
  };
}

/** Đổi kết quả ván thành điểm của Trắng. */
export const scoreFor = (winner: 'w' | 'b' | 'draw'): Score => (winner === 'draw' ? 0.5 : winner === 'w' ? 1 : 0);
