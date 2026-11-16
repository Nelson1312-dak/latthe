// Chơi với máy, đang dùng gợi ý nấc 2 (tô ô quân cần đi, chưa chỉ nước).
import { boardSvg } from '../../board/Board.ts';
import {
  button,
  coachPanel,
  evalBar,
  hintButton,
  iconButton,
  moveList,
  playerStrip,
  sheet,
  toolbar,
} from '../components/index.ts';
import { fx, squaresOf } from '../../mock/index.ts';
import { material } from '../../../shared/fen.ts';

export function playBot(): string {
  const g = fx.game1;
  const ply = 20; // lượt Trắng ở nước 11, ngay trước nước hỏng 11.Qg4
  const pos = g.moves[ply];
  const prev = g.moves[ply - 1];
  const mat = material(pos.fenBefore);

  return `<div class="screen">
    <div class="screen-head">
      <h1>Chơi với máy</h1>
      <span class="head-meta">${g.opening}</span>
      ${toolbar(
        [iconButton('flip', 'Lật bàn cờ'), iconButton('sound', 'Âm thanh', { pressed: true })],
        [button({ label: 'Đề nghị hòa', icon: 'draw' }), button({ label: 'Đầu hàng', kind: 'danger', icon: 'resign' })],
      )}
    </div>

    <div class="game">
      <div class="game-board">
        ${playerStrip({
          name: 'Máy cấp 4',
          side: 'b',
          bot: true,
          rating: 1550,
          clockMs: 521000,
          took: mat.blackTook,
          diff: -mat.diff,
        })}
        <div class="board-row">
          <div class="evalbar-wrap only-desktop">${evalBar(pos.scoreBefore)}</div>
          ${boardSvg({
            fen: pos.fenBefore,
            lastMove: squaresOf(prev.uci),
            selected: 'f3',
            legal: ['d1', 'e2', 'e3', 'f4', 'f5', 'g4', 'h5'],
            legalCaptures: ['f6'],
            label: 'Bàn cờ, lượt Trắng ở nước 11, đang chọn quân Hậu f3',
          })}
        </div>
        ${playerStrip({
          name: 'Nelson',
          side: 'w',
          you: true,
          rating: 1180,
          clockMs: 552000,
          clockState: 'running',
          took: mat.whiteTook,
          diff: mat.diff,
        })}
        <div class="only-mobile">${evalBar(pos.scoreBefore, 'horizontal')}</div>
      </div>

      <div class="game-side">
        ${sheet(
          moveList(
            g.moves.slice(0, ply).map((m) => ({ san: m.san, cls: m.cls })),
            ply,
          ),
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván')}
            ${iconButton('prev', 'Lùi một nước')}
            ${iconButton('next', 'Tiến một nước', { disabled: true })}
            ${iconButton('last', 'Tới nước mới nhất', { disabled: true })}
            <span class="spacer"></span>
            ${hintButton(2)}
          </div>`,
          coachPanel({
            text: 'Mã đen vừa nhảy vào d4 và đang nhòm Hậu của bạn. Hãy nhìn con Hậu ở f3 trước khi đi tiếp.',
            source: 'llm',
            actions: button({ label: 'Xem nước cụ thể', icon: 'hint' }),
          }),
        )}
      </div>
    </div>
  </div>`;
}
