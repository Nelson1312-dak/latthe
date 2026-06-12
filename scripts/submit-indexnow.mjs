/**
 * scripts/submit-indexnow.mjs — push every sitemap URL to IndexNow.
 * Covers Bing, DuckDuckGo, Yandex, Seznam, Naver (Google does not use IndexNow;
 * it discovers the sitemap via robots.txt / Search Console instead).
 *
 * Run after deploying new pages:  node scripts/submit-indexnow.mjs
 */
const KEY = '6fa526faee93b2667e1431bb49259221';
const HOST = 'latbai.vn';

const res = await fetch(`https://${HOST}/sitemap.xml`);
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`Submitting ${urls.length} URLs from sitemap...`);

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: ${r.status} ${r.statusText}`);
