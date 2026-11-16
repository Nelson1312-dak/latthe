// Bộ component dùng chung. Mỗi hàm trả về HTML; màn hình ghép chúng lại.
// Mọi component phải có mặt đầy đủ trạng thái trên trang /#/thiet-ke.

import { icon, type IconName } from '../icons.ts';
import { CLASS_LABEL, CLASS_SYMBOL } from '../../board/Board.ts';
import { formatScore, type MoveClass, type Score } from '../../../shared/winrate.ts';
import type { PieceCode } from '../../../shared/fen.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/* ---------------- Button ---------------- */
export interface ButtonOptions {
  label: string;
  kind?: 'primary' | 'secondary' | 'text' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
  full?: boolean;
  title?: string;
}

export function button(o: ButtonOptions): string {
  const cls = ['btn', `btn-${o.kind ?? 'secondary'}`, o.full ? 'btn-full' : '', o.loading ? 'is-loading' : '']
    .filter(Boolean)
    .join(' ');
  return (
    `<button class="${cls}"${o.disabled ? ' disabled' : ''}${o.pressed ? ' aria-pressed="true"' : ''}` +
    `${o.title ? ` title="${esc(o.title)}"` : ''}>` +
    (o.icon ? icon(o.icon, 18) : '') +
    `<span>${esc(o.label)}</span>` +
    (o.loading ? '<span class="spinner" aria-hidden="true"></span>' : '') +
    `</button>`
  );
}

export function iconButton(name: IconName, title: string, opts: { disabled?: boolean; pressed?: boolean } = {}): string {
  return (
    `<button class="btn btn-icon" title="${esc(title)}" aria-label="${esc(title)}"` +
    `${opts.disabled ? ' disabled' : ''}${opts.pressed ? ' aria-pressed="true"' : ''}>${icon(name, 20)}</button>`
  );
}

/* ---------------- Clock ---------------- */
export type ClockState = 'idle' | 'running' | 'low' | 'flagged';

export function clock(ms: number, state: ClockState = 'idle'): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const tenth = Math.floor((total % 1000) / 100);
  const text = state === 'low' ? `${m}:${String(s).padStart(2, '0')}.${tenth}` : `${m}:${String(s).padStart(2, '0')}`;
  return `<div class="clock mono clock-${state}">${text}</div>`;
}

/* ---------------- PlayerStrip ---------------- */
export interface PlayerOptions {
  name: string;
  rating?: number | string;
  avatar?: 'user' | 'engine';
  clockMs?: number;
  clockState?: ClockState;
  took?: PieceCode[];
  diff?: number;
  status?: string;
  you?: boolean;
}

export function playerStrip(o: PlayerOptions): string {
  const taken = (o.took ?? [])
    .map((p) => `<svg class="mini-piece" viewBox="0 0 40 40" aria-hidden="true"><use href="#${p}"/></svg>`)
    .join('');
  return (
    `<div class="player">` +
    `<span class="avatar">${icon(o.avatar === 'engine' ? 'engine' : 'user', 18)}</span>` +
    `<span class="player-name">${esc(o.name)}${o.you ? '<span class="tag-you">bạn</span>' : ''}</span>` +
    (o.rating !== undefined ? `<span class="player-rating mono">${esc(String(o.rating))}</span>` : '') +
    (taken || o.diff
      ? `<span class="taken">${taken}${o.diff && o.diff > 0 ? `<span class="diff mono">+${o.diff}</span>` : ''}</span>`
      : '') +
    (o.status ? `<span class="player-status">${esc(o.status)}</span>` : '') +
    (o.clockMs !== undefined ? clock(o.clockMs, o.clockState) : '') +
    `</div>`
  );
}

/* ---------------- Huy hiệu xếp loại ---------------- */
export function classBadge(cls: MoveClass, size: 'sm' | 'md' = 'sm'): string {
  if (cls === 'book') {
    return `<span class="badge badge-book badge-${size}" title="Sách">${icon('book', size === 'sm' ? 13 : 16)}</span>`;
  }
  return `<span class="badge badge-${size}" style="--badge:var(--cls-${cls})" title="${CLASS_LABEL[cls]}">${CLASS_SYMBOL[cls]}</span>`;
}

/* ---------------- MoveList ---------------- */
export interface MoveRow {
  san: string;
  cls?: MoveClass;
}

export function moveList(moves: MoveRow[], currentPly?: number): string {
  const cell = (m: MoveRow | undefined, ply: number) =>
    m
      ? `<button class="move${ply === currentPly ? ' is-current' : ''}" data-ply="${ply}">` +
        `<span class="move-san">${esc(m.san)}</span>${m.cls ? classBadge(m.cls) : ''}</button>`
      : '<span class="move move-empty"></span>';

  const rows: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push(
      `<div class="move-row"><span class="move-no mono">${i / 2 + 1}.</span>` +
        `${cell(moves[i], i + 1)}${cell(moves[i + 1], i + 2)}</div>`,
    );
  }
  return `<div class="move-list">${rows.join('')}</div>`;
}

/* ---------------- EvalBar ---------------- */
export function evalBar(score: Score, orientation: 'vertical' | 'horizontal' = 'vertical'): string {
  const pct = score.mate !== undefined ? (score.mate > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.004 * score.cp));
  const clamped = Math.min(0.97, Math.max(0.03, pct));
  const whiteAhead = score.mate !== undefined ? score.mate > 0 : score.cp >= 0;
  return (
    `<div class="evalbar evalbar-${orientation}" role="img" aria-label="Đánh giá ${formatScore(score)}">` +
    `<div class="evalbar-white" style="--pct:${(clamped * 100).toFixed(1)}%"></div>` +
    `<span class="evalbar-text mono ${whiteAhead ? 'on-white' : 'on-black'}">${formatScore(score)}</span>` +
    `</div>`
  );
}

/* ---------------- CoachPanel ---------------- */
export interface CoachOptions {
  cls?: MoveClass;
  move?: string;
  text: string;
  better?: string;
  source: 'llm' | 'template' | 'typing';
  actions?: string;
}

export function coachPanel(o: CoachOptions): string {
  const srcText =
    o.source === 'template'
      ? 'Phân tích của engine · lời bình mẫu'
      : o.source === 'typing'
        ? 'Phân tích của engine · đang soạn lời bình'
        : 'Phân tích của engine · lời bình tạo tự động';
  return (
    `<section class="coach panel" aria-live="polite">` +
    `<header class="coach-head">${icon('coach', 18)}<h3>Huấn luyện viên</h3>` +
    (o.cls && o.move
      ? `<span class="coach-move">${classBadge(o.cls, 'md')}<span class="mono">${esc(o.move)}</span>` +
        `<span class="muted">${CLASS_LABEL[o.cls]}</span></span>`
      : '') +
    `</header>` +
    `<p class="coach-text${o.source === 'typing' ? ' is-typing' : ''}">${esc(o.text)}</p>` +
    (o.better ? `<p class="coach-better">Tốt hơn: <span class="mono">${esc(o.better)}</span></p>` : '') +
    (o.actions ? `<div class="coach-actions">${o.actions}</div>` : '') +
    `<p class="coach-source label">${srcText}</p>` +
    `</section>`
  );
}

/* ---------------- HintButton ---------------- */
export function hintButton(used: 0 | 1 | 2 | 3): string {
  const labels = ['Gợi ý', 'Gợi ý: quân nào', 'Gợi ý: nước cụ thể', 'Đã dùng hết gợi ý'];
  return (
    `<div class="hint">` +
    button({ label: labels[used], icon: 'hint', disabled: used === 3 }) +
    `<span class="hint-dots" aria-label="Đã dùng ${used} trên 3 nấc gợi ý">` +
    [0, 1, 2].map((i) => `<span class="hint-dot${i < used ? ' is-on' : ''}"></span>`).join('') +
    `</span></div>`
  );
}

/* ---------------- Toast và Dialog ---------------- */
export function toast(text: string, kind: 'info' | 'danger' = 'info'): string {
  return `<div class="toast toast-${kind}" role="status">${esc(text)}</div>`;
}

export function dialog(title: string, body: string, actions: string): string {
  return (
    `<div class="dialog-backdrop"><div class="dialog panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">` +
    `<h2>${esc(title)}</h2><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div></div></div>`
  );
}

export { esc };
