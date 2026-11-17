import './ui/tokens.css';
import './ui/base.css';
import './ui/components/components.css';
import './ui/app.css';
import './ui/screens/screens.css';

import { loadPieces } from './board/sprite.ts';
import { icon, type IconName } from './ui/icons.ts';
import { auth, devLogin, loadMe, logout, onAuthChange, renderGoogleButton } from './app/session.ts';
import { setSoundEnabled, soundEnabled } from './app/sound.ts';
import { home, mountHome, resetHome } from './ui/screens/home.ts';
import { handlePlayClick, mountPlay, play } from './ui/screens/play.ts';
import { playBot } from './ui/screens/play-bot.ts';
import { handleReviewClick, mountReview, review } from './ui/screens/review.ts';
import { handleTrainClick, mountTrain, train } from './ui/screens/train.ts';
import { handleLearnClick, learn, mountLearn, resetLearn } from './ui/screens/learn.ts';
import { handleOnlineClick, leaveOnline, mountOnline, online } from './ui/screens/online.ts';
import { routeName } from './app/route.ts';
import { account, mountAccount, resetAccount } from './ui/screens/account.ts';
import { specimen } from './ui/screens/specimen.ts';

/** Tên app, đặt theo bộ với latbai.vn. Đổi ở đây là đổi cả header lẫn tiêu đề tab. */
export const APP_NAME = 'Lật Cờ';

type Screen = { title: string; render: () => string };

const SCREENS: Record<string, Screen> = {
  '': { title: 'Sảnh', render: home },
  choi: { title: 'Chơi', render: play },
  'choi-may': { title: 'Chơi với máy', render: playBot },
  'xem-lai': { title: 'Xem lại ván', render: review },
  'on-tap': { title: 'Ôn tập', render: train },
  hoc: { title: 'Học', render: learn },
  ban: { title: 'Chơi với người', render: online },
  'tai-khoan': { title: 'Tài khoản', render: account },
  'thiet-ke': { title: 'Trang thiết kế', render: specimen },
};

const NAV: { route: string; label: string; icon: IconName }[] = [
  { route: 'choi', label: 'Chơi', icon: 'play' },
  { route: 'xem-lai', label: 'Xem lại', icon: 'review' },
  { route: 'on-tap', label: 'Ôn tập', icon: 'cards' },
  { route: 'hoc', label: 'Học', icon: 'learn' },
  { route: 'ban', label: 'Đấu', icon: 'friends' },
];

function route(): string {
  // routeName() đã bỏ phần ?... đi, nên '#/xem-lai?game=12' vẫn là màn Xem lại
  // chứ không thành một tên lạ rồi rơi về Sảnh.
  const r = routeName();
  return r in SCREENS ? r : '';
}

/** Tên gọi ngắn để hiện trên header: người Việt gọi nhau bằng tên, không phải họ. */
function shortName(): string {
  if (auth.offline) return 'Ngoại tuyến';
  if (!auth.user) return 'Đăng nhập';
  return auth.user.name.trim().split(/\s+/).pop() ?? 'Tôi';
}

function topLink(route: string, label: string, name: IconName, current: string): string {
  return (
    `<a class="top-link${route === current ? ' is-active' : ''}" href="#/${route}"` +
    `${route === current ? ' aria-current="page"' : ''}>${icon(name, 18)}<span>${label}</span></a>`
  );
}

/** Header chung: tên app bên trái, điều hướng ở giữa, tài khoản bên phải. */
function siteHeader(current: string): string {
  return (
    `<header class="site-head">` +
    `<a class="brand" href="#/" aria-label="${APP_NAME} — về sảnh">` +
    `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><use href="#wn"/></svg>` +
    `<span>${APP_NAME}</span></a>` +
    `<nav class="top-nav" aria-label="Chính">` +
    NAV.map((n) => topLink(n.route, n.label, n.icon, current)).join('') +
    `</nav>` +
    `<div class="site-right">` +
    topLink('thiet-ke', 'Thiết kế', 'book', current) +
    topLink('tai-khoan', shortName(), 'user', current) +
    `</div></header>`
  );
}

/**
 * Dòng chân trang. GPL-3 yêu cầu người nhận bản chạy phải được mời xem mã nguồn,
 * nên link tới kho mã là bắt buộc chứ không phải cho đẹp.
 */
function siteFooter(): string {
  return (
    `<footer class="site-foot">` +
    `<span>${APP_NAME} — phần mềm tự do theo ` +
    `<a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GPL-3</a>.</span> ` +
    `<span>Engine <a href="https://stockfishchess.org/" target="_blank" rel="noopener">Stockfish</a>, ` +
    `bộ quân cburnett (CC BY-SA 3.0).</span> ` +
    `<a href="https://github.com/Nelson1312-dak/latthe" target="_blank" rel="noopener">Mã nguồn</a>` +
    `</footer>`
  );
}

/** Thanh điều hướng dưới đáy, chỉ hiện trên điện thoại. */
function bottomNav(current: string): string {
  const item = (route: string, label: string, name: IconName) =>
    `<a class="nav-item${route === current ? ' is-active' : ''}" href="#/${route}">${icon(name, 22)}<span>${label}</span></a>`;
  return (
    `<nav class="nav" aria-label="Chính (điện thoại)">` +
    NAV.map((n) => item(n.route, n.label, n.icon)).join('') +
    item('tai-khoan', shortName(), 'user') +
    `</nav>`
  );
}

/** Màn hình đang hiện, để biết lúc nào người dùng rời khỏi một màn. */
let mànTrước: string | null = null;

function render(): void {
  const r = route();
  if (mànTrước === 'ban' && r !== 'ban') leaveOnline();
  mànTrước = r;
  const screen = SCREENS[r];
  document.title = r ? `${screen.title} · ${APP_NAME}` : APP_NAME;
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.className = 'app';
  app.innerHTML = siteHeader(r) + `<main>${screen.render()}${siteFooter()}</main>` + bottomNav(r);
  if (r === 'choi') mountPlay(render);
  if (r === 'xem-lai') mountReview(render);
  if (r === 'on-tap') mountTrain(render);
  if (r === 'tai-khoan') mountAccount(render);
  if (r === 'hoc') mountLearn(render);
  if (r === 'ban') mountOnline(render);
  if (r === '') mountHome(render);
  if (r === 'tai-khoan' && !auth.user && !auth.offline) {
    const slot = document.querySelector<HTMLElement>('#google-btn');
    if (slot) void renderGoogleButton(slot, showLoginError);
  }
}

function showLoginError(msg: string): void {
  const el = document.querySelector<HTMLElement>('#login-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

/* ---------------- Giao diện sáng/tối ---------------- */

export function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
}

function initTheme(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('theme');
  } catch {
    /* bỏ qua */
  }
  // Giao diện tối là mặc định (xem docs/DESIGN.md); người dùng đổi thì nhớ lựa chọn đó.
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

/* ---------------- Bắt sự kiện ---------------- */

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;

  const themed = el.closest<HTMLElement>('[data-set-theme], [data-set-board]');
  if (themed) {
    if (themed.dataset.setTheme) applyTheme(themed.dataset.setTheme as 'dark' | 'light');
    if (themed.dataset.setBoard) document.documentElement.dataset.board = themed.dataset.setBoard;
    render();
    return;
  }

  // Màn chơi và màn xem lại tự lo các nút của chúng
  if (route() === 'choi' && handlePlayClick(el, render)) return;
  if (route() === 'xem-lai' && handleReviewClick(el, render)) return;
  if (route() === 'on-tap' && handleTrainClick(el, render)) return;
  if (route() === 'hoc' && handleLearnClick(el)) return;
  if (route() === 'ban' && handleOnlineClick(el, render)) return;

  // Ô có data-go thì chuyển màn
  const go = el.closest<HTMLElement>('[data-go]');
  if (go?.dataset.go) {
    location.hash = `#/${go.dataset.go}`;
    return;
  }

  const btn = el.closest<HTMLButtonElement>('button');
  if (!btn) return;
  const label = btn.textContent?.trim();
  if (btn.title === 'Âm thanh') {
    setSoundEnabled(!soundEnabled());
    render();
  } else if (label === 'Đăng xuất') {
    void logout().then(() => {
      resetAccount();
      resetHome();
      resetLearn();
      render();
    });
  } else if (label === 'Vào thử') {
    const name = document.querySelector<HTMLInputElement>('#dev-name')?.value.trim() || 'Nelson';
    btn.disabled = true;
    void devLogin(name)
      .then(() => {
        location.hash = '#/';
        render();
      })
      .catch((err: Error) => {
        btn.disabled = false;
        showLoginError(err.message);
      });
  }
});

initTheme();
onAuthChange(render);
window.addEventListener('hashchange', render);
render();
void loadPieces().catch((err) => console.error(err));
void loadMe();
