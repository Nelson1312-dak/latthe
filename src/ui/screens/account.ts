// Màn đăng nhập / tài khoản. Vào thẳng được qua #/tai-khoan.
import { button, classBadge, dialog, esc, notice, rule } from '../components/index.ts';
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
import { loadAdvice, loadCoach, type CoachData } from '../../app/coach.ts';
import { MOTIF_NAME, type Advice } from '../../../shared/coach.ts';

/** Tiến độ học, nạp riêng vì cần gọi server. */
let tienDo: Progress | null = null;
let thốngKê: ProfileStats | null = null;
let bậcThang: ProfileLadderStep[] = [];
let elo: { online: EloPoint[]; puzzles: EloPoint[] } = { online: [], puzzles: [] };
let daHoi = false;
let hỏiLúc = 0;
/** Huấn luyện viên: nhận định (có ngay) và lời khuyên AI viết (có thể chậm). */
let coach: CoachData | null = null;
let advice: { advice: Advice | null; source: string } | null = null;
let adviceLoading = false;
/** Đang sửa tên gọi. */
let sửaTên = false;
let lỗiTên: string | null = null;
/** Hộp hỏi lại trước khi xoá tài khoản. */
let hỏiXoá = false;
let lỗiXoá: string | null = null;

export function mountAccount(rerender: () => void): void {
  if (!auth.user) return;
  // Mỗi lần mở Hồ sơ lấy số mới: vừa đánh xong một ván thì Elo đã khác
  if (daHoi && Date.now() - hỏiLúc < 10_000) return;
  hỏiLúc = Date.now();
  daHoi = true;
  void Promise.all([progress(), loadProfileStats()]).then(([p, s]) => {
    tienDo = p;
    thốngKê = s?.stats ?? null;
    bậcThang = s?.ladder ?? [];
    elo = s?.elo ?? { online: [], puzzles: [] };
    rerender();
  });
  void loadCoach().then((c) => {
    coach = c;
    rerender();
    if (!c?.facts) return;
    adviceLoading = true;
    rerender();
    void loadAdvice().then((a) => {
      advice = a;
      adviceLoading = false;
      rerender();
    });
  });
}

/**
 * Huấn luyện viên: nhìn cả lịch sử ván (không phải từng ván) để nói lỗi bạn hay
 * lặp lại và nên học gì tiếp. Số liệu do code tính từ kết quả engine; AI chỉ viết
 * lời khuyên từ đúng số liệu đó (server kiểm chặt, sai là dùng lời viết sẵn).
 */
function coachBlock(): string {
  if (!coach) return '';
  if (!coach.facts) {
    return `${rule('Huấn luyện viên')}
      ${notice(
        `Chơi thêm ${coach.need} ván nữa để Huấn luyện viên đủ dữ liệu nhận xét. Ván nào xong cũng được chấm và lưu tự động.`,
        'info',
        'coach',
      )}`;
  }
  const f = coach.facts;
  const a = advice?.advice;
  const lỗi = f.motifs.slice(0, 3);
  return `${rule('Huấn luyện viên', `<span class="rule-note">từ ${f.games} ván gần nhất</span>`)}
    <div class="coach">
      <p class="coach-text${a ? '' : ' is-typing'}">${
        a ? esc(a.nhanXet) : adviceLoading ? 'Huấn luyện viên đang đọc các ván của bạn' : 'Chưa viết được nhận xét lúc này.'
      }</p>
      ${
        lỗi.length
          ? `<div class="coach-facts">${lỗi
              .map((m) => `<span class="coach-fact"><b class="mono">${m.count}</b> lần ${MOTIF_NAME[m.kind]}</span>`)
              .join('')}</div>`
          : ''
      }
      <p class="label">Lộ trình gợi ý</p>
      <div class="quick-list">${coach.lessons
        .map(
          (l, i) =>
            `<a class="quick" href="#/hoc?bai=${l.id}"><span class="quick-icon">${icon('learn', 20)}</span>` +
            `<span class="quick-text"><b>${esc(l.title)}</b><span>${esc(a?.loTrinh[i] ?? l.keyPoint)}</span></span>${icon('next', 16)}</a>`,
        )
        .join('')}</div>
      <p class="coach-src">${
        advice?.source === 'llm' || advice?.source === 'cache'
          ? 'AI viết lời khuyên từ số liệu engine chấm các ván của bạn'
          : 'Lời khuyên viết sẵn từ số liệu engine chấm các ván của bạn'
      }</p>
    </div>`;
}

/** Quên tiến độ khi đăng xuất, để người sau không thấy số của người trước. */
export function resetAccount(): void {
  tienDo = null;
  thốngKê = null;
  coach = null;
  advice = null;
  daHoi = false;
  sửaTên = false;
  hỏiXoá = false;
}

const BOX_DAYS = [1, 3, 7, 16, 35];

function progressBlock(): string {
  if (!tienDo) return '';
  const boxes = Array.from({ length: 5 }, (_, i) => tienDo!.hopThe.find((h) => h.box === i + 1)?.c ?? 0);
  const max = Math.max(1, ...boxes);
  const tyLe = tienDo.attempts ? Math.round((tienDo.correct / tienDo.attempts) * 100) : 0;

  return `
    ${
      // Số bài đúng, thẻ đến hạn, chuỗi ngày đã có trong các ô ở trên; ở đây
      // chỉ còn những thứ không có chỗ khác: thẻ nằm ở hộp nào, hay sai kiểu gì.
      tienDo.the.total || tienDo.chuDeHaySai.length ? rule('Tiến độ học', tienDo.attempts ? `<span class="rule-note">${tyLe}% bài đúng</span>` : '') : ''
    }

    ${
      tienDo.the.total
        ? `<div class="boxes">
            <p class="label">Thẻ theo hộp ôn tập</p>
            <div class="box-bars">
              ${boxes
                .map(
                  (n, i) =>
                    `<span class="box-bar"><b class="mono">${n}</b>` +
                    `<i style="height:${Math.round((n / max) * 46) + 2}px"></i><span>H${i + 1}</span></span>`,
                )
                .join('')}
            </div>
            <p class="box-note">Hộp 1 gặp lại sau ${BOX_DAYS[0]} ngày, hộp 5 sau ${BOX_DAYS[4]} ngày.</p>
          </div>`
        : ''
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
          : notice('Bản web này chưa nối được với máy chủ nên chưa đăng nhập được.', 'info', 'clock')
      }
      ${
        đangTựChạy
          ? ''
          : `<p class="prose">Chơi với máy và giải bài tập thì vẫn dùng bình thường —
             phần đó chạy ngay trong trình duyệt. Còn đăng nhập, lưu ván, ôn tập theo
             lỗi của mình và đấu với người khác thì cần máy chủ, hiện chỉ bật khi máy
             của chủ app đang mở.</p>
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
        ${rule('Đăng nhập')}
        <p class="prose">
          Đăng nhập để lưu ván đã chơi, thẻ ôn tập và tiến độ, dùng được trên nhiều thiết bị.
          App không bao giờ thấy mật khẩu của bạn: Google lo phần đó.
          <a href="/chinh-sach-rieng-tu/">App lưu những gì</a>.
        </p>
        <div id="google-btn" class="google-btn google-slot"></div>
        ${
          canGoogle
            ? ''
            : // Người ngoài không cần biết tên biến môi trường; chỉ người chạy máy chủ mới cần.
              onThisMachine
              ? notice('Server chưa đặt GOOGLE_CLIENT_ID — xem docs/GOOGLE-LOGIN.md', 'locked', 'engine')
              : notice('Đăng nhập Google sắp mở. Trong lúc chờ, bạn vẫn chơi với máy và giải bài tập được — chỉ là chưa lưu lại.', 'info', 'clock')
        }
        <p id="login-error" class="notice notice-danger" hidden></p>
      </div>
      ${
        // Trên web công khai không bao giờ có đăng nhập thử, nên khỏi hiện cột này.
        auth.devAuth || onThisMachine
          ? `<div>
        ${rule('Hoặc thử nhanh')}
        ${
          auth.devAuth
            ? `<p class="prose">Tài khoản thử chỉ có khi chạy trên máy bạn, dùng để xem app khi chưa cấu hình Google. Phiên hết hạn sau một ngày.</p>
               <div class="account-actions">
                 <input id="dev-name" class="field" type="text" value="Nelson" maxlength="40" aria-label="Tên hiển thị">
                 ${button({ label: 'Vào thử', icon: 'user' })}
               </div>`
            : notice('Đăng nhập thử đang tắt (chỉ bật khi chạy trên máy bạn với AUTH_DEV=1)', 'locked', 'engine')
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

/** Một ô số liệu: con số to, nhãn nhỏ bên dưới. */
const tile = (value: string, label: string, note = '') =>
  `<div class="stat-tile"><b class="mono">${value}</b><span>${label}</span>${note ? `<small>${note}</small>` : ''}</div>`;

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
        u.avatar ? `<img src="${esc(u.avatar)}" alt="" width="88" height="88" referrerpolicy="no-referrer">` : icon('user', 40)
      }</span>
      <div class="profile-id">
        ${tênKhối}
        <p class="profile-meta">${u.local ? 'Tài khoản thử' : 'Đăng nhập bằng Google'} · thành viên từ ${ngày(u.createdAt)}</p>
        ${sửaTên ? '' : `<button class="link-btn profile-rename" data-rename>${icon('edit', 16)}<span>Đổi tên gọi</span></button>`}
      </div>
    </div>

    <div class="stat-tiles">
      ${tile(String(u.gameRating), 'Elo đấu với người', `${u.gameCount} ván online`)}
      ${tile(String(tienDo?.rating ?? u.puzzleRating), 'Elo bài tập', pz ? `${pz.solved}/${pz.tried} bài đúng` : '')}
      ${tile(g ? String(g.total) : '–', 'Ván đã chơi', g ? `${g.bot} với máy · ${g.online} online` : '')}
      ${tile(g ? `${g.wins}/${g.draws}/${g.losses}` : '–', 'Thắng / Hòa / Thua')}
      ${tile(thốngKê ? String(thốngKê.lessonsDone) : '–', 'Bài học đã xong')}
      ${tile(`${tienDo?.streak ?? 0}`, 'Chuỗi luyện', 'ngày liên tiếp')}
    </div>

    ${coachBlock()}

    ${
      elo.online.length || elo.puzzles.length
        ? `<div class="elo-charts">${eloChart('Elo đấu online', elo.online, 'đấu vài ván online sẽ có')}${eloChart('Elo bài tập', elo.puzzles, 'giải vài bài tập sẽ có')}</div>`
        : ''
    }

    ${
      bậcThang.length
        ? `${rule('Bậc thang AI', `<span class="rule-note">đã hạ ${bậcThang.filter((b) => b.beaten).length}/${bậcThang.length}</span>`)}
           <div class="ladder ladder-wide">${bậcThang
             .map(
               (b) =>
                 `<div class="ladder-step${b.beaten ? ' is-beaten' : ''}" title="${esc(b.blurb)}"><b>${esc(b.name)}</b>` +
                 `<span class="mono">${b.elo}</span>${b.beaten ? icon('check', 14) : ''}</div>`,
             )
             .join('')}</div>
           <p class="muted">Thắng từng AI để leo bậc — vào Chơi → Với người → Thử thách AI.</p>`
        : ''
    }

    <div class="quick-list profile-links">
      <button class="quick" data-go="xem-lai"><span class="quick-icon">${icon('review', 20)}</span><span class="quick-text"><b>Ván đã chơi</b><span>Xem lại, chấm từng nước</span></span>${icon('next', 16)}</button>
      ${u.admin ? `<button class="quick" data-go="thong-ke"><span class="quick-icon">${icon('review', 20)}</span><span class="quick-text"><b>Thống kê trang</b><span>Lượt vào, ván chơi, đăng ký — chỉ bạn thấy</span></span>${icon('next', 16)}</button>` : ''}
      <button class="quick" data-go="on-tap"><span class="quick-icon">${icon('cards', 20)}</span><span class="quick-text"><b>Thẻ ôn tập</b><span>${tienDo ? `${tienDo.the.due} thẻ đến hạn / ${tienDo.the.total}` : 'Từ những nước bạn đi sai'}</span></span>${icon('next', 16)}</button>
    </div>

    ${progressBlock()}

    ${rule('Tài khoản')}
    <p class="prose">Ván cờ, thẻ ôn tập, tiến độ và cả cài đặt (màu bàn cờ, âm thanh…) được lưu theo tài khoản —
      đăng nhập ở máy khác vẫn y như cũ. <a href="/chinh-sach-rieng-tu/">App lưu những gì</a>.</p>
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
