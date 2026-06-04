/**
 * api/interpret.js — Vercel Serverless Function
 * - Conversation history: passes prior turns to Ollama for multi-turn memory
 * - RAG: embeds question → retrieves similar past Q&As → augments context
 *   Requires: SUPABASE_URL, SUPABASE_ANON_KEY (optional — degrades gracefully)
 *   Requires: OLLAMA_EMBED_MODEL pulled in Ollama (default: nomic-embed-text)
 */

import { applyCors } from './_cors.js';
import { getClientIp, checkRateLimit } from './_rateLimit.js';
import { isInfraDown, callCloudLLM, cleanChineseLeaks } from './_llm.js';
import { getEmbedding, retrieveSimilar, storeDoc, checkExactMatchCache } from './_rag.js';
import { SYSTEM_PROMPTS, buildFirstUserContent } from './_prompts.js';

// Prevent uncaught exceptions / unhandled rejections from crashing the dev server
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ---- Main handler ----

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

  const { question, context, type, history = [] } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

  const isFollowUp = history.length > 0;

  // Circuit breaker: the DB (PostgREST) and Ollama share one ngrok tunnel, so when
  // the local box is down they ALL fail. The first local call that hits a network
  // error / timeout flips this flag; every later local call then short-circuits
  // instantly instead of waiting out its own timeout — that prevents the stacked
  // ~47s wait that previously blew past the client's timeout before DeepSeek could run.
  const breaker = { localDown: false };

  // Tử Vi charts are unique per person, so cache lookups almost never hit and just
  // burn a local round-trip — skip caching/RAG for tuvi entirely.
  const cacheEligible = type !== 'tuvi' && !isFollowUp;
  // Embedding is only used for semantic cache, RAG retrieval and storeDoc. None of
  // those apply to tuvi or follow-ups, so don't spend a round-trip computing it.
  const needEmbedding = type !== 'tuvi' && !isFollowUp;

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
    const similar = await retrieveSimilar(sbUrl, sbKey, embedding, type, breaker);

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
      content: buildFirstUserContent(question, context, type, fullContext, false),
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

  // Skip the chat attempt outright if an earlier local call already proved the box
  // is unreachable — no point waiting out another 20s timeout.
  if (ollamaUrl && !breaker.localDown) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);

      const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: false,
          think: false,
          options: { temperature, num_predict: maxTokens },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!ollamaRes.ok) {
        ollamaErr = `Ollama ${ollamaRes.status}`;
      } else {
        const data = await ollamaRes.json();
        answer = data.message?.content || data.response || '';
      }
    } catch (err) {
      ollamaErr = err.name === 'AbortError' ? `Ollama timeout (>${Math.round(ollamaTimeoutMs / 1000)}s)` : err.message;
      if (isInfraDown(err)) breaker.localDown = true;
    }
  }

  if (!answer && dsKey) {
    source = 'deepseek';
    console.warn(`[interpret] Ollama unavailable (${ollamaErr || 'n/a'}) — falling back to DeepSeek (${dsModel})`);
    const dsRes = await callCloudLLM({ url: dsUrl, apiKey: dsKey, model: dsModel, messages: ollamaMessages, temperature, maxTokens, timeoutMs: dsTimeoutMs, label: 'DeepSeek' });
    if (!dsRes.ok) {
      console.error(`[interpret] DeepSeek fallback failed: ${dsRes.error}`);
      return res.status(502).json({ error: `AI không phản hồi (Ollama: ${ollamaErr || 'n/a'}; DeepSeek: ${dsRes.error})` });
    }
    answer = dsRes.content;
  }

  if (!answer) {
    if (!dsKey) {
      console.error('[interpret] Ollama produced no answer and DEEPSEEK_API_KEY is not set — no fallback available.');
    }
    return res.status(502).json({ error: `AI không phản hồi: ${ollamaErr || 'không có nội dung trả về'}` });
  }

  // Strip <think>...</think> blocks that qwen3 emits even when think:false is set
  answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  answer = cleanChineseLeaks(answer);

  // Deduplicate: small models sometimes repeat the entire structured response.
  // If the first markdown section header (### ...) appears a second time, truncate there.
  const firstHeaderMatch = answer.match(/###\s+\S/);
  if (firstHeaderMatch) {
    const h   = firstHeaderMatch[0];
    const pos = answer.indexOf(h);
    const dup = answer.indexOf(h, pos + h.length);
    if (dup > pos) answer = answer.slice(0, dup).trim();
  }

  // ---- Store Q&A for cache/RAG. Only meaningful when we have an embedding (so tuvi
  // and follow-ups are naturally skipped) and the DB is reachable. Fire-and-forget. ----
  if (embedding && !breaker.localDown) {
    storeDoc(sbUrl, sbKey, { type, question, context, answer, embedding, is_followup: isFollowUp });
  }

  res.setHeader('X-AI-Source', source);

  return res.status(200).json({ answer, source });
}

