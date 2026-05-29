/**
 * js/ai.js — AI helper
 * Sends question + context + conversation history to /api/interpret.
 * onDone(fullAnswer) receives the complete text so callers can store history.
 * onError({ message, retryable, code }) receives a categorised error so callers
 *   can decide whether to show a "Thử lại" button.
 */

const AI_ENDPOINT = '/api/interpret';
// Headroom for the worst-case server path: slow Ollama hitting its timeout, then
// the Groq fallback running to completion. Must stay above the server's combined budget.
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

async function askAI({ question, context, type, history = [], onToken, onDone, onError }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, type, history }),
      signal: controller.signal,
    });
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
