// Sảnh: vào là đánh được ngay.
//
// Sảnh dùng chung đúng bàn cờ của màn Chơi (`play()`), còn phần riêng của Sảnh
// — việc hôm nay và sổ ván đã chơi — gắn xuống dưới cột phải. Trước đây Sảnh là
// một trang chữ riêng: muốn đánh phải bấm thêm một nhịp nữa mới thấy bàn cờ.

import { classBadge, notice, rule, sheet, sideGlyph, levelRow } from '../components/index.ts';
import { icon, type IconName } from '../icons.ts';
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
/**
 * Một dòng "việc nên làm": cả dòng bấm được, icon bên trái, mũi tên bên phải.
 *
 * Bản trước là hộp lồng trong hộp, câu chữ bị nút bấm ép xuống hai dòng, hai
 * bên còn thừa hai dải nền khác màu — trông như dựng dở.
 */
function quickRow(go: string, name: IconName, title: string, note: string): string {
  return (
    `<button class="quick" data-go="${go}">` +
    `<span class="quick-icon">${icon(name, 20)}</span>` +
    `<span class="quick-text"><b>${title}</b><span>${note}</span></span>` +
    `${icon('next', 16)}</button>`
  );
}

export function homeSide(): string {
  const due = tienDo?.the.due ?? 0;
  const u = auth.user;

  return `
    ${rule('Hôm nay')}
    <div class="quick-list">
      ${quickRow(
        'on-tap',
        'cards',
        due ? `Ôn ${due} thẻ lỗi` : 'Luyện bài tập',
        due ? 'Từ chính những nước bạn đi sai' : 'Chưa có thẻ nào đến hạn',
      )}
      ${quickRow('ban', 'friends', 'Đấu với người', 'Ghép với người cùng trình độ')}
      ${quickRow('hoc', 'learn', 'Học chiến thuật', 'Bài ngắn, có bài tập kèm theo')}
    </div>

    ${
      u
        ? `${rule('Trình độ của bạn')}
           ${levelRow([
             ['Elo online', String(u.gameRating)],
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
