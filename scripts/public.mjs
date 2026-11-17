// Chạy bản thật và mở ra internet.
// Chạy: npm run public            (tự chọn tunnel có sẵn)
//       npm run public -- --tunnel=cloudflared
//       npm run public -- --tunnel=ngrok
//       npm run public -- --tunnel=none     (chỉ chạy server ở localhost)
//
// Khác `npm run dev` ở chỗ: dựng sẵn dist rồi để chính server Node phục vụ cả
// trang tĩnh lẫn /api trên MỘT cổng. Cùng một origin nên cookie phiên chạy
// bình thường, không phải cấu hình CORS, và Google OAuth chỉ cần một origin.
//
// KHÔNG sửa cấu hình tunnel của máy. ngrok.yml và dịch vụ cloudflared trên máy
// này đang phục vụ việc khác; script chỉ ĐỌC, và khi cần thì tự sinh file cấu
// hình riêng của project rồi chồng lên.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = process.env.API_PORT ?? '8787';
const TÊN = 'co-vua';
const CẤU_HÌNH_RIÊNG = '.ngrok.local.yml';
const NGROK_YML =
  process.env.NGROK_CONFIG ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ngrok/ngrok.yml');

const cờ = process.argv.slice(2);
const chọn = (cờ.find((c) => c.startsWith('--tunnel=')) ?? '').split('=')[1] ?? process.env.TUNNEL ?? 'auto';

const con = [];
function chay(tên, lệnh, args, env = {}) {
  // shell:false cho node (đường dẫn có dấu cách), shell:true cho .exe tìm theo PATH
  const p = spawn(lệnh, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: lệnh !== process.execPath,
    env: { ...process.env, ...env },
  });
  const in_ = (buf) => {
    for (const d of String(buf).split('\n')) {
      if (!d.trim()) continue;
      console.log(`[${tên}] ${d}`);
      // cloudflared in địa chỉ công khai ra log, bắt lấy cho dễ thấy
      const m = /https:\/\/[-a-z0-9]+\.trycloudflare\.com/.exec(d);
      if (m) console.log(`\n>>> Mở ra: ${m[0]}\n`);
    }
  };
  p.stdout.on('data', in_);
  p.stderr.on('data', in_);
  p.on('exit', (mã) => {
    console.log(`[${tên}] dừng (mã ${mã})`);
    dọn();
  });
  con.push(p);
  return p;
}

let đangDọn = false;
function dọn() {
  if (đangDọn) return;
  đangDọn = true;
  for (const p of con) p.kill();
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, dọn);

if (!existsSync('dist/index.html')) {
  console.error('Chưa có dist/. Chạy `npm run build` trước.');
  process.exit(1);
}

// AUTH_DEV cố tình KHÔNG bật: bản mở ra internet thì không có đăng nhập giả.
// (Server cũng tự chặn theo từng request, nhưng không bật vẫn hơn.)
chay(
  'server',
  process.execPath,
  ['--env-file-if-exists=.env.chess', '--experimental-strip-types', '--no-warnings', 'server/main.ts'],
  { API_PORT: PORT, AUTH_DEV: '' },
);

if (chọn === 'none') {
  console.log(`\nChỉ chạy trong máy: http://localhost:${PORT}\n`);
} else if (chọn === 'ngrok') {
  // Dùng tên miền cố định đã đặt sẵn trong cấu hình chung, nếu có.
  const host = process.env.NGROK_HOSTNAME ?? đọcTênMiền();
  writeFileSync(
    CẤU_HÌNH_RIÊNG,
    `version: "3"\ntunnels:\n  ${TÊN}:\n    proto: http\n    addr: ${PORT}\n` + (host ? `    domain: ${host}\n` : ''),
  );
  console.log(host ? `\nMở ra: https://${host}\n` : '\nngrok sẽ cấp một tên ngẫu nhiên.\n');
  chay('ngrok', 'ngrok', ['start', '--config', NGROK_YML, '--config', CẤU_HÌNH_RIÊNG, TÊN]);
} else {
  // Mặc định: cloudflared quick tunnel. Không cần tài khoản, không đụng vào
  // dịch vụ cloudflared đang chạy sẵn, nhưng mỗi lần chạy là một tên khác.
  console.log('\nĐang mở tunnel tạm (cloudflared). Địa chỉ sẽ hiện ngay dưới đây.\n');
  chay('cloudflared', 'cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate']);
}

function đọcTênMiền() {
  try {
    const yml = readFileSync(NGROK_YML, 'utf8');
    return /(?:hostname|domain):\s*(\S+)/.exec(yml)?.[1] ?? null;
  } catch {
    return null;
  }
}
