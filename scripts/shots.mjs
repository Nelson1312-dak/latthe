// Chụp ảnh các màn hình để duyệt thiết kế. Chạy: npm run shots (cần `npm run dev` đang chạy).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const ROUTES = [
  ['sanh', ''],
  ['choi', 'choi'],
  ['choi-voi-may', 'choi-may'],
  ['xem-lai', 'xem-lai'],
  ['on-tap', 'on-tap'],
  ['van-voi-ban', 'ban'],
  ['tai-khoan', 'tai-khoan'],
  ['trang-thiet-ke', 'thiet-ke'],
];
const VIEWS = [
  ['desktop', 1440, 900],
  ['dienthoai', 390, 844],
];

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
for (const [vName, width, height] of VIEWS) {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    for (const [name, route] of ROUTES) {
      await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!document.querySelector('#piece-sprite svg'));
      await page.waitForTimeout(120);
      const file = `shots/${vName}-${theme}-${name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await page.close();
  }
}
await browser.close();
