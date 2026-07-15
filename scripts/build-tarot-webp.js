// Converts assets-src/tarot/*.jpg → tarot/images/*.webp (resized, quality 80).
// The jpg originals live outside git/deploy (assets-src is gitignored) — only
// the webp output ships. Run: npm run build:tarot
import sharp from 'sharp';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC_DIR = 'assets-src/tarot';
const OUT_DIR = 'tarot/images';
const MAX_WIDTH = 900;
const QUALITY = 80;

const files = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.jpg'));
let totalIn = 0;
let totalOut = 0;

for (const file of files) {
  const inPath = join(SRC_DIR, file);
  const outPath = join(OUT_DIR, file.replace(/\.jpg$/i, '.webp'));
  await sharp(inPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toFile(outPath);
  totalIn += statSync(inPath).size;
  totalOut += statSync(outPath).size;
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`Converted ${files.length} cards`);
console.log(`JPG total:  ${mb(totalIn)} MB`);
console.log(`WebP total: ${mb(totalOut)} MB  (${Math.round((1 - totalOut / totalIn) * 100)}% smaller)`);
