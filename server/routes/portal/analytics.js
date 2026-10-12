/**
 * GET /api/portal/analytics?account=<tiểu khoản> — khách xem cơ cấu, rủi ro, hiệu suất danh mục của chính mình và độ lệch
 * so với danh mục mẫu môi giới đã gán. Không có đề xuất lệnh: tái phân bổ do môi giới lập và gửi phiếu cho khách xác nhận.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';
import { analyzeAccount } from '../../../api/_advisory.js';

export default route('GET, OPTIONS', async ({ req, res, uid }) => {
  const acc = new URL(req.url, 'http://x').searchParams.get('account');
  if (!/^[0-9A-Za-z]{4,20}$/.test(acc || '')) return res.status(400).json({ error: 'Thiếu tiểu khoản.' });
  const link = (await rest(`/client_links?account_no=eq.${acc}&select=id&limit=1`, { sub: uid }))[0];
  if (!link) return res.status(403).json({ error: 'Tiểu khoản này chưa được liên kết với tài khoản của bạn.' });
  if (!process.env.DNSE_API_KEY) throw new dnse.DnseError('Kết nối DNSE chưa được cấu hình.', 503, 'config');
  try { await requireClient(acc, { need: 'view' }); }
  catch { return res.status(409).json({ error: 'Liên kết với môi giới trên DNSE không còn hiệu lực. Hãy liên hệ môi giới.', code: 'unlinked' }); }
  return analyzeAccount({ accountNo: acc, sub: uid, side: 'client', plan: false });
}, { auth: true });
