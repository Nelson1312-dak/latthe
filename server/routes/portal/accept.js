/**
 * POST   /api/portal/accept { token }  — khách dùng mã mời để liên kết tài khoản với môi giới.
 * DELETE /api/portal/accept?link=<id>  — khách tự hủy liên kết.
 *
 * Khách phải tự rút lại được quyền mình đã trao, không phải đi nhờ môi giới. Phía DNSE thì khách
 * gỡ ủy quyền trên Entrade X; Lật Bài không với tới được chỗ đó, nên nói rõ trong câu trả lời.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { hashToken } from '../../../api/_auth.js';
import { checkRateLimit, getClientIp } from '../../../api/_rateLimit.js';

export default route('POST, DELETE, OPTIONS', async ({ req, res, uid, body }) => {
  if (req.method === 'DELETE') {
    const id = Number(new URL(req.url, 'http://x').searchParams.get('link'));
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Thiếu mã liên kết.' });
    // RLS chỉ cho khách xóa đúng dòng của mình (link_client_del trong db/017).
    const rows = await rest(`/client_links?id=eq.${id}&select=id,account_no`, {
      sub: uid, method: 'DELETE', prefer: 'return=representation',
    });
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy liên kết này.' });
    return { unlinked: rows[0], ghiChu: 'Đã ngắt khỏi Lật Bài. Muốn thu hồi cả ủy quyền giao dịch thì làm trên app Entrade X của DNSE.' };
  }

  const rl = await checkRateLimit(getClientIp(req), 'invite');
  if (!rl.allowed) return res.status(429).json({ error: 'Thử quá nhiều lần, đợi một chút rồi thử lại.' });
  const token = String(body.token || '').trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return res.status(400).json({ error: 'Mã mời không hợp lệ.' });
  try {
    const link = await rest('/rpc/accept_invite', { sub: uid, method: 'POST', body: { p_hash: hashToken(token) } });
    return { linked: true, account: link.account_no, name: link.client_name };
  } catch (e) {
    if (/invite_invalid/.test(e.message)) return res.status(410).json({ error: 'Mã mời không đúng, đã dùng hoặc đã hết hạn. Hãy xin môi giới gửi lại.' });
    if (/invite_own/.test(e.message)) return res.status(400).json({ error: 'Bạn không thể nhận lời mời do chính mình tạo.' });
    if (/already_linked_other_broker/.test(e.message)) {
      return res.status(409).json({ error: 'Tiểu khoản này đang liên kết với một môi giới khác. Hãy hủy liên kết cũ trước rồi nhận lời mời này.' });
    }
    throw e;
  }
}, { auth: true });
