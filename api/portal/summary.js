/** GET /api/portal/summary — tài khoản liên kết, phiếu lệnh cần xác nhận, khuyến nghị của khách đang đăng nhập. */
import { route } from '../_http.js';
import { rest } from '../_db.js';

const TICKET = 'id,account_no,client_name,symbol,side,type,price,qty,status,source,created_at,approved_at,expires_at,dnse_order_id,dnse_status';

export default route('GET, OPTIONS', async ({ uid }) => {
  const [links, tickets, advice] = await Promise.all([
    rest('/client_links?select=id,account_no,investor_id,client_name,created_at,broker_id&order=id', { sub: uid }),
    rest(`/order_tickets?select=${TICKET}&order=id.desc&limit=40`, { sub: uid }),
    rest('/advice?select=id,symbol,side,entry_low,entry_high,target,stop,thesis,valid_until,created_at,advice_recipients(seen_at)&order=id.desc&limit=30', { sub: uid }),
  ]);
  const mine = (a) => (a.advice_recipients || []).find(Boolean);
  return {
    linked: links.length > 0,
    links: links.map(({ broker_id, ...l }) => l),
    pending: tickets.filter((t) => t.status === 'pending_client' && Date.now() - Date.parse(t.created_at) < 24 * 3600e3),
    tickets: tickets.filter((t) => t.status !== 'pending_client'),
    advice: advice.map(({ advice_recipients, ...a }) => ({ ...a, seen: !!mine({ advice_recipients })?.seen_at, expired: a.valid_until ? Date.parse(a.valid_until) < Date.now() : false })),
  };
}, { auth: true });
