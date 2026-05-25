/**
 * api/interpret.js — Vercel Edge Function
 * Proxies question + card/hexagram context to local Ollama (Qwen)
 * and streams the response back as Server-Sent Events.
 *
 * Env vars (set in Vercel dashboard):
 *   OLLAMA_BASE_URL  — e.g. https://xxxx.ngrok-free.app  (your exposed Ollama)
 *   OLLAMA_MODEL     — e.g. qwen2.5  (default: qwen2.5)
 */

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const ollamaUrl  = process.env.OLLAMA_BASE_URL;
  const model      = process.env.OLLAMA_MODEL || 'qwen2.5';

  if (!ollamaUrl) {
    return new Response(
      JSON.stringify({ error: 'AI chưa được cấu hình (thiếu OLLAMA_BASE_URL)' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  const { question, context, type } = body;

  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: 'Thiếu câu hỏi' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  const systemPrompt = type === 'tarot'
    ? `Bạn là chuyên gia Tarot với kiến thức sâu sắc về 22 lá Đại Bí Ẩn.
Hãy trả lời bằng tiếng Việt, súc tích (4-6 câu), thực tế, đầy cảm hứng.
Trả lời trực tiếp vào câu hỏi dựa trên lá bài, không giải thích lý thuyết dài dòng.`
    : `Bạn là học giả Kinh Dịch với am hiểu sâu về 64 quẻ và triết học phương Đông.
Hãy trả lời bằng tiếng Việt, súc tích (4-6 câu), kết hợp triết lý cổ xưa với thực tiễn hiện đại.
Trả lời trực tiếp vào câu hỏi dựa trên quẻ bốc được, không giải thích lý thuyết dài dòng.`;

  const userPrompt = `Câu hỏi của tôi: "${question}"\n\nThông tin ${type === 'tarot' ? 'bài Tarot' : 'quẻ Kinh Dịch'} vừa bốc được:\n${context}\n\nHãy luận giải và trả lời thẳng vào câu hỏi của tôi.`;

  try {
    const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        stream: true,
        options: { temperature: 0.7, num_predict: 300 }
      }),
    });

    if (!ollamaRes.ok) {
      const err = await ollamaRes.text();
      return new Response(JSON.stringify({ error: `Ollama lỗi: ${err}` }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Transform Ollama NDJSON stream → SSE stream
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const chunk = JSON.parse(line);
              if (chunk.message?.content) {
                const token = chunk.message.content;
                await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
              }
              if (chunk.done) {
                await writer.write(encoder.encode('data: [DONE]\n\n'));
              }
            } catch { /* skip malformed line */ }
          }
        }
      } catch (e) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Không kết nối được Ollama: ${err.message}` }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}
