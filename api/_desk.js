/**
 * api/_desk.js — bàn làm việc môi giới: khách hàng care-by, quyền theo từng tiểu khoản, dựng lệnh an toàn.
 * Underscore prefix => Vercel không expose thành route.
 * Tài liệu: https://developers.dnse.com.vn/docs/guide/broker
 */
import * as dnse from './_dnse.js';
import { hopLe, moTaTach } from './_lot.js';

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
/**
 * @param {{ fresh?: boolean, api?: { careBy: () => Promise<any> } }} [o]
 *   `api` để test tiêm nguồn giả. Chỉ dùng bộ nhớ đệm cho nguồn thật, nếu không test sẽ làm bẩn
 *   bộ đệm của tiến trình và ngược lại.
 */
export async function listClients({ fresh = false, api = dnse } = {}) {
  const dungCache = api === dnse;
  if (dungCache && !fresh && cache.data && Date.now() - cache.at < 60_000) return cache.data;
  const r = await api.careBy();
  // DNSE bọc danh sách trong khóa `careBy` (kèm `total`), không phải `accounts`/`data`.
  // Đọc sai khóa thì mảng rỗng và bàn môi giới hiện "chưa có khách" trong khi thực tế có —
  // lỗi im lặng, không báo gì, nên giữ cả các tên cũ để phòng DNSE đổi.
  const raw = Array.isArray(r) ? r : r?.careBy || r?.accounts || r?.data || [];
  const data = raw.map(normalizeClient).filter((c) => c.accountNo);
  if (dungCache) cache = { at: Date.now(), data };
  return data;
}

/**
 * Gói vay mặc định cho một mã: gói đòi tỷ lệ tiền của khách CAO NHẤT, tức ít vay nhất ("GD Tiền mặt").
 *
 * Bắt buộc phải chọn tường minh, không được để trống. Đo trên tài khoản thật ngày 13/10/2026:
 * cùng một mã, cùng một giá, hỏi sức mua mà không kèm gói vay thì DNSE trả về SỐ ÂM (−577.342 đ)
 * và sức mua 0 cổ; hỏi kèm gói tiền mặt thì ra +857.834 đ và mua được 73 cổ. Để trống sẽ chặn
 * nhầm mọi lệnh mua hợp lệ.
 */
const goiCache = new Map();
export async function defaultLoanPackage(accountNo, symbol) {
  const key = `${accountNo}:${symbol}`;
  const c = goiCache.get(key);
  if (c && Date.now() - c.at < 300_000) return c.v;
  let v = null;
  try {
    const ds = await dnse.loanPackages(accountNo, symbol);
    v = ds.filter((g) => Number.isFinite(+g?.id)).sort((a, b) => (b.initialRate ?? 0) - (a.initialRate ?? 0))[0] || null;
  } catch { v = null; }
  goiCache.set(key, { at: Date.now(), v });
  return v;
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
export async function buildOrder({ accountNo, symbol, side, type, price, qty, loanPackageId }) {
  symbol = String(symbol || '').toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) throw new dnse.DnseError('Mã chứng khoán không hợp lệ.', 400);
  if (side !== 'B' && side !== 'S') throw new dnse.DnseError('Lệnh phải là mua hoặc bán.', 400);
  if (!TYPES.includes(type)) throw new dnse.DnseError('Loại lệnh không hợp lệ.', 400);
  qty = Number(qty);
  // Lô chẵn (bội số 100) hoặc lô lẻ (1-99, chỉ LO). Giữa hai mức đó không có gì: 150 cổ phiếu
  // không phải một lệnh hợp lệ, phải tách thành 100 + 50.
  if (!Number.isInteger(qty) || qty <= 0) throw new dnse.DnseError('Khối lượng không hợp lệ.', 400);
  if (!hopLe(qty, type)) {
    throw new dnse.DnseError(qty < 100
      ? 'Lô lẻ (1-99 cổ phiếu) chỉ đặt được bằng lệnh LO.'
      : `Khối lượng phải là bội số của 100, hoặc 1-99 nếu là lô lẻ. ${moTaTach(qty)}.`, 400);
  }

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
  // Sức mua / sức bán thật của DNSE. Giá hỏi phải bằng ĐỒNG; lệnh thị trường lấy giá trần cho
  // trường hợp xấu nhất khi mua, giá sàn khi bán.
  const giaHoi = Math.round(type === 'LO' ? toVnd(apiPrice) : toVnd(side === 'B' ? sec.ceilingPrice : sec.floorPrice));
  let suc = null, canhBao = null;
  // Không có gói vay thì lấy gói ít vay nhất, KHÔNG để DNSE tự chọn (xem defaultLoanPackage).
  // Phải nhớ người gọi CÓ tự chọn hay không: bên dưới cần phân biệt "hết hàng thật" với
  // "hỏi nhầm gói nên ra 0", mà sau khi điền mặc định thì không còn phân biệt được nữa.
  const tuChonGoi = loanPackageId != null;
  const goi = tuChonGoi ? { id: Number(loanPackageId) } : await defaultLoanPackage(accountNo, symbol);
  loanPackageId = goi?.id ?? null;
  try {
    suc = await dnse.buyingPower(accountNo, { symbol, priceVnd: giaHoi, loanPackageId: loanPackageId ?? undefined });
  } catch {
    // DNSE trục trặc thì không chặn: lệnh sai sẽ bị chính DNSE từ chối, còn chặn nhầm
    // lại làm môi giới không đặt được lệnh đúng.
    canhBao = 'Không hỏi được sức mua từ DNSE, lệnh vẫn gửi nhưng DNSE có thể từ chối.';
  }
  if (suc) {
    if (side === 'B' && suc.qmaxBuy != null && qty > suc.qmaxBuy) {
      throw new dnse.DnseError(
        `Sức mua không đủ: tối đa ${fmt(suc.qmaxBuy)} cổ phiếu ${symbol} ở giá này`
        + `${suc.pp0Buy != null ? ` (sức mua ${fmt(suc.pp0Buy)} đ)` : ''}, lệnh đang đặt ${fmt(qty)}.`, 400, 'not_enough_buying_power');
    }
    if (side === 'S' && suc.qmaxSell != null && suc.qmaxSell > 0 && qty > suc.qmaxSell) {
      throw new dnse.DnseError(
        `Chỉ bán được tối đa ${fmt(suc.qmaxSell)} ${symbol} (cổ phiếu chưa về tài khoản thì chưa bán được), lệnh đang đặt ${fmt(qty)}.`,
        400, 'not_enough_sellable');
    }
    // qmaxSell = 0 mà không chỉ định gói vay thì chưa chắc đã hết hàng: sức bán tính theo
    // từng gói vay, hỏi nhầm gói sẽ ra 0. Cảnh báo chứ không chặn.
    if (side === 'S' && suc.qmaxSell === 0 && !tuChonGoi) {
      canhBao = `DNSE báo sức bán ${symbol} bằng 0. Nếu cổ phiếu đang nằm ở một gói vay, cần chọn đúng gói đó.`;
    }
  }

  return {
    order: {
      accountNo, symbol, side: side === 'B' ? 'NB' : 'NS', orderType: type, quantity: qty,
      ...(type === 'LO' ? { price: apiPrice } : {}),
      ...(loanPackageId != null ? { loanPackageId: Number(loanPackageId) } : {}),
    },
    estValueVnd: Math.round(estValue),
    ceilingVnd: toVnd(sec.ceilingPrice), floorVnd: toVnd(sec.floorPrice),
    sucMua: suc, canhBao, loanPackageId: loanPackageId != null ? Number(loanPackageId) : null,
    text: `${side === 'B' ? 'MUA' : 'BÁN'} ${qty.toLocaleString('vi-VN')} ${symbol} ${type === 'LO' ? `giá ${fmt(toVnd(apiPrice))} đ` : `lệnh ${type}`}`,
  };
}

export const SOURCES = ['app', 'phone', 'chat', 'in_person'];
export const SOURCE_LABEL = { app: 'Khách xác nhận trong app', phone: 'Điện thoại', chat: 'Tin nhắn', in_person: 'Gặp trực tiếp' };
export const APPROVAL_TTL_MS = 15 * 60e3; // phiếu đã duyệt phải gửi trong 15 phút, tránh giá lệch
