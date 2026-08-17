/**
 * api/prewarm-daily.js — Sinh sẵn lời luận "Lá Bài Hôm Nay" vào cache dùng chung,
 * để MỌI user nhận trả lời tức thì (X-AI-Source: cache-exact) thay vì chờ Ollama.
 *
 * Cách làm: gọi HTTP tới /api/interpret bằng ĐÚNG payload mà tarot/js/app.js gửi
 * (question + context + type + memory rỗng). CỐ Ý không tự gọi _llm.js: mọi hậu xử
 * lý (strip <think>, cleanChineseLeaks, dedup header /u) và storeDoc đều nằm trong
 * interpret.js — nhân bản chúng ở đây là drift chờ sẵn (cache chứa câu KHÁC với câu
 * interpret.js sinh ra mà không ai phát hiện). Đổi 1 HTTP hop nội bộ lấy 0 dòng lặp.
 *
 * Pre-warm CẢ hôm nay VÀ ngày mai: cron chạy giờ nào cũng phủ trọn khung 00:00-07:00
 * ICT của ngày kế tiếp (lúc dateKey client đã sang ngày mới) → không phải đổi giờ
 * cron push 7h sáng, không cần cron thứ 3.
 *
 * Bảo vệ bằng CRON_SECRET. Gọi tay: /api/prewarm-daily?key=<CRON_SECRET>
 * Idempotent: lá đã có cache thì interpret trả cache-exact, không sinh AI lần nữa.
 */
import daily from './_daily.js';
import { getEmbedding } from './_rag.js';

// PHẢI khớp TỪNG BYTE với DAILY_Q ở tarot/js/app.js (scripts/check-infra.mjs canh).
const DAILY_QUESTION = 'Lá bài hôm nay muốn nhắn nhủ điều gì cho tôi?';

// Gọi qua domain public: đơn giản, chắc chắn không vướng Deployment Protection của
// URL deployment, và đi đúng code path production. Origin PHẢI nằm trong whitelist
// api/_cors.js — server-side fetch không tự có Origin (đúng lỗi 403 mà eval-rag.mjs
// từng gặp). PREWARM_BASE_URL override được nếu cần trỏ preview.
const BASE = ((process.env.PREWARM_BASE_URL || '').trim().replace(/\/+$/, '')) || 'https://latbai.vn';
const ORIGIN = 'https://latbai.vn';

const PER_CALL_MS = 40_000; // abort của TA không giết generation phía interpret (nó
                            // không phải SSE ở đây nên chạy tiếp + vẫn storeDoc).
const BUDGET_MS = 45_000;   // còn dưới mốc này mới bắt đầu lá thứ 2 (maxDuration 60).

// FNV-1a — trùng hashHex() trong api/_push.js và fnv() trong tarot/js/app.js.
function fnv(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// dateKey theo giờ VN (UTC+7) — trùng todaysFortune() và client.
function dateKeyICT(ms) {
  const d = new Date(ms + 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
const cardFor = (dateKey) => daily.tarot[fnv(dateKey + '#tarot') % daily.tarot.length];

export default async function handler(req, res) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const auth = req.headers.authorization || '';
  const keyQuery = (req.query?.key || '').toString();
  if (!(secret && (auth === `Bearer ${secret}` || keyQuery === secret))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ollamaUrl = (process.env.OLLAMA_BASE_URL || '').trim();
  const embedModel = (process.env.OLLAMA_EMBED_MODEL || '').trim() || 'nomic-embed-text';

  // PC nhà tắt (7h sáng rất hay gặp) → không có embedding, mà PostgREST cũng CHUNG
  // ngrok tunnel với Ollama nên storeDoc cũng chết. Điều kiện ghi cache của
  // interpret.js là (cacheEligible && embedding && !localDown) ⇒ để nó rơi sang
  // DeepSeek chỉ đốt quota mà KHÔNG cache được gì. Probe rồi thoát sớm là đúng.
  const probe = ollamaUrl ? await getEmbedding(ollamaUrl, embedModel, 'ping', { localDown: false }) : null;
  if (!probe) {
    console.warn('[prewarm-daily] local backend down — bỏ qua, không gọi cloud LLM');
    return res.status(200).json({ ok: true, skipped: 'local-down' });
  }

  const now = Date.now();
  const days = [
    { label: 'today', dateKey: dateKeyICT(now) },
    { label: 'tomorrow', dateKey: dateKeyICT(now + 86_400_000) },
  ];

  const t0 = Date.now();
  const results = [];
  for (const d of days) {
    if (Date.now() - t0 > BUDGET_MS) { results.push({ ...d, status: 'skip-deadline' }); continue; }
    const card = cardFor(d.dateKey);
    // ctx chỉ có sau khi chạy `npm run build:daily` — thiếu thì báo rõ, đừng đoán.
    if (!card?.ctx) { results.push({ ...d, status: 'no-ctx (chạy npm run build:daily)' }); continue; }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PER_CALL_MS);
    try {
      const r = await fetch(`${BASE}/api/interpret`, {
        method: 'POST',
        // KHÔNG set Accept: fetch mặc định '*/*' nên interpret.js (wantsSSE=false)
        // trả JSON thuần, không mở SSE — đúng thứ cần cho lệnh gọi máy-với-máy.
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({
          question: DAILY_QUESTION, context: card.ctx,
          type: 'tarot', history: [], memory: '',
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      const body = await r.json().catch(() => ({}));
      results.push({
        ...d, card: card.vn,
        status: r.ok ? 'ok' : `http-${r.status}`,
        source: r.headers.get('x-ai-source') || '?',
        len: (body.answer || '').length,
        error: body.error,
      });
    } catch (err) {
      clearTimeout(timer);
      // Abort vẫn có thể thành công phía interpret (nó tự chạy tiếp + storeDoc).
      results.push({ ...d, card: card.vn, status: err.name === 'AbortError' ? 'timeout' : 'fetch-error', error: err.message });
    }
  }

  console.log('[prewarm-daily]', JSON.stringify(results));
  return res.status(200).json({ ok: true, results });
}
