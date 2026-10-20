/**
 * Lời mời liên kết cho khách.
 *   POST   /api/broker/invites { account }           -> tạo mã mời một lần (72 giờ). Mã gốc chỉ trả về ở lần này.
 *   GET    /api/broker/invites                        -> danh sách lời mời và khách đã liên kết
 *   POST   /api/broker/invites { action:'revoke', id } -> thu hồi lời mời chưa dùng
 *   DELETE /api/broker/invites?link=<id>              -> hủy liên kết với một khách
 *
 * Vì sao phải thu hồi được: mã mời là bằng chứng danh tính duy nhất — ai cầm chuỗi token và đăng
 * nhập được là liên kết được, rồi đọc NAV, danh mục và sổ lệnh của tiểu khoản đó. Gửi nhầm vào
 * một cuộc trò chuyện khác mà phải ngồi đợi hết 72 giờ là không chấp nhận được.
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

export default route('GET, POST, DELETE, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'GET') {
    const [invites, links] = await Promise.all([
      rest('/client_invites?select=id,account_no,client_name,expires_at,used_at,revoked_at,created_at&order=id.desc&limit=100', { sub: uid }),
      rest('/client_links?select=id,account_no,client_name,created_at,user_id&order=id.desc', { sub: uid }),
    ]);
    const now = Date.now();
    const trangThai = (i) => (i.used_at ? 'used' : i.revoked_at ? 'revoked' : Date.parse(i.expires_at) < now ? 'expired' : 'open');
    return {
      invites: invites.map((i) => ({ ...i, state: trangThai(i) })),
      links: links.map(({ user_id, ...l }) => l),
    };
  }

  // Thu hồi: chỉ đánh dấu, KHÔNG xóa. Lời mời là một mắt xích trong chuỗi bằng chứng ai mời ai,
  // nên phải còn lại trong nhật ký. Chỉ thu hồi được lời mời chưa ai dùng.
  if (req.method === 'POST' && body.action === 'revoke') {
    const id = Number(body.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Thiếu mã lời mời.' });
    const rows = await rest(`/client_invites?id=eq.${id}&used_at=is.null&revoked_at=is.null&select=id,account_no`, {
      sub: uid, method: 'PATCH', prefer: 'return=representation',
      body: { revoked_at: new Date().toISOString(), revoked_by: uid },
    });
    if (!rows.length) return res.status(409).json({ error: 'Lời mời đã được dùng, đã thu hồi, hoặc không tồn tại.' });
    return { revoked: rows[0] };
  }

  // Hủy liên kết. Khách mất quyền xem khuyến nghị và xác nhận phiếu ngay lập tức; phía DNSE thì
  // khách tự gỡ ủy quyền trên Entrade X, Lật Bài không đụng tới được.
  if (req.method === 'DELETE') {
    const id = Number(new URL(req.url, 'http://x').searchParams.get('link'));
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Thiếu mã liên kết.' });
    const rows = await rest(`/client_links?id=eq.${id}&select=id,account_no,client_name`, {
      sub: uid, method: 'DELETE', prefer: 'return=representation',
    });
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy liên kết này.' });
    return { unlinked: rows[0] };
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
