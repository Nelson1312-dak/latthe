/** GET /api/me — hồ sơ + tài khoản giả lập + danh mục + sổ lệnh. Xét khớp lệnh chờ trước khi trả. */
import { route } from './_http.js';
import { rest } from './_db.js';
import { matchPending } from './_trade.js';

export default route('GET, OPTIONS', async ({ uid }) => {
  if (!uid) return { user: null };
  try { await matchPending(uid); } catch (e) { console.error('[match]', e?.message); }
  const [users, accounts, holdings, orders] = await Promise.all([
    rest(`/users?id=eq.${uid}&select=id,username,display_name,role&limit=1`, { sub: uid }),
    rest('/accounts?select=cash&limit=1', { sub: uid }),
    rest('/holdings?select=symbol,qty,avg&order=symbol', { sub: uid }),
    rest('/orders?select=id,symbol,side,type,price,qty,filled,avg_price,status,created_at,done_at&order=id.desc&limit=50', { sub: uid }),
  ]);
  if (!users[0]) return { user: null }; // user đã bị xóa: cookie còn nhưng vô hiệu
  return { user: users[0], cash: Number(accounts[0]?.cash ?? 0), holdings, orders };
});
