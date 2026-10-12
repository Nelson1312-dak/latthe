/**
 * Khuyến nghị của môi giới gửi cho khách đã liên kết.
 *   GET  /api/broker/advice
 *   POST /api/broker/advice { symbol, side?, entryLow?, entryHigh?, target?, stop?, thesis, validDays?, accounts?: [tiểu khoản] }
 * Không gửi accounts = gửi cho mọi khách đã liên kết. DB chỉ cho gửi tới khách đã liên kết với chính môi giới.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';

const price = (v, label) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new dnse.DnseError(`${label} không hợp lệ.`, 400);
  return n;
};

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'GET') {
    const rows = await rest('/advice?select=id,symbol,side,entry_low,entry_high,target,stop,thesis,valid_until,created_at,advice_recipients(user_id,seen_at)&order=id.desc&limit=50', { sub: uid });
    return {
      advice: rows.map(({ advice_recipients: r = [], ...a }) => ({ ...a, sent: r.length, seen: r.filter((x) => x.seen_at).length })),
    };
  }

  const symbol = String(body.symbol || '').toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) return res.status(400).json({ error: 'Mã chứng khoán không hợp lệ.' });
  const side = body.side === 'B' || body.side === 'S' ? body.side : null;
  const thesis = String(body.thesis || '').trim();
  if (thesis.length < 10) return res.status(400).json({ error: 'Viết luận điểm khuyến nghị (ít nhất 10 ký tự).' });
  const entryLow = price(body.entryLow, 'Giá vào thấp'), entryHigh = price(body.entryHigh, 'Giá vào cao');
  if (entryLow && entryHigh && entryLow > entryHigh) return res.status(400).json({ error: 'Vùng giá vào bị ngược.' });
  const target = price(body.target, 'Giá mục tiêu'), stop = price(body.stop, 'Giá cắt lỗ');
  const days = Math.min(Math.max(parseInt(body.validDays || '7', 10) || 7, 1), 90);

  let links = await rest('/client_links?select=user_id,account_no', { sub: uid });
  if (Array.isArray(body.accounts) && body.accounts.length) {
    const want = new Set(body.accounts.map(String));
    links = links.filter((l) => want.has(l.account_no));
  }
  if (!links.length) return res.status(409).json({ error: 'Chưa có khách nào liên kết với Lật Bài để nhận khuyến nghị. Hãy gửi link mời cho khách trước.' });

  const adv = (await rest('/advice?select=id', {
    sub: uid, method: 'POST', prefer: 'return=representation',
    body: { broker_id: uid, symbol, side, entry_low: entryLow, entry_high: entryHigh, target, stop, thesis, valid_until: new Date(Date.now() + days * 86400e3).toISOString() },
  }))[0];
  const users = [...new Set(links.map((l) => l.user_id))];
  await rest('/advice_recipients', { sub: uid, method: 'POST', body: users.map((u) => ({ advice_id: adv.id, user_id: u, broker_id: uid })) });
  return res.status(201).json({ id: adv.id, sentTo: users.length });
}, { auth: true });
