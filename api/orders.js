/**
 * POST   /api/orders { symbol, side: 'B'|'S', type: 'LO'|'MTL'|'ATO'|'ATC', price?, qty } — đặt lệnh (giả lập)
 * DELETE /api/orders?id=123 — hủy lệnh đang chờ
 */
import { route } from './_http.js';
import { placeOrder, cancelOrder } from './_trade.js';

export default route('POST, DELETE, OPTIONS', async ({ req, res, uid, body }) => {
  if (req.method === 'POST') {
    const order = await placeOrder(uid, body);
    return res.status(201).json({ order });
  }
  const id = parseInt(new URL(req.url, 'http://x').searchParams.get('id') || '', 10);
  return { order: await cancelOrder(uid, id) };
}, { auth: true });
