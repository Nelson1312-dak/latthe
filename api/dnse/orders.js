/**
 * Lệnh THẬT trên tài khoản DNSE của chủ sở hữu. Hai bước, không có đường tắt:
 *   POST   /api/dnse/orders { step: 'preview', account, symbol, side: 'B'|'S', type, price?, qty }
 *          -> kiểm tra giá theo trần/sàn thật của DNSE, hạn mức, trả tóm tắt + mã xác nhận (90 giây)
 *   POST   /api/dnse/orders { step: 'place', confirm }
 *          -> gửi ĐÚNG lệnh đã xem trước (nội dung lấy từ mã xác nhận đã ký, không lấy từ body), mỗi mã một lần
 *   DELETE /api/dnse/orders?account=...&id=... -> hủy lệnh
 * Đặt/hủy chỉ chạy khi DNSE_REAL_TRADING=1 và đã xác thực OTP. Mọi lần gửi đều ghi trade.dnse_audit.
 */
import crypto from 'node:crypto';
import { route } from '../_http.js';
import * as dnse from '../_dnse.js';
import { buildOrder } from '../_desk.js';

async function preview(uid, b) {
  const info = await dnse.accounts();
  const acc = (info?.accounts || []).find((a) => a.id === String(b.account || ''));
  if (!acc) throw new dnse.DnseError('Tiểu khoản không thuộc tài khoản của bạn.', 400);
  const built = await buildOrder({ accountNo: acc.id, symbol: b.symbol, side: b.side, type: b.type, price: b.price, qty: b.qty });
  return {
    summary: { text: `${built.text}, tiểu khoản ${acc.id}`, estValueVnd: built.estValueVnd, ceilingVnd: built.ceilingVnd, floorVnd: built.floorVnd },
    confirm: dnse.makeConfirm(uid, built.order),
    expiresInSec: 90,
    realTrading: dnse.realTradingEnabled(),
  };
}

export default route('POST, DELETE, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'POST' && body.step === 'preview') return preview(uid, body);

  if (!dnse.realTradingEnabled()) {
    return res.status(403).json({ error: 'Đặt/hủy lệnh thật đang TẮT trên máy chủ (DNSE_REAL_TRADING).', code: 'disabled' });
  }
  const tt = dnse.readTradingCookie(req, uid);
  if (!tt) return res.status(401).json({ error: 'Cần xác thực OTP DNSE trước khi giao dịch.', code: 'need_otp' });

  if (req.method === 'POST' && body.step === 'place') {
    const c = dnse.readConfirm(uid, body.confirm);
    if (!c) return res.status(400).json({ error: 'Mã xác nhận không hợp lệ hoặc đã quá 90 giây, hãy xem trước lệnh lại.', code: 'confirm' });
    const auditId = await dnse.auditStart(uid, 'place', c.nonce, c.order);
    try {
      const result = await dnse.placeOrder(tt.token, c.order);
      await dnse.auditFinish(uid, auditId, { ok: true, result });
      return res.status(201).json({ order: result });
    } catch (e) {
      await dnse.auditFinish(uid, auditId, { ok: false, error: e.message });
      throw e;
    }
  }

  if (req.method === 'DELETE') {
    const q = new URL(req.url, 'http://x').searchParams;
    const acc = String(q.get('account') || ''), id = String(q.get('id') || '');
    if (!/^\d{1,20}$/.test(id) || !/^[0-9A-Za-z]{4,20}$/.test(acc)) return res.status(400).json({ error: 'Thiếu tiểu khoản hoặc số hiệu lệnh.' });
    const auditId = await dnse.auditStart(uid, 'cancel', crypto.randomUUID(), { account: acc, id });
    try {
      await dnse.cancelOrder(tt.token, acc, id);
      await dnse.auditFinish(uid, auditId, { ok: true });
      return { cancelled: true };
    } catch (e) {
      await dnse.auditFinish(uid, auditId, { ok: false, error: e.message });
      throw e;
    }
  }
  return res.status(400).json({ error: 'Thao tác không hợp lệ.' });
}, { auth: true });
