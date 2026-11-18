# Thành phần của người khác

Lật Cờ phát hành theo **GPL-3.0-or-later** (xem `LICENSE`). Lý do chọn giấy phép này:
Stockfish là GPL-3, và đưa engine lên web được tính là phân phối, nên mã nguồn của app
cũng phải công khai theo cùng giấy phép. Mã nguồn: https://github.com/Nelson1312-dak/latthe

| Thành phần | Giấy phép | Dùng vào việc gì |
|---|---|---|
| [Stockfish](https://stockfishchess.org/) 19 (bản WASM của [nmrugg](https://github.com/nmrugg/stockfish.js)) | **GPL-3.0-or-later** | Engine chấm nước và đấu với máy |
| [chess.js](https://github.com/jhlywa/chess.js) 1.4.0 | BSD-2-Clause | Luật cờ |
| [cm-chessboard](https://github.com/shaack/cm-chessboard) 8.15.4 | MIT | Nguồn của bộ quân (phần vẽ bàn cờ là mã của dự án này) |
| Bộ quân **cburnett** | CC BY-SA 3.0 | Hình quân cờ và logo (con Mã). Tác giả: [Cburnett](https://en.wikipedia.org/wiki/User:Cburnett), [Rfc1394](https://en.wikipedia.org/wiki/User:Rfc1394) trên Wikimedia Commons, chỉnh sửa bởi shaack. App bọc lại từng quân thành `<symbol>` (hình giữ nguyên). Xem `public/pieces/LICENSE.txt` |
| Bộ quân **merida** (Armando Hernandez Marroquin), **mpchess** (Maxime Chupin) | GPLv2+ / GPLv3+ | Lấy từ [lichess-org/lila](https://github.com/lichess-org/lila) `public/piece`. Gom thành sprite, đổi id/class (hình giữ nguyên) |
| Bộ quân **celtic**, **fantasy**, **spatial** (Maurizio Monge) | MIT | Như trên; toàn văn MIT trong `public/pieces/sets/LICENSES.txt` |
| Bộ quân **chessnut** (Alexis Luengas) | Apache-2.0 | Như trên; toàn văn `public/pieces/sets/LICENSE-Apache-2.0.txt` |
| Bộ quân **papercut** (Nikolay Anzarov) | CC BY 4.0 | Như trên. Chi tiết nguồn, giấy phép, chỗ đã sửa: `public/pieces/sets/LICENSES.txt` |
| [IBM Plex](https://github.com/IBM/plex) Sans / Mono / Serif | OFL-1.1 | Chữ |
| [jose](https://github.com/panva/jose) 6.2.17 | MIT | Xác minh chữ ký token Google |
| [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), TypeScript | MIT / Apache-2.0 | Công cụ phát triển, không nằm trong bản chạy |

Âm thanh trong app do chính app tổng hợp bằng WebAudio (`src/app/sound.ts`), không lấy từ đâu.
