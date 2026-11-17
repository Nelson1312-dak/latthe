// Nhịp chuyển động của bàn cờ. Để riêng một file không đụng tới DOM, để test
// chạy trong Node đọc được.

/**
 * Thời gian quân trượt tới ô đích. PHẢI bằng --t-piece trong src/ui/tokens.css
 * (tests/premove.test.ts canh chuyện này): màn hình chờ đúng chừng này rồi mới
 * vẽ lại, chờ ngắn hơn là cắt ngang lúc quân đang trượt.
 */
export const PIECE_SLIDE_MS = 240;
