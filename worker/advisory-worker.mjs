/**
 * worker/advisory-worker.mjs — chạy trên máy local, hai việc:
 *   1. AI: lấy việc trong trade.ai_jobs, gọi Qwen qua Ollama (127.0.0.1, không ra Internet), ghi kết quả.
 *      Câu trả lời được đối chiếu số % với dữ kiện đầu vào; số lạ được đánh dấu cho môi giới thấy.
 *   2. Ảnh chụp danh mục: các ngày thứ 2–6 sau 15:05 (giờ VN), chụp tiền + danh mục của mọi khách care-by vào
 *      trade.portfolio_snapshots để tính hiệu suất thực tế.
 *
 *   node --env-file=.env.local worker/advisory-worker.mjs                 chạy liên tục
 *   node --env-file=.env.local worker/advisory-worker.mjs --snapshot-now  chụp ngay một lần rồi thoát
 *
 * Biến môi trường: SUPABASE_URL, DB_JWT_SECRET, DNSE_API_KEY, DNSE_API_SECRET (cho ảnh chụp),
 *   ADVISORY_MODEL (mặc định qwen3:8b), ADVISORY_OLLAMA_URL (mặc định http://127.0.0.1:11434).
 */
import { rest } from '../api/_db.js';
import * as dnse from '../api/_dnse.js';
import { listClients } from '../api/_desk.js';
import { normalizeAccount } from '../api/_portfolio.js';
import { vnNow } from '../api/_market.js';
import { buildMessages, stripThinking, unknownPercents } from '../api/_ai.js';

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = { role: 'app_worker' };

export const config = () => ({
  model: process.env.ADVISORY_MODEL || 'qwen3:8b',
  ollama: (process.env.ADVISORY_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  timeoutMs: Number(process.env.ADVISORY_TIMEOUT_MS) || 240_000,
});

// ---------------- AI ----------------
export async function callOllama(messages, { model, ollama, timeoutMs } = config()) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${ollama}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ model, messages, stream: false, think: false, options: { temperature: 0.3, num_ctx: 6144 } }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${text.slice(0, 200)}`);
    const j = JSON.parse(text);
    return { content: stripThinking(j.message?.content), evalCount: j.eval_count, ms: Math.round((j.total_duration || 0) / 1e6) };
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `AI quá ${Math.round(timeoutMs / 1000)} giây chưa trả lời` : e.cause?.code === 'ECONNREFUSED' ? 'Ollama chưa chạy trên máy chủ' : e.message);
  } finally { clearTimeout(t); }
}

export async function modelReady({ model, ollama } = config()) {
  try {
    const r = await fetch(`${ollama}/api/tags`);
    const j = await r.json();
    return (j.models || []).some((m) => m.name === model || m.model === model);
  } catch { return false; }
}

/** Lấy và xử lý tối đa một việc. Trả id việc đã xử lý hoặc null. */
export async function processOne(db = rest, ai = callOllama, cfg = config()) {
  const next = (await db('/ai_jobs?status=eq.queued&select=id&order=id.asc&limit=1', W))[0];
  if (!next) return null;
  const claimed = (await db(`/ai_jobs?id=eq.${next.id}&status=eq.queued&select=id,kind,input`, {
    ...W, method: 'PATCH', prefer: 'return=representation', body: { status: 'running', started_at: new Date().toISOString() },
  }))[0];
  if (!claimed) return null;   // tiến trình khác đã lấy
  try {
    const out = await ai(buildMessages(claimed.kind, claimed.input), cfg);
    const content = stripThinking(out.content);
    if (!content) throw new Error('AI trả về nội dung rỗng');
    const bad = unknownPercents(content, claimed.input);
    await db(`/ai_jobs?id=eq.${claimed.id}`, { ...W, method: 'PATCH', body: {
      status: 'done', output: content, model: cfg.model, finished_at: new Date().toISOString(),
      flags: { unknownPercents: bad, tokens: out.evalCount ?? null, ms: out.ms ?? null },
    } });
    log(`ai job ${claimed.id} (${claimed.kind}) xong${bad.length ? `, số lạ: ${bad.join(' ')}` : ''}`);
  } catch (e) {
    await db(`/ai_jobs?id=eq.${claimed.id}`, { ...W, method: 'PATCH', body: { status: 'failed', error: String(e.message).slice(0, 500), model: cfg.model, finished_at: new Date().toISOString() } });
    log(`ai job ${claimed.id} lỗi: ${e.message}`);
  }
  return claimed.id;
}

/** Việc "đang chạy" bị bỏ dở do worker tắt giữa chừng => đánh dấu lỗi để môi giới gửi lại. */
export async function failStale(db = rest, olderThanMin = 10) {
  const cut = new Date(Date.now() - olderThanMin * 60e3).toISOString();
  await db(`/ai_jobs?status=eq.running&started_at=lt.${cut}`, { ...W, method: 'PATCH', body: { status: 'failed', error: 'Worker AI khởi động lại giữa chừng, hãy gửi lại.', finished_at: new Date().toISOString() } });
}

// ---------------- Ảnh chụp danh mục ----------------
export async function snapshotAll({ db = rest, api = dnse, clients = () => listClients({ fresh: true }), pause = 400 } = {}) {
  const today = vnNow().ymd;
  const list = (await clients()).filter((c) => c.canView);
  let ok = 0, failed = 0;
  for (const c of list) {
    try {
      const [balance, positions] = await Promise.all([api.balances(c.accountNo), api.positions(c.accountNo)]);
      const a = normalizeAccount({ balance, positions });
      await db('/portfolio_snapshots?on_conflict=account_no,day', { ...W, method: 'POST', prefer: 'resolution=merge-duplicates', body: {
        account_no: c.accountNo, day: today, nav: Math.round(a.nav), cash: Math.round(a.cash), stock_value: Math.round(a.stockValue), debt: Math.round(a.debt),
        positions: a.holdings.map((h) => ({ symbol: h.symbol, qty: h.qty, price: h.price, cost: h.cost })), taken_at: new Date().toISOString(),
      } });
      ok++;
    } catch (e) {
      failed++;
      log(`chụp ${c.accountNo} lỗi: ${e.message}`);
    }
    if (pause) await sleep(pause);   // DNSE giới hạn số lần gọi mỗi giờ
  }
  log(`ảnh chụp ${today}: ${ok} khách thành công, ${failed} lỗi`);
  return { day: today, ok, failed, total: list.length };
}

/** Đến giờ chụp chưa: thứ 2–6, từ 15:05 giờ VN, và hôm nay chưa chụp. */
export const snapshotDue = (lastDay, ts = Date.now()) => {
  const { ymd, dow, min } = vnNow(ts);
  return dow >= 1 && dow <= 5 && min >= 15 * 60 + 5 && lastDay !== ymd;
};

// ---------------- Vòng chạy chính ----------------
async function main() {
  const cfg = config();
  if (process.argv.includes('--snapshot-now')) { console.log(await snapshotAll()); return; }
  log(`advisory worker: model ${cfg.model} tại ${cfg.ollama}`);
  await failStale().catch((e) => log('failStale:', e.message));
  let lastSnap = null, lastBeat = 0, done = 0, ready = false;
  for (;;) {
    try {
      if (Date.now() - lastBeat > 30e3) {
        ready = await modelReady(cfg);
        if (!ready) log(`chưa thấy model ${cfg.model} trong Ollama (ollama pull ${cfg.model})`);
        await rest('/worker_status?on_conflict=name', { ...W, method: 'POST', prefer: 'resolution=merge-duplicates',
          body: { name: 'advisory', at: new Date().toISOString(), info: { model: cfg.model, modelReady: ready, jobsDone: done, lastSnapshot: lastSnap } } });
        lastBeat = Date.now();
      }
      if (ready && await processOne(rest, callOllama, cfg)) { done++; continue; }
      if (process.env.DNSE_API_KEY && snapshotDue(lastSnap)) {
        const r = await snapshotAll();
        lastSnap = r.day;
      }
    } catch (e) {
      log('lỗi vòng chạy:', e.message);
      await sleep(5000);
    }
    await sleep(2000);
  }
}

if (process.argv[1]?.endsWith('advisory-worker.mjs')) {
  main().catch((e) => { log('dừng:', e.message); process.exit(1); });
}
