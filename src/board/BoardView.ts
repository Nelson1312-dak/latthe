// Bàn cờ tương tác: bấm-chọn, kéo-thả, vẽ bằng chuột phải, đi trước, bàn phím.
//
// Phần vẽ dùng chung boardSvg() với các màn tĩnh, nên bàn cờ ở đâu cũng giống
// nhau. Lớp này chỉ nhận thao tác của người chơi rồi báo ra ngoài.
//
// Màn hình dựng lại toàn bộ HTML mỗi lần vẽ (màn Đấu còn vẽ lại mỗi giây cho
// đồng hồ), nên một đối tượng BoardView chỉ sống tới lần vẽ sau. Những gì phải
// sống qua các lần vẽ — đang kéo quân nào, ô nào đang chọn, nét vẽ của người
// chơi — để ở cấp module, gắn theo `id` của bàn cờ. Con trỏ được theo dõi trên
// `window` chứ không trên bàn cờ, để kéo dở mà bàn cờ bị thay vẫn kéo tiếp được.

import { boardSvg, squareXY, type Arrow, type BoardOptions, type Brush, type Circle } from './Board.ts';
import { PIECE_SLIDE_MS } from './timing.ts';
import { FILES, piecesFromFen, squareOf, type PieceCode, type Square } from '../../shared/fen.ts';
import { arrowDests } from '../../shared/premove.ts';

export { PIECE_SLIDE_MS };

/** Nhích quá chừng này mới tính là kéo, chưa tới thì vẫn là một cú bấm. */
const DRAG_THRESHOLD_PX = 4;

export interface PremoveHooks {
  /** Đang được đi trước không (tức là chưa tới lượt mình). */
  active: () => boolean;
  /** Quân ở ô này có phải của mình không. */
  canPick: (sq: Square) => boolean;
  dests: (from: Square) => Square[];
  set: (from: Square, to: Square) => void;
  clear: () => void;
}

export interface BoardViewOptions {
  /** Tên bàn cờ, để giữ ô đang chọn, nét vẽ và thao tác kéo qua các lần vẽ lại. */
  id: string;
  /** Hỏi xem từ ô này đi được những đâu (rỗng nghĩa là không được cầm quân đó). */
  legalFrom: (from: Square) => { quiet: Square[]; captures: Square[] };
  /** Người chơi muốn đi một nước. Trả về false nếu nước không hợp lệ. */
  onMove: (from: Square, to: Square) => boolean;
  /** Ô này có quân của bên đang được phép đi không. */
  canPick: (square: Square) => boolean;
  /** Cho phép đi trước khi chưa tới lượt. Bỏ trống là không có. */
  premove?: PremoveHooks;
}

/* ---------------- Trạng thái sống qua các lần vẽ lại ---------------- */

interface Drag {
  viewId: string;
  from: Square;
  code: PieceCode;
  pointerId: number;
  startX: number;
  startY: number;
  /** Đã nhích đủ xa để thành kéo chưa. */
  started: boolean;
  /** Quân này đã được chọn từ trước cú bấm — để bấm lần nữa thì bỏ chọn. */
  wasSelected: boolean;
  hover: Square | null;
  ghost: HTMLElement | null;
}

interface Drawing {
  viewId: string;
  from: Square;
  to: Square | null;
  /** Màu theo phím đang giữ; null là màu mặc định (cam cho mũi tên, đỏ cho ô). */
  brush: Brush | null;
  /** Các ô mũi tên được phép chỉ tới, tính một lần lúc bắt đầu vẽ. */
  allowed: Set<Square>;
  pointerId: number;
}

interface Notes {
  fen: string;
  arrows: Arrow[];
  circles: Circle[];
}

let drag: Drag | null = null;
let drawing: Drawing | null = null;
/** BoardView mới nhất của mỗi bàn cờ. */
const views = new Map<string, BoardView>();
const selections = new Map<string, Square | null>();
/** Nét vẽ của người chơi. Thế cờ đổi là xoá, như chess.com. */
const notes = new Map<string, Notes>();
/**
 * Nước vừa thả bằng tay. Quân đã nằm sẵn ở ô đích dưới con trỏ, nên lần vẽ
 * tiếp theo đừng cho nó trượt từ ô gốc tới nữa — trông như đi hai lần.
 */
let dropped: string | null = null;
/**
 * Huy hiệu kết thúc ván đã "nảy" ra lần nào chưa, theo từng bàn cờ. Bàn cờ bị
 * vẽ lại mỗi lần bấm, không nhớ thì huy hiệu nảy lại mãi.
 */
const badgeShown = new Map<string, string>();

/** Đang kéo quân dở — màn hình có thể hoãn những lần vẽ lại không gấp. */
export function isDragging(): boolean {
  return Boolean(drag?.started);
}

/**
 * Màu bút theo phím đang giữ, như chess.com: Shift xanh lá, Ctrl đỏ, Alt xanh
 * dương. Không giữ gì thì null — mũi tên màu cam, tô ô màu đỏ.
 */
function brushOf(e: PointerEvent): Brush | null {
  if (e.shiftKey) return 'g';
  if (e.ctrlKey || e.metaKey) return 'r';
  if (e.altKey) return 'b';
  return null;
}

const ARROW_BRUSH: Brush = 'y';
const SQUARE_BRUSH: Brush = 'r';

function ghostFor(code: PieceCode): HTMLElement {
  const el = document.createElement('div');
  el.className = 'drag-piece';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><use href="#${code}"/></svg>`;
  document.body.append(el);
  return el;
}

function endDrag(): void {
  drag?.ghost?.remove();
  drag = null;
  document.documentElement.classList.remove('is-dragging-piece');
}

/* ---------------- Theo dõi con trỏ trên cả cửa sổ ---------------- */

let wired = false;

function wire(): void {
  if (wired) return;
  wired = true;

  window.addEventListener('pointermove', (e) => {
    if (drawing && e.pointerId === drawing.pointerId) {
      const v = views.get(drawing.viewId);
      const sq = v?.arrowTarget(drawing, e.clientX, e.clientY) ?? null;
      if (v && sq !== drawing.to) {
        drawing.to = sq;
        v.draw();
      }
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const v = views.get(drag.viewId);
    if (!v) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.started = true;
      drag.ghost = ghostFor(drag.code);
      document.documentElement.classList.add('is-dragging-piece');
    }
    v.placeGhost(drag.ghost!, e.clientX, e.clientY);
    const sq = v.squareAt(e.clientX, e.clientY);
    if (sq !== drag.hover) {
      drag.hover = sq;
      v.draw();
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (drawing && e.pointerId === drawing.pointerId) {
      const d = drawing;
      drawing = null;
      const v = views.get(d.viewId);
      if (!v) return;
      // Đích đã được bắt vào ô hợp lệ trong lúc rê chuột; null là thả ra chỗ
      // không quân nào đi tới được, nên không vẽ gì.
      const to = d.to;
      if (to) v.toggleNote(d.from, to, d.brush ?? (to === d.from ? SQUARE_BRUSH : ARROW_BRUSH));
      v.draw();
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    endDrag();
    const v = views.get(d.viewId);
    if (!v) return;

    if (!d.started) {
      // Chỉ là một cú bấm. Bấm lại quân đang chọn thì bỏ chọn.
      if (d.wasSelected) v.select(null);
      v.draw();
      return;
    }

    const to = v.squareAt(e.clientX, e.clientY);
    if (to && to !== d.from && v.destSet(d.from).has(to)) {
      v.select(null);
      if (v.commit(d.from, to, true)) return;
    }
    // Thả ra ngoài hoặc vào ô không đi được: quân về chỗ, vẫn giữ chọn
    v.draw();
  });

  window.addEventListener('pointercancel', (e) => {
    if (drawing && e.pointerId === drawing.pointerId) drawing = null;
    if (drag && e.pointerId === drag.pointerId) {
      const v = views.get(drag.viewId);
      endDrag();
      v?.draw();
    }
  });

  // Kéo dở mà bấm Esc: thả quân về chỗ
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !drag) return;
    const v = views.get(drag.viewId);
    endDrag();
    v?.draw();
  });
}

/* ---------------- Bàn cờ ---------------- */

export class BoardView {
  private host: HTMLElement;
  private o: BoardViewOptions;
  private state: BoardOptions = { fen: '' };
  /** Ô đang được bàn phím trỏ tới; chỉ hiện khi dùng bàn phím. */
  private focus: Square | null = null;

  constructor(host: HTMLElement, options: BoardViewOptions) {
    this.host = host;
    this.o = options;
    views.set(options.id, this);
    wire();
    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('contextmenu', this.onContextMenu);
    this.host.addEventListener('keydown', this.onKeyDown);
    this.host.tabIndex = 0;
    this.host.setAttribute('role', 'application');
  }

  destroy(): void {
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('contextmenu', this.onContextMenu);
    this.host.removeEventListener('keydown', this.onKeyDown);
    if (views.get(this.o.id) === this) views.delete(this.o.id);
  }

  /**
   * Vẽ lại bàn cờ. `animate` là nước vừa đi (ô xuất phát, ô đích) nếu muốn quân
   * trượt tới chỗ. Màn hình quyết định điều này, vì BoardView bị tạo lại mỗi lần
   * vẽ nên không tự nhớ được thế cờ trước.
   */
  render(state: BoardOptions, animate?: [Square, Square]): void {
    const id = this.o.id;
    const n = notes.get(id);
    if (n && n.fen !== state.fen) notes.delete(id);
    this.state = state;

    // Ô đang chọn không còn cầm được (đối thủ ăn mất, hết lượt...) thì bỏ
    const sel = this.selected;
    if (sel && !this.pickable(sel)) this.select(null);
    // Đang kéo mà quân không còn cầm được nữa (ván xong) thì thả về
    if (drag && drag.viewId === id && !this.pickable(drag.from)) endDrag();

    this.draw();

    if (animate) {
      const key = animate[0] + animate[1];
      if (dropped === key) dropped = null;
      else this.animateMove(animate[0], animate[1], state.orientation ?? 'w');
    }
  }

  /**
   * Quân cờ đã được vẽ ở ô đích rồi; đẩy ngược nó về ô xuất phát rồi cho trượt
   * về chỗ. Làm vậy thì không cần giữ lại bàn cờ cũ.
   */
  private animateMove(from: Square, to: Square, orientation: 'w' | 'b'): void {
    const piece = this.host.querySelector<SVGGElement>(`[data-sq="${to}"] .pc`);
    if (!piece) return;
    const [fx, fy] = squareXY(from, orientation);
    const [tx, ty] = squareXY(to, orientation);
    if (fx === tx && fy === ty) return;

    piece.style.transition = 'none';
    piece.style.transform = `translate(${fx - tx}px, ${fy - ty}px)`;
    // Ép trình duyệt tính lại ngay, nếu không nó gộp hai lần đặt transform làm một
    void piece.getBoundingClientRect();
    piece.classList.add('is-moving');
    piece.style.transition = '';
    piece.style.transform = 'translate(0px, 0px)';
    piece.addEventListener('transitionend', () => piece.classList.remove('is-moving'), { once: true });
  }

  clearSelection(): void {
    this.select(null);
    this.draw();
  }

  /* ---- Những hàm dưới đây để phần theo dõi con trỏ ở trên gọi ---- */

  get selected(): Square | null {
    return selections.get(this.o.id) ?? null;
  }

  select(sq: Square | null): void {
    selections.set(this.o.id, sq);
  }

  private premoving(): boolean {
    return Boolean(this.o.premove?.active());
  }

  /** Cầm được quân ở ô này không — để đi ngay, hoặc để đi trước. */
  pickable(sq: Square): boolean {
    if (this.o.canPick(sq)) return true;
    return this.premoving() && Boolean(this.o.premove?.canPick(sq));
  }

  /** Ô đi được từ `from`: nước thật nếu tới lượt, ô đi trước nếu chưa. */
  dests(from: Square): { quiet: Square[]; captures: Square[] } {
    if (this.o.canPick(from)) return this.o.legalFrom(from);
    if (!this.premoving() || !this.o.premove?.canPick(from)) return { quiet: [], captures: [] };
    const pieces = piecesFromFen(this.state.fen);
    const quiet: Square[] = [];
    const captures: Square[] = [];
    for (const sq of this.o.premove.dests(from)) (pieces.has(sq) ? captures : quiet).push(sq);
    return { quiet, captures };
  }

  destSet(from: Square): Set<Square> {
    const d = this.dests(from);
    return new Set([...d.quiet, ...d.captures]);
  }

  /**
   * Đi (hoặc đặt đi trước) một nước. `byDrop` là nước thả bằng tay: quân đã ở
   * sẵn ô đích nên không cho trượt lần nữa. Nước đi trước thì không đánh dấu,
   * vì lúc nó thật sự được đi thì quân vẫn còn ở ô gốc, phải trượt.
   */
  commit(from: Square, to: Square, byDrop = false): boolean {
    if (this.o.canPick(from)) {
      if (byDrop) dropped = from + to;
      const ok = this.o.onMove(from, to);
      if (!ok && byDrop) dropped = null;
      return ok;
    }
    if (this.premoving() && this.o.premove?.canPick(from) && this.destSet(from).has(to)) {
      this.o.premove.set(from, to);
      // Tự tô ô đi trước, không bắt màn hình vẽ lại cả trang chỉ vì việc này
      this.state = { ...this.state, premove: [from, to] };
      this.draw();
      return true;
    }
    return false;
  }

  /** Huỷ nước đi trước (chuột phải, bấm ra ngoài, Esc). */
  private cancelPremove(): void {
    if (!this.state.premove) return;
    this.o.premove?.clear();
    this.state = { ...this.state, premove: undefined };
  }

  toggleNote(from: Square, to: Square, brush: Brush): void {
    const id = this.o.id;
    const n = notes.get(id) ?? { fen: this.state.fen, arrows: [], circles: [] };
    if (from === to) {
      const i = n.circles.findIndex((c) => c.square === from);
      const same = i >= 0 && n.circles[i].brush === brush;
      if (i >= 0) n.circles.splice(i, 1);
      if (!same) n.circles.push({ square: from, brush });
    } else {
      const i = n.arrows.findIndex((a) => a.from === from && a.to === to);
      const same = i >= 0 && n.arrows[i].brush === brush;
      if (i >= 0) n.arrows.splice(i, 1);
      if (!same) n.arrows.push({ from, to, brush });
    }
    notes.set(id, n);
  }

  draw(): void {
    const id = this.o.id;
    const sel = this.selected;
    const legal = sel ? this.dests(sel) : { quiet: [], captures: [] };
    const n = notes.get(id);
    const preview: Arrow[] =
      drawing && drawing.viewId === id && drawing.to && drawing.to !== drawing.from
        ? [{ from: drawing.from, to: drawing.to, brush: drawing.brush ?? ARROW_BRUSH }]
        : [];
    const kéo = drag && drag.viewId === id && drag.started ? drag : null;
    this.host.innerHTML = boardSvg({
      ...this.state,
      selected: sel ?? undefined,
      legal: legal.quiet,
      legalCaptures: legal.captures,
      focus: this.focus ?? undefined,
      dragging: kéo?.from,
      hover: kéo?.hover ?? undefined,
      arrows: [...(this.state.arrows ?? []), ...(n?.arrows ?? []), ...preview],
      circles: [...(this.state.circles ?? []), ...(n?.circles ?? [])],
    });
    const badges = this.state.endBadges?.length ? this.state.fen + JSON.stringify(this.state.endBadges) : '';
    if (badges && badgeShown.get(id) === badges) this.host.querySelector('svg')?.classList.add('settled');
    badgeShown.set(id, badges);
  }

  /** Đặt quân đang kéo vào giữa con trỏ, to bằng một ô. */
  placeGhost(ghost: HTMLElement, x: number, y: number): void {
    const r = this.host.querySelector('svg')?.getBoundingClientRect();
    const size = r ? r.width / 8 : 64;
    ghost.style.width = `${size}px`;
    ghost.style.height = `${size}px`;
    ghost.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
  }

  /**
   * Ô mà mũi tên đang vẽ sẽ chỉ tới khi con trỏ ở (clientX, clientY).
   *
   * Con trỏ ở đúng ô hợp lệ thì lấy ô đó. Lệch ra ngoài đường đi của quân thì
   * bắt vào ô hợp lệ gần nhất (trong vòng một ô), để tay không cần chính xác
   * tuyệt đối. Xa quá thì không có mũi tên nào.
   */
  arrowTarget(d: Drawing, clientX: number, clientY: number): Square | null {
    const sq = this.squareAt(clientX, clientY);
    if (sq === d.from || (sq && d.allowed.has(sq))) return sq;
    const svg = this.host.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const size = r.width / 8;
    const px = (clientX - r.left) / size;
    const py = (clientY - r.top) / size;
    const flipped = this.state.orientation === 'b';
    let best: Square | null = null;
    let bestD = 1.0;
    for (const a of d.allowed) {
      const f = FILES.indexOf(a[0] as (typeof FILES)[number]);
      const rank = Number(a[1]) - 1;
      const cx = (flipped ? 7 - f : f) + 0.5;
      const cy = (flipped ? rank : 7 - rank) + 0.5;
      const dist = Math.hypot(cx - px, cy - py);
      if (dist < bestD) {
        bestD = dist;
        best = a;
      }
    }
    return best;
  }

  /** Ô cờ dưới một điểm trên màn hình. */
  squareAt(clientX: number, clientY: number): Square | null {
    const svg = this.host.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (clientX < r.left || clientX >= r.right || clientY < r.top || clientY >= r.bottom) return null;
    const col = Math.floor(((clientX - r.left) / r.width) * 8);
    const row = Math.floor(((clientY - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const flipped = this.state.orientation === 'b';
    return squareOf(flipped ? 7 - col : col, flipped ? row : 7 - row);
  }

  /* ---------------- Sự kiện trên bàn cờ ---------------- */

  private onContextMenu = (e: Event): void => {
    // Chuột phải trên bàn cờ là để vẽ, không mở menu của trình duyệt
    e.preventDefault();
  };

  private onPointerDown = (e: PointerEvent): void => {
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    this.focus = null;
    const id = this.o.id;

    // Chuột phải: vẽ mũi tên / khoanh ô. Cũng là huỷ nước đi trước, như chess.com.
    if (e.button === 2) {
      e.preventDefault();
      if (drag) endDrag();
      this.cancelPremove();
      this.select(null);
      drawing = {
        viewId: id,
        from: sq,
        to: sq,
        brush: brushOf(e),
        allowed: new Set(arrowDests(this.state.fen, sq)),
        pointerId: e.pointerId,
      };
      this.draw();
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault(); // không bôi đen chữ, không kéo ảnh kiểu trình duyệt

    // Chuột trái thì xoá nét vẽ
    notes.delete(id);

    const sel = this.selected;
    if (sel && sel !== sq && this.destSet(sel).has(sq)) {
      // Đã chọn quân, giờ bấm ô đích
      this.select(null);
      if (!this.commit(sel, sq)) this.draw();
      return;
    }

    if (this.pickable(sq)) {
      this.select(sq);
      drag = {
        viewId: id,
        from: sq,
        code: piecesFromFen(this.state.fen).get(sq)!,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        started: false,
        wasSelected: sel === sq,
        hover: sq,
        ghost: null,
      };
      this.draw();
      return;
    }

    // Bấm ra chỗ khác: bỏ chọn và huỷ nước đi trước
    this.select(null);
    this.cancelPremove();
    this.draw();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();

    if (e.key === 'Escape') {
      this.select(null);
      this.cancelPremove();
      notes.delete(this.o.id);
      this.draw();
      return;
    }

    const sel = this.selected;
    const cur = this.focus ?? sel ?? ('e4' as Square);
    if (e.key === 'Enter' || e.key === ' ') {
      if (sel && sel !== cur && this.destSet(sel).has(cur)) {
        this.select(null);
        if (!this.commit(sel, cur)) this.draw();
      } else if (this.pickable(cur)) {
        this.select(sel === cur ? null : cur);
        this.draw();
      }
      return;
    }

    const flipped = this.state.orientation === 'b';
    let f = FILES.indexOf(cur[0] as (typeof FILES)[number]);
    let r = Number(cur[1]) - 1;
    const step = flipped ? -1 : 1;
    if (e.key === 'ArrowLeft') f -= step;
    if (e.key === 'ArrowRight') f += step;
    if (e.key === 'ArrowUp') r += step;
    if (e.key === 'ArrowDown') r -= step;
    this.focus = squareOf(Math.max(0, Math.min(7, f)), Math.max(0, Math.min(7, r)));
    this.draw();
  };
}
