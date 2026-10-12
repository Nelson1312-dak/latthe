/**
 * api/_market.js — Nguồn giá thật (DNSE Entrade chart-api, công khai) + luật bước giá/biên độ.
 * Underscore prefix => Vercel không expose thành route.
 * Đơn vị giá: nghìn đồng (20.1 = 20.100 đ), như nguồn trả về.
 */

export const UNIVERSE = [
  { s: 'HPG', ex: 'HOSE',  name: 'Tập đoàn Hòa Phát' },
  { s: 'FPT', ex: 'HOSE',  name: 'Công ty CP FPT' },
  { s: 'MWG', ex: 'HOSE',  name: 'Thế Giới Di Động' },
  { s: 'VCB', ex: 'HOSE',  name: 'Ngân hàng Vietcombank' },
  { s: 'TCB', ex: 'HOSE',  name: 'Ngân hàng Techcombank' },
  { s: 'SSI', ex: 'HOSE',  name: 'Chứng khoán SSI' },
  { s: 'VHM', ex: 'HOSE',  name: 'Vinhomes' },
  { s: 'DGC', ex: 'HOSE',  name: 'Hóa chất Đức Giang' },
  { s: 'PVS', ex: 'HNX',   name: 'Dịch vụ Kỹ thuật Dầu khí' },
  { s: 'BSR', ex: 'UPCOM', name: 'Lọc hóa dầu Bình Sơn' },
];
export const BY_SYMBOL = Object.fromEntries(UNIVERSE.map((x) => [x.s, x]));

const BAND = { HOSE: 0.07, HNX: 0.10, UPCOM: 0.15 };
const FEED = 'https://services.entrade.com.vn/chart-api/v2/ohlcs';
export const INDICES = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];

// Giá làm việc theo đơn vị 10 đồng (số nguyên) để không lệch số thực.
const U = (p) => Math.round(p * 100);
const P = (u) => u / 100;
export const tickU = (u, ex) => (ex !== 'HOSE' ? 10 : u < 1000 ? 1 : u < 5000 ? 5 : 10);

export function limits(ref, ex) {
  const refU = U(ref), t = tickU(refU, ex);
  return {
    ceil:  P(Math.floor(Math.round(refU * (1 + BAND[ex])) / t) * t),
    floor: P(Math.ceil(Math.round(refU * (1 - BAND[ex])) / t) * t),
  };
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
  const url = `${FEED}/${kind}?from=${Math.floor(from)}&to=${Math.floor(to)}&symbol=${symbol}&resolution=${resolution}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
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
}

/** `days` nến gần nhất (mặc định nến ngày). */
export async function fetchBars(symbol, days, resolution = '1D', kind = 'stock') {
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.ceil(days * 1.6 + 7) * 86400; // dư để bù cuối tuần/lễ
  return (await fetchRange(symbol, from, to, resolution, kind)).slice(-days);
}

/**
 * Báo giá từ vài phiên daily gần nhất. Nếu đã có nến của hôm nay thì đó là phiên live
 * (tham chiếu = đóng cửa phiên trước); chưa có thì tham chiếu = đóng cửa phiên gần nhất.
 */
export function quoteFromBars(info, bars) {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const lastDay = vnNow(last.t * 1000).ymd;
  const live = lastDay === vnNow().ymd;
  const ref = (live ? bars[bars.length - 2] : last).c;
  const { ceil, floor } = limits(ref, info.ex);
  return {
    s: info.s, ex: info.ex, name: info.name,
    ref, ceil, floor,
    last: live ? last.c : ref,
    open: live ? last.o : ref,
    high: live ? last.h : ref,
    low: live ? last.l : ref,
    vol: live ? last.v : 0,
    lastSession: lastDay,
  };
}

/** Chỉ số: so với đóng cửa phiên liền trước (khi đóng cửa thì là biến động của phiên gần nhất). */
export function indexFromBars(symbol, bars) {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const ref = bars[bars.length - 2].c;
  return { s: symbol, last: last.c, ref, pct: (last.c / ref - 1) * 100 };
}
