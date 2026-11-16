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

// Bộ quân cburnett (CC BY-SA 3.0) đi kèm cm-chessboard.
cpSync('node_modules/cm-chessboard/assets/pieces/standard.svg', 'public/pieces/cburnett.svg');
const lic = readFileSync('node_modules/cm-chessboard/assets/pieces/standard.svg', 'utf8').split('-->')[0];
writeFileSync('public/pieces/LICENSE.txt', lic.replace(/^<\?xml[^>]*\?><!--/, '').trim() + '\n');

// Stockfish: bản lite-single, chạy một luồng nên không cần COOP/COEP.
//
// CHỈ chép khi WITH_ENGINE=1. Stockfish dùng giấy phép GPL-3: đưa nó lên web là phân phối,
// kéo theo nghĩa vụ công khai mã nguồn theo GPL-3. Giai đoạn 0 chưa dùng engine trong trình
// duyệt (`npm run fixtures` gọi thẳng từ node_modules), nên bản deploy không mang theo file
// engine cho tới khi chốt giấy phép ở giai đoạn 3 — xem docs/PLAN.md mục 5.
if (process.env.WITH_ENGINE === '1') {
  for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
    const src = join('node_modules/stockfish/bin', f);
    if (existsSync(src)) cpSync(src, join('public/engine', f));
    else console.warn('thiếu engine:', f);
  }
  console.log('Đã chép font, bộ quân và engine vào public/');
} else {
  console.log('Đã chép font và bộ quân vào public/ (engine bỏ qua: đặt WITH_ENGINE=1 nếu cần)');
}
