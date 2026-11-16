// Ván với bạn qua mạng: đồng hồ đang chạy, engine và Huấn luyện viên bị tắt.
import { boardSvg } from '../../board/Board.ts';
import { button, iconButton, moveList, playerStrip, toast } from '../components/index.ts';
import { fx } from '../../mock/index.ts';
import { icon } from '../icons.ts';
import { material } from '../../../shared/fen.ts';

export function online(): string {
  const o = fx.online;
  const mat = material(o.fen);

  return `<div class="screen">
    <div class="screen-head">
      <h1>Ván với bạn</h1>
      <span class="muted">5+0 · ván xếp hạng</span>
      ${iconButton('flip', 'Lật bàn cờ')}
      ${button({ label: 'Đề nghị hòa', icon: 'draw' })}
      ${button({ label: 'Đầu hàng', kind: 'danger', icon: 'resign' })}
    </div>

    <div class="game">
      <div class="game-board">
        ${playerStrip({
          name: 'Hùng',
          rating: 1240,
          clockMs: 34200,
          clockState: 'low',
          status: 'đang nghĩ',
          took: mat.blackTook,
          diff: -mat.diff,
        })}
        <div class="board-row">${boardSvg({
          fen: o.fen,
          lastMove: ['f6', 'd5'],
          label: 'Bàn cờ ván với bạn, lượt của Trắng',
        })}</div>
        ${playerStrip({
          name: 'Nelson',
          you: true,
          rating: 1180,
          clockMs: 183000,
          clockState: 'running',
          took: mat.whiteTook,
          diff: mat.diff,
        })}
      </div>

      <div class="game-side">
        <div class="locked">${icon('engine', 16)} Engine tắt trong ván</div>
        <div class="locked">${icon('coach', 16)} Huấn luyện viên mở lại sau khi ván kết thúc</div>

        <div class="panel move-panel">
          ${moveList(o.history.map((san) => ({ san })), o.history.length)}
          <div class="move-bar">
            ${iconButton('first', 'Về đầu ván')}
            ${iconButton('prev', 'Lùi một nước')}
            ${iconButton('next', 'Tiến một nước', { disabled: true })}
            ${iconButton('last', 'Tới nước mới nhất', { disabled: true })}
          </div>
        </div>

        ${toast('Hùng mất kết nối · còn 47 giây để vào lại', 'danger')}

        <div class="card">
          <span class="label">Mời thêm bạn</span>
          <div class="invite">
            ${icon('friends', 18)}
            <code>co.vn/v/7KQ2M9</code>
            ${button({ label: 'Sao chép', icon: 'copy' })}
          </div>
          <span class="muted" style="font-size:var(--fs-sm)">Ván mới sẽ dùng cùng mức thời gian 5+0.</span>
        </div>

        <div class="card">
          <span class="label">5 ván gần nhất với bạn bè</span>
          <div class="game-row"><span>Hùng</span><span class="result-w">Thắng</span><span class="muted mono">hôm qua</span></div>
          <div class="game-row"><span>Minh</span><span class="result-d">Hòa</span><span class="muted mono">2 ngày</span></div>
          <div class="game-row"><span>Hùng</span><span class="result-l">Thua</span><span class="muted mono">4 ngày</span></div>
          <div class="game-row"><span>Minh</span><span class="result-w">Thắng</span><span class="muted mono">5 ngày</span></div>
          <div class="game-row"><span>Hùng</span><span class="result-w">Thắng</span><span class="muted mono">6 ngày</span></div>
        </div>
      </div>
    </div>
  </div>`;
}
