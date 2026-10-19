/**
 * POST /api/broker/send { id } — gửi phiếu lệnh đã duyệt lên DNSE, trên tài khoản khách.
 * Kiểm tra lại toàn bộ ngay lúc gửi: quyền BROKER (lấy mới từ care-by), trạng thái và hạn phiếu,
 * trần/sàn, hạn mức mỗi lệnh và trần ngày của tiểu khoản, trading token của môi giới.
 * Ghi nhật ký trước khi gọi DNSE.
 *
 * Kết quả gửi có BA nhánh, không phải hai:
 *   thành công          -> 'sent'    + dnse_order_id
 *   DNSE từ chối (4xx)  -> 'failed'  chắc chắn không có lệnh nào trên sàn
 *   không rõ (timeout, DNSE 5xx) -> 'unknown', phải đối soát sổ lệnh (/api/broker/tickets reconcile)
 */
import crypto from 'node:crypto';
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient, buildOrder } from '../../../api/_desk.js';

export default route('POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);
  if (!dnse.realTradingEnabled()) return res.status(403).json({ error: 'Đặt lệnh thật đang TẮT trên máy chủ (DNSE_REAL_TRADING).', code: 'disabled' });
  const tt = dnse.readTradingCookie(req, uid);
  if (!tt) return res.status(401).json({ error: 'Cần xác thực OTP DNSE trước khi gửi lệnh.', code: 'need_otp' });

  const id = Number(body.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Thiếu mã phiếu.' });
  const t = (await rest(`/order_tickets?id=eq.${id}&select=*&limit=1`, { sub: uid }))[0];
  if (!t) return res.status(404).json({ error: 'Không tìm thấy phiếu lệnh.' });
  if (t.status !== 'approved') return res.status(409).json({ error: `Phiếu đang ở trạng thái "${t.status}", chưa gửi được.` });
  if (t.expires_at && new Date(t.expires_at) < new Date()) {
    await rest(`/order_tickets?id=eq.${id}`, { sub: uid, method: 'PATCH', body: { status: 'expired' } });
    return res.status(409).json({ error: 'Phiếu đã quá 15 phút kể từ khi duyệt, hãy tạo lại để xác nhận giá với khách.' });
  }

  await requireClient(t.account_no, { need: 'trade', fresh: true });
  const built = await buildOrder({ accountNo: t.account_no, symbol: t.symbol, side: t.side, type: t.type, price: t.price, qty: t.qty });
  // Trần ngày của tiểu khoản. Kiểm TRƯỚC khi khóa phiếu: bị chặn thì phiếu vẫn ở 'approved' để gửi lại sau.
  await dnse.assertDailyLimit(uid, t.account_no, built.estValueVnd);

  // Khóa phiếu trước khi gọi DNSE: chỉ một request chuyển được approved -> sent
  const locked = await rest(`/order_tickets?id=eq.${id}&status=eq.approved`, {
    sub: uid, method: 'PATCH', prefer: 'return=representation', body: { status: 'sent', sent_at: new Date().toISOString() },
  });
  if (!locked.length) return res.status(409).json({ error: 'Phiếu này đang được gửi hoặc đã gửi.' });

  const auditId = await dnse.auditStart(uid, 'place', `ticket-${id}-${crypto.randomUUID()}`, { ...built.order, estValueVnd: built.estValueVnd, ticketId: id, source: t.source });
  try {
    const result = await dnse.placeOrder(tt.token, built.order);
    await dnse.auditFinish(uid, auditId, { ok: true, result });
    const rows = await rest(`/order_tickets?id=eq.${id}&select=*`, {
      sub: uid, method: 'PATCH', prefer: 'return=representation',
      body: { dnse_order_id: result?.id != null ? String(result.id) : null, dnse_status: result?.orderStatus || result?.status || null },
    });
    return { ticket: rows[0], order: result };
  } catch (e) {
    // Hết giờ chờ hoặc DNSE lỗi 5xx: request đã rời đi, lệnh CÓ THỂ đang nằm trên sàn. Ghi 'failed'
    // ở đây là nói dối màn hình, và môi giới sẽ tạo phiếu mới -> khách khớp gấp đôi. Chỉ 'failed'
    // khi DNSE trả lời rõ là từ chối; còn lại để 'unknown' và bắt đối soát sổ lệnh.
    const chuaRo = !!e.chuaRo;
    await dnse.auditFinish(uid, auditId, { ok: false, chuaRo, error: e.message });
    await rest(`/order_tickets?id=eq.${id}`, {
      sub: uid, method: 'PATCH',
      body: { status: chuaRo ? 'unknown' : 'failed', error: String(e.message).slice(0, 500) },
    });
    if (chuaRo) {
      return res.status(502).json({
        error: 'Không rõ DNSE đã nhận lệnh hay chưa. ĐỪNG gửi lại — bấm "Đối soát" để kiểm tra sổ lệnh của khách trước.',
        code: 'unknown', ticketId: id,
      });
    }
    throw e;
  }
}, { auth: true });
