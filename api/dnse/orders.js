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

const TYPES = ['LO', 'MTL', 'ATO', 'ATC'];
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

async function preview(uid, b) {
  const symbol = String(b.symbol || '').toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) throw new dnse.DnseError('Mã chứng khoán không hợp lệ.', 400);
  if (b.side !== 'B' && b.side !== 'S') throw new dnse.DnseError('Lệnh phải là mua hoặc bán.', 400);
  if (!TYPES.includes(b.type)) throw new dnse.DnseError('Loại lệnh không hợp lệ.', 400);
  const qty = Number(b.qty);
  if (!Number.isInteger(qty) || qty <= 0 || qty % 100 !== 0) throw new dnse.DnseError('Khối lượng phải là bội số của 100.', 400);

  const info = await dnse.accounts();
  const acc = (info?.accounts || []).find((a) => a.id === String(b.account || ''));
  if (!acc) throw new dnse.DnseError('Tiểu khoản không thuộc tài khoản của bạn.', 400);

  const sec = await dnse.securityDef(symbol);
  if (!sec?.ceilingPrice || !sec?.floorPrice) throw new dnse.DnseError(`Không lấy được trần/sàn của ${symbol} từ DNSE.`, 502);
  // Giá gửi lên dùng cùng đơn vị với secdef. Tự nhận biết: trần > 1000 nghĩa là đơn vị đồng.
  const unitVnd = sec.ceilingPrice > 1000;
  const toVnd = (p) => (unitVnd ? p : p * 1000);

  let apiPrice;
  if (b.type === 'LO') {
    const k = Number(b.price); // người dùng nhập nghìn đồng, như bảng giá
    if (!Number.isFinite(k) || k <= 0) throw new dnse.DnseError('Nhập giá đặt.', 400);
    apiPrice = unitVnd ? Math.round(k * 1000) : Math.round(k * 100) / 100;
    if (apiPrice < sec.floorPrice || apiPrice > sec.ceilingPrice) {
      throw new dnse.DnseError(`Giá phải trong khoảng sàn ${fmt(toVnd(sec.floorPrice))} đ đến trần ${fmt(toVnd(sec.ceilingPrice))} đ.`, 400);
    }
  }
  const estValue = toVnd(b.type === 'LO' ? apiPrice : sec.ceilingPrice) * qty; // lệnh thị trường: ước tính theo giá trần
  if (estValue > dnse.maxOrderVnd()) {
    throw new dnse.DnseError(`Giá trị lệnh khoảng ${fmt(estValue)} đ vượt hạn mức ${fmt(dnse.maxOrderVnd())} đ mỗi lệnh.`, 400);
  }

  const order = { accountNo: acc.id, symbol, side: b.side === 'B' ? 'NB' : 'NS', orderType: b.type, quantity: qty, ...(b.type === 'LO' ? { price: apiPrice } : {}) };
  return {
    summary: {
      text: `${b.side === 'B' ? 'MUA' : 'BÁN'} ${qty.toLocaleString('vi-VN')} ${symbol} ${b.type === 'LO' ? `giá ${fmt(toVnd(apiPrice))} đ` : `lệnh ${b.type}`}, tiểu khoản ${acc.id}`,
      estValueVnd: Math.round(estValue),
      ceilingVnd: toVnd(sec.ceilingPrice), floorVnd: toVnd(sec.floorPrice), referenceVnd: sec.basicPrice ? toVnd(sec.basicPrice) : null,
    },
    confirm: dnse.makeConfirm(uid, order),
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
