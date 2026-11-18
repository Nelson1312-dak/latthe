// Hộp "đăng nhập để lưu" bật lên khi người chưa đăng nhập bấm Chơi.
//
// Không bắt buộc: chơi với máy chạy ngay trong trình duyệt, không cần tài
// khoản. Hộp này chỉ mời đăng nhập đúng lúc người ta sắp có thứ đáng lưu (một
// ván cờ), và luôn có lối "chơi luôn". Chọn chơi luôn rồi thì cả phiên này
// không hỏi lại nữa.

import { auth } from './session.ts';

export interface Gate {
  title: string;
  text: string;
  /** Nhãn của lối không đăng nhập; null là bắt buộc đăng nhập (ví dụ đấu online). */
  guest: string | null;
  /** Việc làm tiếp sau khi đăng nhập xong, hoặc khi chọn chơi luôn. */
  then: () => void;
}

let gate: Gate | null = null;

export const currentGate = (): Gate | null => gate;

export function closeGate(): void {
  gate = null;
}

function guestChosen(): boolean {
  try {
    return sessionStorage.getItem('guest') === '1';
  } catch {
    return false;
  }
}

export function chooseGuest(): void {
  try {
    sessionStorage.setItem('guest', '1');
  } catch {
    /* chế độ riêng tư: lần sau hỏi lại, không sao */
  }
}

/**
 * Cần mời đăng nhập không. Không mời khi: đã đăng nhập, server chưa bật đăng
 * nhập Google, không nối được server, hoặc phiên này đã chọn chơi luôn.
 */
export function shouldAskLogin(): boolean {
  return Boolean(auth.googleClientId) && !auth.user && !auth.offline && !guestChosen();
}

export function openGate(g: Gate): void {
  gate = g;
}
