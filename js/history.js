/**
 * js/history.js — LocalStorage reading history (shared by gieoque + tarot)
 *
 * Public API:
 *   History.save(type, item)  — type: 'gieoque' | 'tarot'; item: arbitrary object with .question
 *   History.list(type)        — returns array (newest first), max 10
 *   History.clear(type)
 *   History.openModal({ type, title, formatItem })
 *     - formatItem(item) => DOM node or string (HTML); used to render each entry
 */

(function () {
  const MAX_ENTRIES = 10;
  const KEY = (type) => `latthe:history:${type}`;

  function load(type) {
    try {
      const raw = localStorage.getItem(KEY(type));
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save(type, item) {
    if (!item || !item.question) return;
    const list = load(type);
    const entry = { ...item, ts: Date.now() };
    list.unshift(entry);
    const trimmed = list.slice(0, MAX_ENTRIES);
    try {
      localStorage.setItem(KEY(type), JSON.stringify(trimmed));
    } catch {
      // Storage full or disabled — silently ignore
    }
  }

  function clear(type) {
    try { localStorage.removeItem(KEY(type)); } catch {}
  }

  function formatRelativeTime(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} ngày trước`;
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  function openModal({ type, title, formatItem }) {
    const list = load(type);

    // Backdrop + modal
    const backdrop = document.createElement('div');
    backdrop.className = 'history-backdrop';
    const modal = document.createElement('div');
    modal.className = 'history-modal';

    const close = () => {
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 180);
    };

    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });

    modal.innerHTML = `
      <div class="history-header">
        <h3 class="history-title">${title}</h3>
        <button class="history-close" aria-label="Đóng">×</button>
      </div>
      <div class="history-list"></div>
      ${list.length ? '<button class="history-clear">Xóa toàn bộ lịch sử</button>' : ''}
    `;

    const listEl = modal.querySelector('.history-list');
    if (list.length === 0) {
      listEl.innerHTML = '<p class="history-empty">Chưa có lịch sử nào. Hãy thử một lần xem nào!</p>';
    } else {
      for (const item of list) {
        const card = document.createElement('div');
        card.className = 'history-item';
        const content = formatItem(item);
        if (typeof content === 'string') card.innerHTML = content;
        else card.appendChild(content);
        const meta = document.createElement('p');
        meta.className = 'history-time';
        meta.textContent = formatRelativeTime(item.ts);
        card.appendChild(meta);
        listEl.appendChild(card);
      }
    }

    modal.querySelector('.history-close').onclick = close;
    const clearBtn = modal.querySelector('.history-clear');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Xóa toàn bộ lịch sử? Hành động này không thể hoàn tác.')) {
          clear(type);
          close();
        }
      };
    }

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
  }

  // Tóm tắt tối đa 3 lần xem gần nhất (gộp cả gieoque + tarot, mới nhất trước)
  // thành chuỗi "ký ức" gửi kèm câu hỏi AI đầu tiên — để AI nhắc lại tinh tế.
  // PHẢI gọi TRƯỚC History.save của lượt hiện tại, không thì lượt này lẫn vào ký ức.
  function buildMemory() {
    const rel = (ts) => {
      const d = Math.floor((Date.now() - ts) / 864e5);
      return d <= 0 ? 'hôm nay' : d === 1 ? 'hôm qua' : d < 7 ? `${d} ngày trước` : `${Math.floor(d / 7)} tuần trước`;
    };
    const cut = (s, n = 80) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const items = [
      ...load('gieoque').map((e) => ({
        ts: e.ts,
        txt: `[${rel(e.ts)} — gieo quẻ] hỏi "${cut(e.question)}" → quẻ ${e.mainName || '?'}${e.hasMoving && e.changedName ? ` (có hào động, biến sang ${e.changedName})` : ''}`,
      })),
      ...load('tarot').map((e) => ({
        ts: e.ts,
        txt: `[${rel(e.ts)} — tarot] hỏi "${cut(e.question)}" → rút ${(e.cards || []).map((c) => c.name + (c.reversed ? ' (ngược)' : '')).join(', ') || '?'}`,
      })),
    ].filter((i) => i.ts).sort((a, b) => b.ts - a.ts).slice(0, 3);
    return items.map((i) => i.txt).join('\n');
  }

  window.History = { save, list: load, clear, openModal, buildMemory };
})();
