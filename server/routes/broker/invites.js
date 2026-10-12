/**
 * Lời mời liên kết cho khách.
 *   POST /api/broker/invites { account }  -> tạo mã mời một lần (72 giờ). Mã gốc chỉ trả về ở lần này.
 *   GET  /api/broker/invites               -> danh sách lời mời và khách đã liên kết
 * Khách vẫn phải tự liên kết với môi giới trên Entrade X (quyền ADVISOR/BROKER); mã mời chỉ nối tài khoản Lật Bài
 * của khách với tiểu khoản đó, để khách thấy khuyến nghị và xác nhận phiếu lệnh.
 */
import crypto from 'node:crypto';
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';
import { hashToken } from '../../../api/_auth.js';
import { originOf } from '../../../api/_google.js';

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'GET') {
    const [invites, links] = await Promise.all([
      rest('/client_invites?select=id,account_no,client_name,expires_at,used_at,created_at&order=id.desc&limit=100', { sub: uid }),
      rest('/client_links?select=id,account_no,client_name,created_at,user_id&order=id.desc', { sub: uid }),
    ]);
    const now = Date.now();
    return {
      invites: invites.map((i) => ({ ...i, state: i.used_at ? 'used' : Date.parse(i.expires_at) < now ? 'expired' : 'open' })),
      links: links.map(({ user_id, ...l }) => l),
    };
  }

  const client = await requireClient(body.account, { need: 'view' });
  if (!client.investorId) return res.status(409).json({ error: 'DNSE không trả mã khách hàng cho tiểu khoản này.' });
  const token = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + 72 * 3600e3);
  await rest('/client_invites', {
    sub: uid, method: 'POST',
    body: { broker_id: uid, investor_id: client.investorId, account_no: client.accountNo, client_name: client.name, token_hash: hashToken(token), expires_at: expires.toISOString() },
  });
  return res.status(201).json({ link: `${originOf(req)}/?moi=${token}#tai-khoan`, expiresAt: expires.toISOString(), client: { name: client.name, accountNo: client.accountNo } });
}, { auth: true });
