/**
 * api/router.js: MỘT serverless function duy nhất cho toàn bộ API.
 *
 * Vercel gói Hobby chỉ cho tối đa 12 function mỗi lần deploy, và mỗi file trong api/ là một function.
 * Vì vậy các endpoint nằm ở server/routes/ và được định tuyến ở đây. vercel.json viết lại
 * /api/<đường dẫn> thành /api/router?p=<đường dẫn>, query gốc được giữ nguyên.
 * Thêm endpoint mới: tạo file trong server/routes/ rồi thêm một dòng vào bảng ROUTES.
 */
import r_auth_dnse from '../server/routes/auth/dnse.js';
import r_auth_google from '../server/routes/auth/google.js';
import r_auth_google_callback from '../server/routes/auth/google-callback.js';
import r_auth_login from '../server/routes/auth/login.js';
import r_auth_logout from '../server/routes/auth/logout.js';
import r_auth_register from '../server/routes/auth/register.js';
import r_ai_jobs from '../server/routes/ai/jobs.js';
import r_broker_advice from '../server/routes/broker/advice.js';
import r_broker_analytics from '../server/routes/broker/analytics.js';
import r_broker_client from '../server/routes/broker/client.js';
import r_broker_clients from '../server/routes/broker/clients.js';
import r_broker_invites from '../server/routes/broker/invites.js';
import r_broker_models from '../server/routes/broker/models.js';
import r_broker_notes from '../server/routes/broker/notes.js';
import r_broker_profile from '../server/routes/broker/profile.js';
import r_broker_realtime from '../server/routes/broker/realtime.js';
import r_broker_send from '../server/routes/broker/send.js';
import r_broker_symbol from '../server/routes/broker/symbol.js';
import r_broker_tickets from '../server/routes/broker/tickets.js';
import r_brokers from '../server/routes/brokers.js';
import r_dnse_account from '../server/routes/dnse/account.js';
import r_dnse_orders from '../server/routes/dnse/orders.js';
import r_dnse_otp from '../server/routes/dnse/otp.js';
import r_health from '../server/routes/health.js';
import r_history from '../server/routes/history.js';
import r_market from '../server/routes/market.js';
import r_me from '../server/routes/me.js';
import r_orders from '../server/routes/orders.js';
import r_portal_accept from '../server/routes/portal/accept.js';
import r_portal_advice_seen from '../server/routes/portal/advice-seen.js';
import r_portal_analytics from '../server/routes/portal/analytics.js';
import r_portal_decide from '../server/routes/portal/decide.js';
import r_portal_notes from '../server/routes/portal/notes.js';
import r_portal_portfolio from '../server/routes/portal/portfolio.js';
import r_portal_profile from '../server/routes/portal/profile.js';
import r_portal_summary from '../server/routes/portal/summary.js';
import r_symbol from '../server/routes/symbol.js';
import r_shs_account from '../server/routes/shs/account.js';
import r_shs_connect from '../server/routes/shs/connect.js';
import r_shs_orders from '../server/routes/shs/orders.js';

const ROUTES = {
  'ai/jobs': r_ai_jobs,
  'auth/dnse': r_auth_dnse,
  'auth/google': r_auth_google,
  'auth/google-callback': r_auth_google_callback,
  'auth/login': r_auth_login,
  'auth/logout': r_auth_logout,
  'auth/register': r_auth_register,
  'broker/advice': r_broker_advice,
  'broker/analytics': r_broker_analytics,
  'broker/client': r_broker_client,
  'broker/clients': r_broker_clients,
  'broker/invites': r_broker_invites,
  'broker/models': r_broker_models,
  'broker/notes': r_broker_notes,
  'broker/profile': r_broker_profile,
  'broker/realtime': r_broker_realtime,
  'broker/send': r_broker_send,
  'broker/symbol': r_broker_symbol,
  'broker/tickets': r_broker_tickets,
  'brokers': r_brokers,
  'dnse/account': r_dnse_account,
  'dnse/orders': r_dnse_orders,
  'dnse/otp': r_dnse_otp,
  'health': r_health,
  'history': r_history,
  'market': r_market,
  'me': r_me,
  'orders': r_orders,
  'portal/accept': r_portal_accept,
  'portal/advice-seen': r_portal_advice_seen,
  'portal/analytics': r_portal_analytics,
  'portal/decide': r_portal_decide,
  'portal/notes': r_portal_notes,
  'portal/portfolio': r_portal_portfolio,
  'portal/profile': r_portal_profile,
  'portal/summary': r_portal_summary,
  'symbol': r_symbol,
  'shs/account': r_shs_account,
  'shs/connect': r_shs_connect,
  'shs/orders': r_shs_orders,
};

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = (u.searchParams.get('p') || '').split('/').filter(Boolean).join('/');
  const h = Object.prototype.hasOwnProperty.call(ROUTES, p) ? ROUTES[p] : null;
  if (!h) return res.status(404).json({ error: 'Không tìm thấy.' });
  u.searchParams.delete('p');
  req.url = '/api/' + p + u.search;   // các handler đọc query từ req.url như bình thường
  return h(req, res);
}
