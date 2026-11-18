// Tab Huấn luyện viên: nhìn cả lịch sử ván của bạn (không phải từng ván) để nói
// lỗi bạn hay lặp lại, kèm ví dụ bấm vào xem đúng nước đó, và lộ trình học.
//
// Số liệu do code tính từ kết quả Stockfish chấm (máy chủ tự chấm cả ván cũ,
// xem server/analyst.ts). AI chỉ viết lời nhận xét từ đúng số liệu đó; máy chủ
// kiểm chặt, viết sai là dùng lời viết sẵn.

import { auth } from '../../app/session.ts';
import { ping } from '../../app/ping.ts';
import { invalidateCoach, loadAdvice, loadCoach, type AdviceData, type CoachData } from '../../app/coach.ts';
import { MOTIF_NAME } from '../../../shared/coach.ts';
import { esc, notice, rule } from '../components/index.ts';
import { icon } from '../icons.ts';

let data: CoachData | null = null;
let advice: AdviceData | null = null;
let loading = false;
let adviceLoading = false;
let hỏiLúc = 0;

export function resetCoach(): void {
  data = null;
  advice = null;
  hỏiLúc = 0;
}

export function mountCoach(rerender: () => void): void {
  if (!auth.user) return;
  if (Date.now() - hỏiLúc < 10_000) return;
  if (!hỏiLúc) ping('coach_open');
  hỏiLúc = Date.now();
  loading = !data;
  void loadCoach().then((c) => {
    data = c;
    loading = false;
    rerender();
    if (!c?.facts) return;
    adviceLoading = !advice;
    rerender();
    void loadAdvice().then((a) => {
      advice = a;
      adviceLoading = false;
      rerender();
    });
  });
}

/** Bấm "Xem lại" khi máy chủ đã chấm thêm ván: lấy số mới. */
export function handleCoachClick(target: HTMLElement, rerender: () => void): boolean {
  if (target.closest('[data-coach-refresh]')) {
    invalidateCoach();
    hỏiLúc = 0;
    mountCoach(rerender);
    return true;
  }
  return false;
}

const tile = (value: string, label: string, note = '') =>
  `<div class="fact"><dt>${label}</dt><dd><b class="mono">${value}</b>${note ? `<small>${note}</small>` : ''}</dd></div>`;

function head(meta = ''): string {
  return `<div class="screen-head"><h1>Huấn luyện viên</h1><span class="head-meta">${meta}</span></div>`;
}

export function coachScreen(): string {
  if (!auth.user) {
    return `<div class="screen screen-narrow">${head()}
      <div class="coach-empty">
        <span class="coach-empty-icon">${icon('coach', 32)}</span>
        <p><b>Đăng nhập để có Huấn luyện viên riêng.</b> Đọc các ván của bạn, chỉ ra lỗi hay lặp lại và bài nên học.</p>
        <button class="btn btn-primary" data-go="tai-khoan">${icon('user', 17)}<span>Đăng nhập</span></button>
      </div></div>`;
  }
  if (loading || !data) {
    return `<div class="screen screen-narrow">${head()}${notice('Đang đọc các ván của bạn…', 'info', 'clock')}</div>`;
  }
  const d = data;
  const đangChấm = d.pending
    ? `<p class="coach-pending">${icon('engine', 16)}<span>Đang chấm thêm <b>${d.pending}</b> ván cũ.</span>
        <button class="link-btn" data-coach-refresh>Cập nhật</button></p>`
    : '';

  if (!d.facts) {
    return `<div class="screen screen-narrow">${head()}
      <div class="coach-empty">
        <span class="coach-empty-icon">${icon('coach', 32)}</span>
        <p><b>Chơi thêm ${d.need} ván</b> để Huấn luyện viên có đủ dữ liệu.</p>
        <button class="btn btn-primary" data-go="choi">${icon('play', 17)}<span>Chơi một ván</span></button>
      </div>
      ${đangChấm}</div>`;
  }

  const f = d.facts;
  const a = advice?.advice;
  const từAI = advice?.source === 'llm' || advice?.source === 'cache';

  return `<div class="screen screen-narrow coach-screen">
    ${head(`${f.games} ván gần nhất`)}

    <section class="coach-say">
      <p class="coach-text${a ? '' : ' is-typing'}">${
        a ? esc(a.nhanXet) : adviceLoading ? 'Huấn luyện viên đang đọc các ván của bạn' : 'Chưa viết được nhận xét lúc này.'
      }</p>
      <p class="coach-src">${
        a
          ? từAI
            ? 'AI viết từ số liệu engine'
            : 'Viết sẵn từ số liệu engine'
          : ''
      }</p>
    </section>
    ${đangChấm}

    <dl class="facts">
      ${tile(`${f.accuracy}%`, 'Độ chính xác trung bình')}
      ${tile(`${f.wins}/${f.draws}/${f.losses}`, 'Thắng / Hòa / Thua')}
      ${tile(String(f.perGame.blunder), 'Sai nghiêm trọng mỗi ván')}
    </dl>

    ${
      f.phases.length
        ? `${rule('Theo giai đoạn')}
           <div class="coach-phases">${f.phases
             .map(
               (p) =>
                 `<div class="coach-phase"><span>${p.name[0].toUpperCase() + p.name.slice(1)}</span>` +
                 `<span class="acc-bar"><i style="width:${Math.max(2, p.accuracy)}%"></i></span><b class="mono">${p.accuracy}%</b></div>`,
             )
             .join('')}</div>`
        : ''
    }

    ${rule('Lỗi bạn hay lặp lại')}
    ${
      f.motifs.length
        ? `<div class="coach-mistakes">${f.motifs
            .slice(0, 5)
            .map((m) => {
              const ví = f.examples[m.kind];
              return (
                `<div class="coach-mistake"><div class="coach-mistake-top"><b class="mono">${m.count}</b>` +
                `<span>lần ${MOTIF_NAME[m.kind]}</span><small>trong ${m.games} ván</small></div>` +
                (ví
                  ? `<a class="coach-example" href="#/xem-lai?game=${ví.gameId}&ply=${ví.ply}">` +
                    `<span>Xem lần gần nhất: nước ${Math.ceil(ví.ply / 2)}${ví.ply % 2 ? '.' : '...'} ${esc(ví.san)}</span></a>`
                  : '') +
                `</div>`
              );
            })
            .join('')}</div>`
        : `<p class="muted">Chưa có lỗi nào lặp lại.</p>`
    }

    ${rule('Lộ trình gợi ý')}
    <div class="quick-list">${d.lessons
      .map((l, i) => {

        return (
          `<a class="quick" href="#/hoc?bai=${l.id}"><span class="quick-icon">${icon('learn', 20)}</span>` +
          `<span class="quick-text"><b>${i + 1}. ${esc(l.title)}</b><span>${esc(a?.loTrinh[i] ?? l.keyPoint)}</span></span>${icon('next', 16)}</a>`
        );
      })
      .join('')}</div>

  </div>`;
}
