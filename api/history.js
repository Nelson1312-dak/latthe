/**
 * GET /api/history?symbols=HPG,FPT&days=260 — nến ngày (đơn vị nghìn đồng).
 * Không truyền symbols = cả rổ. Cache CDN 10 phút.
 */
import { UNIVERSE, BY_SYMBOL, fetchBars } from './_market.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const q = new URL(req.url, 'http://x').searchParams;
  const days = Math.min(Math.max(parseInt(q.get('days') || '260', 10) || 260, 20), 500);
  const want = (q.get('symbols') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const symbols = want.length ? [...new Set(want)] : UNIVERSE.map((x) => x.s);
  const bad = symbols.filter((s) => !BY_SYMBOL[s]);
  if (bad.length) return res.status(400).json({ error: `Mã chưa hỗ trợ: ${bad.join(', ')}` });

  const settled = await Promise.allSettled(symbols.map((s) => fetchBars(s, days)));
  const bars = {};
  settled.forEach((r, i) => { if (r.status === 'fulfilled' && r.value.length) bars[symbols[i]] = r.value; });
  if (!Object.keys(bars).length) return res.status(502).json({ error: 'Không lấy được dữ liệu lịch sử.' });
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).json({ bars });
}
