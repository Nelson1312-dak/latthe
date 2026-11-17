// Sảnh: vào việc ngay, không có lời chào hay khẩu hiệu.
// Trái là việc hôm nay, phải là một bài tập thật để giải ngay và sổ ván đã chơi.
//
// Bản đầu chỉ có chữ: một con số "1000" không nhãn, hai dòng việc và một khoảng
// trống to. Giờ con số nào cũng có tên, và có một bàn cờ thật để nhìn vào.

import { button, classBadge, notice, rule, sheet, sideGlyph, toolbar } from '../components/index.ts';
import { boardSvg } from '../../board/Board.ts';
import { Game, type Square } from '../../../shared/chess.ts';
import { nextPuzzle, themeName, type Puzzle } from '../../app/training.ts';
import { startPuzzle } from './train.ts';
import { auth } from '../../app/session.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { progress, type Progress } from '../../app/training.ts';
import { CLASS_LABEL } from '../../board/Board.ts';
import { END_TEXT, type EndReason } from '../../../shared/chess.ts';
import type { MoveClass } from '../../../shared/winrate.ts';

let games: GameRow[] = [];
let tienDo: Progress | null = null;
let baiTap: Puzzle | null = null;
let daHoi = false;

export function mountHome(rerender: () => void): void {
  if (daHoi || !auth.user) return;
  daHoi = true;
  void Promise.all([recentGames(), progress(), nextPuzzle()]).then(([g, p, bt]) => {
    games = g;
    tienDo = p;
    baiTap = bt.puzzle;
    rerender();
  });
}

/** Thế cờ người học thấy: sau nước đầu của đối phương trong dữ liệu Lichess. */
function puzzleView(p: Puzzle): { fen: string; side: 'w' | 'b'; last: [Square, Square] } | null {
  const g = new Game(p.fen);
  const u = p.moves[0];
  if (!u || !g.move(u.slice(0, 2) as Square, u.slice(2, 4) as Square, u[4])) return null;
  return { fen: g.fen, side: g.turn, last: [u.slice(0, 2) as Square, u.slice(2, 4) as Square] };
}

/** Quên dữ liệu khi đăng xuất. */
export function resetHome(): void {
  games = [];
  tienDo = null;
  baiTap = null;
  daHoi = false;
}

function when(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return 'vừa xong';
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hôm qua' : `${d} ngày`;
}

export function home(): string {
  const gameRow = (g: GameRow) => {
    const win = g.winner === 'draw' ? 'd' : g.winner === g.playerSide ? 'w' : 'l';
    const text = g.winner === 'draw' ? 'Hòa' : win === 'w' ? 'Thắng' : 'Thua';
    const who =
      g.mode === 'bot' ? `Máy cấp ${g.level ?? '?'}` : g.mode === 'online' ? (g.opponentName ?? 'Đối thủ') : 'Hai người';
    return `<a class="log-row" href="#/xem-lai?game=${g.id}">
      ${sideGlyph(g.playerSide)}
      <span class="log-name">${who}</span>
      <span class="log-result result-${win}">${text} · ${END_TEXT[g.reason as EndReason] ?? g.reason}</span>
      <span class="log-acc mono">${g.moveCount} nước</span>
      <span class="log-when">${when(g.createdAt)}</span>
    </a>`;
  };

  const due = tienDo?.the.due ?? 0;
  const u = auth.user;
  // Con số nào cũng phải có tên: "1000" đứng một mình không ai hiểu là gì
  const số = u
    ? `<dl class="home-stats">
        <div><dt>Elo đấu</dt><dd class="mono">${u.gameRating}</dd></div>
        <div><dt>Elo bài tập</dt><dd class="mono">${tienDo?.rating ?? u.puzzleRating}</dd></div>
        <div><dt>Chuỗi luyện</dt><dd class="mono">${tienDo?.streak ?? 0} ngày</dd></div>
      </dl>`
    : '<span class="head-meta">Học cờ vua bằng chính lỗi của mình</span>';

  const xem = baiTap ? puzzleView(baiTap) : null;
  const bàn =
    baiTap && xem
      ? `${rule('Bài tập cho bạn', '<a class="rule-link" href="#/on-tap">Bài khác</a>')}
         <button class="home-puzzle" data-home-puzzle aria-label="Giải bài tập này">
           ${boardSvg({ fen: xem.fen, orientation: xem.side, lastMove: xem.last, coordinates: false, label: 'Bài tập' })}
           <span class="home-puzzle-cap">
             <b>${themeName(baiTap.themes[0] ?? 'Bài tập')}</b>
             <span>${xem.side === 'w' ? 'Trắng' : 'Đen'} đi · độ khó <span class="mono">${baiTap.rating}</span></span>
           </span>
         </button>`
      : '';

  return `<div class="screen screen-narrow">
    <div class="screen-head home-head">
      <h1>${u ? u.name : 'Lật Cờ'}</h1>
      ${số}
      ${toolbar(
        // Bản trước hai nút này không gắn vào đâu: bấm không có gì xảy ra
        [`<span data-go="choi">${button({ label: 'Chơi với máy', kind: 'primary', icon: 'play' })}</span>`],
        [`<span data-go="ban">${button({ label: 'Tìm trận', icon: 'friends' })}</span>`],
      )}
    </div>

    <div class="home-cols">
      <div>
        ${rule('Hôm nay')}
        <div class="task-list">
          <div class="task">
            <span class="task-text">
              <b>${due ? `${due} thẻ ôn tập đến hạn` : 'Chưa có thẻ nào đến hạn'}</b>
              <span>${
                due
                  ? 'Thẻ sinh ra từ chính những nước bạn đã đi sai'
                  : 'Chơi một ván rồi xem lại, những nước sai sẽ thành thẻ ôn tập'
              }</span>
            </span>
            <span class="task-go" data-go="on-tap">${button({ label: due ? 'Ôn tập' : 'Luyện bài tập', kind: due ? 'primary' : 'secondary' })}</span>
          </div>
          <div class="task">
            <span class="task-text">
              <b>Chơi một ván</b>
              <span>Đấu với máy 8 cấp độ, hoặc hai người một máy</span>
            </span>
            <span class="task-go" data-go="choi">${button({ label: 'Vào chơi' })}</span>
          </div>
          <div class="task">
            <span class="task-text">
              <b>Đấu với người</b>
              <span>Ghép ngẫu nhiên với người cùng trình độ</span>
            </span>
            <span class="task-go" data-go="ban">${button({ label: 'Tìm trận' })}</span>
          </div>
        </div>

        ${
          tienDo?.chuDeHaySai.length
            ? `${rule('Kiểu lỗi bạn hay gặp', '<a class="rule-link" href="#/on-tap">Luyện</a>')}
               <ul class="tag-list">${tienDo.chuDeHaySai
                 .slice(0, 4)
                 .map(
                   (c) =>
                     `<li>${classBadge(c.cls as MoveClass)} ${CLASS_LABEL[c.cls as MoveClass] ?? c.cls} <b class="mono">${c.c}</b></li>`,
                 )
                 .join('')}</ul>`
            : ''
        }
      </div>

      <div>
        ${bàn}
        ${rule('Ván đã chơi', games.length ? `<a class="rule-link" href="#/xem-lai">Xem lại</a>` : '')}
        ${
          !auth.user
            ? notice('Đăng nhập để lưu ván, thẻ ôn tập và tiến độ.', 'locked', 'user')
            : games.length
              ? sheet(`<div class="log">${games.map(gameRow).join('')}</div>`)
              : notice('Chưa có ván nào. Chơi xong là tự lưu lại.', 'info', 'play')
        }
      </div>
    </div>
  </div>`;
}

/** Bấm vào bàn cờ bài tập ở Sảnh: mở đúng bài đó bên màn Ôn tập. */
export function handleHomeClick(target: HTMLElement): boolean {
  if (!target.closest('[data-home-puzzle]') || !baiTap) return false;
  startPuzzle(baiTap);
  baiTap = null;
  daHoi = false; // lần sau về Sảnh thì bốc bài mới
  location.hash = '#/on-tap';
  return true;
}
