/* ============================================================
   mystic-fx.js — Engine hạt huyền học dùng chung cho các module
   Nhúng: <script src="/js/mystic-fx.js" defer
            data-color="232,147,10"      màu accent (r,g,b)
            data-glyphs="☰☱☲☳☴☵☶☷"       glyph bay theo chủ đề module
            data-count="60"              số hạt desktop (mobile = 1/2)
            data-lines="1"               vạch chòm sao (mặc định bật)
            data-burst="1"></script>     click nổ hạt (mặc định bật)
   Canvas z-index -1: nằm sau nội dung, trên nền body.
   Vanilla JS, không lib — an toàn CSP script-src 'self'.
   ============================================================ */
(() => {
  'use strict';

  const script = document.currentScript;
  if (!script) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  const COLOR = (script.dataset.color || '232,147,10').trim();
  const GLYPHS = [...(script.dataset.glyphs || '✦✧☾')];
  const BASE_COUNT = parseInt(script.dataset.count || '60', 10);
  const COUNT = isMobile ? Math.round(BASE_COUNT / 2) : BASE_COUNT;
  const LINES = script.dataset.lines !== '0';
  const BURST = script.dataset.burst !== '0';
  const LINE_DIST = 100;
  const MAX_SPARKS = 90;

  function rgba(a) { return 'rgba(' + COLOR + ',' + a.toFixed(3) + ')'; }

  function boot() {
    const canvas = document.createElement('canvas');
    canvas.id = 'fx-mystic';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let parts = [];
    let sparks = [];
    let meteor = null;
    let meteorTimer = 4;
    let mx = 0, my = 0, camX = 0, camY = 0;
    let raf = null;
    let t = 0;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function spawn() {
      const isGlyph = Math.random() < 0.2;
      return {
        x: Math.random() * W,
        y: Math.random() * (H + 120),
        d: 0.3 + Math.random() * 0.7,
        r: 0.8 + Math.random() * 1.5,
        vy: 0.05 + Math.random() * 0.12,
        sway: 0.2 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        tw: 0.5 + Math.random() * 1.5,
        glyph: isGlyph ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : null
      };
    }

    function build() {
      parts = [];
      for (let i = 0; i < COUNT; i++) parts.push(spawn());
    }

    function addSpark(x, y) {
      if (sparks.length >= MAX_SPARKS) sparks.shift();
      const ang = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.4;
      sparks.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 0.4,
        r: 1 + Math.random() * 1.6,
        life: 1,
        decay: 0.018 + Math.random() * 0.014
      });
    }

    function spawnMeteor() {
      const fromLeft = Math.random() < 0.5;
      meteor = {
        x: fromLeft ? -40 : W + 40,
        y: Math.random() * H * 0.3,
        vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 4),
        vy: 2 + Math.random() * 1.5,
        life: 1
      };
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      t += 0.016;
      camX += (mx - camX) * 0.05;
      camY += (my - camY) * 0.05;
      const scroll = window.scrollY || 0;

      ctx.clearRect(0, 0, W, H);

      const wrapH = H + 120;
      const pts = [];
      for (const p of parts) {
        p.y -= p.vy * p.d;
        if (p.y < -60) { p.y += wrapH; p.x = Math.random() * W; }

        const sway = Math.sin(t * 0.6 + p.phase) * p.sway * 14;
        const dx = p.x + sway + camX * 40 * p.d;
        let dy = p.y - scroll * 0.07 * p.d + camY * 22 * p.d;
        dy = ((dy % wrapH) + wrapH) % wrapH - 60;

        const twinkle = 0.72 + 0.28 * Math.sin(t * p.tw + p.phase);

        if (p.glyph) {
          const size = 11 + p.d * 12;
          const a = (0.09 + p.d * 0.13) * twinkle;
          ctx.font = size + 'px "Segoe UI Symbol", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = rgba(a);
          ctx.fillText(p.glyph, dx, dy);
        } else {
          const rad = p.r * (0.6 + p.d);
          const a = (0.15 + p.d * 0.32) * twinkle;
          ctx.beginPath();
          ctx.arc(dx, dy, rad * 3, 0, Math.PI * 2);
          ctx.fillStyle = rgba(a * 0.15);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx, dy, rad, 0, Math.PI * 2);
          ctx.fillStyle = rgba(a);
          ctx.fill();
          pts.push({ x: dx, y: dy, d: p.d });
        }
      }

      if (LINES) {
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const ddx = pts[i].x - pts[j].x;
            const ddy = pts[i].y - pts[j].y;
            const dist2 = ddx * ddx + ddy * ddy;
            if (dist2 > LINE_DIST * LINE_DIST) continue;
            const dist = Math.sqrt(dist2);
            const a = (1 - dist / LINE_DIST) * 0.12 * Math.min(pts[i].d, pts[j].d);
            ctx.strokeStyle = rgba(a);
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.02;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const a = s.life * 0.65;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.life * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = rgba(a * 0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
        ctx.fillStyle = rgba(a);
        ctx.fill();
      }

      meteorTimer -= 0.016;
      if (!meteor && meteorTimer <= 0) {
        spawnMeteor();
        meteorTimer = 8 + Math.random() * 8;
      }
      if (meteor) {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= 0.008;
        const tail = 14;
        const tx = meteor.x - meteor.vx * tail;
        const ty = meteor.y - meteor.vy * tail;
        const grad = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
        const a = Math.max(0, meteor.life) * 0.5;
        grad.addColorStop(0, rgba(a));
        grad.addColorStop(1, rgba(0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        if (meteor.life <= 0 || meteor.x < -80 || meteor.x > W + 80 || meteor.y > H + 80) {
          meteor = null;
        }
      }
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    build();
    start();

    window.addEventListener('resize', () => { resize(); build(); }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });
    if (finePointer) {
      window.addEventListener('pointermove', (e) => {
        mx = (e.clientX / W - 0.5) * 2;
        my = (e.clientY / H - 0.5) * 2;
      }, { passive: true });
    }
    if (BURST) {
      window.addEventListener('pointerdown', (e) => {
        for (let i = 0; i < (isMobile ? 7 : 11); i++) addSpark(e.clientX, e.clientY);
      }, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
