/**
 * Danh mục mẫu của môi giới.
 *   GET  /api/broker/models                    danh sách (kèm tỷ trọng)
 *   GET  /api/broker/models?perf=<id>          hiệu suất 1 năm của danh mục mẫu so với VN-Index
 *   POST /api/broker/models { action: 'save', id?, name, riskLevel, description?, cashPct, driftPct, weights: [{symbol, weight}] }
 *   POST /api/broker/models { action: 'archive', id, archived }
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { listModels, getModel } from '../../../api/_advisory.js';
import { RISK_LEVELS, loadHistory, weightsBacktest, stats, chartSeries } from '../../../api/_portfolio.js';
import { fetchBars, cached } from '../../../api/_market.js';

const bad = (res, m) => res.status(400).json({ error: m });
const dec2 = (v) => Math.round(Number(v) * 100) / 100;

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'GET') {
    const perfId = new URL(req.url, 'http://x').searchParams.get('perf');
    if (!perfId) return { models: await listModels(uid) };
    const m = await getModel(perfId, uid);
    if (!m) return res.status(404).json({ error: 'Không tìm thấy danh mục mẫu.' });
    const hist = await loadHistory(Object.keys(m.weights), 260);
    const bt = weightsBacktest(m.weights, m.cashPct, hist);
    return { model: m, stats: stats(bt.values, bt.bench, bt.dates), chart: chartSeries(bt), adjustments: hist.adjustments,
      note: 'Mua theo tỷ trọng ở đầu kỳ rồi giữ nguyên, chưa trừ phí. Kết quả quá khứ không bảo đảm kết quả tương lai.' };
  }

  if (body.action === 'archive') {
    const rows = await rest(`/model_portfolios?id=eq.${Number(body.id)}`, { sub: uid, method: 'PATCH', prefer: 'return=representation', body: { archived: !!body.archived, updated_at: new Date().toISOString() } });
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy danh mục mẫu.' });
    return { model: await getModel(body.id, uid) };
  }
  if (body.action !== 'save') return bad(res, 'Thao tác không hợp lệ.');

  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 80) return bad(res, 'Tên danh mục mẫu từ 2 đến 80 ký tự.');
  if (!RISK_LEVELS.includes(body.riskLevel)) return bad(res, 'Chọn mức rủi ro của danh mục mẫu.');
  const cashPct = dec2(body.cashPct ?? 0), driftPct = dec2(body.driftPct ?? 5);
  if (!(cashPct >= 0 && cashPct <= 100)) return bad(res, 'Tỷ trọng tiền mặt từ 0 đến 100%.');
  if (!(driftPct >= 0.5 && driftPct <= 50)) return bad(res, 'Ngưỡng lệch từ 0,5 đến 50 điểm %.');
  const list = Array.isArray(body.weights) ? body.weights : [];
  if (!list.length || list.length > 30) return bad(res, 'Danh mục mẫu cần từ 1 đến 30 mã.');
  const weights = [];
  for (const w of list) {
    const symbol = String(w.symbol || '').trim().toUpperCase(), weight = dec2(w.weight);
    if (!/^[A-Z0-9]{3,10}$/.test(symbol)) return bad(res, `Mã "${w.symbol}" không hợp lệ.`);
    if (weights.some((x) => x.symbol === symbol)) return bad(res, `Mã ${symbol} bị lặp.`);
    if (!(weight > 0 && weight <= 100)) return bad(res, `Tỷ trọng của ${symbol} phải lớn hơn 0 và không quá 100%.`);
    weights.push({ symbol, weight });
  }
  const total = dec2(weights.reduce((a, w) => a + w.weight, 0) + cashPct);
  if (Math.abs(total - 100) > 0.01) return bad(res, `Tổng tỷ trọng cổ phiếu và tiền mặt phải bằng 100% (đang là ${total.toLocaleString('vi-VN')}%).`);
  // Mã phải có dữ liệu giá, tránh gõ nhầm
  const missing = [];
  await Promise.all(weights.map(async (w) => {
    const bars = await cached(`exists:${w.symbol}`, 6 * 3600e3, () => fetchBars(w.symbol, 5).catch(() => []));
    if (!bars.length) missing.push(w.symbol);
  }));
  if (missing.length) return bad(res, `Không tìm thấy dữ liệu giá của: ${missing.join(', ')}.`);

  const id = body.id ? Number(body.id) : null;
  try {
    const m = await rest('/rpc/save_model', { sub: uid, method: 'POST', body: { p: {
      id, name, risk_level: body.riskLevel, description: String(body.description || '').trim().slice(0, 1000), cash_pct: cashPct, drift_pct: driftPct, weights,
    } } });
    return res.status(id ? 200 : 201).json({ model: await getModel(m.id, uid) });
  } catch (e) {
    if (/model_not_found/.test(e.message)) return res.status(404).json({ error: 'Không tìm thấy danh mục mẫu.' });
    throw e;
  }
}, { auth: true });
