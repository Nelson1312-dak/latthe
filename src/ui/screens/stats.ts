// Bảng thống kê cho chủ trang (#/thong-ke). Chỉ tài khoản trong ADMIN_USER_IDS xem được.
//
// Trả lời ba câu: có ai vào không, họ làm gì, bỏ đi ở bước nào. Số liệu ẩn
// danh: lượt đếm theo ngày, không biết ai là ai.

import { auth } from '../../app/session.ts';
import { MOTIF_NAME, type Advice, type CoachFacts } from '../../../shared/coach.ts';
import { icon } from '../icons.ts';
import { notice, rule } from '../components/index.ts';

interface DayRow {
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
  games_bot: number;
  games_human: number;
  games_online: number;
  games_ai: number;
  puzzles: number;
}
interface Stats {
  days: DayRow[];
  users: { total: number; active1: number; active7: number; active30: number };
  generatedAt: string;
}

let data: Stats | null = null;
let error: string | null = null;
let loading = false;

/** Huấn luyện viên toàn trang: gộp ván của mọi người chơi (không tên), AI đọc và nhận xét. */
interface Community {
  days: number;
  players: number;
  pending: number;
  facts: CoachFacts | null;
  lessons: { id: string; title: string; keyPoint: string }[];
  advice: Advice | null;
  source?: string;
}
let cộngĐồng: Community | null = null;
let cộngĐồngĐang = false;

/** Trực tiếp: ai đang trên trang, ván online đang đánh, hàng chờ. Tự hỏi lại mỗi 15 giây. */
interface Live {
  online: { total: number; byWhere: Record<string, number> };
  live: { games: number; vsAi: number; queue: number };
  at: string;
}
let trựcTiếp: Live | null = null;
let nhịp: ReturnType<typeof setInterval> | null = null;
let lầnNhịp = 0;
let ngheẨnHiện = false;
const NHỊP_MS = 15_000;

function hỏiTrựcTiếp(rerender: () => void): void {
  void fetch('/api/admin/live', { credentials: 'same-origin' })
    .then(async (r) => {
      if (r.ok) trựcTiếp = (await r.json()) as Live;
    })
    .catch(() => {})
    .finally(rerender);
}

/** Lấy số theo ngày (không xoá số cũ trên màn trong lúc chờ: tự cập nhật thì không nháy). */
function hỏiSốNgày(rerender: () => void): void {
  void fetch('/api/admin/stats?days=30', { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error(r.status === 403 ? 'Không có quyền xem' : `Lỗi ${r.status}`);
      data = (await r.json()) as Stats;
      error = null;
    })
    .catch((e: Error) => {
      if (!data) error = e.message;
    })
    .finally(() => {
      loading = false;
      rerender();
    });
}

/**
 * Đang mở trang Thống kê thì tự cập nhật: trực tiếp mỗi 15 giây, số theo ngày mỗi
 * phút. Rời trang là thôi (không hỏi server khi không ai xem).
 */
function tựCậpNhật(rerender: () => void): void {
  if (nhịp) return;
  nhịp = setInterval(() => {
    if (!location.hash.startsWith('#/thong-ke') || !auth.user?.admin) {
      clearInterval(nhịp!);
      nhịp = null;
      return;
    }
    // Tab đang ẩn thì thôi, quay lại là hỏi ngay (visibilitychange bên dưới)
    if (document.visibilityState !== 'visible') return;
    lầnNhịp++;
    hỏiTrựcTiếp(rerender);
    if (lầnNhịp % 4 === 0) hỏiSốNgày(rerender);
  }, NHỊP_MS);
  if (ngheẨnHiện) return;
  ngheẨnHiện = true;
  document.addEventListener('visibilitychange', () => {
    if (nhịp && document.visibilityState === 'visible') {
      hỏiTrựcTiếp(rerender);
      hỏiSốNgày(rerender);
    }
  });
}

export function mountStats(rerender: () => void): void {
  if (!auth.user?.admin) return;
  if (!nhịp) {
    tựCậpNhật(rerender);
    hỏiTrựcTiếp(rerender);
  }
  if (loading || data) return;
  loading = true;
  // Phần AI chậm hơn (mô hình có thể phải nạp): xin riêng, không bắt cả trang chờ
  cộngĐồngĐang = true;
  void fetch('/api/admin/coach?days=30&advice=1', { credentials: 'same-origin' })
    .then(async (r) => {
      cộngĐồng = r.ok ? ((await r.json()) as Community) : null;
    })
    .catch(() => {
      cộngĐồng = null;
    })
    .finally(() => {
      cộngĐồngĐang = false;
      rerender();
    });
  hỏiSốNgày(rerender);
}

/** Bấm "Tải lại" thì xin số mới. */
export function refreshStats(rerender: () => void): void {
  data = null;
  error = null;
  cộngĐồng = null;
  hỏiTrựcTiếp(rerender);
  mountStats(rerender);
}

const sum = (rows: DayRow[], k: keyof DayRow) => rows.reduce((a, r) => a + (r[k] as number), 0);

/** Khối trực tiếp ở đầu trang: lúc này có ai, đang làm gì. */
function liveBlock(): string {
  const t = trựcTiếp;
  if (!t) return `<div class="live-strip is-loading"><p class="muted">Đang hỏi số trực tiếp…</p></div>`;
  const w = t.online.byWhere;
  const học = (w['hoc'] ?? 0) + (w['on-tap'] ?? 0) + (w['huan-luyen'] ?? 0);
  const ô = (v: number, nhãn: string, nhỏ = '') =>
    `<div class="live-cell"><b class="mono">${fmt(v)}</b><span>${nhãn}</span>${nhỏ ? `<small>${nhỏ}</small>` : ''}</div>`;
  return `<div class="live-strip">
      <div class="live-cell live-main"><span class="live-dot" aria-hidden="true"></span><b class="mono">${fmt(t.online.total)}</b><span>đang mở trang</span></div>
      ${ô(w['choi'] ?? 0, 'ở tab Chơi')}
      ${ô(t.live.games, 'ván online đang đánh', t.live.vsAi ? `${t.live.vsAi} ván với AI` : '')}
      ${ô(t.live.queue, 'đang chờ ghép')}
      ${ô(học, 'đang học / ôn tập')}
    </div>
    <p class="muted live-note">Trực tiếp · tự cập nhật mỗi 15 giây · lúc ${new Date(t.at).toLocaleTimeString('vi-VN')}. Tính cả chính bạn nếu đang mở latbai.vn.</p>`;
}

/** Các tính năng mới: có ai dùng không (7 ngày). */
function featureBlock(last7: DayRow[]): string {
  return `${rule('Tính năng mới · 7 ngày')}
    <div class="stat-tiles">
      ${tile(sum(last7, 'assist_hold'), 'Trợ lý dừng máy', `${sum(last7, 'assist_guide')} lần mở hướng dẫn`)}
      ${tile(sum(last7, 'coach_open'), 'Mở Huấn luyện viên', 'lượt mở tab')}
      ${tile(sum(last7, 'lesson_page'), 'Xem trang bài học', 'latbai.vn/hoc — thường từ Google')}
      ${tile(sum(last7, 'mini_open'), 'Mở bàn cờ nổi', 'cửa sổ nhỏ trên máy tính')}
      ${tile(sum(last7, 'pwa_install'), 'Cài app lên máy', 'từ nút trong Cài đặt / trình duyệt')}
      ${tile(sum(last7, 'online_queue'), 'Bấm Tìm trận', `ghép người: ${sum(last7, 'match_human')} · AI: ${sum(last7, 'match_ai')}`)}
    </div>`;
}
const fmt = (n: number) => n.toLocaleString('vi-VN');
const dm = (day: string) => `${Number(day.slice(8, 10))}/${Number(day.slice(5, 7))}`;

/**
 * Người chơi trên trang hay sai gì: gộp tóm tắt lỗi của mọi ván đã chấm (máy chủ
 * tự chấm cả ván người chơi bỏ dở), AI đọc và gợi ý nên đẩy bài học nào. Không
 * có tên ai, không có ván cụ thể nào.
 */
function communityBlock(): string {
  const head = rule('Người chơi hay sai gì · 30 ngày', '<span class="rule-note">AI đọc ván của mọi người, không tên</span>');
  if (cộngĐồngĐang && !cộngĐồng) return head + notice('AI đang đọc ván của mọi người chơi…', 'info', 'coach');
  const c = cộngĐồng;
  if (!c?.facts) return head + notice('Chưa có ván nào được chấm trong 30 ngày.', 'info', 'coach');
  const f = c.facts;
  const tốiĐa = Math.max(1, ...f.motifs.map((m) => m.count));
  const từAI = c.source === 'llm' || c.source === 'cache';
  return `${head}
    ${c.advice ? `<p class="coach-text">${c.advice.nhanXet.replace(/[<>&]/g, '')}</p>
      <p class="coach-src">${từAI ? 'AI viết từ số liệu gộp' : 'Viết sẵn từ số liệu gộp'}</p>` : ''}
    <div class="stat-tiles">
      ${tile(c.players, 'Người chơi có ván đã chấm', `${fmt(f.games)} ván`)}
      ${tile(f.accuracy, 'Độ chính xác trung bình (%)', 'mọi nước của người chơi')}
      ${tile(f.perGame.blunder, 'Sai nghiêm trọng mỗi ván', `sai: ${f.perGame.mistake}`)}
    </div>
    ${c.pending ? `<p class="muted">Máy chủ còn ${c.pending} ván trong 30 ngày chưa chấm xong — số liệu sẽ đủ dần.</p>` : ''}
    <div class="coach-mistakes">${f.motifs
      .slice(0, 6)
      .map(
        (m) =>
          `<div class="coach-mistake"><div class="coach-mistake-top"><b class="mono">${m.count}</b>` +
          `<span>lần ${MOTIF_NAME[m.kind]}</span><small>trong ${m.games} ván</small></div>` +
          `<span class="acc-bar"><i style="width:${Math.round((m.count / tốiĐa) * 100)}%"></i></span></div>`,
      )
      .join('')}</div>
    ${
      c.lessons.length
        ? `<p class="label">Bài học người chơi cần nhất</p>
           <div class="quick-list">${c.lessons
             .map(
               (l, i) =>
                 `<a class="quick" href="/hoc/" target="_blank" rel="noopener"><span class="quick-icon">${icon('learn', 20)}</span>` +
                 `<span class="quick-text"><b>${l.title}</b><span>${(c.advice?.loTrinh[i] ?? l.keyPoint).replace(/[<>&]/g, '')}</span></span>${icon('next', 16)}</a>`,
             )
             .join('')}</div>`
        : ''
    }`;
}

/** Ô số liệu: con số to, nhãn, so với kỳ trước. */
function tile(value: number, label: string, note: string): string {
  return `<div class="stat-tile"><b class="mono">${fmt(value)}</b><span>${label}</span><small>${note}</small></div>`;
}

/**
 * Biểu đồ cột theo ngày, một chuỗi số liệu, một trục. Cột mảnh (tối đa 24px),
 * đầu bo 4px, đáy vuông; lưới mờ; nhãn trục bằng màu chữ, không bằng màu cột.
 * Rê chuột vào cột hiện ngày và số (title của SVG). Bảng số đầy đủ ở dưới.
 */
function barChart(rows: DayRow[], key: keyof DayRow, title: string, unit: string): string {
  const W = 640;
  const H = 180;
  const pad = { l: 32, r: 8, t: 12, b: 24 };
  const vals = rows.map((r) => r[key] as number);
  const max = Math.max(1, ...vals);
  // Vạch trục tròn số: 0, nửa, đỉnh
  const step = Math.max(1, Math.ceil(max / 2));
  const top = step * 2;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / rows.length;
  const bw = Math.min(24, Math.max(3, slot - 2));
  const y = (v: number) => pad.t + ih - (v / top) * ih;

  const grid = [0, step, top]
    .map(
      (v) =>
        `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="chart-grid"/>` +
        `<text x="${pad.l - 6}" y="${y(v)}" class="chart-tick" text-anchor="end" dominant-baseline="middle">${fmt(v)}</text>`,
    )
    .join('');
  const bars = rows
    .map((r, i) => {
      const v = r[key] as number;
      const x = pad.l + i * slot + (slot - bw) / 2;
      const h = (v / top) * ih;
      const r4 = Math.min(4, h / 2, bw / 2);
      // Đầu bo 4px, chân vuông, mọc từ đường đáy
      const path =
        h <= 0
          ? ''
          : `M${x},${pad.t + ih} V${pad.t + ih - h + r4} Q${x},${pad.t + ih - h} ${x + r4},${pad.t + ih - h} ` +
            `H${x + bw - r4} Q${x + bw},${pad.t + ih - h} ${x + bw},${pad.t + ih - h + r4} V${pad.t + ih} Z`;
      // Vùng rê chuột rộng hơn cột cho dễ trỏ
      return (
        `<g class="chart-bar"><title>${dm(r.day)}: ${fmt(v)} ${unit}</title>` +
        `<rect x="${pad.l + i * slot}" y="${pad.t}" width="${slot}" height="${ih}" fill="transparent"/>` +
        (path ? `<path d="${path}" class="chart-mark"/>` : '') +
        `</g>`
      );
    })
    .join('');
  // Nhãn ngày: chỉ vài mốc, không ghi hết
  const ticks = rows
    .map((r, i) =>
      // Mốc mỗi tuần và hôm nay; bỏ mốc tuần nếu sát hôm nay quá (chữ chồng nhau)
      (i % 7 === 0 && rows.length - 1 - i >= 4) || i === rows.length - 1
        ? `<text x="${pad.l + i * slot + slot / 2}" y="${H - 6}" class="chart-tick" text-anchor="middle">${dm(r.day)}</text>`
        : '',
    )
    .join('');
  const last = vals[vals.length - 1];
  return `<figure class="chart">
    <figcaption><b>${title}</b><span>hôm nay <b class="mono">${fmt(last)}</b> · 30 ngày <b class="mono">${fmt(sum(rows, key))}</b></span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} theo ngày, 30 ngày gần nhất">${grid}${bars}${ticks}</svg>
  </figure>`;
}

/** Phễu 30 ngày: từ lượt vào tới đăng ký. Thanh ngang, tỉ lệ so với bước đầu. */
function funnel(rows: DayRow[]): string {
  const steps: [string, number][] = [
    ['Lượt vào trang', sum(rows, 'visit')],
    ['Bắt đầu một ván', sum(rows, 'play_start') + sum(rows, 'online_queue')],
    ['Chơi xong một ván', sum(rows, 'play_end') + sum(rows, 'match_human') + sum(rows, 'match_ai')],
    ['Tạo tài khoản', sum(rows, 'signup')],
  ];
  const đầu = Math.max(1, steps[0][1]);
  return `<div class="funnel">${steps
    .map(([name, v]) => {
      const pct = Math.round((v / đầu) * 100);
      return `<div class="funnel-row"><span>${name}</span><span class="funnel-bar"><i style="width:${Math.max(1, Math.min(100, pct))}%"></i></span><b class="mono">${fmt(v)}</b><small class="mono">${pct}%</small></div>`;
    })
    .join('')}</div>`;
}

export function stats(): string {
  const head = `<div class="screen-head"><h1>Thống kê</h1><span class="head-meta">ẩn danh · giờ Việt Nam</span>
    <div class="toolbar"><button class="btn btn-secondary" data-stats-refresh><span>Tải lại</span></button></div></div>`;
  if (!auth.user) return `<div class="screen screen-narrow">${head}${notice('Đăng nhập bằng tài khoản quản trị để xem.', 'locked', 'user')}</div>`;
  if (!auth.user.admin) return `<div class="screen screen-narrow">${head}${notice('Trang này chỉ dành cho chủ trang.', 'locked', 'user')}</div>`;
  if (error) return `<div class="screen screen-narrow">${head}${notice(error, 'danger')}</div>`;
  if (!data) return `<div class="screen screen-narrow">${head}${notice('Đang lấy số liệu…', 'info', 'clock')}</div>`;

  const d = data.days;
  const today = d[d.length - 1];
  const last7 = d.slice(-7);
  const prev7 = d.slice(-14, -7);
  const so = (k: keyof DayRow) => {
    const a = sum(last7, k);
    const b = sum(prev7, k);
    if (!b) return a ? 'tuần trước: 0' : '7 ngày';
    const diff = Math.round(((a - b) / b) * 100);
    return `${diff >= 0 ? '+' : ''}${diff}% so với tuần trước`;
  };
  const games7 = sum(last7, 'play_end') + sum(last7, 'match_human') + sum(last7, 'match_ai');

  // Chỉ những ngày có hoạt động: 30 dòng toàn số 0 thì không ai đọc
  const keys = Object.keys(d[0]).filter((k) => k !== 'day') as (keyof DayRow)[];
  const cóViệc = [...d].reverse().filter((r) => keys.some((k) => (r[k] as number) > 0));
  const rowsHtml = cóViệc
    .map(
      (r) =>
        `<tr><td>${dm(r.day)}</td><td>${r.visit}</td><td>${r.play_start}</td><td>${r.play_end}</td>` +
        `<td>${r.match_ai}</td><td>${r.match_human}</td><td>${r.assist_hold}</td><td>${r.share_create}</td>` +
        `<td>${r.share_open}</td><td>${r.signup}</td><td>${r.puzzles}</td></tr>`,
    )
    .join('');

  return `<div class="screen screen-narrow stats-screen">
    ${head}
    ${liveBlock()}
    <p class="muted">Hôm nay ${dm(today.day)} · cập nhật lúc ${new Date(data.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
    <div class="stat-tiles">
      ${tile(sum(last7, 'visit'), 'Lượt vào · 7 ngày', so('visit'))}
      ${tile(games7, 'Ván đã chơi · 7 ngày', 'với máy, AI và người')}
      ${tile(sum(last7, 'signup'), 'Tài khoản mới · 7 ngày', `tổng ${fmt(data.users.total)} tài khoản`)}
      ${tile(data.users.active7, 'Người dùng hoạt động · 7 ngày', `hôm nay ${data.users.active1}`)}
      ${tile(sum(last7, 'match_ai'), 'Ván đấu với AI · 7 ngày', `với người: ${sum(last7, 'match_human')}`)}
      ${tile(sum(last7, 'share_create'), 'Ván được chia sẻ · 7 ngày', `${sum(last7, 'share_open')} lượt mở link`)}
    </div>
    ${barChart(d, 'visit', 'Lượt vào trang', 'lượt')}
    ${barChart(d, 'play_end', 'Ván chơi xong (với máy, hai người)', 'ván')}
    ${featureBlock(last7)}
    ${rule('Phễu 30 ngày')}
    ${funnel(d)}
    ${communityBlock()}
    ${rule('Từng ngày')}
    <div class="table-wrap"><table class="stats-table">
      <thead><tr><th>Ngày</th><th>Vào</th><th>Bắt đầu ván</th><th>Xong ván</th><th>Với AI</th><th>Với người</th><th>Trợ lý dừng</th><th>Chia sẻ</th><th>Mở link</th><th>Đăng ký</th><th>Bài tập</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="11">Chưa có hoạt động nào trong 30 ngày.</td></tr>'}</tbody>
    </table></div>
    ${cóViệc.length < d.length ? `<p class="muted">Ẩn ${d.length - cóViệc.length} ngày không có hoạt động.</p>` : ''}
    <p class="muted">Chỉ đếm số lượt theo ngày — không lưu IP, không cookie, không biết ai là ai. Tài khoản thử lúc phát triển không được tính.</p>
  </div>`;
}
