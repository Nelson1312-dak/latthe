/**
 * Máy chủ chế độ online — lớp HTTP và lớp lưu trữ.
 *
 *     npm run server        (cổng 8787, dữ liệu ở server/data/online.json)
 *
 * Không phụ thuộc gói nào ngoài Node. Luật nằm ở core.ts; file này chỉ biết đọc JSON từ
 * request, gọi đúng hàm, ghi đĩa, và biến lỗi thành mã HTTP. Trình duyệt gọi cùng nguồn
 * (`/api/...`) qua proxy của Vite, nên không cần CORS và CSP `connect-src 'self'` vẫn đúng.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  HttpError, attack, authenticate, claimInbox, emptyDb, opponents, putVillage, register,
} from './core';
import type { Db } from './core';

const PORT = Number(process.env.PORT ?? 8787);
const FILE = resolve(process.env.ONLINE_DATA ?? 'server/data/online.json');
const MAX_BODY = 64 * 1024;

function load(): Db {
  try {
    if (existsSync(FILE)) return { ...emptyDb(), ...JSON.parse(readFileSync(FILE, 'utf8')) } as Db;
  } catch (e) {
    console.error('Cannot read data file, starting empty:', (e as Error).message);
  }
  return emptyDb();
}

const db = load();

/** Ghi qua file tạm rồi đổi tên: mất điện giữa chừng không để lại một file cụt. */
function save(): void {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, FILE);
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
  const url = new URL(req.url ?? '/', 'http://x');
  const path = url.pathname;
  const m = req.method ?? 'GET';
  if (limited(req.socket.remoteAddress ?? '?', now)) throw new HttpError(429, 'Slow down');

  if (m === 'POST' && path === '/api/register') {
    const r = register(db, now);
    save();
    return { status: 201, json: r };
  }
  const me = authenticate(db, req.headers.authorization);
  if (m === 'PUT' && path === '/api/village') {
    const r = putVillage(db, me, await body(req), now);
    save();
    return { status: 200, json: r };
  }
  if (m === 'GET' && path === '/api/opponents') return { status: 200, json: opponents(db, me, now) };
  if (m === 'POST' && path === '/api/attack') {
    const r = attack(db, me, await body(req), now);
    save();
    return { status: 200, json: r };
  }
  if (m === 'POST' && path === '/api/inbox/claim') {
    const r = claimInbox(db, me, now);
    save();
    return { status: 200, json: r };
  }
  throw new HttpError(404, 'Not found');
}

createServer((req: IncomingMessage, res: ServerResponse) => {
  route(req).then(({ status, json }) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(json));
  }).catch((e: unknown) => {
    const err = e instanceof HttpError ? e : new HttpError(500, 'Server error');
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) res.writeHead(err.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
}).listen(PORT, '127.0.0.1', () => console.log(`online server on http://127.0.0.1:${PORT}  data: ${FILE}`));
