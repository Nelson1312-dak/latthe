// Đăng nhập Google và phiên làm việc.
//
// Luồng: trình duyệt lấy ID token từ Google -> gửi lên /api/auth/google ->
// server xác minh chữ ký bằng khoá công khai của Google -> tạo phiên -> đặt cookie.
// Mật khẩu không bao giờ đi qua đây; Google lo phần đó.

import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { Db, User } from './db.ts';
import { one, upsertGoogleUser } from './db.ts';

export const SESSION_COOKIE = 'cv_session';
export const SESSION_DAYS = 30;

/** Hai giá trị Google có thể đặt trong 'iss'. */
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let remoteJwks: JWTVerifyGetKey | null = null;
function googleJwks(): JWTVerifyGetKey {
  remoteJwks ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  return remoteJwks;
}

export interface GoogleIdentity {
  sub: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

/**
 * Xác minh ID token của Google. Ném lỗi nếu chữ ký sai, hết hạn, sai 'aud' (token
 * của ứng dụng khác) hoặc sai 'iss'. `jwks` chỉ để test tiêm khoá cục bộ vào.
 */
export async function verifyGoogleToken(
  idToken: string,
  clientId: string,
  jwks: JWTVerifyGetKey = googleJwks(),
): Promise<GoogleIdentity> {
  if (!clientId) throw new Error('Chưa đặt GOOGLE_CLIENT_ID');
  const { payload } = await jwtVerify(idToken, jwks, {
    audience: clientId,
    issuer: GOOGLE_ISSUERS,
  });
  const p = payload as JWTPayload & { name?: string; picture?: string; email?: string; email_verified?: boolean };
  if (!p.sub) throw new Error('Token thiếu sub');
  return {
    sub: p.sub,
    // Google không bắt buộc trả 'name'; lấy phần trước @ của email làm tên dự phòng.
    name: p.name?.trim() || p.email?.split('@')[0] || 'Người chơi',
    picture: p.picture,
    emailVerified: p.email_verified === true,
  };
}

/* ---------------- Phiên ---------------- */

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export interface Session {
  token: string;
  expiresAt: Date;
}

/** Tạo phiên mới. Mã thô chỉ trả về đúng một lần để đặt vào cookie. */
export function createSession(db: Db, userId: number, days = SESSION_DAYS): Session {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 86400_000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hash(token),
    userId,
    now.toISOString(),
    expiresAt.toISOString(),
  );
  return { token, expiresAt };
}

/** Người dùng của phiên, hoặc null nếu mã sai/hết hạn. Phiên hết hạn bị xoá luôn. */
export function userForSession(db: Db, token: string | undefined, now = new Date()): User | null {
  if (!token) return null;
  const h = hash(token);
  const row = one<{ user_id: number; expires_at: string }>(
    db,
    'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?',
    h,
  );
  if (!row) return null;
  if (new Date(row.expires_at) <= now) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(h);
    return null;
  }
  const user = one<User>(db, 'SELECT * FROM users WHERE id = ?', row.user_id) ?? null;
  // "Lần cuối thấy" chỉ để biết ai còn dùng, không cần chính xác tới giây. Ghi
  // mỗi request thì mỗi request phải chờ đĩa, nên năm phút mới ghi lại một lần.
  if (user && (!user.last_seen_at || now.getTime() - new Date(user.last_seen_at).getTime() > 5 * 60_000)) {
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now.toISOString(), row.user_id);
    user.last_seen_at = now.toISOString();
  }
  return user;
}

export function destroySession(db: Db, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
}

/** Dọn phiên hết hạn; gọi lúc khởi động và mỗi giờ. */
export function purgeExpiredSessions(db: Db, now = new Date()): number {
  const info = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
  return Number(info.changes);
}

/** Đăng nhập bằng Google: xác minh token rồi tạo người dùng và phiên. */
export async function loginWithGoogle(
  db: Db,
  idToken: string,
  clientId: string,
  jwks?: JWTVerifyGetKey,
): Promise<{ user: User; session: Session }> {
  const id = await verifyGoogleToken(idToken, clientId, jwks);
  const user = upsertGoogleUser(db, id.sub, id.name, id.picture);
  return { user, session: createSession(db, user.id) };
}

/* ---------------- Cookie ---------------- */

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Expires=${expiresAt.toUTCString()}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : '', 'Max-Age=0']
    .filter(Boolean)
    .join('; ');
}
