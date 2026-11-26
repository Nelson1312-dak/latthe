// Stockfish chạy trên server, cho bot đấu online.
//
// Dùng chính gói `stockfish` (bản WASM lite, một luồng) mà trình duyệt đang
// dùng, chạy như một tiến trình Node con, nói chuyện bằng UCI qua stdin/stdout.
// Một tiến trình dùng chung cho mọi ván bot; các yêu cầu xếp hàng lần lượt
// (mỗi yêu cầu chỉ vài trăm ms). Tiến trình chết thì lần sau tự dựng lại.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { Game } from '../../shared/chess.ts';
import type { Candidate } from './bots.ts';

const ENGINE = resolve('node_modules/stockfish/bin/stockfish-19-lite-single.js');

export interface SearchOpts {
  movetimeMs: number;
  depth?: number;
  multipv: number;
}

interface Job {
  fen: string;
  opts: SearchOpts;
  resolve: (c: Candidate[]) => void;
}

class BotEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = '';
  private jobs: Job[] = [];
  private busy = false;
  private lines = new Map<number, { uci: string; cp: number }>();
  private onBest: (() => void) | null = null;
  private onReady: (() => void) | null = null;
  private lastMultipv = -1;

  /** Tìm các nước tốt cho bên đang đi. Điểm theo góc nhìn bên đang đi. */
  search(fen: string, opts: SearchOpts): Promise<Candidate[]> {
    return new Promise((res) => {
      this.jobs.push({ fen, opts, resolve: res });
      void this.pump();
    });
  }

  private start(): Promise<void> {
    if (this.proc) return Promise.resolve();
    const p = spawn(process.execPath, [ENGINE], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = p;
    // Server tắt thì tắt luôn engine, không để tiến trình con chạy ngầm
    process.once('exit', () => p.kill());
    this.buf = '';
    this.lastMultipv = -1;
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d: string) => this.read(d));
    p.on('exit', () => {
      // Chết giữa chừng: nhả việc đang làm để ván không treo, lần sau dựng lại
      this.proc = null;
      this.onBest?.();
    });
    return new Promise((ok) => {
      this.onReady = ok;
      this.send('uci');
      this.send('isready');
    });
  }

  private send(cmd: string): void {
    this.proc?.stdin.write(cmd + '\n');
  }

  private read(chunk: string): void {
    this.buf += chunk;
    let i: number;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (line === 'readyok') {
        const r = this.onReady;
        this.onReady = null;
        r?.();
      } else if (line.startsWith('info ') && line.includes(' pv ')) {
        const mpv = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
        const mate = / score mate (-?\d+)/.exec(line);
        const cp = / score cp (-?\d+)/.exec(line);
        const pv = / pv (\S+)/.exec(line)?.[1];
        if (!pv) continue;
        const v = mate ? (Number(mate[1]) > 0 ? 100_000 - Number(mate[1]) : -100_000 - Number(mate[1])) : Number(cp?.[1] ?? 0);
        this.lines.set(mpv, { uci: pv, cp: v });
      } else if (line.startsWith('bestmove')) {
        const b = this.onBest;
        this.onBest = null;
        b?.();
      }
    }
  }

  private async pump(): Promise<void> {
    if (this.busy) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.busy = true;
    let out: Candidate[] = [];
    try {
      await this.start();
      if (job.opts.multipv !== this.lastMultipv) {
        this.send(`setoption name MultiPV value ${job.opts.multipv}`);
        this.lastMultipv = job.opts.multipv;
      }
      this.lines.clear();
      await new Promise<void>((done) => {
        this.onBest = done;
        // Kẹt thì cũng không giữ ván mãi: quá hạn là bỏ
        const hạn = setTimeout(() => {
          if (this.onBest === done) {
            this.send('stop');
          }
        }, job.opts.movetimeMs + 3_000);
        hạn.unref();
        this.send(`position fen ${job.fen}`);
        // Có độ sâu thì vẫn giữ mốc thời gian: hết giờ trước khi đủ sâu thì dừng
        this.send(job.opts.depth ? `go depth ${job.opts.depth} movetime ${job.opts.movetimeMs}` : `go movetime ${job.opts.movetimeMs}`);
      });
      out = [...this.lines.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, l]) => ({ uci: l.uci, cp: l.cp, forcing: forcing(job.fen, l.uci) }));
    } catch (err) {
      console.error('[bot] engine lỗi:', (err as Error).message);
    } finally {
      this.busy = false;
      job.resolve(out);
      void this.pump();
    }
  }
}

/** Nước ăn quân hoặc chiếu (để bot ưa tấn công chọn). */
function forcing(fen: string, uci: string): boolean {
  try {
    const g = new Game(fen);
    const m = g.move(uci.slice(0, 2) as never, uci.slice(2, 4) as never, uci[4]);
    return Boolean(m && (m.captured || m.san.includes('+') || m.san.includes('#')));
  } catch {
    return false;
  }
}

let engine: BotEngine | null = null;
export const botEngine = (): BotEngine => (engine ??= new BotEngine());

/**
 * Engine thứ hai, riêng cho việc chấm ván ở máy chủ (server/analyst.ts): chấm
 * mất hàng chục giây một ván, dùng chung với bot thì bot phải xếp hàng chờ.
 */
let analysis: BotEngine | null = null;
export const analysisEngine = (): BotEngine => (analysis ??= new BotEngine());
