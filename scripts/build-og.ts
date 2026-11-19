// Vẽ ảnh chia sẻ riêng (1200×630) cho mỗi trang đọc có bàn cờ: dán link lên Facebook,
// Zalo thì hiện đúng thế cờ của trang đó thay vì ảnh chung của app.
// Chạy sau khi đã sinh trang (npm run seo / lessons / puzzle-pages tự gọi).
//
// Ảnh = tên mục + tiêu đề (h1) + bàn cờ đầu tiên trên trang. Trang nào trỏ og:image
// tới /og/… thì vẽ; nội dung không đổi thì không vẽ lại (so mã băm trong
// scripts/seo/og-hash.json), nên chạy lại rất nhanh.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HASHES = 'scripts/seo/og-hash.json';
const hashes: Record<string, string> = existsSync(HASHES) ? JSON.parse(readFileSync(HASHES, 'utf8')) : {};
const sprite = readFileSync('public/pieces/sets/merida.svg', 'utf8');
// fonts.css trỏ /fonts/… (gốc trang web); vẽ từ file trên đĩa thì đổi sang đường dẫn file
const fonts = readFileSync('public/fonts/fonts.css', 'utf8').replaceAll("url('/fonts/", `url('${pathToFileURL(resolve('public/fonts')).href}/`);

function pages(dir = 'public'): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const d = join(dir, e.name);
    const f = join(d, 'index.html');
    if (existsSync(f)) out.push(f);
    out.push(...pages(d));
  }
  return out;
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

interface Job {
  file: string;
  out: string;
  kicker: string;
  title: string;
  board: string;
  hash: string;
}

const jobs: Job[] = [];
const cầnCó = new Set<string>();
for (const f of pages()) {
  const html = readFileSync(f, 'utf8');
  const m = /<meta property="og:image" content="https:\/\/latbai\.vn(\/og\/[^"]+\.jpg)">/.exec(html);
  if (!m) continue;
  const out = `public${m[1]}`;
  cầnCó.add(out);
  // Trang có thể chọn bàn cờ cho ảnh bằng <figure data-og>; không thì lấy bàn đầu tiên
  const từ = Math.max(0, html.indexOf('<figure data-og>'));
  const board = /<svg class="board"[\s\S]*?<\/svg>/.exec(html.slice(từ))?.[0];
  if (!board) throw new Error(`${f}: trỏ ảnh riêng mà không có bàn cờ`);
  let title = text(/<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '');
  // Tên mục: mắt xích cuối của dòng "Lật Cờ · Bài tập cờ vua"
  const crumbs = [...(/<p class="crumb">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '').matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((x) => x[1]);
  const kicker = crumbs.length > 1 ? text(crumbs.at(-1)!) : '';
  // "Bài tập cờ vua" + "Bài tập đòn đôi": bỏ chữ lặp ở tiêu đề
  if (kicker.startsWith('Bài tập') && title.startsWith('Bài tập ')) title = title.slice(8, 9).toUpperCase() + title.slice(9);
  const hash = createHash('sha1').update(`v5|${kicker}|${title}|${board}`).digest('hex').slice(0, 16);
  if (hashes[out] === hash && existsSync(out)) continue;
  jobs.push({ file: f, out, kicker, title, board, hash });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function card(j: Job): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<style>${fonts}
  :root { --sq-light: #ebecd0; --sq-dark: #739552; --coord-light: #ebecd0; --coord-dark: #739552; --mark-move: rgb(255 255 51 / 0.42);
    --mark-legal: rgb(0 0 0 / 0.2); --mark-check: #cf4034; --arrow-coach: #5fa36a;
    --brush-g: #9fcf3f; --brush-r: #eb6150; --brush-b: #52b0dc; --brush-y: #ffaa00; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #262421; color: #fff; font-family: 'IBM Plex Sans', sans-serif; display: flex; align-items: center; gap: 56px; padding: 40px 64px 40px 40px; overflow: hidden; }
  .board-box { width: 550px; height: 550px; flex: none; }
  .board { width: 100%; height: 100%; display: block; }
  .board .coord { font-family: system-ui, sans-serif; font-size: 13px; }
  .side { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 8px 0; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 34px; font-weight: 600; }
  .brand svg { width: 52px; height: 52px; }
  .kicker { font-size: 28px; color: #a7a5a3; font-weight: 500; margin-bottom: 14px; }
  h1 { font-size: ${j.title.length > 34 ? 54 : 64}px; line-height: 1.12; font-weight: 600; text-wrap: balance; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .site { font-size: 28px; color: #c9c8c6; }
</style></head><body>
<div aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${sprite}</div>
<div class="board-box">${j.board}</div>
<div class="side">
  <div class="brand"><svg viewBox="0 0 40 40"><use href="#brand-n"/></svg>Lật Cờ</div>
  <div>${j.kicker ? `<p class="kicker">${esc(j.kicker)}</p>` : ''}<h1>${esc(j.title)}</h1></div>
  <p class="site">latbai.vn</p>
</div>
</body></html>`;
}

if (jobs.length) {
  mkdirSync('public/og', { recursive: true });
  const tmp = 'public/og/_ve.html';
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    for (const j of jobs) {
      // Mở bằng file thật cạnh public/fonts để trình duyệt nạp được phông Plex
      writeFileSync(tmp, card(j));
      await p.goto(pathToFileURL(resolve(tmp)).href, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      const plex = await p.evaluate(() => document.fonts.check("600 64px 'IBM Plex Sans'", 'Chiếu'));
      if (!plex) throw new Error('chưa nạp được phông IBM Plex Sans');
      await p.screenshot({ path: j.out, type: 'jpeg', quality: 86 });
      hashes[j.out] = j.hash;
      console.log(`og: ${j.out}`);
    }
  } finally {
    await browser.close();
    rmSync(tmp, { force: true });
  }
}

// Ảnh của trang đã xoá thì xoá theo
for (const f of existsSync('public/og') ? readdirSync('public/og') : []) {
  const p = `public/og/${f}`;
  if (!cầnCó.has(p)) {
    rmSync(p);
    delete hashes[p];
    console.log(`og: xoá ${p}`);
  }
}
writeFileSync(HASHES, JSON.stringify(Object.fromEntries(Object.entries(hashes).sort()), null, 1) + '\n');
console.log(`og: ${cầnCó.size} ảnh (${jobs.length} vẽ mới)`);
