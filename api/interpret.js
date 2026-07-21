/**
 * api/interpret.js — Vercel Serverless Function
 * - Conversation history: passes prior turns to Ollama for multi-turn memory
 * - RAG: embeds question → retrieves similar past Q&As → augments context
 *   Requires: SUPABASE_URL, SUPABASE_ANON_KEY (optional — degrades gracefully)
 *   Requires: OLLAMA_EMBED_MODEL pulled in Ollama (default: nomic-embed-text)
 */

import { applyCors } from './_cors.js';
import { getClientIp, checkRateLimit, checkDailyBudget } from './_rateLimit.js';
import { callCloudLLM, cleanChineseLeaks, streamOllama, createThinkHoldback, stripCJKChars } from './_llm.js';
import { getEmbedding, retrieveSimilar, retrieveKnowledge, storeDoc, checkExactMatchCache } from './_rag.js';
import { SYSTEM_PROMPTS, buildFirstUserContent } from './_prompts.js';

// Prevent uncaught exceptions / unhandled rejections from crashing the dev server
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ---- Main handler ----

// Enables progressive res.write() flushing on legacy (non-Fluid) compute; no-op on Fluid.
export const config = { supportsResponseStreaming: true };

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

  // ---- Rate limit per IP ----
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  // Diagnostic: which limiter served this request (upstash vs memory-*).
  res.setHeader('X-RateLimit-Backend', rl.backend || 'unknown');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({
      error: `Bạn đang hỏi hơi nhanh 🙏 Vui lòng đợi ${rl.retryAfter} giây rồi thử lại.`,
    });
  }

  const ollamaUrl  = (process.env.OLLAMA_BASE_URL  || '').trim();
  const model      = (process.env.OLLAMA_MODEL      || '').trim() || 'qwen3.5:2b';
  const embedModel = (process.env.OLLAMA_EMBED_MODEL|| '').trim() || 'nomic-embed-text';
  const sbUrl      = (process.env.SUPABASE_URL      || '').trim();
  const sbKey      = (process.env.SUPABASE_ANON_KEY || '').trim();
  const dsKey      = (process.env.DEEPSEEK_API_KEY  || '').trim();
  const dsModel    = (process.env.DEEPSEEK_MODEL    || '').trim() || 'deepseek-chat';
  // Full OpenAI-compatible completions URL. DeepSeek default; override to point at
  // any other provider (e.g. Groq) without code changes.
  const dsUrl      = (process.env.DEEPSEEK_BASE_URL || '').trim() || 'https://api.deepseek.com/chat/completions';
  const ollamaTimeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS   || '', 10) || 20000;
  const dsTimeoutMs     = parseInt(process.env.DEEPSEEK_TIMEOUT_MS || '', 10) || 25000;

  if (!ollamaUrl && !dsKey) {
    return res.status(503).json({ error: 'AI chưa được cấu hình (thiếu OLLAMA_BASE_URL hoặc DEEPSEEK_API_KEY)' });
  }

  let { question, context, type, history = [], memory = '' } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

  // Lazy SSE commit: the client opts in via Accept, but we only switch to SSE when
  // the first Ollama token actually arrives. Until then every path (cache hits,
  // rate limit, DeepSeek fallback, errors) responds with plain JSON exactly as
  // before — old cached clients never send this header and are untouched.
  const wantsSSE = /text\/event-stream/i.test(req.headers.accept || '');

  // Validate & clamp inputs: stop oversized prompts and cache/DB pollution from
  // arbitrary `type` values. Caps sit far above any legitimate client payload
  // (questions are short; tuvi context is a text summary; client history ≤ 8).
  const VALID_TYPES = ['gieoque', 'tarot', 'tuvi', 'thansohoc', 'hoangdao', 'xinxam'];
  if (!VALID_TYPES.includes(type)) type = 'gieoque';
  if (question.length > 4000) question = question.slice(0, 4000);
  if (typeof context === 'string' && context.length > 30000) context = context.slice(0, 30000);
  if (!Array.isArray(history)) history = [];
  if (history.length > 20) history = history.slice(-20);

  const isFollowUp = history.length > 0;

  // "Ký ức" các lần xem trước của user (client gửi từ localStorage, chỉ câu đầu).
  // Không lưu server-side; chỉ dùng để cá nhân hóa prompt của request này.
  if (typeof memory !== 'string' || isFollowUp) memory = '';
  if (memory.length > 1500) memory = memory.slice(0, 1500);

  // Circuit breaker: the DB (PostgREST) and Ollama share one ngrok tunnel, so when
  // the local box is down they ALL fail. The first local call that hits a network
  // error / timeout flips this flag; every later local call then short-circuits
  // instantly instead of waiting out its own timeout — that prevents the stacked
  // ~47s wait that previously blew past the client's timeout before DeepSeek could run.
  const breaker = { localDown: false };

  // Tử Vi charts are unique per person, so the Q&A cache (exact/semantic) and
  // storeDoc almost never hit for tuvi — keep those gated to non-tuvi.
  // Có memory cũng loại: câu trả lời nhắc ký ức cá nhân ("Lần trước bạn hỏi...")
  // mà vào cache/RAG chung thì user khác sẽ nhận nhầm ký ức không phải của họ.
  const cacheEligible = type !== 'tuvi' && !isFollowUp && !memory;
  // We still need an embedding for KNOWLEDGE grounding (Thư Viện), which IS useful
  // for tuvi (the question matches theory regardless of the unique chart). So compute
  // it for every first-question; follow-ups reuse prior context and skip it.
  const needEmbedding = !isFollowUp;

  // ---- 1. Tier-1 exact-match cache + embedding (run in parallel; both are local) ----
  let exactCached = null;
  let embedding = null;
  await Promise.all([
    cacheEligible
      ? checkExactMatchCache(sbUrl, sbKey, type, question, context, breaker).then((v) => { exactCached = v; })
      : Promise.resolve(),
    needEmbedding
      ? getEmbedding(ollamaUrl, embedModel, question, breaker).then((v) => { embedding = v; })
      : Promise.resolve(),
  ]);
  if (exactCached) {
    res.setHeader('X-AI-Source', 'cache-exact');
    return res.status(200).json({ answer: exactCached, cached: true });
  }
  // ---- System prompt ----
  const systemPrompt = (SYSTEM_PROMPTS[type] ?? SYSTEM_PROMPTS.gieoque)[isFollowUp ? 'followup' : 'first'];

  // ---- 2. RAG & Tier-2 semantic cache ----
  // The embedding was computed above (in parallel with the exact-cache check).
  // Skipped for tuvi / follow-ups, and skipped entirely if the local box is down.
  let fullContext = context || '';

  if (needEmbedding && embedding && !breaker.localDown) {
    // Thư Viện knowledge (all types) + Q&A cache (non-tuvi only) in parallel.
    const [similar, knowledge] = await Promise.all([
      cacheEligible ? retrieveSimilar(sbUrl, sbKey, embedding, type, breaker) : Promise.resolve([]),
      retrieveKnowledge(sbUrl, sbKey, embedding, type, breaker),
    ]);

    // Ground the interpretation in relevant Thư Viện theory (if indexed).
    if (knowledge && knowledge.length > 0) {
      const kbBlock = knowledge.map(d => `• ${d.question}: ${d.answer}`).join('\n');
      fullContext += `\n\n[Kiến thức nền từ Thư Viện — dùng để luận giải cho chính xác, KHÔNG sao chép nguyên văn]\n${kbBlock}`;
    }

    if (similar && similar.length > 0) {
      const bestMatch = similar[0];
      if (bestMatch.similarity >= 0.90 && bestMatch.context === context) {
        res.setHeader('X-AI-Source', 'cache-semantic');
        return res.status(200).json({ answer: bestMatch.answer, cached: true, semanticCached: true });
      }
      const ragBlock = similar
        .map(d => `Câu hỏi tương tự: "${d.question}"\nCâu trả lời: ${d.answer}`)
        .join('\n---\n');
      fullContext += `\n\n[Tham khảo từ cơ sở dữ liệu]\n${ragBlock}`;
    }
  }

  // ---- Build Ollama messages ----
  const ollamaMessages = [{ role: 'system', content: systemPrompt }];

  if (!isFollowUp) {
    ollamaMessages.push({
      role: 'user',
      content: buildFirstUserContent(question, context, type, fullContext, false, memory),
    });
  } else {
    // For follow-ups: strip previous AI answers to prevent small-model pattern-copying.
    // Pass original context once, then a short synthetic acknowledgement, then the NEW question.
    const originalQ = history[0]?.content || question;
    ollamaMessages.push({
      role: 'user',
      content: buildFirstUserContent(originalQ, context, type, fullContext, true),
    });

    // Collect previous user questions (even indices) to summarise what was already discussed
    const prevTopics = history
      .filter((_, i) => i % 2 === 0)
      .map(h => h.content)
      .filter(Boolean);
    ollamaMessages.push({
      role: 'assistant',
      content: `Đã luận giải về: ${prevTopics.join(' / ')}. Sẵn sàng trả lời câu hỏi tiếp theo.`,
    });

    const finalInstruction = type === 'tarot'
      ? `CÂU HỎI MỚI: "${question}"\n\n(Trả lời 3-5 câu, phân tích góc nhìn MỚI từ các lá bài. Không lặp câu trả lời trước.)`
      : (type === 'tuvi'
          ? `CÂU HỎI MỚI: "${question}"\n\n(Trả lời 3-5 câu ngắn gọn, trực diện liên quan đến lá số Tử Vi và các sao của bạn. Không lặp lại định dạng cũ.)`
          : (type === 'thansohoc'
              ? `CÂU HỎI MỚI: "${question}"\n\n(Trả lời 3-5 câu ngắn gọn, phân tích các con số và biểu đồ ngày sinh Thần Số Học của bạn dưới góc nhìn mới.)`
              : `CÂU HỎI MỚI: "${question}"\n\nTrả lời theo đúng format:\n**Nhận định:** [...]\n**Trả lời:** [...]\n- **Nên làm:** [...]\n- **Cần tránh:** [...]`));
    ollamaMessages.push({ role: 'user', content: finalInstruction });
  }

  // ---- Call Ollama first, fall back to DeepSeek on any failure ----
  const temperature = isFollowUp ? 0.4 : 0.2;
  const maxTokens   = isFollowUp ? 500 : (type === 'tuvi' || type === 'thansohoc' ? 1400 : 1000);
  let answer = '';
  let source = 'ollama';
  let ollamaErr = breaker.localDown ? 'local backend down (circuit breaker)' : null;

  // SSE opens lazily on the first emitted token. Node merges headers set earlier
  // via setHeader (CORS, X-RateLimit-Backend) into this writeHead.
  let sseOpen = false;
  const emit = (tok) => {
    if (!tok || !wantsSSE) return;
    if (!sseOpen) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-AI-Source': 'ollama',
      });
      res.flushHeaders?.();
      sseOpen = true;
    }
    res.write(`data: ${JSON.stringify({ token: tok })}\n\n`);
  };

  // Skip the chat attempt outright if an earlier local call already proved the box
  // is unreachable — no point waiting out another 20s timeout.
  if (ollamaUrl && !breaker.localDown) {
    // Abort the Ollama generation if the client disconnects mid-stream, freeing the
    // slot. Must watch res (not req: its 'close' fires once the body is consumed),
    // and only treat it as a disconnect when we never finished writing.
    const clientGone = new AbortController();
    res.on('close', () => { if (sseOpen && !res.writableEnded) clientGone.abort(); });

    const holdback = createThinkHoldback();
    const r = await streamOllama({
      ollamaUrl,
      model,
      messages: ollamaMessages,
      temperature,
      maxTokens,
      firstTokenTimeoutMs: ollamaTimeoutMs,
      stallTimeoutMs: parseInt(process.env.OLLAMA_STALL_MS || '', 10) || 15000,
      onToken: (raw) => emit(stripCJKChars(holdback(raw))),
      signal: clientGone.signal,
    });
    if (r.ok) {
      answer = r.content;
    } else {
      ollamaErr = r.error;
      if (r.infraDown) breaker.localDown = true;
      if (sseOpen) {
        // Tokens were already shown — headers are sent, so no JSON fallback is
        // possible and a mid-stream DeepSeek swap would jarringly replace visible
        // text. Tell the client to offer a retry instead.
        console.error(`[interpret] Ollama died mid-stream: ${r.error}`);
        res.write(`data: ${JSON.stringify({ error: 'AI bị gián đoạn giữa chừng. Vui lòng thử lại.', retryable: true })}\n\n`);
        return res.end();
      }
    }
  }

  // Invariant: reaching here with !answer implies sseOpen === false (a mid-stream
  // death already returned above), so plain res.status(...).json(...) stays legal.
  if (!answer && dsKey) {
    // Cap tổng lượt fallback cloud/ngày — Ollama chết cả ngày cũng không đốt hết quota.
    const budget = await checkDailyBudget('cloudllm');
    if (!budget.allowed) {
      console.error(`[interpret] Cloud budget exhausted (${budget.count}/${budget.cap}) — Ollama: ${ollamaErr || 'n/a'}`);
      return res.status(503).json({ error: 'AI đang quá tải. Vui lòng thử lại sau ít phút.' });
    }
    source = 'deepseek';
    console.warn(`[interpret] Ollama unavailable (${ollamaErr || 'n/a'}) — falling back to DeepSeek (${dsModel})`);
    const dsRes = await callCloudLLM({ url: dsUrl, apiKey: dsKey, model: dsModel, messages: ollamaMessages, temperature, maxTokens, timeoutMs: dsTimeoutMs, label: 'DeepSeek' });
    if (!dsRes.ok) {
      // Detailed cause (ngrok URLs, model names, timeouts) stays in server logs only.
      console.error(`[interpret] AI failed — Ollama: ${ollamaErr || 'n/a'}; DeepSeek: ${dsRes.error}`);
      return res.status(502).json({ error: 'AI đang quá tải hoặc mất kết nối. Vui lòng thử lại sau ít phút.' });
    }
    answer = dsRes.content;
  }

  if (!answer) {
    console.error(`[interpret] No answer — Ollama: ${ollamaErr || 'không có nội dung trả về'}; DeepSeek configured: ${!!dsKey}`);
    return res.status(502).json({ error: 'AI đang quá tải hoặc mất kết nối. Vui lòng thử lại sau ít phút.' });
  }

  // Strip <think>...</think> blocks that qwen3 emits even when think:false is set
  answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  answer = cleanChineseLeaks(answer);

  // Deduplicate: small models sometimes repeat the entire structured response.
  // If the first markdown section header (### ...) appears a second time, truncate there.
  // Flag /u bắt trọn code point: thiếu nó \S chỉ khớp NỬA surrogate pair của emoji —
  // 🏮 và 🌟 chung high-surrogate \uD83C nên header xinxam bị coi là "lặp" và cắt cụt.
  const firstHeaderMatch = answer.match(/###\s+\S/u);
  if (firstHeaderMatch) {
    const h   = firstHeaderMatch[0];
    const pos = answer.indexOf(h);
    const dup = answer.indexOf(h, pos + h.length);
    if (dup > pos) answer = answer.slice(0, dup).trim();
  }

  // ---- Store Q&A for the cache. Only for cache-eligible types (non-tuvi, non
  // follow-up) so tuvi's now-computed embedding doesn't write useless cache rows.
  // Stored as source='qa' (DB default). Fire-and-forget. ----
  if (cacheEligible && embedding && !breaker.localDown) {
    storeDoc(sbUrl, sbKey, { type, question, context, answer, embedding, is_followup: isFollowUp }, breaker);
  }

  if (sseOpen) {
    // Client re-renders the bubble from this canonical post-processed answer,
    // healing any artifacts (CJK lines, duplicate sections) shown mid-stream.
    if (!answer) {
      res.write(`data: ${JSON.stringify({ error: 'AI trả về nội dung rỗng. Vui lòng thử lại.', retryable: true })}\n\n`);
      return res.end();
    }
    res.write(`data: ${JSON.stringify({ done: true, answer, source })}\n\n`);
    return res.end();
  }

  res.setHeader('X-AI-Source', source);

  return res.status(200).json({ answer, source });
}

