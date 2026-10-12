/** POST /api/portal/decide { id, approve } — khách xác nhận hoặc từ chối phiếu lệnh môi giới đề xuất. */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';

export default route('POST, OPTIONS', async ({ res, uid, body }) => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0 || typeof body.approve !== 'boolean') return res.status(400).json({ error: 'Thiếu mã phiếu hoặc quyết định.' });
  try {
    const t = await rest('/rpc/client_decide_ticket', { sub: uid, method: 'POST', body: { p_id: id, p_approve: body.approve } });
    return { ticket: { id: t.id, status: t.status, expires_at: t.expires_at } };
  } catch (e) {
    if (/ticket_not_found/.test(e.message)) return res.status(404).json({ error: 'Không tìm thấy phiếu lệnh này.' });
    if (/ticket_not_pending/.test(e.message)) return res.status(409).json({ error: 'Phiếu này đã được xử lý rồi.' });
    if (/ticket_expired/.test(e.message)) return res.status(410).json({ error: 'Phiếu đã quá 24 giờ, hãy nhờ môi giới tạo lại.' });
    throw e;
  }
}, { auth: true });
