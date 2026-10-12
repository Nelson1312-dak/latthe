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
    can: { read: true, trade: false },    // bộ API hiện có không có endpoint đặt lệnh
    note: 'Đăng nhập bằng tài khoản SHS. Hiện chỉ xem được tài khoản, chưa đặt được lệnh.',
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
