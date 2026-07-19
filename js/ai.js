/**
 * js/ai.js — AI helper
 * Sends question + context + conversation history to /api/interpret.
 * onDone(fullAnswer) receives the complete text so callers can store history.
 * onError({ message, retryable, code }) receives a categorised error so callers
 *   can decide whether to show a "Thử lại" button.
 */

const AI_ENDPOINT = '/api/interpret';
// Headroom for the worst-case server path: slow Ollama hitting its timeout, then
// the DeepSeek fallback running to completion. Must stay above the server's combined budget.
const AI_TIMEOUT_MS = 70_000;

function categoriseError(status, serverMsg) {
  if (status === 429) {
    return { code: 'rate_limit', message: serverMsg || 'Bạn đang hỏi hơi nhanh 🙏 Vui lòng đợi một lát.', retryable: true };
  }
  if (status === 403) {
    return { code: 'forbidden', message: 'Truy cập bị từ chối.', retryable: false };
  }
  if (status === 503) {
    return { code: 'unavailable', message: 'AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút.', retryable: true };
  }
  if (status === 502 || status === 504) {
    return { code: 'upstream', message: 'AI đang quá tải hoặc mất kết nối. Vui lòng thử lại.', retryable: true };
  }
  if (status >= 500) {
    return { code: 'server', message: 'Máy chủ gặp sự cố. Vui lòng thử lại sau.', retryable: true };
  }
  if (status >= 400) {
    return { code: 'client', message: serverMsg || 'Yêu cầu không hợp lệ.', retryable: false };
  }
  return { code: 'unknown', message: serverMsg || 'Đã có lỗi xảy ra.', retryable: true };
}

async function askAI({ question, context, type, history = [], memory = '', onToken, onDone, onError }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      // Accept opts in to server-side streaming; the server only streams when the
      // local model actually generates — cache hits, fallback and errors stay JSON,
      // so both branches below must exist.
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream, application/json' },
      body: JSON.stringify({ question, context, type, history, memory }),
      signal: controller.signal,
    });

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && ct.includes('text/event-stream')) {
      // ---- Real streaming (SSE). The 70s abort timer stays live for the whole
      // read; an abort makes reader.read() throw AbortError → outer catch. ----
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let built = '';
      let pending = '';
      let flushTimer = null;
      // Micro-batch tokens (~80ms) so chat.js re-renders ~12x/s instead of per token.
      const flush = () => {
        flushTimer = null;
        if (!pending) return;
        const p = pending;
        pending = '';
        built += p;
        onToken(p);
      };
      const finish = () => {
        clearTimeout(timer);
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const rawEvent = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          for (const line of rawEvent.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            let evt;
            try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (evt.token) {
              pending += evt.token;
              if (!flushTimer) flushTimer = setTimeout(flush, 80);
            } else if (evt.error) {
              finish();
              onError({ code: 'stream', message: evt.error, retryable: evt.retryable !== false });
              return;
            } else if (evt.done) {
              finish();
              flush();
              // The server's answer is canonical (fully post-processed) — it heals
              // any artifacts the raw token stream displayed.
              onDone((evt.answer || built).trim());
              return;
            }
          }
        }
      }
      // Stream closed without a done/error event
      finish();
      onError({ code: 'stream', message: 'Kết nối bị gián đoạn. Vui lòng thử lại.', retryable: true });
      return;
    }

    // ---- Legacy JSON path: cache hits, DeepSeek fallback, old server, errors ----
    clearTimeout(timer);

    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok || data.error) {
      onError(categoriseError(res.status, data.error));
      return;
    }

    // Simulate streaming word-by-word for UX
    const words = (data.answer || '').split(' ');
    let built = '';
    let i = 0;
    const interval = setInterval(() => {
      if (i < words.length) {
        const token = (i === 0 ? '' : ' ') + words[i];
        onToken(token);
        built += token;
        i++;
      } else {
        clearInterval(interval);
        onDone(built.trim());
      }
    }, 30);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      onError({ code: 'timeout', message: 'AI phản hồi quá lâu. Vui lòng thử lại.', retryable: true });
    } else {
      onError({ code: 'network', message: 'Mất kết nối mạng. Kiểm tra wifi rồi thử lại.', retryable: true });
    }
  }
}
