/** GET /api/broker/client?account=<tiểu khoản> — tiền, danh mục, sổ lệnh của một khách (cần ADVISOR hoặc BROKER). */
import { route } from '../_http.js';
import * as dnse from '../_dnse.js';
import { requireClient } from '../_desk.js';

const val = (r) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Lỗi' });

export default route('GET, OPTIONS', async ({ req, uid }) => {
  await dnse.assertOwner(uid);
  const acc = new URL(req.url, 'http://x').searchParams.get('account');
  const client = await requireClient(acc, { need: 'view' });
  const [balance, positions, orders] = (await Promise.allSettled([
    dnse.balances(client.accountNo), dnse.positions(client.accountNo), dnse.orderBook(client.accountNo),
  ])).map(val);
  return { client, balance, positions, orders };
}, { auth: true });
