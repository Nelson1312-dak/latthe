// Chạy Vite và server API cùng lúc; tắt một cái thì tắt cả hai.
import { spawn } from 'node:child_process';

const API_PORT = process.env.API_PORT ?? '8787';
const stripPort = ({ PORT, ...rest }) => rest;

// Trên Windows, đường dẫn node.exe có dấu cách, nên KHÔNG chạy nó qua shell.
// Chỉ vite cần shell (vì npx là file .cmd).
const procs = [
  ['vite', 'npx', ['vite'], process.platform === 'win32'],
  [
    'api',
    process.execPath,
    ['--env-file-if-exists=.env.chess', '--experimental-strip-types', '--no-warnings', 'server/main.ts'],
    false,
  ],
].map(([name, cmd, args, useShell]) => {
  const p = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: useShell,
    // Xoá PORT khỏi môi trường con: Vite tự chọn cổng của nó, còn API đọc API_PORT.
    env: { ...stripPort(process.env), AUTH_DEV: process.env.AUTH_DEV ?? '1', API_PORT: API_PORT },
  });
  for (const stream of [p.stdout, p.stderr]) {
    stream.setEncoding('utf8');
    let buf = '';
    stream.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.trim()) console.log(`[${name}] ${line}`);
      }
    });
  }
  p.on('exit', (code) => {
    console.log(`[${name}] dừng (mã ${code})`);
    stopAll();
  });
  return p;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) p.kill();
  setTimeout(() => process.exit(0), 300);
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, stopAll);
