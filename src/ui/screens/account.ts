// Màn đăng nhập / tài khoản. Vào thẳng được qua #/tai-khoan.
import { button, classBadge, dialog, esc, notice, rule, sheet } from '../components/index.ts';
import { recentGames, type GameRow } from '../../app/games.ts';
import { gameRow } from './home.ts';
import { challengeFromProfile } from './online.ts';
import {
  auth,
  deleteAccount,
  loadProfileStats,
  updateProfile,
  type EloPoint,
  type ProfileLadderStep,
  type ProfileStats,
} from '../../app/session.ts';
import { progress, type Progress } from '../../app/training.ts';
import { icon } from '../icons.ts';
import { CLASS_LABEL } from '../../board/Board.ts';
import type { MoveClass } from '../../../shared/winrate.ts';
import { loadCoach, type CoachData } from '../../app/coach.ts';
import { MOTIF_NAME } from '../../../shared/coach.ts';

/** Tiến độ học, nạp riêng vì cần gọi server. */
let tienDo: Progress | null = null;
let thốngKê: ProfileStats | null = null;
let bậcThang: ProfileLadderStep[] = [];
let elo: { online: EloPoint[]; puzzles: EloPoint[] } = { online: [], puzzles: [] };
let daHoi = false;
let hỏiLúc = 0;
/** Huấn luyện viên: tóm tắt một dòng, đầy đủ ở tab riêng. */
let coach: CoachData | null = null;

/** Đang sửa tên gọi. */
let sửaTên = false;
let lỗiTên: string | null = null;
/** Hộp hỏi lại trước khi xoá tài khoản. */
let hỏiXoá = false;
let lỗiXoá: string | null = null;

/** 5 ván gần nhất cho bảng "Ván gần đây" (như trang hồ sơ chess.com, Lichess). */
let vánGầnĐây: GameRow[] = [];

export function mountAccount(rerender: () => void): void {
  if (!auth.user) return;
  // Mỗi lần mở Hồ sơ lấy số mới: vừa đánh xong một ván thì Elo đã khác
  if (daHoi && Date.now() - hỏiLúc < 10_000) return;
  hỏiLúc = Date.now();
  daHoi = true;
  void Promise.all([progress(), loadProfileStats(), recentGames()]).then(([p, s, g]) => {
    vánGầnĐây = g;
    tienDo = p;
    thốngKê = s?.stats ?? null;
    bậcThang = s?.ladder ?? [];
    elo = s?.elo ?? { online: [], puzzles: [] };
    rerender();
  });
  void loadCoach().then((c) => {
    coach = c;
    rerender();
  });
}

/** Thẻ dẫn sang tab Huấn luyện viên: một câu (lỗi hay lặp lại nhất) + bài nên học. */
function coachBlock(): string {
  if (!coach) return '';
  const lỗi = coach.facts?.motifs[0];
  const bài = coach.lessons[0];
  return `<a class="coach-banner" href="#/huan-luyen">
      <span class="quick-icon">${icon('coach', 20)}</span>
      <span class="quick-text"><b>Huấn luyện viên</b><span>${
        coach.facts
          ? `${lỗi ? `Lỗi bạn hay lặp lại nhất: ${MOTIF_NAME[lỗi.kind]} (${lỗi.count} lần).` : `Độ chính xác trung bình ${coach.facts.accuracy}%.`}${bài ? ` Nên học: ${esc(bài.title)}.` : ''}`
          : `Chơi thêm ${coach.need} ván để Huấn luyện viên đủ dữ liệu nhận xét.`
      }</span></span>
      ${icon('next', 16)}
    </a>`;
}

/** Quên tiến độ khi đăng xuất, để người sau không thấy số của người trước. */
export function resetAccount(): void {
  tienDo = null;
  thốngKê = null;
  coach = null;
  daHoi = false;
  sửaTên = false;
  hỏiXoá = false;
}

function progressBlock(): string {
  if (!tienDo) return '';
  const tyLe = tienDo.attempts ? Math.round((tienDo.correct / tienDo.attempts) * 100) : 0;

  return `
    ${
      // Số bài đúng, thẻ đến hạn, chuỗi ngày đã có trong các ô ở trên; ở đây
      // chỉ còn những thứ không có chỗ khác: thẻ nằm ở hộp nào, hay sai kiểu gì.
      tienDo.chuDeHaySai.length ? rule('Tiến độ học', tienDo.attempts ? `<span class="rule-note">${tyLe}% bài đúng</span>` : '') : ''
    }


    ${
      tienDo.chuDeHaySai.length
        ? `${rule('Kiểu lỗi hay gặp')}
           <ul class="tally">${tienDo.chuDeHaySai
             .map((c) => `<li>${classBadge(c.cls as MoveClass)} ${CLASS_LABEL[c.cls as MoveClass] ?? c.cls} <b class="mono">${c.c}</b></li>`)
             .join('')}</ul>`
        : ''
    }`;
}

export function account(): string {
  if (auth.offline) {
    // Trên bản web công khai, server không chạy cùng chỗ với trang. Câu
    // "chạy npm run dev" là lời nhắc cho người đang code, hiện ra cho khách
    // vào latbai.vn thì vô nghĩa — họ có cái repo nào đâu mà chạy.
    const đangTựChạy = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    return `<div class="screen screen-narrow">
      <div class="screen-head"><h1>Tài khoản</h1></div>
      ${
        đangTựChạy
          ? notice('Không gọi được server. Chạy `npm run dev` rồi tải lại trang.', 'danger', 'clock')
          : notice('Máy chủ đang nghỉ, tạm chưa đăng nhập được.', 'info', 'clock')
      }
      ${
        đangTựChạy
          ? ''
          : `<p class="prose">Chơi với máy vẫn dùng bình thường.</p>
             <div class="row-actions">
               <span data-go="choi">${button({ label: 'Chơi với máy', kind: 'primary', icon: 'play' })}</span>
             </div>`
      }
    </div>`;
  }

  if (auth.user) return profile();

  const canGoogle = Boolean(auth.googleClientId);
  const onThisMachine = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return `<div class="screen screen-narrow">
    <div class="screen-head"><h1>Đăng nhập</h1></div>
    <div class="account-cols">
      <div>
        <p class="prose">Lưu ván, thẻ ôn tập và tiến độ trên mọi thiết bị.</p>
        <div id="google-btn" class="google-btn google-slot"></div>
        ${
          canGoogle
            ? ''
            : // Người ngoài không cần biết tên biến môi trường; chỉ người chạy máy chủ mới cần.
              onThisMachine
              ? notice('Server chưa đặt GOOGLE_CLIENT_ID — xem docs/GOOGLE-LOGIN.md', 'locked', 'engine')
              : notice('Đăng nhập Google sắp mở.', 'info', 'clock')
        }
        <p id="login-error" class="notice notice-danger" hidden></p>
        <p class="muted login-note">Không cần mật khẩu — Google xác nhận giúp. <a href="/chinh-sach-rieng-tu/">App lưu gì?</a></p>
      </div>
      ${
        // Trên web công khai không bao giờ có đăng nhập thử, nên khỏi hiện cột này.
        auth.devAuth || onThisMachine
          ? `<div>
        ${rule('Hoặc thử nhanh')}
        ${
          auth.devAuth
            ? `<p class="prose">Chỉ có trên máy chạy server. Hết hạn sau một ngày.</p>
               <div class="account-actions">
                 <input id="dev-name" class="field" type="text" value="Nelson" maxlength="40" aria-label="Tên hiển thị">
                 ${button({ label: 'Vào thử', icon: 'user' })}
               </div>`
            : notice('Đăng nhập thử đang tắt (AUTH_DEV=1 để bật).', 'locked', 'engine')
        }
      </div>`
          : ''
      }
    </div>
  </div>`;
}

/* ---------------- Hồ sơ (đã đăng nhập) ---------------- */

const ngày = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

/** Một dòng số liệu: nhãn bên trái, số bên phải (kiểu trang hồ sơ của Lichess). */
const tile = (value: string, label: string, note = '') =>
  `<div class="fact"><dt>${label}</dt><dd><b class="mono">${value}</b>${note ? `<small>${note}</small>` : ''}</dd></div>`;

function profile(): string {
  const u = auth.user!;
  const g = thốngKê?.games;
  const pz = thốngKê?.puzzles;
  const tênKhối = sửaTên
    ? `<div class="name-edit">
         <input id="profile-name" class="field" type="text" maxlength="30" value="${esc(u.name)}" aria-label="Tên gọi">
         ${button({ label: 'Lưu tên', kind: 'primary' })}
         ${button({ label: 'Hủy', kind: 'text' })}
       </div>
       ${lỗiTên ? notice(lỗiTên, 'danger') : ''}`
    : `<h1 class="profile-name">${esc(u.name)}</h1>`;

  return `<div class="screen screen-narrow profile">
    <div class="profile-card">
      <span class="profile-avatar">${
        u.avatar ? `<img src="${esc(u.avatar)}" alt="" width="64" height="64" referrerpolicy="no-referrer">` : esc((u.name.trim()[0] ?? '?').toUpperCase())
      }</span>
      <div class="profile-id">
        ${tênKhối}
        <p class="profile-meta">${u.local ? 'Tài khoản thử' : 'Đăng nhập bằng Google'} · thành viên từ ${ngày(u.createdAt)}</p>
        ${sửaTên ? '' : `<button class="link-btn profile-rename" data-rename>${icon('edit', 16)}<span>Đổi tên gọi</span></button>`}
      </div>
    </div>

    <dl class="facts">
      ${tile(String(u.gameRating), 'Elo đấu với người', `${u.gameCount} ván online`)}
      ${tile(String(tienDo?.rating ?? u.puzzleRating), 'Elo bài tập', pz ? `${pz.solved}/${pz.tried} bài đúng` : '')}
      ${tile(g ? String(g.total) : '–', 'Ván đã chơi', g ? `${g.bot} với máy · ${g.online} online` : '')}
      ${tile(g ? `${g.wins}/${g.draws}/${g.losses}` : '–', 'Thắng / Hòa / Thua')}
      ${tile(thốngKê ? String(thốngKê.lessonsDone) : '–', 'Bài học đã xong')}
      ${tile(`${tienDo?.streak ?? 0} ngày`, 'Chuỗi luyện')}
    </dl>

    ${coachBlock()}

    ${
      elo.online.length || elo.puzzles.length
        ? `<div class="elo-charts">${eloChart('Elo đấu online', elo.online, 'đấu vài ván online sẽ có')}${eloChart('Elo bài tập', elo.puzzles, 'giải vài bài tập sẽ có')}</div>`
        : ''
    }

    ${
      bậcThang.length
        ? `${rule('Bậc thang AI', `<span class="rule-note">đã hạ ${bậcThang.filter((b) => b.beaten).length}/${bậcThang.length} · bấm tên để đấu</span>`)}
           <ol class="ladder-line">${bậcThang
             .map(
               (b) =>
                 `<li><button class="ladder-go${b.beaten ? ' is-beaten' : ''}" data-ladder-bot="${esc(b.id)}" title="Đấu ngay · ${esc(b.blurb)}">` +
                 `${b.beaten ? icon('check', 14) : ''}<b>${esc(b.name)}</b> <span class="mono">${b.elo}</span></button></li>`,
             )
             .join('')}</ol>`
        : ''
    }

    ${
      vánGầnĐây.length
        ? `${rule('Ván gần đây', '<a class="rule-link" href="#/xem-lai">Xem tất cả</a>')}
           ${sheet(`<div class="log">${vánGầnĐây.slice(0, 5).map(gameRow).join('')}</div>`)}`
        : ''
    }

    <div class="quick-list profile-links">
      ${u.admin ? `<button class="quick" data-go="thong-ke"><span class="quick-icon">${icon('review', 20)}</span><span class="quick-text"><b>Thống kê trang</b></span>${icon('next', 16)}</button>` : ''}
      <button class="quick" data-go="on-tap"><span class="quick-icon">${icon('cards', 20)}</span><span class="quick-text"><b>Thẻ ôn tập</b>${tienDo ? `<span>${tienDo.the.due}/${tienDo.the.total} đến hạn</span>` : ''}</span>${icon('next', 16)}</button>
    </div>

    ${progressBlock()}

    ${rule('Tài khoản')}
    <p class="prose">Mọi thứ lưu theo tài khoản, đăng nhập máy khác vẫn còn. <a href="/chinh-sach-rieng-tu/">App lưu gì?</a></p>
    <div class="account-actions">
      <button class="btn btn-secondary" title="Cài đặt">${icon('settings', 17)}<span>Cài đặt</span></button>
      ${button({ label: 'Đăng xuất', icon: 'close' })}
      ${button({ label: 'Xoá tài khoản', kind: 'danger', icon: 'resign' })}
    </div>

    ${
      hỏiXoá
        ? dialog(
            'Xoá tài khoản?',
            `<p>Xoá vĩnh viễn hồ sơ, toàn bộ ván cờ, thẻ ôn tập và tiến độ của <b>${esc(u.name)}</b>. Không lấy lại được.</p>` +
              (lỗiXoá ? notice(lỗiXoá, 'danger') : ''),
            button({ label: 'Hủy', kind: 'text' }) + button({ label: 'Xoá vĩnh viễn', kind: 'danger' }),
          )
        : ''
    }
  </div>`;
}

/** Nút trên màn Hồ sơ. Đăng xuất do main.ts lo (cần dọn cả các màn khác). */
export function handleAccountClick(target: HTMLElement, rerender: () => void, afterDelete: () => void): boolean {
  const bậc = target.closest<HTMLElement>('[data-ladder-bot]');
  if (bậc) {
    challengeFromProfile(bậc.dataset.ladderBot!, rerender);
    return true;
  }
  if (target.closest('[data-rename]')) {
    sửaTên = true;
    lỗiTên = null;
    rerender();
    document.querySelector<HTMLInputElement>('#profile-name')?.select();
    return true;
  }
  const btn = target.closest<HTMLButtonElement>('button');
  const label = btn?.textContent?.trim();
  if (label === 'Lưu tên') {
    const name = document.querySelector<HTMLInputElement>('#profile-name')?.value ?? '';
    btn!.disabled = true;
    updateProfile({ name })
      .then(() => {
        sửaTên = false;
        rerender();
      })
      .catch((err: Error) => {
        lỗiTên = err.message;
        rerender();
      });
    return true;
  }
  if (label === 'Hủy') {
    sửaTên = false;
    hỏiXoá = false;
    rerender();
    return true;
  }
  if (label === 'Xoá tài khoản') {
    hỏiXoá = true;
    lỗiXoá = null;
    rerender();
    return true;
  }
  if (label === 'Xoá vĩnh viễn') {
    btn!.disabled = true;
    deleteAccount()
      .then(() => {
        resetAccount();
        afterDelete();
      })
      .catch((err: Error) => {
        lỗiXoá = err.message;
        rerender();
      });
    return true;
  }
  return false;
}

/**
 * Biểu đồ đường Elo theo từng ván / từng bài (trục ngang là thứ tự, không phải
 * ngày — người chơi thất thường thì trục ngày toàn khoảng trống). Một chuỗi số
 * liệu, một trục; nét 2px, chấm cuối; rê chuột vào điểm hiện Elo và ngày.
 */
function eloChart(title: string, pts: EloPoint[], empty: string): string {
  if (pts.length < 2) {
    return `<figure class="chart"><figcaption><b>${title}</b></figcaption><p class="chart-empty">Chưa đủ dữ liệu — ${empty}.</p></figure>`;
  }
  const W = 320;
  const H = 140;
  const pad = { l: 36, r: 10, t: 10, b: 10 };
  const rs = pts.map((p) => p.r);
  const lo = Math.floor((Math.min(...rs) - 10) / 50) * 50;
  const hi = Math.ceil((Math.max(...rs) + 10) / 50) * 50;
  const x = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (r: number) => pad.t + (1 - (r - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');
  const grid = [lo, hi]
    .map(
      (v) =>
        `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="chart-grid"/>` +
        `<text x="${pad.l - 6}" y="${y(v)}" class="chart-tick" text-anchor="end" dominant-baseline="middle">${v}</text>`,
    )
    .join('');
  const hits = pts
    .map(
      (p, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(p.r).toFixed(1)}" r="7" fill="transparent"><title>${p.r} · ${ngày(p.t)}</title></circle>`,
    )
    .join('');
  const đầu = pts[0].r;
  const cuối = pts[pts.length - 1].r;
  const đổi = cuối - đầu;
  return `<figure class="chart">
    <figcaption><b>${title}</b><span>hiện tại <b class="mono">${cuối}</b> · ${đổi >= 0 ? '+' : ''}${đổi} so với lúc đầu</span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} qua ${pts.length} lần, từ ${đầu} tới ${cuối}">
      ${grid}<path d="${line}" class="chart-line"/>
      <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(cuối).toFixed(1)}" r="4" class="chart-dot"/>${hits}
    </svg>
  </figure>`;
}
