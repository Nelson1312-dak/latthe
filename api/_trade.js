/**
 * api/_trade.js — engine giao dịch giả lập: kiểm tra lệnh theo luật sàn, khớp theo nến thật của DNSE.
 * Tiền/cổ phiếu được cập nhật trong DB bằng hàm SQL nguyên tử (db/004-trade-functions.sql).
 * Underscore prefix => Vercel không expose thành route.
 *
 * Quy tắc khớp (mô phỏng, không phải sổ lệnh thật):
 *  - LO mua khớp khi giá thấp nhất của một nến 1 phút SAU lúc đặt chạm giá đặt (giá khớp = min(giá đặt, giá mở nến)); LO bán đối xứng.
 *  - LO "khớp ngay" (mua >= giá hiện tại, bán <= giá hiện tại) trong phiên liên tục: khớp tại giá hiện tại.
 *  - MTL: chỉ trong phiên liên tục, khớp ngay tại giá hiện tại.
 *  - ATO: khớp tại giá mở cửa của phiên đầu tiên mở sau lúc đặt. ATC: khớp tại giá đóng cửa của phiên chưa kết thúc lúc đặt.
 *  - Khớp được xét lười (lazy) mỗi khi người dùng gọi API, dựa trên toàn bộ nến từ lúc đặt lệnh, nên không bỏ lỡ lần chạm giá.
 */
import { rest, DbError } from './_db.js';
import { BY_SYMBOL, fetchBars, fetchRange, quoteFromBars, sessionState, tickU } from './_market.js';
import { hopLe, moTaTach } from './_lot.js';

const ATO_END_S = 15 * 60;          // 9:15
const ATC_END_S = (14 * 60 + 45 - 9 * 60) * 60; // 14:45, tính từ mốc 9:00 (t của nến ngày)

export class TradeError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function validate(input) {
  const symbol = String(input.symbol || '').toUpperCase();
  const info = BY_SYMBOL[symbol];
  if (!info) throw new TradeError('Mã chưa được hỗ trợ.');
  const side = input.side;
  if (side !== 'B' && side !== 'S') throw new TradeError('Lệnh phải là mua hoặc bán.');
  const type = input.type;
  if (!['LO', 'MTL', 'ATO', 'ATC'].includes(type)) throw new TradeError('Loại lệnh không hợp lệ.');
  const qty = Number(input.qty);
  // Giao dịch thử phải theo đúng luật của sàn, nếu không thì tập ở đây xong ra thật lại sai:
  // lô chẵn là bội số 100, lô lẻ 1-99 và chỉ đi bằng LO.
  if (!Number.isInteger(qty) || qty <= 0) throw new TradeError('Khối lượng không hợp lệ.');
  if (!hopLe(qty, type)) {
    throw new TradeError(qty < 100
      ? 'Lô lẻ (1-99 cổ phiếu) chỉ đặt được bằng lệnh LO.'
      : `Khối lượng phải là bội số của 100, hoặc 1-99 nếu là lô lẻ. ${moTaTach(qty)}.`);
  }
  if (qty > 1_000_000) throw new TradeError('Khối lượng tối đa mỗi lệnh là 1.000.000.');
  let price = null;
  if (type === 'LO') {
    price = Number(input.price);
    if (!Number.isFinite(price) || Math.round(price * 100) / 100 !== price) throw new TradeError('Giá đặt không hợp lệ.');
  }
  return { info, symbol, side, type, qty, price };
}

/** Đặt lệnh: kiểm tra luật sàn, phong tỏa vốn/cổ phiếu trong DB, khớp ngay nếu đủ điều kiện. */
export async function placeOrder(uid, input) {
  const { info, symbol, side, type, qty, price } = validate(input);
  const quote = quoteFromBars(info, await fetchBars(symbol, 6));
  if (!quote) throw new TradeError('Chưa có giá cho mã này, thử lại sau.', 503);
  const session = sessionState();

  if (type === 'LO') {
    if (price < quote.floor || price > quote.ceil) throw new TradeError(`Giá phải trong khoảng ${quote.floor.toFixed(2)} đến ${quote.ceil.toFixed(2)}.`);
    const u = Math.round(price * 100);
    if (u % tickU(u, info.ex)) throw new TradeError(`Giá chưa đúng bước giá ${tickU(u, info.ex) * 10} đồng.`);
  }
  if (type === 'MTL' && session !== 'open') throw new TradeError('Lệnh MTL chỉ đặt được trong phiên khớp lệnh liên tục.');
  if (type === 'ATO' && !['closed', 'ato'].includes(session)) throw new TradeError('Lệnh ATO chỉ đặt ngoài giờ hoặc trong đợt khớp lệnh mở cửa.');
  if (type === 'ATC' && session === 'closed') throw new TradeError('Lệnh ATC chỉ đặt được trong ngày giao dịch.');

  const refPrice = type === 'LO' ? price : quote.ceil; // mua lệnh thị trường phong tỏa theo giá trần cho chắc
  let order;
  try {
    order = await rest('/rpc/place_order', {
      sub: uid, method: 'POST',
      body: { p_symbol: symbol, p_side: side, p_type: type, p_price: price, p_qty: qty, p_ref_price: refPrice },
    });
  } catch (e) {
    if (/insufficient_cash/.test(e.message)) throw new TradeError('Không đủ sức mua.');
    if (/insufficient_shares/.test(e.message)) throw new TradeError('Không đủ cổ phiếu khả dụng để bán.');
    throw e;
  }

  // Khớp ngay
  const last = quote.last;
  const marketable = type === 'MTL' ||
    (type === 'LO' && session === 'open' && (side === 'B' ? price >= last : price <= last));
  if (marketable) {
    order = await rest('/rpc/fill_order', { sub: uid, method: 'POST', body: { p_id: order.id, p_price: last } });
  }
  return order;
}

export async function cancelOrder(uid, id) {
  if (!Number.isInteger(id) || id <= 0) throw new TradeError('Mã lệnh không hợp lệ.');
  try {
    return await rest('/rpc/cancel_order', { sub: uid, method: 'POST', body: { p_id: id } });
  } catch (e) {
    if (/order_not_found/.test(e.message)) throw new TradeError('Không tìm thấy lệnh.', 404);
    throw e;
  }
}

/** Giá khớp của một lệnh đang chờ, hoặc null nếu chưa đủ điều kiện. */
export function decideFill(o, minuteBars, dailyBars, nowS) {
  const created = Math.floor(Date.parse(o.created_at) / 1000);
  if (o.type === 'LO') {
    const p = Number(o.price);
    const from = Math.floor(created / 60) * 60 + 60; // chỉ xét nến bắt đầu sau phút đặt lệnh
    for (const b of minuteBars) {
      if (b.t < from) continue;
      if (o.side === 'B' && b.l <= p) return Math.min(p, b.o);
      if (o.side === 'S' && b.h >= p) return Math.max(p, b.o);
    }
    return null;
  }
  if (o.type === 'ATO') {
    const b = dailyBars.find((d) => d.t + ATO_END_S > created && nowS >= d.t + ATO_END_S);
    return b ? b.o : null;
  }
  if (o.type === 'ATC') {
    const b = dailyBars.find((d) => created < d.t + ATC_END_S && nowS >= d.t + ATC_END_S);
    return b ? b.c : null;
  }
  return null;
}

/** Xét khớp mọi lệnh đang chờ của người dùng. Lỗi nguồn giá của một mã không chặn các mã khác. */
export async function matchPending(uid) {
  const waiting = await rest('/orders?status=eq.wait&select=id,symbol,side,type,price,qty,created_at&order=id.asc', { sub: uid });
  if (!waiting?.length) return 0;
  const nowS = Math.floor(Date.now() / 1000);
  const bySym = new Map();
  for (const o of waiting) (bySym.get(o.symbol) || bySym.set(o.symbol, []).get(o.symbol)).push(o);

  let filled = 0;
  for (const [symbol, orders] of bySym) {
    const earliest = Math.min(...orders.map((o) => Date.parse(o.created_at) / 1000));
    let minute = [], daily = [];
    try {
      [minute, daily] = await Promise.all([
        orders.some((o) => o.type === 'LO') ? fetchRange(symbol, earliest - 120, nowS, '1') : [],
        orders.some((o) => o.type !== 'LO') ? fetchRange(symbol, earliest - 2 * 86400, nowS, '1D') : [],
      ]);
    } catch { continue; }
    for (const o of orders) {
      const price = decideFill(o, minute, daily, nowS);
      if (price == null) continue;
      const r = await rest('/rpc/fill_order', { sub: uid, method: 'POST', body: { p_id: o.id, p_price: price } });
      if (r?.status === 'ok') filled++;
    }
  }
  return filled;
}

export { DbError };
