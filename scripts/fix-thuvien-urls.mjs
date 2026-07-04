/**
 * fix-thuvien-urls.mjs
 * Strips .html from thuvien article URLs in:
 *   - sitemap-latbai.xml
 *   - thuvien/index.html (all article hrefs)
 *   - thuvien/*.html (canonical, og:url, JSON-LD, related-article links)
 *
 * File names on disk stay .html — Vercel cleanUrls:true serves them extensionless.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Strip .html from /thuvien/SLUG.html patterns (article slugs only, not css/js)
// Matches kebab-case slugs under /thuvien/ at root level (no subdirectory)
function stripThuvienHtml(content) {
  return content.replace(
    /(\/thuvien\/[a-z0-9][a-z0-9-]*)\.html/g,
    '$1'
  );
}

let totalFiles = 0;
let totalChanges = 0;

function processFile(filePath, label) {
  const original = readFileSync(filePath, 'utf8');
  const updated = stripThuvienHtml(original);
  if (original !== updated) {
    writeFileSync(filePath, updated, 'utf8');
    const count = (original.match(/(\/thuvien\/[a-z0-9][a-z0-9-]*)\.html/g) || []).length;
    console.log(`  ✓ ${label} — ${count} URL(s) fixed`);
    totalChanges += count;
    totalFiles++;
  } else {
    console.log(`  – ${label} — no changes needed`);
  }
}

console.log('\n=== fix-thuvien-urls ===\n');

// 1. Sitemap
console.log('📄 sitemap-latbai.xml');
processFile(join(ROOT, 'sitemap-latbai.xml'), 'sitemap-latbai.xml');

// 2. thuvien/index.html
console.log('\n📄 thuvien/index.html');
processFile(join(ROOT, 'thuvien', 'index.html'), 'thuvien/index.html');

// 3. All thuvien/*.html article files
console.log('\n📂 thuvien/*.html articles');
const articles = readdirSync(join(ROOT, 'thuvien'))
  .filter(f => f.endsWith('.html') && f !== 'index.html');

for (const file of articles) {
  processFile(join(ROOT, 'thuvien', file), `thuvien/${file}`);
}

console.log(`\n✅ Done — ${totalFiles} file(s) updated, ${totalChanges} URL(s) fixed\n`);
