import './ui/tokens.css';
import './ui/base.css';
import './ui/components/components.css';
import './ui/app.css';
import './ui/screens/screens.css';

import { loadPieces } from './board/sprite.ts';
import { icon, type IconName } from './ui/icons.ts';
import { home } from './ui/screens/home.ts';
import { playBot } from './ui/screens/play-bot.ts';
import { review } from './ui/screens/review.ts';
import { train } from './ui/screens/train.ts';
import { online } from './ui/screens/online.ts';
import { specimen } from './ui/screens/specimen.ts';

type Screen = { title: string; render: () => string };

const SCREENS: Record<string, Screen> = {
  '': { title: 'Sảnh', render: home },
  choi: { title: 'Chơi với máy', render: playBot },
  'xem-lai': { title: 'Xem lại ván', render: review },
  'on-tap': { title: 'Ôn tập', render: train },
  ban: { title: 'Ván với bạn', render: online },
  'thiet-ke': { title: 'Trang thiết kế', render: specimen },
};

const NAV: { route: string; label: string; icon: IconName }[] = [
  { route: 'choi', label: 'Chơi', icon: 'play' },
  { route: 'xem-lai', label: 'Xem lại', icon: 'review' },
  { route: 'on-tap', label: 'Ôn tập', icon: 'cards' },
  { route: 'ban', label: 'Bạn bè', icon: 'friends' },
];

function route(): string {
  const r = location.hash.replace(/^#\/?/, '');
  return r in SCREENS ? r : '';
}

function nav(current: string): string {
  const item = (route: string, label: string, name: IconName) =>
    `<a class="nav-item${route === current ? ' is-active' : ''}" href="#/${route}">${icon(name, 22)}<span>${label}</span></a>`;
  return (
    `<nav class="nav" aria-label="Chính">` +
    NAV.map((n) => item(n.route, n.label, n.icon)).join('') +
    `<span class="nav-spacer"></span>` +
    item('thiet-ke', 'Thiết kế', 'book') +
    `</nav>`
  );
}

function render(): void {
  const r = route();
  const screen = SCREENS[r];
  document.title = r ? `${screen.title} · Cờ vua` : 'Cờ vua';
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.className = 'app';
  app.innerHTML = nav(r) + `<main>${screen.render()}</main>`;
}

/* Giao diện sáng/tối: nhớ lựa chọn, mặc định theo máy. */
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

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-set-theme], [data-set-board]');
  if (!el) return;
  if (el.dataset.setTheme) applyTheme(el.dataset.setTheme as 'dark' | 'light');
  if (el.dataset.setBoard) document.documentElement.dataset.board = el.dataset.setBoard;
  render();
});

initTheme();
window.addEventListener('hashchange', render);
loadPieces()
  .catch((err) => console.error(err))
  .finally(render);
render();
