/**
 * api/interpret.js — Vercel Serverless Function
 * - Conversation history: passes prior turns to Ollama for multi-turn memory
 * - RAG: embeds question → retrieves similar past Q&As → augments context
 *   Requires: SUPABASE_URL, SUPABASE_ANON_KEY (optional — degrades gracefully)
 *   Requires: OLLAMA_EMBED_MODEL pulled in Ollama (default: nomic-embed-text)
 */

// ---- RAG helpers ----

async function getEmbedding(ollamaUrl, embedModel, text) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: embedModel, prompt: text }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding || null;
  } catch {
    return null;
  }
}

async function retrieveSimilar(sbUrl, sbKey, embedding, type) {
  if (!embedding || !sbUrl || !sbKey) return [];
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${sbUrl}/rest/v1/rpc/match_documents`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: 0.78,
        match_count: 2,
        filter_type: type,
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function storeDoc(sbUrl, sbKey, payload) {
  if (!sbUrl || !sbKey || !payload.embedding) return;
  fetch(`${sbUrl}/rest/v1/documents`, {
    method: 'POST',
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// ---- Main handler ----

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ollamaUrl  = (process.env.OLLAMA_BASE_URL  || '').trim();
  const model      = (process.env.OLLAMA_MODEL      || '').trim() || 'qwen2.5:7b';
  const embedModel = (process.env.OLLAMA_EMBED_MODEL|| '').trim() || 'nomic-embed-text';
  const sbUrl      = (process.env.SUPABASE_URL      || '').trim();
  const sbKey      = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!ollamaUrl) {
    return res.status(503).json({ error: 'AI chưa được cấu hình (thiếu OLLAMA_BASE_URL)' });
  }

  const { question, context, type, history = [] } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

  // ---- System prompt ----
  const langRule = 'CRITICAL RULE: You MUST respond ONLY in Vietnamese (Tiếng Việt). Absolutely do NOT use Chinese, English, or any other language. Every single word of your response must be Vietnamese.';

  const systemPrompt = type === 'tarot'
    ? `${langRule}\n\nBạn là chuyên gia Tarot với kiến thức sâu sắc về 22 lá Đại Bí Ẩn. Hãy trả lời súc tích (4-6 câu), thực tế và đầy cảm hứng. Trả lời trực tiếp vào câu hỏi dựa trên lá bài, không giải thích lý thuyết dài dòng.`
    : `${langRule}\n\nBạn là học giả Kinh Dịch với am hiểu sâu về 64 quẻ. Hãy trả lời súc tích (4-6 câu), kết hợp triết lý cổ xưa với thực tiễn hiện đại. Trả lời trực tiếp vào câu hỏi dựa trên quẻ bốc được, không giải thích lý thuyết.`;

  // ---- RAG: embed + retrieve (parallel where possible) ----
  const embedding = await getEmbedding(ollamaUrl, embedModel, question);
  const similar   = await retrieveSimilar(sbUrl, sbKey, embedding, type);

  // Augment context with retrieved Q&As
  let fullContext = context || '';
  if (similar.length > 0) {
    const ragBlock = similar
      .map(d => `Câu hỏi tương tự: "${d.question}"\nCâu trả lời: ${d.answer}`)
      .join('\n---\n');
    fullContext += `\n\n[Tham khảo từ cơ sở dữ liệu]\n${ragBlock}`;
  }

  // ---- Build Ollama messages with conversation history ----
  const typeLabel = type === 'tarot' ? 'bài Tarot' : 'quẻ Kinh Dịch';
  const contextPrefix = `Thông tin ${typeLabel}:\n${fullContext}\n\n`;

  const ollamaMessages = [{ role: 'system', content: systemPrompt }];

  if (history.length === 0) {
    // First turn: include full context
    ollamaMessages.push({
      role: 'user',
      content: `${contextPrefix}Câu hỏi: "${question}"\n\nHãy luận giải và trả lời thẳng vào câu hỏi. (Chỉ dùng tiếng Việt)`,
    });
  } else {
    // Follow-up: reconstruct first message with context, keep history, add new question
    ollamaMessages.push({
      role: 'user',
      content: `${contextPrefix}Câu hỏi: "${history[0].content}"\n\nHãy luận giải và trả lời thẳng vào câu hỏi. (Chỉ dùng tiếng Việt)`,
    });
    for (let i = 1; i < history.length; i++) {
      ollamaMessages.push(history[i]);
    }
    ollamaMessages.push({ role: 'user', content: `${question} (Chỉ dùng tiếng Việt)` });
  }

  // ---- Call Ollama ----
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        options: { temperature: 0.75, num_predict: 350 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      return res.status(502).json({ error: `Ollama lỗi ${ollamaRes.status}: ${errText.slice(0, 200)}` });
    }

    const data   = await ollamaRes.json();
    const answer = data.message?.content || data.response || '';

    // ---- RAG: store new Q&A (fire & forget) ----
    storeDoc(sbUrl, sbKey, { type, question, context, answer, embedding });

    return res.status(200).json({ answer });

  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Ollama timeout (>55s)' : err.message;
    return res.status(502).json({ error: `Không kết nối được Ollama: ${msg}` });
  }
}
