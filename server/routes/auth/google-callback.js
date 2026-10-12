/**
 * GET /api/auth/google-callback — Google gọi lại sau khi người dùng đồng ý.
 * Tìm user theo google_sub, nếu chưa có thì gắn vào tài khoản cùng email, cuối cùng mới tạo mới.
 */
import { rest } from '../../../api/_db.js';
import { startSession } from '../../../api/_auth.js';
import { checkState, exchangeCode, suggestUsername, googleEnabled } from '../../../api/_google.js';

const back = (res, to) => { res.statusCode = 302; res.setHeader('Location', to); res.end(); };
const fail = (res, msg) => back(res, `/?loi=${encodeURIComponent(msg)}`);

async function findOrCreate(profile) {
  const bySub = await rest(`/users?google_sub=eq.${encodeURIComponent(profile.sub)}&select=id,username,display_name,role,avatar_url&limit=1`, { role: 'app_auth' });
  if (bySub[0]) return bySub[0];

  if (profile.email) {
    const byEmail = await rest(`/users?email=eq.${encodeURIComponent(profile.email)}&select=id&limit=1`, { role: 'app_auth' });
    if (byEmail[0]) {
      const linked = await rest(`/users?id=eq.${byEmail[0].id}&select=id,username,display_name,role,avatar_url`, {
        role: 'app_auth', method: 'PATCH', prefer: 'return=representation',
        body: { google_sub: profile.sub, avatar_url: profile.picture },
      });
      return linked[0];
    }
  }

  const display = (profile.name || profile.email || 'Nhà đầu tư').slice(0, 40);
  let username = suggestUsername(profile.email, profile.sub);
  for (let i = 0; i < 5; i++) {
    try {
      const rows = await rest('/users?select=id,username,display_name,role,avatar_url', {
        role: 'app_auth', method: 'POST', prefer: 'return=representation',
        body: { username, display_name: display, email: profile.email, google_sub: profile.sub, avatar_url: profile.picture },
      });
      return rows[0];
    } catch (e) {
      if (e.pgCode !== '23505') throw e;
      username = `${suggestUsername(profile.email, profile.sub).slice(0, 18)}_${Math.floor(Math.random() * 9000 + 1000)}`;
    }
  }
  throw Object.assign(new Error('Không tạo được tài khoản, thử lại.'), { status: 409, expose: true });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  if (!googleEnabled()) return fail(res, 'Đăng nhập Google chưa được cấu hình.');

  const q = new URL(req.url, 'http://x').searchParams;
  const st = checkState(req, res, q.get('state'));
  if (q.get('error')) return fail(res, 'Bạn đã hủy đăng nhập bằng Google.');
  if (!st) return fail(res, 'Phiên đăng nhập Google không hợp lệ hoặc đã quá hạn, thử lại.');
  const code = q.get('code');
  if (!code) return fail(res, 'Google không trả về mã xác thực.');

  try {
    const user = await findOrCreate(await exchangeCode(req, code));
    startSession(res, user.id);
    return back(res, st.next);
  } catch (e) {
    console.error('[google]', e?.code || '', e?.message);
    return fail(res, e?.expose ? e.message : 'Đăng nhập Google thất bại, thử lại sau.');
  }
}
