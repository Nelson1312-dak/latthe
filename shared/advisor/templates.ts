// Câu mẫu: lời bình viết sẵn, dùng khi không có mô hình ngôn ngữ hoặc khi lời
// nó viết ra không qua được kiểm duyệt.
//
// Đây KHÔNG phải phương án chữa cháy tạm bợ: bản chạy trên web không có Ollama,
// nên với phần lớn người dùng đây mới là lời bình họ đọc. Viết cho tử tế.

import type { Facts } from './facts.ts';
import type { MotifKind } from './motifs.ts';

const MOTIF_TEXT: Record<MotifKind, (f: Facts, m: Facts['the'][number]) => string> = {
  hangsMate: () => 'Sau nước này đối thủ có đường chiếu hết. Cần đỡ ngay chứ không thể đi tiếp như thường.',
  missedMate: () => 'Ở thế cờ này bạn đã có đường chiếu hết mà bỏ lỡ. Trước khi đi, hãy thử tìm nước chiếu xem có dẫn tới chiếu hết không.',
  hanging: (_f, m) =>
    `${m.piece} ở ${m.square} đang không được ai bảo vệ, đối thủ ăn được mà bạn không ăn lại được.`,
  fork: (_f, m) =>
    `${m.piece} đối thủ nhảy vào ${m.square} là đòn đôi: cùng lúc nhắm ${(m.targets ?? []).join(' và ')}. Chỉ cứu được một quân.`,
  missedCapture: (_f, m) => `Bạn bỏ lỡ nước ${m.san}: ${m.piece} ở ${m.square} đang không ai bảo vệ.`,
  backRank: (_f, m) =>
    `Vua ở ${m.square} bị chính Tốt nhà chắn hết đường thoát. Một quân nặng xuống hàng cuối là thành chiếu hết.`,
  badTrade: (f) =>
    `Cuộc đổi quân này làm bạn thiệt ${Math.abs((f.vatChat?.sau ?? 0) - (f.vatChat?.truoc ?? 0))} điểm quân.`,
};

const CLASS_OPENING: Record<string, string> = {
  'Sai nghiêm trọng': 'Nước này làm hỏng thế cờ.',
  Sai: 'Nước này để mất lợi thế.',
  'Thiếu chính xác': 'Nước này chưa chính xác.',
  'Bỏ lỡ': 'Bạn bỏ lỡ một cơ hội.',
  Tốt: 'Nước đi hợp lý.',
  'Tốt nhất': 'Đúng nước mạnh nhất.',
  Sách: 'Nước này nằm trong sách khai cuộc.',
};

/** Câu đầu của lời bình: vì sao nước này hay/dở (mô-típ nếu nhận ra, không thì theo xếp loại). */
export function whyText(f: Facts): string {
  const motif = f.the[0];
  const viết = motif ? MOTIF_TEXT[motif.kind] : undefined;
  return viết ? viết(f, motif!) : (CLASS_OPENING[f.xepLoai] ?? 'Nước đi bình thường.');
}

/** Lời bình viết sẵn cho một nước. Luôn trả về một câu dùng được. */
export function templateComment(f: Facts): string {
  const parts: string[] = [];
  const motif = f.the[0];

  // Tra bảng rồi mới gọi: kiểu lỗi lạ (dữ liệu hỏng, hoặc client tự gửi lên)
  // từng làm `MOTIF_TEXT[kind] is not a function` → server trả 500. Mà đường
  // /api/advisor/explain giờ ra tới internet, nên ai cũng gây được.
  const viết = motif ? MOTIF_TEXT[motif.kind] : undefined;
  parts.push(viết ? viết(f, motif!) : (CLASS_OPENING[f.xepLoai] ?? 'Nước đi bình thường.'));

  if (f.nuocTotHon.length && ['Sai nghiêm trọng', 'Sai', 'Thiếu chính xác', 'Bỏ lỡ'].includes(f.xepLoai)) {
    parts.push(`Thay vào đó ${f.nuocTotHon[0]} giữ được thế cờ.`);
  }
  return parts.join(' ');
}

/** Gợi ý ba nấc khi đang chơi: ý tưởng → quân nào → nước cụ thể. */
export function hintSteps(f: Facts): [string, string, string] {
  const best = f.nuocTotHon[0] ?? f.dongChinh[0] ?? '';
  const motif = f.the[0];

  const idea = (motif
    ? {
        hanging: 'Có một quân đang bị bỏ hở — của bạn hoặc của đối thủ.',
        missedCapture: 'Có một quân của đối thủ đang không ai bảo vệ.',
        missedMate: 'Thế cờ này có đường chiếu hết.',
        hangsMate: 'Vua của bạn đang gặp nguy, hãy lo phòng thủ trước.',
        fork: 'Coi chừng đòn đôi của đối thủ.',
        backRank: 'Hàng cuối của bạn đang yếu.',
        badTrade: 'Đừng đổi quân vội, bạn sẽ bị thiệt.',
      }[motif.kind]
    : undefined) ?? 'Tìm nước làm thế cờ của bạn tốt lên.';

  // Nấc hai chỉ nói quân nào, không nói đi đâu
  const pieceLetter = best.match(/^[KQRBN]/)?.[0];
  const pieceName = { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã' }[pieceLetter ?? ''] ?? 'Tốt';
  const which = best ? `Hãy nhìn con ${pieceName}.` : 'Hãy xem lại các quân đang bị tấn công.';

  return [idea, which, best ? `Nước cần đi là ${best}.` : 'Không có nước nào nổi bật.'];
}
