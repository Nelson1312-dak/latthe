/**
 * Điểm vào. Ghép Economy + Game + UI, rồi trông chừng việc tab bị ẩn.
 *
 * CHỖ DỄ SAI NHẤT nằm ở đây: khi tab bị ẩn phải DỪNG HẲN ba thứ cùng lúc — mô phỏng, vòng
 * render, VÀ tự động lưu. Bỏ quên cái thứ ba là hỏng toàn bộ phần bù giờ: bộ đếm 5 giây sẽ
 * dập lastSavedTimestamp thành "bây giờ" suốt lúc bạn đi họp, nên quay lại chẳng được gì.
 * Trình duyệt có bóp setInterval xuống một lần mỗi giây khi chạy nền, nhưng bóp không phải
 * là dừng.
 */
import { Economy } from './Economy';
import { Game } from './Game';
import { UIManager } from './UIManager';

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Thiếu <canvas id="scene"> trong index.html');

const economy = Economy.load();
const game = new Game(canvas, economy);
const ui = new UIManager(economy, game);

/**
 * Bù giờ bằng cách tua nhanh chính ván game. Tua cả MÀN MÂY nữa, nên người chơi đi ăn trưa
 * về có thể thấy đội thám hiểm đã vén thêm được một vùng — đúng như khi ngồi nhìn.
 */
const stepWorld = (dt: number): void => {
  game.workers.update(dt, false);
  game.fog.update(dt, economy.state.units, game.target,
    1 / (1 - economy.bonus.survey), false);
};

const first = economy.collectOffline(Date.now(), stepWorld);
if (first) ui.showOffline(first);

economy.startAutosave();
game.start();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    economy.save();
    economy.stopAutosave();
    game.setPaused(true);
    return;
  }
  const report = economy.collectOffline(Date.now(), stepWorld);
  if (report) ui.showOffline(report);
  economy.startAutosave();
  // Người chơi tự bấm tạm dừng thì quay lại vẫn phải thấy nó dừng, không tự chạy tiếp.
  game.setPaused(ui.manualPaused);
});

// Safari trên iOS nhiều khi bỏ qua visibilitychange lúc thoát; pagehide thì chắc hơn.
window.addEventListener('pagehide', () => economy.save());

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  ui.setPaused(!game.isPaused);
});

// Để nghịch trong Console: __game.economy.deposit('gold', 5000)
Object.assign(window as unknown as Record<string, unknown>, { __game: { economy, game, ui } });
