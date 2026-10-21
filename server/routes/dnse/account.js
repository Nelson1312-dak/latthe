/**
 * GET /api/dnse/account?account=<tiểu khoản> — tài khoản DNSE thật của chủ sở hữu (chỉ đọc).
 * Trả danh sách tiểu khoản, tiền, danh mục, sổ lệnh trong ngày, trạng thái phiên giao dịch (OTP).
 */
import { route } from '../../../api/_http.js';
import * as dnse from '../../../api/_dnse.js';
import { rest } from '../../../api/_db.js';

const val = (r) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Lỗi' });

export default route('GET, OPTIONS', async ({ req, uid }) => {
  await dnse.assertOwner(uid);
  const info = await dnse.accounts();
  let ten = {};
  try { ten = (await rest(`/users?id=eq.${uid}&select=dnse_sub_names&limit=1`, { sub: uid }))[0]?.dnse_sub_names || {}; }
  catch { ten = {}; }
  const list = info?.accounts || [];
  if (!list.length) return { profile: { name: info?.name, custodyCode: info?.custodyCode }, accounts: [] };
  const want = new URL(req.url, 'http://x').searchParams.get('account');
  const acc = list.find((a) => a.id === want)?.id || list[0].id;
  const [balance, positions, orders] = (await Promise.allSettled([dnse.balances(acc), dnse.positions(acc), dnse.orderBook(acc)])).map(val);
  const tt = dnse.readTradingCookie(req, uid);
  return {
    profile: { name: info.name, custodyCode: info.custodyCode, investorId: info.investorId },
    // `ten` lấy từ users.dnse_sub_names - đọc được lúc đăng nhập bằng mật khẩu DNSE, vì API key
    // HMAC mà route này dùng không trả về tên tiểu khoản. Chưa đăng nhập DNSE lần nào thì không
    // có tên, giao diện hiện số tiểu khoản như cũ.
    accounts: list.map((a) => ({ id: a.id, ten: ten[a.id] || null, dealAccount: a.dealAccount, derivativeAccount: a.derivativeAccount })),
    account: acc,
    balance, positions, orders,
    trading: { active: !!tt, expiresAt: tt ? new Date(tt.exp).toISOString() : null },
    realTrading: dnse.realTradingEnabled(),
    maxOrderVnd: dnse.maxOrderVnd(),
    daily: await dnse.dailyUsage(uid, acc),
  };
}, { auth: true });
