// Nói nước đi và thế cờ bằng lời, cho người mới đọc được.

import type { Side } from '../../shared/chess.ts';
import { winPercent, type Score } from '../../shared/winrate.ts';

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

/** Thế cờ nhìn từ phía `side`, nói bằng lời (điểm engine theo Trắng). */
export function thếCờ(score: Score, side: Side): string {
  const w = winPercent(score);
  const p = side === 'w' ? w : 100 - w;
  if (p >= 80) return 'thắng rõ';
  if (p >= 60) return 'đang hơn';
  if (p >= 40) return 'ngang ngửa';
  if (p >= 20) return 'đang kém';
  return 'thua rõ';
}
