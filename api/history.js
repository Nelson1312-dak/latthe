/**
 * GET /api/history?symbols=HPG,FPT&days=260 — nến ngày (đơn vị nghìn đồng).
 * Không truyền symbols = cả rổ. Nến của HÔM NAY (nếu đã có giao dịch) được dựng từ nến 1 phút và nối vào cuối,
 * vì nến ngày của nguồn giá chưa có nến hôm nay trong lúc phiên chạy. Cache CDN 60 giây.
 */
import { UNIVERSE, BY_SYMBOL, fetchBars, liveBar, vnNow, cached } from './_market.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const q = new URL(req.url, 'http://x').searchParams;
  const days = Math.min(Math.max(parseInt(q.get('days') || '260', 10) || 260, 20), 500);
  const want = (q.get('symbols') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const symbols = want.length ? [...new Set(want)] : UNIVERSE.map((x) => x.s);
  const bad = symbols.filter((s) => !BY_SYMBOL[s]);
  if (bad.length) return res.status(400).json({ error: `Mã chưa hỗ trợ: ${bad.join(', ')}` });

  const today = vnNow().ymd;
  const settled = await Promise.allSettled(symbols.map(async (s) => {
    const [daily, live] = await Promise.all([cached(`h:${s}:${days}`, 600_000, () => fetchBars(s, days)), liveBar(s).catch(() => null)]);
    const hasToday = daily.some((b) => vnNow(b.t * 1000).ymd === today);
    const bars = daily.filter((b) => vnNow(b.t * 1000).ymd !== today);
    if (live) bars.push({ t: live.t, o: live.o, h: live.h, l: live.l, c: live.c, v: live.v });
    else if (hasToday) bars.push(daily.find((b) => vnNow(b.t * 1000).ymd === today));
    return bars;
  }));
  const bars = {};
  settled.forEach((r, i) => { if (r.status === 'fulfilled' && r.value.length) bars[symbols[i]] = r.value; });
  if (!Object.keys(bars).length) return res.status(502).json({ error: 'Không lấy được dữ liệu lịch sử.' });
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  return res.status(200).json({ bars });
}
