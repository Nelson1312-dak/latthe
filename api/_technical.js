/**
 * api/_technical.js — chỉ báo kỹ thuật từ nến ngày, kiểm tra tham số khuyến nghị, chấm kết quả khuyến nghị. Hàm thuần.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Đơn vị giá: nghìn đồng (như bảng giá và như môi giới nhập khuyến nghị). Nến: { t (giây), o, h, l, c, v }.
 */
import { vnNow } from './_market.js';

const BAND = { HOSE: 0.07, HNX: 0.10, UPCOM: 0.15 };
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const vi1 = (v) => Math.abs(v).toFixed(1).replace('.', ',');
const day = (t) => vnNow(t * 1000).ymd;

/** Điều chỉnh bước nhảy ngoài biên độ (quyền, chia tách) cho cả nến O/H/L/C, nhân lùi các phiên trước. */
export function adjustBars(bars, ex) {
  const lim = (BAND[ex] ?? 0.15) + 0.015;
  const out = bars.map((b) => ({ ...b }));
  for (let i = out.length - 1; i > 0; i--) {
    const k = out[i].c / out[i - 1].c;
    if (Math.abs(k - 1) > lim) for (let j = 0; j < i; j++) { out[j].o *= k; out[j].h *= k; out[j].l *= k; out[j].c *= k; }
  }
  return out;
}

const sma = (a, n) => (a.length >= n ? a.slice(-n).reduce((x, y) => x + y, 0) / n : null);

/** RSI 14 kiểu Wilder. */
export function rsi(closes, n = 14) {
  if (closes.length <= n) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}

/** ATR 14 (Wilder) theo % giá hiện tại. */
export function atrPct(bars, n = 14) {
  if (bars.length <= n) return null;
  const tr = bars.slice(1).map((b, i) => Math.max(b.h - b.l, Math.abs(b.h - bars[i].c), Math.abs(b.l - bars[i].c)));
  let a = tr.slice(0, n).reduce((x, y) => x + y, 0) / n;
  for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n;
  return (a / bars[bars.length - 1].c) * 100;
}

const WIN = [['1W', 5], ['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 250]];
const vsText = (d) => (Math.abs(d) < 0.3 ? 'ngang VN-Index' : `${d > 0 ? 'tốt hơn' : 'kém hơn'} VN-Index ${vi1(d)} điểm %`);

/**
 * Dữ kiện kỹ thuật của một mã (đã làm tròn, có câu so sánh viết sẵn để model nhỏ không đảo dấu).
 * @param {Array} bars  nến ngày của mã, tăng dần
 * @param {Array} bench nến ngày VN-Index, tăng dần
 */
export function technicals(rawBars, bench = [], ex) {
  const bars = adjustBars(rawBars, ex);
  if (bars.length < 25) return null;
  const c = bars.map((b) => b.c), last = c[c.length - 1];
  const bByDay = new Map(bench.map((b) => [day(b.t), b.c]));
  const windows = {};
  for (const [k, n] of WIN) {
    if (bars.length <= n) continue;
    const ret = (last / c[c.length - 1 - n] - 1) * 100;
    const b0 = bByDay.get(day(bars[bars.length - 1 - n].t)), b1 = bByDay.get(day(bars[bars.length - 1].t));
    const bret = b0 && b1 ? (b1 / b0 - 1) * 100 : null;
    windows[k] = { ma: r1(ret), vnindex: r1(bret), so_voi_vnindex: bret == null ? null : vsText(ret - bret) };
  }
  const ma20 = sma(c, 20), ma50 = sma(c, 50), ma200 = sma(c, 200);
  const trend = ma20 && ma50 ? (last > ma20 && ma20 > ma50 ? 'tăng (giá trên MA20, MA20 trên MA50)' : last < ma20 && ma20 < ma50 ? 'giảm (giá dưới MA20, MA20 dưới MA50)' : 'giằng co (giá và các đường MA đan xen)') : null;
  const year = bars.slice(-250);
  const hi = Math.max(...year.map((b) => b.h)), lo = Math.min(...year.map((b) => b.l));
  const w60 = c.slice(-61), rets = w60.slice(1).map((x, i) => x / w60[i] - 1);   // 60 lợi suất ngày gần nhất
  const mean = rets.reduce((x, y) => x + y, 0) / (rets.length || 1);
  const vol = rets.length > 10 ? Math.sqrt(rets.reduce((x, r) => x + (r - mean) ** 2, 0) / (rets.length - 1) * 250) * 100 : null;
  let peak = -Infinity, mdd = 0;
  for (const x of year.map((b) => b.c)) { peak = Math.max(peak, x); mdd = Math.min(mdd, x / peak - 1); }
  const v20 = sma(bars.map((b) => b.v), 20), v60 = sma(bars.map((b) => b.v), 60);
  const r = rsi(c);
  const recent = bars.slice(-20);
  return {
    ngay: day(bars[bars.length - 1].t),
    gia: r2(last),
    hieu_suat: windows,
    xu_huong: trend,
    ma20: r2(ma20), ma50: r2(ma50), ma200: r2(ma200),
    gia_so_voi_ma20_pct: ma20 ? r1((last / ma20 - 1) * 100) : null,
    gia_so_voi_ma50_pct: ma50 ? r1((last / ma50 - 1) * 100) : null,
    rsi14: r1(r), rsi_nhan_dinh: r == null ? null : r >= 70 ? 'vùng quá mua' : r <= 30 ? 'vùng quá bán' : 'trung tính',
    bien_dong_nam_pct: r1(vol), atr14_pct: r1(atrPct(bars)),
    dinh_52_tuan: r2(hi), day_52_tuan: r2(lo),
    cach_dinh_52_tuan_pct: r1((last / hi - 1) * 100), cach_day_52_tuan_pct: r1((last / lo - 1) * 100),
    sut_giam_toi_da_1_nam_pct: r1(mdd * 100),
    khoi_luong_tb20: v20 ? Math.round(v20) : null,
    khoi_luong_20_so_voi_60_pct: v20 && v60 ? r1((v20 / v60 - 1) * 100) : null,
    vung_thap_20_phien: r2(Math.min(...recent.map((b) => b.l))), vung_cao_20_phien: r2(Math.max(...recent.map((b) => b.h))),
  };
}

/** Mức rủi ro của bản thân cổ phiếu (để so với khẩu vị của khách). */
export const stockRisk = (t) => (!t?.bien_dong_nam_pct ? null : t.bien_dong_nam_pct >= 45 ? 'high' : t.bien_dong_nam_pct >= 28 ? 'medium' : 'low');

/**
 * Kiểm tra tham số khuyến nghị so với giá hiện tại. side: 'B' mua, 'S' bán, null theo dõi.
 * @returns {{ mid, upsidePct, downsidePct, rr, errors: string[], warnings: string[] }}
 */
export function checkAdvice({ side, entryLow, entryHigh, target, stop }, last) {
  const errors = [], warnings = [];
  const lo = entryLow || entryHigh || null, hi = entryHigh || entryLow || null;
  const mid = lo && hi ? (lo + hi) / 2 : null;
  if (lo && hi && lo > hi) errors.push('Vùng giá vào bị ngược (giá thấp lớn hơn giá cao).');
  let upsidePct = null, downsidePct = null, rr = null;
  if (side === 'B' && mid) {
    if (target && target <= hi) errors.push('Mua: giá mục tiêu phải cao hơn vùng mua.');
    if (stop && stop >= lo) errors.push('Mua: giá cắt lỗ phải thấp hơn vùng mua.');
    if (target) upsidePct = (target / mid - 1) * 100;
    if (stop) downsidePct = (stop / mid - 1) * 100;
  } else if (side === 'S' && mid) {
    if (target && target >= lo) errors.push('Bán: giá mục tiêu (giá dự kiến giảm về) phải thấp hơn vùng bán.');
    if (stop && stop <= hi) errors.push('Bán: giá dừng (sai thì mua lại) phải cao hơn vùng bán.');
    if (target) upsidePct = (1 - target / mid) * 100;
    if (stop) downsidePct = (1 - stop / mid) * 100;
  }
  if (!errors.length && upsidePct != null && downsidePct != null && downsidePct < 0) {
    rr = upsidePct / -downsidePct;
    if (rr < 1.5) warnings.push(`Tỷ lệ lời/lỗ chỉ ${rr.toFixed(1).replace('.', ',')} lần (thường nên từ 1,5 lần trở lên).`);
  }
  if (side && !stop) warnings.push('Chưa có giá cắt lỗ.');
  if (side && !target) warnings.push('Chưa có giá mục tiêu.');
  if (mid && last) {
    const gap = (mid / last - 1) * 100;
    if (Math.abs(gap) > 5) warnings.push(`Vùng giá vào cách giá hiện tại ${vi1(gap)}% (${gap > 0 ? 'cao hơn' : 'thấp hơn'}).`);
  }
  return { mid: r2(mid), upsidePct: r1(upsidePct), downsidePct: r1(downsidePct), rr: r2(rr), errors, warnings };
}

/**
 * Kết quả khuyến nghị theo giá thực tế từ ngày khuyến nghị. Một phiên chạm cả mục tiêu lẫn cắt lỗ thì tính là cắt lỗ (thận trọng).
 * Mua coi như khớp ở giữa vùng vào khi giá đi vào vùng đó; chưa vào vùng thì "chưa vào vùng mua".
 * @returns {{ status: 'target'|'stop'|'open'|'not_entered'|'expired'|'watch', label, at, retPct, maxGainPct, maxLossPct, last }}
 */
export function adviceOutcome(a, bars, now = Date.now()) {
  const fromDay = new Date(Date.parse(a.created_at) + 7 * 3600e3).toISOString().slice(0, 10);
  const after = bars.filter((b) => day(b.t) >= fromDay);
  const last = after.length ? after[after.length - 1].c : null;
  const expired = a.valid_until && Date.parse(a.valid_until) < now;
  if (!a.side) return { status: 'watch', label: 'Theo dõi', last };
  // Chưa có phiên giá nào sau lúc khuyến nghị (vừa gửi): chưa có gì để chấm
  if (!after.length) return { status: expired ? 'expired' : 'open', label: expired ? 'Hết hiệu lực' : 'Mới gửi', retPct: null, maxGainPct: null, maxLossPct: null, last: null };
  const lo = Number(a.entry_low || a.entry_high) || null, hi = Number(a.entry_high || a.entry_low) || null;
  const mid = lo && hi ? (lo + hi) / 2 : null, tp = Number(a.target) || null, sl = Number(a.stop) || null;
  const buy = a.side === 'B';
  let entered = !mid, entry = mid, maxGain = 0, maxLoss = 0;
  for (const b of after) {
    if (!entered) {
      if (b.l <= hi && b.h >= lo) entered = true; else continue;
    }
    const base = entry || after[0].o;
    const gain = buy ? (b.h / base - 1) * 100 : (1 - b.l / base) * 100;
    const loss = buy ? (b.l / base - 1) * 100 : (1 - b.h / base) * 100;
    maxGain = Math.max(maxGain, gain); maxLoss = Math.min(maxLoss, loss);
    const hitStop = sl && (buy ? b.l <= sl : b.h >= sl), hitTarget = tp && (buy ? b.h >= tp : b.l <= tp);
    if (hitStop) return { status: 'stop', label: 'Chạm cắt lỗ', at: day(b.t), retPct: r1(buy ? (sl / base - 1) * 100 : (1 - sl / base) * 100), maxGainPct: r1(maxGain), maxLossPct: r1(maxLoss), last };
    if (hitTarget) return { status: 'target', label: 'Đạt mục tiêu', at: day(b.t), retPct: r1(buy ? (tp / base - 1) * 100 : (1 - tp / base) * 100), maxGainPct: r1(maxGain), maxLossPct: r1(maxLoss), last };
  }
  if (!entered) return { status: expired ? 'expired' : 'not_entered', label: expired ? 'Hết hiệu lực, giá chưa vào vùng' : 'Giá chưa vào vùng', last };
  const base = entry || after[0]?.o;
  const ret = base && last ? (buy ? (last / base - 1) * 100 : (1 - last / base) * 100) : null;
  return { status: expired ? 'expired' : 'open', label: expired ? 'Hết hiệu lực' : 'Đang theo dõi', retPct: r1(ret), maxGainPct: r1(maxGain), maxLossPct: r1(maxLoss), last };
}

/** Tổng hợp thành tích khuyến nghị: tỷ lệ đạt mục tiêu trên số đã kết thúc (đạt mục tiêu + chạm cắt lỗ). */
export function trackRecord(outcomes) {
  const closed = outcomes.filter((o) => o.status === 'target' || o.status === 'stop');
  const wins = closed.filter((o) => o.status === 'target').length;
  const withRet = outcomes.filter((o) => o.retPct != null);
  return {
    total: outcomes.length, closed: closed.length, wins, losses: closed.length - wins,
    winRate: closed.length ? r1((wins / closed.length) * 100) : null,
    avgRetPct: withRet.length ? r1(withRet.reduce((a, o) => a + o.retPct, 0) / withRet.length) : null,
    open: outcomes.filter((o) => o.status === 'open').length,
  };
}
