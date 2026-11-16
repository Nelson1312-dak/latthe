// Ôn tập hôm nay: thẻ lỗi của chính mình trước, rồi bài tập theo chủ đề hay sai.
import { boardSvg } from '../../board/Board.ts';
import { button, coachPanel, figurine, hintButton, rule, sheet, sideGlyph, stats, toolbar } from '../components/index.ts';
import { fx } from '../../mock/index.ts';

export function train(): string {
  const g = fx.game1;
  const card = g.moves.find((m) => m.cls === 'blunder')!;
  const puzzles = fx.puzzles;
  const current = puzzles[1]; // Đòn đôi của Mã

  const queueItem = (fen: string, theme: string, note: string, due: string, done = false) =>
    `<div class="queue-item${done ? ' is-done' : ''}">
      <span class="queue-board">${boardSvg({ fen, coordinates: false, label: theme })}</span>
      <span class="queue-text"><b>${theme}</b><span>${note}</span></span>
      <span class="queue-due mono">${due}</span>
    </div>`;

  const boxes = [3, 2, 5, 9, 14];
  const max = Math.max(...boxes);

  return `<div class="screen screen-narrow">
    <div class="screen-head">
      <h1>Ôn tập hôm nay</h1>
      <span class="head-meta">7 thẻ · chuỗi 5 ngày</span>
      ${toolbar([button({ label: 'Đổi chủ đề', icon: 'cards' })])}
    </div>

    <div class="train-cols">
      <div>
        <div class="puzzle-head">
          <span class="theme-tag">${current.theme}</span>
          <span class="head-meta mono">độ khó ${current.rating}</span>
          <span class="to-move">${sideGlyph('w')} Trắng đi</span>
        </div>
        <div class="puzzle-board">
          ${boardSvg({ fen: current.fen, label: `Bài tập: ${current.theme}` })}
        </div>
        <div class="puzzle-bar">
          ${hintButton(0)}
          <span class="spacer"></span>
          ${button({ label: 'Xem lời giải', kind: 'text' })}
          ${button({ label: 'Bỏ qua', kind: 'text' })}
        </div>
        ${coachPanel({
          text: 'Mã trắng ở e5 đang đứng rất gần Vua và Hậu đen. Tìm nước ăn hai mục tiêu cùng lúc.',
          source: 'template',
        })}
      </div>

      <div>
        ${rule('Hàng chờ', '<span class="rule-note">còn 6</span>')}
        ${sheet(
          `<div class="queue">
            ${queueItem(card.fenAfter, 'Lỗi của bạn', `Ván với máy cấp 4, nước ${figurine('Qg4', 'w')}`, 'hôm nay')}
            ${queueItem(puzzles[0].fen, puzzles[0].theme, `Độ khó ${puzzles[0].rating}`, 'hôm nay')}
            ${queueItem(puzzles[2].fen, puzzles[2].theme, `Độ khó ${puzzles[2].rating}`, 'hôm nay')}
          </div>`,
        )}

        ${rule('Tiến độ')}
        ${stats([
          ['Độ khó bài tập', '1 180'],
          ['Thẻ đã thuộc', '14 / 33'],
          ['Giải đúng tuần này', '41 / 52'],
        ])}

        <div class="boxes">
          <div class="box-bars">
            ${boxes
              .map(
                (n, i) =>
                  `<span class="box-bar"><b class="mono">${n}</b><i style="height:${Math.round((n / max) * 46) + 2}px"></i><span>H${i + 1}</span></span>`,
              )
              .join('')}
          </div>
          <p class="box-note">Hộp 1 gặp lại sau 1 ngày, hộp 5 sau 35 ngày.</p>
        </div>
      </div>
    </div>
  </div>`;
}
