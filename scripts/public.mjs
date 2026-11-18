// Chạy bản thật và mở ra internet — và GIỮ cho nó sống.
// Chạy: npm run public                       (tunnel tạm, địa chỉ ngẫu nhiên)
//       npm run public -- --tunnel=ngrok       (tên miền cố định, đang dùng cho latbai.vn)
//       npm run public -- --tunnel=named       (Cloudflare, xem docs/TEN-MIEN.md)
//       npm run public -- --tunnel=none        (chỉ chạy trong máy)
//       thêm --log=data/logs/public.log để ghi nhật ký ra file (Task Scheduler dùng)
//
// Script này là "người canh": nó bật server và tunnel, rồi
// - con nào chết thì tự dựng lại con đó (chờ 2, 4, 8… tối đa 60 giây);
// - mỗi phút kiểm sức khoẻ: server trong máy, và cả đường người dùng thật đi
//   (qua tunnel). Hỏng 3 lần liền thì khởi động lại đúng phần hỏng;
// - đã có một bản đang chạy thì thôi, không bật bản thứ hai.
// Bản trước hễ một con chết là thoát hẳn với mã "thành công", nên Task
// Scheduler tưởng mọi thứ ổn và không chạy lại — latbai.vn chết cho tới khi
// có người ngồi vào máy.
//
// KHÔNG sửa cấu hình tunnel của máy. ngrok.yml và dịch vụ cloudflared trên máy
// này đang phục vụ việc khác; script chỉ ĐỌC, và khi cần thì tự sinh file cấu
// hình riêng của project rồi chồng lên.

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const PORT = process.env.API_PORT ?? '8787';
const TÊN = 'co-vua';
/** Tên tunnel Cloudflare đã tạo sẵn, dùng cho --tunnel=named. */
const CF_TUNNEL = process.env.CF_TUNNEL ?? 'co-vua';
const CẤU_HÌNH_RIÊNG = '.ngrok.local.yml';
const NGROK_YML =
  process.env.NGROK_CONFIG ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ngrok/ngrok.yml');

const cờ = process.argv.slice(2);
const chọn = (cờ.find((c) => c.startsWith('--tunnel=')) ?? '').split('=')[1] ?? process.env.TUNNEL ?? 'auto';
const FILE_LOG = (cờ.find((c) => c.startsWith('--log=')) ?? '').split('=')[1] ?? '';

/* ---------------- Nhật ký ---------------- */

const LOG_MAX = 5 * 1024 * 1024;
if (FILE_LOG) mkdirSync(dirname(resolve(FILE_LOG)), { recursive: true });

function ghi(dòng) {
  const d = `${new Date().toISOString()} ${dòng}`;
  console.log(d);
  if (!FILE_LOG) return;
  try {
    // Quá 5MB thì đổi tên thành .1 (giữ đúng một bản cũ), ghi file mới
    if (existsSync(FILE_LOG) && statSync(FILE_LOG).size > LOG_MAX) renameSync(FILE_LOG, `${FILE_LOG}.1`);
    appendFileSync(FILE_LOG, d + '\n');
  } catch {
    /* không ghi được nhật ký thì thôi, đừng làm chết server */
  }
}

/* ---------------- Tiến trình con, tự dựng lại khi chết ---------------- */

let đangDừng = false;
const các = [];

/** Giết cả cây tiến trình (server còn có engine con của bot). */
function giết(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid);
    } catch {
      /* đã chết */
    }
  }
}

function tạo(tên, lệnh, args, env = {}) {
  const c = { tên, lệnh, args, env, p: null, bắtĐầu: 0, chờ: 2_000, hẹn: null };
  các.push(c);
  return c;
}

function bật(c) {
  if (đangDừng) return;
  c.bắtĐầu = Date.now();
  // shell:false cho mọi lệnh: có shell thì giết shell xong tiến trình thật vẫn sống (ngrok mồ côi)
  const p = spawn(c.lệnh, c.args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...c.env } });
  c.p = p;
  const in_ = (buf) => {
    for (const d of String(buf).split('\n')) {
      if (!d.trim()) continue;
      ghi(`[${c.tên}] ${d.trimEnd()}`);
      // cloudflared in địa chỉ công khai ra log, bắt lấy cho dễ thấy
      const m = /https:\/\/[-a-z0-9]+\.trycloudflare\.com/.exec(d);
      if (m) ghi(`>>> Mở ra: ${m[0]}`);
    }
  };
  p.stdout.on('data', in_);
  p.stderr.on('data', in_);
  p.on('error', (err) => ghi(`[${c.tên}] không chạy được: ${err.message}`));
  p.on('exit', (mã) => {
    c.p = null;
    if (đangDừng) return;
    // Chạy được hơn một phút rồi mới chết thì coi như sự cố lẻ: dựng lại nhanh
    if (Date.now() - c.bắtĐầu > 60_000) c.chờ = 2_000;
    ghi(`[${c.tên}] dừng (mã ${mã}) — dựng lại sau ${c.chờ / 1000}s`);
    c.hẹn = setTimeout(() => bật(c), c.chờ);
    c.chờ = Math.min(60_000, c.chờ * 2);
  });
}

/** Khởi động lại một con (khi kiểm sức khoẻ thấy hỏng). */
function khởiĐộngLại(c, lýDo) {
  ghi(`[canh] ${lýDo} — khởi động lại ${c.tên}`);
  c.chờ = 2_000;
  if (c.p) giết(c.p.pid); // sự kiện exit sẽ tự dựng lại
  else bật(c);
}

function dừngHết() {
  if (đangDừng) return;
  đangDừng = true;
  for (const c of các) {
    if (c.hẹn) clearTimeout(c.hẹn);
    if (c.p) giết(c.p.pid);
  }
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(sig, dừngHết);

/* ---------------- Kiểm sức khoẻ ---------------- */

async function khoẻ(url) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      // Đi qua ngrok miễn phí thì phải có header này, không thì nhận về trang cảnh báo
      headers: { 'ngrok-skip-browser-warning': '1' },
    });
    return r.ok && (await r.text()).includes('"ok":true');
  } catch {
    return false;
  }
}

/* ---------------- Bắt đầu ---------------- */

if (!existsSync('dist/index.html')) {
  console.error('Chưa có dist/. Chạy `npm run build` trước.');
  process.exit(1);
}

// Đã có một bản đang chạy (chạy tay, hoặc Task Scheduler bật hai lần) thì thôi
if (await khoẻ(`http://127.0.0.1:${PORT}/api/health`)) {
  ghi(`Đã có server chạy ở cổng ${PORT}. Không bật thêm bản thứ hai.`);
  process.exit(0);
}

// AUTH_DEV cố tình KHÔNG bật: bản mở ra internet thì không có đăng nhập giả.
// (Server cũng tự chặn theo từng request, nhưng không bật vẫn hơn.)
const server = tạo(
  'server',
  process.execPath,
  ['--env-file-if-exists=.env.chess', '--experimental-strip-types', '--no-warnings', 'server/main.ts'],
  { API_PORT: PORT, AUTH_DEV: '' },
);
bật(server);

let tunnel = null;
let địaChỉCôngKhai = null;

if (chọn === 'none') {
  ghi(`Chỉ chạy trong máy: http://localhost:${PORT}`);
} else if (chọn === 'ngrok') {
  // Dùng tên miền cố định đã đặt sẵn trong cấu hình chung, nếu có.
  const host = process.env.NGROK_HOSTNAME ?? đọcTênMiền();
  writeFileSync(
    CẤU_HÌNH_RIÊNG,
    `version: "3"\ntunnels:\n  ${TÊN}:\n    proto: http\n    addr: ${PORT}\n` + (host ? `    domain: ${host}\n` : ''),
  );
  ghi(host ? `Mở ra: https://${host}` : 'ngrok sẽ cấp một tên ngẫu nhiên.');
  if (host) địaChỉCôngKhai = `https://${host}`;
  // ngrok miễn phí chỉ cho MỘT phiên: tunnel cũ của chính project này còn sót
  // (lần chạy trước bị giết thô) thì dọn đi, không thì cái mới không lên được.
  // Chỉ đụng tới ngrok chạy với file cấu hình của project này.
  dọnNgrokCũ();
  tunnel = tạo('ngrok', tìmLệnh('ngrok'), ['start', '--config', NGROK_YML, '--config', CẤU_HÌNH_RIÊNG, TÊN]);
  bật(tunnel);
} else if (chọn === 'named') {
  // Tunnel Cloudflare đã đặt tên và đã gắn tên miền. `--url` đè lên phần
  // ingress trong cấu hình, nên không cần file config riêng.
  ghi(`Mở tunnel "${CF_TUNNEL}" (tên miền cố định). Chưa tạo thì xem docs/TEN-MIEN.md.`);
  tunnel = tạo('cloudflared', tìmLệnh('cloudflared'), [
    'tunnel',
    '--no-autoupdate',
    'run',
    '--url',
    `http://localhost:${PORT}`,
    CF_TUNNEL,
  ]);
  bật(tunnel);
} else {
  // Mặc định: cloudflared quick tunnel. Không cần tài khoản, không đụng vào
  // dịch vụ cloudflared đang chạy sẵn, nhưng mỗi lần chạy là một tên khác.
  ghi('Đang mở tunnel tạm (cloudflared). Địa chỉ sẽ hiện ngay dưới đây.');
  tunnel = tạo('cloudflared', tìmLệnh('cloudflared'), ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate']);
  bật(tunnel);
}

// Mỗi phút kiểm một lần. Hỏng 3 lần liền mới ra tay, để một lần mạng chập
// chờn không làm khởi động lại vô cớ. Chờ 90 giây đầu cho mọi thứ lên hẳn.
const hỏng = { server: 0, tunnel: 0 };
setTimeout(() => {
  setInterval(async () => {
    const trongMáy = await khoẻ(`http://127.0.0.1:${PORT}/api/health`);
    hỏng.server = trongMáy ? 0 : hỏng.server + 1;
    if (hỏng.server >= 3) {
      hỏng.server = 0;
      khởiĐộngLại(server, 'server trong máy không trả lời 3 lần liền');
      return;
    }
    // Server ổn mà người dùng vẫn không tới được: lỗi ở tunnel
    if (trongMáy && tunnel && địaChỉCôngKhai) {
      const ngoài = await khoẻ(`${địaChỉCôngKhai}/api/health`);
      hỏng.tunnel = ngoài ? 0 : hỏng.tunnel + 1;
      if (hỏng.tunnel >= 3) {
        hỏng.tunnel = 0;
        khởiĐộngLại(tunnel, 'từ internet không tới được server 3 lần liền');
      }
    }
  }, 60_000);
}, 90_000);

/* ---------------- Tiện ích ---------------- */

function đọcTênMiền() {
  try {
    const yml = readFileSync(NGROK_YML, 'utf8');
    return /(?:hostname|domain):\s*(\S+)/.exec(yml)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Đường dẫn đầy đủ của một lệnh. Task Scheduler không phải lúc nào cũng có
 * PATH giống cửa sổ dòng lệnh, nên hỏi trước một lần cho chắc.
 */
function tìmLệnh(tên) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [tên], { encoding: 'utf8' });
  const dòng = (r.stdout ?? '').split(/\r?\n/).find((d) => d.trim());
  return dòng?.trim() || tên;
}

function dọnNgrokCũ() {
  if (process.platform !== 'win32') return;
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='ngrok.exe'" | Where-Object { $_.CommandLine -like '*${CẤU_HÌNH_RIÊNG}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ],
    { stdio: 'ignore' },
  );
}
