/**
 * api/interpret.js — Vercel Serverless Function (Node.js)
 * Proxies question + context to Ollama (Qwen) and returns AI interpretation.
 *
 * Env vars (set in Vercel dashboard):
 *   OLLAMA_BASE_URL  — e.g. https://xxxx.trycloudflare.com
 *   OLLAMA_MODEL     — e.g. qwen2.5:7b
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ollamaUrl = (process.env.OLLAMA_BASE_URL || '').trim();
  const model     = (process.env.OLLAMA_MODEL || '').trim() || 'qwen2.5:7b';

  if (!ollamaUrl) {
    return res.status(503).json({ error: 'AI chưa được cấu hình (thiếu OLLAMA_BASE_URL)' });
  }

  const { question, context, type } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

  const langRule = 'CRITICAL RULE: You MUST respond ONLY in Vietnamese (Tiếng Việt). Absolutely do NOT use Chinese, English, or any other language. Every single word of your response must be Vietnamese.';

  const systemPrompt = type === 'tarot'
    ? `${langRule}\n\nBạn là chuyên gia Tarot với kiến thức sâu sắc về 22 lá Đại Bí Ẩn. Hãy trả lời súc tích (4-6 câu), thực tế và đầy cảm hứng. Trả lời trực tiếp vào câu hỏi dựa trên lá bài, không giải thích lý thuyết dài dòng.`
    : `${langRule}\n\nBạn là học giả Kinh Dịch với am hiểu sâu về 64 quẻ. Hãy trả lời súc tích (4-6 câu), kết hợp triết lý cổ xưa với thực tiễn hiện đại. Trả lời trực tiếp vào câu hỏi dựa trên quẻ bốc được, không giải thích lý thuyết.`;

  const userPrompt = `Câu hỏi: "${question}"\n\nThông tin ${type === 'tarot' ? 'bài Tarot' : 'quẻ Kinh Dịch'} vừa bốc được:\n${context}\n\nHãy luận giải và trả lời thẳng vào câu hỏi của tôi. (Nhớ: chỉ dùng tiếng Việt)`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        stream: false,
        options: { temperature: 0.75, num_predict: 350 }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      return res.status(502).json({ error: `Ollama lỗi ${ollamaRes.status}: ${errText.slice(0, 200)}` });
    }

    const data = await ollamaRes.json();
    const answer = data.message?.content || data.response || '';

    return res.status(200).json({ answer });

  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Ollama timeout (>55s)' : err.message;
    return res.status(502).json({ error: `Không kết nối được Ollama: ${msg}` });
  }
}
