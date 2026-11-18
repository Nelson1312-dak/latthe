// Bot đấu online: chọn bot, chọn nước, thời gian nghĩ, ghép bot khi hàng chờ trống.
import { describe, expect, it } from 'vitest';
import { BOT_AFTER_MS, BOTS, chooseMove, lineFor, pickBot, thinkMs, type Candidate } from '../server/live/bots.ts';
import { Live } from '../server/live/index.ts';
import { Queue } from '../server/live/queue.ts';
import { createLocalUser, one, openDb } from '../server/db.ts';
import { listGames } from '../server/games.ts';

const T0 = 1_700_000_000_000;
const fixed = (v: number) => () => v;

describe('danh sách bot', () => {
  it('có đủ lời thoại cho mọi tình huống, không câu nào rỗng', () => {
    for (const b of BOTS) {
      for (const [ev, lines] of Object.entries(b.lines)) {
        expect(lines.length, `${b.id}.${ev}`).toBeGreaterThan(0);
        for (const l of lines) expect(l.trim().length, `${b.id}.${ev}`).toBeGreaterThan(0);
      }
    }
  });

  it('Elo tăng dần, id không trùng', () => {
    const elos = BOTS.map((b) => b.elo);
    expect([...elos].sort((a, b) => a - b)).toEqual(elos);
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
  });
});

describe('pickBot', () => {
  it('chọn bot có Elo gần nhất', () => {
    expect(pickBot(620).id).toBe('nhim');
    expect(pickBot(1000).id).toBe('sen');
    expect(pickBot(1550).id).toBe('tung');
    expect(pickBot(2800).id).toBe('thay-do');
  });
});

describe('chooseMove', () => {
  const cands: Candidate[] = [
    { uci: 'e2e4', cp: 40, forcing: false },
    { uci: 'd1h5', cp: 10, forcing: true },
    { uci: 'a2a3', cp: -300, forcing: false },
  ];

  it('bot mạnh (một dòng) đi đúng nước engine chọn', () => {
    expect(chooseMove(BOTS.find((b) => b.id === 'thay-do')!, [cands[0]])).toBe('e2e4');
  });

  it('bot yếu đôi khi đi lệch theo trọng số', () => {
    const nhim = BOTS[0];
    expect(chooseMove(nhim, cands, fixed(0))).toBe('e2e4');
    expect(chooseMove(nhim, cands, fixed(0.99))).toBe('a2a3');
  });

  it('không bao giờ bỏ qua chiếu hết một nước', () => {
    const mate: Candidate[] = [
      { uci: 'h5f7', cp: 99_999, forcing: true },
      { uci: 'a2a3', cp: 0, forcing: false },
    ];
    expect(chooseMove(BOTS[0], mate, fixed(0.99))).toBe('h5f7');
  });

  it('bot ưa tấn công nghiêng về nước ăn/chiếu không kém hơn quá 60cp', () => {
    const mai = BOTS.find((b) => b.id === 'mai')!;
    const n = 400;
    let chiếu = 0;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) if (chooseMove(mai, cands.slice(0, 2), rnd) === 'd1h5') chiếu++;
    // Trọng số gốc 5:3 => ~37%; nhân đôi nước chiếu => 6/11 ~ 55%
    expect(chiếu / n).toBeGreaterThan(0.45);
  });
});

describe('thinkMs', () => {
  const sen = BOTS[1];
  it('khai cuộc đi nhanh, giữa ván nghĩ lâu hơn', () => {
    const khai = thinkMs(sen, { ply: 2, remainingMs: 300_000, incrementMs: 0 }, fixed(0.5));
    const giữa = thinkMs(sen, { ply: 30, remainingMs: 300_000, incrementMs: 0 }, fixed(0.5));
    expect(giữa).toBeGreaterThan(khai);
  });
  it('sắp hết giờ thì đi vội, không bao giờ dưới 0,4 giây', () => {
    const vội = thinkMs(sen, { ply: 40, remainingMs: 10_000, incrementMs: 0 }, fixed(0.5));
    expect(vội).toBeLessThanOrEqual(1_000);
    expect(vội).toBeGreaterThanOrEqual(400);
  });
});

describe('lineFor', () => {
  it('bốc một câu trong kịch bản', () => {
    expect(BOTS[0].lines.greet).toContain(lineFor(BOTS[0], 'greet', fixed(0)));
  });
});

describe('ghép bot khi hàng chờ trống', () => {
  it('Queue.takeWaitedOver chỉ lấy người đã chờ đủ lâu', () => {
    const q = new Queue();
    q.join({ userId: 1, name: 'A', rating: 1000, control: '5+0', since: T0 });
    q.join({ userId: 2, name: 'B', rating: 1000, control: '5+0', since: T0 + 4_000 });
    const lấy = q.takeWaitedOver(T0 + BOT_AFTER_MS, BOT_AFTER_MS);
    expect(lấy.map((w) => w.userId)).toEqual([1]);
    expect(q.has(1)).toBe(false);
    expect(q.has(2)).toBe(true);
  });

  it('chờ 5 giây không ai ghép thì vào ván với bot; bot mang nhãn AI', () => {
    const db = openDb(':memory:');
    const a = createLocalUser(db, 'An');
    const live = new Live(db, { botMoves: false });
    live.joinQueue(a, '5+0', T0);
    live.tick(T0 + 4_000);
    expect(live.isPlaying(a.id)).toBe(false);
    live.tick(T0 + BOT_AFTER_MS);
    expect(live.isPlaying(a.id)).toBe(true);
    const st = live.roomOf(a.id)!.stateFor(a.id, T0 + BOT_AFTER_MS)!;
    const đối = st.youAre === 'w' ? st.black : st.white;
    expect(đối.bot?.id).toBeTruthy();
    expect(đối.name).toMatch(/^Bot /);
  });

  it('hai người cùng chờ thì ghép với nhau, không ghép bot', () => {
    const db = openDb(':memory:');
    const a = createLocalUser(db, 'An');
    const b = createLocalUser(db, 'Bình');
    const live = new Live(db, { botMoves: false });
    live.joinQueue(a, '5+0', T0);
    live.joinQueue(b, '5+0', T0 + 1_000);
    const st = live.roomOf(a.id)!.stateFor(a.id, T0 + 1_000)!;
    expect(st.white.bot).toBeUndefined();
    expect(st.black.bot).toBeUndefined();
  });

  it('thua bot: Elo người chơi đổi, Elo bot giữ nguyên; ván lưu với tên bot có (AI)', () => {
    const db = openDb(':memory:');
    const a = createLocalUser(db, 'An');
    const live = new Live(db, { botMoves: false });
    live.joinQueue(a, '5+0', T0);
    live.tick(T0 + BOT_AFTER_MS);
    const room = live.roomOf(a.id)!;
    const botRating = (room.white.bot ? room.white : room.black).rating;
    live.act(a.id, 'resign', {}, T0 + 6_000);
    const sau = one<{ game_rating: number }>(db, 'SELECT game_rating FROM users WHERE id = ?', a.id)!;
    expect(sau.game_rating).toBeLessThan(1000);
    expect((room.white.bot ? room.white : room.black).rating).toBe(botRating);
    const ván = listGames(db, a.id);
    expect(ván[0].opponentName).toMatch(/\(AI\)$/);
  });
});
