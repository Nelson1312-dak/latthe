/**
 * js/ai.js — AI interpretation helper
 * Calls /api/interpret and returns the answer.
 */

const AI_ENDPOINT = '/api/interpret';

async function askAI({ question, context, type, onToken, onDone, onError }) {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, type }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      onError(data.error || `Lỗi ${res.status}`);
      return;
    }

    // Simulate streaming by revealing text word by word for nicer UX
    const words = data.answer.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      if (i < words.length) {
        onToken((i === 0 ? '' : ' ') + words[i]);
        i++;
      } else {
        clearInterval(interval);
        onDone();
      }
    }, 30);

  } catch (err) {
    onError('Không kết nối được AI: ' + err.message);
  }
}
