/* ============================================================
   landing-fx.js — Hiệu ứng 3D huyền học cho trang chủ Lật Bài (v2)
   1. Mystic dust field: hạt vàng + glyph Bát Quái, parallax chuột/scroll
      + vệt sao chổi theo con trỏ + click nổ hạt + sao băng ngẫu nhiên
   2. Halo thiên văn 3D quanh logo + 2 lá bài mini bay quỹ đạo
   3. Tiêu đề "lật bài" lật 3D từng ký tự như lật bài thật
   4. Tilt 3D card + glare + lực hút nam châm theo con trỏ
   5. Scroll reveal 3D + divider tự vẽ
   Vanilla JS, không phụ thuộc lib — an toàn với CSP script-src 'self'.
   ============================================================ */
(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  document.documentElement.classList.add('fx-js');

  /* ---------- 1. Mystic dust field + sparks + sao băng ---------- */
  function initField() {
    if (prefersReduced) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'fx-field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    const GLYPHS = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷', '✦', '✧', '☾'];
    const COUNT = isMobile ? 44 : 92;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const LINE_DIST = 110;
    const MAX_SPARKS = 140;

    let W = 0, H = 0;
    let parts = [];
    let sparks = [];      // vệt chuột + click burst
    let risers = [];      // glyph bay lên khi click
    let meteor = null;    // sao băng
    let meteorTimer = 0;
    let mx = 0, my = 0, camX = 0, camY = 0;
    let lastSpX = -99, lastSpY = -99;
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
      const isGlyph = Math.random() < 0.16;
      return {
        x: Math.random() * W,
        y: Math.random() * (H + 120),
        d: 0.3 + Math.random() * 0.7,
        r: 0.8 + Math.random() * 1.6,
        vy: 0.06 + Math.random() * 0.14,
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

    function addSpark(x, y, burst) {
      if (sparks.length >= MAX_SPARKS) sparks.shift();
      const ang = Math.random() * Math.PI * 2;
      const sp = burst ? 1 + Math.random() * 2.6 : 0.2 + Math.random() * 0.5;
      sparks.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (burst ? 0.4 : 0.1),
        r: burst ? 1 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2,
        life: 1,
        decay: burst ? 0.016 + Math.random() * 0.014 : 0.028 + Math.random() * 0.02
      });
    }

    function addRiser(x, y) {
      risers.push({
        x, y,
        glyph: GLYPHS[(Math.random() * GLYPHS.length) | 0],
        vy: -(0.5 + Math.random() * 0.5),
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 0.02,
        size: 15 + Math.random() * 9,
        life: 1
      });
    }

    function spawnMeteor() {
      const fromLeft = Math.random() < 0.5;
      meteor = {
        x: fromLeft ? -40 : W + 40,
        y: Math.random() * H * 0.35,
        vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 4),
        vy: 2 + Math.random() * 1.6,
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

      /* --- bụi + glyph nền --- */
      const wrapH = H + 120;
      const pts = [];
      for (const p of parts) {
        p.y -= p.vy * p.d;
        if (p.y < -60) { p.y += wrapH; p.x = Math.random() * W; }

        const sway = Math.sin(t * 0.6 + p.phase) * p.sway * 14;
        const dx = p.x + sway + camX * 46 * p.d;
        let dy = p.y - scroll * 0.08 * p.d + camY * 26 * p.d;
        dy = ((dy % wrapH) + wrapH) % wrapH - 60;

        const twinkle = 0.72 + 0.28 * Math.sin(t * p.tw + p.phase);

        if (p.glyph) {
          const size = 11 + p.d * 13;
          const a = (0.10 + p.d * 0.14) * twinkle;
          ctx.font = size + 'px "Segoe UI Symbol", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(166, 104, 16, ' + a.toFixed(3) + ')';
          ctx.fillText(p.glyph, dx, dy);
        } else {
          const rad = p.r * (0.6 + p.d);
          const a = (0.18 + p.d * 0.38) * twinkle;
          ctx.beginPath();
          ctx.arc(dx, dy, rad * 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(232, 147, 10, ' + (a * 0.16).toFixed(3) + ')';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx, dy, rad, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(190, 118, 16, ' + a.toFixed(3) + ')';
          ctx.fill();
          pts.push({ x: dx, y: dy, d: p.d });
        }
      }

      /* --- vạch chòm sao --- */
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const ddx = pts[i].x - pts[j].x;
          const ddy = pts[i].y - pts[j].y;
          const dist2 = ddx * ddx + ddy * ddy;
          if (dist2 > LINE_DIST * LINE_DIST) continue;
          const dist = Math.sqrt(dist2);
          const a = (1 - dist / LINE_DIST) * 0.14 * Math.min(pts[i].d, pts[j].d);
          ctx.strokeStyle = 'rgba(200, 130, 26, ' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }

      /* --- sparks (vệt chuột + burst) --- */
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.02;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const a = s.life * 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.life * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240, 170, 40, ' + (a * 0.2).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(212, 132, 18, ' + a.toFixed(3) + ')';
        ctx.fill();
      }

      /* --- glyph bay lên khi click --- */
      for (let i = risers.length - 1; i >= 0; i--) {
        const g = risers[i];
        g.y += g.vy;
        g.rot += g.vr;
        g.life -= 0.011;
        if (g.life <= 0) { risers.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rot);
        ctx.font = g.size + 'px "Segoe UI Symbol", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(190, 115, 14, ' + (g.life * 0.55).toFixed(3) + ')';
        ctx.fillText(g.glyph, 0, 0);
        ctx.restore();
      }

      /* --- sao băng --- */
      meteorTimer -= 0.016;
      if (!meteor && meteorTimer <= 0) {
        spawnMeteor();
        meteorTimer = 6 + Math.random() * 6;
      }
      if (meteor) {
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        meteor.life -= 0.008;
        const tail = 14;
        const tx = meteor.x - meteor.vx * tail;
        const ty = meteor.y - meteor.vy * tail;
        const grad = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
        const a = Math.max(0, meteor.life) * 0.55;
        grad.addColorStop(0, 'rgba(235, 160, 30, ' + a.toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(235, 160, 30, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250, 200, 90, ' + a.toFixed(3) + ')';
        ctx.fill();
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
        // vệt sao chổi: nhả hạt khi con trỏ di đủ xa
        const dx = e.clientX - lastSpX, dy = e.clientY - lastSpY;
        if (dx * dx + dy * dy > 64) {
          lastSpX = e.clientX;
          lastSpY = e.clientY;
          addSpark(e.clientX, e.clientY, false);
        }
      }, { passive: true });
    }

    window.addEventListener('pointerdown', (e) => {
      for (let i = 0; i < (isMobile ? 8 : 13); i++) addSpark(e.clientX, e.clientY, true);
      addRiser(e.clientX, e.clientY);
    }, { passive: true });
  }

  /* ---------- 2. Halo thiên văn + lá bài mini bay quỹ đạo ---------- */
  function initHalo() {
    const icon = document.querySelector('.l-brand-icon');
    if (!icon) return;
    const halo = document.createElement('div');
    halo.className = 'fx-halo';
    halo.setAttribute('aria-hidden', 'true');
    halo.innerHTML =
      '<i class="fx-ring fx-ring-1"></i>' +
      '<i class="fx-ring fx-ring-2"></i>' +
      '<i class="fx-ring fx-ring-3"></i>' +
      '<b class="fx-orb fx-orb-1">✦</b>' +
      '<b class="fx-orb fx-orb-2">☾</b>' +
      '<span class="fx-mcard fx-mcard-1">✦</span>' +
      '<span class="fx-mcard fx-mcard-2">☾</span>';
    icon.appendChild(halo);

    if (!prefersReduced && finePointer) {
      const hero = document.querySelector('.l-hero') || icon;
      hero.addEventListener('pointermove', (e) => {
        const r = icon.getBoundingClientRect();
        const px = (e.clientX - (r.left + r.width / 2)) / 180;
        const py = (e.clientY - (r.top + r.height / 2)) / 180;
        halo.style.transform =
          'rotateX(' + (-py * 10).toFixed(2) + 'deg) rotateY(' + (px * 10).toFixed(2) + 'deg)';
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { halo.style.transform = ''; });
    }
  }

  /* ---------- 3. Tiêu đề lật 3D từng ký tự ---------- */
  function initTitle() {
    const h = document.querySelector('.l-brand-name');
    if (!h) return;
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.textContent = '';
    let i = 0;
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'fx-ch';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.setProperty('--i', i++);
      h.appendChild(s);
    }
  }

  /* ---------- 4. Tilt 3D + glare + nam châm ---------- */
  function initTilt() {
    if (prefersReduced || !finePointer) return;
    const els = document.querySelectorAll('.l-card, .l-lookup-card');
    els.forEach((el) => {
      el.classList.add('fx-tilt');
      const glare = document.createElement('span');
      glare.className = 'fx-glare';
      glare.setAttribute('aria-hidden', 'true');
      el.appendChild(glare);

      let raf = null, rx = 0, ry = 0, gx = 50, gy = 50, tx = 0, ty = 0;

      function render() {
        raf = null;
        el.style.transform =
          'perspective(900px) translate3d(' + tx.toFixed(1) + 'px,' + (ty - 4).toFixed(1) +
          'px,0) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        glare.style.background =
          'radial-gradient(circle at ' + gx.toFixed(1) + '% ' + gy.toFixed(1) +
          '%, rgba(255,255,255,0.5), rgba(255,255,255,0) 55%)';
      }

      el.addEventListener('pointerenter', () => el.classList.add('fx-tilting'));
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry = (px - 0.5) * 10;
        rx = (0.5 - py) * 10;
        tx = (px - 0.5) * 8;      // nam châm: card hút nhẹ về phía con trỏ
        ty = (py - 0.5) * 5;
        gx = px * 100;
        gy = py * 100;
        if (!raf) raf = requestAnimationFrame(render);
      }, { passive: true });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('fx-tilting');
        el.style.transform = '';
        glare.style.background = 'none';
      });
    });
  }

  /* ---------- 5. Scroll reveal 3D ---------- */
  function initReveal() {
    const els = document.querySelectorAll(
      '.l-card, .l-lookup-card, .l-feature, .faq-item, .l-group-title, ' +
      '.l-section-title, .l-about-lead, .l-lookup-sub, .l-divider'
    );
    if (prefersReduced || !('IntersectionObserver' in window)) return;

    els.forEach((el) => el.classList.add('fx-reveal'));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const sibs = Array.prototype.filter.call(
          el.parentElement.children,
          (c) => c.classList.contains('fx-reveal')
        );
        const i = sibs.indexOf(el);
        el.style.transitionDelay = (i > 0 ? Math.min(i, 5) * 70 : 0) + 'ms';
        el.classList.add('fx-in');
        el.addEventListener('transitionend', function done(ev) {
          if (ev.propertyName !== 'transform') return;
          el.classList.remove('fx-reveal');
          el.style.transitionDelay = '';
          el.removeEventListener('transitionend', done);
        });
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    els.forEach((el) => io.observe(el));
  }

  function boot() {
    initField();
    initHalo();
    initTitle();
    initTilt();
    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
