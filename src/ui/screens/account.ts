// Màn đăng nhập / tài khoản. Vào thẳng được qua #/tai-khoan.
import { button, notice, rule, stats } from '../components/index.ts';
import { auth } from '../../app/session.ts';
import { icon } from '../icons.ts';

export function account(): string {
  if (auth.offline) {
    return `<div class="screen screen-narrow">
      <div class="screen-head"><h1>Tài khoản</h1></div>
      ${notice('Không gọi được server. Chạy `npm run dev` rồi tải lại trang.', 'danger', 'clock')}
    </div>`;
  }

  if (auth.user) {
    const u = auth.user;
    return `<div class="screen screen-narrow">
      <div class="screen-head">
        <h1>Tài khoản</h1>
        <span class="head-meta">${u.local ? 'tài khoản thử' : 'đăng nhập bằng Google'}</span>
      </div>
      <div class="account-cols">
        <div>
          ${rule('Bạn')}
          <div class="account-id">
            <span class="account-avatar">${u.avatar ? `<img src="${u.avatar}" alt="" width="44" height="44">` : icon('user', 24)}</span>
            <span class="account-name">
              <b>${u.name}</b>
              <span class="head-meta">Tiến độ học được lưu trên máy chủ này</span>
            </span>
          </div>
          ${stats([
            ['Độ khó bài tập', String(u.puzzleRating)],
            ['Mã người chơi', `#${u.id}`],
          ])}
          <div class="account-actions">
            ${button({ label: 'Đăng xuất', kind: 'danger', icon: 'close' })}
          </div>
        </div>
        <div>
          ${rule('Lưu ở đâu')}
          <p class="prose">
            Ván cờ, thẻ ôn tập và tiến độ nằm trong một file SQLite trên máy chủ, không gửi đi đâu khác.
            Đăng xuất chỉ xoá phiên trên máy này, dữ liệu vẫn còn.
          </p>
        </div>
      </div>
    </div>`;
  }

  const canGoogle = Boolean(auth.googleClientId);
  return `<div class="screen screen-narrow">
    <div class="screen-head"><h1>Đăng nhập</h1></div>
    <div class="account-cols">
      <div>
        ${rule('Đăng nhập')}
        <p class="prose">
          Đăng nhập để lưu ván đã chơi, thẻ ôn tập và tiến độ, dùng được trên nhiều thiết bị.
          App không bao giờ thấy mật khẩu của bạn: Google lo phần đó.
        </p>
        <div id="google-btn" class="google-btn"></div>
        ${canGoogle ? '' : notice('Server chưa đặt GOOGLE_CLIENT_ID — xem docs/GOOGLE-LOGIN.md', 'locked', 'engine')}
        <p id="login-error" class="notice notice-danger" hidden></p>
      </div>
      <div>
        ${rule('Hoặc thử nhanh')}
        ${
          auth.devAuth
            ? `<p class="prose">Tài khoản thử chỉ có khi chạy trên máy bạn, dùng để xem app khi chưa cấu hình Google. Phiên hết hạn sau một ngày.</p>
               <div class="account-actions">
                 <input id="dev-name" class="field" type="text" value="Nelson" maxlength="40" aria-label="Tên hiển thị">
                 ${button({ label: 'Vào thử', icon: 'user' })}
               </div>`
            : notice('Đăng nhập thử đang tắt (chỉ bật khi chạy trên máy bạn với AUTH_DEV=1)', 'locked', 'engine')
        }
      </div>
    </div>
  </div>`;
}
