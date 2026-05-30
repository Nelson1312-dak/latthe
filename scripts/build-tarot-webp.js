// Converts tarot/images/*.jpg → .webp (resized, quality 80).
// Run: npm run build:tarot
import sharp from 'sharp';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const DIR = 'tarot/images';
const MAX_WIDTH = 900;
const QUALITY = 80;

const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.jpg'));
let totalIn = 0;
let totalOut = 0;

for (const file of files) {
  const inPath = join(DIR, file);
  const outPath = join(DIR, file.replace(/\.jpg$/i, '.webp'));
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
