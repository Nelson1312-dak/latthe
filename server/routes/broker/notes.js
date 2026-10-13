/**
 * Nhận xét danh mục môi giới gửi khách (thường từ bản nháp AI đã sửa).
 *   GET  /api/broker/notes[?account=]
 *   POST /api/broker/notes { account, title, body, aiJobId? }   khách phải đã liên kết tiểu khoản đó với Lật Bài
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';

const COLS = 'id,account_no,title,body,ai_job_id,ai_edited,seen_at,created_at';
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);
  if (req.method === 'GET') {
    const acc = new URL(req.url, 'http://x').searchParams.get('account');
    const f = acc && /^[0-9A-Za-z]{4,20}$/.test(acc) ? `&account_no=eq.${acc}` : '';
    return { notes: await rest(`/client_notes?select=${COLS}${f}&order=id.desc&limit=50`, { sub: uid }) };
  }
  const account = String(body.account || '');
  if (!/^[0-9A-Za-z]{4,20}$/.test(account)) return res.status(400).json({ error: 'Thiếu tiểu khoản.' });
  const title = norm(body.title).slice(0, 120), text = String(body.body || '').trim();
  if (title.length < 3) return res.status(400).json({ error: 'Nhập tiêu đề (ít nhất 3 ký tự).' });
  if (text.length < 20 || text.length > 4000) return res.status(400).json({ error: 'Nội dung từ 20 đến 4.000 ký tự.' });
  const link = (await rest(`/client_links?account_no=eq.${account}&select=user_id&limit=1`, { sub: uid }))[0];
  if (!link) return res.status(409).json({ error: 'Khách chưa liên kết tiểu khoản này với Lật Bài nên chưa nhận được nhận xét. Hãy gửi link mời trước.' });

  let aiJobId = null, aiEdited = null;
  if (body.aiJobId) {
    const job = (await rest(`/ai_jobs?id=eq.${Number(body.aiJobId)}&status=eq.done&select=id,output`, { sub: uid }))[0];
    if (job) { aiJobId = job.id; aiEdited = norm(job.output) !== norm(text); }
  }
  const note = (await rest(`/client_notes?select=${COLS}`, {
    sub: uid, method: 'POST', prefer: 'return=representation',
    body: { broker_id: uid, user_id: link.user_id, account_no: account, title, body: text, ai_job_id: aiJobId, ai_edited: aiEdited },
  }))[0];
  return res.status(201).json({ note });
}, { auth: true });
