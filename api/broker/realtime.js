/** GET /api/broker/realtime[?account=] — trạng thái worker realtime và sự kiện lệnh gần nhất từ DNSE WebSocket. */
import { route } from '../_http.js';
import { rest } from '../_db.js';
import * as dnse from '../_dnse.js';

export default route('GET, OPTIONS', async ({ req, uid }) => {
  await dnse.assertOwner(uid);
  const acc = new URL(req.url, 'http://x').searchParams.get('account');
  const f = acc && /^[0-9A-Za-z]{4,20}$/.test(acc) ? `&account_no=eq.${acc}` : '';
  const [ws, events] = await Promise.all([
    rest('/worker_status?name=eq.broker-stream&select=at,info&limit=1', { sub: uid }),
    rest(`/order_events?select=id,account_no,dnse_order_id,symbol,side,order_type,price,quantity,fill_quantity,status,event_at${f}&order=id.desc&limit=40`, { sub: uid }),
  ]);
  const w = ws[0];
  const ageSec = w ? Math.round((Date.now() - Date.parse(w.at)) / 1000) : null;
  return { worker: w ? { alive: ageSec < 90, ageSec, ...w.info } : { alive: false }, events };
}, { auth: true });
