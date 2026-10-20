/**
 * api/_broker.js — phần dùng chung cho mọi công ty chứng khoán: danh sách, phân quyền, mã hóa token.
 * Underscore prefix => Vercel không expose thành route.
 *
 * Kết nối tới tài khoản chứng khoán thật hiện chỉ mở cho MỘT tài khoản trên hệ thống
 * (BROKER_OWNER_USERNAME). Mở rộng cho mọi người dùng cần thỏa thuận với công ty chứng khoán.
 */
import crypto from 'node:crypto';
import { rest } from './_db.js';
import { allowedCustody } from './_dnselogin.js';

export class BrokerError extends Error {
  constructor(message, status = 502, code = 'broker') { super(message); this.status = status; this.code = code; this.expose = true; }
}

export const BROKERS = {
  dnse: {
    id: 'dnse', name: 'DNSE', full: 'Chứng khoán DNSE',
    auth: 'apikey',                       // chủ tài khoản tự tạo API key, không nhập mật khẩu
    can: { read: true, trade: true },
    note: 'Kết nối bằng API key do bạn tạo trong EntradeX. Đặt lệnh cần xác thực OTP.',
  },
  shs: {
    id: 'shs', name: 'SHS', full: 'Chứng khoán Sài Gòn - Hà Nội',
    auth: 'password',                     // đăng nhập bằng tài khoản SHS
    // Đặt lệnh CHỈ cho tài khoản của chính chủ: SHS không có ủy quyền môi giới kiểu careBy.
    can: { read: true, trade: true, ownOnly: true },
    note: 'Đăng nhập bằng tài khoản SHS, xác thực thẻ ma trận OTP để đặt lệnh. Chỉ cho tài khoản của chính bạn.',
  },
};

export const ownerUsername = () =>
  (process.env.BROKER_OWNER_USERNAME || process.env.DNSE_OWNER_USERNAME || '').trim().toLowerCase();

/** @returns {Promise<{username: string}>} ném lỗi nếu user không phải chủ sở hữu. */
export async function assertOwner(uid) {
  const owner = ownerUsername();
  const custody = allowedCustody();
  if (!owner && !custody.length) throw new BrokerError('Kết nối công ty chứng khoán chưa được cấu hình.', 503, 'config');
  if (!uid) throw new BrokerError('Bạn cần đăng nhập.', 401, 'auth');
  const rows = await rest(`/users?id=eq.${uid}&select=username,dnse_custody&limit=1`, { sub: uid });
  const u = rows?.[0];
  const byName = !!owner && u?.username === owner;
  const byDnse = !!u?.dnse_custody && custody.includes(String(u.dnse_custody).toUpperCase());
  if (!byName && !byDnse) {
    throw new BrokerError('Kết nối tài khoản chứng khoán thật hiện chỉ mở cho chủ hệ thống.', 403, 'forbidden');
  }
  return { username: u.username };
}
export const isOwner = (uid) => assertOwner(uid).then(() => true, () => false);

// ---------- Mã hóa token của công ty chứng khoán trước khi lưu DB ----------
function key() {
  const k = process.env.BROKER_TOKEN_KEY || process.env.DNSE_TOKEN_KEY || process.env.SESSION_SECRET;
  if (!k || k.length < 32) throw new BrokerError('Chưa cấu hình khóa mã hóa token.', 503, 'config');
  return crypto.createHash('sha256').update('broker-token:' + k).digest();
}
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}
export function decrypt(blob) {
  const [v, iv, tag, enc] = String(blob || '').split('.');
  if (v !== 'v1') throw new BrokerError('Dữ liệu phiên không hợp lệ.', 500, 'corrupt');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}

// ---------- Lưu / đọc liên kết ----------
export async function saveLink(uid, broker, { accountNo, display, token, tokenExp, refresh }) {
  await rest('/broker_links?on_conflict=user_id,broker', {
    sub: uid, method: 'POST', prefer: 'resolution=merge-duplicates',
    body: {
      user_id: uid, broker, account_no: accountNo || null, display: display || null,
      token_enc: token ? encrypt(token) : null,
      token_exp: tokenExp ? new Date(tokenExp).toISOString() : null,
      refresh_enc: refresh ? encrypt(refresh) : null,
      updated_at: new Date().toISOString(),
    },
  });
}
export async function readLink(uid, broker) {
  const rows = await rest(`/broker_links?user_id=eq.${uid}&broker=eq.${broker}&select=*&limit=1`, { sub: uid });
  const l = rows?.[0];
  if (!l) return null;
  const live = l.token_enc && (!l.token_exp || new Date(l.token_exp) > new Date());
  return {
    broker, accountNo: l.account_no, display: l.display,
    token: live ? decrypt(l.token_enc) : null,
    refresh: l.refresh_enc ? decrypt(l.refresh_enc) : null,
    expiresAt: l.token_exp, connected: !!live, updatedAt: l.updated_at,
  };
}
export const removeLink = (uid, broker) =>
  rest(`/broker_links?user_id=eq.${uid}&broker=eq.${broker}`, { sub: uid, method: 'DELETE' });

// ============================================================
// Đường tiền: xem trước -> xác nhận, nhật ký kiểm toán, hạn mức theo ngày.
//
// Phần này tách khỏi api/_dnse.js để công ty chứng khoán thứ hai không phải chép lại. Mỗi broker
// có hạn mức và nhật ký RIÊNG: `dnse_audit.broker` phân tách, nên một lệnh SHS không bao giờ ăn
// vào trần ngày của DNSE và ngược lại. Trần ngày tính theo hướng an toàn — lệnh chưa rõ kết quả
// vẫn tính — vì thà chặn nhầm còn hơn thả một lệnh nữa khi lệnh trước có thể đã vào sàn.
// ============================================================

const fmtVnd = (n) => Math.round(n).toLocaleString('vi-VN');

/** Mốc 00:00 giờ Việt Nam hôm nay (UTC+7, không có giờ mùa hè), dạng ISO UTC. */
export function startOfVnDay(now = Date.now()) {
  const VN = 7 * 3600e3;
  return new Date(Math.floor((now + VN) / 86400e3) * 86400e3 - VN).toISOString();
}

/** Token xem trước -> xác nhận: ký HMAC, hạn 90 giây. Gắn tên broker để token của bên này không dùng được cho bên kia. */
const confirmSign = (broker, data) =>
  crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(`${broker}-confirm:` + data).digest('base64url');

export function makeConfirm(broker, uid, order, estValueVnd = null) {
  const payload = Buffer.from(JSON.stringify({
    uid, order, estValueVnd, exp: Date.now() + 90e3, nonce: crypto.randomBytes(12).toString('base64url'),
  })).toString('base64url');
  return `${payload}.${confirmSign(broker, payload)}`;
}

export function readConfirm(broker, uid, token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(confirmSign(broker, payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let v; try { v = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (v.uid !== uid || v.exp < Date.now()) return null;
  return v;
}

/** Ghi nhật ký TRƯỚC khi gửi lệnh. Nonce trùng (bấm xác nhận hai lần) => 409, không gửi lần hai. */
export async function auditStart(broker, uid, action, nonce, request) {
  try {
    const rows = await rest('/dnse_audit?select=id', {
      sub: uid, method: 'POST', prefer: 'return=representation',
      body: { user_id: uid, broker, action, nonce, request },
    });
    return rows[0].id;
  } catch (e) {
    if (e.pgCode === '23505') throw new BrokerError('Lệnh này đã được gửi rồi.', 409, 'duplicate');
    throw e;
  }
}

export async function auditFinish(uid, id, result) {
  try { await rest(`/dnse_audit?id=eq.${id}`, { sub: uid, method: 'PATCH', body: { result } }); }
  catch (e) { console.error('[broker-audit]', e?.message); }
}

/** Đã đặt bao nhiêu lệnh, bao nhiêu tiền trên một tiểu khoản kể từ 00:00 hôm nay. */
export async function dailyUsage(broker, uid, accountNo, limits) {
  const rows = await rest(
    `/dnse_audit?broker=eq.${broker}&action=eq.place&at=gte.${startOfVnDay()}&select=request,result&limit=500`,
    { sub: uid });
  let orders = 0, vnd = 0;
  for (const r of rows || []) {
    if (r.result && r.result.ok === false && !r.result.chuaRo) continue;   // bị từ chối dứt khoát
    if (accountNo && String(r.request?.accountNo || '') !== String(accountNo)) continue;
    orders++;
    vnd += Number(r.request?.estValueVnd) || 0;
  }
  return { orders, vnd, maxOrders: limits.maxOrders, maxVnd: limits.maxVnd };
}

/** Chặn TRƯỚC khi gọi công ty chứng khoán. Ném 429 khi lệnh này sẽ vượt trần ngày. */
export async function assertDailyLimit(broker, uid, accountNo, estValueVnd, limits) {
  const used = await dailyUsage(broker, uid, accountNo, limits);
  const B = broker.toUpperCase();
  if (used.orders >= used.maxOrders) {
    throw new BrokerError(
      `Tiểu khoản ${accountNo} đã đặt ${used.orders} lệnh hôm nay, chạm hạn mức ${used.maxOrders} lệnh mỗi ngày (${B}_MAX_ORDERS_PER_DAY).`,
      429, 'daily_orders');
  }
  const sau = used.vnd + (Number(estValueVnd) || 0);
  if (sau > used.maxVnd) {
    throw new BrokerError(
      `Lệnh này nâng giá trị đặt trong ngày của tiểu khoản ${accountNo} lên khoảng ${fmtVnd(sau)} đ, `
      + `vượt hạn mức ${fmtVnd(used.maxVnd)} đ mỗi ngày (${B}_MAX_DAILY_VND).`,
      429, 'daily_vnd');
  }
  return used;
}
