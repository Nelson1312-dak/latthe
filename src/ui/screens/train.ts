// Ôn tập hôm nay: thẻ lỗi của chính mình trước, rồi bài tập theo chủ đề hay sai.
import { boardSvg } from '../../board/Board.ts';
import { button, coachPanel, hintButton } from '../components/index.ts';
import { fx } from '../../mock/index.ts';
import { icon } from '../icons.ts';

export function train(): string {
  const g = fx.game1;
  const card = g.moves.find((m) => m.cls === 'blunder')!;
  const puzzles = fx.puzzles;
  const current = puzzles[1]; // Đòn đôi của Mã

  const queueItem = (fen: string, theme: string, note: string, due: string) =>
    `<div class="queue-item">
      <div>${boardSvg({ fen, coordinates: false, label: theme })}</div>
      <div class="queue-meta"><span class="theme-tag">${theme}</span><span class="muted">${note}</span></div>
      <span class="muted mono">${due}</span>
    </div>`;

  const boxes = [3, 2, 5, 9, 14];
  const maxBox = Math.max(...boxes);

  return `<div class="screen">
    <div class="screen-head">
      <h1>Ôn tập hôm nay</h1>
      <span class="muted">7 thẻ đến hạn · chuỗi 5 ngày ${icon('flame', 16)}</span>
    </div>

    <div class="spec-grid">
      <div>
        <div class="card" style="margin-bottom:var(--s-4)">
          <div class="card-row">
            <span class="theme-tag">${current.theme}</span>
            <span class="muted mono">độ khó ${current.rating}</span>
            <span class="muted" style="margin-left:auto">Trắng đi</span>
          </div>
          <div class="puzzle-board">${boardSvg({ fen: current.fen, label: `Bài tập: ${current.theme}` })}</div>
          <div class="card-row">
            ${hintButton(0)}
            <span style="margin-left:auto">${button({ label: 'Bỏ qua', kind: 'text' })}</span>
          </div>
        </div>

        ${coachPanel({
          text: 'Mã trắng ở e5 đang đứng rất gần Vua và Hậu đen. Tìm nước ăn hai mục tiêu cùng lúc.',
          source: 'template',
        })}
      </div>

      <div>
        <h2 style="margin-bottom:var(--s-3)">Hàng chờ</h2>
        <div class="grid" style="margin-bottom:var(--s-6)">
          ${queueItem(card.fenAfter, 'Lỗi của bạn', 'Ván với máy cấp 4, nước 11.Qg4', 'hôm nay')}
          ${queueItem(puzzles[0].fen, puzzles[0].theme, `Độ khó ${puzzles[0].rating}`, 'hôm nay')}
          ${queueItem(puzzles[2].fen, puzzles[2].theme, `Độ khó ${puzzles[2].rating}`, 'hôm nay')}
        </div>

        <h2 style="margin-bottom:var(--s-3)">Tiến độ</h2>
        <div class="grid grid-2" style="margin-bottom:var(--s-4)">
          <div class="card"><span class="label">Độ khó bài tập</span><span class="stat-value">1 180</span></div>
          <div class="card"><span class="label">Thẻ đã thuộc</span><span class="stat-value">14 / 33</span></div>
        </div>

        <div class="card">
          <span class="label">Thẻ theo hộp ôn tập</span>
          <div class="box-bars">
            ${boxes
              .map(
                (n, i) =>
                  `<span class="box-bar"><i style="height:${Math.round((n / maxBox) * 56)}px"></i><span class="label">H${i + 1}</span></span>`,
              )
              .join('')}
          </div>
          <span class="muted" style="font-size:var(--fs-sm)">Hộp 1 gặp lại sau 1 ngày, hộp 5 sau 35 ngày.</span>
        </div>

        <div class="card" style="margin-top:var(--s-4)">
          <span class="label">Chủ đề bạn hay sai</span>
          <div class="card-row" style="flex-wrap:wrap">
            <span class="theme-tag">Để hở quân · 6</span>
            <span class="theme-tag">Đòn đôi · 4</span>
            <span class="theme-tag">Bỏ lỡ chiếu hết · 2</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
