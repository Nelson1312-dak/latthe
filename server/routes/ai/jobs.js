/**
 * Việc cho AI local (Qwen qua Ollama trên máy chủ nhà). Vercel chỉ xếp việc vào DB; worker local lấy việc và trả kết quả.
 *   POST /api/ai/jobs { kind: 'portfolio_review' | 'rebalance_note', account }   (môi giới)
 *   GET  /api/ai/jobs?id=<id>       trạng thái + kết quả
 *   GET  /api/ai/jobs               10 việc gần nhất + trạng thái worker AI
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';
import { analyzeAccount, factsForAI } from '../../../api/_advisory.js';
import { KINDS } from '../../../api/_ai.js';

const COLS = 'id,kind,status,output,model,flags,error,created_at,started_at,finished_at';

async function workerStatus() {
  const w = (await rest('/worker_status?name=eq.advisory&select=at,info', { role: 'app_worker' }).catch(() => []))[0];
  if (!w) return { alive: false };
  return { alive: Date.now() - Date.parse(w.at) < 90e3, at: w.at, model: w.info?.model || null, ready: !!w.info?.modelReady };
}

export default route('GET, POST, OPTIONS', async ({ req, res, uid, body }) => {
  await dnse.assertOwner(uid);

  if (req.method === 'GET') {
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    if (id) {
      const job = (await rest(`/ai_jobs?id=eq.${Number(id)}&select=${COLS}`, { sub: uid }))[0];
      if (!job) return res.status(404).json({ error: 'Không tìm thấy việc.' });
      return { job };
    }
    const [jobs, worker] = await Promise.all([rest(`/ai_jobs?select=${COLS}&order=id.desc&limit=10`, { sub: uid }), workerStatus()]);
    return { jobs, worker };
  }

  if (!KINDS.includes(body.kind)) return res.status(400).json({ error: 'Loại việc không hợp lệ.' });
  const busy = await rest('/ai_jobs?status=in.(queued,running)&select=id', { sub: uid });
  if (busy.length >= 3) return res.status(429).json({ error: 'Đang có 3 việc AI chờ xử lý, đợi xong rồi gửi tiếp.' });
  const client = await requireClient(body.account, { need: 'view' });
  const a = await analyzeAccount({ accountNo: client.accountNo, sub: uid, side: 'broker', plan: true });
  if (!a.composition.rows.length && !a.model) return res.status(400).json({ error: 'Tài khoản chưa có cổ phiếu và chưa gán danh mục mẫu, chưa có gì để AI nhận xét.' });
  if (body.kind === 'rebalance_note' && !a.rebalance?.ok) return res.status(400).json({ error: 'Chưa có đề xuất tái phân bổ (cần gán danh mục mẫu).' });
  const job = (await rest(`/ai_jobs?select=${COLS}`, {
    sub: uid, method: 'POST', prefer: 'return=representation',
    body: { user_id: uid, kind: body.kind, input: factsForAI(a) },
  }))[0];
  return res.status(201).json({ job, worker: await workerStatus() });
}, { auth: true });
