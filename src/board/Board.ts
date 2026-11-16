// Vẽ bàn cờ bằng SVG. Dùng cho cả màn hình tĩnh (GĐ0) lẫn bàn cờ tương tác sau này.
// Mọi màu lấy từ token CSS, không viết cứng.

import { FILES, piecesFromFen, squareOf, type PieceCode, type Square } from '../../shared/fen.ts';
import type { MoveClass } from '../../shared/winrate.ts';

const SQ = 50; // cạnh một ô trong hệ toạ độ SVG
const SIZE = SQ * 8;
const PIECE_SCALE = SQ / 40; // sprite cburnett vẽ trong khung 40x40

export interface Arrow {
  from: Square;
  to: Square;
  kind?: 'coach' | 'user';
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
  badge?: ClassBadge;
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

function centre(sq: Square, orientation: 'w' | 'b'): [number, number] {
  const [x, y] = xy(sq, orientation);
  return [x + SQ / 2, y + SQ / 2];
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
      parts.push(`<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--sq-${light ? 'light' : 'dark'})"/>`);
    }
  }

  // Đánh dấu nằm dưới quân
  for (const sq of o.lastMove ?? []) {
    const [x, y] = xy(sq, or);
    parts.push(`<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="var(--mark-move)"/>`);
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
        `<text x="${fx + SQ - 3}" y="${fy + SQ - 3}" text-anchor="end" font-size="9" font-weight="600" fill="var(--sq-${fileLight ? 'dark' : 'light'})">${FILES[i]}</text>`,
        `<text x="${rx + 3}" y="${ry + 11}" font-size="9" font-weight="600" fill="var(--sq-${rankLight ? 'dark' : 'light'})">${i + 1}</text>`,
      );
    }
  }

  // Quân
  for (const [sq, code] of pieces) {
    const [x, y] = xy(sq, or);
    parts.push(`<g transform="translate(${x} ${y}) scale(${PIECE_SCALE})"><use href="#${code satisfies PieceCode}"/></g>`);
  }

  // Nước đi hợp lệ (vẽ trên quân để thấy được vòng bắt quân)
  for (const sq of o.legal ?? []) {
    const [cx, cy] = centre(sq, or);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${SQ * 0.14}" fill="var(--mark-legal)"/>`);
  }
  for (const sq of o.legalCaptures ?? []) {
    const [cx, cy] = centre(sq, or);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${SQ * 0.42}" fill="none" stroke="var(--mark-legal)" stroke-width="${SQ * 0.1}"/>`);
  }

  // Mũi tên
  (o.arrows ?? []).forEach((a, i) => {
    const colour = a.kind === 'user' ? 'var(--arrow-user)' : 'var(--arrow-coach)';
    const [x1, y1] = centre(a.from, or);
    const [x2, y2] = centre(a.to, or);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const head = SQ * 0.26;
    const ux = dx / len;
    const uy = dy / len;
    // chừa chỗ cho đầu mũi tên và lùi khỏi tâm ô xuất phát
    const sx = x1 + ux * SQ * 0.3;
    const sy = y1 + uy * SQ * 0.3;
    const ex = x2 - ux * head;
    const ey = y2 - uy * head;
    const id = `${uid}-arrow-${i}`;
    parts.push(
      `<marker id="${id}" markerWidth="3.2" markerHeight="3.2" refX="1.7" refY="1.6" orient="auto">` +
        `<path d="M0 0 L3 1.5 L0 3 Z" fill="${colour}"/></marker>`,
      `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${colour}" stroke-width="${SQ * 0.11}" opacity=".85" marker-end="url(#${id})"/>`,
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

  const label = o.label ?? 'Bàn cờ';
  return `<svg class="board" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
