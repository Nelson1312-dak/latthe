// Dựng các bộ quân cờ thành sprite <symbol> để <use href="#wk"> dùng được.
//
// Nguồn: kho mã nguồn của Lichess (lichess-org/lila, public/piece/<bộ>/wK.svg ...),
// giấy phép từng bộ ghi trong PIECE_SETS dưới đây và trong public/pieces/sets/LICENSES.txt.
// Chạy: node scripts/build-pieces.mjs <thư-mục-đã-tải>
//   thư mục đó có <bộ>/wK.svg, <bộ>/bQ.svg ... (12 file mỗi bộ, tải từ
//   https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/<bộ>/<quân>.svg)
// Ra: public/pieces/sets/<bộ>.svg
//
// Mỗi quân thành một <symbol id="wk" viewBox="..."> riêng, nên bộ nào vẽ khung
// cỡ nào (45, 50, 800...) cũng tự co vừa ô. id bên trong (gradient...) được gắn
// tiền tố theo quân để 12 quân không giẫm lên nhau. Bộ cburnett lấy từ sprite cũ
// (public/pieces/cburnett.svg, khung 40x40).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PIECE_SETS = [
  { id: 'merida', author: 'Armando Hernandez Marroquin', license: 'GPLv2+' },
  { id: 'celtic', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'papercut', author: 'Nikolay Anzarov', license: 'CC BY 4.0' },
  { id: 'fantasy', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'spatial', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'chessnut', author: 'Alexis Luengas', license: 'Apache 2.0' },
  { id: 'mpchess', author: 'Maxime Chupin', license: 'GPLv3+' },
];
const CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const OUT = 'public/pieces/sets';

/** Một file SVG một quân -> <symbol> với id bên trong đã gắn tiền tố. */
function toSymbol(svg, code) {
  const id = code.toLowerCase();
  const s = svg.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const open = /<svg\b([^>]*)>/.exec(s);
  if (!open) throw new Error(`Không thấy thẻ <svg> trong ${code}`);
  const attrs = open[1];
  const viewBox = /viewBox="([^"]+)"/.exec(attrs)?.[1] ?? '0 0 45 45';
  // Thuộc tính vẽ trên thẻ gốc (fill-rule, stroke...) chuyển xuống một <g> bọc ngoài
  const keep = [...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)]
    .filter(([, k]) => !/^(xmlns(:\w+)?|width|height|viewBox|version|style|id|class|x|y)$/.test(k))
    .map(([, k, v]) => `${k}="${v}"`)
    .join(' ');
  let inner = s.slice(open.index + open[0].length, s.lastIndexOf('</svg>'));
  inner = inner
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<desc>[\s\S]*?<\/desc>/g, '')
    .replace(/\bid="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, `$1="#${id}-$2"`)
    // <style> trong SVG chèn vào trang là CSS của CẢ trang: `.fill-color{fill:#fff}`
    // của Vua trắng sẽ bị `.fill-color{...}` của Vua đen (đứng sau) đè. Gắn tiền tố
    // theo quân cho mọi tên class, cả trong <style> lẫn thuộc tính class.
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (_, a, css) =>
      `<style${a}>${css.replace(/\.([A-Za-z_][\w-]*)/g, (_m, c) => `.${id}-${c}`)}</style>`,
    )
    .replace(/\bclass="([^"]*)"/g, (_, cls) =>
      `class="${cls.split(/\s+/).filter(Boolean).map((c) => `${id}-${c}`).join(' ')}"`,
    );
  return `<symbol id="${id}" viewBox="${viewBox}"><g ${keep}>${inner}</g></symbol>`;
}

/** Sprite cburnett cũ (khung 40x40, mỗi quân là <g id="wk">) -> dạng <symbol>. */
function cburnettSymbols() {
  const s = readFileSync('public/pieces/cburnett.svg', 'utf8');
  return ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp']
    .map((id) => {
      const start = s.indexOf(`<g id="${id}"`);
      if (start < 0) throw new Error(`cburnett thiếu ${id}`);
      // Tìm thẻ </g> đóng đúng cặp
      let depth = 0;
      const re = /<g\b[^>]*?(\/?)>|<\/g>/g;
      re.lastIndex = start;
      let m;
      let end = -1;
      while ((m = re.exec(s))) {
        if (m[0].startsWith('</')) depth--;
        else if (!m[1]) depth++;
        if (depth === 0) {
          end = re.lastIndex;
          break;
        }
      }
      const g = s.slice(start, end).replace(`<g id="${id}"`, '<g');
      return `<symbol id="${id}" viewBox="0 0 40 40">${g}</symbol>`;
    })
    .join('');
}

/** Con Mã làm dấu nhận diện (logo) giữ nguyên dù người chơi đổi bộ quân. */
function brandSymbol(cb) {
  return cb.match(/<symbol id="wn"[\s\S]*?<\/symbol>/)[0].replace('id="wn"', 'id="brand-n"');
}

/** Ảnh xem trước nhỏ cho ô chọn bộ quân: Mã trắng và Vua đen đứng cạnh nhau. */
const preview = (symbols) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 80 40" width="80" height="40">` +
  `<defs>${symbols.match(/<symbol id="(wn|bk)"[\s\S]*?<\/symbol>/g).join('')}</defs>` +
  `<use href="#wn" x="0" y="0" width="40" height="40"/><use href="#bk" x="40" y="0" width="40" height="40"/></svg>\n`;

const wrap = (symbols) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>\n`;

/**
 * Vua và Hậu Đen bộ merida: dải bóng trắng của bản gốc phủ gần kín thân quân (gradient
 * trắng chỉ nhạt dần từ x=21 tới x=77 trong khung 50), nên Vua Đen trông như quân trắng.
 * Giảm dải bóng còn 18% độ đậm (cùng tông với Xe, Tượng đen): vẫn thấy các vạch trên thân, nhưng nhìn là biết quân đen.
 * Chạy lại nhiều lần vẫn ra một kết quả.
 */
export function fixMerida(svg) {
  return svg.replace(
    /(<linearGradient id="b[kq]-a"[^>]*>)<stop offset="0" stop-color="#fff"(?: stop-opacity="[^"]*")?\/>/g,
    '$1<stop offset="0" stop-color="#fff" stop-opacity=".18"/>',
  );
}

const src = process.argv[2];
mkdirSync(OUT, { recursive: true });
const cb = cburnettSymbols();
const brand = brandSymbol(cb);
writeFileSync(join(OUT, 'cburnett.svg'), wrap(cb + brand));
writeFileSync(join(OUT, 'cburnett.preview.svg'), preview(cb));
if (src) {
  for (const set of PIECE_SETS) {
    let symbols = CODES.map((c) => toSymbol(readFileSync(join(src, set.id, `${c}.svg`), 'utf8'), c)).join('');
    if (set.id === 'merida') symbols = fixMerida(symbols);
    writeFileSync(join(OUT, `${set.id}.svg`), wrap(symbols + brand));
    writeFileSync(join(OUT, `${set.id}.preview.svg`), preview(symbols));
    console.log(set.id);
  }
} else {
  // Không có thư mục nguồn: chỉ sửa lại bộ merida đang có
  for (const f of ['merida.svg', 'merida.preview.svg']) {
    const p = join(OUT, f);
    writeFileSync(p, fixMerida(readFileSync(p, 'utf8')));
  }
}
writeFileSync(
  join(OUT, 'LICENSES.txt'),
  [
    'BỘ QUÂN CỜ TRONG LẬT CỜ — NGUỒN VÀ GIẤY PHÉP',
    '',
    'Các bộ quân lấy từ kho mã nguồn Lichess (https://github.com/lichess-org/lila, thư mục public/piece).',
    'Đã sửa so với bản gốc: gom 12 file SVG của mỗi bộ vào một file sprite (public/pieces/sets/<bộ>.svg),',
    'mỗi quân bọc trong <symbol>, đổi tên id bên trong (thêm tiền tố như "wk-") để không trùng nhau,',
    'bỏ thuộc tính width/height/style của thẻ <svg> gốc; ảnh <bộ>.preview.svg ghép Mã trắng và Vua đen.',
    'Hình vẽ của quân giữ nguyên, trừ một chỗ ở bộ merida: dải bóng trắng trên Vua và Hậu Đen giảm còn 18% độ đậm',
    'để quân đen không trông như quân trắng. Công cụ dựng: scripts/build-pieces.mjs.',
    '',
    '- cburnett — Colin M.L. Burnett (Wikimedia Commons), sửa bởi shaack/cm-chessboard — CC BY-SA 3.0',
    '  https://creativecommons.org/licenses/by-sa/3.0/ (chi tiết: ../LICENSE.txt)',
    '- merida — Armando Hernandez Marroquin — GPL phiên bản 2 trở lên; Lật Cờ phân phối theo GPL-3 (file LICENSE ở gốc kho mã)',
    '- mpchess — Maxime Chupin — GPL phiên bản 3 trở lên (file LICENSE ở gốc kho mã)',
    '- papercut — Nikolay Anzarov — CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ (đã sửa như ghi ở trên)',
    '- chessnut — Copyright 2015 Alexis Luengas — Apache License 2.0 (toàn văn: LICENSE-Apache-2.0.txt)',
    '  Nguồn gốc: https://github.com/LexLuengas/chessnut-pieces',
    '- celtic, fantasy, spatial — Maurizio Monge — MIT (toàn văn bên dưới). Nguồn gốc: https://github.com/maurimo/chess-art',
    '- Logo của Lật Cờ (con Mã, id "brand-n", có trong mọi file bộ quân) là quân Mã của bộ cburnett — CC BY-SA 3.0.',
    '',
    '----------------------------------------------------------------------',
    'MIT License',
    '',
    'Copyright (c) Maurizio Monge',
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'of this software and associated documentation files (the "Software"), to deal',
    'in the Software without restriction, including without limitation the rights',
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
    'copies of the Software, and to permit persons to whom the Software is',
    'furnished to do so, subject to the following conditions:',
    '',
    'The above copyright notice and this permission notice shall be included in all',
    'copies or substantial portions of the Software.',
    '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
    'SOFTWARE.',
    '----------------------------------------------------------------------',
    '',
    'Vân bàn cờ (public/board/*.webp) do Lật Cờ tự sinh bằng thuật toán (scripts/build-boards.mjs),',
    'không dùng ảnh của ai; theo giấy phép của Lật Cờ (GPL-3).',
    '',
  ].join('\n'),
);
console.log('xong');
