/**
 * GET /api/shs/account?sub=<tiểu khoản> — tài khoản SHS thật (chỉ đọc).
 * Bộ API SHS hiện có không cho đặt hay hủy lệnh, nên đây thuần là xem.
 */
import { route } from '../_http.js';
import { assertOwner, readLink, BrokerError } from '../_broker.js';
import * as shs from '../_shs.js';

const val = (r) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Lỗi' });

export default route('GET, OPTIONS', async ({ req, uid }) => {
  await assertOwner(uid);
  const link = await readLink(uid, 'shs');
  if (!link?.connected) throw new BrokerError('Bạn chưa kết nối tài khoản SHS.', 401, 'no_link');

  const accs = await shs.accounts(link.token, link.accountNo || undefined);
  const acc = (Array.isArray(accs) ? accs : [])[0];
  if (!acc) return { profile: { display: link.display }, accounts: [] };

  const subs = acc.accountSubs || [];
  const want = new URL(req.url, 'http://x').searchParams.get('sub');
  const sub = subs.find((s) => s.subNumber === want)?.subNumber || subs[0]?.subNumber;

  const [cash, positions, orders] = (await Promise.allSettled([
    shs.cashBalance(link.token, acc.accountNumber, sub),
    shs.portfolio(link.token, acc.accountNumber, sub),
    shs.todayOrders(link.token, acc.accountNumber, sub),
  ])).map(val);

  return {
    profile: { display: acc.accountName || link.display, accountNo: acc.accountNumber },
    accounts: subs.map((s) => ({ sub: s.subNumber, type: s.type, margin: s.mrType === 'T', feeRate: s.maxfeerate })),
    sub,
    cash,
    positions: positions?.data || positions,
    orders: orders?.data || orders,
    canTrade: false,
    note: 'Bộ API SHS đang dùng chỉ hỗ trợ xem tài khoản, chưa đặt được lệnh.',
    expiresAt: link.expiresAt,
  };
}, { auth: true });
