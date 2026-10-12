/** GET /api/broker/clients[?fresh=1] — khách hàng môi giới đang quản lý (care-by DNSE) kèm quyền. */
import { route } from '../../../api/_http.js';
import * as dnse from '../../../api/_dnse.js';
import { listClients } from '../../../api/_desk.js';

export default route('GET, OPTIONS', async ({ req, uid }) => {
  await dnse.assertOwner(uid);
  const fresh = new URL(req.url, 'http://x').searchParams.get('fresh') === '1';
  const clients = await listClients({ fresh });
  return {
    clients,
    summary: {
      total: clients.length,
      canTrade: clients.filter((c) => c.canTrade).length,
      viewOnly: clients.filter((c) => c.canView && !c.canTrade).length,
      nav: clients.reduce((a, c) => a + (Number(c.nav.total) || 0), 0),
    },
    trading: { active: !!dnse.readTradingCookie(req, uid), realTrading: dnse.realTradingEnabled() },
  };
}, { auth: true });
