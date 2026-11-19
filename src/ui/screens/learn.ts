// Lộ trình bài học: đi từ "ăn quân cho đúng" tới tàn cuộc.
//
// Mỗi bài là một phần giải thích ngắn cộng vài bài tập thật lấy từ kho Lichess
// theo đúng chủ đề đang dạy.

import { CHAPTERS, LESSONS, type Lesson } from '../../training/lessons.ts';
import { loadCoach, type CoachData } from '../../app/coach.ts';
import { MOTIF_NAME } from '../../../shared/coach.ts';
import { doneLessons } from '../../app/training.ts';
import { auth } from '../../app/session.ts';
import { icon } from '../icons.ts';
import { button, notice, rule, sheet } from '../components/index.ts';
import { startLesson } from './train.ts';

let done = new Set<string>();
let daHoi = false;

/** Huấn luyện viên: bài nên học trước, theo lỗi bạn hay lặp lại. */
let coach: CoachData | null = null;

export function mountLearn(rerender: () => void): void {
  if (daHoi) return;
  daHoi = true;
  void doneLessons().then((r) => {
    done = new Set(r.done);
    rerender();
  });
  void loadCoach().then((c) => {
    coach = c;
    if (c?.lessons.length) rerender();
  });
}

export function resetLearn(): void {
  done = new Set();
  coach = null;
  daHoi = false;
}

/** Bài đầu tiên chưa học xong — chỗ nên tiếp tục. */
function nextUp(): Lesson | undefined {
  return LESSONS.find((l) => !done.has(l.id));
}

export function learn(): string {
  const tiep = nextUp();
  const xong = LESSONS.filter((l) => done.has(l.id)).length;

  const gợiÝ = new Set((coach?.lessons ?? []).map((l) => l.id));
  const lỗi = coach?.facts?.motifs[0];
  const row = (l: Lesson) => {
    const đãXong = done.has(l.id);
    return `<button class="lesson-row${đãXong ? ' is-done' : ''}" data-lesson="${l.id}" title="${l.keyPoint}">
      <span class="lesson-mark">${đãXong ? icon('check', 18) : ''}</span>
      <span class="lesson-text">
        <b>${l.title}${gợiÝ.has(l.id) ? ' <span class="tag tag-coach">gợi ý</span>' : ''}</b>
      </span>
      <span class="lesson-count mono">${l.count} bài</span>
    </button>`;
  };

  return `<div class="screen screen-narrow">
    <div class="screen-head">
      <h1>Học</h1>
      <span class="head-meta">${xong}/${LESSONS.length} bài đã xong</span>
      ${tiep ? button({ label: 'Học tiếp', kind: 'primary', icon: 'play' }) : ''}
    </div>

    ${auth.user ? '' : notice('Đăng nhập để lưu bài đã học.', 'locked', 'user')}

    ${
      coach?.lessons.length
        ? `<a class="coach-banner" href="#/huan-luyen">
            <span class="quick-icon">${icon('coach', 20)}</span>
            <span class="quick-text"><b>Nên học trước: ${coach.lessons.map((l) => l.title).join(' · ')}</b>
              <span>${lỗi ? `Bạn hay ${MOTIF_NAME[lỗi.kind]} (${lỗi.count} lần)` : 'Theo các ván gần đây'}</span></span>
            ${icon('next', 16)}
          </a>`
        : ''
    }

    ${CHAPTERS.map((ch) => {
      const trong = LESSONS.filter((l) => l.chapter === ch);
      const sốXong = trong.filter((l) => done.has(l.id)).length;
      return `${rule(ch, `<span class="rule-note">${sốXong}/${trong.length}</span>`)}
        ${sheet(`<div class="lesson-list">${trong.map(row).join('')}</div>`)}`;
    }).join('')}
  </div>`;
}

export function handleLearnClick(target: HTMLElement): boolean {
  const pick = target.closest<HTMLElement>('[data-lesson]');
  if (pick) {
    const l = LESSONS.find((x) => x.id === pick.dataset.lesson);
    if (l) {
      startLesson(l);
      location.hash = '#/on-tap';
    }
    return true;
  }

  const btn = target.closest<HTMLButtonElement>('button');
  if (btn && (btn.textContent?.trim() ?? '').includes('Học tiếp')) {
    const l = nextUp();
    if (l) {
      startLesson(l);
      location.hash = '#/on-tap';
    }
    return true;
  }
  return false;
}
