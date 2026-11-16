// Sảnh: tiếp tục việc đang dở, vào chơi, và những ván gần đây.
import { boardSvg } from '../../board/Board.ts';
import { button } from '../components/index.ts';
import { fx, squaresOf } from '../../mock/index.ts';
import { icon } from '../icons.ts';

export function home(): string {
  const g = fx.game1;
  const last = g.moves[g.moves.length - 1];
  const blunder = g.moves.find((m) => m.cls === 'blunder')!;

  const row = (opponent: string, result: 'w' | 'l' | 'd', text: string, when: string, acc: number) =>
    `<div class="game-row"><span>${opponent}</span>` +
    `<span class="result-${result}">${text}</span>` +
    `<span class="muted mono">${acc}% · ${when}</span></div>`;

  return `<div class="screen">
    <div class="hero">
      <div class="hero-text">
        <h1>Chào Nelson</h1>
        <p>Ván gần nhất bạn mất quân ở nước 11.Qg4. Ôn lại thế đó trước khi chơi tiếp.</p>
        <div class="spec-row" style="margin-top:var(--s-4)">
          ${button({ label: 'Chơi với máy', kind: 'primary', icon: 'play' })}
          ${button({ label: 'Mời bạn chơi', icon: 'friends' })}
        </div>
      </div>
      <div class="hero-board">
        ${boardSvg({ fen: blunder.fenAfter, lastMove: squaresOf(blunder.uci), badge: { square: squaresOf(blunder.uci)[1], cls: 'blunder' }, coordinates: false, label: 'Thế cờ sau nước 11.Qg4' })}
      </div>
    </div>

    <h2 style="margin-bottom:var(--s-3)">Hôm nay</h2>
    <div class="grid grid-2" style="margin-bottom:var(--s-6)">
      <div class="continue">
        ${icon('cards', 22)}
        <div class="stat"><span class="stat-value">7</span><span class="label">thẻ ôn tập đến hạn</span></div>
        ${button({ label: 'Ôn tập', kind: 'primary' })}
      </div>
      <div class="continue">
        <div class="continue-board">
          ${boardSvg({ fen: last.fenAfter, coordinates: false, label: 'Ván đang dở' })}
        </div>
        <div class="stat"><span class="stat-value">Nước 17</span><span class="label">ván với máy cấp 4 còn dở</span></div>
        ${button({ label: 'Chơi tiếp' })}
      </div>
    </div>

    <h2 style="margin-bottom:var(--s-3)">Ván gần đây</h2>
    <div class="panel recent">
      ${row('Máy cấp 4', 'l', 'Thua · chiếu hết', '2 giờ trước', 90.6)}
      ${row('Hùng', 'w', 'Thắng · hết giờ', 'hôm qua', 84.2)}
      ${row('Máy cấp 3', 'w', 'Thắng · đầu hàng', 'hôm qua', 88.1)}
      ${row('Minh', 'd', 'Hòa · 3 lần lặp', '2 ngày trước', 91.4)}
    </div>
  </div>`;
}
