/**
 * Lệnh THẬT trên tài khoản SHS của chủ hệ thống. Hai bước, giống hệt đường DNSE:
 *   POST   /api/shs/orders { step: 'preview', sub, symbol, side: 'B'|'S', type, price?, qty }
 *          -> kiểm trần/sàn, hạn mức, sức mua/bán; trả tóm tắt + mã xác nhận sống 90 giây
 *   POST   /api/shs/orders { step: 'place', confirm }
 *          -> gửi ĐÚNG lệnh đã xem trước (nội dung lấy từ mã xác nhận đã ký, không lấy từ body)
 *   DELETE /api/shs/orders?sub=...&orderNumber=...&symbol=...&side=...&type=...&price=...&qty=...
 *
 * CHỈ CHO TÀI KHOẢN CỦA CHÍNH CHỦ. SHS không có ủy quyền môi giới kiểu careBy của DNSE, nên ở đây
 * không có và sẽ không có đường đặt lệnh hộ khách: muốn vậy phải cầm mật khẩu của khách, tức là
 * đăng nhập dưới danh nghĩa khách chứ không phải với tư cách môi giới.
 *
 * Phiên SHS đã qua OTP ma trận (xem shs/connect.js) chính là thứ cho phép giao dịch, nên không có
 * bước OTP riêng như DNSE. Hết hạn thì SHS trả 401 và ta báo kết nối lại.
 */
import crypto from 'node:crypto';
import { route } from '../../../api/_http.js';
import {
  assertOwner, readLink, BrokerError,
  makeConfirm, readConfirm, auditStart, auditFinish, assertDailyLimit, dailyUsage,
} from '../../../api/_broker.js';
import * as shs from '../../../api/_shs.js';
import { rest } from '../../../api/_db.js';

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

/** Trần/sàn lấy đúng nguồn mà bảng giá đang hiển thị, để không chặn một nẻo trong khi màn hình báo một đằng. */
async function bienDo(symbol) {
  const rows = await rest(`/market_quotes?symbol=eq.${symbol}&select=data`, { role: 'app_worker' }).catch(() => null);
  const d = rows?.[0]?.data;
  if (!d || !Number.isFinite(Number(d.ceil)) || !Number.isFinite(Number(d.floor))) return null;
  // Bảng giá lưu nghìn đồng, SHS nhận đồng.
  return { ceilVnd: Math.round(Number(d.ceil) * 1000), floorVnd: Math.round(Number(d.floor) * 1000), ex: d.ex || null };
}

async function dungLenh(link, b) {
  const symbol = String(b.symbol || '').toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) throw new BrokerError('Mã chứng khoán không hợp lệ.', 400);
  if (b.side !== 'B' && b.side !== 'S') throw new BrokerError('Lệnh phải là mua hoặc bán.', 400);
  const type = String(b.type || 'LO').toUpperCase();
  if (!shs.ORDER_TYPES.includes(type)) throw new BrokerError('Loại lệnh không hợp lệ.', 400);
  const qty = Number(b.qty);
  if (!Number.isInteger(qty) || qty <= 0 || qty % 100 !== 0) throw new BrokerError('Khối lượng phải là bội số của 100.', 400);

  const subs = await shs.subAccounts(link.token, link.accountNo);
  const sub = (Array.isArray(subs) ? subs : []).find((s) => s.subNumber === String(b.sub || '') && s.type === 'EQUITY');
  if (!sub) throw new BrokerError('Tiểu khoản không thuộc tài khoản SHS của bạn, hoặc không phải tiểu khoản cơ sở.', 400);

  const bd = await bienDo(symbol);
  let priceVnd = 0;
  if (type === 'LO') {
    // Giá nhập theo nghìn đồng như bảng giá; SHS nhận đồng.
    const k = Number(b.price);
    if (!Number.isFinite(k) || k <= 0) throw new BrokerError('Nhập giá đặt.', 400);
    priceVnd = Math.round(k * 1000);
    if (bd && (priceVnd < bd.floorVnd || priceVnd > bd.ceilVnd)) {
      throw new BrokerError(`Giá phải trong khoảng sàn ${fmt(bd.floorVnd)} đ đến trần ${fmt(bd.ceilVnd)} đ.`, 400);
    }
  } else if (!bd) {
    throw new BrokerError(`Chưa có trần/sàn của ${symbol} nên không ước lượng được giá trị lệnh thị trường.`, 502);
  }

  // Lệnh thị trường tính theo trường hợp xấu nhất: mua ở trần, bán ở sàn.
  const giaTinh = type === 'LO' ? priceVnd : (b.side === 'B' ? bd.ceilVnd : bd.floorVnd);
  const estValueVnd = giaTinh * qty;
  if (estValueVnd > shs.maxOrderVnd()) {
    throw new BrokerError(
      `Giá trị lệnh khoảng ${fmt(estValueVnd)} đ vượt hạn mức ${fmt(shs.maxOrderVnd())} đ mỗi lệnh (SHS_MAX_ORDER_VND).`, 400);
  }

  // Sức mua / sức bán hỏi thẳng SHS. Hỏi KHÔNG ĐƯỢC thì cảnh báo chứ không chặn: lệnh sai sẽ bị
  // chính SHS từ chối, còn chặn nhầm thì không đặt được lệnh đúng. Nhưng hỏi ĐƯỢC mà thiếu hàng
  // thì chặn hẳn, vì đó là câu trả lời dứt khoát.
  let canhBao = null, suc = null;
  try {
    if (b.side === 'B') {
      const r = await shs.buyable(link.token, link.accountNo, sub.subNumber, symbol, giaTinh);
      const toiDa = Number(r?.buyableQuantity);
      suc = { buyableQuantity: r?.buyableQuantity ?? null, buyingPower: r?.buyingPower ?? null };
      if (Number.isFinite(toiDa) && toiDa > 0 && qty > toiDa) {
        throw new BrokerError(`Sức mua chỉ đủ ${fmt(toiDa)} cổ phiếu ở giá này.`, 400);
      }
    } else {
      const r = await shs.sellable(link.token, link.accountNo, sub.subNumber, symbol);
      const d = (Array.isArray(r) ? r : []).find((x) => x.stockCode === symbol);
      suc = { sellableQuantity: d?.sellableQuantity ?? 0, balanceQuantity: d?.balanceQuantity ?? 0 };
      if (qty > Number(d?.sellableQuantity || 0)) {
        throw new BrokerError(
          `Chỉ bán được ${fmt(d?.sellableQuantity || 0)} ${symbol} ở tiểu khoản này (đang giữ ${fmt(d?.balanceQuantity || 0)}).`, 400);
      }
    }
  } catch (e) {
    if (e instanceof BrokerError && e.status === 400) throw e;
    canhBao = 'Không hỏi được sức mua/sức bán từ SHS, lệnh vẫn gửi nhưng SHS có thể từ chối.';
  }

  const order = {
    accountNumber: link.accountNo, subNumber: sub.subNumber, symbol,
    side: shs.SIDE[b.side], type, price: type === 'LO' ? priceVnd : 0, qty,
    accountNo: sub.subNumber,          // tên dùng chung cho hạn mức tính theo tiểu khoản
  };
  const text = `${b.side === 'B' ? 'MUA' : 'BÁN'} ${fmt(qty)} ${symbol} ${type}`
    + (type === 'LO' ? ` giá ${fmt(priceVnd)} đ` : ' (lệnh thị trường)')
    + `, khoảng ${fmt(estValueVnd)} đ, tiểu khoản ${sub.subNumber}`;
  return { order, estValueVnd, text, bd, suc, canhBao };
}

export default route('POST, DELETE, OPTIONS', async ({ req, res, uid, body }) => {
  await assertOwner(uid);
  const link = await readLink(uid, 'shs');
  if (!link?.token) throw new BrokerError('Phiên SHS đã hết hạn, hãy kết nối lại.', 401, 'shs_expired');

  if (req.method === 'POST' && body.step === 'preview') {
    const b = await dungLenh(link, body);
    return {
      summary: { text: b.text, estValueVnd: b.estValueVnd, ceilingVnd: b.bd?.ceilVnd ?? null, floorVnd: b.bd?.floorVnd ?? null },
      suc: b.suc, canhBao: b.canhBao,
      confirm: makeConfirm('shs', uid, b.order, b.estValueVnd),
      expiresInSec: 90,
      realTrading: shs.realTradingEnabled(),
      daily: await dailyUsage('shs', uid, b.order.accountNo, shs.limits()),
    };
  }

  if (!shs.realTradingEnabled()) {
    return res.status(403).json({ error: 'Đặt/hủy lệnh SHS thật đang TẮT trên máy chủ (SHS_REAL_TRADING).', code: 'disabled' });
  }

  if (req.method === 'POST' && body.step === 'place') {
    const c = readConfirm('shs', uid, body.confirm);
    if (!c) return res.status(400).json({ error: 'Mã xác nhận không hợp lệ hoặc đã quá 90 giây, hãy xem trước lệnh lại.', code: 'confirm' });
    await assertDailyLimit('shs', uid, c.order.accountNo, c.estValueVnd, shs.limits());
    const auditId = await auditStart('shs', uid, 'place', c.nonce, { ...c.order, estValueVnd: c.estValueVnd ?? null });
    try {
      const result = await shs.placeOrder(link.token, c.order);
      await auditFinish(uid, auditId, { ok: true, result });
      return res.status(201).json({ order: result });
    } catch (e) {
      // Mạng đứt hay SHS 5xx KHÔNG chứng minh được lệnh chưa vào sàn. Nói thẳng là chưa rõ, vì
      // đặt lại một lệnh đã vào là mất tiền thật.
      const chuaRo = e.code === 'unreachable' || e.status === 502 || e.status === 503;
      await auditFinish(uid, auditId, { ok: false, chuaRo, error: e.message });
      if (chuaRo) {
        return res.status(502).json({
          error: 'Không rõ SHS đã nhận lệnh hay chưa. ĐỪNG đặt lại — mở sổ lệnh SHS kiểm tra trước.',
          code: 'unknown',
        });
      }
      throw e;
    }
  }

  if (req.method === 'DELETE') {
    const q = new URL(req.url, 'http://x').searchParams;
    const o = {
      accountNumber: link.accountNo,
      subNumber: String(q.get('sub') || ''),
      symbol: String(q.get('symbol') || '').toUpperCase(),
      side: String(q.get('side') || ''),
      type: String(q.get('type') || 'LO').toUpperCase(),
      price: Number(q.get('price') || 0),
      qty: Number(q.get('qty') || 0),
      orderNumber: String(q.get('orderNumber') || ''),
    };
    if (!/^\w{1,24}$/.test(o.orderNumber) || !/^\w{4,20}$/.test(o.subNumber)) {
      return res.status(400).json({ error: 'Thiếu tiểu khoản hoặc số hiệu lệnh.' });
    }
    const auditId = await auditStart('shs', uid, 'cancel', crypto.randomUUID(), o);
    try {
      const result = await shs.cancelOrder(link.token, o);
      await auditFinish(uid, auditId, { ok: true, result });
      return { cancelled: true };
    } catch (e) {
      await auditFinish(uid, auditId, { ok: false, error: e.message });
      throw e;
    }
  }
  return res.status(400).json({ error: 'Thao tác không hợp lệ.' });
}, { auth: true });
