// Sinh dữ liệu mẫu THẬT cho trang thiết kế: nước đi hợp lệ (chess.js), điểm số từ Stockfish.
// Chạy: npm run fixtures   (ghi ra src/mock/fixtures.json)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import { classify, moveAccuracy, winPercent, type MoveClass, type Score } from '../shared/winrate.ts';

const require = createRequire(import.meta.url);
const findEngine = require('stockfish/scripts/findEngine.js') as (t: string) => string;
const DEPTH = 16;

// ---------- UCI tối giản ----------
class Engine {
  private proc = spawn(process.execPath, [findEngine('lite-single')], { stdio: ['pipe', 'pipe', 'inherit'] });
  private buf = '';
  private waiters: { test: (l: string) => boolean; resolve: () => void }[] = [];
  private onLine: ((l: string) => void) | null = null;

  constructor() {
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (d: string) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.onLine?.(line);
        const w = this.waiters.find((x) => x.test(line));
        if (w) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve();
        }
      }
    });
  }
  send(c: string) {
    this.proc.stdin.write(c + '\n');
  }
  wait(test: (l: string) => boolean) {
    return new Promise<void>((resolve) => this.waiters.push({ test, resolve }));
  }
  async init() {
    this.send('uci');
    await this.wait((l) => l === 'uciok');
    this.send('setoption name Hash value 64');
    this.send('isready');
    await this.wait((l) => l === 'readyok');
  }
  /** Trả về các dòng MultiPV, điểm theo góc nhìn bên Trắng. */
  async analyse(fen: string, multipv = 3): Promise<{ uci: string[]; score: Score }[]> {
    const lines = new Map<number, { uci: string[]; score: Score }>();
    const white = fen.split(' ')[1] === 'w';
    this.onLine = (l) => {
      if (!l.startsWith('info') || !l.includes(' pv ') || !l.includes(` depth ${DEPTH} `)) return;
      const mpv = Number(/ multipv (\d+)/.exec(l)?.[1] ?? 1);
      const cp = / score cp (-?\d+)/.exec(l);
      const mate = / score mate (-?\d+)/.exec(l);
      const pv = l.split(' pv ')[1].split(' ');
      const s = cp ? Number(cp[1]) : Number(mate![1]);
      const signed = white ? s : -s;
      lines.set(mpv, { uci: pv, score: cp ? { cp: signed } : { mate: signed } });
    };
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${DEPTH}`);
    await this.wait((l) => l.startsWith('bestmove'));
    this.onLine = null;
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }
  quit() {
    this.send('quit');
  }
}

function uciToSan(fen: string, uci: string[]): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uci) {
    try {
      out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}

// ---------- Ván 1: Bạn (Trắng) vs Máy cấp 4 ----------
// "e:N" = chọn nước tốt thứ N của engine (mô phỏng người chơi / máy cấp thấp).
const GAME1: string[] = [
  'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'Nc3', 'd6',
  'Bg5', 'h6', 'Bh4', 'g5', 'Bg3', 'Bg4', 'h3', 'Bxf3', 'Qxf3', 'Nd4',
  'Qg4', 'Nxc2+', 'Kd1', 'Nxa1', 'Bxf7+', 'e:1', 'e:2', 'e:1', 'e:2', 'e:1',
  'e:3', 'e:1', 'e:2', 'e:1',
];
const BOOK_PLIES = 6; // e4 e5 Nf3 Nc6 Bc4 Nf6: Phòng thủ hai Mã (C55)

interface FixtureMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  scoreBefore: Score;
  scoreAfter: Score;
  best: { san: string; score: Score; pv: string[] }[];
  cls: MoveClass;
  accuracy: number;
}

async function playGame(e: Engine, script: string[]) {
  const c = new Chess();
  const moves: FixtureMove[] = [];
  let analysis = await e.analyse(c.fen());
  for (let i = 0; i < script.length; i++) {
    const fenBefore = c.fen();
    const side = c.turn();
    const step = script[i];
    let san: string;
    if (step.startsWith('e:')) {
      const n = Number(step.slice(2)) - 1;
      const pick = analysis[Math.min(n, analysis.length - 1)];
      san = uciToSan(fenBefore, [pick.uci[0]])[0];
    } else san = step;
    const mv = c.move(san); // ném lỗi nếu nước không hợp lệ
    const after = c.isGameOver() ? [] : await e.analyse(c.fen());
    const scoreBefore = analysis[0].score;
    const scoreAfter: Score = c.isCheckmate()
      ? { mate: side === 'w' ? 1 : -1 }
      : after[0]?.score ?? { cp: 0 };
    const uci = mv.from + mv.to + (mv.promotion ?? '');
    const isBest = analysis[0].uci[0] === uci;
    const sign = side === 'w' ? 1 : -1;
    const wb = sign > 0 ? winPercent(scoreBefore) : 100 - winPercent(scoreBefore);
    const wa = sign > 0 ? winPercent(scoreAfter) : 100 - winPercent(scoreAfter);
    moves.push({
      ply: i + 1,
      san: mv.san,
      uci,
      fenBefore,
      fenAfter: c.fen(),
      scoreBefore,
      scoreAfter,
      best: analysis.map((l) => ({ san: uciToSan(fenBefore, [l.uci[0]])[0], score: l.score, pv: uciToSan(fenBefore, l.uci.slice(0, 8)) })),
      cls: classify({ before: scoreBefore, after: scoreAfter, side, isBest, isBook: i < BOOK_PLIES }),
      accuracy: Math.round(moveAccuracy(wb, wa) * 10) / 10,
    });
    analysis = after;
    process.stdout.write(`${i + 1}.${mv.san} `);
  }
  const acc = (side: number) => {
    const xs = moves.filter((m) => (m.ply % 2 === 1) === (side === 0)).map((m) => m.accuracy);
    return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  };
  return { moves, pgn: c.pgn(), accuracy: { w: acc(0), b: acc(1) } };
}

async function position(e: Engine, fen: string, multipv = 3) {
  const a = await e.analyse(fen, multipv);
  return { fen, lines: a.map((l) => ({ san: uciToSan(fen, [l.uci[0]])[0], score: l.score, pv: uciToSan(fen, l.uci.slice(0, 8)) })) };
}

const e = new Engine();
await e.init();
console.log('Ván 1');
const game1 = await playGame(e, GAME1);

// Ván online: Gambit Hậu từ chối, thế cờ sau 9...Nd5 (ý đồ giải phóng của Capablanca)
const qgd = new Chess();
for (const m of ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'Nbd7', 'Rc1', 'c6', 'Bd3', 'dxc4', 'Bxc4', 'Nd5']) qgd.move(m);
console.log('\nVán online');
const online = { pgn: qgd.pgn(), history: qgd.history(), ...(await position(e, qgd.fen())) };

// Bài tập cho màn Ôn tập (thế cờ dựng tay, lời giải xác nhận bằng engine)
console.log('Bài tập');
const puzzles = [
  { id: 'hang-cuoi', theme: 'Chiếu hết hàng cuối', rating: 640, ...(await position(e, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 1)) },
  { id: 'don-doi-ma', theme: 'Đòn đôi của Mã', rating: 810, ...(await position(e, 'r2q3k/ppp2ppp/8/4N3/8/8/PPP2PPP/R2QK2R w KQ - 0 1', 1)) },
  { id: 'don-xien', theme: 'Đòn xiên', rating: 1020, ...(await position(e, '7q/6p1/8/7k/8/6P1/6K1/R7 w - - 0 1', 1)) },
];
e.quit();

mkdirSync('src/mock', { recursive: true });
writeFileSync(
  'src/mock/fixtures.json',
  JSON.stringify({ generatedBy: `Stockfish 19 Lite, depth ${DEPTH}`, game1: { ...game1, opening: 'Phòng thủ hai Mã · C55' }, online, puzzles }, null, 1),
);
console.log('\nĐã ghi src/mock/fixtures.json');
for (const m of game1.moves) console.log(m.ply, m.san, m.cls, JSON.stringify(m.scoreAfter), 'best', m.best[0]?.san);
console.log('accuracy', game1.accuracy, 'online best', online.lines[0].san, JSON.stringify(online.lines[0].score));
for (const p of puzzles) console.log(p.id, p.lines[0].san, JSON.stringify(p.lines[0].score));
