/**
 * js/share-card.js — Scaffold chung cho share card ảnh (canvas 1080×1350).
 *
 * Chuẩn hóa pattern đã dùng ở ghep-doi/bao-cao/hoang-dao (nền kem, viền gold
 * kép, toBlob → Web Share Level 2 → fallback tải ảnh) để các module mới không
 * copy-paste lần nữa. 3 module cũ vẫn giữ bản riêng của chúng.
 *
 * Global: window.LatbaiShareCard
 */
(function () {
  'use strict';

  // Đợi web font sẵn sàng rồi mới trả canvas — canvas fillText không tự chờ font.
  async function setup(w = 1080, h = 1350) {
    await document.fonts.ready;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return { cv, ctx: cv.getContext('2d') };
  }

  const F = (size, weight = 800) => `${weight} ${size}px 'Be Vietnam Pro', sans-serif`;

  // Nền kem + glow màu module từ đỉnh + viền gold kép.
  // glowRGB: chuỗi 'r,g,b' (vd '124,58,237' cho tarot).
  function paintBase(ctx, W, H, glowRGB) {
    ctx.fillStyle = '#fbf3e4';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, 0, 100, W / 2, 0, 900);
    grad.addColorStop(0, `rgba(${glowRGB}, 0.14)`);
    grad.addColorStop(1, `rgba(${glowRGB}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(217, 138, 10, 0.75)';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, W - 88, H - 88);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Word-wrap theo measureText. Vẽ tối đa maxLines dòng (dòng cuối bị cắt thì
  // thêm '…'). Trả về y của baseline TIẾP THEO sau dòng cuối đã vẽ.
  // Caller tự set ctx.font/fillStyle/textAlign trước khi gọi.
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return y;
    let line = '';
    let lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        if (lines === maxLines - 1) {
          while (line && ctx.measureText(line + '…').width > maxW) {
            line = line.slice(0, -1);
          }
          ctx.fillText(line + '…', x, y);
          return y + lineH;
        }
        ctx.fillText(line, x, y);
        y += lineH;
        lines++;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineH;
    }
    return y;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed: ' + src));
      img.src = src;
    });
  }

  function footer(ctx, W, H, text) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7887a';
    ctx.font = F(28, 600);
    ctx.fillText(text, W / 2, H - 92);
  }

  // wantShare=true: thử Web Share Level 2 (sheet hệ thống, có kèm ảnh);
  // hủy/không hỗ trợ → rơi xuống tải ảnh trực tiếp.
  async function shareOrDownload(cv, { fileName, title, text, wantShare }) {
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (wantShare && navigator.canShare
        && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
      try {
        await navigator.share({
          files: [new File([blob], fileName, { type: 'image/png' })],
          title,
          text,
        });
        return;
      } catch (_) { /* người dùng hủy → rơi xuống tải ảnh */ }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  window.LatbaiShareCard = { setup, F, paintBase, roundRect, wrapText, loadImage, footer, shareOrDownload };
})();
