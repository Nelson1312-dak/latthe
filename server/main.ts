/**
 * Máy chủ chế độ online — lớp HTTP.
 *
 *     npm run server        (cổng 8787; đọc cấu hình từ .env.online)
 *
 * Có `ONLINE_DB_URL` thì lưu bằng Postgres; không có thì chạy trong bộ nhớ (mất hết khi tắt) và
 * nói rõ ra. Luật nằm ở core.ts, SQL ở store.ts; file này chỉ biết đọc JSON từ request, gọi
 * đúng hàm, và biến lỗi thành mã HTTP. Trình duyệt gọi cùng nguồn (`/api/...`) qua proxy của
 * Vite, nên không cần CORS và CSP `connect-src 'self'` vẫn đúng.
 *
 * Chỉ nghe ở 127.0.0.1: muốn người ngoài vào được phải qua một đường hầm (tunnel) hoặc reverse
 * proxy do chủ máy chủ chủ động bật — xem server/README.md.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, attack, authenticate, claimInbox, opponents, putVillage, register } from './core';
import { MemStore, PgStore } from './store';
import type { Store } from './store';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 64 * 1024;

const url = process.env.ONLINE_DB_URL;
let pgClose: (() => Promise<void>) | null = null;
let store: Store;
if (url) {
  const pg = await PgStore.open(url);
  store = pg;
  pgClose = () => pg.close();
  console.log('storage: postgres');
} else {
  store = new MemStore();
  console.warn('storage: MEMORY ONLY (set ONLINE_DB_URL to keep data)');
}

function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, fail) => {
    let n = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      n += c.length;
      if (n > MAX_BODY) { fail(new HttpError(413, 'Body too large')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => {
      if (parts.length === 0) { ok({}); return; }
      try { ok(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch { fail(new HttpError(400, 'Bad JSON')); }
    });
    req.on('error', fail);
  });
}

/** Giới hạn tốc độ thô: mỗi IP tối đa 120 lời gọi mỗi phút. Đủ chặn vòng lặp lỡ tay. */
const hits = new Map<string, { t: number; n: number }>();
function limited(ip: string, now: number): boolean {
  const h = hits.get(ip);
  if (!h || now - h.t > 60000) { hits.set(ip, { t: now, n: 1 }); return false; }
  h.n += 1;
  return h.n > 120;
}

async function route(req: IncomingMessage): Promise<{ status: number; json: unknown }> {
  const now = Date.now();
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const m = req.method ?? 'GET';
  if (limited(req.socket.remoteAddress ?? '?', now)) throw new HttpError(429, 'Slow down');
  const auth = req.headers.authorization;

  if (m === 'GET' && path === '/api/health') return { status: 200, json: { ok: true } };
  if (m === 'POST' && path === '/api/register') {
    return { status: 201, json: await store.tx((s) => register(s, now)) };
  }
  // Mọi việc cần đăng nhập đều xác thực BÊN TRONG giao dịch: người chơi đọc ra là bản mới
  // nhất sau khi nắm khoá, không phải bản cũ từ trước lúc chờ.
  if (m === 'PUT' && path === '/api/village') {
    const b = await body(req);
    return { status: 200, json: await store.tx(async (s) => putVillage(s, await authenticate(s, auth), b, now)) };
  }
  if (m === 'GET' && path === '/api/opponents') {
    return { status: 200, json: await opponents(store, await authenticate(store, auth), now) };
  }
  if (m === 'POST' && path === '/api/attack') {
    const b = await body(req);
    return { status: 200, json: await store.tx(async (s) => attack(s, await authenticate(s, auth), b, now)) };
  }
  if (m === 'POST' && path === '/api/inbox/claim') {
    return { status: 200, json: await store.tx(async (s) => claimInbox(s, await authenticate(s, auth), now)) };
  }
  throw new HttpError(404, 'Not found');
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  route(req).then(({ status, json }) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(json));
  }).catch((e: unknown) => {
    const err = e instanceof HttpError ? e : new HttpError(500, 'Server error');
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) res.writeHead(err.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`online server on http://127.0.0.1:${PORT}`));

// Tắt êm: đóng cổng rồi trả kết nối về cho Postgres, để khoá và giao dịch dở không bị bỏ lại.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => { void (pgClose?.() ?? Promise.resolve()).then(() => process.exit(0)); });
  });
}
