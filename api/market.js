/**
 * GET /api/market — báo giá cả rổ mã (giá thật DNSE, trễ vài giây nhờ cache CDN).
 * Chỉ phục vụ mã trong UNIVERSE nên không thể bị lợi dụng làm proxy tới nguồn giá.
 */
import { UNIVERSE, INDICES, fetchBars, quoteFromBars, indexFromBars, sessionState } from './_market.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const [settled, idxSettled] = await Promise.all([
    Promise.allSettled(UNIVERSE.map(async (x) => quoteFromBars(x, await fetchBars(x.s, 6)))),
    Promise.allSettled(INDICES.map(async (s) => indexFromBars(s, await fetchBars(s, 6, '1D', 'index')))),
  ]);
  const indices = idxSettled.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
  const quotes = {};
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) quotes[UNIVERSE[i].s] = r.value;
    else failed.push(UNIVERSE[i].s);
  });
  if (!Object.keys(quotes).length) {
    return res.status(502).json({ error: 'Không lấy được giá từ nguồn dữ liệu.' });
  }
  const session = sessionState();
  res.setHeader('Cache-Control', `public, s-maxage=${session === 'closed' ? 60 : 5}, stale-while-revalidate=30`);
  return res.status(200).json({ asof: new Date().toISOString(), session, quotes, indices, failed });
}
