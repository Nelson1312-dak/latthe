// Một ván online đang chạy. Server là nơi duy nhất biết sự thật.
//
// Trình duyệt chỉ gửi "tôi muốn đi nước này", còn hợp lệ hay không, giờ còn
// bao nhiêu, ai thắng — đều tính ở đây. Lớp này không đụng vào mạng hay
// database: nó nhận `now` và trả về trạng thái, nên test chạy được không cần
// dựng server.

import { Game, type EndReason, type Outcome, type Side } from '../../shared/chess.ts';
import { piecesFromFen, type Square } from '../../shared/fen.ts';
import type { LiveOver, LiveState, TimeControl } from '../../shared/protocol.ts';
import { afterMove, flagged, remaining, startClock, timeoutWinner, type Clock } from './clock.ts';

/** Mất kết nối quá lâu thì xử thua. */
export const RECONNECT_MS = 60_000;

export interface RoomPlayer {
  userId: number;
  name: string;
  /** Elo lúc bắt đầu ván. */
  rating: number;
  /** Đã chơi bao nhiêu ván online — để tính hệ số K. */
  played: number;
  connected: boolean;
  /** Lúc mất kết nối, epoch ms. null nghĩa là đang kết nối bình thường. */
  goneSince: number | null;
}

export type Refusal =
  | 'not-your-turn'
  | 'illegal-move'
  | 'game-over'
  | 'not-in-game'
  | 'no-draw-offer';

export type Act = { ok: true } | { ok: false; why: Refusal };

const OK: Act = { ok: true };
const no = (why: Refusal): Act => ({ ok: false, why });

/**
 * Bên này còn đủ quân để chiếu hết không.
 *
 * Dùng khi đối thủ hết giờ: luật FIDE 6.9 xử hòa chứ không xử thua nếu bên còn
 * giờ không thể nào chiếu hết được. Vua trơ, Vua+Mã, Vua+Tượng là ba trường
 * hợp không thể.
 */
export function canMate(fen: string, side: Side): boolean {
  let quânNhẹ = 0;
  for (const mã of piecesFromFen(fen).values()) {
    if (mã[0] !== side) continue;
    const loại = mã[1];
    if (loại === 'k') continue;
    if (loại === 'p' || loại === 'r' || loại === 'q') return true;
    quânNhẹ++;
    if (quânNhẹ >= 2) return true;
  }
  return false;
}

export class Room {
  readonly id: string;
  readonly control: TimeControl;
  readonly game = new Game();
  readonly white: RoomPlayer;
  readonly black: RoomPlayer;
  clock: Clock;
  drawOfferFrom: Side | null = null;
  outcome: Outcome | null = null;
  /** Điền sau khi tính Elo và lưu database xong. */
  over: LiveOver | null = null;
  /** Lúc nước cuối được đánh — để dọn phòng bỏ hoang. */
  touchedAt: number;

  constructor(id: string, white: RoomPlayer, black: RoomPlayer, control: TimeControl, now: number) {
    this.id = id;
    this.white = white;
    this.black = black;
    this.control = control;
    this.clock = startClock(control, now);
    this.touchedAt = now;
  }

  get isOver(): boolean {
    return this.outcome !== null;
  }

  sideOf(userId: number): Side | null {
    if (this.white.userId === userId) return 'w';
    if (this.black.userId === userId) return 'b';
    return null;
  }

  playerOf(side: Side): RoomPlayer {
    return side === 'w' ? this.white : this.black;
  }

  opponentOf(userId: number): RoomPlayer | null {
    const s = this.sideOf(userId);
    return s === null ? null : this.playerOf(s === 'w' ? 'b' : 'w');
  }

  /** Kết thúc ván. Gọi một lần; lần sau không làm gì nữa. */
  private end(winner: Side | 'draw', reason: EndReason, now: number): void {
    if (this.outcome) return;
    this.outcome = { winner, reason };
    this.drawOfferFrom = null;
    // Đóng băng đồng hồ ngay lúc này, nếu không thì giờ của bên đang đi vẫn
    // tiếp tục trôi và màn kết quả hiện số giờ sai.
    this.clock = {
      whiteMs: remaining(this.clock, 'w', now),
      blackMs: remaining(this.clock, 'b', now),
      turn: this.clock.turn,
      since: now,
    };
  }

  /**
   * Kiểm tra những thứ xảy ra do thời gian trôi: rơi cờ, và hết hạn vào lại.
   * Phải gọi trước mỗi hành động, và định kỳ cho những ván không ai đụng tới.
   */
  tick(now: number): void {
    if (this.isOver) return;

    // Rơi cờ
    const rơi = flagged(this.clock, now);
    if (rơi) {
      const đốiThủ: Side = rơi === 'w' ? 'b' : 'w';
      this.end(timeoutWinner(rơi, canMate(this.game.fen, đốiThủ)), 'timeout', now);
      return;
    }

    // Mất kết nối quá lâu
    for (const s of ['w', 'b'] as const) {
      const p = this.playerOf(s);
      if (!p.connected && p.goneSince !== null && now - p.goneSince >= RECONNECT_MS) {
        this.end(s === 'w' ? 'b' : 'w', 'resign', now);
        return;
      }
    }
  }

  move(userId: number, from: Square, to: Square, promotion: string | undefined, now: number): Act {
    this.tick(now);
    if (this.isOver) return no('game-over');
    const side = this.sideOf(userId);
    if (!side) return no('not-in-game');
    if (side !== this.game.turn) return no('not-your-turn');

    const played = this.game.move(from, to, promotion);
    if (!played) return no('illegal-move');

    this.clock = afterMove(this.clock, this.control, now);
    this.touchedAt = now;
    // Đi quân là coi như không nhận lời đề nghị hòa nữa.
    this.drawOfferFrom = null;

    const kq = this.game.outcome();
    if (kq) this.end(kq.winner, kq.reason, now);
    return OK;
  }

  resign(userId: number, now: number): Act {
    this.tick(now);
    if (this.isOver) return no('game-over');
    const side = this.sideOf(userId);
    if (!side) return no('not-in-game');
    this.end(side === 'w' ? 'b' : 'w', 'resign', now);
    this.touchedAt = now;
    return OK;
  }

  offerDraw(userId: number, now: number): Act {
    this.tick(now);
    if (this.isOver) return no('game-over');
    const side = this.sideOf(userId);
    if (!side) return no('not-in-game');
    // Đối thủ đã đề nghị rồi mà mình cũng đề nghị thì tính là đồng ý luôn.
    if (this.drawOfferFrom && this.drawOfferFrom !== side) {
      this.end('draw', 'agreement', now);
      return OK;
    }
    this.drawOfferFrom = side;
    this.touchedAt = now;
    return OK;
  }

  acceptDraw(userId: number, now: number): Act {
    this.tick(now);
    if (this.isOver) return no('game-over');
    const side = this.sideOf(userId);
    if (!side) return no('not-in-game');
    if (!this.drawOfferFrom || this.drawOfferFrom === side) return no('no-draw-offer');
    this.end('draw', 'agreement', now);
    this.touchedAt = now;
    return OK;
  }

  declineDraw(userId: number, now: number): Act {
    this.tick(now);
    if (this.isOver) return no('game-over');
    const side = this.sideOf(userId);
    if (!side) return no('not-in-game');
    if (!this.drawOfferFrom || this.drawOfferFrom === side) return no('no-draw-offer');
    this.drawOfferFrom = null;
    return OK;
  }

  disconnect(userId: number, now: number): void {
    const side = this.sideOf(userId);
    if (!side) return;
    const p = this.playerOf(side);
    if (!p.connected) return;
    p.connected = false;
    p.goneSince = now;
  }

  reconnect(userId: number): void {
    const side = this.sideOf(userId);
    if (!side) return;
    const p = this.playerOf(side);
    p.connected = true;
    p.goneSince = null;
  }

  /** Hạn chót để bên đang mất kết nối quay lại, hoặc null nếu cả hai đang ổn. */
  reconnectBy(): number | null {
    for (const s of ['w', 'b'] as const) {
      const p = this.playerOf(s);
      if (!p.connected && p.goneSince !== null) return p.goneSince + RECONNECT_MS;
    }
    return null;
  }

  /** Ván nhìn từ phía một người. Trả về null nếu người đó không ở trong ván. */
  stateFor(userId: number, now: number): LiveState | null {
    const youAre = this.sideOf(userId);
    if (!youAre) return null;
    const last = this.game.lastMove;
    const strip = (p: RoomPlayer, side: Side) => ({
      name: p.name,
      rating: p.rating,
      clockMs: this.isOver ? (side === 'w' ? this.clock.whiteMs : this.clock.blackMs) : remaining(this.clock, side, now),
      connected: p.connected,
    });
    return {
      id: this.id,
      youAre,
      fen: this.game.fen,
      history: this.game.history.map((m) => m.san),
      turn: this.game.turn,
      lastMove: last ? [last.from, last.to] : null,
      white: strip(this.white, 'w'),
      black: strip(this.black, 'b'),
      control: this.control,
      drawOfferFrom: this.drawOfferFrom,
      reconnectBy: this.reconnectBy(),
      over: this.over,
      at: now,
    };
  }
}
