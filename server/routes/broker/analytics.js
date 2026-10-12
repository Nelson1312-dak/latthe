/** GET /api/broker/analytics?account=<tiểu khoản> — cơ cấu, rủi ro, hiệu suất, so với danh mục mẫu, đề xuất tái phân bổ. */
import { route } from '../../../api/_http.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';
import { analyzeAccount } from '../../../api/_advisory.js';

export default route('GET, OPTIONS', async ({ req, uid }) => {
  await dnse.assertOwner(uid);
  const client = await requireClient(new URL(req.url, 'http://x').searchParams.get('account'), { need: 'view' });
  const a = await analyzeAccount({ accountNo: client.accountNo, sub: uid, side: 'broker', plan: true });
  return { client, canTrade: client.canTrade, ...a };
}, { auth: true });
