/**
 * api/_adviceperf.js — gắn kết quả thực tế (đạt mục tiêu, chạm cắt lỗ, đang theo dõi…) vào danh sách khuyến nghị.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Giá dùng để chấm là giá chưa điều chỉnh (khuyến nghị đặt theo giá tại thời điểm đó). Nếu sau ngày khuyến nghị mã có
 * chia cổ tức bằng cổ phiếu, giá giảm kỹ thuật có thể bị tính nhầm là chạm cắt lỗ: hiếm, cần môi giới để ý.
 */
import { fetchRange, liveBar, cached, vnNow } from './_market.js';
import { adviceOutcome, trackRecord } from './_technical.js';

async function barsSince(symbol, fromSec) {
  const key = `advbars:${symbol}:${vnNow(fromSec * 1000).ymd}`;
  const daily = await cached(key, 15 * 60e3, () => fetchRange(symbol, fromSec - 3 * 86400, Date.now() / 1000, '1D').catch(() => []));
  const live = await cached(`advlive:${symbol}`, 60e3, () => liveBar(symbol).catch(() => null));
  const today = vnNow().ymd;
  return live && !daily.some((b) => vnNow(b.t * 1000).ymd === today) ? [...daily, live] : daily;
}

/** @param {Array<{symbol, side, entry_low, entry_high, target, stop, created_at, valid_until}>} rows */
export async function attachOutcomes(rows) {
  const from = {};
  for (const r of rows) {
    if (!r.side) continue;
    const t = Math.floor(Date.parse(r.created_at) / 1000);
    from[r.symbol] = Math.min(from[r.symbol] ?? t, t);
  }
  const bars = {};
  await Promise.all(Object.entries(from).map(async ([s, t]) => { bars[s] = await barsSince(s, t); }));
  const out = rows.map((r) => ({ ...r, outcome: adviceOutcome(r, bars[r.symbol] || []) }));
  return { rows: out, record: trackRecord(out.map((r) => r.outcome).filter((o) => o.status !== 'watch')) };
}
