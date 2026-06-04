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

