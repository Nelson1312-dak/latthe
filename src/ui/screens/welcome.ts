// Màn chào mừng: hiện MỘT lần, ngay sau lần đăng nhập Google đầu tiên.
//
// Hỏi đúng hai thứ: gọi bạn là gì (tên này đối thủ online sẽ thấy), và bạn chơi
// cỡ nào (để máy và bài tập vừa sức ngay từ ván đầu, thay vì bắt người mới đấu
// với điểm 1000 mặc định). Bấm "Để sau" cũng được, hồ sơ vẫn được tạo.

import { auth, updateProfile } from '../../app/session.ts';
import { button, notice } from '../components/index.ts';
import { esc } from '../components/index.ts';
import { icon } from '../icons.ts';

type StartLevel = 'new' | 'basic' | 'club' | 'strong';

const LEVELS: { id: StartLevel; title: string; note: string; bot: number }[] = [
  { id: 'new', title: 'Mới tập chơi', note: 'Biết cách đi quân, chưa chơi nhiều', bot: 1 },
  { id: 'basic', title: 'Chơi cho vui', note: 'Chơi được cả ván, hay sơ hở', bot: 2 },
  { id: 'club', title: 'Chơi khá', note: 'Có tính toán, biết vài khai cuộc', bot: 4 },
  { id: 'strong', title: 'Chơi mạnh', note: 'Elo online khoảng 1500 trở lên', bot: 6 },
];

let level: StartLevel | null = null;
/** Tên đang gõ dở: chọn trình độ là vẽ lại màn, không giữ thì mất chữ vừa gõ. */
let draftName: string | null = null;
let saving = false;
let error: string | null = null;

/** Tên gọi ngắn để chào: người Việt gọi nhau bằng tên, không phải họ. */
function firstName(full: string): string {
  return full.trim().split(/\s+/).pop() ?? full;
}

export function welcome(): string {
  const u = auth.user;
  if (!u) {
    return `<div class="screen screen-narrow">
      <div class="screen-head"><h1>Chào mừng</h1></div>
      ${notice('Bạn chưa đăng nhập.', 'info', 'user')}
      <span data-go="tai-khoan">${button({ label: 'Tới trang đăng nhập', kind: 'primary', icon: 'user' })}</span>
    </div>`;
  }
  const cards = LEVELS.map(
    (l) =>
      `<button class="start-level${level === l.id ? ' is-active' : ''}" data-start-level="${l.id}" aria-pressed="${level === l.id}">` +
      `<b>${l.title}</b><span>${l.note}</span></button>`,
  ).join('');

  return `<div class="screen screen-narrow welcome">
    <div class="welcome-head">
      <span class="welcome-avatar">${u.avatar ? `<img src="${esc(u.avatar)}" alt="" width="72" height="72" referrerpolicy="no-referrer">` : icon('user', 36)}</span>
      <div>
        <h1>Chào ${esc(firstName(u.name))}!</h1>
        <p class="welcome-sub">Hồ sơ của bạn đã được tạo. Hai câu hỏi nhanh để Lật Cờ vừa sức bạn ngay từ ván đầu.</p>
      </div>
    </div>

    <label class="welcome-field">
      <span class="setup-label">Gọi bạn là gì?</span>
      <input id="welcome-name" class="field" type="text" maxlength="30" value="${esc(draftName ?? u.name)}" autocomplete="nickname">
      <span class="welcome-hint">Đối thủ online sẽ thấy tên này. Đổi lại được trong Hồ sơ.</span>
    </label>

    <div class="welcome-field">
      <span class="setup-label">Bạn chơi cờ cỡ nào?</span>
      <div class="start-levels">${cards}</div>
    </div>

    ${error ? notice(error, 'danger') : ''}

    <div class="welcome-actions">
      ${button({ label: saving ? 'Đang lưu…' : 'Lưu và bắt đầu chơi', kind: 'primary', icon: 'play', disabled: saving })}
      <button class="link-btn" data-welcome-skip>Để sau</button>
    </div>
  </div>`;
}

/**
 * Bấm trên màn chào mừng. `done(bot)` chạy sau khi lưu xong, kèm cấp máy gợi
 * ý theo trình độ vừa chọn (null nếu bỏ qua).
 */
export function handleWelcomeClick(target: HTMLElement, rerender: () => void, done: (bot: number | null) => void): boolean {
  const lv = target.closest<HTMLElement>('[data-start-level]');
  if (lv) {
    draftName = document.querySelector<HTMLInputElement>('#welcome-name')?.value ?? draftName;
    level = lv.dataset.startLevel as StartLevel;
    rerender();
    return true;
  }
  const skip = target.closest('[data-welcome-skip]');
  const save = target.closest('button')?.textContent?.trim() === 'Lưu và bắt đầu chơi';
  if (!skip && !save) return false;
  if (saving) return true;

  const name = document.querySelector<HTMLInputElement>('#welcome-name')?.value ?? '';
  const patch: { name?: string; level?: string } = {};
  if (save) {
    if (name.trim() && name.trim() !== auth.user?.name) patch.name = name;
    if (level) patch.level = level;
  }
  saving = true;
  error = null;
  rerender();
  updateProfile(patch)
    .then(() => {
      const bot = save && level ? (LEVELS.find((l) => l.id === level)?.bot ?? null) : null;
      saving = false;
      level = null;
      draftName = null;
      done(bot);
    })
    .catch((err: Error) => {
      saving = false;
      error = err.message;
      rerender();
    });
  return true;
}
