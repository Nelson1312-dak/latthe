/**
 * scripts/build-thuvien-index.mjs — index the Thư Viện articles for RAG grounding.
 *
 * Reads every /thuvien/*.html article, extracts the body text, splits it into
 * chunks, embeds each chunk with Ollama (nomic-embed-text) and upserts them into
 * the `documents` table with source='kb' so api/interpret.js can ground answers
 * in real theory (via retrieveKnowledge).
 *
 * Requires Ollama running and the DB reachable. Env (same names as the app):
 *   OLLAMA_BASE_URL     (default http://127.0.0.1:11434)
 *   OLLAMA_EMBED_MODEL  (default nomic-embed-text)
 *   SUPABASE_URL        (prod Supabase REST base, or a local PostgREST base)
 *   SUPABASE_ANON_KEY   (omit for local PostgREST)
 *
 * Run:  node scripts/build-thuvien-index.mjs
 */
import fs from 'fs';
import path from 'path';

const OLLAMA = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const DB_URL = (process.env.SUPABASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const DB_KEY = process.env.SUPABASE_ANON_KEY || '';
const isLocal = /localhost|127\.0\.0\.1|postgrest|:3001/.test(DB_URL);
const DOCS = isLocal ? `${DB_URL}/documents` : `${DB_URL}/rest/v1/documents`;
const DIR = 'thuvien';
const MAX_CHUNK = 800; // chars

const dbHeaders = (extra = {}) => {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (DB_KEY) { h.apikey = DB_KEY; h.Authorization = `Bearer ${DB_KEY}`; }
  return h;
};

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

const CAT_MAP = {
  'Kinh Dịch': 'gieoque', 'Bài Tarot': 'tarot', 'Tarot': 'tarot',
  'Tử Vi': 'tuvi', 'Thần Số Học': 'thansohoc', 'Phong Thủy': 'tuvi',
  'Cổ Học': 'tuvi', // foundational (12 con giáp, âm dương ngũ hành, phong thủy)
};

function articleType(html) {
  // Primary: section headings carry the module class, e.g. <h2 class="gieoque">
  const h = html.match(/<h2 class="(gieoque|tarot|tuvi|thansohoc)"/);
  if (h) return h[1];
  // Fallback: the "Chuyên mục: <strong>X</strong>" label
  const c = html.match(/Chuyên mục:\s*<strong>([^<]+)<\/strong>/);
  return c ? (CAT_MAP[c[1].trim()] || null) : null;
}

function articleTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? decode(m[1].replace(/<[^>]+>/g, '').trim()) : 'Bài viết Thư Viện';
}

function extractText(html) {
  // Real content lives in <div class="article-body"> ... up to </main>.
  let body;
  const start = html.indexOf('class="article-body"');
  if (start >= 0) {
    const from = html.indexOf('>', start) + 1;
    const end = html.indexOf('</main>', from);
    body = html.slice(from, end > 0 ? end : undefined);
  } else {
    const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    body = m ? m[1] : html;
  }
  return decode(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<\/(p|h2|h3|h4|li|div|tr)>/gi, '\n')   // block boundaries -> newlines
      .replace(/<[^>]+>/g, ' ')
  ).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// Group paragraphs into ~MAX_CHUNK-char chunks on paragraph boundaries.
function chunk(text) {
  const paras = text.split('\n').map(s => s.trim()).filter(p => p.length > 30);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + ' ' + p).length > MAX_CHUNK && buf) { chunks.push(buf.trim()); buf = ''; }
    buf += (buf ? ' ' : '') + p;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

async function embed(text) {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
  return (await res.json()).embedding;
}

async function run() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  console.log(`Indexing ${files.length} articles -> ${DOCS}\n`);
  let total = 0, skipped = 0;

  for (const file of files) {
    const html = fs.readFileSync(path.join(DIR, file), 'utf8');
    const type = articleType(html);
    if (!type) { console.log(`  skip ${file} (no module badge)`); skipped++; continue; }
    const title = articleTitle(html);
    const ctx = `/thuvien/${file}`;
    const chunks = chunk(extractText(html));

    // Clear previous chunks for this article so re-runs don't duplicate.
    await fetch(`${DOCS}?source=eq.kb&context=eq.${encodeURIComponent(ctx)}`, {
      method: 'DELETE', headers: dbHeaders(),
    }).catch(() => {});

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(`${title}. ${chunks[i]}`);
      const res = await fetch(DOCS, {
        method: 'POST',
        headers: dbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          type, source: 'kb', is_followup: false,
          question: `${title} (phần ${i + 1})`,
          context: ctx,
          answer: chunks[i],
          embedding,
        }),
      });
      if (!res.ok) { console.error(`    ! insert failed: ${res.status} ${await res.text()}`); }
      else total++;
    }
    console.log(`  ✓ ${file} [${type}] — ${chunks.length} chunks`);
  }
  console.log(`\nDone. Inserted ${total} chunks (${skipped} articles skipped).`);
}

run().catch((e) => { console.error(e); process.exit(1); });
