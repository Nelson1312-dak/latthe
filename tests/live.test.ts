// Đồng hồ, Elo ván đấu, hàng chờ ghép trận và máy trạng thái một ván.
import { describe, expect, it } from 'vitest';
import { CONTROLS } from '../shared/protocol.ts';
import { afterMove, flagged, remaining, startClock, timeoutWinner } from '../server/live/clock.ts';
import { expectedScore, gameK, rateGame, scoreFor } from '../server/live/rating.ts';
import { BAND_MAX, BAND_START, Queue, band, fits, type Waiter } from '../server/live/queue.ts';
import { RECONNECT_MS, Room, canMate } from '../server/live/rooms.ts';
import { Live } from '../server/live/index.ts';
import { createLocalUser, one, openDb } from '../server/db.ts';
import { listGames } from '../server/games.ts';

const TC = CONTROLS['5+0'];
const TC_INC = CONTROLS['3+2'];
const T0 = 1_700_000_000_000;

/* ---------------- Đồng hồ ---------------- */

describe('đồng hồ', () => {
  it('bắt đầu thì hai bên bằng nhau và Trắng bị tính giờ', () => {
    const c = startClock(TC, T0);
    expect(remaining(c, 'w', T0)).toBe(5 * 60_000);
    expect(remaining(c, 'b', T0)).toBe(5 * 60_000);
    expect(c.turn).toBe('w');
  });

  it('chỉ trừ giờ bên đang đi', () => {
    const c = startClock(TC, T0);
    const sau10s = T0 + 10_000;
    expect(remaining(c, 'w', sau10s)).toBe(5 * 60_000 - 10_000);
    expect(remaining(c, 'b', sau10s)).toBe(5 * 60_000);
  });

  it('đi xong thì trừ thời gian đã dùng và chuyển lượt', () => {
    const c = afterMove(startClock(TC, T0), TC, T0 + 10_000);
    expect(c.turn).toBe('b');
    expect(remaining(c, 'w', T0 + 10_000)).toBe(5 * 60_000 - 10_000);
  });

  it('thể thức có cộng giờ thì đi nhanh còn được thêm', () => {
    // 3+2: dùng 1 giây, cộng 2 giây, nên còn nhiều hơn lúc đầu 1 giây
    const c = afterMove(startClock(TC_INC, T0), TC_INC, T0 + 1_000);
    expect(remaining(c, 'w', T0 + 1_000)).toBe(3 * 60_000 + 1_000);
  });

  it('hết giờ thì báo đúng bên', () => {
    const c = startClock(TC, T0);
    expect(flagged(c, T0 + 4 * 60_000)).toBeNull();
    expect(flagged(c, T0 + 5 * 60_000)).toBe('w');
  });

  it('hết giờ mà đối thủ không đủ quân chiếu hết thì hòa', () => {
    expect(timeoutWinner('w', true)).toBe('b');
    expect(timeoutWinner('w', false)).toBe('draw');
  });
});

/* ---------------- Elo ván đấu ---------------- */

describe('Elo ván đấu', () => {
  it('thắng người mạnh hơn thì lên nhiều', () => {
    const yếuThắng = rateGame({ rating: 1000, played: 50 }, { rating: 1400, played: 50 }, 1);
    const mạnhThắng = rateGame({ rating: 1400, played: 50 }, { rating: 1000, played: 50 }, 1);
    expect(yếuThắng.whiteChange).toBeGreaterThan(mạnhThắng.whiteChange);
  });

  it('hai bên cùng trình thì thắng ăn khoảng nửa hệ số K', () => {
    const r = rateGame({ rating: 1200, played: 50 }, { rating: 1200, played: 50 }, 1);
    expect(r.whiteChange).toBe(12); // K=24, kỳ vọng 0.5 -> 24 * 0.5
    expect(r.blackChange).toBe(-12);
  });

  it('hòa với người yếu hơn nhiều thì vẫn mất điểm', () => {
    const r = rateGame({ rating: 1600, played: 50 }, { rating: 1000, played: 50 }, 0.5);
    expect(r.whiteChange).toBeLessThan(0);
    expect(r.blackChange).toBeGreaterThan(0);
  });

  it('mới chơi thì nhảy nhanh hơn', () => {
    expect(gameK(0)).toBe(40);
    expect(gameK(50)).toBe(24);
    expect(gameK(200)).toBe(16);
    const mới = rateGame({ rating: 1200, played: 0 }, { rating: 1200, played: 0 }, 1);
    const cũ = rateGame({ rating: 1200, played: 200 }, { rating: 1200, played: 200 }, 1);
    expect(mới.whiteChange).toBeGreaterThan(cũ.whiteChange);
  });

  it('hệ số K hai bên khác nhau thì điểm ăn và mất không bằng nhau', () => {
    const r = rateGame({ rating: 1200, played: 0 }, { rating: 1200, played: 200 }, 1);
    expect(r.whiteChange).toBe(20); // K=40
    expect(r.blackChange).toBe(-8); // K=16
  });

  it('không tụt dưới 400', () => {
    const r = rateGame({ rating: 400, played: 0 }, { rating: 2000, played: 0 }, 0);
    expect(r.whiteAfter).toBe(400);
  });

  it('kỳ vọng đối xứng', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
    expect(expectedScore(1400, 1000) + expectedScore(1000, 1400)).toBeCloseTo(1);
  });

  it('đổi kết quả ván thành điểm của Trắng', () => {
    expect(scoreFor('w')).toBe(1);
    expect(scoreFor('b')).toBe(0);
    expect(scoreFor('draw')).toBe(0.5);
  });
});

/* ---------------- Hàng chờ ---------------- */

const ai = (userId: number, rating: number, since = T0, control = '5+0'): Waiter => ({
  userId,
  name: `N${userId}`,
  rating,
  control,
  since,
});

describe('hàng chờ ghép trận', () => {
  it('khoảng chấp nhận nới dần rồi dừng ở mức tối đa', () => {
    expect(band(0)).toBe(BAND_START);
    expect(band(5_000)).toBe(140);
    expect(band(10_000)).toBe(180);
    expect(band(10 * 60_000)).toBe(BAND_MAX);
  });

  it('cả hai cùng phải chịu được mới ghép', () => {
    const chờLâu = ai(1, 1000, T0 - 90_000); // khoảng đã nới tối đa
    const vừaVào = ai(2, 1600, T0); // chỉ chịu ±100
    expect(fits(chờLâu, vừaVào, T0)).toBe(false);
    // Người vừa vào chờ đủ lâu thì mới ghép
    expect(fits(chờLâu, ai(2, 1600, T0 - 90_000), T0)).toBe(true);
  });

  it('khác thể thức thì không bao giờ ghép', () => {
    expect(fits(ai(1, 1200, T0, '5+0'), ai(2, 1200, T0, '3+2'), T0)).toBe(false);
  });

  it('ghép hai người gần trình nhất', () => {
    const q = new Queue();
    q.join(ai(1, 1200));
    q.join(ai(2, 1600)); // lệch 400, quá xa lúc mới vào
    q.join(ai(3, 1250)); // gần 1 nhất
    const cặp = q.match(T0);
    expect(cặp).toHaveLength(1);
    expect(cặp[0].map((w) => w.userId).sort()).toEqual([1, 3]);
    // Người chưa ghép được vẫn nằm lại trong hàng
    expect(q.has(2)).toBe(true);
    expect(q.size).toBe(1);
  });

  it('ai chờ lâu nhất được xét trước', () => {
    const q = new Queue();
    q.join(ai(1, 1200, T0 - 30_000)); // chờ lâu nhất
    q.join(ai(2, 1200, T0 - 1_000));
    q.join(ai(3, 1200, T0));
    const cặp = q.match(T0);
    expect(cặp).toHaveLength(1);
    expect(cặp[0][0].userId).toBe(1);
  });

  it('chờ đủ lâu thì ghép được với người lệch trình', () => {
    const q = new Queue();
    q.join(ai(1, 1000, T0 - 120_000));
    q.join(ai(2, 1700, T0 - 120_000));
    expect(q.match(T0)).toHaveLength(1);
  });

  it('một mình thì không ghép với chính mình', () => {
    const q = new Queue();
    q.join(ai(1, 1200));
    expect(q.match(T0)).toHaveLength(0);
    expect(q.size).toBe(1);
  });

  it('vào lại khi đang chờ thì tính giờ lại chứ không thành hai người', () => {
    const q = new Queue();
    q.join(ai(1, 1200, T0 - 50_000));
    q.join(ai(1, 1200, T0, '3+2'));
    expect(q.size).toBe(1);
    expect(q.state(1, T0)?.control).toBe('3+2');
  });

  it('bỏ hàng chờ', () => {
    const q = new Queue();
    q.join(ai(1, 1200));
    expect(q.leave(1)).toBe(true);
    expect(q.leave(1)).toBe(false);
    expect(q.state(1, T0)).toBeNull();
  });

  it('đếm người chờ cùng thể thức', () => {
    const q = new Queue();
    q.join(ai(1, 1200, T0, '5+0'));
    q.join(ai(2, 1200, T0, '5+0'));
    q.join(ai(3, 1200, T0, '3+2'));
    expect(q.waitingFor('5+0')).toBe(2);
    expect(q.state(1, T0)?.waiting).toBe(2);
  });
});

/* ---------------- Ván đang chơi ---------------- */

const phòng = (now = T0, control = TC) =>
  new Room(
    'r1',
    { userId: 1, name: 'Nelson', rating: 1200, played: 10, connected: true, goneSince: null },
    { userId: 2, name: 'Hùng', rating: 1250, played: 10, connected: true, goneSince: null },
    control,
    now,
  );

describe('ván đang chơi', () => {
  it('đi quân hợp lệ thì đổi lượt', () => {
    const r = phòng();
    expect(r.move(1, 'e2', 'e4', undefined, T0 + 1_000).ok).toBe(true);
    expect(r.game.turn).toBe('b');
    expect(r.game.history.map((m) => m.san)).toEqual(['e4']);
  });

  it('chưa tới lượt thì không đi được', () => {
    const r = phòng();
    const kq = r.move(2, 'e7', 'e5', undefined, T0 + 1_000);
    expect(kq).toEqual({ ok: false, why: 'not-your-turn' });
  });

  it('nước không hợp lệ thì bị từ chối và ván không đổi', () => {
    const r = phòng();
    expect(r.move(1, 'e2', 'e5', undefined, T0 + 1_000)).toEqual({ ok: false, why: 'illegal-move' });
    expect(r.game.length).toBe(0);
  });

  it('người ngoài không đi được', () => {
    const r = phòng();
    expect(r.move(99, 'e2', 'e4', undefined, T0 + 1_000)).toEqual({ ok: false, why: 'not-in-game' });
  });

  it('đầu hàng thì đối thủ thắng', () => {
    const r = phòng();
    expect(r.resign(1, T0 + 5_000).ok).toBe(true);
    expect(r.outcome).toEqual({ winner: 'b', reason: 'resign' });
    // Ván xong rồi thì không đi tiếp được
    expect(r.move(1, 'e2', 'e4', undefined, T0 + 6_000)).toEqual({ ok: false, why: 'game-over' });
  });

  it('đề nghị hòa rồi đối thủ đồng ý', () => {
    const r = phòng();
    expect(r.offerDraw(1, T0 + 1_000).ok).toBe(true);
    expect(r.drawOfferFrom).toBe('w');
    expect(r.acceptDraw(2, T0 + 2_000).ok).toBe(true);
    expect(r.outcome).toEqual({ winner: 'draw', reason: 'agreement' });
  });

  it('không tự đồng ý lời đề nghị của chính mình', () => {
    const r = phòng();
    r.offerDraw(1, T0 + 1_000);
    expect(r.acceptDraw(1, T0 + 2_000)).toEqual({ ok: false, why: 'no-draw-offer' });
    expect(r.outcome).toBeNull();
  });

  it('từ chối thì lời đề nghị biến mất', () => {
    const r = phòng();
    r.offerDraw(1, T0 + 1_000);
    expect(r.declineDraw(2, T0 + 2_000).ok).toBe(true);
    expect(r.drawOfferFrom).toBeNull();
    expect(r.acceptDraw(2, T0 + 3_000)).toEqual({ ok: false, why: 'no-draw-offer' });
  });

  it('hai bên cùng đề nghị hòa thì tính là đồng ý', () => {
    const r = phòng();
    r.offerDraw(1, T0 + 1_000);
    r.offerDraw(2, T0 + 2_000);
    expect(r.outcome).toEqual({ winner: 'draw', reason: 'agreement' });
  });

  it('đi một nước thì lời đề nghị hòa cũ hết hiệu lực', () => {
    const r = phòng();
    r.offerDraw(2, T0 + 1_000); // Đen đề nghị khi chưa tới lượt
    r.move(1, 'e2', 'e4', undefined, T0 + 2_000);
    expect(r.drawOfferFrom).toBeNull();
  });

  it('hết giờ thì thua', () => {
    const r = phòng();
    r.tick(T0 + 5 * 60_000 + 1);
    expect(r.outcome).toEqual({ winner: 'b', reason: 'timeout' });
  });

  it('hết giờ mà đối thủ chỉ còn Vua thì hòa', () => {
    const r = phòng();
    // Dựng thế chỉ còn hai Vua và một Tốt của Trắng, rồi cho Đen hết giờ.
    for (const [f, t] of [
      ['e2', 'e4'],
      ['e7', 'e5'],
    ] as const) {
      r.move(r.game.turn === 'w' ? 1 : 2, f, t, undefined, T0 + 1_000);
    }
    expect(canMate('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'w')).toBe(false);
    expect(canMate('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'w')).toBe(true);
    expect(canMate('4k3/8/8/8/8/8/8/3BK3 w - - 0 1', 'w')).toBe(false); // Vua + Tượng
    expect(canMate('4k3/8/8/8/8/8/8/2BBK3 w - - 0 1', 'w')).toBe(true); // hai Tượng
  });

  it('chiếu hết thì ván tự kết thúc', () => {
    const r = phòng();
    let t = T0;
    for (const [f, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ] as const) {
      t += 1_000;
      r.move(r.game.turn === 'w' ? 1 : 2, f, to, undefined, t);
    }
    expect(r.outcome).toEqual({ winner: 'b', reason: 'checkmate' });
  });

  it('mất kết nối quá lâu thì xử thua', () => {
    const r = phòng();
    r.disconnect(2, T0 + 1_000);
    r.tick(T0 + 1_000 + RECONNECT_MS - 1);
    expect(r.outcome).toBeNull();
    r.tick(T0 + 1_000 + RECONNECT_MS);
    expect(r.outcome).toEqual({ winner: 'w', reason: 'resign' });
  });

  it('vào lại kịp thì ván chạy tiếp', () => {
    const r = phòng();
    r.disconnect(2, T0 + 1_000);
    r.reconnect(2);
    r.tick(T0 + 1_000 + RECONNECT_MS + 10_000);
    expect(r.outcome).toBeNull();
    expect(r.black.connected).toBe(true);
    expect(r.reconnectBy()).toBeNull();
  });

  it('đang mất kết nối thì báo hạn chót để vào lại', () => {
    const r = phòng();
    r.disconnect(2, T0 + 1_000);
    expect(r.reconnectBy()).toBe(T0 + 1_000 + RECONNECT_MS);
  });

  it('mỗi bên nhìn ván theo phía của mình', () => {
    const r = phòng();
    r.move(1, 'e2', 'e4', undefined, T0 + 3_000);
    const củaTrắng = r.stateFor(1, T0 + 3_000)!;
    const củaĐen = r.stateFor(2, T0 + 3_000)!;
    expect(củaTrắng.youAre).toBe('w');
    expect(củaĐen.youAre).toBe('b');
    expect(củaTrắng.fen).toBe(củaĐen.fen);
    expect(củaTrắng.lastMove).toEqual(['e2', 'e4']);
    expect(củaTrắng.white.clockMs).toBe(5 * 60_000 - 3_000);
    expect(r.stateFor(99, T0)).toBeNull();
  });

  it('ván xong thì đồng hồ dừng lại chứ không trôi tiếp', () => {
    const r = phòng();
    r.resign(1, T0 + 7_000);
    const a = r.stateFor(1, T0 + 7_000)!.white.clockMs;
    const b = r.stateFor(1, T0 + 60_000)!.white.clockMs;
    expect(a).toBe(5 * 60_000 - 7_000);
    expect(b).toBe(a);
  });
});

/* ---------------- Nối hàng chờ, phòng chơi và database ---------------- */

describe('ghép trận rồi lưu kết quả', () => {
  const dựng = () => {
    const db = openDb(':memory:');
    const a = createLocalUser(db, 'Nelson');
    const b = createLocalUser(db, 'Hùng');
    return { db, a, b, live: new Live(db) };
  };

  it('hai người cùng thể thức thì ghép vào một ván', () => {
    const { live, a, b } = dựng();
    live.joinQueue(a, '5+0', T0);
    expect(live.roomOf(a.id)).toBeNull();
    live.joinQueue(b, '5+0', T0);
    const phòng = live.roomOf(a.id);
    expect(phòng).not.toBeNull();
    expect(live.roomOf(b.id)).toBe(phòng);
    expect(live.isPlaying(a.id)).toBe(true);
  });

  it('khác thể thức thì vẫn chờ', () => {
    const { live, a, b } = dựng();
    live.joinQueue(a, '5+0', T0);
    live.joinQueue(b, '3+2', T0);
    expect(live.roomOf(a.id)).toBeNull();
    expect(live.isQueued(a.id)).toBe(true);
  });

  it('đang có ván thì không vào hàng chờ được', () => {
    const { live, a, b } = dựng();
    live.joinQueue(a, '5+0', T0);
    live.joinQueue(b, '5+0', T0);
    expect(live.joinQueue(a, '5+0', T0)).toEqual({ ok: false, why: 'already-playing' });
  });

  it('hết giờ thì tự xử thua, cộng trừ Elo và lưu ván cho cả hai', () => {
    const { db, live, a, b } = dựng();
    live.joinQueue(a, '5+0', T0);
    live.joinQueue(b, '5+0', T0);
    const phòng = live.roomOf(a.id)!;
    const trắng = phòng.white;
    const đen = phòng.black;

    // Để quá 5 phút: bên cầm Trắng rơi cờ
    live.tick(T0 + 5 * 60_000 + 1);

    expect(phòng.outcome).toEqual({ winner: 'b', reason: 'timeout' });
    const sau = (id: number) =>
      one<{ game_rating: number; game_count: number }>(
        db,
        'SELECT game_rating, game_count FROM users WHERE id = ?',
        id,
      )!;
    expect(sau(trắng.userId).game_rating).toBeLessThan(1000);
    expect(sau(đen.userId).game_rating).toBeGreaterThan(1000);
    expect(sau(trắng.userId).game_count).toBe(1);

    for (const p of [trắng, đen]) {
      const ván = listGames(db, p.userId);
      expect(ván).toHaveLength(1);
      expect(ván[0]).toMatchObject({ mode: 'online', winner: 'b', reason: 'timeout' });
    }
    // Mỗi bên thấy đúng tên đối thủ của mình
    expect(listGames(db, trắng.userId)[0].opponentName).toBe(đen.name);
    expect(listGames(db, đen.userId)[0].opponentName).toBe(trắng.name);
  });

  it('đầu hàng thì cũng lưu và tính Elo một lần duy nhất', () => {
    const { db, live, a, b } = dựng();
    live.joinQueue(a, '5+0', T0);
    live.joinQueue(b, '5+0', T0);
    const phòng = live.roomOf(a.id)!;
    live.act(a.id, 'resign', {}, T0 + 1_000);
    // Gọi thêm vài nhịp nữa: không được cộng Elo hay lưu ván lần hai
    live.tick(T0 + 2_000);
    live.tick(T0 + 3_000);
    expect(listGames(db, a.id)).toHaveLength(1);
    expect(
      one<{ game_count: number }>(db, 'SELECT game_count FROM users WHERE id = ?', a.id)!.game_count,
    ).toBe(1);
    expect(phòng.over).not.toBeNull();
  });

  it('mời riêng: người khác vào được, chính mình thì không', () => {
    const { live, a, b } = dựng();
    const mã = live.createInvite(a.id, '3+2', T0);
    expect(live.acceptInvite(a, mã, T0)).toEqual({ ok: false, why: 'own-invite' });
    const kq = live.acceptInvite(b, mã, T0);
    expect(kq.ok).toBe(true);
    expect(live.roomOf(a.id)).not.toBeNull();
    // Mã dùng rồi thì thôi
    expect(live.acceptInvite(b, mã, T0)).toEqual({ ok: false, why: 'no-such-invite' });
  });

  it('mã mời sai thì báo chứ không ngã', () => {
    const { live, b } = dựng();
    expect(live.acceptInvite(b, 'KHONGCO', T0)).toEqual({ ok: false, why: 'no-such-invite' });
  });
});
