/**
 * api/_llm.js — Cloud LLM fallback + infra-down detection + language post-filter.
 * Underscore prefix => Vercel does NOT expose this as a route; import only.
 */

// ---- Infra-down detector ----
// Distinguishes "the local box / ngrok tunnel is unreachable" (network error or
// timeout) from "the server answered with an error status" (still up). Only the
// former should trip the circuit breaker that skips remaining local calls.
export function isInfraDown(err) {
  if (!err) return false;
  if (err.name === 'AbortError' || err.name === 'TypeError') return true;
  return /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(err.message || '');
}


// ---- Cloud LLM fallback (OpenAI-compatible; used when local Ollama is down) ----
// Works for any OpenAI-style /chat/completions endpoint (DeepSeek, Groq, etc.).

export async function callCloudLLM({ url, apiKey, model, messages, temperature, maxTokens, timeoutMs = 25000, label = 'Cloud' }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `${label} ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { ok: true, content };
  } catch (err) {
    clearTimeout(t);
    return { ok: false, error: err.name === 'AbortError' ? `${label} timeout (>${Math.round(timeoutMs / 1000)}s)` : err.message };
  }
}


// ---- Streaming Ollama call ----
// Reads the NDJSON stream from Ollama /api/chat (stream:true) and invokes onToken
// with each RAW content delta. The caller accumulates nothing here beyond `full`,
// which is returned so the existing full-answer post-processing pipeline
// (think-strip, cleanChineseLeaks, dedup) runs unchanged on the complete text.
// Two-phase timeout: firstTokenTimeoutMs until the first byte arrives, then
// stallTimeoutMs between chunks — a single total timeout would abort a healthy
// long generation mid-stream.
// infraDown is only reported when ZERO bytes arrived: a stall after tokens flowed
// means generation trouble, not tunnel-down, and must not trip the circuit breaker.
export async function streamOllama({ ollamaUrl, model, messages, temperature, maxTokens,
                                     firstTokenTimeoutMs = 20000, stallTimeoutMs = 15000, onToken, signal }) {
  const controller = new AbortController();
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  let timer = setTimeout(() => controller.abort(), firstTokenTimeoutMs);
  const resetStall = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), stallTimeoutMs); };
  let full = '';
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        think: false,
        options: { temperature, num_predict: maxTokens },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `Ollama ${res.status}`, gotTokens: false };

    const reader = res.body.getReader();
    // stream:true keeps multibyte UTF-8 sequences (Vietnamese!) intact across chunk splits
    const dec = new TextDecoder();
    let pending = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      resetStall();
      pending += dec.decode(value, { stream: true });
      let nl;
      while ((nl = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, nl).trim();
        pending = pending.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { console.warn('[streamOllama] unparseable line:', line.slice(0, 120)); continue; }
        if (obj.error) throw new Error(`Ollama: ${obj.error}`);
        const t = obj.message?.content || '';
        if (t) { full += t; onToken(t); }
        if (obj.done) return { ok: true, content: full };
      }
    }
    return full ? { ok: true, content: full } : { ok: false, error: 'empty stream', gotTokens: false };
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    return {
      ok: false,
      gotTokens: full.length > 0,
      error: timedOut
        ? (full ? `Ollama stalled (>${Math.round(stallTimeoutMs / 1000)}s between chunks)` : `Ollama timeout (>${Math.round(firstTokenTimeoutMs / 1000)}s)`)
        : err.message,
      infraDown: !full && isInfraDown(err),
    };
  } finally {
    clearTimeout(timer);
  }
}


// ---- Streaming display filters ----

// Char-level CJK strip for tokens shown mid-stream. The line-based cleanChineseLeaks
// below still runs on the final complete answer (the canonical version sent in the
// SSE `done` event), so anything this lets through self-heals on the final render.
export function stripCJKChars(s) {
  return s.replace(/[一-龥]/g, '');
}

// Stateful holdback filter that swallows one leading <think>...</think> block.
// qwen3 sometimes emits it despite think:false. Tolerates the tags being split
// across chunk boundaries: while detecting, ambiguous prefixes of '<think>' are
// held back; while inside, only the last 7 chars are kept in case '</think>'
// straddles two chunks.
export function createThinkHoldback() {
  let mode = 'detect'; // 'detect' -> 'inside' -> 'pass'
  let buf = '';
  return function filter(chunk) {
    if (mode === 'pass') return chunk;
    buf += chunk;
    if (mode === 'detect') {
      const lead = buf.replace(/^\s+/, '');
      if (!lead) return '';
      if (lead.length < 7 && '<think>'.startsWith(lead)) return '';
      if (lead.startsWith('<think>')) {
        mode = 'inside';
        buf = lead.slice(7);
      } else {
        mode = 'pass';
        const out = buf;
        buf = '';
        return out;
      }
    }
    if (mode === 'inside') {
      const end = buf.indexOf('</think>');
      if (end === -1) { buf = buf.slice(-7); return ''; }
      mode = 'pass';
      const out = buf.slice(end + 8).replace(/^\s+/, '');
      buf = '';
      return out;
    }
    return '';
  };
}


// ---- Language filter helper ----

export function cleanChineseLeaks(text) {
  if (!text) return '';
  
  // If no Chinese characters are present, return as is
  if (!/[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }

  // Split into lines
  const lines = text.split('\n');
  
  // Filter out any lines that contain Chinese characters
  const cleanLines = lines.filter(line => !/[\u4e00-\u9fa5]/.test(line));
  const cleanedText = cleanLines.join('\n').trim();

  // If the resulting text is long enough, return it
  if (cleanedText.length > 30) {
    return cleanedText;
  }

  // Otherwise, fallback to stripping Chinese characters individually
  return text
    .replace(/[\u4e00-\u9fa5]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

