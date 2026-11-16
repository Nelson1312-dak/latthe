// Ván với bạn qua mạng: đồng hồ đang chạy, engine và Huấn luyện viên bị tắt.
import { boardSvg } from '../../board/Board.ts';
import { button, iconButton, moveList, notice, playerStrip, rule, sheet, sideGlyph, toolbar } from '../components/index.ts';
import { fx } from '../../mock/index.ts';
import { material } from '../../../shared/fen.ts';

export function online(): string {
  const o = fx.online;
  const mat = material(o.fen);

  const row = (name: string, side: 'w' | 'b', result: 'w' | 'l' | 'd', how: string, when: string) =>
    `<a class="log-row" href="#/xem-lai">
      ${sideGlyph(side)}
      <span class="log-name">${name}</span>
      <span class="log-result result-${result}">${how}</span>
      <span class="log-when">${when}</span>
    </a>`;

  return `<div class="screen">
    <div class="screen-head">
      <h1>Ván với bạn</h1>
      <span class="head-meta">5+0 · ván xếp hạng</span>
      ${toolbar(
        [iconButton('flip', 'Lật bàn cờ'), iconButton('sound', 'Âm thanh', { pressed: true })],
        [button({ label: 'Đề nghị hòa', icon: 'draw' }), button({ label: 'Đầu hàng', kind: 'danger', icon: 'resign' })],
      )}
    </div>

    <div class="game">
      <div class="game-board">
        ${playerStrip({
          name: 'Hùng',
          side: 'b',
          rating: 1240,
          clockMs: 34200,
          clockState: 'low',
          status: 'đang nghĩ',
          took: mat.blackTook,
          diff: -mat.diff,
        })}
        <div class="board-row">
          ${boardSvg({ fen: o.fen, lastMove: ['f6', 'd5'], label: 'Bàn cờ ván với bạn, lượt của Trắng' })}
        </div>
        ${playerStrip({
          name: 'Nelson',
          side: 'w',
          you: true,
          rating: 1180,
          clockMs: 183000,
          clockState: 'running',
          took: mat.whiteTook,
          diff: mat.diff,
        })}
      </div>

      <div class="game-side">
        ${sheet(
          notice('Hùng mất kết nối · còn 47 giây để vào lại', 'danger', 'clock'),
          moveList(
            o.history.map((san) => ({ san })),
            o.history.length,
          ),
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván')}
            ${iconButton('prev', 'Lùi một nước')}
            ${iconButton('next', 'Tiến một nước', { disabled: true })}
            ${iconButton('last', 'Tới nước mới nhất', { disabled: true })}
          </div>`,
          `<div class="locked-block">
            ${notice('Engine và Huấn luyện viên mở lại sau khi ván kết thúc', 'locked', 'engine')}
          </div>`,
        )}

        ${rule('Mời bạn chơi')}
        <div class="invite">
          <code>co.vn/v/7KQ2M9</code>
          ${button({ label: 'Sao chép', icon: 'copy' })}
        </div>

        ${rule('5 ván gần nhất với bạn bè')}
        ${sheet(
          `<div class="log">
            ${row('Hùng', 'w', 'w', 'Thắng · chiếu hết', 'hôm qua')}
            ${row('Minh', 'b', 'd', 'Hòa · thiếu quân', '2 ngày')}
            ${row('Hùng', 'b', 'l', 'Thua · hết giờ', '4 ngày')}
            ${row('Minh', 'w', 'w', 'Thắng · đầu hàng', '5 ngày')}
            ${row('Hùng', 'w', 'w', 'Thắng · hết giờ', '6 ngày')}
          </div>`,
        )}
      </div>
    </div>
  </div>`;
}
