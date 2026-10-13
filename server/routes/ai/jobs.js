/**
 * Việc cho AI local (Qwen qua Ollama trên máy chủ nhà). Vercel chỉ xếp việc vào DB; worker local lấy việc và trả kết quả.
 *   POST /api/ai/jobs { kind: 'portfolio_review' | 'rebalance_note' | 'client_note', account }   (môi giới)
 *   POST /api/ai/jobs { kind: 'advice_draft', symbol, side?, entryLow?, entryHigh?, target?, stop?, notes? }
 *   GET  /api/ai/jobs?id=<id>       trạng thái + kết quả
 *   GET  /api/ai/jobs               10 việc gần nhất + trạng thái worker AI
 */
import { route } from '../../../api/_http.js';
import { rest } from '../../../api/_db.js';
import * as dnse from '../../../api/_dnse.js';
import { requireClient } from '../../../api/_desk.js';
import { analyzeAccount, factsForAI } from '../../../api/_advisory.js';
import { KINDS } from '../../../api/_ai.js';
import { checkAdvice } from '../../../api/_technical.js';
import { symbolData } from '../broker/symbol.js';
import { symbolSummary } from '../symbol.js';
import { fundamentalsForAdvice } from '../../../api/_facts.js';

const COLS = 'id,kind,status,output,model,flags,error,created_at,started_at,finished_at';

const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);

const v1 = (x) => String(Math.round(Math.abs(x) * 10) / 10).replace('.', ',');
const v2 = (x) => String(x).replace('.', ',');
/** Câu dẫn chứng kỹ thuật viết sẵn: model nhỏ hay đảo dấu, lộ tên trường hoặc thêm số không có. */
function evidenceSentence(symbol, t) {
  const bits = [];
  if (t.xu_huong) bits.push(`${symbol} đang trong xu hướng ${t.xu_huong}`);
  if (t.rsi14 != null) bits.push(`RSI 14 phiên ở mức ${v1(t.rsi14)}${t.rsi_nhan_dinh && t.rsi_nhan_dinh !== 'trung tính' ? ` (${t.rsi_nhan_dinh})` : ''}`);
  const m = t.hieu_suat?.['1M'];
  if (m?.so_voi_vnindex) bits.push(`1 tháng qua giá ${m.ma >= 0 ? 'tăng' : 'giảm'} ${v1(m.ma)}%, ${m.so_voi_vnindex}`);
  return bits.length ? bits.join('; ') + '.' : null;
}
function planSentence(p, c) {
  const z = p.entryLow || p.entryHigh ? `vùng mua ${v2(p.entryLow ?? p.entryHigh)}–${v2(p.entryHigh ?? p.entryLow)} nghìn đồng` : null;
  const parts = [z, p.target ? `mục tiêu ${v2(p.target)}${c.upsidePct != null ? ` (${c.upsidePct >= 0 ? '+' : '-'}${v1(c.upsidePct)}%)` : ''}` : null,
    p.stop ? `cắt lỗ ${v2(p.stop)}${c.downsidePct != null ? ` (-${v1(c.downsidePct)}%)` : ''}` : null,
    c.rr != null ? `tỷ lệ lời/lỗ ${v1(c.rr)} lần` : null].filter(Boolean);
  return parts.length ? parts.join(', ') + '.' : null;
}
function againstTrend(side, t) {
  const down = /^giảm/.test(t.xu_huong || ''), up = /^tăng/.test(t.xu_huong || '');
  if (side === 'B' && down) return 'Đây là khuyến nghị mua khi xu hướng còn giảm: nên giải ngân từng phần và tuân thủ giá cắt lỗ.';
  if (side === 'S' && up) return 'Đây là khuyến nghị bán khi xu hướng còn tăng: nên bán từng phần và tuân thủ giá dừng.';
  return null;
}

/** Dữ kiện cho AI soạn luận điểm khuyến nghị: kỹ thuật của mã + kế hoạch môi giới nhập + ý chính môi giới gõ. */
async function adviceFacts(body, res) {
  const symbol = String(body.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) { res.status(400).json({ error: 'Mã chứng khoán không hợp lệ.' }); return null; }
  const side = body.side === 'B' || body.side === 'S' ? body.side : null;
  const d = await symbolData(symbol);
  if (!d.tech) { res.status(400).json({ error: `Không đủ dữ liệu giá của ${symbol}.` }); return null; }
  const plan = { side, entryLow: num(body.entryLow), entryHigh: num(body.entryHigh), target: num(body.target), stop: num(body.stop) };
  const c = checkAdvice(plan, d.tech.gia);
  if (c.errors.length) { res.status(400).json({ error: c.errors.join(' ') }); return null; }
  const vi = (v) => (v == null ? null : String(v).replace('.', ','));
  return {
    ma: symbol, ten: d.info?.name || null, nganh: d.info?.sector || null,
    chieu: side === 'B' ? 'Mua' : side === 'S' ? 'Bán' : 'Theo dõi',
    ke_hoach: {
      vung_vao: plan.entryLow || plan.entryHigh ? `${vi(plan.entryLow ?? plan.entryHigh)} – ${vi(plan.entryHigh ?? plan.entryLow)}` : null,
      muc_tieu: plan.target, cat_lo: plan.stop, tiem_nang_pct: c.upsidePct, rui_ro_pct: c.downsidePct,
      ty_le_loi_lo: c.rr == null ? null : `${vi(c.rr.toFixed(1))} lần`,
      don_vi_gia: 'nghìn đồng',
    },
    ky_thuat: d.tech,
    muc_rui_ro_co_phieu: d.risk === 'high' ? 'biến động cao' : d.risk === 'medium' ? 'biến động trung bình' : d.risk === 'low' ? 'biến động thấp' : null,
    y_chinh_cua_moi_gioi: String(body.notes || '').trim().slice(0, 600) || null,
    co_ban: fundamentalsForAdvice((await symbolSummary(symbol).catch(() => null))?.facts),
    luu_y: c.warnings,
    cau_dan_chung: evidenceSentence(symbol, d.tech),
    cau_ke_hoach: planSentence(plan, c),
    cau_nguoc_xu_huong: againstTrend(side, d.tech),
    // Câu công bố rủi ro bắt buộc: AI bỏ sót thì worker tự thêm vào cuối
    cau_bat_buoc: [againstTrend(side, d.tech)].filter(Boolean),
  };
}

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

  let input;
  if (body.kind === 'advice_draft') input = await adviceFacts(body, res);
  else {
    const client = await requireClient(body.account, { need: 'view' });
    const a = await analyzeAccount({ accountNo: client.accountNo, sub: uid, side: 'broker', plan: true });
    if (!a.composition.rows.length && !a.model) return res.status(400).json({ error: 'Tài khoản chưa có cổ phiếu và chưa gán danh mục mẫu, chưa có gì để AI nhận xét.' });
    if (body.kind === 'rebalance_note' && !a.rebalance?.ok) return res.status(400).json({ error: 'Chưa có đề xuất tái phân bổ (cần gán danh mục mẫu).' });
    input = factsForAI(a);
  }
  if (!input) return;   // adviceFacts đã trả lỗi 400
  const job = (await rest(`/ai_jobs?select=${COLS}`, {
    sub: uid, method: 'POST', prefer: 'return=representation',
    body: { user_id: uid, kind: body.kind, input },
  }))[0];
  return res.status(201).json({ job, worker: await workerStatus() });
}, { auth: true });
