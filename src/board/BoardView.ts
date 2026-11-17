// Bàn cờ tương tác: bấm-chọn, kéo-thả, bàn phím.
//
// Phần vẽ dùng chung boardSvg() với các màn tĩnh, nên bàn cờ ở đâu cũng giống nhau.
// Lớp này chỉ lo việc nhận thao tác của người chơi rồi báo ra ngoài.

import { boardSvg, squareXY, type BoardOptions } from './Board.ts';
import { FILES, squareOf, type Square } from '../../shared/fen.ts';

export interface BoardViewOptions {
  /** Hỏi xem từ ô này đi được những đâu (rỗng nghĩa là không được cầm quân đó). */
  legalFrom: (from: Square) => { quiet: Square[]; captures: Square[] };
  /** Người chơi muốn đi một nước. Trả về false nếu nước không hợp lệ. */
  onMove: (from: Square, to: Square) => boolean;
  /** Ô này có quân của bên đang được phép đi không. */
  canPick: (square: Square) => boolean;
}

export class BoardView {
  private host: HTMLElement;
  private o: BoardViewOptions;
  private state: BoardOptions = { fen: '' };
  private selected: Square | null = null;
  private dragging: { from: Square; pointerId: number } | null = null;
  /** Ô đang được bàn phím trỏ tới; chỉ hiện khi dùng bàn phím. */
  private focus: Square | null = null;


  constructor(host: HTMLElement, options: BoardViewOptions) {
    this.host = host;
    this.o = options;
    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('pointerup', this.onPointerUp);
    this.host.addEventListener('keydown', this.onKeyDown);
    this.host.tabIndex = 0;
    this.host.setAttribute('role', 'application');
  }

  destroy(): void {
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('keydown', this.onKeyDown);
  }

  /**
   * Vẽ lại bàn cờ. `animate` là nước vừa đi (ô xuất phát, ô đích) nếu muốn quân
   * trượt tới chỗ. Màn hình quyết định điều này, vì BoardView bị tạo lại mỗi lần
   * vẽ nên không tự nhớ được thế cờ trước.
   */
  render(state: BoardOptions, animate?: [Square, Square]): void {
    this.state = state;
    this.draw();
    if (animate) this.animateMove(animate[0], animate[1], state.orientation ?? 'w');
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
    this.selected = null;
    this.draw();
  }

  private draw(): void {
    const legal = this.selected ? this.o.legalFrom(this.selected) : { quiet: [], captures: [] };
    this.host.innerHTML = boardSvg({
      ...this.state,
      selected: this.selected ?? undefined,
      legal: legal.quiet,
      legalCaptures: legal.captures,
      focus: this.focus ?? undefined,
    });
  }

  /** Ô cờ dưới một điểm trên màn hình. */
  private squareAt(clientX: number, clientY: number): Square | null {
    const svg = this.host.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    const col = Math.floor(((clientX - r.left) / r.width) * 8);
    const row = Math.floor(((clientY - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const flipped = this.state.orientation === 'b';
    return squareOf(flipped ? 7 - col : col, flipped ? row : 7 - row);
  }

  /** Thử đi; nếu không hợp lệ thì coi như chọn lại quân khác. */
  private tryMove(from: Square, to: Square): void {
    if (from === to) {
      this.selected = null;
      this.draw();
      return;
    }
    if (this.o.onMove(from, to)) {
      this.selected = null;
      // Màn hình gọi render() lại với thế cờ mới, không vẽ ở đây
      return;
    }
    // Bấm sang quân khác của mình thì chuyển lựa chọn, còn lại thì bỏ chọn
    this.selected = this.o.canPick(to) ? to : null;
    this.draw();
  }

  private onPointerDown = (e: PointerEvent): void => {
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    this.focus = null;
    if (this.selected && this.selected !== sq) {
      this.tryMove(this.selected, sq);
      return;
    }
    if (!this.o.canPick(sq)) {
      this.selected = null;
      this.draw();
      return;
    }
    // Bấm lại quân đang chọn thì bỏ chọn
    this.selected = this.selected === sq ? null : sq;
    if (this.selected) this.dragging = { from: sq, pointerId: e.pointerId };
    this.draw();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.dragging;
    this.dragging = null;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const sq = this.squareAt(e.clientX, e.clientY);
    // Thả ở đúng ô vừa nhấc thì đó là một cú bấm, giữ nguyên lựa chọn
    if (!sq || sq === drag.from) return;
    this.tryMove(drag.from, sq);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();

    if (e.key === 'Escape') {
      this.selected = null;
      this.draw();
      return;
    }

    const cur = this.focus ?? this.selected ?? ('e4' as Square);
    if (e.key === 'Enter' || e.key === ' ') {
      if (this.selected && this.selected !== cur) this.tryMove(this.selected, cur);
      else if (this.o.canPick(cur)) {
        this.selected = this.selected === cur ? null : cur;
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
