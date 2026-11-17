// Màn đăng nhập / tài khoản. Vào thẳng được qua #/tai-khoan.
import { button, classBadge, notice, rule, stats } from '../components/index.ts';
import { auth } from '../../app/session.ts';
import { progress, type Progress } from '../../app/training.ts';
import { icon } from '../icons.ts';
import { CLASS_LABEL } from '../../board/Board.ts';
import type { MoveClass } from '../../../shared/winrate.ts';

/** Tiến độ học, nạp riêng vì cần gọi server. */
let tienDo: Progress | null = null;
let daHoi = false;

export function mountAccount(rerender: () => void): void {
  if (daHoi || !auth.user) return;
  daHoi = true;
  void progress().then((p) => {
    tienDo = p;
    rerender();
  });
}

/** Quên tiến độ khi đăng xuất, để người sau không thấy số của người trước. */
export function resetAccount(): void {
  tienDo = null;
  daHoi = false;
}

const BOX_DAYS = [1, 3, 7, 16, 35];

function progressBlock(): string {
  if (!tienDo) return '';
  const boxes = Array.from({ length: 5 }, (_, i) => tienDo!.hopThe.find((h) => h.box === i + 1)?.c ?? 0);
  const max = Math.max(1, ...boxes);
  const tyLe = tienDo.attempts ? Math.round((tienDo.correct / tienDo.attempts) * 100) : 0;

  return `
    ${rule('Tiến độ học', `<span class="rule-note">chuỗi ${tienDo.streak} ngày</span>`)}
    ${stats([
      ['Bài đã làm', `${tienDo.correct} đúng / ${tienDo.attempts}${tienDo.attempts ? ` (${tyLe}%)` : ''}`],
      ['Thẻ lỗi', `${tienDo.the.due} đến hạn / ${tienDo.the.total}`],
    ])}

    ${
      tienDo.the.total
        ? `<div class="boxes">
            <p class="label">Thẻ theo hộp ôn tập</p>
            <div class="box-bars">
              ${boxes
                .map(
                  (n, i) =>
                    `<span class="box-bar"><b class="mono">${n}</b>` +
                    `<i style="height:${Math.round((n / max) * 46) + 2}px"></i><span>H${i + 1}</span></span>`,
                )
                .join('')}
            </div>
            <p class="box-note">Hộp 1 gặp lại sau ${BOX_DAYS[0]} ngày, hộp 5 sau ${BOX_DAYS[4]} ngày.</p>
          </div>`
        : ''
    }

    ${
      tienDo.chuDeHaySai.length
        ? `${rule('Kiểu lỗi hay gặp')}
           <ul class="tally">${tienDo.chuDeHaySai
             .map((c) => `<li>${classBadge(c.cls as MoveClass)} ${CLASS_LABEL[c.cls as MoveClass] ?? c.cls} <b class="mono">${c.c}</b></li>`)
             .join('')}</ul>`
        : ''
    }`;
}

export function account(): string {
  if (auth.offline) {
    // Trên bản web công khai, server không chạy cùng chỗ với trang. Câu
    // "chạy npm run dev" là lời nhắc cho người đang code, hiện ra cho khách
    // vào latbai.vn thì vô nghĩa — họ có cái repo nào đâu mà chạy.
    const đangTựChạy = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    return `<div class="screen screen-narrow">
      <div class="screen-head"><h1>Tài khoản</h1></div>
      ${
        đangTựChạy
          ? notice('Không gọi được server. Chạy `npm run dev` rồi tải lại trang.', 'danger', 'clock')
          : notice('Bản web này chưa nối được với máy chủ nên chưa đăng nhập được.', 'info', 'clock')
      }
      ${
        đangTựChạy
          ? ''
          : `<p class="prose">Chơi với máy và giải bài tập thì vẫn dùng bình thường —
             phần đó chạy ngay trong trình duyệt. Còn đăng nhập, lưu ván, ôn tập theo
             lỗi của mình và đấu với người khác thì cần máy chủ, hiện chỉ bật khi máy
             của chủ app đang mở.</p>
             <div class="row-actions">
               <span data-go="choi">${button({ label: 'Chơi với máy', kind: 'primary', icon: 'play' })}</span>
             </div>`
      }
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
            ['Elo đấu với người', String(u.gameRating)],
            ['Ván online đã chơi', String(u.gameCount)],
            ['Elo bài tập', String(tienDo?.rating ?? u.puzzleRating)],
          ])}
          <div class="account-actions">
            ${button({ label: 'Đăng xuất', kind: 'danger', icon: 'close' })}
          </div>
        </div>
        <div>
          ${progressBlock()}
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
