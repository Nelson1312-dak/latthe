/**
 * api/_desk.js — bàn làm việc môi giới: khách hàng care-by, quyền theo từng tiểu khoản, dựng lệnh an toàn.
 * Underscore prefix => Vercel không expose thành route.
 * Tài liệu: https://developers.dnse.com.vn/docs/guide/broker
 */
import * as dnse from './_dnse.js';

const TYPES = ['LO', 'MTL', 'ATO', 'ATC'];
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

/** Chuẩn hóa một tiểu khoản care-by và quyền của môi giới trên nó. */
export function normalizeClient(a) {
  const perms = Array.isArray(a.permissions) ? a.permissions : [];
  const role = (product) => perms.find((p) => p.product === product)?.role || null;
  const stockRole = role('UNDERLYING_STOCK');
  return {
    accountNo: String(a.accountNo || ''),
    investorId: a.investorId != null ? String(a.investorId) : null,
    custodyCode: a.custodyCode || null,
    name: a.fullName || null,
    nav: { stock: a.underlyingNav ?? null, derivative: a.derivativeNav ?? null, total: a.totalNav ?? null },
    stockRole,
    derivativeRole: role('DERIVATIVES_STOCK'),
    canView: stockRole === 'ADVISOR' || stockRole === 'BROKER',
    canTrade: stockRole === 'BROKER',
  };
}

/** Danh sách khách. Cache ngắn trong tiến trình để không đốt quota (Get Accounts chỉ 1.000/giờ). */
let cache = { at: 0, data: null };
export async function listClients({ fresh = false } = {}) {
  if (!fresh && cache.data && Date.now() - cache.at < 60_000) return cache.data;
  const r = await dnse.careBy();
  // DNSE bọc danh sách trong khóa `careBy` (kèm `total`), không phải `accounts`/`data`.
  // Đọc sai khóa thì mảng rỗng và bàn môi giới hiện "chưa có khách" trong khi thực tế có —
  // lỗi im lặng, không báo gì, nên giữ cả các tên cũ để phòng DNSE đổi.
  const raw = Array.isArray(r) ? r : r?.careBy || r?.accounts || r?.data || [];
  const data = raw.map(normalizeClient).filter((c) => c.accountNo);
  cache = { at: Date.now(), data };
  return data;
}

/** Lấy khách theo tiểu khoản và kiểm tra quyền. fresh=true khi sắp gửi lệnh: không tin bản cache. */
export async function requireClient(accountNo, { need = 'view', fresh = false } = {}) {
  const c = (await listClients({ fresh })).find((x) => x.accountNo === String(accountNo || ''));
  if (!c) throw new dnse.DnseError('Tiểu khoản này không thuộc danh sách khách bạn quản lý.', 403, 'not_client');
  if (need === 'trade' && !c.canTrade) {
    throw new dnse.DnseError('Khách chưa ủy quyền giao dịch cho bạn (chỉ có quyền theo dõi). Khách cần cập nhật ủy quyền trên Entrade X.', 403, 'advisor_only');
  }
  if (need === 'view' && !c.canView) throw new dnse.DnseError('Bạn không có quyền xem tiểu khoản này.', 403, 'no_permission');
  return c;
}

/**
 * Kiểm tra lệnh theo trần/sàn thật của DNSE và hạn mức, trả về body gửi lên DNSE.
 * Giá người dùng nhập theo nghìn đồng; đơn vị gửi lên giống secdef (tự nhận biết).
 */
export async function buildOrder({ accountNo, symbol, side, type, price, qty }) {
  symbol = String(symbol || '').toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) throw new dnse.DnseError('Mã chứng khoán không hợp lệ.', 400);
  if (side !== 'B' && side !== 'S') throw new dnse.DnseError('Lệnh phải là mua hoặc bán.', 400);
  if (!TYPES.includes(type)) throw new dnse.DnseError('Loại lệnh không hợp lệ.', 400);
  qty = Number(qty);
  if (!Number.isInteger(qty) || qty <= 0 || qty % 100 !== 0) throw new dnse.DnseError('Khối lượng phải là bội số của 100.', 400);

  const sec = await dnse.securityDef(symbol);
  if (!sec?.ceilingPrice || !sec?.floorPrice) throw new dnse.DnseError(`Không lấy được trần/sàn của ${symbol} từ DNSE.`, 502);
  const unitVnd = sec.ceilingPrice > 1000;
  const toVnd = (p) => (unitVnd ? p : p * 1000);

  let apiPrice;
  if (type === 'LO') {
    const k = Number(price);
    if (!Number.isFinite(k) || k <= 0) throw new dnse.DnseError('Nhập giá đặt.', 400);
    apiPrice = unitVnd ? Math.round(k * 1000) : Math.round(k * 100) / 100;
    if (apiPrice < sec.floorPrice || apiPrice > sec.ceilingPrice) {
      throw new dnse.DnseError(`Giá phải trong khoảng sàn ${fmt(toVnd(sec.floorPrice))} đ đến trần ${fmt(toVnd(sec.ceilingPrice))} đ.`, 400);
    }
  }
  const estValue = toVnd(type === 'LO' ? apiPrice : sec.ceilingPrice) * qty;
  if (estValue > dnse.maxOrderVnd()) {
    throw new dnse.DnseError(`Giá trị lệnh khoảng ${fmt(estValue)} đ vượt hạn mức ${fmt(dnse.maxOrderVnd())} đ mỗi lệnh.`, 400);
  }
  return {
    order: { accountNo, symbol, side: side === 'B' ? 'NB' : 'NS', orderType: type, quantity: qty, ...(type === 'LO' ? { price: apiPrice } : {}) },
    estValueVnd: Math.round(estValue),
    ceilingVnd: toVnd(sec.ceilingPrice), floorVnd: toVnd(sec.floorPrice),
    text: `${side === 'B' ? 'MUA' : 'BÁN'} ${qty.toLocaleString('vi-VN')} ${symbol} ${type === 'LO' ? `giá ${fmt(toVnd(apiPrice))} đ` : `lệnh ${type}`}`,
  };
}

export const SOURCES = ['app', 'phone', 'chat', 'in_person'];
export const SOURCE_LABEL = { app: 'Khách xác nhận trong app', phone: 'Điện thoại', chat: 'Tin nhắn', in_person: 'Gặp trực tiếp' };
export const APPROVAL_TTL_MS = 15 * 60e3; // phiếu đã duyệt phải gửi trong 15 phút, tránh giá lệch
