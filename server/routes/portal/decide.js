/**
 * POST /api/portal/decide { id, approve } — khách xác nhận hoặc từ chối phiếu lệnh môi giới đề xuất.
 *
 * Gửi kèm IP và thiết bị của khách để hàm SQL ghi lại cùng bản chụp nội dung phiếu. Trước đây chỉ
 * có approved_by/approved_at, nên nếu sau này tranh chấp một lệnh thì chỉ chứng minh được "khách
 * bấm đồng ý lúc mấy giờ", không chứng minh được khách đồng ý ĐIỀU GÌ — mà các cột của phiếu thì
 * vẫn sửa được về sau. docs/ARCHITECTURE.md mục 2 đặt ra yêu cầu bằng chứng chỉ thị, đây là chỗ nó
 * thực sự được ghi.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import { getClientIp } from '../../../api/_rateLimit.js';

export default route('POST, OPTIONS', async ({ req, res, uid, body }) => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0 || typeof body.approve !== 'boolean') return res.status(400).json({ error: 'Thiếu mã phiếu hoặc quyết định.' });
  try {
    const t = await rest('/rpc/client_decide_ticket', {
      sub: uid, method: 'POST',
      body: { p_id: id, p_approve: body.approve, p_ip: getClientIp(req), p_agent: req.headers['user-agent'] || null },
    });
    return { ticket: { id: t.id, status: t.status, expires_at: t.expires_at } };
  } catch (e) {
    if (/ticket_not_found/.test(e.message)) return res.status(404).json({ error: 'Không tìm thấy phiếu lệnh này.' });
    if (/ticket_not_pending/.test(e.message)) return res.status(409).json({ error: 'Phiếu này đã được xử lý rồi.' });
    if (/ticket_expired/.test(e.message)) return res.status(410).json({ error: 'Phiếu đã quá 24 giờ, hãy nhờ môi giới tạo lại.' });
    throw e;
  }
}, { auth: true });
