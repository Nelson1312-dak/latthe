// Trang thiết kế: mọi token và component ở mọi trạng thái.
// Component mới phải xuất hiện ở đây trước khi được dùng trong màn hình thật.
import { boardSvg, CLASS_LABEL } from '../../board/Board.ts';
import {
  button,
  classBadge,
  clock,
  coachPanel,
  dialog,
  evalBar,
  hintButton,
  iconButton,
  moveList,
  playerStrip,
  toast,
} from '../components/index.ts';
import { ICON_NAMES, icon } from '../icons.ts';
import { fx, squaresOf } from '../../mock/index.ts';
import type { MoveClass } from '../../../shared/winrate.ts';

const CLASSES: MoveClass[] = ['book', 'best', 'good', 'inaccuracy', 'mistake', 'blunder', 'miss'];

function swatch(token: string): string {
  return `<div class="swatch"><i style="background:var(--${token})"></i><span>--${token}</span></div>`;
}

function section(title: string, note: string, body: string): string {
  return `<section class="spec-section"><h2>${title}</h2><p class="spec-note">${note}</p>${body}</section>`;
}

export function specimen(): string {
  const g = fx.game1;
  const blunder = g.moves.find((m) => m.cls === 'blunder')!;
  const [bFrom, bTo] = squaresOf(blunder.uci);
  const mate = fx.puzzles[0];

  const boardDemo = (board: string, label: string) =>
    `<div><p class="label spec-board-label">${label}</p>` +
    `<div data-board="${board}">${boardSvg({
      fen: blunder.fenAfter,
      lastMove: [bFrom, bTo],
      badge: { square: bTo, cls: 'blunder' },
      label,
    })}</div></div>`;

  return `<div class="screen">
    <div class="screen-head">
      <h1>Trang thiết kế</h1>
      <span class="muted">Dữ liệu thật: ${fx.generatedBy}</span>
      ${button({ label: 'Tối', icon: 'moon', title: 'Giao diện tối' })}
      ${button({ label: 'Sáng', icon: 'sun', title: 'Giao diện sáng' })}
    </div>
    <p class="spec-note" style="margin-bottom:var(--s-6)">
      Bấm <b>Tối</b> / <b>Sáng</b> để đổi giao diện; cả trang phải đọc được ở cả hai.
      Mọi thế cờ dưới đây lấy từ ván thật đã được engine phân tích, không có dữ liệu bịa.
    </p>
    <span data-set-theme="dark" hidden></span>

    ${section(
      'Màu nền và chữ',
      'Bốn bậc nền tách lớp thay cho bóng đổ. Nền ngả ấm, không phải xám xanh.',
      `<div class="swatches">${['bg-0', 'bg-1', 'bg-2', 'bg-3', 'line', 'line-strong', 'text-1', 'text-2', 'text-3'].map(swatch).join('')}</div>`,
    )}

    ${section(
      'Màu nhấn và trạng thái',
      'Chỉ một màu nhấn duy nhất là hổ phách. Đỏ chỉ dùng cho việc không lùi lại được và cho đồng hồ sắp hết giờ.',
      `<div class="swatches">${['accent', 'accent-hover', 'accent-dim', 'danger', 'danger-dim', 'ok', 'focus'].map(swatch).join('')}</div>`,
    )}

    ${section(
      'Xếp loại nước đi',
      'Dùng ký hiệu chú giải cờ chuẩn. Màu đi kèm ký hiệu nên người phân biệt màu kém vẫn đọc được.',
      `<div class="spec-row">${CLASSES.map((c) => `<span class="cls-count">${classBadge(c, 'md')} ${CLASS_LABEL[c]}</span>`).join('')}</div>` +
        `<div class="swatches">${CLASSES.map((c) => swatch(`cls-${c}`)).join('')}</div>`,
    )}

    ${section(
      'Chữ',
      'IBM Plex Sans cho giao diện, IBM Plex Mono cho số. Cả hai có đủ dấu tiếng Việt và số đều độ rộng. Không cỡ nào lớn hơn 28px.',
      [
        ['--fs-2xl 28', '<span style="font-size:var(--fs-2xl);line-height:var(--lh-2xl);font-weight:600">Trắng thắng · hết giờ</span>'],
        ['--fs-xl 20', '<span style="font-size:var(--fs-xl);font-weight:600">Xem lại ván</span>'],
        ['--fs-lg 16', '<span style="font-size:var(--fs-lg)">Hậu đi sang g4 nhưng bỏ trống ô c2.</span>'],
        ['--fs-md 14', '<span style="font-size:var(--fs-md)">Phòng thủ hai Mã · C55</span>'],
        ['--fs-sm 13', '<span style="font-size:var(--fs-sm)">11.Qg4 Nxc2+ 12.Kd1 Nxa1</span>'],
        ['--fs-xs 12', '<span class="label">ĐỘ CHÍNH XÁC</span>'],
        ['Mono', '<span class="mono" style="font-size:var(--fs-clock)">5:21</span> <span class="mono">+1.4 −7.1 M3 1 180</span>'],
      ]
        .map(([l, b]) => `<div class="type-row"><span class="label">${l}</span>${b}</div>`)
        .join(''),
    )}

    ${section(
      'Icon',
      'Bộ icon tự vẽ trên lưới 24px, nét 1,5px, đầu nét vuông. Không dùng emoji, không dùng bộ icon tải sẵn.',
      `<div class="icon-grid">${ICON_NAMES.map((n) => `<div class="icon-cell">${icon(n, 22)}<span>${n}</span></div>`).join('')}</div>`,
    )}

    ${section(
      'Nút',
      'Cao 36px trên desktop, 44px trên điện thoại. Bo góc 4px, không bóng đổ.',
      `<div class="spec-row">
        ${button({ label: 'Chơi với máy', kind: 'primary', icon: 'play' })}
        ${button({ label: 'Đề nghị hòa', icon: 'draw' })}
        ${button({ label: 'Đầu hàng', kind: 'danger', icon: 'resign' })}
        ${button({ label: 'Bỏ qua', kind: 'text' })}
      </div>
      <div class="spec-row">
        ${button({ label: 'Thường' })}
        ${button({ label: 'Vô hiệu', disabled: true })}
        ${button({ label: 'Đang phân tích', loading: true })}
        ${button({ label: 'Đang bật', pressed: true, icon: 'sound' })}
        ${iconButton('flip', 'Lật bàn cờ')}
        ${iconButton('next', 'Tiến một nước', { disabled: true })}
      </div>`,
    )}

    ${section(
      'Đồng hồ',
      'Bên đang đi có nền sáng hơn. Dưới 20 giây chuyển đỏ và hiện thêm phần mười giây.',
      `<div class="spec-row">${clock(521000)} ${clock(183000, 'running')} ${clock(14300, 'low')} ${clock(0, 'flagged')}</div>`,
    )}

    ${section(
      'Thanh người chơi',
      'Tên, điểm, quân đã ăn và chênh lệch vật chất, trạng thái, đồng hồ.',
      `<div class="panel" style="padding:0 var(--s-3);max-width:560px">
        ${playerStrip({ name: 'Máy cấp 4', avatar: 'engine', rating: 1550, clockMs: 521000, took: ['bp', 'bn'], diff: 4 })}
        <hr>
        ${playerStrip({ name: 'Nelson', you: true, rating: 1180, clockMs: 183000, clockState: 'running', took: ['wp'], diff: 0 })}
        <hr>
        ${playerStrip({ name: 'Hùng', rating: 1240, clockMs: 14300, clockState: 'low', status: 'mất kết nối' })}
      </div>`,
    )}

    ${section(
      'Thanh và biểu đồ đánh giá',
      'Dọc trên desktop, ngang trên điện thoại.',
      `<div class="spec-row" style="align-items:stretch;height:200px">
        <div style="width:20px">${evalBar({ cp: 140 })}</div>
        <div style="width:20px">${evalBar({ cp: -709 })}</div>
        <div style="width:20px">${evalBar({ mate: 3 })}</div>
        <div style="flex:1;display:grid;gap:var(--s-3);align-content:center">
          ${evalBar({ cp: 140 }, 'horizontal')}
          ${evalBar({ cp: -709 }, 'horizontal')}
        </div>
      </div>`,
    )}

    ${section(
      'Danh sách nước đi',
      'Bảng hai cột, huy hiệu xếp loại ngay cạnh nước. Dòng đang xem có vạch nhấn bên trái.',
      `<div class="panel" style="max-width:380px">${moveList(
        g.moves.slice(0, 26).map((m) => ({ san: m.san, cls: m.cls })),
        21,
      )}</div>`,
    )}

    ${section(
      'Bàn cờ',
      'Ba chủ đề màu. Ô vừa đi, ô đang chọn, nước hợp lệ, Vua bị chiếu, mũi tên và huy hiệu xếp loại.',
      `<div class="spec-boards">
        ${boardDemo('wood', 'Gỗ (mặc định)')}
        ${boardDemo('green', 'Xanh')}
        ${boardDemo('stone', 'Đá')}
      </div>
      <div class="spec-boards" style="margin-top:var(--s-4)">
        <div><p class="label spec-board-label">Đang chọn quân và nước hợp lệ</p>
          ${boardSvg({ fen: g.moves[20].fenBefore, selected: 'f3', legal: ['d1', 'e2', 'e3', 'f4', 'f5', 'g4', 'h5'], legalCaptures: ['f6'], label: 'Đang chọn Hậu f3' })}</div>
        <div><p class="label spec-board-label">Vua bị chiếu</p>
          ${boardSvg({ fen: 'r3k2r/ppp2p2/3p1n1p/2b1p1p1/2BnP1Q1/3P2BP/PPp2PP1/R3K2R w KQkq - 0 12', check: 'e1', lastMove: ['d4', 'c2'], label: 'Vua trắng bị chiếu' })}</div>
        <div><p class="label spec-board-label">Mũi tên của Huấn luyện viên</p>
          ${boardSvg({ fen: mate.fen, arrows: [{ from: 'd1', to: 'd8', kind: 'coach' }], badge: { square: 'd8', cls: 'best' }, label: 'Chiếu hết hàng cuối' })}</div>
      </div>`,
    )}

    ${section(
      'Huấn luyện viên',
      'Lời bình luôn nói rõ nguồn. Khi Ollama không chạy, app dùng câu mẫu và nói rõ điều đó.',
      `<div class="spec-grid">
        ${coachPanel({
          cls: 'blunder',
          move: '11.Qg4',
          text: 'Hậu đi sang g4 nhưng bỏ trống ô c2. Sau 11…Nxc2+ Đen vừa chiếu vừa ăn Xe, và bạn mất chất nặng.',
          better: 'Qd1 giữ Hậu phòng ô c2',
          source: 'llm',
          actions: button({ label: 'Xem nước tốt hơn', icon: 'hint' }) + button({ label: 'Thử lại từ đây', kind: 'primary', icon: 'play' }),
        })}
        ${coachPanel({
          cls: 'mistake',
          move: '13.Bxf7+',
          text: 'Nước này đổi Tượng lấy Tốt rồi kéo Vua đen ra giữa bàn, nhưng bạn không có quân nào theo sau để tấn công.',
          source: 'template',
        })}
        ${coachPanel({
          text: 'Mã đen vừa nhảy vào d4 và đang nhòm Hậu của bạn. Hãy nhìn con Hậu ở',
          source: 'typing',
        })}
      </div>`,
    )}

    ${section(
      'Gợi ý ba nấc',
      'Nấc 1 nói ý tưởng, nấc 2 tô ô quân cần đi, nấc 3 vẽ mũi tên nước cụ thể. Chỉ có khi chơi với máy.',
      `<div class="spec-row">${hintButton(0)}</div><div class="spec-row">${hintButton(1)}</div>
       <div class="spec-row">${hintButton(2)}</div><div class="spec-row">${hintButton(3)}</div>`,
    )}

    ${section(
      'Thông báo và hộp thoại',
      'Toast cho việc không cần xử lý. Hộp thoại chỉ dùng khi cần một quyết định.',
      `<div class="spec-row">${toast('Đã sao chép link mời')}${toast('Hùng mất kết nối · còn 47 giây để vào lại', 'danger')}</div>
       <div style="max-width:460px">${dialog(
         'Đầu hàng ván này?',
         '<p>Ván sẽ tính là thua. Bạn vẫn xem lại được sau đó.</p>',
         button({ label: 'Quay lại', kind: 'text' }) + button({ label: 'Đầu hàng', kind: 'danger' }),
       )}</div>`,
    )}
  </div>`;
}
