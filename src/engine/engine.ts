// Chạy Stockfish trong Web Worker và nói chuyện với nó bằng UCI.
//
// Engine chạy ở máy NGƯỜI CHƠI, không phải máy chủ: máy chủ chỉ giữ dữ liệu.
// Dùng bản lite-single (một luồng) nên không cần header COOP/COEP.

import { parseBestMove, parseInfo, toWhitePov, type InfoLine } from './uci.ts';
import { levelById, pickLine, type Level } from './levels.ts';
import type { Score } from '../../shared/winrate.ts';

const ENGINE_URL = '/engine/stockfish-19-lite-single.js';

export interface AnalysisLine {
  /** Nước đi dạng UCI. */
  uci: string;
  /** Điểm theo góc nhìn Trắng. */
  score: Score;
  pv: string[];
}

export interface Analysis {
  depth: number;
  lines: AnalysisLine[];
}

type Resolver = (lines: InfoLine[]) => void;

export class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private lines = new Map<number, InfoLine>();
  private pending: Resolver | null = null;
  /** Lệnh đang chạy; dùng để bỏ qua kết quả của lệnh đã bị huỷ. */
  private runId = 0;
  private lastOptions = { multipv: 0, elo: 0 };

  /** Engine đã tải xong chưa (để giao diện biết mà báo). */
  get loaded(): boolean {
    return this.worker !== null;
  }

  private async start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(ENGINE_URL);
      } catch (err) {
        reject(new Error(`Không tạo được worker cho engine: ${(err as Error).message}`));
        return;
      }
      this.worker = worker;
      const timer = setTimeout(() => reject(new Error('Engine không phản hồi')), 20_000);

      worker.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error(`Engine lỗi: ${e.message}`));
      };
      worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data?.data ?? '');
        if (line === 'uciok') {
          worker.postMessage('isready');
          return;
        }
        if (line === 'readyok') {
          clearTimeout(timer);
          worker.onmessage = this.onLine;
          resolve();
          return;
        }
      };
      worker.postMessage('uci');
    });
    return this.ready;
  }

  private onLine = (e: MessageEvent): void => {
    const line = typeof e.data === 'string' ? e.data : String(e.data?.data ?? '');
    const info = parseInfo(line);
    if (info) {
      // Chỉ giữ dòng sâu nhất của mỗi multipv
      const old = this.lines.get(info.multipv);
      if (!old || info.depth >= old.depth) this.lines.set(info.multipv, info);
      return;
    }
    if (line.startsWith('bestmove') && this.pending) {
      const resolve = this.pending;
      this.pending = null;
      const sorted = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv);
      // Khi engine đi ngay (chiếu hết/bí) thì không có dòng info nào
      const best = parseBestMove(line);
      if (!sorted.length && best) {
        sorted.push({ depth: 0, multipv: 1, score: { cp: 0 }, pv: [best.best] });
      }
      resolve(sorted);
    }
  };

  private send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  /** Dừng lệnh đang chạy (nếu có) và chờ nó kết thúc hẳn. */
  private async stopCurrent(): Promise<void> {
    if (!this.pending) return;
    this.send('stop');
    // Đợi bestmove của lệnh cũ về, nếu không hai lệnh sẽ lẫn vào nhau
    await new Promise<void>((resolve) => {
      const check = () => (this.pending ? setTimeout(check, 10) : resolve());
      setTimeout(check, 10);
    });
  }

  private async run(fen: string, opts: { movetimeMs?: number; depth?: number; multipv?: number; elo?: number }): Promise<InfoLine[]> {
    await this.start();
    await this.stopCurrent();
    const id = ++this.runId;

    const multipv = opts.multipv ?? 1;
    if (multipv !== this.lastOptions.multipv) {
      this.send(`setoption name MultiPV value ${multipv}`);
      this.lastOptions.multipv = multipv;
    }
    const elo = opts.elo ?? 0;
    if (elo !== this.lastOptions.elo) {
      this.send(`setoption name UCI_LimitStrength value ${elo ? 'true' : 'false'}`);
      if (elo) this.send(`setoption name UCI_Elo value ${elo}`);
      this.lastOptions.elo = elo;
    }

    this.lines.clear();
    const result = await new Promise<InfoLine[]>((resolve) => {
      this.pending = resolve;
      this.send(`position fen ${fen}`);
      const limit = opts.depth ? `depth ${opts.depth}` : `movetime ${opts.movetimeMs ?? 300}`;
      this.send(`go ${limit}`);
    });
    // Lệnh đã bị thay bằng lệnh mới thì kết quả này không còn dùng được
    return id === this.runId ? result : [];
  }

  /** Phân tích một thế cờ. Điểm trả về theo góc nhìn Trắng. */
  async analyse(fen: string, opts: { movetimeMs?: number; depth?: number; multipv?: number } = {}): Promise<Analysis> {
    const side = fen.split(' ')[1] === 'w' ? 'w' : 'b';
    const lines = await this.run(fen, opts);
    return {
      depth: lines[0]?.depth ?? 0,
      lines: lines.map((l) => ({ uci: l.pv[0], score: toWhitePov(l.score, side), pv: l.pv })),
    };
  }

  /** Máy chọn nước đi theo cấp độ. Trả về null nếu không có nước nào. */
  async pickMove(fen: string, levelId: number, random: () => number = Math.random): Promise<string | null> {
    const level: Level = levelById(levelId);
    const lines = await this.run(fen, {
      movetimeMs: level.moveTimeMs,
      depth: level.depth,
      multipv: level.multipv,
      elo: level.elo,
    });
    if (!lines.length) return null;
    return lines[pickLine(level, lines.length, random)].pv[0] ?? null;
  }

  /** Huỷ việc đang tính (người chơi bấm ván mới, lùi nước...). */
  async cancel(): Promise<void> {
    this.runId++;
    await this.stopCurrent();
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.pending = null;
  }
}

/** Một engine dùng chung cho cả app; tải WASM một lần thôi. */
let shared: Engine | null = null;
export function engine(): Engine {
  shared ??= new Engine();
  return shared;
}
