/**
 * api/_portfolio.js — chuẩn hóa danh mục từ DNSE, cơ cấu, rủi ro và hiệu suất. Hàm thuần, không gọi DB.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Đơn vị: mọi giá trị tiền trong file này là ĐỒNG (không phải nghìn đồng như bảng giá).
 *
 * Hai loại hiệu suất, luôn ghi rõ cho người xem:
 *   - "Danh mục hiện tại trong quá khứ": giữ nguyên số cổ phiếu và tiền đang có, xem giá trị thay đổi thế nào trong N phiên
 *     vừa qua. Có ngay từ ngày đầu, nhưng là giả định (khách có thể đã mua bán trong khoảng đó).
 *   - "Hiệu suất thực tế": nối các ảnh chụp danh mục cuối ngày (trade.portfolio_snapshots), mỗi ngày tính lãi/lỗ trên số cổ
 *     phiếu nắm giữ cuối ngày hôm trước. Cách tính theo cổ phiếu nắm giữ nên nạp/rút tiền không làm sai lợi suất.
 * Giá lịch sử là giá đóng cửa chưa điều chỉnh: phiên giá giảm/tăng vượt biên độ sàn (chỉ có thể do chia cổ tức bằng
 * cổ phiếu, phát hành thêm, tách cổ phiếu) được tự điều chỉnh; cổ tức tiền mặt nhỏ thì không phát hiện được.
 */
import { BY_SYMBOL, fetchBars, cached, vnNow } from './_market.js';

/** Số 1 chữ số thập phân, dấu phẩy kiểu Việt Nam (12,5) cho câu chữ hiển thị. */
const vi1 = (v) => v.toFixed(1).replace('.', ',');
const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
/** DNSE có thể trả giá theo đồng hoặc nghìn đồng: quy về đồng. */
export const toVnd = (v) => { const n = num(v); return n == null ? null : n >= 1000 ? n : n * 1000; };

export const RISK_LEVELS = ['conservative', 'balanced', 'growth', 'aggressive'];
export const RISK_LABEL = { conservative: 'Thận trọng', balanced: 'Cân bằng', growth: 'Tăng trưởng', aggressive: 'Mạo hiểm' };

function listOf(v, keys) {
  if (Array.isArray(v)) return v;
  for (const k of keys) if (Array.isArray(v?.[k])) return v[k];
  return [];
}

/**
 * Gộp số dư + danh mục DNSE thành một dạng thống nhất.
 * @returns {{ holdings: {symbol, qty, sellable, sellableKnown, cost, price}[], cash, debt, stockValue, nav, warnings: string[] }}
 */
export function normalizeAccount({ balance, positions }) {
  const warnings = [];
  const st = balance?.stock || balance || {};
  const cash = num(st.totalCash) ?? num(st.cash) ?? num(st.availableCash) ?? 0;
  const debt = num(st.totalDebt) ?? num(st.debt) ?? 0;
  const bySym = new Map();
  for (const p of listOf(positions, ['deals', 'positions', 'data'])) {
    if ((p.status || 'OPEN') !== 'OPEN') continue;
    const symbol = String(p.symbol || '').toUpperCase();
    const qty = num(p.openQuantity ?? p.accumulateQuantity ?? p.quantity ?? p.totalQuantity) || 0;
    if (!/^[A-Z0-9]{3,10}$/.test(symbol) || qty <= 0) continue;
    const sellRaw = num(p.tradeQuantity ?? p.availableQuantity ?? p.sellableQuantity);
    const h = bySym.get(symbol) || { symbol, qty: 0, sellable: 0, sellableKnown: true, costValue: 0, price: null };
    h.qty += qty;
    if (sellRaw == null) h.sellableKnown = false;
    h.sellable += sellRaw == null ? qty : Math.min(sellRaw, qty);
    const cost = toVnd(p.costPrice ?? p.breakEvenPrice ?? p.avgPrice);
    if (cost != null) h.costValue += cost * qty;
    h.price = toVnd(p.marketPrice ?? p.lastPrice) ?? h.price;
    bySym.set(symbol, h);
  }
  const holdings = [...bySym.values()].map(({ costValue, ...h }) => ({ ...h, cost: h.qty && costValue ? Math.round(costValue / h.qty) : null }));
  if (holdings.some((h) => !h.sellableKnown)) warnings.push('DNSE không trả số lượng được bán ngay; tạm coi toàn bộ cổ phiếu đều bán được (cổ phiếu chờ về T+2 sẽ bị từ chối khi gửi lệnh).');
  const stockValue = holdings.reduce((a, h) => a + (h.price || 0) * h.qty, 0);
  return { holdings, cash, debt, stockValue, nav: stockValue + cash - debt, warnings };
}

/** Cơ cấu và cảnh báo rủi ro theo tỷ trọng trên tài sản ròng. */
export function composition({ holdings, cash, debt, nav }) {
  const rows = holdings.map((h) => {
    const value = (h.price || 0) * h.qty;
    const info = BY_SYMBOL[h.symbol];
    return {
      symbol: h.symbol, qty: h.qty, price: h.price, cost: h.cost, value,
      weight: nav > 0 ? (value / nav) * 100 : null,
      pnl: h.cost && h.price ? (h.price - h.cost) * h.qty : null,
      pnlPct: h.cost && h.price ? (h.price / h.cost - 1) * 100 : null,
      sector: info?.sector || 'Khác',
    };
  }).sort((a, b) => b.value - a.value);
  const sectors = {};
  for (const r of rows) sectors[r.sector] = (sectors[r.sector] || 0) + (r.weight || 0);
  const sectorList = Object.entries(sectors).map(([sector, weight]) => ({ sector, weight })).sort((a, b) => b.weight - a.weight);
  const w = rows.map((r) => (r.weight || 0) / 100);
  const hhi = w.reduce((a, x) => a + x * x, 0);
  const flags = [];
  const top = rows[0];
  if (top && top.weight > 25) flags.push({ level: top.weight > 40 ? 'high' : 'medium', text: `${top.symbol} chiếm ${vi1(top.weight)}% tài sản ròng (tập trung vào một mã).` });
  const topSector = sectorList.find((s) => s.sector !== 'Khác');
  if (topSector && topSector.weight > 40) flags.push({ level: 'medium', text: `Ngành ${topSector.sector} chiếm ${vi1(topSector.weight)}% tài sản ròng.` });
  if (nav > 0 && debt > 0) {
    const lev = (debt / nav) * 100;
    flags.push({ level: lev > 50 ? 'high' : lev > 20 ? 'medium' : 'low', text: `Đang dùng ký quỹ: dư nợ bằng ${vi1(lev)}% tài sản ròng.` });
  }
  if (nav > 0 && cash / nav > 0.5) flags.push({ level: 'low', text: `Tiền mặt chiếm ${vi1(((cash / nav) * 100))}% tài sản ròng.` });
  if (rows.some((r) => r.qty % 100)) flags.push({ level: 'low', text: 'Có cổ phiếu lô lẻ (dưới 100): phần lẻ không bán được trên bảng thường.' });
  return {
    rows, sectors: sectorList,
    cashWeight: nav > 0 ? (cash / nav) * 100 : null,
    debtWeight: nav > 0 ? (debt / nav) * 100 : null,
    effectiveN: hhi > 0 ? 1 / hhi : 0,
    flags,
  };
}

// ---------- Giá lịch sử ----------
const BAND = { HOSE: 0.07, HNX: 0.10, UPCOM: 0.15 };
const day = (t) => vnNow(t * 1000).ymd;

/**
 * Điều chỉnh các bước nhảy giá không thể xảy ra trong biên độ (quyền, chia tách): nhân lùi các phiên trước theo tỷ lệ.
 * @param {{d:string,c:number}[]} s  giá đóng cửa theo ngày, tăng dần
 */
export function adjustGaps(s, ex) {
  const lim = (BAND[ex] ?? 0.15) + 0.015;
  const out = s.map((x) => ({ ...x }));
  const events = [];
  for (let i = out.length - 1; i > 0; i--) {
    const r = out[i].c / out[i - 1].c - 1;
    if (Math.abs(r) > lim) {
      const k = out[i].c / out[i - 1].c;
      for (let j = 0; j < i; j++) out[j].c *= k;
      events.push({ d: out[i].d, ratio: k });
    }
  }
  return { series: out, events };
}

/** Giá đóng cửa (đồng) theo ngày cho các mã + VNINDEX (điểm). Cache 30 phút. */
export async function loadHistory(symbols, days = 260) {
  const uniq = [...new Set(symbols)];
  const get = (s, kind) => cached(`hist:${kind}:${s}:${days}`, 30 * 60e3, () => fetchBars(s, days, '1D', kind));
  const [bench, ...lists] = await Promise.all([get('VNINDEX', 'index'), ...uniq.map((s) => get(s, 'stock').catch(() => []))]);
  const prices = {}, adjustments = {};
  uniq.forEach((s, i) => {
    const raw = lists[i].map((b) => ({ d: day(b.t), c: b.c * 1000 }));
    const { series, events } = adjustGaps(raw, BY_SYMBOL[s]?.ex);
    prices[s] = series;
    if (events.length) adjustments[s] = events;
  });
  return { prices, bench: bench.map((b) => ({ d: day(b.t), c: b.c })), adjustments };
}

/** Dàn các chuỗi giá về chung một trục ngày (ngày có VNINDEX), lấp ngày thiếu bằng giá gần nhất trước đó. */
export function align(prices, bench) {
  const dates = bench.map((b) => b.d);
  const grid = {};
  for (const [s, series] of Object.entries(prices)) {
    const m = new Map(series.map((x) => [x.d, x.c]));
    let last = null, firstIdx = -1;
    grid[s] = dates.map((d, i) => { if (m.has(d)) { last = m.get(d); if (firstIdx < 0) firstIdx = i; } return last; });
  }
  return { dates, grid, bench: bench.map((b) => b.c) };
}

// ---------- Thống kê ----------
const WINDOWS = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 250]];

export function stats(values, benchValues, dates) {
  const n = values.length;
  const rets = [], bRets = [];
  for (let i = 1; i < n; i++) {
    if (values[i - 1] > 0 && benchValues[i - 1] > 0) { rets.push(values[i] / values[i - 1] - 1); bRets.push(benchValues[i] / benchValues[i - 1] - 1); }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const mr = mean(rets), mb = mean(bRets);
  const variance = rets.reduce((a, r) => a + (r - mr) ** 2, 0) / Math.max(1, rets.length - 1);
  const bVar = bRets.reduce((a, r) => a + (r - mb) ** 2, 0) / Math.max(1, bRets.length - 1);
  const cov = rets.reduce((a, r, i) => a + (r - mr) * (bRets[i] - mb), 0) / Math.max(1, rets.length - 1);
  let peak = -Infinity, mdd = 0;
  for (const v of values) { peak = Math.max(peak, v); if (peak > 0) mdd = Math.min(mdd, v / peak - 1); }
  const windows = {};
  for (const [k, len] of WINDOWS) {
    if (n > len) windows[k] = { ret: (values[n - 1] / values[n - 1 - len] - 1) * 100, bench: (benchValues[n - 1] / benchValues[n - 1 - len] - 1) * 100 };
  }
  const ytdStart = dates.findIndex((d) => d.slice(0, 4) === dates[n - 1]?.slice(0, 4));
  if (ytdStart > 0) windows.YTD = { ret: (values[n - 1] / values[ytdStart - 1] - 1) * 100, bench: (benchValues[n - 1] / benchValues[ytdStart - 1] - 1) * 100 };
  return {
    from: dates[0], to: dates[n - 1], sessions: n,
    total: n > 1 ? (values[n - 1] / values[0] - 1) * 100 : 0,
    benchTotal: n > 1 ? (benchValues[n - 1] / benchValues[0] - 1) * 100 : 0,
    volatility: rets.length > 5 ? Math.sqrt(variance * 250) * 100 : null,
    maxDrawdown: mdd * 100,
    beta: bVar > 0 && rets.length > 20 ? cov / bVar : null,
    windows,
  };
}

/** Chuỗi giá trị khi giữ nguyên số cổ phiếu + tiền hiện có. */
export function holdBacktest({ holdings, cash, debt }, hist) {
  const { dates, grid, bench } = align(hist.prices, hist.bench);
  const missing = holdings.filter((h) => !grid[h.symbol]?.some((x) => x != null)).map((h) => h.symbol);
  const values = dates.map((_, i) => holdings.reduce((a, h) => {
    const p = grid[h.symbol]?.[i] ?? grid[h.symbol]?.find((x) => x != null);   // trước ngày niêm yết: coi như giá đầu tiên
    return a + (p ?? h.price ?? 0) * h.qty;
  }, cash - debt));
  return { dates, values, bench, missing };
}

/** Chuỗi giá trị của danh mục mẫu theo tỷ trọng (tái cân bằng một lần ở đầu kỳ, sau đó giữ nguyên số cổ phiếu). */
export function weightsBacktest(weights, cashPct, hist, base = 1e9) {
  const { dates, grid, bench } = align(hist.prices, hist.bench);
  const units = {};
  for (const [s, w] of Object.entries(weights)) {
    const i0 = grid[s]?.findIndex((x) => x != null) ?? -1;
    units[s] = i0 >= 0 ? (base * w / 100) / grid[s][i0] : 0;
  }
  const cash = base * (cashPct / 100);
  const values = dates.map((_, i) => Object.entries(units).reduce((a, [s, u]) => a + u * (grid[s][i] ?? grid[s].find((x) => x != null) ?? 0), cash));
  return { dates, values, bench };
}

/**
 * Hiệu suất thực tế từ ảnh chụp cuối ngày. Ngày d: lãi/lỗ = Σ số CP cuối phiên trước × (giá d − giá phiên trước),
 * chia cho tài sản ròng cuối phiên trước. Tiền mặt không sinh lãi trong phép tính này.
 * @param {{day:string, nav:number, cash:number, debt:number, positions:{symbol,qty}[]}[]} snaps  tăng dần theo ngày
 */
export function realizedSeries(snaps, hist) {
  if (snaps.length < 2) return null;
  const { dates, grid, bench } = align(hist.prices, hist.bench);
  const start = dates.indexOf(snaps[0].day);
  if (start < 0) return null;
  let si = 0, value = 100, benchBase = bench[start];
  const out = { dates: [dates[start]], values: [100], bench: [100] };
  for (let i = start + 1; i < dates.length; i++) {
    while (si + 1 < snaps.length && snaps[si + 1].day < dates[i]) si++;
    const s = snaps[si];
    const navPrev = s.positions.reduce((a, p) => a + (grid[p.symbol]?.[i - 1] ?? p.price ?? 0) * p.qty, (+s.cash || 0) - (+s.debt || 0));
    const pnl = s.positions.reduce((a, p) => a + ((grid[p.symbol]?.[i] ?? p.price ?? 0) - (grid[p.symbol]?.[i - 1] ?? p.price ?? 0)) * p.qty, 0);
    if (navPrev > 0) value *= 1 + pnl / navPrev;
    out.dates.push(dates[i]); out.values.push(value); out.bench.push((bench[i] / benchBase) * 100);
  }
  return out;
}

/** Thu gọn chuỗi để vẽ (tối đa n điểm), chuẩn hóa về 100 ở đầu kỳ. */
export function chartSeries({ dates, values, bench }, n = 120) {
  const step = Math.max(1, Math.ceil(dates.length / n));
  const v0 = values[0] || 1, b0 = bench[0] || 1;
  const pts = [];
  for (let i = 0; i < dates.length; i += step) pts.push([dates[i], +(values[i] / v0 * 100).toFixed(2), +(bench[i] / b0 * 100).toFixed(2)]);
  const last = dates.length - 1;
  if (pts[pts.length - 1]?.[0] !== dates[last]) pts.push([dates[last], +(values[last] / v0 * 100).toFixed(2), +(bench[last] / b0 * 100).toFixed(2)]);
  return pts;
}
