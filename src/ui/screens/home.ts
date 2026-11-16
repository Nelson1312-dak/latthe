// Sảnh: vào việc ngay, không có lời chào hay khẩu hiệu.
// Trái là việc hôm nay, phải là sổ ván đã chơi.
import { boardSvg } from '../../board/Board.ts';
import { button, classBadge, figurine, rule, sheet, sideGlyph, toolbar } from '../components/index.ts';
import { fx, squaresOf } from '../../mock/index.ts';

export function home(): string {
  const g = fx.game1;
  const blunder = g.moves.find((m) => m.cls === 'blunder')!;
  const [, to] = squaresOf(blunder.uci);
  const last = g.moves[g.moves.length - 1];

  const gameRow = (opponent: string, side: 'w' | 'b', result: 'w' | 'l' | 'd', how: string, acc: number, when: string) =>
    `<a class="log-row" href="#/xem-lai">
      ${sideGlyph(side)}
      <span class="log-name">${opponent}</span>
      <span class="log-result result-${result}">${how}</span>
      <span class="log-acc mono">${acc}%</span>
      <span class="log-when">${when}</span>
    </a>`;

  return `<div class="screen screen-narrow">
    <!-- Tên app đã nằm trên header, ở đây không lặp lại nữa -->
    <h1 class="sr">Sảnh</h1>
    <div class="screen-head">
      <span class="head-meta"><span class="mono">1180</span> · chuỗi 5 ngày</span>
      ${toolbar([button({ label: 'Chơi với máy', kind: 'primary', icon: 'play' })], [button({ label: 'Mời bạn', icon: 'friends' })])}
    </div>

    <div class="home-cols">
      <div>
        ${rule('Hôm nay')}
        <div class="task-list">
          <a class="task" href="#/on-tap">
            <span class="task-board">${boardSvg({ fen: blunder.fenAfter, lastMove: squaresOf(blunder.uci), badge: { square: to, cls: 'blunder' }, coordinates: false, label: 'Thế cờ sau nước 11.Qg4' })}</span>
            <span class="task-text">
              <b>7 thẻ ôn tập đến hạn</b>
              <span>Bắt đầu bằng nước ${figurine('Qg4', 'w')} trong ván với máy cấp 4 ${classBadge('blunder')}</span>
            </span>
            <span class="task-go">${button({ label: 'Ôn tập' })}</span>
          </a>
          <a class="task" href="#/choi">
            <span class="task-board">${boardSvg({ fen: last.fenAfter, coordinates: false, label: 'Ván còn dở' })}</span>
            <span class="task-text">
              <b>Ván còn dở · máy cấp 4</b>
              <span>Đến lượt bạn ở nước 18, bạn đang kém một Xe</span>
            </span>
            <span class="task-go">${button({ label: 'Chơi tiếp' })}</span>
          </a>
        </div>

        ${rule('Chủ đề bạn hay sai', '<a class="rule-link" href="#/on-tap">Luyện</a>')}
        <ul class="tag-list">
          <li>Để hở quân <b class="mono">6</b></li>
          <li>Đòn đôi <b class="mono">4</b></li>
          <li>Bỏ lỡ chiếu hết <b class="mono">2</b></li>
        </ul>
      </div>

      <div>
        ${rule('Ván đã chơi', '<a class="rule-link" href="#/xem-lai">Tất cả 24 ván</a>')}
        ${sheet(
          `<div class="log">
            ${gameRow('Máy cấp 4', 'w', 'l', 'Thua · chiếu hết', 90.6, '2 giờ')}
            ${gameRow('Hùng', 'b', 'w', 'Thắng · hết giờ', 84.2, 'hôm qua')}
            ${gameRow('Máy cấp 3', 'w', 'w', 'Thắng · đầu hàng', 88.1, 'hôm qua')}
            ${gameRow('Minh', 'w', 'd', 'Hòa · 3 lần lặp', 91.4, '2 ngày')}
            ${gameRow('Máy cấp 4', 'b', 'l', 'Thua · đầu hàng', 79.8, '3 ngày')}
            ${gameRow('Hùng', 'w', 'w', 'Thắng · chiếu hết', 86.0, '4 ngày')}
            ${gameRow('Máy cấp 3', 'b', 'w', 'Thắng · hết giờ', 85.3, '4 ngày')}
            ${gameRow('Minh', 'b', 'l', 'Thua · chiếu hết', 77.2, '5 ngày')}
            ${gameRow('Máy cấp 2', 'w', 'w', 'Thắng · chiếu hết', 93.7, '6 ngày')}
            ${gameRow('Hùng', 'b', 'd', 'Hòa · hết nước đi', 89.5, '1 tuần')}
          </div>`,
        )}
      </div>
    </div>
  </div>`;
}
