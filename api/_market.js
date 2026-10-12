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
export function quoteFromBars(info, daily, live = null) {
  const today = vnNow().ymd;
  const past = daily.filter((b) => vnNow(b.t * 1000).ymd !== today);
  const dailyToday = daily.find((b) => vnNow(b.t * 1000).ymd === today) || null;
  const bar = live || dailyToday;
  if (bar && past.length) {
    const ref = past[past.length - 1].c;
    const { ceil, floor } = limits(ref, info.ex);
    return { s: info.s, ex: info.ex, name: info.name, ref, ceil, floor, last: bar.c, open: bar.o, high: bar.h, low: bar.l, vol: bar.v, lastSession: today, asof: bar.asof || null };
  }
  const last = past[past.length - 1];
  if (!last) return null;
  const { ceil, floor } = limits(last.c, info.ex);
  return { s: info.s, ex: info.ex, name: info.name, ref: last.c, ceil, floor, last: last.c, open: last.c, high: last.c, low: last.c, vol: 0, lastSession: vnNow(last.t * 1000).ymd, asof: null };
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
