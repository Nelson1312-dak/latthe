// Xem lại ván, đang dừng ở nước Sai nghiêm trọng 11.Qg4.
// Sổ nước đi là nhân vật chính, không phải mấy ô số liệu.
import { boardSvg, CLASS_LABEL } from '../../board/Board.ts';
import {
  button,
  classBadge,
  coachPanel,
  evalBar,
  iconButton,
  moveList,
  playerStrip,
  rule,
  sheet,
  toolbar,
} from '../components/index.ts';
import { fx, squaresOf, type FixtureMove } from '../../mock/index.ts';
import type { MoveClass } from '../../../shared/winrate.ts';
import { material } from '../../../shared/fen.ts';

/** Biểu đồ đánh giá: vùng trắng là phần của Trắng, chấm ở các nước hỏng. */
function evalGraph(moves: FixtureMove[], currentPly: number): string {
  const w = 360;
  const h = 72;
  const y = (m: FixtureMove) => {
    const s = m.scoreAfter;
    const pct = s.mate !== undefined ? (s.mate > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.004 * s.cp));
    return h - pct * h;
  };
  const step = w / moves.length;
  const pts = moves.map((m, i) => `${(i * step).toFixed(1)},${y(m).toFixed(1)}`);
  const dots = moves
    .map((m, i) =>
      m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss'
        ? `<circle cx="${(i * step).toFixed(1)}" cy="${y(m).toFixed(1)}" r="3" fill="var(--cls-${m.cls})" stroke="#26241f" stroke-width="1.5"/>`
        : '',
    )
    .join('');
  const cx = ((currentPly - 1) * step).toFixed(1);
  return `<svg class="evalgraph" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Biểu đồ đánh giá theo nước đi">
    <rect width="${w}" height="${h}" fill="#26241f"/>
    <path d="M0,${h} L${pts.join(' L')} L${w},${h} Z" fill="#e8e4db"/>
    <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#4a473f" stroke-dasharray="3 3"/>
    <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="var(--accent)" stroke-width="1.5"/>
    ${dots}
  </svg>`;
}

export function review(): string {
  const g = fx.game1;
  const ply = 21;
  const m = g.moves[ply - 1];
  const [from, to] = squaresOf(m.uci);
  const mat = material(m.fenAfter);
  const best = m.best[0];

  const counts: Record<string, number> = {};
  for (const x of g.moves) counts[x.cls] = (counts[x.cls] ?? 0) + 1;
  const tally = (['blunder', 'mistake', 'inaccuracy', 'best', 'good', 'book'] as MoveClass[])
    .filter((c) => counts[c])
    .map((c) => `<li>${classBadge(c)} ${CLASS_LABEL[c]} <b class="mono">${counts[c]}</b></li>`)
    .join('');

  return `<div class="screen">
    <div class="screen-head">
      <h1>Xem lại ván</h1>
      <span class="head-meta">${g.opening} · 2 giờ trước</span>
      ${toolbar(
        [iconButton('flip', 'Lật bàn cờ')],
        [button({ label: 'Chơi lại từ đây', icon: 'play' })],
      )}
    </div>

    <div class="game">
      <div class="game-board">
        ${playerStrip({ name: 'Máy cấp 4', side: 'b', bot: true, rating: 1550, took: mat.blackTook, diff: -mat.diff, accuracy: g.accuracy.b })}
        <div class="board-row">
          <div class="evalbar-wrap only-desktop">${evalBar(m.scoreAfter)}</div>
          ${boardSvg({
            fen: m.fenAfter,
            lastMove: [from, to],
            badge: { square: to, cls: m.cls },
            arrows: [{ from: 'f3', to: 'd1', kind: 'coach' }],
            label: `Thế cờ sau nước ${Math.ceil(ply / 2)}.${m.san}`,
          })}
        </div>
        ${playerStrip({ name: 'Nelson', side: 'w', you: true, rating: 1180, took: mat.whiteTook, diff: mat.diff, accuracy: g.accuracy.w })}
        <div class="only-mobile">${evalBar(m.scoreAfter, 'horizontal')}</div>
      </div>

      <div class="game-side">
        ${sheet(
          coachPanel({
            cls: m.cls,
            move: `11.${m.san}`,
            side: 'w',
            text: 'Hậu đi sang g4 nhưng bỏ trống ô c2. Sau 11…Nxc2+ Đen vừa chiếu vừa ăn Xe, và bạn mất chất nặng.',
            better: { san: best.san, side: 'w', why: 'Hậu lùi về vẫn giữ được ô c2' },
            source: 'llm',
            actions:
              button({ label: 'Xem nước tốt hơn', icon: 'hint' }) +
              button({ label: 'Thử lại từ đây', kind: 'primary', icon: 'play' }),
          }),
          `<div class="graph-block">
            ${rule('Diễn biến', '<span class="rule-note">34 nước</span>')}
            ${evalGraph(g.moves, ply)}
            <div class="graph-nav">
              ${button({ label: 'Nước hỏng trước', icon: 'prev', disabled: true })}
              ${button({ label: 'Nước hỏng tiếp theo', icon: 'next' })}
            </div>
            <ul class="tally">${tally}</ul>
          </div>`,
          moveList(
            g.moves.map((x) => ({ san: x.san, cls: x.cls, score: x.scoreAfter })),
            ply,
            { scores: true },
          ),
          `<div class="move-bar">
            ${iconButton('first', 'Về đầu ván')}
            ${iconButton('prev', 'Lùi một nước')}
            ${iconButton('next', 'Tiến một nước')}
            ${iconButton('last', 'Tới nước cuối')}
            <span class="spacer"></span>
            ${button({ label: 'Xuất PGN', kind: 'text', icon: 'copy' })}
          </div>`,
        )}
      </div>
    </div>
  </div>`;
}
