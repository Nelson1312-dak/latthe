// Chế độ của tab Chơi: đánh với máy (gồm cả hai người một máy) hay đấu với
// người qua mạng. Hai thứ này từng là hai tab riêng (Chơi / Đấu); giờ chung
// một tab, một bàn cờ, chọn chế độ ở đầu cột phải.

export type PlayMode = 'machine' | 'online';

let mode: PlayMode = 'machine';

try {
  if (sessionStorage.getItem('play-mode') === 'online') mode = 'online';
} catch {
  /* chế độ riêng tư: mặc định đánh với máy */
}

export const playMode = (): PlayMode => mode;

export function setPlayMode(m: PlayMode): void {
  mode = m;
  try {
    sessionStorage.setItem('play-mode', m);
  } catch {
    /* bỏ qua */
  }
}
