/**
 * js/ai.js — AI helper
 * Sends question + context + conversation history to /api/interpret.
 * onDone(fullAnswer) receives the complete text so callers can store history.
 */

const AI_ENDPOINT = '/api/interpret';

async function askAI({ question, context, type, history = [], onToken, onDone, onError }) {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, type, history }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      onError(data.error || `Lỗi ${res.status}`);
      return;
    }

    // Simulate streaming word-by-word for UX
    const words = data.answer.split(' ');
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
    onError('Không kết nối được AI: ' + err.message);
  }
}
