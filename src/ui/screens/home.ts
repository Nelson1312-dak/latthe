// Sảnh: vào là đánh được ngay.
//
// Sảnh dùng chung đúng bàn cờ của màn Chơi (`play()`), còn phần riêng của Sảnh
// — việc hôm nay và sổ ván đã chơi — gắn xuống dưới cột phải. Trước đây Sảnh là
// một trang chữ riêng: muốn đánh phải bấm thêm một nhịp nữa mới thấy bàn cờ.

import { classBadge, esc, notice, rule, sheet, sideGlyph, levelRow } from '../components/index.ts';
import { currentDaily, loadDaily } from '../../app/daily.ts';
import { icon, type IconName } from '../icons.ts';
import { auth } from '../../app/session.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { progress, type Progress } from '../../app/training.ts';
import { CLASS_LABEL } from '../../board/Board.ts';
import { END_TEXT, type EndReason } from '../../../shared/chess.ts';
import type { MoveClass } from '../../../shared/winrate.ts';
import { loadCoach, type CoachData } from '../../app/coach.ts';
import { MOTIF_NAME } from '../../../shared/coach.ts';

let games: GameRow[] = [];
let tienDo: Progress | null = null;
/** Huấn luyện viên: bài nên học tiếp và lỗi hay lặp lại (đọc từ lịch sử ván). */
let coach: CoachData | null = null;
let daHoi = false;

let hỏiNgày = false;

export function mountHome(rerender: () => void): void {
  // Bài tập của ngày: cả khách cũng thấy
  if (!hỏiNgày) {
    hỏiNgày = true;
    void loadDaily().then((d) => d && rerender());
  }
  if (daHoi || !auth.user) return;
  daHoi = true;
  void Promise.all([recentGames(), progress(), loadCoach()]).then(([g, p, c]) => {
    games = g;
    tienDo = p;
    coach = c;
    rerender();
  });
}

/** Quên dữ liệu khi đăng xuất. */
export function resetHome(): void {
  games = [];
  tienDo = null;
  coach = null;
  daHoi = false;
  hỏiNgày = false;
}

function when(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return 'vừa xong';
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hôm qua' : `${d} ngày`;
}

export const gameRow = (g: GameRow) => {
  const win = g.winner === 'draw' ? 'd' : g.winner === g.playerSide ? 'w' : 'l';
  const text = g.winner === 'draw' ? 'Hòa' : win === 'w' ? 'Thắng' : 'Thua';
  const who =
    g.mode === 'bot' ? `Máy cấp ${g.level ?? '?'}` : g.mode === 'online' ? (g.opponentName ?? 'Đối thủ') : 'Hai người';
  return `<a class="log-row" href="#/xem-lai?game=${g.id}">
    ${sideGlyph(g.playerSide)}
    <span class="log-name">${esc(who)}</span>
    <span class="log-result result-${win}">${text} · ${END_TEXT[g.reason as EndReason] ?? g.reason}</span>
    ${g.accuracy != null ? `<span class="log-acc mono" title="Độ chính xác">${g.accuracy.toFixed(1)}</span>` : '<span class="log-acc"></span>'}
    <span class="log-when">${g.moveCount} nước · ${when(g.createdAt)}</span>
  </a>`;
};

/** Phần riêng của Sảnh, gắn xuống dưới cột phải của bàn cờ. */
/**
 * Một dòng "việc nên làm": cả dòng bấm được, icon bên trái, mũi tên bên phải.
 *
 * Bản trước là hộp lồng trong hộp, câu chữ bị nút bấm ép xuống hai dòng, hai
 * bên còn thừa hai dải nền khác màu — trông như dựng dở.
 */
/**
 * Dòng "Hôm nay" của Huấn luyện viên: đủ dữ liệu thì gợi ý đúng bài nên học
 * (kèm lý do: lỗi bạn hay lặp lại nhất); chưa đủ thì mời mở tab Huấn luyện viên.
 */
function coachRow(): string {
  const bài = coach?.lessons[0];
  const lỗi = coach?.facts?.motifs[0];
  if (bài) {
    return quickRow(
      `hoc?bai=${bài.id}`,
      'coach',
      `Nên học: ${bài.title}`,
      lỗi ? `${lỗi.count} lần ${MOTIF_NAME[lỗi.kind]}` : '',
    );
  }
  if (auth.user) return quickRow('huan-luyen', 'coach', 'Huấn luyện viên', '');
  return quickRow('hoc', 'learn', 'Học chiến thuật', '');
}

function quickRow(go: string, name: IconName, title: string, note: string): string {
  return (
    `<button class="quick" data-go="${go}">` +
    `<span class="quick-icon">${icon(name, 20)}</span>` +
    `<span class="quick-text"><b>${title}</b>${note ? `<span>${note}</span>` : ''}</span>` +
    `${icon('next', 16)}</button>`
  );
}

/** Dòng "Bài tập của ngày": trạng thái hôm nay và chuỗi ngày. */
function dailyRow(): string {
  const d = currentDaily();
  if (!d?.puzzle) return '';
  const me = d.me;
  const chuỗi = me?.streak ? ` · chuỗi ${me.streak} ngày` : '';
  const ghi = !me?.done ? `chưa giải${chuỗi}` : me.correct ? `đã giải${chuỗi}` : 'chưa đúng, mai có bài mới';
  return (
    `<button class="quick${me?.done ? '' : ' is-due'}" data-daily>` +
    `<span class="quick-icon">${icon(me?.done && me.correct ? 'check' : 'flame', 20)}</span>` +
    `<span class="quick-text"><b>Bài tập của ngày</b><span>${ghi}</span></span>` +
    `${icon('next', 16)}</button>`
  );
}

export function homeSide(): string {
  const due = tienDo?.the.due ?? 0;
  const u = auth.user;

  return `
    ${rule('Hôm nay')}
    <div class="quick-list">
      ${dailyRow()}
      ${quickRow(
        'on-tap',
        'cards',
        due ? 'Ôn thẻ lỗi' : 'Luyện bài tập',
        due ? `${due} thẻ đến hạn` : '',
      )}
      ${quickRow('ban', 'friends', 'Đấu với người', u ? `Elo ${u.gameRating}` : '')}
      ${coachRow()}
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
      coach?.facts?.motifs.length
        ? `${rule('Lỗi bạn hay lặp lại', '<a class="rule-link" href="#/huan-luyen">Huấn luyện viên</a>')}
           <ul class="tag-list">${coach.facts.motifs
             .slice(0, 3)
             .map((m) => `<li>${MOTIF_NAME[m.kind]} <b class="mono">${m.count}</b></li>`)
             .join('')}</ul>`
        : tienDo?.chuDeHaySai.length
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
