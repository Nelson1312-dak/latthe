/**
 * api/_rebalance.js — đề xuất tái phân bổ danh mục khách về danh mục mẫu. Hàm thuần, không gọi DB hay DNSE.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Kết quả CHỈ là đề xuất: môi giới xem lại, sửa, rồi mới tạo phiếu lệnh (khách xác nhận trong app hoặc qua điện thoại).
 *
 * Quy tắc:
 *   - Tỷ trọng tính trên tài sản ròng (giá trị cổ phiếu + tiền - nợ).
 *   - Mã lệch khỏi tỷ trọng mục tiêu ít hơn ngưỡng (drift) thì giữ nguyên, tránh mua bán vụn.
 *   - Mã không có trong danh mục mẫu: đề xuất bán hết phần bán được.
 *   - Bán trước, mua sau; tiền mua = tiền hiện có + tiền bán (đã trừ phí, thuế) - tiền mặt mục tiêu. Không dùng thêm ký quỹ.
 *   - Khối lượng làm tròn xuống bội số 100. Lệnh lớn hơn hạn mức mỗi lệnh được chia nhỏ.
 */

/** Số 1 chữ số thập phân, dấu phẩy kiểu Việt Nam (12,5) cho câu chữ hiển thị. */
const vi1 = (v) => v.toFixed(1).replace('.', ',');

export const DEFAULTS = { lot: 100, feeRate: 0.0015, sellTaxRate: 0.001, minTradeVnd: 1_000_000, maxOrderVnd: 20_000_000 };

// +1e-9: số tính ra 799,99999 (sai số dấu phẩy động) vẫn phải là 800, không bị rớt xuống 700
const floorLot = (q, lot) => Math.max(0, Math.floor(q / lot + 1e-9) * lot);

function chunks(qty, price, maxOrderVnd, lot) {
  if (!maxOrderVnd || qty * price <= maxOrderVnd) return [qty];
  const per = Math.max(lot, floorLot(maxOrderVnd / price, lot));
  const out = [];
  for (let left = qty; left > 0; left -= per) out.push(Math.min(per, left));
  return out;
}

/**
 * @param {{ holdings: {symbol, qty, sellable?, price}[], cash: number, debt?: number }} account   tiền theo đồng
 * @param {{ weights: Record<string, number>, cashPct?: number, driftPct?: number }} model      tỷ trọng % trên tài sản ròng
 * @param {Record<string, number>} prices  giá hiện tại (đồng) cho mọi mã trong danh mục mẫu và danh mục khách
 * @param {Partial<typeof DEFAULTS>} [opts]
 */
export function planRebalance(account, model, prices, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const warnings = [];
  const holdings = new Map(account.holdings.map((h) => [h.symbol, h]));
  const priceOf = (s) => prices[s] ?? holdings.get(s)?.price ?? null;
  const debt = account.debt || 0;
  const stockValue = account.holdings.reduce((a, h) => a + (priceOf(h.symbol) || 0) * h.qty, 0);
  const nav = stockValue + (account.cash || 0) - debt;
  if (!(nav > 0)) return { ok: false, error: 'Tài sản ròng không dương, không tính được tỷ trọng.', trades: [], rows: [], warnings };

  const weights = Object.fromEntries(Object.entries(model.weights || {}).filter(([, w]) => w > 0));
  const sumW = Object.values(weights).reduce((a, w) => a + w, 0) + (model.cashPct || 0);
  if (sumW > 100.0001) return { ok: false, error: `Tổng tỷ trọng danh mục mẫu là ${sumW.toFixed(2).replace('.', ',')}%, vượt 100%.`, trades: [], rows: [], warnings };
  const drift = model.driftPct ?? 5;
  if (debt > 0) warnings.push('Tài khoản đang có dư nợ ký quỹ: đề xuất không dùng thêm ký quỹ, tiền bán trước hết bù vào phần mua.');

  const symbols = [...new Set([...holdings.keys(), ...Object.keys(weights)])];
  const rows = [];
  for (const s of symbols) {
    const h = holdings.get(s) || { symbol: s, qty: 0, sellable: 0 };
    const p = priceOf(s);
    if (!p) { warnings.push(`Không có giá hiện tại của ${s}, bỏ qua mã này.`); continue; }
    const cur = h.qty * p, target = ((weights[s] || 0) / 100) * nav;
    rows.push({ symbol: s, price: p, qty: h.qty, sellable: h.sellable ?? h.qty, curValue: cur, curWeight: (cur / nav) * 100,
      targetWeight: weights[s] || 0, targetValue: target, inModel: s in weights });
  }

  const trades = [];
  let proceeds = 0;
  // ---- Bán ----
  for (const r of rows) {
    const gap = r.curWeight - r.targetWeight;
    if (r.qty <= 0) continue;
    if (r.inModel && gap < drift) continue;
    const wantQty = r.inModel ? (r.curValue - r.targetValue) / r.price : r.qty;
    // Bán: làm tròn tới lô gần nhất (sát mục tiêu hơn làm tròn xuống), nhưng không vượt phần bán được
    const qty = Math.min(Math.round(wantQty / o.lot) * o.lot, floorLot(r.sellable, o.lot));
    if (!r.inModel && r.sellable % o.lot) warnings.push(`${r.symbol}: còn ${r.sellable % o.lot} cổ phiếu lô lẻ không bán được trên bảng thường.`);
    if (qty * r.price < o.minTradeVnd) continue;
    if (r.sellable < r.qty && wantQty > r.sellable) warnings.push(`${r.symbol}: chỉ bán được ${r.sellable.toLocaleString('vi-VN')} cổ phiếu ngay (phần còn lại chưa về tài khoản).`);
    const value = qty * r.price;
    proceeds += value * (1 - o.feeRate - o.sellTaxRate);
    trades.push({ symbol: r.symbol, side: 'S', qty, price: r.price, value, reason: r.inModel ? `Vượt tỷ trọng mục tiêu ${vi1(gap)} điểm %` : 'Không có trong danh mục mẫu' });
  }

  // ---- Mua ----
  const cashTarget = ((model.cashPct || 0) / 100) * nav;
  let budget = (account.cash || 0) - debt + proceeds - cashTarget;
  const wants = rows
    .filter((r) => r.inModel && r.targetWeight - r.curWeight >= drift)
    .map((r) => ({ r, want: r.targetValue - r.curValue }))
    .filter((x) => x.want > 0);
  const totalWant = wants.reduce((a, x) => a + x.want * (1 + o.feeRate), 0);
  if (wants.length && budget <= 0) warnings.push('Không còn tiền để mua thêm sau khi giữ tiền mặt mục tiêu.');
  const scale = totalWant > 0 && budget > 0 ? Math.min(1, budget / totalWant) : 0;
  if (scale > 0 && scale < 1) warnings.push(`Tiền không đủ mua đủ tỷ trọng mục tiêu: các lệnh mua được thu nhỏ còn khoảng ${(scale * 100).toFixed(0)}%.`);
  const lotCost = (r) => o.lot * r.price * (1 + o.feeRate);
  const buy = new Map();
  // Vòng 1: chia tiền theo tỷ lệ phần thiếu, làm tròn xuống theo lô
  for (const { r, want } of wants.sort((a, b) => b.want - a.want)) {
    let qty = floorLot((want * scale) / (r.price * (1 + o.feeRate)), o.lot);
    if (qty * r.price * (1 + o.feeRate) > budget) qty = floorLot(budget / (r.price * (1 + o.feeRate)), o.lot);
    if (qty <= 0) continue;
    buy.set(r.symbol, qty);
    budget -= qty * r.price * (1 + o.feeRate);
  }
  // Vòng 2: tiền còn dư do làm tròn lô => mua thêm từng lô cho mã đang thiếu nhiều nhất,
  // miễn là thêm lô đó không vượt mục tiêu quá nửa lô
  for (let guard = 0; guard < 10000; guard++) {
    let best = null;
    for (const { r } of wants) {
      const short = r.targetValue - (r.qty + (buy.get(r.symbol) || 0)) * r.price;
      if (lotCost(r) > budget || short < (o.lot * r.price) / 2) continue;
      if (!best || short > best.short) best = { r, short };
    }
    if (!best) break;
    buy.set(best.r.symbol, (buy.get(best.r.symbol) || 0) + o.lot);
    budget -= lotCost(best.r);
  }
  for (const { r } of wants) {
    const qty = buy.get(r.symbol) || 0;
    if (qty <= 0 || qty * r.price < o.minTradeVnd) continue;
    trades.push({ symbol: r.symbol, side: 'B', qty, price: r.price, value: qty * r.price, reason: `Thiếu ${vi1((r.targetWeight - r.curWeight))} điểm % so với mục tiêu` });
  }

  // ---- Kết quả sau khi khớp đủ ----
  const after = new Map(rows.map((r) => [r.symbol, r.qty]));
  let cashAfter = (account.cash || 0);
  let fees = 0;
  for (const t of trades) {
    after.set(t.symbol, after.get(t.symbol) + (t.side === 'B' ? t.qty : -t.qty));
    const f = t.value * o.feeRate + (t.side === 'S' ? t.value * o.sellTaxRate : 0);
    fees += f;
    cashAfter += t.side === 'S' ? t.value - f : -(t.value + f);
    t.orders = chunks(t.qty, t.price, o.maxOrderVnd, o.lot);
    if (t.orders.length > 1) t.note = `Chia thành ${t.orders.length} lệnh để không vượt hạn mức ${o.maxOrderVnd.toLocaleString('vi-VN')} đ mỗi lệnh.`;
  }
  const navAfter = rows.reduce((a, r) => a + after.get(r.symbol) * r.price, cashAfter - debt);
  for (const r of rows) {
    r.afterQty = after.get(r.symbol);
    r.afterWeight = navAfter > 0 ? (r.afterQty * r.price / navAfter) * 100 : null;
    r.action = trades.find((t) => t.symbol === r.symbol)?.side || (Math.abs(r.curWeight - r.targetWeight) < drift ? 'hold' : 'none');
  }
  const turnover = trades.reduce((a, t) => a + t.value, 0);
  return {
    ok: true, nav, drift,
    rows: rows.sort((a, b) => b.targetWeight - a.targetWeight || b.curValue - a.curValue),
    trades: [...trades.filter((t) => t.side === 'S'), ...trades.filter((t) => t.side === 'B')],
    cash: { before: account.cash || 0, after: cashAfter, target: cashTarget, beforeWeight: ((account.cash || 0) / nav) * 100, afterWeight: navAfter > 0 ? (cashAfter / navAfter) * 100 : null },
    turnoverPct: (turnover / nav) * 100, fees,
    maxDeviationBefore: Math.max(0, ...rows.map((r) => Math.abs(r.curWeight - r.targetWeight))),
    maxDeviationAfter: Math.max(0, ...rows.map((r) => Math.abs((r.afterWeight ?? 0) - r.targetWeight))),
    warnings,
  };
}
