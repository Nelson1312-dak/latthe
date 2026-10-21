/**
 * GET /api/shs/account?sub=<tiểu khoản> — tài khoản SHS thật của chủ hệ thống.
 * Đặt lệnh ở /api/shs/orders; ở đây chỉ đọc số dư, danh mục, sổ lệnh và cho biết có giao dịch được không.
 */
import { route } from '../../../api/_http.js';
import { assertOwner, readLink, BrokerError } from '../../../api/_broker.js';
import * as shs from '../../../api/_shs.js';
import { dailyUsage } from '../../../api/_broker.js';

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
    // `cdcontent` chính là mã tiểu khoản SHS hiển thị cho khách (00, 01, 06, 08...). Trước đây
    // không đưa ra ngoài nên màn hình chỉ có dãy số 10 chữ số, không ai biết đâu là tiểu khoản nào.
    accounts: subs.map((s) => ({ sub: s.subNumber, ma: s.cdcontent || null, type: s.type, margin: s.mrType === 'T', feeRate: s.maxfeerate })),
    sub,
    cash,
    positions: positions?.data || positions,
    orders: orders?.data || orders,
    // Chỉ tiểu khoản cơ sở mới đặt được lệnh qua đường này; phái sinh chưa làm.
    canTrade: shs.realTradingEnabled() && subs.some((s) => s.type === 'EQUITY'),
    realTrading: shs.realTradingEnabled(),
    maxOrderVnd: shs.maxOrderVnd(),
    daily: await dailyUsage('shs', uid, sub, shs.limits()),
    note: shs.realTradingEnabled()
      ? null
      : 'Đặt lệnh SHS thật đang tắt trên máy chủ (SHS_REAL_TRADING), hiện chỉ xem được tài khoản.',
    expiresAt: link.expiresAt,
  };
}, { auth: true });
