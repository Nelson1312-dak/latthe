/**
 * GET /api/broker/symbol?symbol=HPG[&side=B&entryLow=&entryHigh=&target=&stop=]
 * Dữ liệu để soạn khuyến nghị: chỉ báo kỹ thuật, mức rủi ro của cổ phiếu, kiểm tra vùng vào/mục tiêu/cắt lỗ,
 * và danh sách khách đã liên kết kèm khẩu vị rủi ro (cảnh báo khi cổ phiếu rủi ro hơn khẩu vị).
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { BY_SYMBOL, fetchBars, cached } from '../../../api/_market.js';
import { technicals, stockRisk, checkAdvice } from '../../../api/_technical.js';
import { RISK_LEVELS, RISK_LABEL } from '../../../api/_portfolio.js';

const RISK_TEXT = { low: 'biến động thấp', medium: 'biến động trung bình', high: 'biến động cao' };
const num = (v) => (v == null || v === '' || !Number.isFinite(+String(v).replace(',', '.')) ? null : +String(v).replace(',', '.'));

export async function symbolData(symbol) {
  const [bars, bench] = await Promise.all([
    cached(`sym:${symbol}`, 10 * 60e3, () => fetchBars(symbol, 260).catch(() => [])),   // mã không tồn tại: nguồn giá trả 400
    cached('sym:VNINDEX', 10 * 60e3, () => fetchBars('VNINDEX', 260, '1D', 'index')),
  ]);
  const info = BY_SYMBOL[symbol];
  const tech = technicals(bars, bench, info?.ex);
  return { info: info ? { name: info.name, sector: info.sector, ex: info.ex } : null, tech, risk: stockRisk(tech) };
}

export default route('GET, OPTIONS', async ({ req, res, uid }) => {
  await dnse.assertOwner(uid);
  const q = new URL(req.url, 'http://x').searchParams;
  const symbol = String(q.get('symbol') || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) return res.status(400).json({ error: 'Mã chứng khoán không hợp lệ.' });
  const d = await symbolData(symbol);
  if (!d.tech) return res.status(404).json({ error: `Không đủ dữ liệu giá của ${symbol} (cần ít nhất 25 phiên).` });

  const side = q.get('side') === 'B' || q.get('side') === 'S' ? q.get('side') : null;
  const check = checkAdvice({ side, entryLow: num(q.get('entryLow')), entryHigh: num(q.get('entryHigh')), target: num(q.get('target')), stop: num(q.get('stop')) }, d.tech.gia);

  // Khách đã liên kết + khẩu vị rủi ro; cổ phiếu biến động cao mà khách Thận trọng => cảnh báo
  const [links, profiles] = await Promise.all([
    rest('/client_links?select=account_no,client_name,user_id&order=id', { sub: uid }),
    rest(`/client_profiles?broker_id=eq.${uid}&select=account_no,risk_level`, { sub: uid }),
  ]);
  const prof = new Map(profiles.map((p) => [p.account_no, p.risk_level]));
  const recipients = links.map((l) => {
    const lv = prof.get(l.account_no) || null;
    let warn = null;
    if (side === 'B' && d.risk === 'high' && (!lv || RISK_LEVELS.indexOf(lv) <= 1)) warn = lv ? `Cổ phiếu ${RISK_TEXT.high}, khách có khẩu vị ${RISK_LABEL[lv]}.` : 'Khách chưa đánh giá khẩu vị rủi ro.';
    else if (side === 'B' && d.risk === 'medium' && lv === 'conservative') warn = `Cổ phiếu ${RISK_TEXT.medium}, khách có khẩu vị Thận trọng.`;
    return { account: l.account_no, name: l.client_name, riskLevel: lv, riskLabel: lv ? RISK_LABEL[lv] : null, warn };
  });
  return { symbol, ...d, riskText: RISK_TEXT[d.risk] || null, check, recipients };
}, { auth: true });
