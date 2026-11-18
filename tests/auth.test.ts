// Xác minh ID token của Google: ký bằng một cặp khoá tạo tại chỗ rồi kiểm tra
// server có từ chối đúng những token đáng phải từ chối không.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { openDb, upsertGoogleUser, type Db } from '../server/db.ts';
import { adminKeys, createSession, destroySession, fromThisMachine, isAdminUser, loginWithGoogle, purgeExpiredSessions, readCookie, sessionCookie, userForSession, verifyGoogleToken } from '../server/auth.ts';

const CLIENT_ID = '1234567890-abc.apps.googleusercontent.com';
const ISSUER = 'https://accounts.google.com';

let keys: { priv: CryptoKey; jwks: ReturnType<typeof createLocalJWKSet> };
let otherKey: CryptoKey;

async function setupKeys() {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const jwk = (await exportJWK(pair.publicKey)) as JWK;
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  keys = { priv: pair.privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
  otherKey = (await generateKeyPair('RS256', { extractable: true })).privateKey;
}

interface TokenOpts {
  aud?: string;
  iss?: string;
  expSeconds?: number;
  key?: CryptoKey;
  claims?: Record<string, unknown>;
  sub?: string;
}

function token(o: TokenOpts = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ name: 'Nelson', picture: 'https://example.test/a.png', email_verified: true, ...o.claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(o.iss ?? ISSUER)
    .setAudience(o.aud ?? CLIENT_ID)
    .setSubject(o.sub ?? 'google-sub-1')
    .setIssuedAt(now)
    .setExpirationTime(now + (o.expSeconds ?? 3600))
    .sign(o.key ?? keys.priv);
}

describe('verifyGoogleToken', () => {
  beforeEach(setupKeys);

  it('chấp nhận token hợp lệ', async () => {
    const id = await verifyGoogleToken(await token(), CLIENT_ID, keys.jwks);
    expect(id).toMatchObject({ sub: 'google-sub-1', name: 'Nelson', emailVerified: true });
  });

  it('chấp nhận iss dạng không có https', async () => {
    const id = await verifyGoogleToken(await token({ iss: 'accounts.google.com' }), CLIENT_ID, keys.jwks);
    expect(id.sub).toBe('google-sub-1');
  });

  it('từ chối token của ứng dụng khác', async () => {
    await expect(verifyGoogleToken(await token({ aud: 'khac.apps.googleusercontent.com' }), CLIENT_ID, keys.jwks))
      .rejects.toThrow();
  });

  it('từ chối token đã hết hạn', async () => {
    await expect(verifyGoogleToken(await token({ expSeconds: -60 }), CLIENT_ID, keys.jwks)).rejects.toThrow();
  });

  it('từ chối token ký bằng khoá khác', async () => {
    await expect(verifyGoogleToken(await token({ key: otherKey }), CLIENT_ID, keys.jwks)).rejects.toThrow();
  });

  it('từ chối token sai nơi phát hành', async () => {
    await expect(verifyGoogleToken(await token({ iss: 'https://evil.test' }), CLIENT_ID, keys.jwks)).rejects.toThrow();
  });

  it('từ chối khi server chưa đặt GOOGLE_CLIENT_ID', async () => {
    await expect(verifyGoogleToken(await token(), '', keys.jwks)).rejects.toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('không có name thì lấy phần trước @ của email', async () => {
    const t = await token({ claims: { name: undefined, email: 'nelson@example.test' } });
    expect((await verifyGoogleToken(t, CLIENT_ID, keys.jwks)).name).toBe('nelson');
  });
});

describe('phiên đăng nhập', () => {
  let db: Db;
  beforeEach(async () => {
    await setupKeys();
    db = openDb(':memory:');
  });
  afterEach(() => db.close());

  it('tạo phiên rồi tra lại ra đúng người', () => {
    const u = upsertGoogleUser(db, 'sub-1', 'Nelson');
    const s = createSession(db, u.id);
    expect(userForSession(db, s.token)?.id).toBe(u.id);
  });

  it('mã sai thì không ra ai', () => {
    upsertGoogleUser(db, 'sub-1', 'Nelson');
    expect(userForSession(db, 'khong-phai-ma-that')).toBeNull();
    expect(userForSession(db, undefined)).toBeNull();
  });

  it('không lưu mã phiên dạng thô trong database', () => {
    const u = upsertGoogleUser(db, 'sub-1', 'Nelson');
    const s = createSession(db, u.id);
    const rows = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(s.token);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('phiên hết hạn bị từ chối và bị xoá', () => {
    const u = upsertGoogleUser(db, 'sub-1', 'Nelson');
    const s = createSession(db, u.id);
    const sau = new Date(Date.now() + 31 * 86400_000);
    expect(userForSession(db, s.token, sau)).toBeNull();
    expect(db.prepare('SELECT count(*) c FROM sessions').get()).toMatchObject({ c: 0 });
  });

  it('đăng xuất thì phiên mất tác dụng', () => {
    const u = upsertGoogleUser(db, 'sub-1', 'Nelson');
    const s = createSession(db, u.id);
    destroySession(db, s.token);
    expect(userForSession(db, s.token)).toBeNull();
  });

  it('dọn phiên hết hạn', () => {
    const u = upsertGoogleUser(db, 'sub-1', 'Nelson');
    createSession(db, u.id, -1);
    createSession(db, u.id, 30);
    expect(purgeExpiredSessions(db)).toBe(1);
    expect(db.prepare('SELECT count(*) c FROM sessions').get()).toMatchObject({ c: 1 });
  });

  it('đăng nhập Google hai lần dùng chung một tài khoản', async () => {
    const a = await loginWithGoogle(db, await token(), CLIENT_ID, keys.jwks);
    const b = await loginWithGoogle(db, await token({ claims: { name: 'Nelson Đ.' } }), CLIENT_ID, keys.jwks);
    expect(b.user.id).toBe(a.user.id);
    expect(b.user.display_name).toBe('Nelson Đ.');
    expect(db.prepare('SELECT count(*) c FROM users').get()).toMatchObject({ c: 1 });
    // Hai lần đăng nhập là hai phiên khác nhau, cả hai cùng dùng được.
    expect(a.session.token).not.toBe(b.session.token);
    expect(userForSession(db, a.session.token)?.id).toBe(a.user.id);
  });

  it('chủ trang CHỈ là tài khoản Google đăng nhập bằng đúng Gmail trong ADMIN_EMAILS', async () => {
    const ds = adminKeys('chu@example.test');
    const a = await loginWithGoogle(db, await token({ claims: { email: 'Chu@Example.test' } }), CLIENT_ID, keys.jwks, ds);
    expect(isAdminUser(a.user, ds)).toBe(true);
    // Đọc lại từ CSDL qua phiên (như mỗi request): vẫn là chủ trang
    expect(isAdminUser(userForSession(db, a.session.token)!, ds)).toBe(true);
    // Không lưu email gốc ở bất cứ cột nào
    expect(JSON.stringify(db.prepare('SELECT * FROM users').all()).toLowerCase()).not.toContain('chu@');
    // Bỏ Gmail khỏi danh sách: mất quyền NGAY, không cần đăng nhập lại
    expect(isAdminUser(a.user, adminKeys('khac@example.test'))).toBe(false);
    expect(isAdminUser(a.user, adminKeys(''))).toBe(false);
  });

  it('người khác không thể là chủ trang', async () => {
    const ds = adminKeys('chu@example.test');
    // Gmail khác
    const khác = await loginWithGoogle(
      db,
      await token({ sub: 'sub-khac', claims: { email: 'nguoila@example.test' } }),
      CLIENT_ID,
      keys.jwks,
      ds,
    );
    expect(isAdminUser(khác.user, ds)).toBe(false);
    expect(khác.user.admin_key ?? null).toBeNull();
    // Đúng Gmail nhưng Google chưa xác minh email: không tin
    const chưaXácMinh = await loginWithGoogle(
      db,
      await token({ sub: 'sub-gia', claims: { email: 'chu@example.test', email_verified: false } }),
      CLIENT_ID,
      keys.jwks,
      ds,
    );
    expect(isAdminUser(chưaXácMinh.user, ds)).toBe(false);
    // Tài khoản thử (không phải Google) dù có mang dấu chủ trang cũng không được
    expect(isAdminUser({ google_sub: null, admin_key: [...ds][0] }, ds)).toBe(false);
    // Danh sách rỗng hay sai dạng: không ai là chủ trang
    expect(adminKeys('').size).toBe(0);
    expect(adminKeys('khong-phai-email, @x, a@b').size).toBe(0);
  });

  it('token hỏng thì không tạo tài khoản nào', async () => {
    await expect(loginWithGoogle(db, await token({ key: otherKey }), CLIENT_ID, keys.jwks)).rejects.toThrow();
    expect(db.prepare('SELECT count(*) c FROM users').get()).toMatchObject({ c: 0 });
  });
});

describe('cookie', () => {
  it('đọc đúng cookie trong chuỗi nhiều cookie', () => {
    expect(readCookie('a=1; cv_session=abc; b=2', 'cv_session')).toBe('abc');
    expect(readCookie('a=1', 'cv_session')).toBeUndefined();
    expect(readCookie(undefined, 'cv_session')).toBeUndefined();
  });

  it('cookie phiên có HttpOnly và SameSite, chỉ có Secure khi chạy HTTPS', () => {
    const exp = new Date('2030-01-01T00:00:00Z');
    expect(sessionCookie('abc', exp, false)).toContain('HttpOnly');
    expect(sessionCookie('abc', exp, false)).toContain('SameSite=Lax');
    expect(sessionCookie('abc', exp, false)).not.toContain('Secure');
    expect(sessionCookie('abc', exp, true)).toContain('Secure');
  });
});

describe('đăng nhập giả chỉ dành cho máy này', () => {
  // Giả lập request: chỉ cần headers và socket.remoteAddress
  const req = (headers: Record<string, string>, remote = '127.0.0.1') => ({
    headers,
    socket: { remoteAddress: remote },
  });

  it('gọi thẳng từ máy này thì được', () => {
    expect(fromThisMachine(req({}))).toBe(true);
    expect(fromThisMachine(req({}, '::1'))).toBe(true);
    expect(fromThisMachine(req({}, '::ffff:127.0.0.1'))).toBe(true);
  });

  it('qua tunnel thì không, dù socket vẫn là loopback', () => {
    // Đây đúng là tình huống chạy sau ngrok: tunnel nối vào 127.0.0.1 của mình,
    // nên nhìn socket thì tưởng là người nhà.
    expect(fromThisMachine(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe(false);
    expect(fromThisMachine(req({ 'x-forwarded-proto': 'https' }))).toBe(false);
    expect(fromThisMachine(req({ 'x-forwarded-host': 'abc.ngrok-free.dev' }))).toBe(false);
  });

  it('máy khác trong mạng LAN cũng không được', () => {
    expect(fromThisMachine(req({}, '192.168.1.50'))).toBe(false);
  });

  it('không có địa chỉ thì coi như không phải máy này', () => {
    expect(fromThisMachine(req({}, ''))).toBe(false);
  });
});
