/**
 * Phiếu lệnh cho khách hàng.
 *   GET  /api/broker/tickets[?account=]                     danh sách phiếu
 *   POST /api/broker/tickets { action: 'create', account, symbol, side, type, price?, qty, source, note?, instructedAt? }
 *        source = 'app'                  -> chờ khách xác nhận trong app (cổng khách hàng, giai đoạn 2)
 *        source = phone|chat|in_person   -> môi giới ghi nhận chỉ thị, bắt buộc có thời điểm khách ra chỉ thị
 *   POST /api/broker/tickets { action: 'cancel', id }       hủy phiếu chưa gửi
 * Gửi lệnh lên DNSE ở /api/broker/send.
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient, buildOrder, SOURCES, APPROVAL_TTL_MS } from '../../../api/_desk.js';

const COLS = 'id,account_no,investor_id,client_name,symbol,side,type,price,qty,status,source,instruction_note,instructed_at,approved_at,expires_at,dnse_order_id,dnse_status,error,created_at,sent_at';

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'GET') {
    const acc = new URL(req.url, 'http://x').searchParams.get('account');
    const f = acc && /^[0-9A-Za-z]{4,20}$/.test(acc) ? `&account_no=eq.${acc}` : '';
    // phiếu đã duyệt quá hạn mà chưa gửi => đánh dấu hết hạn
    await rest(`/order_tickets?status=eq.approved&expires_at=lt.${new Date().toISOString()}`, { sub: uid, method: 'PATCH', body: { status: 'expired' } });
    return { tickets: await rest(`/order_tickets?select=${COLS}${f}&order=id.desc&limit=100`, { sub: uid }) };
  }

  if (body.action === 'cancel') {
    const id = Number(body.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Thiếu mã phiếu.' });
    const rows = await rest(`/order_tickets?id=eq.${id}&status=in.(draft,pending_client,pending_broker,approved)&select=${COLS}`, {
      sub: uid, method: 'PATCH', prefer: 'return=representation', body: { status: 'cancelled' },
    });
    if (!rows.length) return res.status(409).json({ error: 'Phiếu đã gửi hoặc không còn hủy được.' });
    return { ticket: rows[0] };
  }

  if (body.action !== 'create') return res.status(400).json({ error: 'Thao tác không hợp lệ.' });

  const source = body.source;
  if (!SOURCES.includes(source)) return res.status(400).json({ error: 'Chọn nguồn chỉ thị của khách.' });
  let instructedAt = null;
  if (source !== 'app') {
    instructedAt = body.instructedAt ? new Date(body.instructedAt) : null;
    if (!instructedAt || Number.isNaN(+instructedAt)) return res.status(400).json({ error: 'Ghi thời điểm khách ra chỉ thị.' });
    if (instructedAt > new Date(Date.now() + 60e3)) return res.status(400).json({ error: 'Thời điểm chỉ thị không được ở tương lai.' });
    if (Date.now() - instructedAt > 24 * 3600e3) return res.status(400).json({ error: 'Chỉ thị đã quá 24 giờ, cần xác nhận lại với khách.' });
  }
  const note = String(body.note || '').trim().slice(0, 1000);
  if (source !== 'app' && note.length < 5) return res.status(400).json({ error: 'Ghi chú ngắn nội dung chỉ thị của khách (ít nhất 5 ký tự).' });

  const client = await requireClient(body.account, { need: 'trade' });
  const built = await buildOrder({ accountNo: client.accountNo, symbol: body.symbol, side: body.side, type: body.type, price: body.price, qty: body.qty });

  const now = new Date();
  const rows = await rest(`/order_tickets?select=${COLS}`, {
    sub: uid, method: 'POST', prefer: 'return=representation',
    body: {
      broker_id: uid, account_no: client.accountNo, investor_id: client.investorId, client_name: client.name,
      symbol: built.order.symbol, side: body.side, type: body.type, price: body.type === 'LO' ? Number(body.price) : null, qty: built.order.quantity,
      status: source === 'app' ? 'pending_client' : 'approved',
      source, instruction_note: note || null, instructed_at: instructedAt?.toISOString() || null,
      approved_by: source === 'app' ? null : uid, approved_at: source === 'app' ? null : now.toISOString(),
      expires_at: source === 'app' ? null : new Date(now.getTime() + APPROVAL_TTL_MS).toISOString(),
    },
  });
  return res.status(201).json({ ticket: rows[0], preview: { text: built.text, estValueVnd: built.estValueVnd, ceilingVnd: built.ceilingVnd, floorVnd: built.floorVnd } });
}, { auth: true });
