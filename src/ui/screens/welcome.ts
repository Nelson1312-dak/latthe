// Hộp chào mừng: hiện MỘT lần, ngay sau lần đăng nhập Google đầu tiên, nổi
// trên bàn cờ của tab Chơi (không phải một trang riêng — mở web ra là bàn cờ).
//
// Hỏi đúng hai thứ: gọi bạn là gì (tên này đối thủ online sẽ thấy), và bạn chơi
// cỡ nào (để máy và bài tập vừa sức ngay từ ván đầu). Bấm "Để sau" cũng được,
// hồ sơ vẫn được tạo.

import { auth, updateProfile } from '../../app/session.ts';
import { button, esc, notice } from '../components/index.ts';
import { icon } from '../icons.ts';

type StartLevel = 'new' | 'basic' | 'club' | 'strong';

const LEVELS: { id: StartLevel; title: string; note: string; bot: number }[] = [
  { id: 'new', title: 'Mới tập', note: 'Biết đi quân', bot: 1 },
  { id: 'basic', title: 'Chơi vui', note: 'Hay sơ hở', bot: 2 },
  { id: 'club', title: 'Khá', note: 'Có tính toán', bot: 4 },
  { id: 'strong', title: 'Mạnh', note: 'Elo 1500+', bot: 6 },
];

let level: StartLevel | null = null;
/** Tên đang gõ dở: chọn trình độ là vẽ lại, không giữ thì mất chữ vừa gõ. */
let draftName: string | null = null;
let saving = false;
let error: string | null = null;

/** Tên gọi ngắn để chào: người Việt gọi nhau bằng tên, không phải họ. */
function firstName(full: string): string {
  return full.trim().split(/\s+/).pop() ?? full;
}

export function welcomeDialog(): string {
  const u = auth.user;
  if (!u) return '';
  const levels = LEVELS.map(
    (l) =>
      `<button class="start-level${level === l.id ? ' is-active' : ''}" data-start-level="${l.id}" aria-pressed="${level === l.id}">` +
      `<b>${l.title}</b><span>${l.note}</span></button>`,
  ).join('');

  return `<div class="dialog-backdrop welcome-backdrop">
    <div class="dialog welcome" role="dialog" aria-modal="true" aria-label="Chào mừng">
      <div class="welcome-head">
        <span class="welcome-avatar">${
          u.avatar ? `<img src="${esc(u.avatar)}" alt="" width="48" height="48" referrerpolicy="no-referrer">` : icon('user', 24)
        }</span>
        <div>
          <h2>Chào ${esc(firstName(u.name))}!</h2>
          <p class="welcome-sub">Hai câu hỏi để Lật Cờ vừa sức bạn.</p>
        </div>
      </div>

      <label class="welcome-field">
        <span class="setup-label">Tên hiển thị</span>
        <input id="welcome-name" class="field" type="text" maxlength="30" value="${esc(draftName ?? u.name)}" autocomplete="nickname">
      </label>

      <div class="welcome-field">
        <span class="setup-label">Trình độ</span>
        <div class="start-levels" role="group" aria-label="Trình độ">${levels}</div>
      </div>

      ${error ? notice(error, 'danger') : ''}

      <div class="welcome-actions">
        <button class="link-btn" data-welcome-skip>Để sau</button>
        ${button({ label: saving ? 'Đang lưu…' : 'Bắt đầu chơi', kind: 'primary', icon: 'play', disabled: saving })}
      </div>
    </div>
  </div>`;
}

/**
 * Bấm trong hộp chào mừng. `done(bot)` chạy sau khi lưu xong, kèm cấp máy gợi
 * ý theo trình độ vừa chọn (null nếu không chọn hoặc bỏ qua).
 */
export function handleWelcomeClick(target: HTMLElement, rerender: () => void, done: (bot: number | null) => void): boolean {
  if (!target.closest('.dialog.welcome')) return false;
  const lv = target.closest<HTMLElement>('[data-start-level]');
  if (lv) {
    draftName = document.querySelector<HTMLInputElement>('#welcome-name')?.value ?? draftName;
    level = lv.dataset.startLevel as StartLevel;
    rerender();
    return true;
  }
  const skip = Boolean(target.closest('[data-welcome-skip]'));
  const save = target.closest('button')?.textContent?.trim() === 'Bắt đầu chơi';
  if (!skip && !save) return true; // bấm vào chỗ trống trong hộp: không làm gì
  if (saving) return true;

  const name = (document.querySelector<HTMLInputElement>('#welcome-name')?.value ?? '').trim();
  const patch: { name?: string; level?: string } = {};
  if (save) {
    if (name && name !== auth.user?.name) patch.name = name;
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
