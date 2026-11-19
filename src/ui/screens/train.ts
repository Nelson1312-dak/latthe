// Ôn tập: thẻ lỗi của chính mình trước, rồi bài tập từ kho Lichess.
//
// Thẻ lỗi quan trọng hơn bài tập chung: đó là chỗ bạn thật sự đã sai.

import { boardSvg } from '../../board/Board.ts';
import { answerDaily } from '../../app/daily.ts';
import { BoardView } from '../../board/BoardView.ts';
import { Game, type Side, type Square } from '../../../shared/chess.ts';
import { playSound } from '../../app/sound.ts';
import { auth } from '../../app/session.ts';
import {
  answerCard,
  answerPuzzle,
  dueCards,
  nextPuzzle,
  themeName,
  type Card,
  type Puzzle,
} from '../../app/training.ts';
import { button, figurine, notice, rule, sheet, stats, toolbar } from '../components/index.ts';
import { markLessonDone } from '../../app/training.ts';
import { LESSONS, type Lesson } from '../../training/lessons.ts';

/** Bài kế tiếp trong lộ trình. */
function nextLessonAfter(id?: string): Lesson | null {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LESSONS.length ? LESSONS[i + 1] : null;
}

type Kind = 'card' | 'puzzle';
type Phase = 'loading' | 'solving' | 'wrong' | 'solved' | 'empty';

interface Task {
  kind: Kind;
  /** Ván dùng để đi thử; đã đi sẵn nước của đối phương nếu là bài tập. */
  game: Game;
  /** Bên người học cầm. */
  side: Side;
  /** Các nước phải đi, dạng UCI. */
  solution: string[];
  /** Đã đi đúng mấy nước trong lời giải. */
  step: number;
  label: string;
  rating?: number;
  card?: Card;
  puzzle?: Puzzle;
}

let phase: Phase = 'loading';
let task: Task | null = null;
let view: BoardView | null = null;
let queue: Card[] = [];
let cardCount = { total: 0, due: 0 };
let theme: string | undefined;
let hintShown = false;
let khoBai = 0;
let doneToday = 0;
let lastResult: { correct: boolean; text: string } | null = null;
let loadedOnce = false;
/** Đang học một bài: lấy bài tập theo chủ đề của bài đó. */
let lesson: Lesson | null = null;
let lessonDone = 0;
let lessonIntroShown = false;

/** Bắt đầu một bài học; màn Ôn tập sẽ chạy bài tập của bài đó. */
export function startLesson(l: Lesson): void {
  lesson = l;
  lessonDone = 0;
  lessonIntroShown = false;
  theme = l.theme;
  queue = [];
  loadedOnce = false;
}

/** Bài tập người dùng vừa bấm ở Sảnh; mở đúng bài đó chứ không bốc bài khác. */
let handedPuzzle: Puzzle | null = null;
/** Id bài tập của ngày đang giải (để ghi kết quả và báo chuỗi ngày). */
let dailyId: string | null = null;

/** Mở bài tập của ngày. */
export function startDaily(p: Puzzle): void {
  startPuzzle(p);
  dailyId = p.id;
}

export function startPuzzle(p: Puzzle): void {
  handedPuzzle = p;
  lesson = null;
  theme = undefined;
  loadedOnce = false;
}

/** Thoát chế độ bài học, quay về ôn tập bình thường. */
function exitLesson(): void {
  lesson = null;
  theme = undefined;
  loadedOnce = false;
}

/* ---------------- Lấy việc tiếp theo ---------------- */

async function loadNext(rerender: () => void): Promise<void> {
  phase = 'loading';
  hintShown = false;
  lastResult = null;
  rerender();

  // Thẻ lỗi của mình luôn được ưu tiên — trừ khi đang học một bài cụ thể, hoặc
  // vừa bấm vào một bài cụ thể ở Sảnh
  if (!lesson && !handedPuzzle && !queue.length && auth.user) {
    const r = await dueCards();
    queue = r.cards;
    cardCount = { total: r.total, due: r.due };
  }

  const card = handedPuzzle ? undefined : queue.shift();
  if (card) {
    const game = new Game(card.fen);
    task = {
      kind: 'card',
      game,
      side: game.turn,
      solution: [card.best_uci],
      step: 0,
      label: 'Lỗi của bạn — tìm nước tốt hơn',
      card,
    };
    phase = 'solving';
    rerender();
    return;
  }

  const r = handedPuzzle ? { puzzle: handedPuzzle, kho: khoBai } : await nextPuzzle(theme);
  handedPuzzle = null;
  khoBai = r.kho;
  if (!r.puzzle) {
    phase = 'empty';
    rerender();
    return;
  }
  // Nước đầu trong dữ liệu Lichess là của đối phương; đi sẵn rồi mới tới lượt người học
  const game = new Game(r.puzzle.fen);
  const first = r.puzzle.moves[0];
  game.move(first.slice(0, 2) as Square, first.slice(2, 4) as Square, first[4]);
  task = {
    kind: 'puzzle',
    game,
    side: game.turn,
    solution: r.puzzle.moves.slice(1),
    step: 0,
    label: r.puzzle.id === dailyId ? 'Bài tập của ngày' : (r.puzzle.themes.map(themeName)[0] ?? 'Bài tập'),
    rating: r.puzzle.rating,
    puzzle: r.puzzle,
  };
  phase = 'solving';
  rerender();
}

/* ---------------- Chấm một nước ---------------- */

function onMove(from: Square, to: Square, rerender: () => void): boolean {
  if (!task || phase !== 'solving') return false;
  const want = task.solution[task.step];
  if (!want) return false;

  const played = `${from}${to}`;
  // Phong cấp: dữ liệu ghi cả quân phong, so sánh phần ô trước
  const đúng = want.slice(0, 4) === played;
  if (!đúng) {
    const probe = task.game.move(from, to, want[4]);
    if (!probe) return false; // nước không hợp lệ: coi như chưa đi gì
    task.game.undo();
    playSound('wrong');
    phase = 'wrong';
    void finish(false, rerender);
    return false;
  }

  task.game.move(from, to, want[4]);
  task.step++;
  playSound(task.game.inCheck ? 'check' : 'move');

  const nextOpponent = task.solution[task.step];
  if (!nextOpponent) {
    phase = 'solved';
    void finish(true, rerender);
    return true;
  }
  // Đối phương đi nước tiếp theo trong lời giải, rồi tới lượt người học
  setTimeout(() => {
    task!.game.move(
      nextOpponent.slice(0, 2) as Square,
      nextOpponent.slice(2, 4) as Square,
      nextOpponent[4],
    );
    task!.step++;
    if (!task!.solution[task!.step]) {
      phase = 'solved';
      void finish(true, rerender);
    }
    rerender();
  }, 350);
  rerender();
  return true;
}

async function finish(correct: boolean, rerender: () => void): Promise<void> {
  if (!task) return;
  // Dùng gợi ý thì không tính là giải đúng
  const tínhĐúng = correct && !hintShown;
  if (correct) doneToday++;
  if (lesson && correct) {
    lessonDone++;
    if (lessonDone >= lesson.count) void markLessonDone(lesson.id);
  }

  if (task.kind === 'card' && task.card) {
    await answerCard(task.card.id, tínhĐúng);
    lastResult = {
      correct,
      text: correct ? 'Đúng rồi. Thẻ này sẽ quay lại sau một thời gian dài hơn.' : `Nước đúng là ${task.card.best_san}.`,
    };
  } else if (task.puzzle && auth.user) {
    const r = await answerPuzzle(task.puzzle.id, task.puzzle.rating, tínhĐúng);
    lastResult = {
      correct,
      text: correct ? `Đúng rồi. Độ khó của bạn: ${r.rating}.` : 'Chưa đúng. Xem lời giải rồi thử bài khác nhé.',
    };
  } else {
    lastResult = { correct, text: correct ? 'Đúng rồi.' : 'Chưa đúng.' };
  }
  // Bài tập của ngày: ghi kết quả (lần đầu), báo chuỗi ngày
  if (task.puzzle && task.puzzle.id === dailyId) {
    dailyId = null;
    const me = await answerDaily(task.puzzle.id, tínhĐúng, Boolean(auth.user));
    const chuỗi = me && auth.user ? (me.streak > 0 ? ` Chuỗi: ${me.streak} ngày liên tiếp.` : '') : ' Đăng nhập để giữ chuỗi ngày.';
    lastResult = {
      correct,
      text: correct
        ? `Xong bài tập của ngày!${tínhĐúng ? chuỗi : ' (Có dùng gợi ý nên không tính vào chuỗi.)'}`
        : 'Chưa đúng — bài của ngày chỉ tính lần đầu. Mai có bài mới.',
    };
  }
  playSound(correct ? 'end' : 'wrong');
  rerender();
}

/* ---------------- Vẽ màn hình ---------------- */

export function train(): string {
  const head = `<div class="screen-head play-head">
    <h1>${lesson ? lesson.title : 'Ôn tập'}</h1>
    <span class="head-meta">${
      lesson
        ? `${lesson.chapter} · ${lessonDone}/${lesson.count} bài tập`
        : // Đây là dòng tiêu đề của cột phải: ngắn và viết hoa đầu câu. Số bài đã
          // làm hôm nay đã có trong bảng "Hôm nay" ngay bên dưới.
          cardCount.due
          ? `Ôn ${cardCount.due} thẻ lỗi`
          : 'Bài tập'
    }</span>
    ${toolbar(
      lesson
        ? [button({ label: 'Thoát bài học', kind: 'text', icon: 'close' })]
        : [button({ label: 'Bài khác', icon: 'cards' })],
    )}
  </div>`;

  // Đọc phần giải thích trước, rồi mới làm bài tập
  if (lesson && !lessonIntroShown) {
    return `<div class="screen screen-narrow">${head}
      <div class="lesson-intro">
        <p class="prose">${lesson.intro}</p>
        <p class="note note-key"><b>Cần nhớ:</b> ${lesson.keyPoint}</p>
        <div class="setup-go">${button({ label: 'Làm bài tập', kind: 'primary', icon: 'play' })}</div>
      </div>
    </div>`;
  }

  // Làm xong đủ số bài của bài học
  if (lesson && lessonDone >= lesson.count) {
    return `<div class="screen screen-narrow">${head}
      <div class="lesson-intro">
        <p class="task-done is-right"><b>Xong bài</b> — bạn đã giải đúng ${lessonDone} bài tập.</p>
        <p class="note note-key"><b>Cần nhớ:</b> ${lesson.keyPoint}</p>
        <div class="setup-go">
          ${button({ label: 'Bài học tiếp theo', kind: 'primary', icon: 'next' })}
          ${button({ label: 'Thoát bài học', kind: 'text' })}
        </div>
      </div>
    </div>`;
  }

  if (phase === 'loading') return `<div class="screen screen-narrow">${head}${notice('Đang lấy bài…', 'info', 'clock')}</div>`;

  if (phase === 'empty') {
    return `<div class="screen screen-narrow">${head}
      ${
        auth.offline
          ? notice(
              'Máy chủ đang nghỉ, tạm chưa ôn tập được.',
              'locked',
              'engine',
            )
          : khoBai === 0
            ? notice('Kho bài tập chưa được nạp. Chạy `npm run puzzles` trên máy chủ.', 'locked', 'engine')
            : notice('Hết bài phù hợp. Chơi thêm để có thẻ mới.', 'info', 'play')
      }
      ${auth.user || auth.offline ? '' : notice('Đăng nhập để lưu tiến độ và ôn lại chính lỗi của bạn.', 'locked', 'user')}
    </div>`;
  }

  const t = task!;
  const done = phase === 'solved' || phase === 'wrong';

  return `<div class="screen">
    ${head}
    <div class="game">
      <div class="game-board">
        <div class="puzzle-head">
          <span class="to-move">${t.side === 'w' ? 'Trắng' : 'Đen'} đi</span>
          <span class="theme-tag">${t.label}</span>
          ${t.rating ? `<span class="puzzle-rating">độ khó <b class="mono">${t.rating}</b></span>` : ''}
        </div>
        <div class="board-row"><div id="board" class="board-host"></div></div>
      </div>

      <div class="game-side">
        ${sheet(
          done
            ? `<p class="task-done ${lastResult?.correct ? 'is-right' : 'is-wrong'}">
                 <b>${lastResult?.correct ? 'Đúng' : 'Chưa đúng'}</b> — ${lastResult?.text ?? ''}
               </p>`
            : notice(
                t.kind === 'card'
                  ? 'Đây là thế cờ bạn từng đi sai. Tìm nước tốt hơn.'
                  : 'Tìm nước mạnh nhất cho bên đang đi.',
                'info',
                'hint',
              ),
          `<div class="puzzle-bar">
            ${
              done
                ? button({ label: 'Bài tiếp theo', kind: 'primary', icon: 'next' })
                : button({ label: hintShown ? 'Đã xem gợi ý' : 'Gợi ý', icon: 'hint', disabled: hintShown })
            }
            <span class="spacer"></span>
            ${done ? '' : button({ label: 'Xem lời giải', kind: 'text' })}
          </div>`,
          hintShown || done
            ? `<p class="prose">${
                done && !lastResult?.correct
                  ? `Nước đúng: ${figurine(sanOfSolution(), t.side)}`
                  : `Hãy nhìn con ${pieceOfSolution()}.`
              }</p>`
            : '',
        )}

        ${
          cardCount.due > 0 || doneToday > 0
            ? `${rule('Hôm nay')}${stats([
                ['Thẻ lỗi còn lại', String(Math.max(0, cardCount.due - doneToday))],
                ['Đã làm', String(doneToday)],
              ])}`
            : ''
        }
      </div>
    </div>
  </div>`;
}

/** Ký hiệu nước đúng, tính từ thế cờ hiện tại của bài. */
function sanOfSolution(): string {
  const t = task;
  if (!t) return '';
  const uci = t.solution[t.step] ?? t.solution[t.solution.length - 1];
  if (!uci) return '';
  const probe = new Game(t.game.fen);
  const m = probe.move(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, uci[4]);
  return m?.san ?? uci;
}

function pieceOfSolution(): string {
  const san = sanOfSolution();
  return { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã' }[san[0]] ?? 'Tốt';
}

/* ---------------- Gắn bàn cờ ---------------- */

export function mountTrain(rerender: () => void): void {
  if (!loadedOnce) {
    loadedOnce = true;
    void loadNext(rerender);
    return;
  }
  const host = document.querySelector<HTMLElement>('#board');
  if (!host || !task) return;

  view = new BoardView(host, {
    id: 'train',
    legalFrom: (from) => (phase === 'solving' ? task!.game.legalFrom(from) : { quiet: [], captures: [] }),
    canPick: (sq) => {
      if (phase !== 'solving') return false;
      const l = task!.game.legalFrom(sq);
      return l.quiet.length + l.captures.length > 0;
    },
    onMove: (from, to) => onMove(from, to, rerender),
  });

  const last = task.game.lastMove;
  view.render({
    fen: task.game.fen,
    orientation: task.side,
    lastMove: last ? [last.from, last.to] : undefined,
    check: task.game.checkedKing ?? undefined,
    label: 'Bàn cờ bài tập',
  });
}

export function handleTrainClick(target: HTMLElement, rerender: () => void): boolean {
  const btn = target.closest<HTMLButtonElement>('button');
  if (!btn) return false;
  const label = btn.getAttribute('title') ?? btn.textContent?.trim() ?? '';

  const actions: Record<string, () => void> = {
    'Làm bài tập': () => {
      lessonIntroShown = true;
      void loadNext(rerender);
    },
    'Thoát bài học': () => {
      exitLesson();
      location.hash = '#/hoc';
    },
    'Bài học tiếp theo': () => {
      const next = nextLessonAfter(lesson?.id);
      if (next) startLesson(next);
      else exitLesson();
      location.hash = '#/hoc';
    },
    'Bài tiếp theo': () => void loadNext(rerender),
    'Bài khác': () => void loadNext(rerender),
    'Gợi ý': () => {
      hintShown = true;
      rerender();
    },
    'Xem lời giải': () => {
      hintShown = true;
      phase = 'wrong';
      void finish(false, rerender);
    },
  };
  const run = actions[label];
  if (!run) return false;
  run();
  rerender();
  return true;
}

/** Ảnh thu nhỏ cho màn Sảnh. */
export function trainThumbnail(fen: string): string {
  return boardSvg({ fen, coordinates: false, label: 'Bài tập' });
}
