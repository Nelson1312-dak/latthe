// Server của app: API + phục vụ trang đã dựng. Không framework, chỉ node:http.
// Chạy: npm run server   (hoặc npm run dev để chạy cùng Vite)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { applyProfile, deleteUser, parsePrefs, parseProfilePatch, profileStats, readPrefs, savePrefs } from './profile.ts';
import { bump, CLIENT_EVENTS, statsFor, type StatEvent } from './stats.ts';
import { createShare, getShare, parseShare } from './shares.ts';
import { dailyCount, dailyMe, dailyPuzzle, recordDaily, today } from './daily.ts';
import { botLadder, eloHistory } from './profile.ts';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { openDb, createLocalUser, all, one, type Db, type User } from './db.ts';
import { KEEP_GAMES, insertGame, listGames, parseNewGame } from './games.ts';
import { countCards, dueCards, getReview, makeCards, parseReview, saveReview } from './reviews.ts';
import { advise, explain, ollamaAlive, queueDepth } from './advisor.ts';
import { coachReport, communityReport } from './coach.ts';
import { presenceBeat, presenceNow } from './presence.ts';
import { saveInsight, startAnalyst } from './analyst.ts';
import { pickPuzzle, puzzleCount, puzzleStats, recentAttemptIds, recordAttempt, themeCounts } from './puzzles.ts';
import { Live } from './live/index.ts';
import { CONTROLS, DEFAULT_CONTROL, REFUSALS } from '../shared/protocol.ts';
import { answerCard } from './reviews.ts';
import type { Facts } from '../shared/advisor/facts.ts';
import {
  SESSION_COOKIE,
  clearCookie,
  createSession,
  destroySession,
  loginWithGoogle,
  fromThisMachine,
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
 * Trang web công khai gọi luồng SSE thẳng vào đây, không qua Vercel.
 * Để trống thì trình duyệt dùng đường tương đối như cũ (chạy trong máy).
 */
const STREAM_BASE = (process.env.PUBLIC_UPSTREAM ?? '').replace(/\/+$/, '');
/** Trang nào được phép mở luồng từ origin khác. */
const ALLOW_ORIGIN = (process.env.PUBLIC_ORIGIN ?? 'https://latbai.vn').replace(/\/+$/, '');

/** Header CORS cho đúng đường luồng, chỉ mở cho trang web của mình. */
function corsFor(req: IncomingMessage): Record<string, string> {
  const o = req.headers.origin;
  if (!o || o !== ALLOW_ORIGIN) return {};
  return { 'access-control-allow-origin': o, vary: 'origin' };
}

/**
 * Đăng nhập giả cho lúc phát triển và chạy test.
 *
 * Bản đầu chỉ xét ĐỊA CHỈ SERVER ĐANG NGHE (`HOST`). Hỏng: chạy sau tunnel thì
 * server vẫn nghe 127.0.0.1 trong khi cả internet gọi vào được — ai cũng có thể
 * POST /api/auth/dev rồi lấy một phiên mang tên bất kỳ. Giờ xét TỪNG REQUEST:
 * chỉ máy này gọi thẳng mới được, qua tunnel thì không.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const DEV_AUTH = process.env.AUTH_DEV === '1' && LOCAL_HOSTS.has(HOST);

/** Đăng nhập giả có dùng được cho request này không. */
const devAuthFor = (req: IncomingMessage) => DEV_AUTH && fromThisMachine(req);

const db: Db = openDb();
purgeExpiredSessions(db);
setInterval(() => purgeExpiredSessions(db), 3600_000).unref();

// Ván online. Nhịp mỗi giây: ghép trận, kiểm tra rơi cờ, dọn phòng cũ.
const live = new Live(db);
// Người chấm nền: chấm mọi ván đã lưu mà trình duyệt chưa chấm, tính tóm tắt lỗi cho Huấn luyện viên
startAnalyst(db);
setInterval(() => live.tick(), 1_000).unref();
// Tunnel hay cắt kết nối đang rảnh, nên 15 giây gửi một nhịp tim.
setInterval(() => live.heartbeat(), 15_000).unref();

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

/**
 * Ai được xem bảng thống kê: id người dùng trong ADMIN_USER_IDS (.env.chess),
 * cách nhau bằng dấu phẩy. Để trống là không ai xem được.
 */
const ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0),
);
/**
 * Hoặc theo Gmail: ADMIN_EMAILS=a@gmail.com,b@gmail.com. Lúc đăng nhập Google, email
 * (đã xác minh) có trong danh sách thì tài khoản được đánh dấu chủ trang. Email chỉ
 * để so, không lưu.
 */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes('@')),
);
const isAdmin = (u: User) => ADMIN_IDS.has(u.id) || u.is_admin === 1;

/**
 * Giới hạn số lần gọi theo địa chỉ, chỉ để chặn spam (đếm lượt, tạo link chia
 * sẻ). Địa chỉ chỉ nằm trong bộ nhớ vài phút, không ghi xuống đâu cả.
 */
const hạnMức = new Map<string, { n: number; hết: number }>();
function quáGiới(req: IncomingMessage, loại: string, max: number, windowMs: number): boolean {
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const khoá = `${loại}:${ip}`;
  const now = Date.now();
  const h = hạnMức.get(khoá);
  if (!h || h.hết <= now) {
    hạnMức.set(khoá, { n: 1, hết: now + windowMs });
    if (hạnMức.size > 5_000) for (const [k, v] of hạnMức) if (v.hết <= now) hạnMức.delete(k);
    return false;
  }
  h.n++;
  return h.n > max;
}

const publicUser = (u: User) => ({
  id: u.id,
  name: u.display_name,
  avatar: u.avatar_url,
  puzzleRating: u.puzzle_rating,
  gameRating: u.game_rating,
  gameCount: u.game_count,
  local: u.google_sub === null,
  onboarded: Boolean(u.onboarded),
  createdAt: u.created_at,
  admin: isAdmin(u),
});

const currentUser = (req: IncomingMessage) =>
  userForSession(db, readCookie(req.headers.cookie, SESSION_COOKIE));

/* ---------------- API ---------------- */

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const method = req.method ?? 'GET';

  if (path === '/api/health' && method === 'GET') {
    return json(res, 200, { ok: true, googleConfigured: Boolean(GOOGLE_CLIENT_ID), devAuth: devAuthFor(req) });
  }

  // Trình duyệt hỏi: tôi là ai, và trang đăng nhập nên hiện cái gì.
  if (path === '/api/me' && method === 'GET') {
    const user = currentUser(req);
    return json(res, 200, {
      user: user ? publicUser(user) : null,
      // Tuỳ chọn hiển thị đi theo tài khoản, sang máy khác vẫn y như cũ
      prefs: user ? readPrefs(user) : null,
      googleClientId: GOOGLE_CLIENT_ID || null,
      devAuth: devAuthFor(req),
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
      const { user, session } = await loginWithGoogle(db, credential, GOOGLE_CLIENT_ID, undefined, ADMIN_EMAILS);
      bump(db, 'login');
      // Tài khoản vừa tạo trong lần đăng nhập này
      if (Date.now() - Date.parse(user.created_at) < 10_000) bump(db, 'signup');
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
    // Cố tình trả 404 chứ không phải 403: người ở xa không cần biết là có đường này
    if (!devAuthFor(req)) return json(res, 404, { error: 'Không có' });
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
    const id = insertGame(db, user.id, g);
    // Trả id để trình duyệt lưu luôn kết quả chấm ván (chấm ngay khi hết ván)
    return json(res, 201, { ok: true, id });
  }

  /* ---- Một ván cụ thể và kết quả chấm ---- */

  const gameMatch = /^\/api\/games\/(\d+)(\/review)?$/.exec(path);
  if (gameMatch) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const gameId = Number(gameMatch[1]);
    const game = one<{
      id: number;
      pgn: string;
      mode: string;
      level: number | null;
      player_side: string;
      winner: string;
      reason: string;
      created_at: string;
      opponent_name: string | null;
      opponent_rating: number | null;
    }>(
      db,
      `SELECT id, pgn, mode, level, player_side, winner, reason, created_at, opponent_name, opponent_rating
         FROM games WHERE id = ? AND user_id = ?`,
      gameId,
      user.id,
    );
    // Không nói "ván này của người khác": người hỏi không cần biết nó tồn tại
    if (!game) return json(res, 404, { error: 'Không có ván này' });

    if (!gameMatch[2] && method === 'GET') {
      return json(res, 200, {
        game: {
          id: game.id,
          pgn: game.pgn,
          mode: game.mode,
          level: game.level,
          playerSide: game.player_side,
          winner: game.winner,
          reason: game.reason,
          createdAt: game.created_at,
          opponentName: game.opponent_name,
          opponentRating: game.opponent_rating,
        },
        review: getReview(db, gameId),
      });
    }

    if (gameMatch[2] && method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await readJson(req, 2_000_000);
      } catch {
        return json(res, 400, { error: 'Nội dung không hợp lệ' });
      }
      const review = parseReview(body.review);
      if (!review) return json(res, 400, { error: 'Kết quả chấm không hợp lệ' });
      saveReview(db, gameId, review);
      const cards = makeCards(db, user.id, gameId, review, game.player_side === 'b' ? 'b' : 'w');
      // Tóm tắt lỗi của ván cho Huấn luyện viên đọc
      saveInsight(db, gameId);
      return json(res, 201, { ok: true, newCards: cards });
    }
  }

  /* ---- Huấn luyện viên ---- */

  /* ---------------- Ván online ---------------- */

  // Luồng server đẩy xuống. Giữ mở cho tới khi trình duyệt đóng.
  // Xin vé mở luồng. Đi qua Vercel cũng được vì đây là request ngắn, có cookie.
  if (path === '/api/live/ticket' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    // Chỉ đưa địa chỉ đi thẳng khi trang gọi tới ĐÚNG LÀ bản web công khai.
    // Chạy trong máy (hoặc mở thẳng địa chỉ tunnel) thì trả rỗng để trình duyệt
    // dùng đường tương đối — không thì bản dev lại đi hỏi cái tunnel đang tắt.
    const quaWeb = req.headers.origin === ALLOW_ORIGIN;
    return json(res, 200, { ticket: live.newTicket(user.id), url: quaWeb ? STREAM_BASE : '' });
  }

  // Trang latbai.vn mở luồng thẳng tới đây (khác origin) kèm header của ngrok,
  // nên trình duyệt hỏi trước bằng OPTIONS. Chỉ trả lời cho đúng trang của mình.
  if (path === '/api/live/stream' && method === 'OPTIONS') {
    const cors = corsFor(req);
    if (!cors['access-control-allow-origin']) return json(res, 403, { error: 'Không được phép' });
    res.writeHead(204, {
      ...cors,
      'access-control-allow-methods': 'GET',
      'access-control-allow-headers': 'ngrok-skip-browser-warning',
      'access-control-max-age': '600',
    });
    res.end();
    return;
  }

  if (path === '/api/live/stream' && method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const vé = url.searchParams.get('ticket');
    // Có vé thì dùng vé (luồng đi thẳng, khác origin nên không có cookie);
    // không có thì vẫn nhận cookie như cũ (chạy trong máy, hoặc cùng origin).
    const userId = vé ? live.useTicket(vé) : (currentUser(req)?.id ?? null);
    const user = userId === null ? null : one<User>(db, 'SELECT * FROM users WHERE id = ?', userId);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' }, corsFor(req));
    live.subscribe(user, res, Date.now(), corsFor(req));
    return;
  }

  if (path === '/api/live/queue' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const control = typeof body.control === 'string' ? body.control : DEFAULT_CONTROL;
    const kq = live.joinQueue(user, control);
    if (!kq.ok) return json(res, 409, { error: REFUSALS[kq.why ?? ''] ?? 'Không vào được hàng chờ' });
    return json(res, 200, { ok: true, control: control in CONTROLS ? control : DEFAULT_CONTROL });
  }

  // Thử thách AI: chọn thẳng một bot để đấu ngay
  if (path === '/api/live/bot' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const control = typeof body.control === 'string' ? body.control : DEFAULT_CONTROL;
    const kq = live.challengeBot(user, String(body.bot ?? ''), control);
    if (!kq.ok) return json(res, 409, { error: REFUSALS[kq.why ?? ''] ?? 'Không bắt đầu được ván' });
    return json(res, 200, { ok: true });
  }

  // Danh sách AI và những AI người này đã thắng (bậc thang)
  if (path === '/api/bots' && method === 'GET') {
    const user = currentUser(req);
    return json(res, 200, { bots: botLadder(db, user?.id ?? null) });
  }

  if (path === '/api/live/queue' && method === 'DELETE') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    live.leaveQueue(user.id);
    return json(res, 200, { ok: true });
  }

  // Trạng thái hiện tại, để trình duyệt vẽ ngay mà không phải chờ sự kiện đầu.
  if (path === '/api/live/status' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 200, { state: null, queue: null, playing: false });
    const now = Date.now();
    const room = live.roomOf(user.id);
    return json(res, 200, {
      state: room ? room.stateFor(user.id, now) : null,
      queue: live.queueState(user.id, now),
      playing: live.isPlaying(user.id),
      controls: Object.keys(CONTROLS),
    });
  }

  if (path === '/api/live/invite' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const control = typeof body.control === 'string' ? body.control : DEFAULT_CONTROL;
    return json(res, 200, { code: live.createInvite(user.id, control) });
  }

  if (path === '/api/live/join' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const mã = typeof body.code === 'string' ? body.code : '';
    const kq = live.acceptInvite(user, mã);
    if (!kq.ok) {
      const nói: Record<string, string> = {
        'no-such-invite': 'Mã mời không đúng hoặc đã hết hạn.',
        'own-invite': 'Đây là lời mời của chính bạn.',
        'already-playing': 'Một trong hai người đang có ván chưa xong.',
      };
      return json(res, 409, { error: nói[kq.why] ?? 'Không vào được ván' });
    }
    return json(res, 200, { ok: true, id: kq.roomId });
  }

  if (path === '/api/live/act' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    let body: Record<string, unknown>;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: 'Nội dung không hợp lệ' });
    }
    const what = body.what;
    const hợpLệ = ['move', 'resign', 'draw-offer', 'draw-accept', 'draw-decline'] as const;
    if (typeof what !== 'string' || !(hợpLệ as readonly string[]).includes(what)) {
      return json(res, 400, { error: 'Hành động lạ' });
    }
    const kq = live.act(user.id, what as (typeof hợpLệ)[number], {
      from: typeof body.from === 'string' ? body.from : undefined,
      to: typeof body.to === 'string' ? body.to : undefined,
      promotion: typeof body.promotion === 'string' ? body.promotion : undefined,
    });
    if (!kq.ok) return json(res, 409, { error: REFUSALS[kq.why ?? ''] ?? 'Không làm được' });
    return json(res, 200, { ok: true });
  }

  if (path === '/api/advisor/status' && method === 'GET') {
    return json(res, 200, { ollama: await ollamaAlive(), hangCho: queueDepth() });
  }

  // Huấn luyện viên (Hồ sơ): nhận định từ các ván gần nhất đã chấm — tính ngay, nhanh
  if (path === '/api/coach' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    return json(res, 200, coachReport(db, user.id));
  }

  // Lời khuyên bằng chữ (AI viết, code kiểm) — có thể mất vài chục giây lần đầu
  if (path === '/api/coach/advice' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const rp = coachReport(db, user.id);
    if (!rp.facts) return json(res, 200, { advice: null, source: 'template' });
    // Đang dở ván online thì không gọi mô hình (GPU để dành, và cho chắc không ai hỏi máy giữa ván)
    if (live.isPlaying(user.id)) {
      const { templateAdvice } = await import('../shared/coach.ts');
      return json(res, 200, { advice: templateAdvice(rp.facts, rp.lessons), source: 'template' });
    }
    return json(res, 200, await advise(db, user.id, rp.facts, rp.lessons));
  }

  if (path === '/api/advisor/explain' && method === 'POST') {
    const user = currentUser(req);
    // Chưa đăng nhập vẫn xem được lời bình mẫu, nhưng không dùng mô hình
    let body: Record<string, unknown>;
    try {
      body = await readJson(req, 100_000);
    } catch {
      return json(res, 400, { error: 'Nội dung không hợp lệ' });
    }
    const facts = body.facts as Facts | undefined;
    if (!facts || typeof facts.nuocDaDi !== 'string' || !Array.isArray(facts.the)) {
      return json(res, 400, { error: 'Thiếu dữ kiện' });
    }
    // Mấy mảng này về sau được đọc thẳng (f.nuocTotHon[0], f.dongChinh[0]...).
    // Thiếu một cái là ngã ở tận trong template, trả về 500 cho người gọi.
    if (!Array.isArray(facts.nuocTotHon) || !Array.isArray(facts.dongChinh) || typeof facts.xepLoai !== 'string') {
      return json(res, 400, { error: 'Dữ kiện không đúng dạng' });
    }
    if (!user) {
      const { templateComment } = await import('../shared/advisor/templates.ts');
      return json(res, 200, { comment: templateComment(facts), source: 'template' });
    }
    // Chặn ở server chứ không chỉ giấu nút: đang đánh với người thì không ai
    // được hỏi máy. Giấu nút thôi thì gọi thẳng API vẫn ra.
    if (live.isPlaying(user.id)) {
      return json(res, 403, { error: REFUSALS['advisor-during-game'] });
    }
    return json(res, 200, await explain(db, user.id, facts));
  }

  /* ---- Thẻ ôn tập ---- */

  if (path === '/api/cards' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    return json(res, 200, { cards: dueCards(db, user.id), ...countCards(db, user.id) });
  }

  if (path === '/api/cards/answer' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const id = Number(body.id);
    if (!Number.isInteger(id)) return json(res, 400, { error: 'Thiếu mã thẻ' });
    const card = answerCard(db, user.id, id, body.correct === true);
    if (!card) return json(res, 404, { error: 'Không có thẻ này' });
    return json(res, 200, { card });
  }

  /* ---- Bài tập ---- */

  if (path === '/api/puzzles/next' && method === 'GET') {
    const user = currentUser(req);
    const url = new URL(req.url ?? '/', 'http://localhost');
    const theme = url.searchParams.get('theme') ?? undefined;
    const rating = user ? puzzleStats(db, user.id).rating : Number(url.searchParams.get('rating') ?? 1000);
    const puzzle = pickPuzzle(db, {
      rating,
      theme,
      exclude: user ? recentAttemptIds(db, user.id) : [],
    });
    if (!puzzle) {
      return json(res, 200, { puzzle: null, kho: puzzleCount(db) });
    }
    return json(res, 200, { puzzle, rating, kho: puzzleCount(db) });
  }

  if (path === '/api/puzzles/answer' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const id = typeof body.id === 'string' ? body.id : '';
    const puzzleRating = Number(body.rating);
    if (!id || !Number.isFinite(puzzleRating)) return json(res, 400, { error: 'Thiếu dữ liệu' });
    return json(res, 200, recordAttempt(db, user.id, id, puzzleRating, body.correct === true));
  }

  /* ---- Bài tập của ngày ---- */

  if (path === '/api/daily' && method === 'GET') {
    const user = currentUser(req);
    const day = today();
    const puzzle = dailyPuzzle(db, day);
    return json(res, 200, { day, puzzle, me: user ? dailyMe(db, user.id, day) : null, count: dailyCount(db, day) });
  }

  if (path === '/api/daily/answer' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const day = today();
    // Chỉ nhận đúng bài của hôm nay (trình duyệt để qua đêm rồi mới giải thì thôi)
    if (body.id !== dailyPuzzle(db, day)?.id) return json(res, 409, { error: 'Bài của ngày đã đổi, tải lại trang nhé.' });
    const mới = recordDaily(db, user.id, day, body.correct === true);
    if (mới && !fromThisMachine(req)) bump(db, 'daily');
    return json(res, 200, { me: dailyMe(db, user.id, day) });
  }

  if (path === '/api/puzzles/themes' && method === 'GET') {
    return json(res, 200, { themes: themeCounts(db), kho: puzzleCount(db) });
  }

  /* ---- Bài học ---- */

  if (path === '/api/lessons' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 200, { done: [] });
    return json(res, 200, {
      done: all<{ lesson_id: string }>(db, 'SELECT lesson_id FROM lesson_progress WHERE user_id = ?', user.id).map(
        (r) => r.lesson_id,
      ),
    });
  }

  if (path === '/api/lessons' && method === 'POST') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const id = typeof body.id === 'string' ? body.id.slice(0, 40) : '';
    if (!id) return json(res, 400, { error: 'Thiếu mã bài' });
    db.prepare(
      'INSERT INTO lesson_progress (user_id, lesson_id, done_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    ).run(user.id, id, new Date().toISOString());
    return json(res, 201, { ok: true });
  }

  if (path === '/api/progress' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    return json(res, 200, {
      ...puzzleStats(db, user.id),
      the: countCards(db, user.id),
      hopThe: all<{ box: number; c: number }>(
        db,
        'SELECT box, count(*) c FROM cards WHERE user_id = ? GROUP BY box ORDER BY box',
        user.id,
      ),
      chuDeHaySai: all<{ cls: string; c: number }>(
        db,
        'SELECT cls, count(*) c FROM cards WHERE user_id = ? GROUP BY cls ORDER BY c DESC',
        user.id,
      ),
    });
  }

  /* ---- Thống kê ẩn danh ---- */

  // Trình duyệt báo "vừa có một lượt X". Chỉ nhận đúng các loại đã định; không lưu ai gửi.
  if (path === '/api/ping' && method === 'POST') {
    const body = await readJson(req, 256).catch(() => ({}) as Record<string, unknown>);
    const e = body.e as StatEvent;
    // Lượt từ chính máy này (lúc phát triển, lúc chạy kiểm tra giao diện) không tính:
    // người dùng thật luôn đi qua tunnel, mang theo x-forwarded-*
    const thật = !fromThisMachine(req);
    if (thật && (CLIENT_EVENTS as readonly string[]).includes(e) && !quáGiới(req, 'ping', 60, 60_000)) bump(db, e);
    res.writeHead(204);
    res.end();
    return;
  }

  // Đang mở trang: mỗi tab gửi mã ngẫu nhiên ~45 giây một lần (chỉ giữ trong bộ nhớ, xem presence.ts)
  if (path === '/api/presence' && method === 'POST') {
    const body = await readJson(req, 256).catch(() => ({}) as Record<string, unknown>);
    if (!fromThisMachine(req) && !quáGiới(req, 'presence', 30, 60_000)) presenceBeat(body.id, body.where);
    res.writeHead(204);
    res.end();
    return;
  }

  // Thống kê trực tiếp (chủ trang): ai đang trên trang, ván online đang đánh, hàng chờ
  if (path === '/api/admin/live' && method === 'GET') {
    const user = currentUser(req);
    if (!user || !isAdmin(user)) return json(res, 403, { error: 'Không có quyền' });
    return json(res, 200, { online: presenceNow(), live: live.snapshot(), at: new Date().toISOString() });
  }

  // Bảng thống kê: chỉ chủ trang
  if (path === '/api/admin/stats' && method === 'GET') {
    const user = currentUser(req);
    if (!user || !isAdmin(user)) return json(res, 403, { error: 'Không có quyền' });
    const n = Math.min(90, Math.max(7, Number(new URL(req.url ?? '/', 'http://x').searchParams.get('days')) || 30));
    return json(res, 200, statsFor(db, n));
  }

  // Huấn luyện viên toàn trang: gộp ván của mọi người chơi, không tên — chỉ chủ trang
  if (path === '/api/admin/coach' && method === 'GET') {
    const user = currentUser(req);
    if (!user || !isAdmin(user)) return json(res, 403, { error: 'Không có quyền' });
    const n = Math.min(90, Math.max(7, Number(new URL(req.url ?? '/', 'http://x').searchParams.get('days')) || 30));
    const rp = communityReport(db, n);
    const withAdvice = new URL(req.url ?? '/', 'http://x').searchParams.get('advice') === '1';
    if (!withAdvice || !rp.facts) return json(res, 200, { ...rp, advice: null });
    const a = await advise(db, user.id, rp.facts, rp.lessons, { players: rp.players, days: rp.days });
    return json(res, 200, { ...rp, advice: a.advice, source: a.source });
  }

  /* ---- Ván chia sẻ ---- */

  if (path === '/api/share' && method === 'POST') {
    if (quáGiới(req, 'share', 20, 3600_000)) return json(res, 429, { error: 'Chia sẻ nhiều quá, thử lại sau ít phút.' });
    const body = await readJson(req, 500_000).catch(() => null);
    if (!body) return json(res, 400, { error: 'Nội dung không hợp lệ' });
    const s = parseShare(body);
    if (typeof s === 'string') return json(res, 400, { error: s });
    const id = createShare(db, s);
    if (!fromThisMachine(req)) bump(db, 'share_create');
    return json(res, 201, { id });
  }

  const chiaSẻ = /^\/api\/share\/([A-Za-z0-9_-]+)$/.exec(path);
  if (chiaSẻ && method === 'GET') {
    const s = getShare(db, chiaSẻ[1]);
    if (!s) return json(res, 404, { error: 'Không tìm thấy ván này' });
    return json(res, 200, s);
  }

  /* ---- Hồ sơ ---- */

  // Màn chào mừng và màn Hồ sơ: đổi tên gọi, chọn trình độ lần đầu
  if (path === '/api/me' && method === 'PATCH') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => null);
    if (!body) return json(res, 400, { error: 'Nội dung không hợp lệ' });
    const patch = parseProfilePatch(body);
    if (typeof patch === 'string') return json(res, 400, { error: patch });
    return json(res, 200, { user: publicUser(applyProfile(db, user, patch)) });
  }

  if (path === '/api/me/prefs' && method === 'PUT') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req, 2048).catch(() => null);
    if (!body) return json(res, 400, { error: 'Nội dung không hợp lệ' });
    const prefs = parsePrefs(body);
    if (typeof prefs === 'string') return json(res, 400, { error: prefs });
    savePrefs(db, user.id, prefs);
    return json(res, 200, { ok: true });
  }

  if (path === '/api/profile' && method === 'GET') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    return json(res, 200, {
      user: publicUser(user),
      stats: profileStats(db, user),
      ladder: botLadder(db, user.id),
      elo: eloHistory(db, user.id),
    });
  }

  // Tự xoá tài khoản. Phải gửi kèm confirm: true, để một lời gọi nhầm không xoá được.
  if (path === '/api/me' && method === 'DELETE') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Chưa đăng nhập' });
    const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    if (body.confirm !== true) return json(res, 400, { error: 'Thiếu xác nhận' });
    if (live.isPlaying(user.id)) return json(res, 409, { error: 'Đang có ván online. Chơi xong hoặc đầu hàng trước đã.' });
    live.leaveQueue(user.id);
    deleteUser(db, user.id);
    console.log(`[profile] người dùng #${user.id} đã tự xoá tài khoản`);
    return json(res, 200, { ok: true }, { 'set-cookie': clearCookie(isSecure(req)) });
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
