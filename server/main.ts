// Server của app: API + phục vụ trang đã dựng. Không framework, chỉ node:http.
// Chạy: npm run server   (hoặc npm run dev để chạy cùng Vite)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { openDb, createLocalUser, type Db, type User } from './db.ts';
import { KEEP_GAMES, insertGame, listGames, parseNewGame } from './games.ts';
import {
  SESSION_COOKIE,
  clearCookie,
  createSession,
  destroySession,
  loginWithGoogle,
  purgeExpiredSessions,
  readCookie,
  sessionCookie,
  userForSession,
} from './auth.ts';

// Dùng API_PORT chứ không phải PORT: nhiều công cụ (ví dụ trình xem trước của IDE)
// đặt sẵn PORT cho tiến trình con, server sẽ nghe nhầm cổng của Vite.
const PORT = Number(process.env.API_PORT ?? 8787);
const HOST = process.env.API_HOST ?? '127.0.0.1';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const DIST = resolve('dist');

/**
 * Đăng nhập giả cho lúc phát triển và chạy test. CHỈ bật được khi server nghe trên
 * máy này — để không bao giờ có đường tắt vào tài khoản trên bản chạy thật.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const DEV_AUTH = process.env.AUTH_DEV === '1' && LOCAL_HOSTS.has(HOST);

const db: Db = openDb();
purgeExpiredSessions(db);
setInterval(() => purgeExpiredSessions(db), 3600_000).unref();

/* ---------------- Tiện ích ---------------- */

const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(text);
};

async function readJson(req: IncomingMessage, limit = 16_384): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Nội dung quá lớn');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

/** Yêu cầu có đi qua HTTPS không — để quyết định đặt cờ Secure cho cookie. */
const isSecure = (req: IncomingMessage) =>
  (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0].trim() === 'https';

const publicUser = (u: User) => ({
  id: u.id,
  name: u.display_name,
  avatar: u.avatar_url,
  puzzleRating: u.puzzle_rating,
  local: u.google_sub === null,
});

const currentUser = (req: IncomingMessage) =>
  userForSession(db, readCookie(req.headers.cookie, SESSION_COOKIE));

/* ---------------- API ---------------- */

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const method = req.method ?? 'GET';

  if (path === '/api/health' && method === 'GET') {
    return json(res, 200, { ok: true, googleConfigured: Boolean(GOOGLE_CLIENT_ID), devAuth: DEV_AUTH });
  }

  // Trình duyệt hỏi: tôi là ai, và trang đăng nhập nên hiện cái gì.
  if (path === '/api/me' && method === 'GET') {
    const user = currentUser(req);
    return json(res, 200, {
      user: user ? publicUser(user) : null,
      googleClientId: GOOGLE_CLIENT_ID || null,
      devAuth: DEV_AUTH,
    });
  }

  if (path === '/api/auth/google' && method === 'POST') {
    if (!GOOGLE_CLIENT_ID) return json(res, 503, { error: 'Server chưa đặt GOOGLE_CLIENT_ID' });
    let body: Record<string, unknown>;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: 'Nội dung không hợp lệ' });
    }
    const credential = typeof body.credential === 'string' ? body.credential : '';
    if (!credential) return json(res, 400, { error: 'Thiếu credential' });
    try {
      const { user, session } = await loginWithGoogle(db, credential, GOOGLE_CLIENT_ID);
      return json(
        res,
        200,
        { user: publicUser(user) },
        { 'set-cookie': sessionCookie(session.token, session.expiresAt, isSecure(req)) },
      );
    } catch (err) {
      // Không nói rõ sai ở đâu: đó là thông tin có ích cho người dò token.
      console.warn('[auth] token Google bị từ chối:', (err as Error).message);
      return json(res, 401, { error: 'Token Google không hợp lệ' });
    }
  }

  if (path === '/api/auth/dev' && method === 'POST') {
    if (!DEV_AUTH) return json(res, 404, { error: 'Không có' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const name = (typeof body.name === 'string' && body.name.trim()) || 'Người chơi thử';
    const user = createLocalUser(db, name.slice(0, 40));
    const session = createSession(db, user.id, 1);
    return json(
      res,
      200,
      { user: publicUser(user) },
      { 'set-cookie': sessionCookie(session.token, session.expiresAt, isSecure(req)) },
    );
  }

  /* ---- Ván đã chơi ---- */

  if (path === '/api/games' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    return json(res, 200, { games: listGames(db, user.id, KEEP_GAMES) });
  }

  if (path === '/api/games' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    let body: Record<string, unknown>;
    try {
      body = await readJson(req, 200_000);
    } catch {
      return json(res, 400, { error: 'Nội dung không hợp lệ' });
    }
    const g = parseNewGame(body);
    if (!g) return json(res, 400, { error: 'Thiếu dữ liệu ván' });
    insertGame(db, user.id, g);
    return json(res, 201, { ok: true });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    destroySession(db, readCookie(req.headers.cookie, SESSION_COOKIE));
    return json(res, 200, { ok: true }, { 'set-cookie': clearCookie(isSecure(req)) });
  }

  json(res, 404, { error: 'Không có đường dẫn này' });
}

/* ---------------- File tĩnh ---------------- */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, urlPath: string): void {
  if (!existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Chưa có thư mục dist. Chạy `npm run build`, hoặc dùng `npm run dev` để phát triển.');
    return;
  }
  // normalize + kiểm tra tiền tố: chặn ../ leo ra ngoài dist
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    // index.html phải luôn tươi, phần còn lại có vân tay trong tên nên cache thoải mái.
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
}

/* ---------------- Vòng đời ---------------- */

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const done = (err: unknown) => {
    console.error('[server]', err);
    if (!res.headersSent) json(res, 500, { error: 'Lỗi server' });
    else res.end();
  };
  if (path.startsWith('/api/')) api(req, res, path).catch(done);
  else {
    try {
      serveStatic(req, res, path);
    } catch (err) {
      done(err);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server: http://${HOST}:${PORT}`);
  console.log(`  database  data/chess.db`);
  console.log(`  Google    ${GOOGLE_CLIENT_ID ? 'đã cấu hình' : 'CHƯA cấu hình (đặt GOOGLE_CLIENT_ID)'}`);
  console.log(`  đăng nhập thử  ${DEV_AUTH ? 'BẬT (AUTH_DEV=1)' : 'tắt'}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
