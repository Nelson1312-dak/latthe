/**
 * worker/market-stream.mjs — giá thị trường realtime từ DNSE Market Data WebSocket.
 * Nhận khớp lệnh (tick), độ sâu thị trường (top_price: 3 mức mua/bán với HOSE) và chỉ số (market_index),
 * gộp vào trạng thái mới nhất của từng mã rồi ghi vào DB mỗi giây. API /api/market đọc từ đó.
 *
 *   npm run worker:market
 *
 * Chỉ MỘT kết nối cho cả rổ mã (DNSE cho tối đa 10 kết nối/user và 200 stream/kết nối).
 * Biến môi trường: DNSE_API_KEY, DNSE_API_SECRET, SUPABASE_URL, DB_JWT_SECRET
 */
import { rest } from '../api/_db.js';
import { UNIVERSE, INDICES } from '../api/_market.js';
import { DnseSocket, isControl } from './_socket.mjs';

const FLUSH_MS = 1000;
const log = (...a) => console.log(new Date().toISOString(), ...a);

export const channels = (symbols = UNIVERSE.map((x) => x.s), indices = INDICES) => [
  { name: 'tick.G1.json', symbols },
  { name: 'top_price.G1.json', symbols },
  { name: 'security_definition.G1.json', symbols },
  ...indices.map((i) => ({ name: `market_index.${i}.json`, symbols: [] })),
];

const num = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : null);
// DNSE gửi khối lượng mỗi bước giá ở trường `qtty` (không phải `quantity`); giữ cả hai tên cho chắc.
const lvl = (a) => (Array.isArray(a) ? a.slice(0, 10).map((x) => ({ p: num(x.price), q: num(x.qtty ?? x.quantity) })).filter((x) => x.p != null) : []);
const tsOf = (t) => (t && Number.isFinite(+t.Seconds) ? new Date(t.Seconds * 1000 + Math.floor((t.Nanos || 0) / 1e6)).toISOString() : new Date().toISOString());

/** Phân loại message dữ liệu của kênh giá theo trường đặc trưng của từng loại. */
export function classify(m) {
  if (!m || typeof m !== 'object' || isControl(m)) return null;
  if (m.indexName && 'valueIndexes' in m) return 'index';
  if (m.symbol && Array.isArray(m.bid) && Array.isArray(m.offer)) return 'depth';
  if (m.symbol && 'matchPrice' in m) return 'tick';
  if (m.symbol && 'basicPrice' in m && 'ceilingPrice' in m) return 'secdef';
  return null;
}

/** Trạng thái giá mới nhất, gộp từ nhiều loại message. */
export class MarketState {
  constructor() { this.quotes = new Map(); this.indices = new Map(); this.dirty = new Set(); this.dirtyIdx = new Set(); this.counts = { tick: 0, depth: 0, index: 0, secdef: 0 }; }
  apply(m) {
    const kind = classify(m);
    if (!kind) return null;
    this.counts[kind]++;
    if (kind === 'index') {
      const name = String(m.indexName).toUpperCase();
      this.indices.set(name, {
        value: num(m.valueIndexes), prior: num(m.priorValueIndexes), change: num(m.changedValue), pct: num(m.changedRatio),
        high: num(m.highestValueIndexes), low: num(m.lowestValueIndexes),
        up: num(m.fluctuationUpIssueCount), down: num(m.fluctuationDownIssueCount), flat: num(m.fluctuationSteadinessIssueCount),
        ceil: num(m.fluctuationUpperLimitIssueCount), floor: num(m.fluctuationLowerLimitIssueCount),
        volume: num(m.totalVolumeTraded), value_traded: num(m.grossTradeAmount), at: tsOf(m.transactTime),
      });
      this.dirtyIdx.add(name); return kind;
    }
    const s = String(m.symbol).toUpperCase();
    const q = this.quotes.get(s) || { symbol: s };
    if (kind === 'tick') {
      Object.assign(q, { last: num(m.matchPrice), lastQty: num(m.matchQtty), vol: num(m.totalVolumeTraded), open: num(m.openPrice), high: num(m.highestPrice), low: num(m.lowestPrice), tickAt: tsOf(m.time) });
    } else if (kind === 'depth') {
      const bid = lvl(m.bid), offer = lvl(m.offer);
      const tong = (a) => (a.length && a.every((x) => x.q != null) ? a.reduce((x, y) => x + y.q, 0) : null);
      Object.assign(q, { bid, offer, totalBid: num(m.totalBidQtty) ?? tong(bid), totalOffer: num(m.totalOfferQtty) ?? tong(offer), depthAt: tsOf(m.time) });
    } else if (kind === 'secdef') {
      Object.assign(q, { ref: num(m.basicPrice), ceil: num(m.ceilingPrice), floor: num(m.floorPrice) });
    }
    this.quotes.set(s, q); this.dirty.add(s);
    return kind;
  }
  /** Lấy các dòng đã đổi kể từ lần ghi trước. */
  drain() {
    const quotes = [...this.dirty].map((s) => ({ symbol: s, data: this.quotes.get(s), at: new Date().toISOString() }));
    const indices = [...this.dirtyIdx].map((n) => ({ name: n, data: this.indices.get(n), at: new Date().toISOString() }));
    this.dirty.clear(); this.dirtyIdx.clear();
    return { quotes, indices };
  }
}

export class MarketStream {
  constructor({ apiKey = process.env.DNSE_API_KEY, apiSecret = process.env.DNSE_API_SECRET, WS, db = rest, symbols, indices } = {}) {
    this.db = db; this.state = new MarketState(); this.timer = null; this.lastFlush = null; this.flushErrors = 0;
    this.sock = new DnseSocket({ name: 'market', apiKey, apiSecret, WS, channels: channels(symbols, indices), onData: (m) => this.state.apply(m) });
  }
  start() { this.sock.start(); this.timer = setInterval(() => this.flush(), FLUSH_MS); }
  stop() { clearInterval(this.timer); this.sock.stop(); }

  async flush() {
    const { quotes, indices } = this.state.drain();
    try {
      if (quotes.length) await this.db('/market_quotes?on_conflict=symbol', { role: 'app_worker', method: 'POST', prefer: 'resolution=merge-duplicates', body: quotes });
      if (indices.length) await this.db('/market_indices?on_conflict=name', { role: 'app_worker', method: 'POST', prefer: 'resolution=merge-duplicates', body: indices });
      if (quotes.length || indices.length) this.lastFlush = Date.now();
      this.flushErrors = 0;
    } catch (e) {
      // Ghi lỗi thì đưa dòng trở lại hàng đợi để lần sau ghi lại, không mất cập nhật
      quotes.forEach((r) => this.state.dirty.add(r.symbol)); indices.forEach((r) => this.state.dirtyIdx.add(r.name));
      if (this.flushErrors++ % 30 === 0) log('không ghi được giá vào DB:', e.message);
    }
    return { quotes: quotes.length, indices: indices.length };
  }
  report() {
    return this.db('/worker_status?on_conflict=name', {
      role: 'app_worker', method: 'POST', prefer: 'resolution=merge-duplicates',
      body: { name: 'market-stream', at: new Date().toISOString(), info: { state: this.sock.state, reconnects: this.sock.reconnects, lastMsgAt: this.sock.lastMsgAt ? new Date(this.sock.lastMsgAt).toISOString() : null, ...this.state.counts, symbols: this.state.quotes.size, indices: this.state.indices.size, lastFlush: this.lastFlush ? new Date(this.lastFlush).toISOString() : null } },
    }).catch((e) => log('không ghi được trạng thái worker:', e.message));
  }
}

if (process.argv[1]?.endsWith('market-stream.mjs')) {
  for (const k of ['DNSE_API_KEY', 'DNSE_API_SECRET', 'SUPABASE_URL', 'DB_JWT_SECRET']) {
    if (!process.env[k]) { console.error(`Thiếu biến môi trường ${k}`); process.exit(1); }
  }
  if (typeof globalThis.WebSocket !== 'function') { console.error('Cần Node 22 trở lên (có WebSocket sẵn).'); process.exit(1); }
  const m = new MarketStream(); m.start();
  const rep = setInterval(() => m.report(), 30_000); m.report();
  log('worker giá thị trường khởi động');
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('dừng worker giá'); clearInterval(rep); m.stop(); process.exit(0); });
}
