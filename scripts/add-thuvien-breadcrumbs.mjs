/**
 * scripts/add-thuvien-breadcrumbs.mjs — inject BreadcrumbList JSON-LD into each
 * hand-written /thuvien/ article (they have a visual breadcrumb but no schema).
 * Idempotent: skips files that already contain a BreadcrumbList.
 *
 * Run:  node scripts/add-thuvien-breadcrumbs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'thuvien');

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html') && f !== 'index.html');
let changed = 0, skipped = 0;

for (const file of files) {
  const p = path.join(DIR, file);
  let html = fs.readFileSync(p, 'utf8');

  if (html.includes('"BreadcrumbList"')) { skipped++; continue; }

  // Article title: prefer the visible <h1>, fall back to <title> (minus suffix).
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let name = h1 ? decode(h1[1].replace(/<[^>]+>/g, '').trim())
                : decode((html.match(/<title>([^<]*)<\/title>/i)?.[1] || 'Bài viết').split('|')[0].trim());

  const url = `https://latbai.vn/thuvien/${file}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://latbai.vn/' },
      { '@type': 'ListItem', position: 2, name: 'Thư Viện', item: 'https://latbai.vn/thuvien/' },
      { '@type': 'ListItem', position: 3, name, item: url },
    ],
  };
  const block = `  <script type="application/ld+json">\n  ${JSON.stringify(jsonLd, null, 2).split('\n').join('\n  ')}\n  </script>\n</head>`;

  // Insert right before </head>.
  html = html.replace('</head>', block);
  fs.writeFileSync(p, html, 'utf8');
  changed++;
  console.log(`  + ${file} — "${name}"`);
}

console.log(`\nDone. ${changed} updated, ${skipped} already had breadcrumbs.`);
