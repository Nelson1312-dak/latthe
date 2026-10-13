/**
 * GET /api/symbol?symbol=HPG — tóm tắt một mã, trả ngay từ kho dữ liệu (trade.symbol_facts + symbol_briefs).
 * Mọi tài khoản đã đăng nhập đều gọi được: đây là dữ liệu thị trường, không gắn với khách hàng nào.
 *
 * Bản tóm tắt do AI local viết sẵn sau mỗi phiên nên không phải chờ. Chỉ báo kỹ thuật lấy từ kho; nếu kho chưa có
 * (mã mới thêm, worker chưa chạy) thì tính trực tiếp từ nguồn giá để vẫn có câu trả lời.
 */
import { route } from '../../api/_http.js';
import { rest } from '../../api/_db.js';
import { BY_SYMBOL, fetchBars, cached } from '../../api/_market.js';
import { technicals, stockRisk } from '../../api/_technical.js';
import { symbolFacts } from '../../api/_facts.js';

const STALE_DAYS = 5;

/** Giá mới nhất theo nghìn đồng: bảng giá realtime nếu có trong ngày, không thì giá đóng cửa trong kho. */
async function latestPrice(symbol, tech) {
  try {
    const r = (await rest(`/market_quotes?symbol=eq.${symbol}&select=data,at&limit=1`, { role: 'app_worker' }))[0];
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const day = r?.at ? new Date(Date.parse(r.at) + 7 * 3600e3).toISOString().slice(0, 10) : null;
    if (day === today && Number(r.data?.last) > 0) return Number(r.data.last);
  } catch { /* chưa có bảng giá realtime */ }
  return tech?.gia ?? null;
}

export async function symbolSummary(symbol) {
  const [row] = await rest(`/symbol_facts?symbol=eq.${symbol}&select=tech,tech_at,fundamentals,fund_at,fund_source&limit=1`, { role: 'app_worker' });
  let tech = row?.tech || null, techAt = row?.tech_at || null, computed = false;
  if (!tech) {
    const info = BY_SYMBOL[symbol];
    const [bars, bench] = await Promise.all([
      cached(`kb:${symbol}`, 10 * 60e3, () => fetchBars(symbol, 260).catch(() => [])),
      cached('kb:VNINDEX', 10 * 60e3, () => fetchBars('VNINDEX', 260, '1D', 'index').catch(() => [])),
    ]);
    tech = technicals(bars, bench, info?.ex);
    computed = !!tech;
    techAt = tech ? new Date().toISOString() : null;
  }
  if (!tech && !row?.fundamentals) return null;
  const priceK = await latestPrice(symbol, tech);
  const facts = symbolFacts({ symbol, tech, fundamentals: row?.fundamentals || null, priceK, fundAt: row?.fund_at });
  const [brief] = await rest(`/symbol_briefs?symbol=eq.${symbol}&select=brief,model,flags,generated_at&limit=1`, { role: 'app_worker' });
  const briefStale = brief ? Date.now() - Date.parse(brief.generated_at) > STALE_DAYS * 86400e3 : false;
  return {
    symbol, priceK, facts,
    risk: stockRisk(tech),
    brief: brief ? { text: brief.brief, model: brief.model, at: brief.generated_at, stale: briefStale, flags: brief.flags } : null,
    nguon: { ky_thuat: computed ? 'tính trực tiếp' : 'kho dữ liệu', ky_thuat_at: techAt, co_ban: row?.fund_source || null, co_ban_at: row?.fund_at || null },
  };
}

export default route('GET, OPTIONS', async ({ req, res }) => {
  const symbol = String(new URL(req.url, 'http://x').searchParams.get('symbol') || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) return res.status(400).json({ error: 'Mã chứng khoán không hợp lệ.' });
  const out = await symbolSummary(symbol);
  if (!out) return res.status(404).json({ error: `Chưa có dữ liệu cho mã ${symbol}.` });
  return out;
}, { auth: true });
