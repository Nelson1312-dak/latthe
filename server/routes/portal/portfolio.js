/**
 * GET /api/portal/portfolio?account=<tiểu khoản> — tài sản của chính khách (đọc qua API key của môi giới).
 * Chỉ trả cho tiểu khoản khách đã liên kết VÀ môi giới vẫn còn quyền theo dõi trên DNSE.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';

const val = (r) => (r.status === 'fulfilled' ? r.value : { error: 'Không tải được dữ liệu từ DNSE.' });

export default route('GET, OPTIONS', async ({ req, res, uid }) => {
  const acc = new URL(req.url, 'http://x').searchParams.get('account');
  if (!/^[0-9A-Za-z]{4,20}$/.test(acc || '')) return res.status(400).json({ error: 'Thiếu tiểu khoản.' });
  const link = (await rest(`/client_links?account_no=eq.${acc}&select=id&limit=1`, { sub: uid }))[0];
  if (!link) return res.status(403).json({ error: 'Tiểu khoản này chưa được liên kết với tài khoản của bạn.' });
  if (!process.env.DNSE_API_KEY) throw new dnse.DnseError('Kết nối DNSE chưa được cấu hình.', 503, 'config');
  let c;
  try { c = await requireClient(acc, { need: 'view' }); }
  catch { return res.status(409).json({ error: 'Liên kết với môi giới trên DNSE không còn hiệu lực. Hãy liên hệ môi giới.', code: 'unlinked' }); }
  const [balance, positions, orders] = (await Promise.allSettled([dnse.balances(c.accountNo), dnse.positions(c.accountNo), dnse.orderBook(c.accountNo)])).map(val);
  return { account: c.accountNo, name: c.name, balance, positions, orders };
}, { auth: true });
