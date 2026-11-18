// Sinh vân bàn cờ (gỗ, cẩm thạch, giấy sách cờ) bằng thuật toán, ra ảnh WebP nhỏ.
// Chạy: node scripts/build-boards.mjs   (cần playwright; vẽ bằng canvas trong Chromium)
// Ra: public/board/<tên>.webp, mỗi ảnh là vân cho CẢ bàn cờ (8x8 ô dùng chung một
// tấm, nên vân gỗ chạy liền qua các ô như bàn thật). Ô sáng và ô tối mỗi loại một tấm.
//
// Không dùng ảnh chụp hay ảnh của ai: mọi thứ tự sinh từ nhiễu (value noise + fbm),
// hạt giống cố định nên chạy lại ra đúng ảnh cũ.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZE = 640;
const OUT = 'public/board';

/** Mỗi tấm: kiểu vân + bảng màu + hạt giống. */
export const TEXTURES = {
  // Gỗ phong (ô sáng) và óc chó (ô tối): kiểu bàn gỗ thi đấu
  'maple': { kind: 'wood', base: '#e8cfa0', dark: '#c9a46c', streak: 0.55, seed: 11, ring: 38 },
  'walnut': { kind: 'wood', base: '#8a5a36', dark: '#5c3820', streak: 0.65, seed: 23, ring: 30 },
  // Gỗ hoàng dương (ô sáng) và hồng mộc (ô tối)
  'boxwood': { kind: 'wood', base: '#efdcb4', dark: '#d6b98a', streak: 0.45, seed: 31, ring: 46 },
  'rosewood': { kind: 'wood', base: '#7a3a26', dark: '#4e2015', streak: 0.7, seed: 47, ring: 26 },
  // Cẩm thạch trắng (ô sáng), xanh rêu và xám than (ô tối)
  'marble-white': { kind: 'marble', base: '#eceae4', vein: '#9a9a96', seed: 5, veins: 3.2 },
  'marble-green': { kind: 'marble', base: '#4f7564', vein: '#c7d8cc', seed: 9, veins: 2.6 },
  'marble-grey': { kind: 'marble', base: '#6e6f73', vein: '#c9c9cc', seed: 13, veins: 2.8 },
  // Sách cờ: giấy ngà, ô tối là gạch chéo như sơ đồ in
  'paper': { kind: 'paper', base: '#f1ead9', seed: 3 },
  'paper-hatch': { kind: 'hatch', base: '#f1ead9', ink: '#2f2a22', seed: 4 },
};

function drawAll({ size, specs }) {
  // ---- nhiễu có hạt giống ----
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function noise2(seed) {
    const r = rng(seed);
    const P = 256;
    const g = new Float32Array(P * P);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const at = (x, y) => g[((y & (P - 1)) * P) + (x & (P - 1))];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = sm(x - xi), yf = sm(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }
  function fbm(n, x, y, oct = 5) {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * n(x * f, y * f); amp *= 0.5; f *= 2; }
    return v;
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  const out = {};
  for (const [name, sp] of Object.entries(specs)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const n = noise2(sp.seed);
    const n2 = noise2(sp.seed + 101);
    const base = hex(sp.base);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let c;
        const u = x / size, v = y / size;
        if (sp.kind === 'wood') {
          // Thớ gỗ chạy dọc: nhiễu kéo dài theo trục y, vân vòng cong nhẹ
          const warp = fbm(n, u * 3, v * 0.6, 4) * 2.2;
          const ring = Math.sin((u * sp.ring + warp * 6) * Math.PI);
          const fibre = fbm(n2, u * 90, v * 4, 3);
          let t = (ring * 0.5 + 0.5) ** 2.2 * sp.streak + (fibre - 0.5) * 0.35;
          t = Math.min(1, Math.max(0, t));
          c = mix(base, hex(sp.dark), t);
          const pore = fbm(n2, u * 220, v * 12, 2);
          c = c.map((k) => k * (0.96 + pore * 0.06));
        } else if (sp.kind === 'marble') {
          // Vân đá: sin của tọa độ bị nhiễu xoắn mạnh, lấy phần mảnh làm gân
          // Gân chính mảnh và mờ dần, thêm một lớp gân phụ rất nhạt và mây đá loang:
          // gân sắc và sáng quá thì trông như tia chớp chứ không ra đá.
          const turb = fbm(n, u * 2.2, v * 2.2, 6);
          const s = Math.abs(Math.sin((u + v * 0.6) * sp.veins * Math.PI + turb * 7));
          const s2 = Math.abs(Math.sin((u * 0.4 - v) * sp.veins * 1.7 * Math.PI + fbm(n2, u * 3, v * 3, 5) * 8));
          const vein = (1 - s) ** 16 * 0.55 + (1 - s2) ** 9 * 0.18;
          const cloud = fbm(n2, u * 3.5, v * 3.5, 6);
          c = mix(base, hex(sp.vein), Math.min(1, Math.max(0, vein + (cloud - 0.5) * 0.32)));
        } else if (sp.kind === 'paper') {
          const grain = fbm(n, u * 160, v * 160, 2);
          const blot = fbm(n2, u * 3, v * 3, 4);
          c = base.map((k) => k * (0.975 + grain * 0.035 - (blot - 0.5) * 0.03));
        } else {
          // Gạch chéo 45° như sơ đồ trong sách cờ in, nét hơi run theo giấy
          const grain = fbm(n, u * 160, v * 160, 2);
          const period = size / 8 / 7; // 7 nét mỗi ô
          const d = ((x + y) / Math.SQRT2) % period;
          const line = Math.max(0, 1 - Math.abs(d - period / 2) / 1.35);
          const paper = base.map((k) => k * (0.975 + grain * 0.035));
          c = mix(paper, hex(sp.ink), Math.min(1, line * (0.85 + (fbm(n2, u * 40, v * 40, 2) - 0.5) * 0.4)));
        }
        const i = (y * size + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    out[name] = cv.toDataURL('image/webp', 0.86);
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
const res = await p.evaluate(drawAll, { size: SIZE, specs: TEXTURES });
for (const [name, url] of Object.entries(res)) {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(`${OUT}/${name}.webp`, buf);
  console.log(name, Math.round(buf.length / 1024) + 'KB');
}
await b.close();
