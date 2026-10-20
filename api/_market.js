/**
 * api/_market.js — Nguồn giá thật (DNSE Entrade chart-api, công khai) + luật bước giá/biên độ.
 * Underscore prefix => Vercel không expose thành route.
 * Đơn vị giá: nghìn đồng (20.1 = 20.100 đ), như nguồn trả về.
 */

/**
 * Danh mục hỗ trợ: rổ VN30 (nguồn: DNSE, 12/10/2026, cập nhật khi quỹ cơ cấu lại rổ) + mã đang theo dõi.
 * sector là nhóm ngành tham khảo để gom nhóm trên bảng giá, không phải phân loại chính thức.
 * watch = có trong danh sách theo dõi mặc định bên trái màn giao dịch.
 */
export const UNIVERSE = [
  { s: 'ACB', ex: 'HOSE', name: 'Ngân hàng Á Châu', sector: 'Ngân hàng', vn30: true },
  { s: 'BID', ex: 'HOSE', name: 'Ngân hàng BIDV', sector: 'Ngân hàng', vn30: true },
  { s: 'CTG', ex: 'HOSE', name: 'Ngân hàng VietinBank', sector: 'Ngân hàng', vn30: true },
  { s: 'HDB', ex: 'HOSE', name: 'Ngân hàng HDBank', sector: 'Ngân hàng', vn30: true },
  { s: 'LPB', ex: 'HOSE', name: 'Ngân hàng LPBank', sector: 'Ngân hàng', vn30: true },
  { s: 'MBB', ex: 'HOSE', name: 'Ngân hàng MB', sector: 'Ngân hàng', vn30: true },
  { s: 'SHB', ex: 'HOSE', name: 'Ngân hàng SHB', sector: 'Ngân hàng', vn30: true },
  { s: 'SSB', ex: 'HOSE', name: 'Ngân hàng SeABank', sector: 'Ngân hàng', vn30: true },
  { s: 'STB', ex: 'HOSE', name: 'Ngân hàng Sacombank', sector: 'Ngân hàng', vn30: true },
  { s: 'TCB', ex: 'HOSE', name: 'Ngân hàng Techcombank', sector: 'Ngân hàng', vn30: true, watch: true },
  { s: 'VCB', ex: 'HOSE', name: 'Ngân hàng Vietcombank', sector: 'Ngân hàng', vn30: true, watch: true },
  { s: 'VIB', ex: 'HOSE', name: 'Ngân hàng VIB', sector: 'Ngân hàng', vn30: true },
  { s: 'VPB', ex: 'HOSE', name: 'Ngân hàng VPBank', sector: 'Ngân hàng', vn30: true },
  { s: 'SSI', ex: 'HOSE', name: 'Chứng khoán SSI', sector: 'Chứng khoán', vn30: true, watch: true },
  { s: 'TCX', ex: 'HOSE', name: 'Chứng khoán Techcom', sector: 'Chứng khoán', vn30: true },
  { s: 'VHM', ex: 'HOSE', name: 'Vinhomes', sector: 'Bất động sản', vn30: true, watch: true },
  { s: 'VIC', ex: 'HOSE', name: 'Vingroup', sector: 'Bất động sản', vn30: true },
  { s: 'VRE', ex: 'HOSE', name: 'Vincom Retail', sector: 'Bất động sản', vn30: true },
  { s: 'BSR', ex: 'HOSE', name: 'Lọc hóa dầu Bình Sơn', sector: 'Dầu khí & năng lượng', vn30: true, watch: true },
  { s: 'GAS', ex: 'HOSE', name: 'PV GAS', sector: 'Dầu khí & năng lượng', vn30: true },
  { s: 'HPG', ex: 'HOSE', name: 'Tập đoàn Hòa Phát', sector: 'Thép & vật liệu', vn30: true, watch: true },
  { s: 'FPT', ex: 'HOSE', name: 'Công ty CP FPT', sector: 'Công nghệ', vn30: true, watch: true },
  { s: 'MWG', ex: 'HOSE', name: 'Thế Giới Di Động', sector: 'Tiêu dùng & bán lẻ', vn30: true, watch: true },
  { s: 'MSN', ex: 'HOSE', name: 'Masan Group', sector: 'Tiêu dùng & bán lẻ', vn30: true },
  { s: 'MCH', ex: 'HOSE', name: 'Masan Consumer', sector: 'Tiêu dùng & bán lẻ', vn30: true },
  { s: 'SAB', ex: 'HOSE', name: 'Sabeco', sector: 'Tiêu dùng & bán lẻ', vn30: true },
  { s: 'VNM', ex: 'HOSE', name: 'Vinamilk', sector: 'Tiêu dùng & bán lẻ', vn30: true },
  { s: 'VJC', ex: 'HOSE', name: 'Vietjet', sector: 'Hàng không & du lịch', vn30: true },
  { s: 'VPL', ex: 'HOSE', name: 'Vinpearl', sector: 'Hàng không & du lịch', vn30: true },
  { s: 'GVR', ex: 'HOSE', name: 'Tập đoàn Cao su Việt Nam', sector: 'Cao su & KCN', vn30: true },
  { s: 'DGC', ex: 'HOSE', name: 'Hóa chất Đức Giang', sector: 'Hóa chất', watch: true },
  { s: 'PVS', ex: 'HNX', name: 'Dịch vụ Kỹ thuật Dầu khí', sector: 'Dầu khí & năng lượng', watch: true },
];
export const BY_SYMBOL = Object.fromEntries(UNIVERSE.map((x) => [x.s, x]));

const BAND = { HOSE: 0.07, HNX: 0.10, UPCOM: 0.15 };
export const INDICES = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];

/**
 * Nguồn nến. Mặc định gọi thẳng Entrade — đúng cho worker và mọi thứ chạy ở máy nhà (IP Việt Nam).
 *
 * Trên Vercel phải đặt PRICE_FEED_URL trỏ về `/feed` của local-proxy ở nhà. Entrade chỉ phục vụ IP
 * trong nước: 19/10/2026 Vercel (sin1) gọi thẳng thì treo tới hết giờ chờ, /api/market và /api/history
 * trả 502 suốt, trong khi máy nhà gọi 32 mã xong trong 237ms. Xem docs/DEPLOY.md.
 */
const FEED_DIRECT = 'https://services.entrade.com.vn/chart-api/v2/ohlcs';
const feedBase = () => (process.env.PRICE_FEED_URL || FEED_DIRECT).replace(/\/+$/, '');
const feedHeaders = () => (process.env.PRICE_FEED_KEY
  ? { Accept: 'application/json', 'x-feed-key': process.env.PRICE_FEED_KEY, 'ngrok-skip-browser-warning': '1' }
  : { Accept: 'application/json' });

/**
 * Trần số request đang bay tới nguồn giá, và ngắt mạch khi nguồn hỏng.
 *
 * Một lần khởi động nguội của serverless là bộ nhớ đệm trống, nên request đầu tiên vào /api/market
 * bắn 32 cuộc gọi cùng lúc. Đó nhiều khả năng là thứ làm Entrade chặn IP Vercel ngày 19/10/2026:
 * log cho thấy vài request ngay lúc deploy còn 200, sau đó 502 liên tục. Xếp hàng thì nguồn giá chỉ
 * thấy một dòng đều đặn thay vì một cú dồn.
 *
 * Ngắt mạch để hỏng cho nhanh: nguồn giá chết thì mỗi lần gọi treo đủ 8 giây rồi mới bỏ, 32 mã xếp
 * hàng sẽ vượt hạn chạy của function. Sau MAX_HONG lần hỏng liên tiếp thì từ chối ngay trong NGHI_MS,
 * đủ để API rơi về dữ liệu WebSocket trong DB thay vì đứng chờ.
 *
 * CHỈ lỗi `nguonHong` mới tính vào ngắt mạch, tức là nguồn không trả lời (đứt mạng, hết giờ chờ, 5xx).
 * Nguồn trả 400 vì mã không tồn tại thì nó vẫn sống — tra vài mã sai liên tiếp không được phép làm
 * sập bảng giá của cả site trong 30 giây.
 */
const MAX_SONG_SONG = 6;
const MAX_HONG = 5;
const NGHI_MS = 30_000;
let dangChay = 0, hongLienTiep = 0, moLai = 0;
const hangDoi = [];

async function khe(fn) {
  if (hongLienTiep >= MAX_HONG && Date.now() < moLai) throw new Error('nguồn giá đang tạm ngắt mạch');
  if (dangChay >= MAX_SONG_SONG) await new Promise((r) => hangDoi.push(r));
  dangChay++;
  try {
    const v = await fn();
    hongLienTiep = 0;
    return v;
  } catch (e) {
    if (!e?.nguonHong) hongLienTiep = 0;                             // nguồn vẫn trả lời
    else if (++hongLienTiep >= MAX_HONG) moLai = Date.now() + NGHI_MS;
    throw e;
  } finally {
    dangChay--;
    hangDoi.shift()?.();
  }
}

// Giá làm việc theo đơn vị 10 đồng (số nguyên) để không lệch số thực.
const U = (p) => Math.round(p * 100);
const P = (u) => u / 100;
export const tickU = (u, ex) => (ex !== 'HOSE' ? 10 : u < 1000 ? 1 : u < 5000 ? 5 : 10);

/**
 * Giá tham chiếu = giá đóng cửa của phiên GẦN NHẤT TRƯỚC HÔM NAY. Nến của hôm nay không phải tham
 * chiếu, kể cả khi phiên đã chạy. Tách riêng khỏi quoteFromBars để worker tính sẵn trần/sàn cho cả
 * rổ 150 mã rồi ghi vào trade.market_quotes — nhờ vậy /api/market phục vụ được cả rổ mà không phải
 * gọi nguồn nến một lượt cho mỗi mã.
 */
export function refFromBars(daily, ts = Date.now()) {
  const today = vnNow(ts).ymd;
  const past = (daily || []).filter((b) => vnNow(b.t * 1000).ymd !== today);
  return past.length ? past[past.length - 1].c : null;
}

/**
 * Trần/sàn theo biên độ của sàn, làm tròn về bước giá sao cho luôn nằm TRONG biên.
 *
 * Hai chỗ trước đây làm sai, test bắt được và đã đối chiếu với secdef thật của DNSE:
 *  - Bước giá phải lấy theo mức giá KẾT QUẢ, không theo tham chiếu. Tham chiếu nằm sát mốc đổi
 *    bước (10.000đ, 50.000đ) thì trần hoặc sàn rơi sang khoảng bước khác.
 *  - Không được làm tròn trước rồi mới cắt về bước giá: làm tròn đã đẩy giá ra khỏi biên.
 * Ví dụ SHB tham chiếu 10.550đ: DNSE cho sàn 9.820đ; cách cũ ra 9.850đ (bước 50đ của 10.550 thay
 * vì bước 10đ của 9.820), tức bàn giao dịch thử sẽ từ chối một mức giá hợp lệ.
 */
export function limits(ref, ex) {
  const refU = U(ref);
  const tron = (raw, xuong) => {
    const t = tickU(Math.floor(raw), ex);
    return P(xuong ? Math.floor(raw / t) * t : Math.ceil(raw / t) * t);
  };
  return { ceil: tron(refU * (1 + BAND[ex]), true), floor: tron(refU * (1 - BAND[ex]), false) };
}

/** Giờ Việt Nam (UTC+7) dạng { ymd, dow, min }. */
export function vnNow(ts = Date.now()) {
  const d = new Date(ts + 7 * 3600e3);
  return { ymd: d.toISOString().slice(0, 10), dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function sessionState(ts = Date.now()) {
  const { dow, min } = vnNow(ts);
  if (dow === 0 || dow === 6) return 'closed';
  if (min >= 540 && min < 555) return 'ato';   // 9:00–9:15 khớp định kỳ mở cửa
  if (min >= 555 && min < 690) return 'open';  // đến 11:30
  if (min >= 780 && min < 870) return 'open';  // 13:00–14:30
  if (min >= 870 && min < 885) return 'atc';   // 14:30–14:45 khớp định kỳ đóng cửa
  return 'closed';
}

/** Nến thô theo khoảng thời gian (giây epoch). resolution: '1' (phút), '1D' (ngày). */
export async function fetchRange(symbol, from, to, resolution = '1D', kind = 'stock') {
  const url = `${feedBase()}/${kind}?from=${Math.floor(from)}&to=${Math.floor(to)}&symbol=${symbol}&resolution=${resolution}`;
  // Giờ chờ bắt đầu khi request thật sự đi, không tính lúc còn xếp hàng
  return khe(async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      let r;
      try {
        r = await fetch(url, { signal: ctl.signal, headers: feedHeaders() });
      } catch (e) {
        // Đứt mạng hoặc hết giờ chờ: nguồn không trả lời. Đây mới là thứ đáng ngắt mạch.
        throw Object.assign(new Error(`feed ${symbol} không trả lời (${e?.name === 'AbortError' ? 'quá 8s' : e?.name || 'lỗi mạng'})`), { nguonHong: true });
      }
      // 5xx là hỏng phía nguồn; 4xx thường chỉ là mã không tồn tại, nguồn vẫn sống
      if (r.status >= 500) throw Object.assign(new Error(`feed ${symbol} HTTP ${r.status}`), { nguonHong: true });
      if (!r.ok) throw new Error(`feed ${symbol} HTTP ${r.status}`);
      const j = await r.json();
      const n = Array.isArray(j.t) ? j.t.length : 0;
      const bars = [];
      for (let i = 0; i < n; i++) {
        if ([j.o[i], j.h[i], j.l[i], j.c[i]].some((x) => !Number.isFinite(x))) continue;
        bars.push({ t: j.t[i], o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] || 0 });
      }
      return bars;
    } finally {
      clearTimeout(timer);
    }
  });
}

/** `days` nến gần nhất (mặc định nến ngày). */
export async function fetchBars(symbol, days, resolution = '1D', kind = 'stock') {
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.ceil(days * 1.6 + 7) * 86400; // dư để bù cuối tuần/lễ
  return (await fetchRange(symbol, from, to, resolution, kind)).slice(-days);
}

/** Bộ nhớ đệm ngắn trong tiến trình: tránh gọi lại nguồn giá cho dữ liệu ít đổi (nến ngày). */
const memo = new Map();
export async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/** Mốc 9h00 (giờ VN) của ngày hôm nay theo giây epoch: cùng quy ước với trường t của nến ngày (02:00 UTC). */
export function todayBarTime(ts = Date.now()) {
  return Date.parse(vnNow(ts).ymd + 'T09:00:00+07:00') / 1000;
}

/**
 * Nến của HÔM NAY dựng từ nến 1 phút. Endpoint nến ngày của nguồn giá chưa có nến hôm nay trong lúc phiên chạy,
 * nên không dùng nó cho giá trong phiên. Trả null nếu hôm nay chưa có giao dịch (trước giờ mở cửa, cuối tuần, nghỉ lễ).
 */
export async function liveBar(symbol, kind = 'stock') {
  const now = Math.floor(Date.now() / 1000);
  const from = Date.parse(vnNow().ymd + 'T00:00:00+07:00') / 1000;
  const m = await fetchRange(symbol, from, now, '1', kind);
  if (!m.length) return null;
  return {
    t: todayBarTime(), o: m[0].o,
    h: Math.max(...m.map((b) => b.h)), l: Math.min(...m.map((b) => b.l)),
    c: m[m.length - 1].c, v: m.reduce((a, b) => a + (b.v || 0), 0),
    asof: m[m.length - 1].t,
  };
}

/**
 * Báo giá. daily = nến ngày; live = nến hôm nay từ nến 1 phút (nếu có).
 * Có live: tham chiếu = đóng cửa phiên liền trước, giá hiện tại = giá khớp gần nhất.
 * Không có live (ngoài giờ): tham chiếu = đóng cửa phiên gần nhất, thay đổi 0%.
 */
const meta = (i) => ({ s: i.s, ex: i.ex, name: i.name, sector: i.sector, vn30: !!i.vn30, watch: !!i.watch });

export function quoteFromBars(info, daily, live = null) {
  const today = vnNow().ymd;
  const past = daily.filter((b) => vnNow(b.t * 1000).ymd !== today);
  const dailyToday = daily.find((b) => vnNow(b.t * 1000).ymd === today) || null;
  const bar = live || dailyToday;
  if (bar && past.length) {
    const ref = past[past.length - 1].c;
    const { ceil, floor } = limits(ref, info.ex);
    return { ...meta(info), ref, ceil, floor, last: bar.c, open: bar.o, high: bar.h, low: bar.l, vol: bar.v, lastSession: today, asof: bar.asof || null };
  }
  const last = past[past.length - 1];
  if (!last) return null;
  const { ceil, floor } = limits(last.c, info.ex);
  return { ...meta(info), ref: last.c, ceil, floor, last: last.c, open: last.c, high: last.c, low: last.c, vol: 0, lastSession: vnNow(last.t * 1000).ymd, asof: null };
}

/** Chỉ số: so với đóng cửa phiên liền trước. Trong phiên dùng điểm của nến 1 phút mới nhất. */
export function indexFromBars(symbol, daily, live = null) {
  const today = vnNow().ymd;
  const past = daily.filter((b) => vnNow(b.t * 1000).ymd !== today);
  if (live && past.length) {
    const ref = past[past.length - 1].c;
    return { s: symbol, last: live.c, ref, pct: (live.c / ref - 1) * 100 };
  }
  if (past.length < 2) return null;
  const last = past[past.length - 1], ref = past[past.length - 2].c;
  return { s: symbol, last: last.c, ref, pct: (last.c / ref - 1) * 100 };
}
