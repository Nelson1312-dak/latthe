import './ui/tokens.css';
import './ui/base.css';
import './ui/components/components.css';
import './ui/app.css';
import './ui/screens/screens.css';

import { installApiHeader } from './app/api-header.ts';
import { loadPieces } from './board/sprite.ts';
import { snapBoards } from './board/snap.ts';
import { icon, type IconName } from './ui/icons.ts';
import {
  auth,
  consumeJustLoggedIn,
  devLogin,
  loadMe,
  logout,
  onAuthChange,
  renderGoogleButton,
  savePrefsRemote,
  serverPrefs,
} from './app/session.ts';
import { chooseGuest, closeGate, currentGate, type Gate } from './app/gate.ts';
import { esc } from './ui/components/index.ts';
import { handleWelcomeClick, welcomeDialog } from './ui/screens/welcome.ts';
import { setSoundEnabled, soundEnabled } from './app/sound.ts';
import { applyPrefs, BOARD_THEMES, prefs, setPref, type BoardTheme, type Prefs } from './app/prefs.ts';
import { homeSide, mountHome, resetHome } from './ui/screens/home.ts';
import { handlePlayClick, mountPlay, play, setBotLevel } from './ui/screens/play.ts';
import { playBot } from './ui/screens/play-bot.ts';
import { handleReviewClick, mountReview, review } from './ui/screens/review.ts';
import { handleTrainClick, mountTrain, train } from './ui/screens/train.ts';
import { handleLearnClick, learn, mountLearn, resetLearn } from './ui/screens/learn.ts';
import { handleOnlineClick, leaveOnline, mountOnline, online } from './ui/screens/online.ts';
import { routeName } from './app/route.ts';
import { account, handleAccountClick, mountAccount, resetAccount } from './ui/screens/account.ts';
import { specimen } from './ui/screens/specimen.ts';

/** Tên app, đặt theo bộ với latbai.vn. Đổi ở đây là đổi cả header lẫn tiêu đề tab. */
export const APP_NAME = 'Lật Cờ';

type Screen = { title: string; render: () => string };

const SCREENS: Record<string, Screen> = {
  // Sảnh dùng chung bàn cờ của màn Chơi, gắn thêm phần riêng vào cột phải
  '': { title: 'Sảnh', render: () => play(homeSide()) },
  choi: { title: 'Chơi', render: play },
  'choi-may': { title: 'Chơi với máy', render: playBot },
  'xem-lai': { title: 'Xem lại ván', render: review },
  'on-tap': { title: 'Ôn tập', render: train },
  hoc: { title: 'Học', render: learn },
  ban: { title: 'Chơi với người', render: online },
  'tai-khoan': { title: 'Hồ sơ', render: account },
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
  // Tên ngắn (thường là tên gọi tự đặt) thì hiện đủ; tên dài kiểu họ tên đầy
  // đủ của Google thì lấy chữ cuối. Tự đặt "Hiên Cờ" mà hiện mỗi "Cờ" là sai.
  const name = auth.user.name.trim();
  return name.length <= 14 ? name : (name.split(/\s+/).pop() ?? 'Tôi');
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
    NAV.map((n) => topLink(n.route, n.label, n.icon, current === '' ? 'choi' : current)).join('') +
    `</nav>` +
    // "Thiết kế" (trang mẫu của design system) không còn trên thanh điều hướng:
    // người chơi không cần nó, và nó làm trang trông như công cụ của dev.
    // Vẫn vào được bằng #/thiet-ke.
    `<div class="site-right">` +
    `<button class="top-link" title="Cài đặt" aria-label="Cài đặt">${icon('settings', 18)}<span>Cài đặt</span></button>` +
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
    `<a href="https://github.com/Nelson1312-dak/latthe" target="_blank" rel="noopener">Mã nguồn</a> ` +
    `<a href="/chinh-sach-rieng-tu/">Quyền riêng tư</a>` +
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

/* ---------------- Mời đăng nhập ---------------- */

/** Hộp mời đăng nhập, bật lên khi người chưa đăng nhập bấm Chơi. */
function gateDialog(g: Gate): string {
  const perk = (name: IconName, text: string) => `<li>${icon(name, 18)}<span>${text}</span></li>`;
  return (
    `<div class="dialog-backdrop gate-backdrop"><div class="dialog gate" role="dialog" aria-modal="true" aria-label="${esc(g.title)}">` +
    `<h2>${esc(g.title)}</h2><div class="dialog-body">` +
    `<p>${esc(g.text)}</p>` +
    `<ul class="gate-perks">` +
    perk('review', 'Mọi ván được lưu, xem lại và chấm từng nước') +
    perk('cards', 'Nước đi sai thành thẻ ôn tập riêng của bạn') +
    perk('friends', 'Đấu online, có Elo, ghép người cùng trình độ') +
    `</ul>` +
    `<div id="gate-google" class="google-btn google-slot"></div>` +
    `<p id="login-error" class="notice notice-danger" hidden></p>` +
    `</div><div class="dialog-actions">` +
    (g.guest ? `<button class="link-btn" data-gate-guest>${esc(g.guest)}</button>` : '') +
    `<button class="link-btn" data-gate-close>Đóng</button>` +
    `</div></div></div>`
  );
}

/* ---------------- Hồ sơ đi theo tài khoản ---------------- */

/** Việc làm tiếp sau hộp chào mừng (ví dụ: vào ván vừa định chơi). */
let afterWelcome: (() => void) | null = null;
/** Hộp chào mừng đang mở (nổi trên bàn cờ của tab Chơi). */
let welcomeOpen = false;
const needsWelcome = () => Boolean(auth.user && !auth.user.onboarded);

/** Đẩy cài đặt hiện tại lên tài khoản. */
function pushPrefs(): void {
  savePrefsRemote({
    ...prefs(),
    theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    sound: soundEnabled(),
  });
}

/** Người dùng của lần đồng bộ cài đặt gần nhất, để mỗi lần đăng nhập chỉ làm một lần. */
let prefsUser: number | null = null;

/**
 * Vừa đăng nhập: tài khoản đã có cài đặt thì dùng cài đặt đó (sang máy khác vẫn
 * y như cũ); chưa có thì lưu cài đặt đang dùng lên tài khoản.
 */
function syncPrefsOnLogin(): void {
  const u = auth.user;
  if (!u) {
    prefsUser = null;
    return;
  }
  if (prefsUser === u.id) return;
  prefsUser = u.id;
  const p = serverPrefs;
  if (!p) return pushPrefs();
  if (typeof p.board === 'string' && BOARD_THEMES.some((t) => t.id === p.board)) setPref('board', p.board as BoardTheme);
  for (const k of ['coords', 'legal', 'autoQueen'] as const) if (typeof p[k] === 'boolean') setPref(k, p[k]);
  if (p.theme === 'dark' || p.theme === 'light') applyTheme(p.theme);
  if (typeof p.sound === 'boolean') setSoundEnabled(p.sound);
}

/**
 * Đăng nhập / đăng xuất / nạp lại người dùng.
 *
 * Mở web ra thì luôn là tab có bàn cờ, không nhảy đi đâu. Chỉ ngay sau khi bấm
 * nút Google, với người mới, mới hiện hộp chào mừng — nổi trên bàn cờ của tab
 * Chơi. Đăng nhập từ hộp mời lúc bấm Chơi thì chào xong là vào ván luôn.
 */
function onAuth(): void {
  syncPrefsOnLogin();
  const fresh = consumeJustLoggedIn();
  const g = currentGate();
  if (g && auth.user) closeGate();
  if (fresh && needsWelcome()) {
    welcomeOpen = true;
    afterWelcome = g?.then ?? null;
    // Đăng nhập từ trang Hồ sơ hay chỗ khác: về tab Chơi, hộp chào nổi trên bàn cờ
    if (route() !== 'choi' && route() !== '') location.hash = '#/choi';
  } else if (g && auth.user) g.then();
  render();
}

/* ---------------- Cài đặt ---------------- */

let settingsOpen = false;

/** Một dòng bật/tắt trong hộp Cài đặt. */
function toggleRow(key: string, label: string, note: string, on: boolean): string {
  return (
    `<button class="pref-row" data-pref="${key}" role="switch" aria-checked="${on}">` +
    `<span class="pref-text"><b>${label}</b><span>${note}</span></span>` +
    `<span class="switch${on ? ' is-on' : ''}" aria-hidden="true"><i></i></span></button>`
  );
}

/**
 * Hộp Cài đặt dùng chung cho mọi màn. Mọi thứ đổi ngay khi bấm, không có nút
 * Lưu: người chơi thấy luôn bàn cờ đổi màu phía sau hộp.
 */
function settingsDialog(): string {
  const p = prefs();
  const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const swatch = BOARD_THEMES.map(
    (t) =>
      `<button class="swatch${p.board === t.id ? ' is-active' : ''}" data-set-board="${t.id}" aria-pressed="${p.board === t.id}">` +
      `<svg class="swatch-board" viewBox="0 0 2 2" width="44" height="44" aria-hidden="true" shape-rendering="crispEdges">` +
      `<rect width="2" height="2" fill="${t.dark}"/><rect width="1" height="1" fill="${t.light}"/><rect x="1" y="1" width="1" height="1" fill="${t.light}"/></svg>` +
      `<span>${t.name}</span></button>`,
  ).join('');
  return (
    `<div class="dialog-backdrop settings-backdrop"><div class="dialog settings" role="dialog" aria-modal="true" aria-label="Cài đặt">` +
    `<h2>Cài đặt</h2><div class="dialog-body">` +
    `<p class="setup-label">Màu bàn cờ</p><div class="swatches">${swatch}</div>` +
    `<p class="setup-label">Giao diện</p>` +
    `<div class="seg seg-fill" role="group" aria-label="Giao diện">` +
    `<button class="seg-item${theme === 'dark' ? ' is-active' : ''}" data-set-theme="dark">${icon('moon', 17)} Tối</button>` +
    `<button class="seg-item${theme === 'light' ? ' is-active' : ''}" data-set-theme="light">${icon('sun', 17)} Sáng</button>` +
    `</div>` +
    `<div class="pref-list">` +
    toggleRow('sound', 'Âm thanh', 'Tiếng đi quân, ăn quân, chiếu', soundEnabled()) +
    toggleRow('coords', 'Toạ độ', 'Chữ a–h và số 1–8 ở mép bàn cờ', p.coords) +
    toggleRow('legal', 'Chấm nước đi được', 'Hiện các ô đi tới được khi cầm quân', p.legal) +
    toggleRow('autoQueen', 'Tự phong Hậu', 'Tốt tới hàng cuối thì thành Hậu luôn, không hỏi', p.autoQueen) +
    `</div>` +
    `<p class="pref-keys">Phím tắt: <kbd>←</kbd> <kbd>→</kbd> lùi/tiến một nước, <kbd>Home</kbd> <kbd>End</kbd> về đầu/cuối ván, <kbd>F</kbd> lật bàn cờ.</p>` +
    `<p class="pref-keys">Vẽ trên bàn cờ: giữ chuột phải kéo để vẽ mũi tên (đi đúng đường quân đi được), ` +
    `bấm chuột phải để tô ô. Giữ thêm <kbd>Shift</kbd> xanh lá, <kbd>Ctrl</kbd> đỏ, <kbd>Alt</kbd> xanh dương. ` +
    `Bấm chuột trái là xoá hết.</p>` +
    `</div><div class="dialog-actions">` +
    `<button class="btn btn-primary" data-close-settings>Xong</button>` +
    `</div></div></div>`
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
  app.innerHTML =
    siteHeader(r) +
    `<main>${screen.render()}${siteFooter()}</main>` +
    bottomNav(r) +
    (settingsOpen ? settingsDialog() : '') +
    (currentGate() && !auth.user ? gateDialog(currentGate()!) : '') +
    (welcomeOpen && auth.user ? welcomeDialog() : '');
  if (r === 'choi') mountPlay(render);
  if (r === 'xem-lai') mountReview(render);
  if (r === 'on-tap') mountTrain(render);
  if (r === 'tai-khoan') mountAccount(render);
  if (r === 'hoc') mountLearn(render);
  if (r === 'ban') mountOnline(render);
  if (r === '') {
    mountHome(render);
    mountPlay(render);
  }
  snapBoards(app);
  // Nút Google ở bất cứ chỗ nào có chỗ cho nó: trang Đăng nhập, hộp mời đăng nhập
  if (!auth.user && !auth.offline) {
    for (const slot of document.querySelectorAll<HTMLElement>('.google-slot')) {
      void renderGoogleButton(slot, showLoginError);
    }
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

  // Hộp mời đăng nhập: chơi luôn không lưu, hoặc đóng
  const g = currentGate();
  if (g && el.closest('[data-gate-guest]')) {
    chooseGuest();
    closeGate();
    g.then();
    render();
    return;
  }
  if (g && (el.closest('[data-gate-close]') || el.classList.contains('gate-backdrop'))) {
    closeGate();
    render();
    return;
  }

  // Hộp chào mừng: lưu xong thì vào ván (nếu đang định chơi) với cấp máy hợp trình độ
  if (
    welcomeOpen &&
    handleWelcomeClick(el, render, (bot) => {
      if (bot) setBotLevel(bot);
      welcomeOpen = false;
      const after = afterWelcome;
      afterWelcome = null;
      after?.();
      render();
    })
  )
    return;

  // Màn Hồ sơ: đổi tên, xoá tài khoản
  if (
    route() === 'tai-khoan' &&
    handleAccountClick(el, render, () => {
      resetHome();
      resetLearn();
      location.hash = '#/';
      render();
    })
  )
    return;

  // Cài đặt: mở, đóng (nút Xong hoặc bấm ra ngoài), và từng tuỳ chọn
  if (el.closest('button[title="Cài đặt"]')) {
    settingsOpen = true;
    render();
    return;
  }
  if (settingsOpen && (el.closest('[data-close-settings]') || el.classList.contains('settings-backdrop'))) {
    settingsOpen = false;
    render();
    return;
  }
  const pref = el.closest<HTMLElement>('[data-pref]');
  if (pref) {
    const key = pref.dataset.pref as keyof Prefs | 'sound';
    if (key === 'sound') setSoundEnabled(!soundEnabled());
    else if (key === 'coords' || key === 'legal' || key === 'autoQueen') setPref(key, !prefs()[key]);
    pushPrefs();
    render();
    return;
  }

  const themed = el.closest<HTMLElement>('[data-set-theme], [data-set-board]');
  if (themed) {
    if (themed.dataset.setTheme) applyTheme(themed.dataset.setTheme as 'dark' | 'light');
    if (themed.dataset.setBoard) {
      // Trang mẫu thiết kế có bàn cờ mẫu riêng; ở mọi màn khác đây là tuỳ chọn của người chơi
      if (BOARD_THEMES.some((t) => t.id === themed.dataset.setBoard)) setPref('board', themed.dataset.setBoard as BoardTheme);
      else document.documentElement.dataset.board = themed.dataset.setBoard;
    }
    pushPrefs();
    render();
    return;
  }

  // Màn chơi và màn xem lại tự lo các nút của chúng
  if ((route() === 'choi' || route() === '') && handlePlayClick(el, render)) return;
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
    pushPrefs();
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

/* ---------------- Phím tắt ---------------- */

/**
 * Lùi/tiến nước bằng phím mũi tên, như Lichess và chess.com. Bấm đúng cái nút
 * đang có trên màn (theo title), nên màn nào có sổ nước là chạy, khỏi viết riêng.
 */
const KEYS: Record<string, string> = {
  ArrowLeft: 'Lùi một nước',
  ArrowRight: 'Tiến một nước',
  Home: 'Về đầu ván',
  End: 'Tới nước mới nhất',
  f: 'Lật bàn cờ',
  F: 'Lật bàn cờ',
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsOpen) {
    settingsOpen = false;
    render();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement;
  // Đang gõ chữ, hoặc đang đi quân bằng bàn phím trên bàn cờ, thì để yên
  if (t.closest('input, textarea, select, [contenteditable], [role="application"]')) return;
  const title = KEYS[e.key];
  if (!title) return;
  const btn = document.querySelector<HTMLButtonElement>(`button[title="${title}"]:not(:disabled)`);
  if (!btn) return;
  e.preventDefault();
  btn.click();
});

installApiHeader();
initTheme();
applyPrefs();
onAuthChange(onAuth);
window.addEventListener('hashchange', render);
render();
void loadPieces().catch((err) => console.error(err));
void loadMe();
