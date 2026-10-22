/**
 * Điểm vào. Ghép Economy + Game + UI, rồi trông chừng việc tab bị ẩn.
 *
 * CHỖ DỄ SAI NHẤT nằm ở đây, nên nói rõ: khi tab bị ẩn thì phải DỪNG HẲN ba thứ cùng lúc —
 * mô phỏng, vòng render, VÀ tự động lưu.
 *
 * Bỏ quên cái thứ ba là hỏng toàn bộ phần tính tiền vắng mặt: bộ đếm 5 giây sẽ dập
 * lastSavedTimestamp thành "bây giờ" suốt cả lúc bạn đi họp, nên lúc quay lại khoảng cách đo
 * được chỉ còn vài giây và người chơi không nhận được gì. Trình duyệt có bóp setInterval
 * xuống một lần mỗi giây khi chạy nền, nhưng bóp không phải là dừng.
 *
 * Trình tự lúc ẩn:  lưu một lần (đóng dấu mốc) -> tắt tự động lưu -> dừng mô phỏng.
 * Trình tự lúc hiện: tua bù giờ -> bật lại tự động lưu -> chạy tiếp, trừ khi chính người chơi
 * đã bấm tạm dừng trước đó.
 */
import { Economy } from './Economy';
import { Game } from './Game';
import { UI } from './UI';

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Thiếu <canvas id="scene"> trong index.html');

const economy = Economy.load();
const game = new Game(canvas, economy);
const ui = new UI(economy, game);

/**
 * Bù giờ vắng mặt bằng cách TUA NHANH CHÍNH VÁN GAME — Economy gọi ngược lại hàm này để
 * nhích thợ. Nhờ vậy số xu trả cho người chơi đến từ đúng đoạn mã chạy lúc họ đang ngồi nhìn,
 * kể cả khi kho đầy giữa chừng hay xưởng phải dừng vì hàng ùn.
 */
const stepWorkers = (dt: number): void => game.workers.update(dt);

// Lần mở trang cũng là một lần "quay lại": mốc thời gian lấy từ bản lưu của phiên trước.
const firstReport = economy.collectOffline(Date.now(), stepWorkers);
if (firstReport) ui.showOffline(firstReport);

economy.startAutosave();
game.start();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    economy.save();
    economy.stopAutosave();
    game.setPaused(true);
    return;
  }
  const report = economy.collectOffline(Date.now(), stepWorkers);
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

// Để nghịch trong Console: __game.economy.addCoins(5000)
Object.assign(window as unknown as Record<string, unknown>, { __game: { economy, game, ui } });
