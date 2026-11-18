// Thống kê ẩn danh cho chủ trang: có ai dùng không, dùng gì, bỏ đi ở bước nào.
//
// Chỉ đếm con số theo ngày. Không lưu IP, không cookie, không định danh khách.
// Số liệu người dùng đăng nhập thì đọc thẳng từ các bảng đã có (users, games…),
// chỉ tính tài khoản Google thật — bỏ tài khoản thử lúc phát triển.

import { all, type Db } from './db.ts';

/** Những việc trình duyệt được phép báo đếm. Lạ thì bỏ. */
export const CLIENT_EVENTS = [
  'visit', // mở trang (một lần mỗi phiên trình duyệt)
  'play_start', // bắt đầu một ván với máy / hai người một máy
  'play_end', // ván đó kết thúc
  'share_open', // có người mở link ván được chia sẻ
  'online_queue', // bấm Tìm trận
  'assist_hold', // Trợ lý dừng máy lại vì người chơi đi hỏng
  'assist_guide', // người chơi mở hướng dẫn của Trợ lý
  'coach_open', // mở tab Huấn luyện viên
  'mini_open', // mở bàn cờ nổi
  'pwa_install', // cài app lên máy
  'lesson_page', // mở trang bài học công khai /hoc/... (thường từ Google)
] as const;

/** Việc server tự đếm. */
export const SERVER_EVENTS = ['signup', 'login', 'match_human', 'match_ai', 'share_create', 'daily'] as const;

export type StatEvent = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

/** Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. */
export function vnDay(at: Date | number | string): string {
  const t = typeof at === 'string' ? Date.parse(at) : typeof at === 'number' ? at : at.getTime();
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 10);
}

export function bump(db: Db, event: StatEvent, now: Date | number = Date.now()): void {
  db.prepare(
    'INSERT INTO daily_counts (day, event, n) VALUES (?, ?, 1) ON CONFLICT(day, event) DO UPDATE SET n = n + 1',
  ).run(vnDay(now), event);
}

export interface DayRow {
  day: string;
  visit: number;
  play_start: number;
  play_end: number;
  share_create: number;
  share_open: number;
  online_queue: number;
  assist_hold: number;
  assist_guide: number;
  coach_open: number;
  mini_open: number;
  pwa_install: number;
  lesson_page: number;
  match_human: number;
  match_ai: number;
  signup: number;
  login: number;
  /** Lượt giải bài tập của ngày (lần đầu mỗi người). */
  daily: number;
  /** Ván người đăng nhập lưu lại, theo loại. */
  games_bot: number;
  games_human: number;
  games_online: number;
  games_ai: number;
  puzzles: number;
}

export interface Stats {
  days: DayRow[];
  users: { total: number; active1: number; active7: number; active30: number };
  generatedAt: string;
}

const EMPTY = (day: string): DayRow => ({
  day,
  visit: 0,
  play_start: 0,
  play_end: 0,
  share_create: 0,
  share_open: 0,
  online_queue: 0,
  assist_hold: 0,
  assist_guide: 0,
  coach_open: 0,
  mini_open: 0,
  pwa_install: 0,
  lesson_page: 0,
  match_human: 0,
  match_ai: 0,
  signup: 0,
  login: 0,
  daily: 0,
  games_bot: 0,
  games_human: 0,
  games_online: 0,
  games_ai: 0,
  puzzles: 0,
});

/** Số liệu `n` ngày gần nhất (tính cả hôm nay), cũ trước mới sau. */
export function statsFor(db: Db, n = 30, now: Date = new Date()): Stats {
  const days: DayRow[] = [];
  for (let i = n - 1; i >= 0; i--) days.push(EMPTY(vnDay(now.getTime() - i * 86400_000)));
  const byDay = new Map(days.map((d) => [d.day, d]));
  const from = days[0].day;
  // Mốc thời gian (UTC) của 0 giờ ngày đầu tiên theo giờ Việt Nam
  const fromIso = new Date(Date.parse(`${from}T00:00:00Z`) - 7 * 3600_000).toISOString();

  for (const r of all<{ day: string; event: string; n: number }>(
    db,
    'SELECT day, event, n FROM daily_counts WHERE day >= ?',
    from,
  )) {
    const d = byDay.get(r.day);
    if (d && r.event in d && r.event !== 'day') (d as unknown as Record<string, number>)[r.event] += r.n;
  }

  // Ván của người dùng thật (tài khoản Google), theo loại
  for (const g of all<{ created_at: string; mode: string; opponent_name: string | null }>(
    db,
    `SELECT g.created_at, g.mode, g.opponent_name FROM games g JOIN users u ON u.id = g.user_id
      WHERE u.google_sub IS NOT NULL AND g.created_at >= ?`,
    fromIso,
  )) {
    const d = byDay.get(vnDay(g.created_at));
    if (!d) continue;
    if (g.mode === 'bot') d.games_bot++;
    else if (g.mode === 'human') d.games_human++;
    else if (g.opponent_name?.endsWith(' (AI)')) d.games_ai++;
    else d.games_online++;
  }

  for (const p of all<{ created_at: string }>(
    db,
    `SELECT p.created_at FROM puzzle_attempts p JOIN users u ON u.id = p.user_id
      WHERE u.google_sub IS NOT NULL AND p.created_at >= ?`,
    fromIso,
  )) {
    const d = byDay.get(vnDay(p.created_at));
    if (d) d.puzzles++;
  }

  const t = now.getTime();
  const count = (sinceMs: number) =>
    all<{ n: number }>(
      db,
      'SELECT count(*) AS n FROM users WHERE google_sub IS NOT NULL AND last_seen_at >= ?',
      new Date(t - sinceMs).toISOString(),
    )[0]?.n ?? 0;
  const total = all<{ n: number }>(db, 'SELECT count(*) AS n FROM users WHERE google_sub IS NOT NULL')[0]?.n ?? 0;

  return {
    days,
    users: { total, active1: count(86400_000), active7: count(7 * 86400_000), active30: count(30 * 86400_000) },
    generatedAt: now.toISOString(),
  };
}
