// Chỗ nối giữa hàng chờ, phòng chơi và mạng.
//
// Đường truyền là SSE: mỗi người mở một luồng `/api/live/stream`, server đẩy
// mọi thay đổi xuống đó. Nước đi gửi lên bằng POST thường. `EventSource` tự
// kết nối lại khi đứt mạng, nên phần "vào lại sau khi rớt" gần như có sẵn.

import type { ServerResponse } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { one, type Db, type User } from '../db.ts';
import { insertGame } from '../games.ts';
import { CONTROLS, DEFAULT_CONTROL, type LiveEvent, type LiveState } from '../../shared/protocol.ts';
import type { Square } from '../../shared/fen.ts';
import { Queue } from './queue.ts';
import { Room, type RoomPlayer } from './rooms.ts';
import { rateGame, scoreFor } from './rating.ts';
import { remaining } from './clock.ts';
import { BOT_AFTER_MS, BOTS, chooseMove, lineFor, pickBot, thinkMs, type BotEvent, type BotPersona } from './bots.ts';
import { botEngine } from './bot-engine.ts';
import { bump } from '../stats.ts';

/** Những gì bot nhớ trong một ván, để nói đúng lúc và biết lúc nào nên xin thua. */
interface BotMemo {
  /** Điểm (góc nhìn bot) ở lượt trước của bot. */
  lastCp: number | null;
  saidWinning: boolean;
  saidLosing: boolean;
  /** Số lượt liên tiếp thấy hết cửa. */
  hopeless: number;
  /** Nước (ply) lần cuối bot nói, để không nói liên tục. */
  lastSaidPly: number;
}

/** Mã mời: bỏ các chữ dễ nhìn nhầm (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = (n = 6) =>
  Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Lời mời chưa ai nhận thì bỏ sau chừng này. */
const INVITE_TTL_MS = 10 * 60_000;
/** Ván đã xong giữ lại một lúc để hai bên kịp đọc kết quả rồi mới dọn. */
const KEEP_FINISHED_MS = 2 * 60_000;

interface Invite {
  code: string;
  userId: number;
  control: string;
  createdAt: number;
}

export class Live {
  private queue = new Queue();
  private rooms = new Map<string, Room>();
  /** userId -> id phòng đang chơi. */
  private playing = new Map<number, string>();
  /** userId -> các luồng SSE đang mở (một người có thể mở nhiều tab). */
  private streams = new Map<number, Set<ServerResponse>>();
  private invites = new Map<string, Invite>();
  /**
   * Vé mở luồng SSE: mã dùng một lần, sống 60 giây.
   *
   * Cần tới vì luồng SSE phải đi THẲNG tới máy này chứ không qua Vercel —
   * Vercel gom đệm kết nối dài, thử thật thì 12 giây không nhận được gói nào.
   * Mà đi thẳng là khác origin, cookie `SameSite=Lax` không gửi kèm. Thay vì
   * nới cookie thành `SameSite=None` (mất một lớp chắn CSRF cho MỌI đường),
   * chỉ riêng đường này đổi sang vé: xin vé qua Vercel (có cookie), rồi mở
   * luồng bằng vé.
   */
  private tickets = new Map<string, { userId: number; hết: number }>();
  /** Phòng đang có bot nghĩ nước — để không cho bot đi hai lần. */
  private botThinking = new Set<string>();
  private botMemo = new Map<string, BotMemo>();
  // Khai riêng chứ không viết `constructor(private db: Db)`: Node chạy
  // TypeScript ở chế độ chỉ-bóc-kiểu, mà thuộc tính khai trong tham số
  // constructor thì không bóc được, phải sinh thêm mã.
  private db: Db;
  /** Cho bot tự nghĩ và đi (tắt trong test để khỏi chạy engine thật). */
  private botMoves: boolean;

  constructor(db: Db, opts: { botMoves?: boolean } = {}) {
    this.db = db;
    this.botMoves = opts.botMoves ?? true;
  }

  /** Cấp vé mở luồng cho người đã đăng nhập. */
  newTicket(userId: number, now = Date.now()): string {
    for (const [k, v] of this.tickets) if (v.hết <= now) this.tickets.delete(k);
    const vé = randomBytes(18).toString('base64url');
    this.tickets.set(vé, { userId, hết: now + 60_000 });
    return vé;
  }

  /** Đổi vé lấy userId. Dùng xong là huỷ, không dùng lại được. */
  useTicket(vé: string, now = Date.now()): number | null {
    const v = this.tickets.get(vé);
    if (!v) return null;
    this.tickets.delete(vé);
    return v.hết > now ? v.userId : null;
  }

  /* ---------------- Luồng SSE ---------------- */

  subscribe(user: User, res: ServerResponse, now = Date.now(), thêm: Record<string, string> = {}): () => void {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      // Nhờ proxy/tunnel đừng gom gói lại rồi mới gửi, nếu không sẽ trễ cả phút.
      'x-accel-buffering': 'no',
      ...thêm,
    });
    // Đứt thì tự nối lại sau 2 giây.
    res.write('retry: 2000\n\n');

    const mở = this.streams.get(user.id) ?? new Set<ServerResponse>();
    mở.add(res);
    this.streams.set(user.id, mở);

    // Mở lại được là coi như đã vào lại ván.
    const phòng = this.roomOf(user.id);
    if (phòng) phòng.reconnect(user.id);

    this.push(user.id, { type: 'hello', rating: user.game_rating });
    // Đẩy cho CẢ HAI: đối thủ cần thấy ngay là mình đã quay lại, chứ không
    // phải ngồi nhìn đồng hồ đếm lùi tới lúc được xử thắng.
    if (phòng) this.pushState(phòng, now);
    const hàng = this.queue.state(user.id, now);
    if (hàng) this.push(user.id, { type: 'queue', queue: hàng });

    const đóng = () => {
      const bộ = this.streams.get(user.id);
      bộ?.delete(res);
      if (bộ && bộ.size === 0) {
        this.streams.delete(user.id);
        // Tab cuối cùng đóng: tính là mất kết nối, bắt đầu đếm giờ vào lại.
        const p = this.roomOf(user.id);
        if (p && !p.isOver) {
          const giờ = Date.now();
          p.disconnect(user.id, giờ);
          // Đẩy xuống ngay để đối thủ thấy "mất kết nối · còn N giây".
          this.pushState(p, giờ);
        }
        // Đóng tab thì cũng ra khỏi hàng chờ, đừng để ghép với người đã đi.
        if (this.queue.leave(user.id)) this.broadcastQueue(Date.now());
      }
    };
    res.on('close', đóng);
    return đóng;
  }

  private push(userId: number, ev: LiveEvent): void {
    const bộ = this.streams.get(userId);
    if (!bộ) return;
    const dòng = `data: ${JSON.stringify(ev)}\n\n`;
    for (const res of bộ) {
      try {
        res.write(dòng);
      } catch {
        /* luồng đã chết, lần dọn sau sẽ bỏ */
      }
    }
  }

  /** Nhịp tim để tunnel và proxy không cắt kết nối đang rảnh. */
  heartbeat(): void {
    for (const bộ of this.streams.values()) {
      for (const res of bộ) {
        try {
          res.write(': .\n\n');
        } catch {
          /* bỏ qua */
        }
      }
    }
  }

  private pushState(room: Room, now: number): void {
    const loại = room.isOver ? 'ended' : 'state';
    for (const p of [room.white, room.black]) {
      const st = room.stateFor(p.userId, now);
      if (st) this.push(p.userId, { type: loại, state: st } as LiveEvent);
    }
  }

  /* ---------------- Hàng chờ ---------------- */

  isQueued(userId: number): boolean {
    return this.queue.has(userId);
  }

  /** Tình hình hàng chờ của một người, hoặc null nếu người đó không chờ. */
  queueState(userId: number, now = Date.now()) {
    return this.queue.state(userId, now);
  }

  joinQueue(user: User, control: string, now = Date.now()): { ok: boolean; why?: string } {
    if (this.playing.has(user.id)) return { ok: false, why: 'already-playing' };
    const key = control in CONTROLS ? control : DEFAULT_CONTROL;
    this.queue.join({
      userId: user.id,
      name: user.display_name,
      rating: user.game_rating,
      control: key,
      since: now,
    });
    this.tick(now);
    this.broadcastQueue(now);
    return { ok: true };
  }

  leaveQueue(userId: number, now = Date.now()): void {
    if (this.queue.leave(userId)) {
      this.push(userId, { type: 'queue-left' });
      this.broadcastQueue(now);
    }
  }

  /** Mọi người đang chờ đều cần biết số người chờ và khoảng Elo đã nới tới đâu. */
  private broadcastQueue(now: number): void {
    for (const userId of this.streams.keys()) {
      const st = this.queue.state(userId, now);
      if (st) this.push(userId, { type: 'queue', queue: st });
    }
  }

  /* ---------------- Mời riêng ---------------- */

  createInvite(userId: number, control: string, now = Date.now()): string {
    // Mỗi người chỉ giữ một lời mời; tạo cái mới thì cái cũ bỏ đi.
    for (const [c, inv] of this.invites) if (inv.userId === userId) this.invites.delete(c);
    const c = code();
    this.invites.set(c, {
      code: c,
      userId,
      control: control in CONTROLS ? control : DEFAULT_CONTROL,
      createdAt: now,
    });
    return c;
  }

  /** Nhận lời mời. Trả về id phòng, hoặc lý do không vào được. */
  acceptInvite(user: User, c: string, now = Date.now()): { ok: true; roomId: string } | { ok: false; why: string } {
    const inv = this.invites.get(c.trim().toUpperCase());
    if (!inv) return { ok: false, why: 'no-such-invite' };
    if (inv.userId === user.id) return { ok: false, why: 'own-invite' };
    if (this.playing.has(user.id)) return { ok: false, why: 'already-playing' };
    if (this.playing.has(inv.userId)) return { ok: false, why: 'already-playing' };
    const chủ = one<User>(this.db, 'SELECT * FROM users WHERE id = ?', inv.userId);
    if (!chủ) return { ok: false, why: 'no-such-invite' };
    this.invites.delete(inv.code);
    this.queue.leave(chủ.id);
    this.queue.leave(user.id);
    const room = this.open(chủ, user, inv.control, now);
    return { ok: true, roomId: room.id };
  }

  /* ---------------- Phòng chơi ---------------- */

  roomOf(userId: number): Room | null {
    const id = this.playing.get(userId);
    return id ? (this.rooms.get(id) ?? null) : null;
  }

  room(id: string): Room | null {
    return this.rooms.get(id) ?? null;
  }

  /** Đang có ván chưa xong — dùng để chặn engine và HLV. */
  isPlaying(userId: number): boolean {
    const r = this.roomOf(userId);
    return Boolean(r && !r.isOver);
  }

  private asPlayer(u: User): Omit<RoomPlayer, 'connected' | 'goneSince'> {
    return { userId: u.id, name: u.display_name, rating: u.game_rating, played: u.game_count };
  }

  /** Mở một ván giữa hai người. Màu quân bốc ngẫu nhiên. */
  private open(a: User, b: User, control: string, now: number): Room {
    const đổiMàu = randomInt(2) === 1;
    const [trắng, đen] = đổiMàu ? [b, a] : [a, b];
    const id = code(8);
    const room = new Room(
      id,
      { ...this.asPlayer(trắng), connected: this.streams.has(trắng.id), goneSince: null },
      { ...this.asPlayer(đen), connected: this.streams.has(đen.id), goneSince: null },
      CONTROLS[control] ?? CONTROLS[DEFAULT_CONTROL],
      now,
    );
    this.rooms.set(id, room);
    this.playing.set(trắng.id, id);
    this.playing.set(đen.id, id);
    bump(this.db, 'match_human', now);
    this.pushState(room, now);
    return room;
  }

  /* ---------------- Nhịp: ghép trận, rơi cờ, dọn dẹp ---------------- */

  tick(now = Date.now()): void {
    // Ghép những ai đã chờ được
    for (const [a, b] of this.queue.match(now)) {
      const ua = one<User>(this.db, 'SELECT * FROM users WHERE id = ?', a.userId);
      const ub = one<User>(this.db, 'SELECT * FROM users WHERE id = ?', b.userId);
      if (ua && ub) this.open(ua, ub, a.control, now);
    }
    // Chờ đủ lâu mà không ai ghép được: cho bot vào thay
    for (const w of this.queue.takeWaitedOver(now, BOT_AFTER_MS)) {
      const u = one<User>(this.db, 'SELECT * FROM users WHERE id = ?', w.userId);
      if (u && !this.playing.has(u.id)) this.openWithBot(u, w.control, now);
    }

    // Rơi cờ và hết hạn vào lại
    for (const room of this.rooms.values()) {
      const đãXong = room.isOver;
      room.tick(now);
      if (room.isOver && !đãXong) this.finish(room, now);
    }

    // Dọn: ván xong lâu rồi, lời mời không ai nhận
    for (const [id, room] of this.rooms) {
      if (room.isOver && now - room.touchedAt > KEEP_FINISHED_MS) {
        this.rooms.delete(id);
        this.botMemo.delete(id);
        for (const p of [room.white, room.black]) {
          if (this.playing.get(p.userId) === id) this.playing.delete(p.userId);
        }
      }
    }
    for (const [c, inv] of this.invites) {
      if (now - inv.createdAt > INVITE_TTL_MS) this.invites.delete(c);
    }
  }

  /** Ván vừa xong: tính Elo, lưu vào database, rồi báo cho hai bên. */
  private finish(room: Room, now: number): void {
    if (!room.outcome || room.over) return;
    const kq = room.outcome;
    const điểm = rateGame(
      { rating: room.white.rating, played: room.white.played },
      { rating: room.black.rating, played: room.black.played },
      scoreFor(kq.winner),
    );

    for (const [p, after] of [
      [room.white, điểm.whiteAfter],
      [room.black, điểm.blackAfter],
    ] as const) {
      // Bot có Elo cố định, không lưu gì vào database
      if (p.bot) continue;
      this.db
        .prepare('UPDATE users SET game_rating = ?, game_count = game_count + 1 WHERE id = ?')
        .run(after, p.userId);
    }

    const pgn = room.game.pgn();
    const lưu = (p: RoomPlayer, side: 'w' | 'b', đối: RoomPlayer, after: number): number | null => {
      if (p.bot) return null;
      try {
        return insertGame(
          this.db,
          p.userId,
          {
            mode: 'online',
            level: null,
            playerSide: side,
            pgn,
            winner: kq.winner,
            reason: kq.reason,
            opponentName: đối.bot ? `${đối.name} (AI)` : đối.name,
            opponentRating: đối.rating,
            ratingBefore: p.rating,
            ratingAfter: after,
          },
          new Date(now),
        );
      } catch (err) {
        console.error('[live] không lưu được ván', err);
        return null;
      }
    };
    const idTrắng = lưu(room.white, 'w', room.black, điểm.whiteAfter);
    const idĐen = lưu(room.black, 'b', room.white, điểm.blackAfter);

    room.over = {
      winner: kq.winner,
      reason: kq.reason,
      whiteRating: điểm.whiteAfter,
      blackRating: điểm.blackAfter,
      whiteChange: điểm.whiteChange,
      blackChange: điểm.blackChange,
      gameId: null,
    };
    room.touchedAt = now;

    // Mỗi bên thấy id ván của chính mình, để bấm sang Xem lại đúng ván.
    for (const [p, gameId] of [
      [room.white, idTrắng],
      [room.black, idĐen],
    ] as const) {
      const st = room.stateFor(p.userId, now);
      if (!st) continue;
      const riêng: LiveState = { ...st, over: { ...room.over, gameId } };
      this.push(p.userId, { type: 'ended', state: riêng });
    }

    // Bot chào kết thúc ván
    for (const p of [room.white, room.black]) {
      if (!p.bot) continue;
      const botSide = p === room.white ? 'w' : 'b';
      const ev: BotEvent = kq.winner === 'draw' ? 'drawn' : kq.winner === botSide ? 'won' : 'lost';
      if (kq.reason !== 'resign' || kq.winner === botSide) this.botSay(room, p.bot, ev, 700);
    }
  }

  /* ---------------- Hành động trong ván ---------------- */

  act(
    userId: number,
    what: 'move' | 'resign' | 'draw-offer' | 'draw-accept' | 'draw-decline',
    arg: { from?: string; to?: string; promotion?: string },
    now = Date.now(),
  ): { ok: boolean; why?: string } {
    const room = this.roomOf(userId);
    if (!room) return { ok: false, why: 'no-such-game' };
    const đãXong = room.isOver;

    let kq: { ok: boolean; why?: string };
    switch (what) {
      case 'move': {
        const from = arg.from as Square | undefined;
        const to = arg.to as Square | undefined;
        if (!from || !to) kq = { ok: false, why: 'illegal-move' };
        else kq = room.move(userId, from, to, arg.promotion, now);
        break;
      }
      case 'resign':
        kq = room.resign(userId, now);
        break;
      case 'draw-offer':
        kq = room.offerDraw(userId, now);
        break;
      case 'draw-accept':
        kq = room.acceptDraw(userId, now);
        break;
      case 'draw-decline':
        kq = room.declineDraw(userId, now);
        break;
    }

    if (room.isOver && !đãXong) this.finish(room, now);
    else if (kq.ok) {
      this.pushState(room, now);
      this.scheduleBot(room);
      if (what === 'draw-offer') this.botAnswerDraw(room);
    }
    return kq;
  }

  /* ---------------- Bot (AI thay người khi hàng chờ trống) ---------------- */

  /** Mở ván giữa một người và một bot có Elo gần nhất. Màu quân bốc ngẫu nhiên. */
  private openWithBot(u: User, control: string, now: number): Room {
    const bot = pickBot(u.game_rating);
    // Bot không có tài khoản thật: id âm, không bao giờ trùng người dùng
    const botPlayer: RoomPlayer = {
      userId: -(BOTS.indexOf(bot) + 1),
      name: bot.name,
      rating: bot.elo,
      played: 500,
      connected: true,
      goneSince: null,
      bot,
    };
    const người: RoomPlayer = { ...this.asPlayer(u), connected: this.streams.has(u.id), goneSince: null };
    const [trắng, đen] = randomInt(2) === 1 ? [botPlayer, người] : [người, botPlayer];
    const id = code(8);
    const room = new Room(id, trắng, đen, CONTROLS[control] ?? CONTROLS[DEFAULT_CONTROL], now);
    this.rooms.set(id, room);
    // Chỉ người mới vào sổ "đang chơi": một bot đánh được nhiều ván cùng lúc
    this.playing.set(u.id, id);
    bump(this.db, 'match_ai', now);
    this.botMemo.set(id, { lastCp: null, saidWinning: false, saidLosing: false, hopeless: 0, lastSaidPly: -10 });
    this.pushState(room, now);
    this.botSay(room, bot, 'greet', 900);
    this.scheduleBot(room);
    return room;
  }

  /** Bot nói một câu với người đối diện (sau `delayMs`). */
  private botSay(room: Room, bot: BotPersona, ev: BotEvent, delayMs = 0): void {
    const người = room.white.bot ? room.black : room.white;
    const text = lineFor(bot, ev);
    if (!text) return;
    const gửi = () => this.push(người.userId, { type: 'say', name: bot.name, text });
    if (delayMs > 0) setTimeout(gửi, delayMs).unref();
    else gửi();
  }

  /** Tới lượt bot thì cho bot nghĩ rồi đi. Gọi thừa cũng không sao. */
  private scheduleBot(room: Room): void {
    if (!this.botMoves || room.isOver || this.botThinking.has(room.id)) return;
    const side = room.game.turn;
    const p = side === 'w' ? room.white : room.black;
    if (!p.bot) return;
    this.botThinking.add(room.id);
    void this.botTurn(room, p, side).finally(() => this.botThinking.delete(room.id));
  }

  private async botTurn(room: Room, p: RoomPlayer, side: 'w' | 'b'): Promise<void> {
    const bot = p.bot!;
    const fen = room.game.fen;
    const ply = room.game.length;
    const now = Date.now();
    const think = thinkMs(bot, { ply, remainingMs: remaining(room.clock, side, now), incrementMs: room.control.incrementMs });
    // Nghĩ và "ngẫm" cùng lúc: engine xong sớm thì vẫn chờ cho đủ thời gian nghĩ của người
    const [cands] = await Promise.all([
      botEngine().search(fen, bot.search),
      new Promise((r) => setTimeout(r, think)),
    ]);
    // Trong lúc nghĩ, ván có thể đã xong (người đầu hàng, hết giờ)
    if (room.isOver || room.game.fen !== fen || !cands.length) return;

    const memo = this.botMemo.get(room.id);
    const best = cands[0].cp;
    const nói = (ev: BotEvent) => {
      if (!memo || ply - memo.lastSaidPly < 4) return;
      memo.lastSaidPly = ply;
      this.botSay(room, bot, ev);
    };

    if (memo) {
      // Người vừa đi hỏng: điểm của bot vọt lên
      if (memo.lastCp !== null && best - memo.lastCp >= 250 && best < 90_000) nói('pounce');
      // Hết cửa vài lượt liền thì xin thua (bot nào chịu thua)
      memo.hopeless = best <= -900 ? memo.hopeless + 1 : 0;
      if (bot.resigns && memo.hopeless >= 2 && ply >= 30) {
        memo.lastSaidPly = -100;
        this.botSay(room, bot, 'resign');
        this.botAct(room, p.userId, 'resign', {});
        return;
      }
      if (best >= 500 && !memo.saidWinning) {
        memo.saidWinning = true;
        nói('winning');
      } else if (best <= -500 && !memo.saidLosing) {
        memo.saidLosing = true;
        nói('losing');
      }
    }

    const uci = chooseMove(bot, cands);
    if (!uci) return;
    const chosen = cands.find((c) => c.uci === uci);
    if (memo) memo.lastCp = chosen?.cp ?? best;
    // Bot yếu cố ý đi lệch: thỉnh thoảng tự nhận là sơ ý
    if (chosen && best - chosen.cp >= 250 && Math.random() < 0.5) nói('oops');

    this.botAct(room, p.userId, 'move', { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }

  /** Bot trả lời lời đề nghị hòa: thế cờ cân và ván đã dài thì nhận. */
  private botAnswerDraw(room: Room): void {
    const p = room.white.bot ? room.white : room.black.bot ? room.black : null;
    if (!p?.bot || room.isOver) return;
    const bot = p.bot;
    const memo = this.botMemo.get(room.id);
    setTimeout(() => {
      if (room.isOver || !room.drawOfferFrom) return;
      const cân = memo?.lastCp !== null && memo?.lastCp !== undefined && Math.abs(memo.lastCp) <= 60;
      if (cân && room.game.length >= 40) {
        this.botSay(room, bot, 'draw-yes');
        this.botAct(room, p.userId, 'draw-accept', {});
      } else {
        this.botSay(room, bot, 'draw-no');
        this.botAct(room, p.userId, 'draw-decline', {});
      }
    }, 1_200).unref();
  }

  /** Bot đi / xin thua / trả lời hòa — như act() nhưng chỉ đúng phòng (một bot chơi nhiều ván). */
  private botAct(
    room: Room,
    botId: number,
    what: 'move' | 'resign' | 'draw-accept' | 'draw-decline',
    arg: { from?: string; to?: string; promotion?: string },
  ): void {
    const now = Date.now();
    const đãXong = room.isOver;
    let kq: { ok: boolean };
    if (what === 'move') kq = room.move(botId, arg.from as Square, arg.to as Square, arg.promotion, now);
    else if (what === 'resign') kq = room.resign(botId, now);
    else if (what === 'draw-accept') kq = room.acceptDraw(botId, now);
    else kq = room.declineDraw(botId, now);
    if (room.isOver && !đãXong) this.finish(room, now);
    else if (kq.ok) this.pushState(room, now);
  }
}
