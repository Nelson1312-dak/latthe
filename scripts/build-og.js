/**
 * scripts/build-og.js — Convert OG source SVGs to 1200x630 PNGs.
 * Usage: node scripts/build-og.js
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES = [
  { src: 'og-source-main.svg',     out: 'og-main.png' },
  { src: 'og-source-gieoque.svg',  out: 'og-gieoque.png' },
  { src: 'og-source-tarot.svg',    out: 'og-tarot.png' },
  { src: 'og-source-drinking.svg', out: 'og-drinking.png' },
  { src: 'og-source-tuvi.svg',     out: 'og-tuvi.png' },
  { src: 'og-source-xinxam.svg',   out: 'og-xinxam.png' },
];

for (const { src, out } of SOURCES) {
  const svgPath = join(__dirname, src);
  const outPath = join(__dirname, '..', 'images', out);
  const svg = await readFile(svgPath);
  const png = await sharp(svg, { density: 144 })
    .resize(1200, 630, { fit: 'contain', background: '#ffffff' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(outPath, png);
  console.log(`✓ ${out}  (${(png.length / 1024).toFixed(1)} KB)`);
}
