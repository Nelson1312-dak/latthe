/** POST /api/portal/advice-seen { id } — đánh dấu khách đã xem khuyến nghị. */
import { route } from '../_http.js';
import { rest } from '../_db.js';

export default route('POST, OPTIONS', async ({ res, uid, body }) => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Thiếu mã khuyến nghị.' });
  await rest(`/advice_recipients?advice_id=eq.${id}&user_id=eq.${uid}&seen_at=is.null`, { sub: uid, method: 'PATCH', body: { seen_at: new Date().toISOString() } });
  return { ok: true };
}, { auth: true });
