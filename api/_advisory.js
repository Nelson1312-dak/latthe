/**
 * api/_advisory.js — phân tích một tiểu khoản: cơ cấu, rủi ro, hiệu suất, so với danh mục mẫu, đề xuất tái phân bổ.
 * Dùng chung cho bàn môi giới (/api/broker/analytics), cổng khách (/api/portal/analytics) và việc AI (/api/ai/jobs).
 * Underscore prefix => Vercel không expose thành route.
 */
import { rest } from './_db.js';
import * as dnse from './_dnse.js';
import {
  normalizeAccount, composition, loadHistory, holdBacktest, weightsBacktest, realizedSeries, stats, chartSeries, RISK_LABEL,
} from './_portfolio.js';
import { planRebalance } from './_rebalance.js';
import { suitability } from './_risk.js';

const MODEL_COLS = 'id,name,risk_level,description,cash_pct,drift_pct,archived,updated_at,model_weights(symbol,weight)';

export function modelShape(m) {
  if (!m) return null;
  const weights = Object.fromEntries((m.model_weights || []).map((w) => [w.symbol, Number(w.weight)]));
  return {
    id: m.id, name: m.name, riskLevel: m.risk_level, riskLabel: RISK_LABEL[m.risk_level], description: m.description,
    cashPct: Number(m.cash_pct), driftPct: Number(m.drift_pct), archived: m.archived, updatedAt: m.updated_at, weights,
  };
}

export async function getModel(id, sub) {
  if (!id) return null;
  return modelShape((await rest(`/model_portfolios?id=eq.${Number(id)}&select=${MODEL_COLS}`, { sub }))[0]);
}
export async function listModels(sub) {
  return (await rest(`/model_portfolios?select=${MODEL_COLS}&order=archived.asc,id.asc`, { sub })).map(modelShape);
}

/**
 * Giá gần nhất theo đồng, ưu tiên: bảng giá realtime trong ngày > giá DNSE của mã đang nắm giữ (cùng giá đã dùng tính
 * tài sản ròng, để tỷ trọng và đề xuất khớp nhau) > giá đóng cửa gần nhất.
 */
async function latestPrices(symbols, hist, holdings) {
  const out = {};
  for (const s of symbols) { const h = hist.prices[s]; if (h?.length) out[s] = h[h.length - 1].c; }
  for (const h of holdings) if (h.price) out[h.symbol] = h.price;
  if (!symbols.length) return out;
  try {
    const rows = await rest(`/market_quotes?symbol=in.(${symbols.join(',')})&select=symbol,data,at`, { role: 'app_worker' });
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    for (const r of rows || []) {
      const day = new Date(Date.parse(r.at) + 7 * 3600e3).toISOString().slice(0, 10);
      if (day === today && Number(r.data?.last) > 0) out[r.symbol] = Number(r.data.last) * 1000;
    }
  } catch { /* không có bảng giá realtime: dùng giá đóng cửa */ }
  return out;
}

const perf = (series) => (series ? { stats: stats(series.values, series.bench, series.dates), chart: chartSeries(series) } : null);

/**
 * @param {{ accountNo: string, sub: string, side: 'broker'|'client', plan?: boolean }} o
 *   side='broker': sub là môi giới (đã qua assertOwner + requireClient); ảnh chụp đọc bằng app_worker.
 *   side='client': sub là khách (đã kiểm tra liên kết); mọi thứ đọc bằng app_rw theo RLS.
 */
export async function analyzeAccount({ accountNo, sub, side, plan = true }) {
  const acc = String(accountNo);
  const [balance, positions] = await Promise.all([dnse.balances(acc), dnse.positions(acc)]);
  const account = normalizeAccount({ balance, positions });

  const profFilter = side === 'broker' ? `&broker_id=eq.${sub}` : '';
  const profile = (await rest(`/client_profiles?account_no=eq.${acc}${profFilter}&select=risk_level,risk_score,answered_by,answered_at,model_id,note,updated_at&limit=1`, { sub }))[0] || null;
  const model = profile?.model_id ? await getModel(profile.model_id, sub) : null;

  const symbols = [...new Set([...account.holdings.map((h) => h.symbol), ...Object.keys(model?.weights || {})])];
  const hist = await loadHistory(symbols, 260);
  // DNSE không trả giá cho mã nào thì dùng giá đóng cửa gần nhất, tránh tính mã đó bằng 0
  const noPrice = account.holdings.filter((h) => !h.price);
  for (const h of noPrice) { const s = hist.prices[h.symbol]; if (s?.length) h.price = s[s.length - 1].c; }
  if (noPrice.length) {
    account.stockValue = account.holdings.reduce((a, h) => a + (h.price || 0) * h.qty, 0);
    account.nav = account.stockValue + account.cash - account.debt;
    account.warnings.push(`DNSE chưa trả giá thị trường của ${noPrice.map((h) => h.symbol).join(', ')}: tạm dùng giá đóng cửa gần nhất.`);
  }
  const comp = composition(account);
  const snaps = await rest(`/portfolio_snapshots?account_no=eq.${acc}&select=day,nav,cash,debt,positions&order=day.asc&limit=400`,
    side === 'broker' ? { role: 'app_worker' } : { sub });

  const hold = account.holdings.length ? holdBacktest(account, hist) : null;
  const realized = realizedSeries(snaps.map((s) => ({ ...s, positions: s.positions || [] })), hist);
  const modelBt = model && Object.keys(model.weights).length ? weightsBacktest(model.weights, model.cashPct, hist) : null;

  let rebalance = null;
  if (model) {
    const prices = await latestPrices(symbols, hist, account.holdings);
    rebalance = planRebalance(account, model, prices, { maxOrderVnd: dnse.maxOrderVnd() });
    if (!plan && rebalance.ok) rebalance = { ...rebalance, trades: [], cash: undefined, fees: undefined, turnoverPct: undefined };   // khách chỉ xem độ lệch
  }

  return {
    account: { accountNo: acc, cash: account.cash, debt: account.debt, stockValue: account.stockValue, nav: account.nav, warnings: account.warnings },
    composition: comp,
    profile: profile && { riskLevel: profile.risk_level, riskLabel: RISK_LABEL[profile.risk_level] || null, riskScore: profile.risk_score,
      answeredBy: profile.answered_by, answeredAt: profile.answered_at, note: side === 'broker' ? profile.note : undefined, modelId: profile.model_id },
    model,
    suitability: suitability(profile?.risk_level, model?.riskLevel),
    performance: {
      holding: hold && { ...perf(hold), missing: hold.missing, note: 'Giả định giữ nguyên số cổ phiếu và tiền hiện có trong suốt khoảng thời gian.' },
      realized: realized && { ...perf(realized), snapshots: snaps.length, note: 'Tính từ ảnh chụp danh mục cuối mỗi ngày; nạp/rút tiền không ảnh hưởng.' },
      model: modelBt && { ...perf(modelBt), note: 'Danh mục mẫu: mua theo tỷ trọng ở đầu kỳ rồi giữ nguyên.' },
      snapshots: snaps.length,
      adjustments: hist.adjustments,
    },
    rebalance,
    asOf: new Date().toISOString(),
  };
}

const r1 = (v) => (v == null || !Number.isFinite(+v) ? null : Math.round(+v * 10) / 10);

/**
 * Dữ kiện gửi cho AI: chỉ số liệu đã tính, làm tròn 1 chữ số; KHÔNG có tên khách, số tài khoản hay giá trị tài sản tuyệt đối.
 */
export function factsForAI(a) {
  const st = a.performance.holding?.stats;
  const rt = a.performance.realized?.stats;
  const ms = a.performance.model?.stats;
  // So sánh với VN-Index viết sẵn thành câu: model nhỏ hay đảo dấu nếu phải tự trừ và tự diễn đạt
  const vs = (d) => (Math.abs(d) < 0.3 ? 'ngang VN-Index' : `${d > 0 ? 'tốt hơn' : 'kém hơn'} VN-Index ${Math.abs(d).toFixed(1).replace('.', ',')} điểm %`);
  const win = (s) => s && Object.fromEntries(Object.entries(s.windows).map(([k, v]) => [k, { danh_muc: r1(v.ret), vnindex: r1(v.bench), so_voi_vnindex: vs(v.ret - v.bench) }]));
  return {
    khau_vi_rui_ro: a.profile?.riskLabel || 'chưa đánh giá',
    danh_muc_mau: a.model ? { ten: a.model.name, muc_rui_ro: a.model.riskLabel, ty_trong_muc_tieu: a.model.weights, tien_mat_muc_tieu: a.model.cashPct } : 'chưa gán',
    phu_hop: a.suitability?.text || null,
    co_cau: a.composition.rows.slice(0, 12).map((r) => ({ ma: r.symbol, ty_trong: r1(r.weight), lai_lo_pct: r1(r.pnlPct), nganh: r.sector })),
    nganh: a.composition.sectors.slice(0, 6).map((s) => ({ nganh: s.sector, ty_trong: r1(s.weight) })),
    tien_mat_ty_trong: r1(a.composition.cashWeight),
    du_no_ty_trong: r1(a.composition.debtWeight),
    so_ma_hieu_dung: r1(a.composition.effectiveN),
    canh_bao: a.composition.flags.map((f) => f.text),
    hieu_suat_giu_nguyen: st && { theo_ky: win(st), bien_dong_nam: r1(st.volatility), sut_giam_toi_da: r1(st.maxDrawdown), beta: st.beta == null ? null : Math.round(st.beta * 100) / 100 },
    hieu_suat_thuc_te: rt ? { tu_ngay: rt.from, tong: r1(rt.total), vnindex: r1(rt.benchTotal) } : 'chưa đủ dữ liệu',
    hieu_suat_danh_muc_mau: ms ? { theo_ky: win(ms) } : null,
    tai_phan_bo: a.rebalance?.ok ? {
      do_lech_lon_nhat_hien_tai: r1(a.rebalance.maxDeviationBefore), do_lech_lon_nhat_sau_khi_thuc_hien_de_xuat: r1(a.rebalance.maxDeviationAfter),
      lenh: a.rebalance.trades.map((t) => ({ ma: t.symbol, lenh: t.side === 'B' ? 'mua' : 'bán', khoi_luong: t.qty, ly_do: t.reason })),
      vong_quay_pct: r1(a.rebalance.turnoverPct), luu_y: a.rebalance.warnings,
    } : null,
  };
}
