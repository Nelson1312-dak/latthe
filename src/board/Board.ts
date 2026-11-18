// Vẽ bàn cờ bằng SVG. Dùng cho cả màn hình tĩnh (GĐ0) lẫn bàn cờ tương tác sau này.
// Mọi màu lấy từ token CSS, không viết cứng.

import { FILES, piecesFromFen, squareOf, type PieceCode, type Square } from '../../shared/fen.ts';
import type { MoveClass } from '../../shared/winrate.ts';

const SQ = 50; // cạnh một ô trong hệ toạ độ SVG
const SIZE = SQ * 8;
const PIECE_SCALE = SQ / 40; // sprite cburnett vẽ trong khung 40x40

/**
 * Màu bút vẽ của người chơi, theo chess.com: mũi tên mặc định màu cam ('y'),
 * tô ô mặc định màu đỏ; giữ Shift là xanh lá, Ctrl là đỏ, Alt là xanh dương.
 */
export type Brush = 'g' | 'r' | 'b' | 'y';

/** Huy hiệu trên ô Vua khi ván kết thúc, như chess.com. */
export type EndBadgeKind = 'win' | 'mate' | 'resign' | 'timeout' | 'draw';

export interface EndBadge {
  square: Square;
  kind: EndBadgeKind;
}

export interface Arrow {
  from: Square;
  to: Square;
  kind?: 'coach' | 'user';
  /** Mũi tên người chơi tự vẽ. Có `brush` thì bỏ qua `kind`. */
  brush?: Brush;
}

export interface Circle {
  square: Square;
  brush: Brush;
}

export interface ClassBadge {
  square: Square;
  cls: MoveClass;
}

export interface BoardOptions {
  fen: string;
  /** Bên nào ở phía dưới. */
  orientation?: 'w' | 'b';
  /** Ô đi và ô đến của nước vừa đi. */
  lastMove?: [Square, Square];
  selected?: Square;
  /** Ô có thể đi tới (chấm tròn); ô có quân đối phương vẽ thành vòng. */
  legal?: Square[];
  legalCaptures?: Square[];
  /** Ô có Vua đang bị chiếu. */
  check?: Square;
  arrows?: Arrow[];
  /** Ô người chơi tự khoanh bằng chuột phải. */
  circles?: Circle[];
  /** Nước đã chọn đi trước, chờ tới lượt mới đi. */
  premove?: [Square, Square];
  /** Ô có quân đang bị kéo: vẽ mờ quân gốc để biết nó từ đâu tới. */
  dragging?: Square;
  /** Ô đang ở dưới quân bị kéo. */
  hover?: Square;
  badge?: ClassBadge;
  /** Ván đã xong: huy hiệu trên hai ô Vua (thắng, bị chiếu hết, hòa...). */
  endBadges?: EndBadge[];
  /** Ô đang được bàn phím trỏ tới (chỉ hiện khi người chơi dùng bàn phím). */
  focus?: Square;
  coordinates?: boolean;
  /** Nhãn cho trình đọc màn hình. */
  label?: string;
}

export const CLASS_SYMBOL: Record<MoveClass, string> = {
  book: '',
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  miss: '✕',
};

export const CLASS_LABEL: Record<MoveClass, string> = {
  book: 'Sách',
  best: 'Tốt nhất',
  good: 'Tốt',
  inaccuracy: 'Thiếu chính xác',
  mistake: 'Sai',
  blunder: 'Sai nghiêm trọng',
  miss: 'Bỏ lỡ',
};

function xy(sq: Square, orientation: 'w' | 'b'): [number, number] {
  const f = FILES.indexOf(sq[0] as (typeof FILES)[number]);
  const r = Number(sq[1]) - 1;
  if (f < 0 || r < 0 || r > 7) throw new Error(`Ô không hợp lệ: ${sq}`);
  return orientation === 'w' ? [f * SQ, (7 - r) * SQ] : [(7 - f) * SQ, r * SQ];
}

/** Toạ độ góc trên trái của một ô, trong hệ toạ độ SVG. Dùng cho animation. */
export function squareXY(sq: Square, orientation: 'w' | 'b' = 'w'): [number, number] {
  return xy(sq, orientation);
}

function centre(sq: Square, orientation: 'w' | 'b'): [number, number] {
  const [x, y] = xy(sq, orientation);
  return [x + SQ / 2, y + SQ / 2];
}

/**
 * Đường đi của một mũi tên, trả về chuỗi "x,y x,y ..." cho <polyline>.
 *
 * Mũi tên phải đi theo đúng cách quân cờ đi, chứ không phải cứ nối thẳng hai ô:
 * nước của Mã là hình chữ L nên mũi tên cũng gấp khúc — đi hai ô theo trục dài
 * trước rồi mới rẽ, đúng như chess.com và Lichess vẽ. Nối thẳng thì mũi tên cắt
 * chéo qua giữa bàn cờ, chỉ đúng với Xe/Tượng/Hậu.
 *
 * Trả về null nếu hai ô trùng nhau (không có mũi tên nào để vẽ).
 */
export function arrowPath(
  from: Square,
  to: Square,
  orientation: 'w' | 'b',
  headRoom: number,
): string | null {
  const [x1, y1] = centre(from, orientation);
  const [x2, y2] = centre(to, orientation);
  if (x1 === x2 && y1 === y2) return null;

  // Chênh lệch tính bằng số ô, theo hệ toạ độ MÀN HÌNH (đã tính hướng bàn cờ)
  const cx = Math.round((x2 - x1) / SQ);
  const cy = Math.round((y2 - y1) / SQ);
  const knight =
    (Math.abs(cx) === 1 && Math.abs(cy) === 2) || (Math.abs(cx) === 2 && Math.abs(cy) === 1);

  /** Lùi điểm cuối lại để chỗ cho đầu mũi tên. */
  const pullBack = (ax: number, ay: number, bx: number, by: number): [number, number] => {
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return [bx - ((bx - ax) / len) * headRoom, by - ((by - ay) / len) * headRoom];
  };

  if (knight) {
    // Đi trục dài trước rồi rẽ — giống hệt cách người ta cầm quân Mã mà đi
    const [kx, ky] = Math.abs(cx) === 2 ? [x2, y1] : [x1, y2];
    const [ex, ey] = pullBack(kx, ky, x2, y2);
    // Bắt đầu lùi khỏi tâm ô xuất phát một chút cho đỡ đè lên quân
    const len = Math.hypot(kx - x1, ky - y1) || 1;
    const sx = x1 + ((kx - x1) / len) * (SQ * 0.3);
    const sy = y1 + ((ky - y1) / len) * (SQ * 0.3);
    return `${sx},${sy} ${kx},${ky} ${ex},${ey}`;
  }

  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const sx = x1 + ux * SQ * 0.3;
  const sy = y1 + uy * SQ * 0.3;
  const ex = x2 - ux * headRoom;
  const ey = y2 - uy * headRoom;
  return `${sx},${sy} ${ex},${ey}`;
}

let boardSeq = 0;

export function boardSvg(o: BoardOptions): string {
  const or = o.orientation ?? 'w';
  // Mỗi bàn cờ cần id riêng, nếu không hai bàn trên cùng trang sẽ dùng nhầm
  // gradient/mũi tên của nhau.
  const uid = `b${++boardSeq}`;
  const pieces = piecesFromFen(o.fen);
  const parts: string[] = [];

  // Ô cờ
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = squareOf(f, r);
      const [x, y] = xy(sq, or);
      const light = (f + r) % 2 === 1;
      parts.push(`<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--sq-${light ? 'light' : 'dark'})" shape-rendering="crispEdges"/>`);
    }
  }

  // Đánh dấu nằm dưới quân
  for (const sq of o.lastMove ?? []) {
    const [x, y] = xy(sq, or);
    parts.push(`<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--mark-move)"/>`);
  }
  for (const sq of o.premove ?? []) {
    const [x, y] = xy(sq, or);
    parts.push(`<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--mark-premove)"/>`);
  }
  if (o.selected) {
    const [x, y] = xy(o.selected, or);
    parts.push(`<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--mark-select)"/>`);
  }
  // Ô người chơi tô bằng chuột phải: tô kín cả ô như chess.com, nằm dưới quân
  for (const c of o.circles ?? []) {
    const [x, y] = xy(c.square, or);
    parts.push(
      `<rect class="mark-sq" x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--brush-${c.brush})" opacity=".8" shape-rendering="crispEdges"/>`,
    );
  }
  // Vua bị chiếu hết: cả ô đỏ lên, rõ hơn quầng đỏ lúc bị chiếu thường
  for (const b of o.endBadges ?? []) {
    if (b.kind !== 'mate') continue;
    const [x, y] = xy(b.square, or);
    parts.push(
      `<rect class="mate-sq" x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--mark-check)" opacity=".75" shape-rendering="crispEdges"/>`,
    );
  }
  if (o.check) {
    const [cx, cy] = centre(o.check, or);
    parts.push(
      `<radialGradient id="${uid}-check"><stop offset="0%" stop-color="var(--mark-check)" stop-opacity=".95"/>` +
        `<stop offset="55%" stop-color="var(--mark-check)" stop-opacity=".6"/>` +
        `<stop offset="100%" stop-color="var(--mark-check)" stop-opacity="0"/></radialGradient>`,
      `<circle cx="${cx}" cy="${cy}" r="${SQ * 0.62}" fill="url(#${uid}-check)"/>`,
    );
  }

  // Toạ độ trong góc ô biên
  if (o.coordinates !== false) {
    for (let i = 0; i < 8; i++) {
      const fileSq = or === 'w' ? squareOf(i, 0) : squareOf(i, 7);
      const rankSq = or === 'w' ? squareOf(0, i) : squareOf(7, i);
      const [fx, fy] = xy(fileSq, or);
      const [rx, ry] = xy(rankSq, or);
      const fileLight = (i + (or === 'w' ? 0 : 7)) % 2 === 1;
      const rankLight = ((or === 'w' ? 0 : 7) + i) % 2 === 1;
      parts.push(
        `<text class="coord" x="${fx + SQ - 3}" y="${fy + SQ - 3}" text-anchor="end" font-size="9" font-weight="600" fill="var(--sq-${fileLight ? 'dark' : 'light'})">${FILES[i]}</text>`,
        `<text class="coord" x="${rx + 3}" y="${ry + 11}" font-size="9" font-weight="600" fill="var(--sq-${rankLight ? 'dark' : 'light'})">${i + 1}</text>`,
      );
    }
  }

  // Quân. Lớp ngoài giữ vị trí bằng thuộc tính transform, lớp trong để trống
  // cho CSS transform — nhờ vậy animation không phá vị trí ô.
  for (const [sq, code] of pieces) {
    const [x, y] = xy(sq, or);
    // Quân đang bị kéo: để lại một bóng mờ ở ô gốc, như Lichess
    const fade = sq === o.dragging ? ' opacity=".3"' : '';
    parts.push(
      `<g class="sq" data-sq="${sq}" transform="translate(${x} ${y})">` +
        `<g class="pc"${fade}><use href="#${code satisfies PieceCode}" transform="scale(${PIECE_SCALE})"/></g>` +
        `</g>`,
    );
  }

  // Ô đang ở dưới quân bị kéo
  if (o.hover && o.hover !== o.dragging) {
    const [x, y] = xy(o.hover, or);
    parts.push(
      `<rect x="${x + 1.5}" y="${y + 1.5}" width="${SQ - 3}" height="${SQ - 3}" fill="none" ` +
        `stroke="var(--mark-hover)" stroke-width="3"/>`,
    );
  }

  // Khung ô đang trỏ bằng bàn phím
  if (o.focus) {
    const [x, y] = xy(o.focus, or);
    parts.push(
      `<rect x="${x + 1.5}" y="${y + 1.5}" width="${SQ - 3}" height="${SQ - 3}" fill="none" ` +
        `stroke="var(--focus)" stroke-width="3"/>`,
    );
  }

  // Nước đi hợp lệ (vẽ trên quân để thấy được vòng bắt quân)
  for (const sq of o.legal ?? []) {
    const [cx, cy] = centre(sq, or);
    parts.push(`<circle class="legal" cx="${cx}" cy="${cy}" r="${SQ * 0.14}" fill="var(--mark-legal)"/>`);
  }
  for (const sq of o.legalCaptures ?? []) {
    const [cx, cy] = centre(sq, or);
    parts.push(`<circle class="legal" cx="${cx}" cy="${cy}" r="${SQ * 0.42}" fill="none" stroke="var(--mark-legal)" stroke-width="${SQ * 0.1}"/>`);
  }

  // Mũi tên
  (o.arrows ?? []).forEach((a, i) => {
    const colour = a.brush
      ? `var(--brush-${a.brush})`
      : a.kind === 'user'
        ? 'var(--arrow-user)'
        : 'var(--arrow-coach)';
    const id = `${uid}-arrow-${i}`;
    // Mũi tên người chơi vẽ theo kiểu chess.com: thân to, đầu to, hơi trong
    // suốt để còn thấy quân bên dưới. Bản mảnh kiểu Lichess trước đây nhìn như
    // một nét bút chì, trên bàn xanh lá gần như không thấy.
    const w = SQ * (a.brush ? 0.2 : 0.1);
    const head = a.brush ? SQ * 0.12 : SQ * 0.26;
    const pts = arrowPath(a.from, a.to, or, head);
    if (!pts) return;
    parts.push(
      // refX đặt ở mũi nhọn để đầu mũi tên dừng đúng tâm ô đích
      `<marker id="${id}" markerWidth="3" markerHeight="3" refX="2.8" refY="1.5" orient="auto">` +
        `<path d="M0 0 L2.8 1.5 L0 3 Z" fill="${colour}"/></marker>`,
      `<polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="${w}" ` +
        `stroke-linecap="butt" stroke-linejoin="round" opacity="${a.brush ? '.8' : '.85'}" marker-end="url(#${id})"/>`,
    );
  });

  // Huy hiệu xếp loại ở góc trên phải ô đến
  if (o.badge && o.badge.cls !== 'book') {
    const [x, y] = xy(o.badge.square, or);
    const r = SQ * 0.3;
    parts.push(
      `<circle cx="${x + SQ - r * 0.7}" cy="${y + r * 0.7}" r="${r}" fill="var(--cls-${o.badge.cls})" stroke="var(--bg-0)" stroke-width="1.5"/>`,
      `<text x="${x + SQ - r * 0.7}" y="${y + r * 0.7}" text-anchor="middle" dominant-baseline="central" font-size="${r}" font-weight="700" fill="var(--on-badge)">${CLASS_SYMBOL[o.badge.cls]}</text>`,
    );
  }

  // Huy hiệu kết thúc ván, góc trên phải ô Vua. "Nảy" ra một nhịp (CSS .end-badge).
  for (const b of o.endBadges ?? []) {
    const [x, y] = xy(b.square, or);
    const r = SQ * 0.2;
    const cx = x + SQ - r * 0.9;
    const cy = y + r * 0.9;
    parts.push(
      `<g class="end-badge end-${b.kind}" style="transform-origin:${cx}px ${cy}px">` +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--end-${b.kind})" stroke="var(--bg-0)" stroke-width="1.5"/>` +
        endGlyph(b.kind, cx, cy, r) +
        `</g>`,
    );
  }

  // Không vẽ mép bàn: chess.com để ô cờ chạy thẳng ra rìa, không khung.
  const label = o.label ?? 'Bàn cờ';
  return `<svg class="board" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

/** Hình nhỏ bên trong huy hiệu kết thúc ván. Vẽ bằng nét, không dùng font. */
function endGlyph(kind: EndBadgeKind, cx: number, cy: number, r: number): string {
  const k = r / 10; // vẽ trong khung 20x20 quanh tâm
  const p = (pts: [number, number][]) => pts.map(([a, b]) => `${(cx + a * k).toFixed(2)},${(cy + b * k).toFixed(2)}`).join(' ');
  const line = `fill="none" stroke="#fff" stroke-width="${1.6 * k}" stroke-linejoin="round" stroke-linecap="round"`;
  switch (kind) {
    case 'win': // vương miện
      return `<polygon points="${p([[-6, 4], [-6, -3], [-3, 0], [0, -5], [3, 0], [6, -3], [6, 4]])}" fill="#fff"/>`;
    case 'mate': // dấu thăng — ký hiệu chiếu hết
      return (
        `<path d="M${cx - 2 * k} ${cy - 6 * k}L${cx - 3 * k} ${cy + 6 * k}M${cx + 3 * k} ${cy - 6 * k}L${cx + 2 * k} ${cy + 6 * k}` +
        `M${cx - 6 * k} ${cy - 2 * k}H${cx + 6 * k}M${cx - 6 * k} ${cy + 2.5 * k}H${cx + 6 * k}" ${line}/>`
      );
    case 'resign': // lá cờ trắng
      return `<path d="M${cx - 4 * k} ${cy + 6 * k}V${cy - 6 * k}H${cx + 5 * k}L${cx + 3 * k} ${cy - 3 * k}L${cx + 5 * k} ${cy}H${cx - 4 * k}" ${line}/>`;
    case 'timeout': // đồng hồ
      return `<circle cx="${cx}" cy="${cy}" r="${6 * k}" ${line}/><path d="M${cx} ${cy - 3.5 * k}V${cy}L${cx + 2.5 * k} ${cy + 2 * k}" ${line}/>`;
    case 'draw': // dấu bằng: hai bên như nhau
      return `<path d="M${cx - 5 * k} ${cy - 2 * k}H${cx + 5 * k}M${cx - 5 * k} ${cy + 2 * k}H${cx + 5 * k}" ${line}/>`;
  }
}

/**
 * Huy hiệu hai ô Vua cho một ván đã xong.
 * Chiếu hết: bên thua mang dấu #, ô đỏ. Đầu hàng / hết giờ: bên thua mang lá
 * cờ / đồng hồ. Bên thắng mang vương miện. Hòa: cả hai mang dấu bằng.
 */
export function endBadgesFor(fen: string, outcome: { winner: 'w' | 'b' | 'draw'; reason: string }): EndBadge[] {
  const kings = new Map<'w' | 'b', Square>();
  for (const [sq, code] of piecesFromFen(fen)) {
    if (code === 'wk') kings.set('w', sq);
    if (code === 'bk') kings.set('b', sq);
  }
  const out: EndBadge[] = [];
  const add = (side: 'w' | 'b', kind: EndBadgeKind) => {
    const sq = kings.get(side);
    if (sq) out.push({ square: sq, kind });
  };
  if (outcome.winner === 'draw') {
    add('w', 'draw');
    add('b', 'draw');
    return out;
  }
  const loser = outcome.winner === 'w' ? 'b' : 'w';
  add(outcome.winner, 'win');
  add(loser, outcome.reason === 'checkmate' ? 'mate' : outcome.reason === 'timeout' ? 'timeout' : 'resign');
  return out;
}
