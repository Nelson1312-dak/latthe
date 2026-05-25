/**
 * js/ai.js — Shared AI streaming helper
 * Calls /api/interpret and streams SSE tokens into a DOM element.
 */

const AI_ENDPOINT = '/api/interpret';

/**
 * askAI({ question, context, type, onToken, onDone, onError })
 * type: 'tarot' | 'gieoque'
 */
async function askAI({ question, context, type, onToken, onDone, onError }) {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, type }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      onError(err.error || 'Lỗi kết nối AI');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { onDone(); return; }
        try {
          const data = JSON.parse(payload);
          if (data.error)  { onError(data.error); return; }
          if (data.token)  { onToken(data.token); }
        } catch { /* skip */ }
      }
    }
    onDone();
  } catch (err) {
    onError('Không kết nối được AI: ' + err.message);
  }
}
