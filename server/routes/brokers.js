/**
 * GET    /api/brokers            — danh sách công ty chứng khoán và trạng thái kết nối của bạn
 * DELETE /api/brokers?broker=shs — ngắt kết nối
 */
import { route } from '../../api/_http.js';
import { BROKERS, assertOwner, readLink, removeLink } from '../../api/_broker.js';
import { readTradingCookie } from '../../api/_dnse.js';

export default route('GET, DELETE, OPTIONS', async ({ req, res, uid }) => {
  let owner = true;
  try { await assertOwner(uid); } catch { owner = false; }

  if (req.method === 'DELETE') {
    await assertOwner(uid);
    const b = new URL(req.url, 'http://x').searchParams.get('broker');
    if (!BROKERS[b]) return { error: 'Công ty chứng khoán không hợp lệ.' };
    await removeLink(uid, b);
    return { disconnected: b };
  }

  const list = await Promise.all(Object.values(BROKERS).map(async (b) => {
    const link = owner ? await readLink(uid, b.id).catch(() => null) : null;
    return {
      ...b,
      available: owner,
      connected: !!link?.connected,
      accountNo: link?.accountNo || null,
      display: link?.display || null,
      expiresAt: link?.expiresAt || null,
    };
  }));
  // Trạng thái phiên giao dịch: không có nó thì sau khi xác thực OTP xong màn hình y như cũ,
  // người dùng không biết đã vào được hay chưa.
  let tt = null;
  try { tt = owner ? readTradingCookie(req, uid) : null; } catch { tt = null; }
  return {
    owner,
    trading: { active: !!tt, expiresAt: tt ? new Date(tt.exp).toISOString() : null },
    brokers: list,
    note: owner ? null : 'Phần kết nối tài khoản chứng khoán thật hiện chỉ mở cho chủ hệ thống. Bạn vẫn dùng được tài khoản giao dịch thử.',
  };
}, { auth: true });
