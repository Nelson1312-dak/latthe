// Bộ component dùng chung.
//
// Nguyên tắc sau lần tút lại: **ít hộp, nhiều nhịp**. Thông tin được tách bằng
// nét kẻ mảnh và khoảng trắng, không phải bằng việc nhét mỗi thứ vào một thẻ bo góc.
// Mỗi cột chỉ có MỘT mặt nền (.sheet), bên trong chia bằng <hr>.
// Mọi component phải có mặt đầy đủ trạng thái trên trang /#/thiet-ke.

import { icon, type IconName } from '../icons.ts';
import { CLASS_LABEL, CLASS_SYMBOL } from '../../board/Board.ts';
import { formatScore, type MoveClass, type Score } from '../../../shared/winrate.ts';
import type { PieceCode } from '../../../shared/fen.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Quân cờ nhỏ lấy từ sprite, dùng trong ký hiệu nước đi và danh sách quân đã ăn. */
export function pieceGlyph(code: PieceCode, cls = 'fig'): string {
  return `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true"><use href="#${code}"/></svg>`;
}

/**
 * Ký hiệu bên cầm quân: một con Vua nhỏ. Ô vuông tô màu dễ bị đọc nhầm thành
 * ô tích chọn, còn con Vua thì không lẫn vào đâu được.
 */
export function sideGlyph(side: 'w' | 'b'): string {
  return (
    `<span class="side-mark" role="img" aria-label="${side === 'w' ? 'cầm quân Trắng' : 'cầm quân Đen'}">` +
    pieceGlyph((side + 'k') as PieceCode, 'side-piece') +
    `</span>`
  );
}

/** Tên quân đọc được, cho trình đọc màn hình. */
const PIECE_WORD: Record<string, string> = { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã' };

/**
 * Ký hiệu hình: `Nf3` hiện thành hình con Mã rồi `f3`, như sách cờ và như
 * chess.com/Lichess. Dễ đọc hơn chữ cái với người mới, và đúng màu quân đang đi.
 */
export function figurine(san: string, side: 'w' | 'b'): string {
  const first = san[0];
  if (!PIECE_WORD[first]) return `<span class="san">${esc(san)}</span>`; // tốt, nhập thành
  const code = (side + first.toLowerCase()) as PieceCode;
  return (
    `<span class="san"><span class="sr">${PIECE_WORD[first]} </span>` +
    `${pieceGlyph(code)}${esc(san.slice(1))}</span>`
  );
}

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
    (o.loading ? '<span class="spinner" aria-hidden="true"></span>' : o.icon ? icon(o.icon, 17) : '') +
    `<span>${esc(o.label)}</span></button>`
  );
}

export function iconButton(name: IconName, title: string, opts: { disabled?: boolean; pressed?: boolean } = {}): string {
  return (
    `<button class="btn btn-icon" title="${esc(title)}" aria-label="${esc(title)}"` +
    `${opts.disabled ? ' disabled' : ''}${opts.pressed ? ' aria-pressed="true"' : ''}>${icon(name, 19)}</button>`
  );
}

/** Nhóm nút phụ dính liền nhau, ngăn bằng nét kẻ — gọn hơn một hàng nút rời rạc. */
export function toolbar(...groups: string[][]): string {
  return `<div class="toolbar">${groups.map((g) => `<span class="tool-group">${g.join('')}</span>`).join('')}</div>`;
}

/* ---------------- Clock ---------------- */
export type ClockState = 'idle' | 'running' | 'low' | 'flagged';

export function clock(ms: number, state: ClockState = 'idle', id?: string): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const body = `${m}:${String(s).padStart(2, '0')}`;
  const tenth = state === 'low' ? `<small>.${Math.floor((total % 1000) / 100)}</small>` : '';
  // data-clock để màn hình cập nhật đúng đồng hồ tại chỗ mỗi giây
  const tag = id ? ` data-clock="${id}"` : '';
  return `<div class="clock mono clock-${state}"${tag}>${body}${tenth}</div>`;
}

/* ---------------- PlayerStrip ---------------- */
export interface PlayerOptions {
  name: string;
  /** Bên cầm quân. Hiện trong ô ảnh đại diện khi không có ảnh thật. */
  side: 'w' | 'b';
  /** Ảnh đại diện; không có thì vẽ quân Vua của bên đó. */
  avatar?: string | null;
  rating?: number | string;
  bot?: boolean;
  clockMs?: number;
  clockState?: ClockState;
  /** Gắn vào đồng hồ để màn hình cập nhật tại chỗ ('w' hoặc 'b'). */
  clockId?: string;
  took?: PieceCode[];
  diff?: number;
  status?: string;
  you?: boolean;
  /** Đối thủ là AI của server (ván online khi hàng chờ trống). */
  ai?: boolean;
  /** Độ chính xác cả ván, chỉ có ở màn xem lại. */
  accuracy?: number;
  /** Nút gắn ở cuối thanh (ví dụ Lật bàn cờ trên điện thoại). */
  tools?: string;
}

/**
 * Thanh người chơi, xếp như chess.com: ảnh đại diện bên trái, tên và điểm ở
 * giữa, quân đã ăn nằm ngay dưới tên, đồng hồ thành một ô to bên phải.
 *
 * Bản trước nhồi tất cả vào một hàng ngang nên tên, điểm, quân đã ăn và đồng
 * hồ tranh nhau chỗ; bàn cờ to lên thì hàng đó càng thưa thớt, trông rời rạc.
 */
export function playerStrip(o: PlayerOptions): string {
  const taken = (o.took ?? []).map((p) => pieceGlyph(p, 'took-piece')).join('');
  const face = o.avatar
    ? `<img src="${esc(o.avatar)}" alt="" width="36" height="36">`
    : pieceGlyph((o.side + 'k') as PieceCode, 'face-piece');
  const hàngHai =
    taken || o.diff
      ? `<span class="took">${taken}${o.diff && o.diff > 0 ? `<b class="mono">+${o.diff}</b>` : ''}</span>`
      : '';
  return (
    `<div class="player${o.clockState === 'running' ? ' is-turn' : ''}">` +
    `<span class="player-face" data-side="${o.side}">${face}</span>` +
    `<span class="player-text">` +
    `<span class="player-id">` +
    `<b class="player-name">${esc(o.name)}</b>` +
    (o.rating !== undefined ? `<span class="player-rating mono">${esc(String(o.rating))}</span>` : '') +
    (o.ai ? '<span class="tag tag-ai">AI</span>' : '') +
    (o.status ? `<span class="player-status">${esc(o.status)}</span>` : '') +
    `</span>` +
    hàngHai +
    `</span>` +
    (o.accuracy !== undefined
      ? `<span class="player-acc"><b class="mono">${o.accuracy}%</b> chính xác</span>`
      : '') +
    (o.clockMs !== undefined ? clock(o.clockMs, o.clockState, o.clockId) : '') +
    (o.tools ? `<span class="strip-tools">${o.tools}</span>` : '') +
    `</div>`
  );
}

/* ---------------- Huy hiệu xếp loại ---------------- */
export function classBadge(cls: MoveClass, size: 'sm' | 'md' = 'sm'): string {
  if (cls === 'book') {
    return `<span class="badge badge-book badge-${size}" title="Khai cuộc chuẩn">${icon('book', size === 'sm' ? 13 : 16)}</span>`;
  }
  return `<span class="badge badge-${size}" style="--badge:var(--cls-${cls})" title="${CLASS_LABEL[cls]}">${CLASS_SYMBOL[cls]}</span>`;
}

/* ---------------- Sổ nước đi ---------------- */
export interface MoveRow {
  san: string;
  cls?: MoveClass;
  /** Điểm sau nước đi; hiện ở cột phải khi xem lại. */
  score?: Score;
}

/**
 * Sổ ghi ván: số nước treo ra lề trái, hai cột Trắng/Đen, huy hiệu xếp loại
 * bám sát nước, cột điểm bên phải khi có. Dòng đang xem có vạch nhấn.
 */
export function moveList(moves: MoveRow[], currentPly?: number, opts: { scores?: boolean } = {}): string {
  const cell = (m: MoveRow | undefined, ply: number) => {
    if (!m) return '<span class="move move-empty"></span>';
    const side = ply % 2 === 1 ? 'w' : 'b';
    return (
      `<button class="move${ply === currentPly ? ' is-current' : ''}" data-ply="${ply}">` +
      figurine(m.san, side) +
      (m.cls ? classBadge(m.cls) : '') +
      (opts.scores && m.score ? `<span class="move-score mono">${formatScore(m.score)}</span>` : '') +
      `</button>`
    );
  };

  const rows: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push(
      `<div class="move-row"><span class="move-no mono">${i / 2 + 1}</span>` +
        `${cell(moves[i], i + 1)}${cell(moves[i + 1], i + 2)}</div>`,
    );
  }
  return `<div class="move-list${opts.scores ? ' has-scores' : ''}">${rows.join('')}</div>`;
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

/* ---------------- Lời bình của Huấn luyện viên ---------------- */
export interface CoachOptions {
  cls?: MoveClass;
  /** Nước đi dạng "11.Qg4". */
  move?: string;
  side?: 'w' | 'b';
  text: string;
  better?: { san: string; side: 'w' | 'b'; why: string };
  source: 'llm' | 'template' | 'typing';
  actions?: string;
}

/**
 * Trình bày như lời bình bên lề một ván cờ in: vạch dọc bên trái, đầu đề là
 * nước đi viết bằng ký hiệu hình, phần giải thích dùng chữ serif cho dễ đọc
 * thành câu. Không khung, không biểu tượng robot.
 */
export function coachPanel(o: CoachOptions): string {
  const srcText = {
    llm: 'Engine chấm nước · máy viết lời bình',
    template: 'Engine chấm nước · lời bình mẫu',
    typing: 'Engine chấm nước · đang viết',
  }[o.source];
  const head = o.move
    ? `<p class="note-move">${o.move.replace(/^(\d+\.{1,3})/, '<span class="mono">$1</span>')
        .replace(/([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][+#=A-Z]*|O-O-O|O-O)$/, (san) => figurine(san, o.side ?? 'w'))}` +
      (o.cls ? `${classBadge(o.cls, 'md')}<span class="note-verdict">${CLASS_LABEL[o.cls]}</span>` : '') +
      `</p>`
    : '<p class="note-move"><span class="note-verdict">Huấn luyện viên</span></p>';
  return (
    `<section class="note" aria-live="polite">` +
    head +
    `<p class="note-text${o.source === 'typing' ? ' is-typing' : ''}">${esc(o.text)}</p>` +
    (o.better
      ? `<p class="note-better">Tốt hơn ${figurine(o.better.san, o.better.side)} — ${esc(o.better.why)}</p>`
      : '') +
    (o.actions ? `<div class="note-actions">${o.actions}</div>` : '') +
    `<p class="note-source">${srcText}</p>` +
    `</section>`
  );
}

/* ---------------- HintButton ---------------- */
/**
 * Chữ trên nút gợi ý theo số nấc đã mở (tối đa 3): "Gợi ý" → "Gợi ý 2/3" →
 * "Gợi ý 3/3" → "Hết gợi ý". Trước đây là ba chấm nhỏ ở góc nút — không ai hiểu.
 */
export function hintLabel(used: number): string {
  return used <= 0 ? 'Gợi ý' : used >= 3 ? 'Hết gợi ý' : `Gợi ý ${used + 1}/3`;
}

export function hintButton(used: 0 | 1 | 2 | 3): string {
  return `<div class="hint">${button({ label: hintLabel(used), icon: 'hint', disabled: used === 3 })}</div>`;
}

/* ---------------- Mặt nền và nhịp ---------------- */
/** Một cột chỉ nên có một mặt nền; bên trong chia bằng rule(). */
export function sheet(...parts: string[]): string {
  return `<section class="sheet">${parts.join('')}</section>`;
}

/** Tiêu đề nhỏ kèm nét kẻ kéo hết chiều ngang. */
export function rule(label: string, right = ''): string {
  return `<div class="rule"><span class="rule-label">${esc(label)}</span><i></i>${right}</div>`;
}

/** Số liệu viết thành dòng, không phải ô dashboard. */
export function stats(items: [string, string][]): string {
  return (
    `<dl class="stats">` +
    items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join('') +
    `</dl>`
  );
}

/** Dòng trạng thái trong luồng nội dung, không phải hộp nổi. */
export function notice(text: string, kind: 'info' | 'danger' | 'locked' = 'info', iconName?: IconName): string {
  return `<p class="notice notice-${kind}">${iconName ? icon(iconName, 16) : ''}${esc(text)}</p>`;
}

export function dialog(title: string, body: string, actions: string): string {
  return (
    `<div class="dialog-backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">` +
    `<h2>${esc(title)}</h2><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div></div></div>`
  );
}

export { esc };

/**
 * Hàng số trình độ: vài ô ngang hàng, con số to ở trên, nhãn nhỏ ở dưới.
 * Thay cho kiểu "nhãn ……… số" xếp dọc hay một thẻ to có ảnh — gọn và đọc lướt được.
 */
export function levelRow(items: [string, string][]): string {
  return (
    `<div class="level-row">` +
    items.map(([label, value]) => `<div><b class="mono">${esc(value)}</b><span>${esc(label)}</span></div>`).join('') +
    `</div>`
  );
}
