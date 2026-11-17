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
  figurine,
  hintButton,
  iconButton,
  moveList,
  notice,
  playerStrip,
  rule,
  sheet,
  stats,
  toolbar,
} from '../components/index.ts';
import { ICON_NAMES, icon } from '../icons.ts';
import { fx, squaresOf } from '../../mock/index.ts';
import type { MoveClass } from '../../../shared/winrate.ts';

const CLASSES: MoveClass[] = ['book', 'best', 'good', 'inaccuracy', 'mistake', 'blunder', 'miss'];

const swatch = (token: string) => `<div class="swatch"><i style="background:var(--${token})"></i><span>--${token}</span></div>`;

const section = (title: string, note: string, body: string) =>
  `<section class="spec-section"><h2>${title}</h2><p class="spec-note">${note}</p>${body}</section>`;

export function specimen(): string {
  const g = fx.game1;
  const blunder = g.moves.find((m) => m.cls === 'blunder')!;
  const [bFrom, bTo] = squaresOf(blunder.uci);
  const mate = fx.puzzles[0];

  const boardDemo = (board: string, label: string) =>
    `<div><p class="spec-board-label label">${label}</p>` +
    `<div data-board="${board}">${boardSvg({
      fen: blunder.fenAfter,
      lastMove: [bFrom, bTo],
      badge: { square: bTo, cls: 'blunder' },
      label,
    })}</div></div>`;

  return `<div class="screen">
    <div class="screen-head">
      <h1>Trang thiết kế</h1>
      <span class="head-meta">Dữ liệu thật: ${fx.generatedBy}</span>
      ${toolbar([
        button({ label: 'Tối', icon: 'moon', title: 'Giao diện tối' }),
        button({ label: 'Sáng', icon: 'sun', title: 'Giao diện sáng' }),
      ])}
    </div>
    <p class="spec-note">
      Bấm Tối / Sáng để đổi giao diện; cả trang phải đọc được ở cả hai. Mọi thế cờ dưới đây
      lấy từ ván thật đã được engine phân tích, không có dữ liệu bịa.
      Nguyên tắc chung: ít hộp, tách bằng nét kẻ và khoảng trắng, một cột một mặt nền.
    </p>
    <span data-set-theme="dark" hidden></span>

    ${section(
      'Màu nền và chữ',
      'Bốn bậc nền tách lớp thay cho bóng đổ. Nền ngả ấm, không phải xám xanh.',
      `<div class="swatches">${['bg-0', 'bg-1', 'bg-2', 'bg-3', 'bg-row', 'line', 'line-strong', 'text-1', 'text-2', 'text-3'].map(swatch).join('')}</div>`,
    )}

    ${section(
      'Màu nhấn và trạng thái',
      'Chỉ một màu nhấn duy nhất là hổ phách. Đỏ chỉ dùng cho việc không lùi lại được và cho đồng hồ sắp hết giờ.',
      `<div class="swatches">${['accent', 'accent-hover', 'accent-dim', 'danger', 'danger-dim', 'ok', 'focus'].map(swatch).join('')}</div>`,
    )}

    ${section(
      'Xếp loại nước đi',
      'Ký hiệu chú giải cờ chuẩn. Màu đi kèm ký hiệu nên người phân biệt màu kém vẫn đọc được.',
      `<ul class="tally">${CLASSES.map((c) => `<li>${classBadge(c, 'md')} ${CLASS_LABEL[c]}</li>`).join('')}</ul>` +
        `<div class="swatches" style="margin-top:var(--s-3)">${CLASSES.map((c) => swatch(`cls-${c}`)).join('')}</div>`,
    )}

    ${section(
      'Chữ',
      'IBM Plex Sans cho giao diện, Mono cho số, Serif cho lời bình đọc thành câu. Cả ba có đủ dấu tiếng Việt. Không cỡ nào lớn hơn 28px.',
      [
        ['--fs-2xl 28', '<span style="font-size:var(--fs-2xl);line-height:var(--lh-2xl);font-weight:600">Trắng thắng · hết giờ</span>'],
        ['--fs-xl 20', '<span style="font-size:var(--fs-xl);font-weight:600">Xem lại ván</span>'],
        ['Serif 15', '<span style="font-family:var(--font-serif);font-size:15px">Hậu đi sang g4 nhưng bỏ trống ô c2.</span>'],
        ['--fs-md 14', '<span>Phòng thủ hai Mã · C55</span>'],
        ['--fs-sm 13', '<span style="font-size:var(--fs-sm)">Nước hỏng tiếp theo</span>'],
        ['--fs-xs 12', '<span class="rule-label">Ván đã chơi</span>'],
        ['Mono', '<span class="mono" style="font-size:var(--fs-clock)">5:21</span> <span class="mono">+1.4 −7.1 M3 1 180</span>'],
      ]
        .map(([l, b]) => `<div class="type-row"><span class="label">${l}</span>${b}</div>`)
        .join(''),
    )}

    ${section(
      'Ký hiệu hình',
      'Nước đi viết bằng hình quân, như sách cờ: người mới không phải nhớ N là Mã hay Tượng. Trình đọc màn hình vẫn đọc ra tên quân.',
      `<div class="spec-row" style="font-size:var(--fs-lg)">
        ${['Nf3', 'Bxf7+', 'Qg4', 'Rd8#', 'exd5', 'O-O'].map((s) => figurine(s, 'w')).join('<span class="muted"> · </span>')}
      </div>
      <div class="spec-row" style="font-size:var(--fs-lg)">
        ${['Nxc2+', 'Bc5', 'Qd7', 'Ra8', 'h6', 'O-O-O'].map((s) => figurine(s, 'b')).join('<span class="muted"> · </span>')}
      </div>`,
    )}

    ${section(
      'Icon',
      'Bộ icon tự vẽ trên lưới 24px, nét 1,5px, đầu nét vuông. Không dùng emoji, không dùng bộ icon tải sẵn.',
      `<div class="icon-grid">${ICON_NAMES.map((n) => `<div class="icon-cell">${icon(n, 22)}<span>${n}</span></div>`).join('')}</div>`,
    )}

    ${section(
      'Nút',
      'Cao 34px trên desktop, 44px trên điện thoại. Việc phụ gom thành nhóm dính liền thay vì một hàng nút rời rạc.',
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
        ${button({ label: 'Âm thanh', pressed: true, icon: 'sound' })}
      </div>
      <div class="spec-row">
        ${toolbar(
          [iconButton('first', 'Về đầu ván'), iconButton('prev', 'Lùi'), iconButton('next', 'Tiến'), iconButton('last', 'Cuối')],
          [button({ label: 'Xuất PGN', kind: 'text', icon: 'copy' })],
        )}
      </div>`,
    )}

    ${section(
      'Đồng hồ và thanh người chơi',
      'Bên đang đi có nền sáng hơn. Ô cờ nhỏ cho biết ai cầm quân gì — hữu ích hơn ảnh đại diện. Quân đã ăn xếp chồng như gạt sang mép bàn.',
      `<div class="spec-row">${clock(521000)} ${clock(183000, 'running')} ${clock(14300, 'low')} ${clock(0, 'flagged')}</div>
      <div class="sheet" style="max-width:560px">
        <div style="padding:0 var(--s-3)">
          ${playerStrip({ name: 'Máy cấp 4', side: 'b', bot: true, rating: 1550, clockMs: 521000, took: ['wp', 'wn'], diff: 4 })}
          ${playerStrip({ name: 'Nelson', side: 'w', you: true, rating: 1180, clockMs: 183000, clockState: 'running', took: ['bp'] })}
          ${playerStrip({ name: 'Hùng', side: 'b', rating: 1240, clockMs: 14300, clockState: 'low', status: 'mất kết nối' })}
          ${playerStrip({ name: 'Minh', side: 'w', rating: 1310, accuracy: 91.4 })}
        </div>
      </div>`,
    )}

    ${section(
      'Thanh đánh giá',
      'Dọc và dính sát mép bàn cờ trên desktop, ngang dưới bàn trên điện thoại.',
      `<div class="spec-row" style="align-items:stretch;height:180px">
        <div style="width:18px">${evalBar({ cp: 140 })}</div>
        <div style="width:18px">${evalBar({ cp: -709 })}</div>
        <div style="width:18px">${evalBar({ mate: 3 })}</div>
        <div style="flex:1;display:grid;gap:var(--s-3);align-content:center">
          ${evalBar({ cp: 140 }, 'horizontal')}
          ${evalBar({ cp: -709 }, 'horizontal')}
        </div>
      </div>`,
    )}

    ${section(
      'Sổ nước đi',
      'Số nước treo ra lề, hai cột Trắng và Đen, huy hiệu bám sát nước. Khi xem lại thì có thêm cột điểm. Dòng đang xem có vạch nhấn bên trái.',
      `<div class="spec-grid" style="max-width:820px">
        ${sheet(moveList(g.moves.slice(0, 20).map((m) => ({ san: m.san, cls: m.cls })), 11))}
        ${sheet(
          moveList(g.moves.slice(0, 20).map((m) => ({ san: m.san, cls: m.cls, score: m.scoreAfter })), 21, { scores: true }),
        )}
      </div>`,
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
        <div><p class="spec-board-label label">Đang chọn quân và nước hợp lệ</p>
          ${boardSvg({ fen: g.moves[20].fenBefore, selected: 'f3', legal: ['d1', 'e2', 'e3', 'f4', 'f5', 'g4', 'h5'], legalCaptures: ['f6'], label: 'Đang chọn Hậu f3' })}</div>
        <div><p class="spec-board-label label">Vua bị chiếu</p>
          ${boardSvg({ fen: 'r3k2r/ppp2p2/3p1n1p/2b1p1p1/2BnP1Q1/3P2BP/PPp2PP1/R3K2R w KQkq - 0 12', check: 'e1', lastMove: ['d4', 'c2'], label: 'Vua trắng bị chiếu' })}</div>
        <div><p class="spec-board-label label">Mũi tên của Huấn luyện viên</p>
          ${boardSvg({ fen: mate.fen, arrows: [{ from: 'd1', to: 'd8', kind: 'coach' }], badge: { square: 'd8', cls: 'best' }, label: 'Chiếu hết hàng cuối' })}</div>
      </div>`,
    )}

    ${section(
      'Lời bình của Huấn luyện viên',
      'Trình bày như chú thích bên lề một ván cờ in: vạch dọc bên trái, đầu đề là nước đi, phần giải thích dùng chữ có chân. Luôn nói rõ nguồn. Khi Ollama không chạy thì dùng câu mẫu và nói rõ.',
      `<div class="spec-grid">
        ${coachPanel({
          cls: 'blunder',
          move: '11.Qg4',
          side: 'w',
          text: 'Hậu đi sang g4 nhưng bỏ trống ô c2. Sau 11…Nxc2+ Đen vừa chiếu vừa ăn Xe, và bạn mất chất nặng.',
          better: { san: 'Qd1', side: 'w', why: 'Hậu lùi về vẫn giữ được ô c2' },
          source: 'llm',
          actions: button({ label: 'Xem nước tốt hơn', icon: 'hint' }) + button({ label: 'Thử lại từ đây', kind: 'primary', icon: 'play' }),
        })}
        ${coachPanel({
          cls: 'mistake',
          move: '13.Bxf7+',
          side: 'w',
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
      'Nhịp, số liệu và trạng thái',
      'Tiêu đề nhỏ kèm nét kẻ thay cho tiêu đề to. Số liệu viết thành dòng, không nhét vào ô dashboard. Trạng thái nằm trong luồng nội dung, không nổi lên trên.',
      `<div class="spec-grid" style="max-width:860px">
        <div>
          ${rule('Tiến độ', '<span class="rule-note">tuần này</span>')}
          ${stats([
            ['Độ khó bài tập', '1 180'],
            ['Thẻ đã thuộc', '14 / 33'],
            ['Giải đúng tuần này', '41 / 52'],
          ])}
        </div>
        <div>
          ${rule('Trạng thái')}
          ${notice('Đã sao chép link mời', 'info', 'check')}
          ${notice('Hùng mất kết nối · còn 47 giây để vào lại', 'danger', 'clock')}
          ${notice('Engine và Huấn luyện viên mở lại sau khi ván kết thúc', 'locked', 'engine')}
        </div>
        <div>
          ${rule('Gợi ý ba nấc')}
          <div class="spec-row">${hintButton(0)}</div>
          <div class="spec-row">${hintButton(1)}</div>
          <div class="spec-row">${hintButton(2)}</div>
          <div class="spec-row">${hintButton(3)}</div>
        </div>
      </div>`,
    )}

    ${section(
      'Hộp thoại',
      'Thứ duy nhất được phép nổi lên trên và có bóng đổ, vì nó chặn thao tác và cần một quyết định.',
      `<div class="spec-inline" style="max-width:440px">${dialog(
        'Đầu hàng ván này?',
        '<p>Ván sẽ tính là thua. Bạn vẫn xem lại được sau đó.</p>',
        button({ label: 'Quay lại', kind: 'text' }) + button({ label: 'Đầu hàng', kind: 'danger' }),
      )}</div>`,
    )}
  </div>`;
}
