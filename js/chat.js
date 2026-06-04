/**
 * js/chat.js — Shared AI chat UI controller
 * Provides parseMarkdown() and createChat() used by all AI modules.
 * Must be loaded after js/ai.js (depends on askAI global).
 */

const Chat = (() => {
  function parseMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
    const out = [];
    let inList = false;

    for (const line of lines) {
      let t = line.trim().replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      if (t.startsWith('###')) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h3 class="chat-heading">${t.slice(3).trim()}</h3>`);
      } else if (t.startsWith('##')) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h2 class="chat-heading">${t.slice(2).trim()}</h2>`);
      } else if (t.startsWith('#')) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h1 class="chat-heading">${t.slice(1).trim()}</h1>`);
      } else if (t === '---') {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<hr class="chat-hr">');
      } else if (t.startsWith('- ') || t.startsWith('• ')) {
        if (!inList) { out.push('<ul class="chat-list">'); inList = true; }
        out.push(`<li>${t.slice(2).trim()}</li>`);
      } else if (t === '') {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<div class="chat-break"></div>');
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p class="chat-p">${t}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  }

  function createChat({ messagesEl, loadingEl, inputEl, btnEl }) {
    function appendBubble(role, text) {
      const div = document.createElement('div');
      div.className = `chat-bubble chat-${role}`;
      if (role === 'ai') {
        div.innerHTML = text
          ? parseMarkdown(text)
          : '<div class="chat-typing"><span></span><span></span><span></span></div>';
      } else {
        div.textContent = text || '';
      }
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function sendWithUI({ question, context, type, history = [], onDone }) {
      const q = question.trim();
      if (!q) return;

      const userBubble = appendBubble('user', q);
      const aiBubble   = appendBubble('ai', '');  // shows typing dots

      if (loadingEl) loadingEl.classList.add('hidden');
      if (inputEl) inputEl.disabled = true;
      if (btnEl)   btnEl.disabled   = true;

      let built = '';

      askAI({
        question: q,
        context,
        type,
        history,
        onToken(token) {
          loadingEl.classList.add('hidden');
          built += token;
          aiBubble.innerHTML = parseMarkdown(built);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        },
        onDone(fullAnswer) {
          loadingEl.classList.add('hidden');
          aiBubble.innerHTML = parseMarkdown(fullAnswer);
          if (inputEl) inputEl.disabled = false;
          if (btnEl)   btnEl.disabled   = false;
          if (onDone)  onDone(fullAnswer);
        },
        onError(err) {
          loadingEl.classList.add('hidden');
          aiBubble.innerHTML = '';
          aiBubble.classList.add('chat-error');

          const msg = document.createElement('div');
          msg.textContent = '⚠️ ' + err.message;
          aiBubble.appendChild(msg);

          if (err.retryable) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn-retry';
            retryBtn.textContent = 'Thử lại';
            retryBtn.onclick = () => {
              aiBubble.remove();
              userBubble.remove();
              sendWithUI({ question: q, context, type, history, onDone });
            };
            aiBubble.appendChild(retryBtn);
          }

          if (inputEl) inputEl.disabled = false;
          if (btnEl)   btnEl.disabled   = false;
        },
      });
    }

    return { sendWithUI, appendBubble };
  }

  return { parseMarkdown, createChat };
})();
