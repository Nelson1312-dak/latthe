// Vẽ bàn cờ bằng SVG. Dùng cho cả màn hình tĩnh (GĐ0) lẫn bàn cờ tương tác sau này.
// Mọi màu lấy từ token CSS, không viết cứng.

import { FILES, piecesFromFen, squareOf, type PieceCode, type Square } from '../../shared/fen.ts';
import type { MoveClass } from '../../shared/winrate.ts';

const SQ = 50; // cạnh một ô trong hệ toạ độ SVG
const SIZE = SQ * 8;
const PIECE_SCALE = SQ / 40; // sprite cburnett vẽ trong khung 40x40

/**
 * Màu bút vẽ của người chơi, theo quy ước của Lichess: chuột phải là xanh lá,
 * giữ Shift là đỏ, giữ Alt là xanh dương, giữ cả hai là vàng.
 */
export type Brush = 'g' | 'r' | 'b' | 'y';

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

  // Ô khoanh tròn
  for (const c of o.circles ?? []) {
    const [cx, cy] = centre(c.square, or);
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${SQ * 0.45}" fill="none" stroke="var(--brush-${c.brush})" ` +
        `stroke-width="${SQ * 0.07}" opacity=".85"/>`,
    );
  }

  // Mũi tên
  (o.arrows ?? []).forEach((a, i) => {
    const colour = a.brush
      ? `var(--brush-${a.brush})`
      : a.kind === 'user'
        ? 'var(--arrow-user)'
        : 'var(--arrow-coach)';
    const id = `${uid}-arrow-${i}`;
    // Tỉ lệ theo Lichess: thân mảnh, đầu rộng gấp đôi thân, hơi trong suốt để
    // còn nhìn thấy quân cờ nằm dưới.
    const w = SQ * (a.brush ? 0.13 : 0.1);
    const head = SQ * 0.26;
    const pts = arrowPath(a.from, a.to, or, head);
    if (!pts) return;
    parts.push(
      // refX đặt ở mũi nhọn để đầu mũi tên dừng đúng tâm ô đích
      `<marker id="${id}" markerWidth="3" markerHeight="3" refX="2.8" refY="1.5" orient="auto">` +
        `<path d="M0 0 L2.8 1.5 L0 3 Z" fill="${colour}"/></marker>`,
      `<polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="${w}" ` +
        `stroke-linecap="butt" stroke-linejoin="round" opacity="${a.brush ? '.65' : '.85'}" marker-end="url(#${id})"/>`,
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

  // Không vẽ mép bàn: chess.com để ô cờ chạy thẳng ra rìa, không khung.
  const label = o.label ?? 'Bàn cờ';
  return `<svg class="board" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
