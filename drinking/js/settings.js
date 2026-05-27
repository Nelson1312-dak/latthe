/**
 * drinking/js/settings.js — Theme picker + sound toggle.
 * Self-contained: no dependency on game.js, attaches itself on DOMContentLoaded.
 * Persists preferences in LocalStorage.
 */
(function () {
  const LS_KEY = 'latthe:drinking:settings';
  const THEMES = [
    { id: 'purple',  name: 'Tím Huyền Bí',  swatch: '#c084fc' },
    { id: 'sunset',  name: 'Hoàng Hôn',     swatch: '#fb923c' },
    { id: 'ocean',   name: 'Đại Dương',     swatch: '#38bdf8' },
    { id: 'forest',  name: 'Rừng Xanh',     swatch: '#34d399' },
  ];

  const defaults = { theme: 'purple', sound: false };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch { return { ...defaults }; }
  }

  function save(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
  }

  let state = load();

  function applyTheme(themeId) {
    document.body.setAttribute('data-theme', themeId);
  }

  // ---- Web Audio: simple beep on card reveal ----
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx && window.AudioContext) {
      try { audioCtx = new AudioContext(); } catch {}
    }
    return audioCtx;
  }
  function playBeep() {
    if (!state.sound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  // ---- Build the settings UI ----
  function buildUI() {
    const trigger = document.createElement('button');
    trigger.className = 'drk-settings-btn';
    trigger.setAttribute('aria-label', 'Cài đặt');
    trigger.innerHTML = '⚙️';

    const panel = document.createElement('div');
    panel.className = 'drk-settings-panel';
    panel.innerHTML = `
      <div class="drk-settings-row">
        <label class="drk-settings-label">Giao diện</label>
        <div class="drk-theme-grid">
          ${THEMES.map(t => `
            <button class="drk-theme-swatch" data-theme="${t.id}"
                    style="--swatch: ${t.swatch}"
                    aria-label="${t.name}" title="${t.name}">
              <span></span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="drk-settings-row">
        <label class="drk-settings-label">Âm thanh khi lật bài</label>
        <button class="drk-sound-toggle" aria-pressed="false">
          <span class="drk-toggle-track"><span class="drk-toggle-thumb"></span></span>
          <span class="drk-toggle-label">Tắt</span>
        </button>
      </div>
    `;

    document.body.appendChild(trigger);
    document.body.appendChild(panel);

    let open = false;
    const setOpen = (v) => {
      open = v;
      panel.classList.toggle('open', v);
      trigger.classList.toggle('active', v);
    };
    trigger.onclick = (e) => { e.stopPropagation(); setOpen(!open); };
    document.addEventListener('click', (e) => {
      if (open && !panel.contains(e.target) && e.target !== trigger) setOpen(false);
    });

    // Theme buttons
    const swatches = panel.querySelectorAll('.drk-theme-swatch');
    const syncSwatches = () => {
      swatches.forEach(b => b.classList.toggle('active', b.dataset.theme === state.theme));
    };
    swatches.forEach(b => {
      b.onclick = () => {
        state.theme = b.dataset.theme;
        applyTheme(state.theme);
        save(state);
        syncSwatches();
      };
    });
    syncSwatches();

    // Sound toggle
    const soundBtn = panel.querySelector('.drk-sound-toggle');
    const soundLabel = soundBtn.querySelector('.drk-toggle-label');
    const syncSound = () => {
      soundBtn.classList.toggle('on', state.sound);
      soundBtn.setAttribute('aria-pressed', String(state.sound));
      soundLabel.textContent = state.sound ? 'Bật' : 'Tắt';
    };
    soundBtn.onclick = () => {
      state.sound = !state.sound;
      save(state);
      syncSound();
      if (state.sound) {
        ensureAudio();
        playBeep();
      }
    };
    syncSound();
  }

  // ---- Hook card reveal: observe DOM for new card flipping ----
  function watchCardReveals() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList?.contains('card-revealed') ||
              node.querySelector?.('.card-revealed')) {
            playBeep();
            return;
          }
        }
        if (m.type === 'attributes' && m.target.classList?.contains('card-revealed')) {
          playBeep();
          return;
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    applyTheme(state.theme);
    buildUI();
    watchCardReveals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DrinkingSettings = { get: () => ({ ...state }), playBeep };
})();
