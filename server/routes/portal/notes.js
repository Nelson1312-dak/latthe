/**
 * Nhận xét môi giới gửi cho khách.
 *   GET  /api/portal/notes
 *   POST /api/portal/notes { id }   đánh dấu đã xem
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  if (req.method === 'GET') {
    return { notes: await rest('/client_notes?select=id,account_no,title,body,seen_at,created_at&order=id.desc&limit=30', { sub: uid }) };
  }
  const id = Number(body.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Thiếu mã nhận xét.' });
  await rest(`/client_notes?id=eq.${id}&seen_at=is.null`, { sub: uid, method: 'PATCH', body: { seen_at: new Date().toISOString() } });
  return { ok: true };
}, { auth: true });
