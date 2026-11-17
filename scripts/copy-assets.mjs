// Chép font, bộ quân và engine từ node_modules vào public/ (chạy ở postinstall).
// Chỉ lấy đúng những file cần dùng để không phình thư mục.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WEIGHTS = [400, 500, 600];
const SUBSETS = ['latin', 'latin-ext', 'vietnamese'];

mkdirSync('public/fonts', { recursive: true });
mkdirSync('public/pieces', { recursive: true });
mkdirSync('public/engine', { recursive: true });

let faces = '';
for (const [family, pkg, cssName] of [
  ['IBM Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans'],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono', 'ibm-plex-mono'],
  ['IBM Plex Serif', '@fontsource/ibm-plex-serif', 'ibm-plex-serif'],
]) {
  for (const w of family === 'IBM Plex Serif' ? [400] : WEIGHTS) {
    for (const s of SUBSETS) {
      const file = `${cssName}-${s}-${w}-normal.woff2`;
      const src = join('node_modules', pkg, 'files', file);
      if (!existsSync(src)) {
        console.warn('thiếu font:', file);
        continue;
      }
      cpSync(src, join('public/fonts', file));
      faces += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url('/fonts/${file}') format('woff2')}\n`;
    }
  }
}
writeFileSync('public/fonts/fonts.css', faces);

// Bộ quân cburnett (CC BY-SA 3.0) đi kèm cm-chessboard. Chép nguyên bản.
//
// Đã từng gỡ stroke-width ra để CSS tự đặt, định làm quân "nét căng" hơn: trên
// ảnh phóng to 2× thì thấy đậm và rõ thật, nhưng ở CỠ THẬT (ô cờ ~74px) nét dày
// làm các chi tiết dính vào nhau — Xe mất khe, Mã bết lại. Nét gốc 1.5 là vừa.
// Bài học: chọn độ dày nét thì phải nhìn ở đúng cỡ sẽ dùng.
cpSync('node_modules/cm-chessboard/assets/pieces/standard.svg', 'public/pieces/cburnett.svg');
const lic = readFileSync('node_modules/cm-chessboard/assets/pieces/standard.svg', 'utf8').split('-->')[0];
writeFileSync('public/pieces/LICENSE.txt', lic.replace(/^<\?xml[^>]*\?><!--/, '').trim() + '\n');

// Stockfish: bản lite-single, chạy một luồng nên không cần COOP/COEP.
// App phát hành theo GPL-3 (xem LICENSE và THIRD-PARTY.md) nên đưa engine lên web được.
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  const src = join('node_modules/stockfish/bin', f);
  if (existsSync(src)) cpSync(src, join('public/engine', f));
  else console.warn('thiếu engine:', f);
}

console.log('Đã chép font, bộ quân và engine vào public/');
