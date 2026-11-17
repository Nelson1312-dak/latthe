// Sảnh: vào là đánh được ngay.
//
// Sảnh dùng chung đúng bàn cờ của màn Chơi (`play()`), còn phần riêng của Sảnh
// — việc hôm nay và sổ ván đã chơi — gắn xuống dưới cột phải. Trước đây Sảnh là
// một trang chữ riêng: muốn đánh phải bấm thêm một nhịp nữa mới thấy bàn cờ.

import { button, classBadge, notice, rule, sheet, sideGlyph, stats } from '../components/index.ts';
import { auth } from '../../app/session.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { progress, type Progress } from '../../app/training.ts';
import { CLASS_LABEL } from '../../board/Board.ts';
import { END_TEXT, type EndReason } from '../../../shared/chess.ts';
import type { MoveClass } from '../../../shared/winrate.ts';

let games: GameRow[] = [];
let tienDo: Progress | null = null;
let daHoi = false;

export function mountHome(rerender: () => void): void {
  if (daHoi || !auth.user) return;
  daHoi = true;
  void Promise.all([recentGames(), progress()]).then(([g, p]) => {
    games = g;
    tienDo = p;
    rerender();
  });
}

/** Quên dữ liệu khi đăng xuất. */
export function resetHome(): void {
  games = [];
  tienDo = null;
  daHoi = false;
}

function when(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return 'vừa xong';
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hôm qua' : `${d} ngày`;
}

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

/** Phần riêng của Sảnh, gắn xuống dưới cột phải của bàn cờ. */
export function homeSide(): string {
  const due = tienDo?.the.due ?? 0;
  const u = auth.user;

  return `
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
          <b>Đấu với người</b>
          <span>Ghép ngẫu nhiên với người cùng trình độ</span>
        </span>
        <span class="task-go" data-go="ban">${button({ label: 'Tìm trận' })}</span>
      </div>
    </div>

    ${
      u
        ? `${rule('Trình độ của bạn')}
           ${stats([
             ['Elo đấu với người', String(u.gameRating)],
             ['Elo bài tập', String(tienDo?.rating ?? u.puzzleRating)],
             ['Chuỗi luyện', `${tienDo?.streak ?? 0} ngày`],
           ])}`
        : ''
    }

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

    ${rule('Ván đã chơi', games.length ? `<a class="rule-link" href="#/xem-lai">Xem lại</a>` : '')}
    ${
      !auth.user
        ? notice('Đăng nhập để lưu ván, thẻ ôn tập và tiến độ.', 'locked', 'user')
        : games.length
          ? sheet(`<div class="log">${games.slice(0, 6).map(gameRow).join('')}</div>`)
          : notice('Chưa có ván nào. Chơi xong là tự lưu lại.', 'info', 'play')
    }`;
}
