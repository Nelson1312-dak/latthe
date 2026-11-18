// "Ba điều rút ra từ ván này" — tính từ kết quả chấm, không đoán.
//
// Mọi câu ở đây là SỰ THẬT lấy từ engine: nước nào hỏng nặng nhất, nên đi gì,
// giai đoạn nào chơi tốt/kém, cơ hội nào bỏ lỡ. Huấn luyện viên AI (nếu có)
// chỉ được viết lại các câu này cho tự nhiên, không được thêm nước nào khác.

import type { Side } from '../../shared/chess.ts';
import { winPercent, type MoveClass } from '../../shared/winrate.ts';
import type { ReviewResult, ReviewedMove } from './review.ts';

const PIECE: Record<string, string> = { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã' };

/** Nước đi viết bằng chữ: "Nxf6+" → "Mã f6", "exd5" → "Tốt d5", "O-O" → "nhập thành gần". */
export function sanVi(san: string): string {
  const s = san.replace(/[+#!?]/g, '');
  if (s.startsWith('O-O-O')) return 'nhập thành xa';
  if (s.startsWith('O-O')) return 'nhập thành gần';
  const đích = /([a-h][1-8])(=?[QRBN])?$/.exec(s);
  const ô = đích?.[1] ?? s;
  const phong = đích?.[2] ? ` phong ${PIECE[đích[2].replace('=', '')]}` : '';
  const quân = PIECE[s[0]] ?? 'Tốt';
  return `${quân} ${ô}${phong}`;
}

const moveNo = (m: ReviewedMove) => Math.ceil(m.ply / 2);

/** Thế cờ nhìn từ phía `side`, nói bằng lời. */
function thếCờ(score: ReviewedMove['scoreAfter'], side: Side): string {
  const w = winPercent(score);
  const p = side === 'w' ? w : 100 - w;
  if (p >= 80) return 'thắng rõ';
  if (p >= 60) return 'đang hơn';
  if (p >= 40) return 'ngang ngửa';
  if (p >= 20) return 'đang kém';
  return 'thua rõ';
}

const HỎNG: MoveClass[] = ['blunder', 'mistake', 'miss'];

export interface Takeaway {
  text: string;
  /** Nước liên quan, để bấm vào là xem. */
  ply?: number;
}

/**
 * Tối đa ba điều, theo thứ tự quan trọng:
 * 1. Nước ngoặt — nước hỏng nặng nhất của bạn, và nên đi gì.
 * 2. Giai đoạn — chơi chắc nhất / hụt nhất ở khai cuộc, trung cuộc hay tàn cuộc.
 * 3. Cơ hội — đối thủ đi hỏng mà bạn chưa tận dụng (hoặc đã tận dụng tốt).
 * `me` null (hai người một máy): nói về bên Trắng.
 */
export function takeaways(r: ReviewResult, me: Side | null): Takeaway[] {
  const side: Side = me ?? 'w';
  const ban = me ? 'bạn' : 'Trắng';
  const mine = r.moves.filter((m) => m.side === side);
  const theirs = r.moves.filter((m) => m.side !== side);
  const out: Takeaway[] = [];

  // 1. Nước ngoặt
  const tệ = mine.filter((m) => HỎNG.includes(m.cls)).sort((a, b) => a.accuracy - b.accuracy)[0];
  if (tệ) {
    const tốt = tệ.best[0];
    const nên = tốt && tốt.uci !== tệ.uci ? `, lẽ ra nên đi ${sanVi(tốt.san)}` : '';
    const trước = thếCờ(tệ.scoreBefore, side);
    const sau = thếCờ(tệ.scoreAfter, side);
    const đổi = trước !== sau ? ` Thế cờ từ ${trước} thành ${sau}.` : '';
    out.push({
      text: `Nước ngoặt ở nước ${moveNo(tệ)}: ${ban} đi ${sanVi(tệ.san)}${nên}.${đổi}`,
      ply: tệ.ply,
    });
  } else if (mine.length) {
    out.push({ text: `${me ? 'Bạn' : 'Trắng'} không có nước hỏng đáng kể nào — ván rất sạch.` });
  }

  // 2. Giai đoạn (theo số nước cả ván: tới nước 12 là khai cuộc, sau nước 35 là tàn cuộc)
  const giaiĐoạn: [string, ReviewedMove[]][] = [
    ['khai cuộc', mine.filter((m) => moveNo(m) <= 12)],
    ['trung cuộc', mine.filter((m) => moveNo(m) > 12 && moveNo(m) <= 35)],
    ['tàn cuộc', mine.filter((m) => moveNo(m) > 35)],
  ];
  const tb = giaiĐoạn
    .filter(([, ms]) => ms.length >= 3)
    .map(([tên, ms]) => [tên, Math.round(ms.reduce((a, m) => a + m.accuracy, 0) / ms.length)] as const);
  if (tb.length >= 2) {
    const xếp = [...tb].sort((a, b) => b[1] - a[1]);
    const [tốtNhất, kémNhất] = [xếp[0], xếp[xếp.length - 1]];
    out.push({
      text:
        tốtNhất[1] - kémNhất[1] >= 10
          ? `${me ? 'Bạn' : 'Trắng'} chơi chắc nhất ở ${tốtNhất[0]} (${tốtNhất[1]}%) nhưng hụt hơi ở ${kémNhất[0]} (${kémNhất[1]}%).`
          : `Độ chính xác đều tay qua các giai đoạn, khoảng ${Math.round(tb.reduce((a, t) => a + t[1], 0) / tb.length)}%.`,
    });
  }

  // 3. Cơ hội: đối thủ hỏng mà nước trả lời của mình không phải nước tốt nhất/tốt
  const bỏLỡ = theirs.filter((t) => {
    if (!HỎNG.includes(t.cls)) return false;
    const đáp = r.moves[t.ply]; // nước ngay sau của mình
    return đáp && đáp.side === side && !['best', 'good'].includes(đáp.cls);
  });
  const đốiHỏng = theirs.filter((t) => HỎNG.includes(t.cls)).length;
  if (bỏLỡ.length) {
    const t = bỏLỡ[0];
    const đáp = r.moves[t.ply];
    const nên = đáp.best[0] ? `; nên đáp bằng ${sanVi(đáp.best[0].san)}` : '';
    out.push({
      text: `Ở nước ${moveNo(t)} đối thủ đi hỏng (${sanVi(t.san)}) nhưng ${ban} chưa tận dụng${nên}.`,
      ply: đáp.ply,
    });
  } else if (đốiHỏng) {
    out.push({ text: `Đối thủ đi hỏng ${đốiHỏng} lần và lần nào ${ban} cũng đáp trả chính xác.` });
  } else if (r.opening) {
    out.push({ text: `Khai cuộc ${r.opening.name} (${r.opening.eco}): cả hai bên theo đúng sách tới nước ${Math.ceil(r.opening.ply / 2)}.` });
  }

  return out.slice(0, 3);
}
