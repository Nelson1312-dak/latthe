import './ui/tokens.css';
import './ui/base.css';
import './ui/components/components.css';
import './ui/app.css';
import './ui/screens/screens.css';
// Nạp sau cùng: lớp tinh chỉnh gỡ các dấu hiệu "giao diện AI làm" (docs/DESIGN.md mục 2)
import './ui/refine.css';

import { installApiHeader } from './app/api-header.ts';
import { ping, pingVisit, startPresence } from './app/ping.ts';
import { currentDaily } from './app/daily.ts';
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
import { handleStatsClick, mountStats, refreshStats, stats } from './ui/screens/stats.ts';
import { mountShared, sharedIdFromPath, sharedView } from './ui/screens/shared.ts';
import { setSoundEnabled, soundEnabled } from './app/sound.ts';
import { applyPrefs, BOARD_THEMES, PIECE_SETS, prefs, setPref, type BoardTheme, type PieceSet, type Prefs } from './app/prefs.ts';
import { homeSide, mountHome, resetHome } from './ui/screens/home.ts';
import { handlePlayClick, mountPlay, play, playBar, setBotLevel } from './ui/screens/play.ts';
import { playBot } from './ui/screens/play-bot.ts';
import { handleReviewClick, mountReview, review } from './ui/screens/review.ts';
import { handleTrainClick, mountTrain, startDaily, startLesson, train } from './ui/screens/train.ts';
import { handleLearnClick, learn, mountLearn, resetLearn } from './ui/screens/learn.ts';
import { handleOnlineClick, hasLiveGame, leaveOnline, markOnlineEndSeen, miniOnline, mountOnline, online, onlineBar } from './ui/screens/online.ts';
import { playMode, setPlayMode } from './app/playmode.ts';
import { live } from './app/live.ts';
import { routeName, routeQuery } from './app/route.ts';
import { LESSONS } from './training/lessons.ts';
import { canInstall, initPwa, installApp, iosHint } from './app/pwa.ts';
import { IS_MINI, MINI_MODE, closeMini, fitMiniWindow, miniOpen, openMini, saveHandoff, takeHandoff } from './app/mini.ts';
import { exportPlayState, importPlayState, miniPlay, playStarted, resetPlay, startBotGame, type PlayHandoff } from './ui/screens/play.ts';
import { muteHere } from './app/sound.ts';
import { account, handleAccountClick, mountAccount, resetAccount } from './ui/screens/account.ts';
import { coachScreen, handleCoachClick, mountCoach, resetCoach } from './ui/screens/coach.ts';
import { specimen } from './ui/screens/specimen.ts';

/** Tên app, đặt theo bộ với latbai.vn. Đổi ở đây là đổi cả header lẫn tiêu đề tab. */
export const APP_NAME = 'Lật Cờ';

type Screen = { title: string; render: () => string };

const SCREENS: Record<string, Screen> = {
  // Sảnh dùng chung bàn cờ của màn Chơi, gắn thêm phần riêng vào cột phải
  '': { title: 'Sảnh', render: () => (onlineView() ? online() : play(homeSide())) },
  choi: { title: 'Chơi', render: () => (onlineView() ? online() : play()) },
  'choi-may': { title: 'Chơi với máy', render: playBot },
  'xem-lai': { title: 'Xem lại ván', render: review },
  'on-tap': { title: 'Ôn tập', render: train },
  hoc: { title: 'Học', render: learn },
  'huan-luyen': { title: 'Huấn luyện viên', render: coachScreen },
  'tai-khoan': { title: 'Hồ sơ', render: account },
  'thong-ke': { title: 'Thống kê', render: stats },
  'thiet-ke': { title: 'Trang thiết kế', render: specimen },
};

const NAV: { route: string; label: string; icon: IconName }[] = [
  // Xem lại và Đấu không còn là tab riêng: chấm ván hiện ngay khi hết ván, danh
  // sách ván cũ nằm trong Hồ sơ; đấu với người là một chế độ của tab Chơi.
  { route: 'choi', label: 'Chơi', icon: 'play' },
  { route: 'on-tap', label: 'Ôn tập', icon: 'cards' },
  { route: 'hoc', label: 'Học', icon: 'learn' },
  // AI đọc lịch sử ván của bạn: lỗi hay lặp lại + lộ trình học
  { route: 'huan-luyen', label: 'Huấn luyện', icon: 'coach' },
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
    `<a class="brand" href="/#/" aria-label="${APP_NAME} — về sảnh">` +
    `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><use href="#brand-n"/></svg>` +
    `<span>${APP_NAME}</span></a>` +
    `<nav class="top-nav" aria-label="Chính">` +
    NAV.map((n) => topLink(n.route, n.label, n.icon, current === '' ? 'choi' : current)).join('') +
    (auth.user?.admin ? topLink('thong-ke', 'Thống kê', 'review', current) : '') +
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

const bộQuân = () => PIECE_SETS.find((s) => s.id === prefs().pieces) ?? PIECE_SETS[0];

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
    `bộ quân ${bộQuân().name} của ${bộQuân().author} (${bộQuân().license}), ` +
    `<a href="/pieces/sets/LICENSES.txt" target="_blank" rel="noopener">giấy phép</a>.</span> ` +
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
    (auth.user?.admin ? item('thong-ke', 'Thống kê', 'review') : '') +
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
  if (typeof p.pieces === 'string' && PIECE_SETS.some((s) => s.id === p.pieces)) setPref('pieces', p.pieces as PieceSet);
  for (const k of ['coords', 'legal', 'autoQueen', 'assist'] as const) if (typeof p[k] === 'boolean') setPref(k, p[k]);
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
  // Ô mẫu: 2x2 ô cờ. Bàn có vân thì lấy đúng ảnh vân thu nhỏ.
  const ô = (x: number, y: number, light: boolean, t: (typeof BOARD_THEMES)[number]) =>
    t.tex
      ? `<image href="/board/${t.tex[light ? 0 : 1]}.webp" x="${x}" y="${y}" width="1" height="1" preserveAspectRatio="none"/>`
      : `<rect x="${x}" y="${y}" width="1" height="1" fill="${light ? t.light : t.dark}"/>`;
  const swatch = BOARD_THEMES.map(
    (t) =>
      `<button class="swatch${p.board === t.id ? ' is-active' : ''}" data-set-board="${t.id}" aria-pressed="${p.board === t.id}">` +
      `<svg class="swatch-board" viewBox="0 0 2 2" width="44" height="44" aria-hidden="true" shape-rendering="crispEdges">` +
      ô(0, 0, true, t) + ô(1, 0, false, t) + ô(0, 1, false, t) + ô(1, 1, true, t) +
      `</svg><span>${t.name}</span></button>`,
  ).join('');
  const quân = PIECE_SETS.map(
    (s) =>
      `<button class="piece-opt${p.pieces === s.id ? ' is-active' : ''}" data-set-pieces="${s.id}" aria-pressed="${p.pieces === s.id}">` +
      `<img src="/pieces/sets/${s.id}.preview.svg" alt="" width="64" height="32" loading="lazy"><span>${s.name}</span></button>`,
  ).join('');
  return (
    `<div class="dialog-backdrop settings-backdrop"><div class="dialog settings" role="dialog" aria-modal="true" aria-label="Cài đặt">` +
    `<h2>Cài đặt</h2><div class="dialog-body">` +
    `<p class="setup-label">Bộ quân</p><div class="piece-opts">${quân}</div>` +
    `<p class="setup-label">Bàn cờ</p><div class="swatches">${swatch}</div>` +
    `<p class="setup-label">Giao diện</p>` +
    `<div class="seg seg-fill" role="group" aria-label="Giao diện">` +
    `<button class="seg-item${theme === 'dark' ? ' is-active' : ''}" data-set-theme="dark">${icon('moon', 17)} Tối</button>` +
    `<button class="seg-item${theme === 'light' ? ' is-active' : ''}" data-set-theme="light">${icon('sun', 17)} Sáng</button>` +
    `</div>` +
    `<div class="pref-list">` +
    toggleRow('sound', 'Âm thanh', 'Đi quân, ăn quân, chiếu', soundEnabled()) +
    toggleRow('coords', 'Toạ độ', 'a–h, 1–8 ở mép bàn', p.coords) +
    toggleRow('legal', 'Chấm nước đi được', 'Khi cầm quân', p.legal) +
    toggleRow('autoQueen', 'Tự phong Hậu', 'Không hỏi khi phong cấp', p.autoQueen) +
    (canInstall()
      ? `<button class="pref-row" data-install-app><span class="pref-text"><b>Cài lên máy</b>` +
        `<span>Mở như app từ màn hình chính</span></span>${icon('next', 16)}</button>`
      : '') +
    `</div>` +
    (iosHint()
      ? `<p class="pref-keys">iPhone: Safari → Chia sẻ → <b>Thêm vào MH chính</b>.</p>`
      : '') +
    `<p class="pref-keys only-mouse"><kbd>←</kbd> <kbd>→</kbd> lùi/tiến · <kbd>F</kbd> lật bàn · chuột phải kéo: mũi tên, bấm: tô ô ` +
    `(<kbd>Shift</kbd> xanh, <kbd>Ctrl</kbd> đỏ, <kbd>Alt</kbd> lam) · chuột trái: xoá.</p>` +
    `</div><div class="dialog-actions">` +
    `<button class="btn btn-primary" data-close-settings>Xong</button>` +
    `</div></div></div>`
  );
}

/** Màn hình đang hiện, để biết lúc nào người dùng rời khỏi một màn. */
let mànTrước: string | null = null;

/** Tab Chơi đang hiện ván online (đang đánh, hoặc vừa xong mà chưa rời). */
function onlineView(): boolean {
  return playMode() === 'online' && hasLiveGame();
}
const PLAY_ROUTES = ['', 'choi'];

/** Đang đánh trên tab Chơi: thanh điều khiển ván thay thanh điều hướng (điện thoại). */
function gameBarFor(r: string, away: boolean): string {
  if (away || !PLAY_ROUTES.includes(r)) return '';
  if (onlineView()) return onlineBar();
  return playMode() === 'online' ? '' : playBar();
}

/* ---------------- Bàn cờ nổi ---------------- */

/** Trong bàn cờ nổi: đang che bàn cờ bằng tấm trơn (Esc). */
let miniCovered = false;
/** Che / hiện bàn cờ nổi: che thì thu cửa sổ thành thanh ngang, hiện thì trả cỡ cũ. */
function setMiniCovered(v: boolean): void {
  miniCovered = v;
  fitMiniWindow(v);
  render();
}
/** Lúc vừa bỏ tấm che: cú click đi kèm cú nhấn đó không được tính là bấm vào bàn cờ. */
let miniUncoveredAt = 0;

/** Bàn cờ nổi chỉ có một màn: bàn cờ chơi với máy. */
function renderMini(): void {
  document.title = APP_NAME;
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.className = 'app-mini';
  if (playMode() === 'online') {
    app.innerHTML = miniOnline(miniCovered);
    mountOnline(render);
    snapBoards(app);
    return;
  }
  app.innerHTML = miniPlay(miniCovered);
  mountPlay(render);
  snapBoards(app);
  // Ghi ván sau mỗi lần vẽ: đóng cửa sổ lúc nào thì trang chính cũng có ván mới nhất
  saveHandoff(exportPlayState());
}

/** Trang chính, trong lúc bàn cờ đang ở cửa sổ nổi. */
function miniAway(): string {
  return `<div class="screen"><div class="mini-away">
    <span class="mini-away-icon">${icon('float', 28)}</span>
    <h1>Bàn cờ đang ở cửa sổ nổi</h1>
    <p>Đóng cửa sổ nổi là ván quay về đây.</p>
    <button class="btn btn-primary" data-mini-back>Đưa bàn cờ về đây</button>
  </div></div>`;
}

/** Cửa sổ nổi vừa đóng: lấy ván về chơi tiếp ở trang chính. */
function onMiniClosed(): void {
  const h = takeHandoff<PlayHandoff>();
  if (h) importPlayState(h);
  markOnlineEndSeen();
  render();
}

function render(): void {
  if (IS_MINI) {
    renderMini();
    return;
  }
  // Link cũ #/ban (tab Đấu đã gộp vào tab Chơi): về Chơi, chế độ Với người
  if (routeName() === 'ban') {
    setPlayMode('online');
    location.replace('#/choi');
    return;
  }
  // Trang ván được chia sẻ: latbai.vn/van/<id>. Bấm sang mục khác (#/...) thì
  // quay về trang gốc, vì phần còn lại của app chạy theo #.
  const vanId = sharedIdFromPath();
  if (vanId && routeName() !== '') {
    location.replace('/' + location.hash);
    return;
  }
  if (vanId) {
    document.title = `Ván được chia sẻ · ${APP_NAME}`;
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.className = 'app';
    app.innerHTML = siteHeader('xem-lai') + `<main>${sharedView(vanId)}${siteFooter()}</main>` + bottomNav('xem-lai') +
      (settingsOpen ? settingsDialog() : '');
    mountShared(vanId, render);
    mànTrước = 'xem-lai';
    return;
  }

  // Mở thẳng một bài học từ trang công khai: #/hoc?bai=<id>
  if (routeName() === 'hoc') {
    const bài = LESSONS.find((l) => l.id === routeQuery().get('bai'));
    if (bài) {
      startLesson(bài);
      location.replace('#/on-tap');
      return;
    }
  }

  // Đang dở một ván online thì tab Chơi luôn hiện ván đó
  if (live.state && !live.state.over) setPlayMode('online');
  const r = route();
  if (mànTrước !== null && PLAY_ROUTES.includes(mànTrước) && !PLAY_ROUTES.includes(r)) leaveOnline();
  mànTrước = r;
  const screen = SCREENS[r];
  document.title = r ? `${screen.title} · ${APP_NAME}` : APP_NAME;
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.className = 'app';
  const away = miniOpen() && PLAY_ROUTES.includes(r);
  app.innerHTML =
    siteHeader(r) +
    `<main>${away ? miniAway() : screen.render()}${siteFooter()}</main>` +
    (gameBarFor(r, away) || bottomNav(r)) +
    (settingsOpen ? settingsDialog() : '') +
    (currentGate() && !auth.user ? gateDialog(currentGate()!) : '') +
    (welcomeOpen && auth.user ? welcomeDialog() : '');
  if ((r === 'choi' || r === '') && !away) {
    if (onlineView()) mountOnline(render);
    else {
      mountPlay(render);
      // Chế độ Với người: mở luồng tới server để tìm trận / nhận lời mời
      if (playMode() === 'online') mountOnline(render);
    }
  }
  if (r === 'xem-lai') mountReview(render);
  if (r === 'on-tap') mountTrain(render);
  if (r === 'tai-khoan') mountAccount(render);
  if (r === 'thong-ke') mountStats(render);
  if (r === 'hoc') mountLearn(render);
  if (r === 'huan-luyen') mountCoach(render);
  if (r === '') mountHome(render);
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

  if (route() === 'thong-ke' && handleStatsClick(el, render)) return;
  if (route() === 'thong-ke' && el.closest('[data-stats-refresh]')) {
    refreshStats(render);
    render();
    return;
  }

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
  if (el.closest('[data-install-app]')) {
    void installApp().then(() => render());
    return;
  }
  const pref = el.closest<HTMLElement>('[data-pref]');
  if (pref) {
    const key = pref.dataset.pref as keyof Prefs | 'sound';
    if (key === 'sound') setSoundEnabled(!soundEnabled());
    else if (key === 'coords' || key === 'legal' || key === 'autoQueen' || key === 'assist') setPref(key, !prefs()[key]);
    pushPrefs();
    render();
    return;
  }

  const bộ = el.closest<HTMLElement>('[data-set-pieces]');
  if (bộ) {
    if (PIECE_SETS.some((s) => s.id === bộ.dataset.setPieces)) setPref('pieces', bộ.dataset.setPieces as PieceSet);
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

  // Bàn cờ nổi: che / hiện bàn cờ (tấm che tự mở khi vừa chạm, xem pointerdown bên dưới)
  if (IS_MINI && el.closest('[data-mini-hide]')) {
    setMiniCovered(!miniCovered);
    return;
  }
  // Trang chính: mở bàn cờ nổi (mang theo ván đang dở), hoặc đưa nó về
  if (!IS_MINI && el.closest('button[title="Bàn cờ nổi"]')) {
    // Với máy: ván đang dở đi theo cửa sổ. Với người: ván nằm trên server, cửa sổ tự nối vào.
    const chếĐộ = playMode();
    saveHandoff(chếĐộ === 'machine' ? exportPlayState() : null);
    void openMini(onMiniClosed, chếĐộ).then((ok) => {
      if (ok) ping('mini_open');
      if (ok && chếĐộ === 'machine') resetPlay();
      if (!ok) saveHandoff(null);
      render();
    });
    return;
  }
  if (el.closest('[data-mini-back]')) {
    closeMini();
    return;
  }

  // Màn chơi và màn xem lại tự lo các nút của chúng
  if (route() === 'choi' || route() === '') {
    if (onlineView()) {
      if (handleOnlineClick(el, render)) return;
    } else {
      if (handlePlayClick(el, render)) return;
      if (playMode() === 'online' && handleOnlineClick(el, render)) return;
    }
  }
  if ((route() === 'xem-lai' || sharedIdFromPath()) && handleReviewClick(el, render)) return;
  if (route() === 'on-tap' && handleTrainClick(el, render)) return;
  if (route() === 'hoc' && handleLearnClick(el)) return;
  if (route() === 'huan-luyen' && handleCoachClick(el, render)) return;

  // Bài tập của ngày (dòng ở Sảnh): mở đúng bài đó ở màn Ôn tập
  if (el.closest('[data-daily]')) {
    const p = currentDaily()?.puzzle;
    if (p) {
      startDaily(p);
      location.hash = '#/on-tap';
    }
    return;
  }

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
      resetCoach();
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

// Tấm che của bàn cờ nổi: mở ngay lúc vừa nhấn chuột, không chờ đủ một cú click
// (click hỏng nếu giữa lúc nhấn và nhả màn hình bị vẽ lại, hoặc cửa sổ nổi chưa
// được chọn — bấm mãi không mở là đúng lỗi người chơi đã gặp).
// Cùng lý do, bấm vào bàn cờ lúc chưa vào ván là bắt đầu ván ngay khi nhấn: bàn
// cờ tự vẽ lại lúc nhấn chuột nên cú click không bao giờ tới được đây. Bắt ở pha
// capture (trước bàn cờ), vì sau đó ô vừa bấm đã bị gỡ khỏi trang.
document.addEventListener('pointerdown', (e) => {
  if (!IS_MINI || e.button !== 0) return;
  const t = e.target as HTMLElement;
  if (miniCovered && t.closest('[data-mini-cover]')) {
    e.preventDefault();
    miniUncoveredAt = performance.now();
    setMiniCovered(false);
    return;
  }
  // Bàn cờ nổi chưa vào ván: bấm vào bàn cờ là vào ván luôn, khỏi tìm nút Chơi
  if (playMode() === 'machine' && !miniCovered && !playStarted() && t.closest('#board') && performance.now() - miniUncoveredAt > 500) {
    startBotGame();
    render();
  }
}, true);

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
  // Bàn cờ nổi: Esc che bàn cờ ngay, bấm lại là mở
  if (IS_MINI && e.key === 'Escape') {
    setMiniCovered(!miniCovered);
    return;
  }
  if (e.key === 'Escape' && settingsOpen) {
    settingsOpen = false;
    render();
    return;
  }
  // Esc đóng hộp thoại hết ván
  if (e.key === 'Escape') {
    const x = document.querySelector<HTMLElement>('[data-end-close]');
    if (x) {
      x.click();
      return;
    }
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
if (IS_MINI) {
  // Bàn cờ nổi để chơi ở chỗ làm: không kêu, không hỏi đăng nhập (đã đăng nhập
  // thì ván vẫn được lưu), và nhận ván với máy đang dở từ trang chính.
  muteHere();
  chooseGuest();
  setPlayMode(MINI_MODE);
  if (MINI_MODE === 'machine') {
    const h = takeHandoff<PlayHandoff>();
    if (h) importPlayState(h);
  }
} else {
  initPwa(() => {
    if (settingsOpen) render();
  });
}
render();
void loadMe();
if (!IS_MINI) {
  pingVisit();
  // Đang ở mục nào (cho bảng Thống kê trực tiếp): ván online tính riêng
  startPresence(() => {
    const r = route();
    if (r === '' || r === 'choi') return onlineView() || playMode() === 'online' ? 'online' : 'choi';
    return r;
  });
}
