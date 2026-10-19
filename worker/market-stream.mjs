/**
 * worker/market-stream.mjs — giá thị trường realtime từ DNSE Market Data WebSocket.
 * Nhận khớp lệnh (tick), độ sâu thị trường (top_price: 3 mức mua/bán với HOSE, 10 mức với HNX)
 * và chỉ số (market_index). Làm hai việc cùng lúc:
 *   1. gộp vào trạng thái mới nhất của từng mã rồi ghi đè vào trade.market_quotes mỗi giây (API /api/market đọc từ đó);
 *   2. GHI LẠI LỊCH SỬ vào trade.tape và trade.depth_log — dữ liệu này không mua lại được về sau.
 *
 *   npm run worker:market
 *
 * GIỚI HẠN CỦA DNSE (đo thật ngày 13/10/2026, hạng tài khoản normalUser):
 *   - Mỗi kết nối tối đa 200 CẶP (kênh × mã), không phải 200 mã: 65 mã × 3 kênh + 4 chỉ số = 199 thì
 *     được, 66 mã × 3 kênh + 4 chỉ số = 202 thì bị từ chối, còn 98 mã × 2 kênh + 4 chỉ số = 200 vừa khít.
 *   - Giữ mở đồng thời ít nhất 8 kết nối, mỗi kết nối đủ 200 cặp.
 *   Nên rổ lớn phải CHIA cho nhiều kết nối — xem shardChannels().
 *
 *   Lưu ý khi tự đo lại: DNSE trả `subscribed` RIÊNG cho từng kênh, và vẫn gửi `subscribed` cho các
 *   kênh hợp lệ kèm theo một `error` cho phần vượt hạn. Đóng kết nối ngay khi thấy `subscribed` đầu
 *   tiên sẽ bỏ sót lỗi và cho kết quả sai. Phải đợi hết mọi phản hồi rồi mới kết luận.
 *
 * Không đăng ký kênh security_definition nữa: suốt cả phiên 13/10 nó gửi đúng 0 bản tin
 * (trường `secdef` trong trade.worker_status) nhưng chiếm một phần ba hạn mức. Giá tham chiếu,
 * trần và sàn vẫn tính được bằng api/_market.js limits().
 *
 * Biến môi trường: DNSE_API_KEY, DNSE_API_SECRET, SUPABASE_URL, DB_JWT_SECRET
 *                  TAPE_OFF=1 để chỉ chạy phần giá, không ghi lịch sử.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rest } from '../api/_db.js';
import { UNIVERSE, INDICES, fetchBars, limits, refFromBars, vnNow } from '../api/_market.js';
import { DnseSocket, isControl } from './_socket.mjs';

const FLUSH_MS = 1000;
const MAX_BUFFER = 300_000;        // DB chết lâu thì giữ lại tối đa ngần này dòng, cũ nhất bị bỏ
const log = (...a) => console.log(new Date().toISOString(), ...a);

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/** Rổ mã ghi băng lệnh: 150 mã lớn nhất HOSE+HNX, đã bao trọn UNIVERSE của giao diện. */
export function tapeSymbols() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(GOC, 'data/tape-universe.json'), 'utf8'));
    const ds = new Set(j.ma.map((x) => x.s));
    for (const x of UNIVERSE) ds.add(x.s);      // giao diện phải luôn có giá, dù rổ ghi có đổi
    return [...ds];
  } catch (e) {
    log('không đọc được data/tape-universe.json, quay về rổ giao diện:', e.message);
    return UNIVERSE.map((x) => x.s);
  }
}

/** Bản đồ mã -> { ex, ten } cho cả rổ ghi. UNIVERSE mô tả kỹ hơn (ngành, VN30) nên được ưu tiên. */
export function tapeInfo() {
  const m = new Map();
  try {
    const j = JSON.parse(fs.readFileSync(path.join(GOC, 'data/tape-universe.json'), 'utf8'));
    for (const x of j.ma) m.set(x.s, { ex: x.ex, name: x.ten });
  } catch { /* rổ giao diện bên dưới vẫn đủ để chạy */ }
  for (const x of UNIVERSE) m.set(x.s, { ex: x.ex, name: x.name, sector: x.sector, vn30: !!x.vn30, watch: !!x.watch });
  return m;
}

const MAX_CAP = 200;                                        // cặp (kênh × mã) tối đa mỗi kết nối
const KENH_MA = ['tick.G1.json', 'top_price.G1.json'];      // kênh tính theo từng mã

export const channels = (symbols = tapeSymbols(), indices = INDICES) => [
  ...KENH_MA.map((name) => ({ name, symbols })),
  ...indices.map((i) => ({ name: `market_index.${i}.json`, symbols: [] })),
];

/**
 * Chia rổ mã thành nhiều kết nối sao cho mỗi kết nối không quá `max` cặp (kênh × mã).
 * Kênh chỉ số tính 1 cặp mỗi kênh và dồn vào kết nối đầu.
 * @returns {Array<Array<{name:string,symbols:string[]}>>} mỗi phần tử là danh sách kênh của một kết nối
 */
export function shardChannels(symbols = tapeSymbols(), indices = INDICES, max = MAX_CAP) {
  const phan = [];
  const idx = [...indices];
  let i = 0;
  while (i < symbols.length || idx.length) {
    const chiSo = idx.splice(0, Math.max(0, max - KENH_MA.length));   // chừa chỗ cho ít nhất một mã
    const choMa = Math.floor((max - chiSo.length) / KENH_MA.length);
    const cua = symbols.slice(i, i + choMa);
    i += cua.length;
    phan.push([
      ...(cua.length ? KENH_MA.map((name) => ({ name, symbols: cua })) : []),
      ...chiSo.map((x) => ({ name: `market_index.${x}.json`, symbols: [] })),
    ]);
    if (!cua.length && !chiSo.length) break;   // không còn gì để chia, tránh lặp vô hạn
  }
  return phan;
}

/** Số cặp (kênh × mã) của một danh sách kênh — dùng để kiểm tra không vượt trần. */
export const demCap = (ch) => ch.reduce((n, c) => n + Math.max(1, c.symbols.length), 0);

const num = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : null);
// DNSE gửi giá theo đơn vị nghìn đồng (FPT = 56.3). Lịch sử lưu thẳng ra ĐỒNG dạng số nguyên
// để không bao giờ lệch do số thực; giá sàn Việt Nam luôn là bội của 10 đồng nên không mất mát.
const dong = (v) => { const p = num(v); return p == null ? null : Math.round(p * 1000); };
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
  constructor({ tape = true, thongTin = new Map() } = {}) {
    this.thongTin = thongTin;
    this.quotes = new Map(); this.indices = new Map(); this.dirty = new Set(); this.dirtyIdx = new Set();
    this.counts = { tick: 0, depth: 0, index: 0, secdef: 0 };
    // Ghi lịch sử: hàng đợi chờ đẩy xuống DB, và khối lượng luỹ kế lần trước của từng mã để tính chênh
    this.ghiTape = tape; this.tapeRows = []; this.depthRows = []; this.volTruoc = new Map();
    this.bo = { tape: 0, depth: 0 };        // số dòng buộc phải bỏ vì hàng đợi đầy
    this.gop = { tongMatch: 0, tongDelta: 0 };   // để đo mức gộp tin của DNSE ngay khi đang chạy
  }
  /** Đưa vào hàng đợi, chặn trên để DB chết lâu cũng không ăn hết bộ nhớ. */
  _them(arr, row, ten) {
    arr.push(row);
    if (arr.length > MAX_BUFFER) { arr.splice(0, arr.length - MAX_BUFFER); this.bo[ten]++; }
  }
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
    const q = this._lay(s);
    if (kind === 'tick') {
      Object.assign(q, { last: num(m.matchPrice), lastQty: num(m.matchQtty), vol: num(m.totalVolumeTraded), open: num(m.openPrice), high: num(m.highestPrice), low: num(m.lowestPrice), tickAt: tsOf(m.time) });
      if (this.ghiTape) this._ghiTick(s, m, q);
    } else if (kind === 'depth') {
      const bid = lvl(m.bid), offer = lvl(m.offer);
      const tong = (a) => (a.length && a.every((x) => x.q != null) ? a.reduce((x, y) => x + y.q, 0) : null);
      Object.assign(q, { bid, offer, totalBid: num(m.totalBidQtty) ?? tong(bid), totalOffer: num(m.totalOfferQtty) ?? tong(offer), depthAt: tsOf(m.time) });
      if (this.ghiTape && (bid.length || offer.length)) {
        this._them(this.depthRows, {
          symbol: s, at: tsOf(m.time),
          bid_p: bid.map((x) => dong(x.p)), bid_q: bid.map((x) => x.q ?? 0),
          ask_p: offer.map((x) => dong(x.p)), ask_q: offer.map((x) => x.q ?? 0),
        }, 'depth');
      }
    } else if (kind === 'secdef') {
      Object.assign(q, { ref: num(m.basicPrice), ceil: num(m.ceilingPrice), floor: num(m.floorPrice) });
    }
    this.quotes.set(s, q); this.dirty.add(s);
    return kind;
  }

  /**
   * Một dòng băng lệnh. DNSE không gửi từng lệnh khớp mà gửi ảnh chụp gộp theo nhịp, nên:
   *  - match_qty là khối lượng DNSE báo cho lệnh khớp cuối (có thể đã bỏ sót các lệnh ở giữa),
   *  - vol_delta là chênh lệch khối lượng luỹ kế = khối lượng THẬT đã khớp từ bản tin trước tới giờ.
   * Thống kê dòng tiền phải dùng vol_delta. Bản tin đầu tiên của một mã trong phiên để vol_delta
   * rỗng, vì lúc đó luỹ kế đã là cả phiên — ghi vào sẽ thành một lệnh khổng lồ không có thật.
   */
  _ghiTick(s, m, q) {
    const price = dong(m.matchPrice);
    if (price == null) return;
    const vol = num(m.totalVolumeTraded);
    const truoc = this.volTruoc.get(s);
    // Luỹ kế tụt xuống nghĩa là sang phiên mới, DNSE đếm lại từ đầu
    const delta = truoc != null && vol != null && vol >= truoc ? vol - truoc : null;
    if (vol != null) this.volTruoc.set(s, vol);

    const bid1 = dong(q.bid?.[0]?.p), ask1 = dong(q.offer?.[0]?.p);
    // Khớp ở giá chào bán = bên mua chủ động trả giá; khớp ở giá chào mua = bên bán chủ động.
    // Nhưng biên độ ngày cao nhất ở Việt Nam là ±15% (UPCOM), nên giá lệch quá 40% so với sổ lệnh
    // chắc chắn là tin lỗi: vẫn ghi lại nguyên văn, nhưng không kết luận bên nào chủ động.
    const neo = bid1 ?? ask1;
    const tinDuoc = neo == null || Math.abs(price - neo) <= neo * 0.4;
    let side = '?';
    if (!tinDuoc) side = '?';
    else if (ask1 != null && price >= ask1) side = 'M';
    else if (bid1 != null && price <= bid1) side = 'B';

    const matchQty = num(m.matchQtty);
    if (matchQty != null) this.gop.tongMatch += matchQty;
    if (delta != null) this.gop.tongDelta += delta;

    this._them(this.tapeRows, {
      symbol: s, at: tsOf(m.time), price, match_qty: matchQty, vol_delta: delta,
      total_vol: vol, bid1, ask1, side,
    }, 'tape');
  }
  /**
   * Lấy bản ghi của một mã, tạo nếu chưa có, và bù mô tả mã (sàn, tên, ngành) khi còn thiếu.
   * Phải bù chứ không chỉ gán lúc tạo: sau khi nạp lại từ DB thì bản ghi đã tồn tại nhưng là dữ
   * liệu cũ chưa có các trường này, nên nhánh "tạo mới" không bao giờ chạy tới.
   */
  _lay(s) {
    let q = this.quotes.get(s);
    if (!q) { q = { symbol: s }; this.quotes.set(s, q); }
    if (!q.name) Object.assign(q, this.thongTin.get(s) || {});
    return q;
  }

  /**
   * Trần/sàn/tham chiếu của một mã, tính sẵn mỗi phiên một lần. Không đến từ WebSocket: kênh
   * security_definition đã bỏ vì cả phiên gửi 0 bản tin mà chiếm một phần ba hạn mức.
   */
  datTranSan(s, v) {
    Object.assign(this._lay(s), v);
    this.dirty.add(s);
  }

  /** Lấy các dòng đã đổi kể từ lần ghi trước. */
  drain() {
    const quotes = [...this.dirty].map((s) => ({ symbol: s, data: this.quotes.get(s), at: new Date().toISOString() }));
    const indices = [...this.dirtyIdx].map((n) => ({ name: n, data: this.indices.get(n), at: new Date().toISOString() }));
    this.dirty.clear(); this.dirtyIdx.clear();
    const tape = this.tapeRows; this.tapeRows = [];
    const depth = this.depthRows; this.depthRows = [];
    return { quotes, indices, tape, depth };
  }
}

export class MarketStream {
  constructor({ apiKey = process.env.DNSE_API_KEY, apiSecret = process.env.DNSE_API_SECRET, WS, db = rest, symbols, indices, tape = process.env.TAPE_OFF !== '1' } = {}) {
    this.roMa = symbols ?? tapeSymbols();
    this.db = db; this.state = new MarketState({ tape, thongTin: tapeInfo() }); this.timer = null; this.partTimer = null;
    this.tranSanTimer = null;
    this.lastFlush = null; this.flushErrors = 0; this.tapeErrors = 0;
    this.ghi = { tape: 0, depth: 0 };        // tổng số dòng lịch sử đã ghi được
    // Rổ lớn hơn 200 cặp phải chia cho nhiều kết nối, nếu không DNSE từ chối phần vượt
    const phan = shardChannels(this.roMa, indices ?? INDICES);
    this.socks = phan.map((ch, i) => new DnseSocket({
      name: phan.length > 1 ? `market${i + 1}` : 'market',
      apiKey, apiSecret, WS, channels: ch, onData: (m) => this.state.apply(m),
    }));
  }
  /** Kết nối đầu tiên, để mã cũ và test vẫn đọc được trạng thái. */
  get sock() { return this.socks[0]; }
  start() {
    for (const s of this.socks) s.start();
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
    // Phân vùng phải có sẵn TRƯỚC khi dữ liệu tới, nếu không mọi dòng rơi vào phân vùng hứng
    this.ensurePartitions();
    this.partTimer = setInterval(() => this.ensurePartitions(), 6 * 3600e3);
    // Nạp lại TRƯỚC khi tính trần/sàn: sau một lần khởi động lại, trạng thái trong bộ nhớ trống,
    // mà flush ghi đè nguyên cả object `data` của mã. Không nạp lại thì dòng trần/sàn đầu tiên sẽ
    // xoá mất giá đóng cửa đang lưu trong DB, và bảng giá ngoài phiên trống trơn.
    // Trần/sàn phải có TRƯỚC giờ mở cửa, nếu không bảng giá hiện mã mà không biết biên độ.
    this.napLai().then(() => this.napTranSan());
    this.tranSanTimer = setInterval(() => this.napTranSan(), 30 * 60e3);
  }
  stop() { clearInterval(this.timer); clearInterval(this.partTimer); clearInterval(this.tranSanTimer); for (const s of this.socks) s.stop(); }

  /** Dựng lại trạng thái giá từ DB sau khi khởi động lại. Không đánh dấu dirty: chưa có gì đổi. */
  async napLai() {
    try {
      const rows = await this.db('/market_quotes?select=symbol,data', { role: 'app_worker' });
      for (const r of rows || []) if (r.data) this.state.quotes.set(r.symbol, { ...r.data });
      // Bù mô tả mã (sàn, tên, ngành) cho bản ghi cũ và đánh dấu để lần ghi tới đẩy xuống DB.
      // Không làm ở đây thì mã chỉ có mô tả khi nó khớp lệnh lần đầu — ngoài phiên là không bao giờ.
      let bu = 0;
      for (const s of this.roMa) {
        if (this.state.quotes.get(s)?.name) continue;
        this.state._lay(s); this.state.dirty.add(s); bu++;
      }
      log(`nạp lại ${rows?.length || 0} mã giá từ DB${bu ? `, bù mô tả cho ${bu} mã` : ''}`);
    } catch (e) { log('không nạp lại được giá cũ từ DB:', e.message); }
  }

  /**
   * Tính tham chiếu/trần/sàn cho CẢ RỔ, mỗi phiên một lần, rồi ghi kèm vào trade.market_quotes.
   *
   * Vì sao worker làm việc này chứ không phải API: /api/market trước đây tính trần/sàn từ nến ngày,
   * mỗi mã một lượt gọi nguồn giá. Phục vụ 32 mã thì còn được, 150 mã thì mỗi lần bộ nhớ đệm nguội
   * là 150 lượt gọi cùng lúc — đúng thứ làm nguồn giá chặn IP Vercel ngày 19/10/2026. Worker chạy ở
   * nhà, gọi tuần tự, mỗi phiên một lần, nên nguồn giá chỉ thấy một dòng đều đặn.
   */
  async napTranSan() {
    const homNay = vnNow().ymd;
    let xong = 0, bo = 0, hong = 0;
    for (const s of this.roMa) {
      if (this.state.quotes.get(s)?.refDay === homNay) { bo++; continue; }
      try {
        const ref = refFromBars(await fetchBars(s, 6));
        if (ref == null) { hong++; continue; }
        const ex = this.state.thongTin.get(s)?.ex || 'HOSE';
        this.state.datTranSan(s, { ref, ...limits(ref, ex), refDay: homNay });
        xong++;
      } catch { hong++; }
    }
    if (xong || hong) log(`trần/sàn: ${xong} mã tính mới, ${bo} mã đã có, ${hong} mã chưa lấy được`);
    return { xong, bo, hong };
  }

  ensurePartitions() {
    return this.db('/rpc/ensure_tape_partitions', { role: 'app_worker', method: 'POST', body: { p_days: 7 } })
      .then((n) => { if (n) log(`đã tạo ${n} phân vùng mới cho bảng lịch sử`); })
      .catch((e) => log('không tạo được phân vùng:', e.message));
  }

  async flush() {
    const { quotes, indices, tape, depth } = this.state.drain();
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
    // Lịch sử ghi riêng: hỏng phần này thì giá vẫn phải chạy, và ngược lại
    try {
      if (tape.length) { await this.db('/tape', { role: 'app_worker', method: 'POST', prefer: 'return=minimal', body: tape }); this.ghi.tape += tape.length; }
      if (depth.length) { await this.db('/depth_log', { role: 'app_worker', method: 'POST', prefer: 'return=minimal', body: depth }); this.ghi.depth += depth.length; }
      this.tapeErrors = 0;
    } catch (e) {
      this.state.tapeRows.unshift(...tape); this.state.depthRows.unshift(...depth);
      for (const [arr, ten] of [[this.state.tapeRows, 'tape'], [this.state.depthRows, 'depth']]) {
        if (arr.length > MAX_BUFFER) { arr.splice(0, arr.length - MAX_BUFFER); this.state.bo[ten]++; }
      }
      if (this.tapeErrors++ % 30 === 0) log('không ghi được lịch sử băng lệnh:', e.message);
    }
    return { quotes: quotes.length, indices: indices.length, tape: tape.length, depth: depth.length };
  }
  report() {
    return this.db('/worker_status?on_conflict=name', {
      role: 'app_worker', method: 'POST', prefer: 'resolution=merge-duplicates',
      body: { name: 'market-stream', at: new Date().toISOString(), info: {
        sha: process.env.WORKER_SHA || null,
        // Nhiều kết nối: báo trạng thái xấu nhất, để một kết nối chết không bị che bởi các kết nối còn sống
        state: this.socks.map((s) => s.state).find((x) => x !== 'live') || 'live',
        ketNoi: this.socks.map((s) => s.state),
        // Có giá trị = đang thiếu mã dù kết nối vẫn sống. Phải xem ngay, vì dữ liệu mất là mất hẳn.
        loiDangKy: this.socks.map((s) => s.subError).filter(Boolean),
        reconnects: this.socks.reduce((n, s) => n + s.reconnects, 0),
        lastMsgAt: Math.max(...this.socks.map((s) => s.lastMsgAt || 0)) ? new Date(Math.max(...this.socks.map((s) => s.lastMsgAt || 0))).toISOString() : null,
        ...this.state.counts, symbols: this.state.quotes.size, indices: this.state.indices.size,
        // Số mã đã có trần/sàn của phiên hôm nay. Thiếu thì /api/market không phục vụ được mã đó.
        tranSan: [...this.state.quotes.values()].filter((q) => q.refDay === vnNow().ymd).length,
        roMa: this.roMa.length,
        lastFlush: this.lastFlush ? new Date(this.lastFlush).toISOString() : null,
        tape: this.ghi.tape, depthRows: this.ghi.depth,
        choGhi: this.state.tapeRows.length + this.state.depthRows.length, boDong: this.state.bo,
        // Mức gộp tin của DNSE: khối lượng thật / khối lượng được báo ở lệnh khớp cuối.
        // Bằng 1 nghĩa là nhận đủ từng lệnh; càng lớn càng nhiều lệnh bị gộp vào một bản tin.
        mucGop: this.state.gop.tongMatch ? +(this.state.gop.tongDelta / this.state.gop.tongMatch).toFixed(2) : null,
      } },
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
