import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('  [LOI TRANG]', e.message.slice(0, 150)));
await p.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' });
await p.evaluate(() => fetch('/api/auth/dev', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Nelson' }) }));

// Do toc do lay bai tu kho
const speed = await p.evaluate(async () => {
  const ms = [];
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    const r = await (await fetch('/api/puzzles/next', { credentials: 'same-origin' })).json();
    ms.push(performance.now() - t0);
    if (!r.puzzle) return { loi: 'kho rong', kho: r.kho };
  }
  ms.sort((a, b) => a - b);
  const r = await (await fetch('/api/puzzles/next', { credentials: 'same-origin' })).json();
  return { trungVi: Math.round(ms[6]), chamNhat: Math.round(ms[11]), kho: r.kho, viDu: r.puzzle };
});
console.log('lay bai: trung vi', speed.trungVi + 'ms, cham nhat', speed.chamNhat + 'ms');
console.log('kho bai tap:', speed.kho?.toLocaleString('vi'), 'bai');
console.log('vi du:', speed.viDu?.id, '| do kho', speed.viDu?.rating, '|', speed.viDu?.themes?.join(' '));

// Giai mot bai that tren giao dien
await p.goto('http://localhost:5173/#/on-tap', { waitUntil: 'networkidle' });
await p.waitForSelector('#board svg', { timeout: 30000 });
const r = await p.evaluate(async () => {
  const data = await (await fetch('/api/puzzles/next', { credentials: 'same-origin' })).json();
  return { chuDe: document.querySelector('.theme-tag')?.textContent, coBanCo: !!document.querySelector('#board svg'), kho: data.kho };
});
console.log('man On tap:', r.chuDe, '| ban co hien:', r.coBanCo);

// Bam "Xem loi giai" roi "Bai tiep theo"
await p.getByRole('button', { name: 'Xem lời giải' }).click();
await p.waitForSelector('.task-done', { timeout: 15000 });
const kq = await p.locator('.task-done').textContent();
console.log('sau khi xem loi giai:', kq.replace(/\s+/g, ' ').trim().slice(0, 90));
await p.getByRole('button', { name: 'Bài tiếp theo' }).click();
await p.waitForSelector('#board svg', { timeout: 20000 });
console.log('bai tiep theo: OK');

// Tien do co ghi nhan khong
const td = await p.evaluate(async () => (await (await fetch('/api/progress', { credentials: 'same-origin' })).json()));
console.log('tien do: do kho', td.rating, '| da lam', td.attempts, '| dung', td.correct, '| chuoi', td.streak, 'ngay');
await b.close();
