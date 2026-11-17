# Plan triển khai: Game cờ vua đào tạo có AI tư vấn

Lập ngày 16/11/2026, cập nhật cùng ngày theo 2 chế độ chơi, server trên máy này và đăng nhập Google.
Mục tiêu và nguyên tắc ở [PLAN.md](PLAN.md); giao diện ở [DESIGN.md](DESIGN.md). File này là **cách làm cụ thể**.

## 1. Môi trường đã kiểm tra

| Thứ | Hiện có | Ghi chú |
|---|---|---|
| Node / npm | 22.15.0 / 10.9.2 | Có sẵn SQLite (`node:sqlite`, SQLite 3.49.1) và giải nén zstd |
| Ollama | 0.40.14, đang chạy | `qwen3:8b` Q4_K_M, tắt được "thinking", ngữ cảnh 40k |
| GPU | GTX 1660 Super 6 GB | Model 5,2 GB, vừa đủ |
| Ổ D: | còn trống 235 GB | Database puzzle ước tính 1,5–2 GB |
| Tunnel | ngrok và cloudflared đều đã cài | |
| Docker | `postgres_latthe` đang chạy | Là database của dự án giao dịch, **không dùng chung** |
| Dữ liệu puzzle Lichess | 310 MB nén, cập nhật 01/11/2026 | Nạp toàn bộ vào SQLite |

### Trả lời: build database ngay trên máy này được không?

Được, và không cần cài gì thêm. Node 22 có sẵn SQLite: cả database là **một file** `data/chess.db`, sao lưu bằng cách chép file. Đã chạy thử trên máy này. Không dùng chung Postgres trong Docker vì đó là database của dự án giao dịch; tách riêng thì hỏng bên này không ảnh hưởng bên kia.

Database này chứa thứ làm nên "học không giới hạn":
- **Toàn bộ kho puzzle Lichess** (vài triệu bài, có chủ đề và độ khó), lấy bài theo rating và chủ đề.
- **Thẻ ôn tập** sinh từ chính lỗi sai của người chơi.
- **Bảng tên khai cuộc** (khoảng 3.500 dòng, dùng để nhận nước "Sách" và hiện tên khai cuộc).
- **Lưu đệm lời bình HLV**: thế cờ nào đã giải thích rồi thì lần sau trả ngay, dùng chung cho mọi người.

## 2. Thư viện

| Gói | Phiên bản | Giấy phép | Dùng cho |
|---|---|---|---|
| vite | 8.3.8 | MIT | Dev server, build |
| @fontsource/ibm-plex-{sans,mono,serif} | 5.3.0 | OFL-1.1 | Font tự host, đủ dấu tiếng Việt |
| typescript | 7.0.2 | Apache-2.0 | |
| vitest | 5.1.0 | MIT | Unit test |
| @playwright/test | 1.65.1 | Apache-2.0 | Test end-to-end, chụp ảnh duyệt design |
| chess.js | 1.4.0 | BSD-2 | Luật cờ, SAN/FEN/PGN (dùng cả ở trình duyệt và server) |
| cm-chessboard | 8.15.4 | MIT | Vẽ bàn cờ SVG, kéo thả, mũi tên, đánh dấu ô |
| stockfish | 19.0.1 | **GPL-3** | Engine WASM bản `lite-single` (1,8 MB) |
| ws | 8.23.0 | MIT | WebSocket phía server |
| jose | 6.2.17 | MIT | Xác minh token đăng nhập Google |

Server chạy TypeScript trực tiếp bằng Node (`--experimental-strip-types`), không cần bước build riêng. Không dùng framework UI.

Đăng nhập dùng thư viện "Sign in with Google" của Google, tải từ `accounts.google.com` (bắt buộc phải tải từ Google).

## 3. Cấu trúc mã

```
index.html
vite.config.ts            dev: proxy /api và /ws sang server 8787
scripts/
  copy-engine.mjs         chép stockfish lite-single vào public/engine/
  import-puzzles.mjs      tải + nạp puzzle Lichess vào SQLite
  import-openings.mjs     nạp bảng tên khai cuộc
  backup-db.ps1           sao lưu hằng đêm
shared/                   dùng chung trình duyệt + server
  chess.ts  winrate.ts  protocol.ts (tin nhắn WebSocket)
  advisor/  motifs/ facts.ts prompt.ts validate.ts templates.ts
server/
  main.ts                 HTTP + WebSocket + phục vụ dist/
  db.ts  migrations/*.sql
  auth.ts                 Google + phiên đăng nhập
  api/                    me, games, reviews, cards, puzzles, lessons, advisor
  live/                   rooms.ts, clock.ts (ván online)
  advisor/queue.ts        hàng đợi gọi Ollama
src/
  main.ts
  app/        router.ts, store.ts, api.ts (gọi server), session.ts
  ui/         tokens.css, icons.ts, components/, screens/, specimen/ (trang mẫu)
  board/      BoardView.ts
  engine/     uci.ts, engine.ts, levels.ts
  analysis/   review.ts
  advisor/    client.ts (gửi dữ kiện, nhận lời bình stream)
  training/   srs.ts, puzzles.ts, lessons/, recommend.ts
  live/       socket.ts, clock-view.ts
public/
  fonts/ pieces/ sounds/
  engine/     (sinh tự động, không commit)
data/         chess.db (không commit)
tests/        fixtures/ (thế cờ mẫu, ván PGN mẫu)
```

## 4. Thiết kế các phần chính

### 4.1 Database (SQLite)

| Bảng | Nội dung |
|---|---|
| `users` | `id`, `google_sub` (duy nhất), tên hiển thị, avatar, rating puzzle, ngày tạo. **Không lưu email** |
| `sessions` | mã phiên (lưu dạng băm), `user_id`, hạn |
| `games` | `id`, `mode` (bot/online), trắng, đen, cấp máy, thời gian, PGN, kết quả, lý do kết thúc, trạng thái (`waiting`, `live`, `ended`), mốc thời gian |
| `game_players` | `game_id`, `user_id`, màu quân, `visible` |
| `reviews` | `game_id`, kết quả phân tích từng nước (JSON), độ chính xác hai bên |
| `cards` | thẻ ôn tập: `user_id`, FEN, nước đã đi, nước đúng, thẻ mô-típ, hộp Leitner, ngày đến hạn, số lần sai |
| `puzzles` + `puzzle_themes` | kho puzzle; chỉ mục theo (chủ đề, rating) |
| `puzzle_attempts` | `user_id`, `puzzle_id`, đúng/sai, rating sau, thời điểm |
| `lesson_progress` | bài, bước, ngày xong |
| `openings` | mã ECO, tên, chuỗi nước, FEN |
| `advisor_cache` | khóa = băm(dữ kiện + phiên bản prompt), lời bình, nguồn (LLM/câu mẫu) |

**Giới hạn lưu trữ** (hằng số, chỉnh được):
- Ván online: **5 ván gần nhất mỗi người**. Khi một ván kết thúc, ván cũ hơn thứ 5 của người đó bị ẩn (`visible = 0`); ván bị ẩn với cả hai người thì xóa hẳn cùng phần review.
- Ván với máy: 20 ván gần nhất, cùng cơ chế.
- Thẻ ôn tập: tối đa 2.000 thẻ mỗi người; vượt thì bỏ thẻ đã thuộc lâu nhất.

Migration đánh số `001_init.sql`, `002_...`; server tự chạy migration còn thiếu lúc khởi động.

### 4.2 Đăng nhập Google

1. Trình duyệt hiện nút "Sign in with Google", nhận về ID token.
2. `POST /api/auth/google` → server xác minh chữ ký bằng khóa công khai của Google (`jose`), kiểm tra `aud` = client ID, `iss`, hạn.
3. Tạo/cập nhật user theo `google_sub`, đặt cookie phiên `httpOnly; Secure; SameSite=Lax`, hạn 30 ngày.
4. WebSocket xác thực bằng cookie lúc kết nối.

Google yêu cầu origin cố định: `http://localhost:5173` khi phát triển, tên miền tunnel khi chạy thật. Để test tự động có đăng nhập giả `AUTH_DEV=1`, **chỉ** bật được khi server nghe trên localhost.

### 4.3 Engine (chạy ở trình duyệt)

- Web Worker chạy Stockfish; `uci.ts` xếp hàng lệnh, mỗi lần một lệnh `go`, lệnh mới thì `stop` lệnh cũ.
- `analyse(fen, { movetimeMs | depth, multipv })` → `{ lines: [{ pv, cp?, mate? }], depth }`, điểm quy về góc nhìn bên Trắng.
- Cấp độ: `UCI_Elo` của Stockfish thấp nhất 1320, quá mạnh với người mới, nên:

| Cấp | Cách làm |
|---|---|
| 1–3 | MultiPV 5, thời gian ngắn, **cố ý chọn nước kém** theo xác suất (cấp 1 hay để hở quân, cấp 3 hiếm khi) |
| 4–8 | `UCI_LimitStrength` với Elo 1350 / 1550 / 1800 / 2100 / 2500 |

### 4.4 Chấm nước đi

Công thức của Lichess:
- `winningChances(cp) = 2 / (1 + exp(-0.00368208 · cp)) − 1` (từ −1 đến 1); chiếu hết = ±1.
- Mất cơ hội thắng `Δ` của bên vừa đi: Thiếu chính xác ≥ 0,1; Sai ≥ 0,2; Sai nghiêm trọng ≥ 0,3; trùng nước tốt nhất là Tốt nhất; có trong bảng khai cuộc là Sách; còn lại Tốt. "Bỏ lỡ" khi có chiếu hết hoặc thắng quân mà không đi.
- Độ chính xác nước: `103.1668 · exp(−0.04354 · Δ%) − 3.1669`; cả ván là trung bình.

Review: mỗi thế cờ phân tích **một lần**, MultiPV 3, khoảng 600 ms/thế → ván 40 nước khoảng 50 giây, chạy ở máy người chơi, kết quả gửi lên lưu vào `reviews`.

### 4.5 Bộ nhận diện mô-típ (`shared/advisor/motifs/`)

Hàm thuần `(trước, nướcĐi, sau, phânTích) → Tag | null`, tính bằng chess.js:

| Thẻ | Điều kiện |
|---|---|
| `hanging` | Sau nước đi có quân mình bị tấn công mà không được bảo vệ đủ |
| `fork` | Nước tốt nhất của đối phương tấn công cùng lúc ≥ 2 mục tiêu giá trị |
| `pin` / `skewer` | Quân bị chặn trên đường thẳng/chéo tới Vua hoặc quân giá trị hơn |
| `missedMate` | Có chiếu hết trong 1–3 nước mà không đi |
| `backRank` | Vua kẹt hàng cuối, có Xe/Hậu đối phương nhắm vào |
| `badTrade` | Đổi quân mất vật chất (giá trị 1/3/3/5/9) |
| `missedCapture` | Bỏ qua quân không được bảo vệ |

Mỗi thẻ có thế cờ mẫu dương tính và âm tính trong `tests/fixtures/motifs/`.

### 4.6 HLV AI

**Luồng:** trình duyệt có phân tích engine → tính thẻ mô-típ → gói dữ kiện JSON → `POST /api/advisor/explain` → server kiểm tra lưu đệm → hàng đợi Ollama → kiểm duyệt → trả lời dạng stream.

Ví dụ dữ kiện:
```json
{ "ben": "Trắng", "nuocDaDi": "Nxe5", "xepLoai": "Sai nghiêm trọng",
  "nuocTotHon": ["Nf3", "d4"], "dongChinh": ["Nxe5", "Nxe5", "Qxe5"],
  "the": [{ "loai": "hanging", "quan": "Mã", "o": "e5" }],
  "vatChat": { "truoc": 0, "sau": -3 } }
```

**Gọi Ollama** (chỉ server gọi, Ollama không bao giờ mở ra ngoài): `/api/chat`, `qwen3:8b`, `think: false`, `temperature: 0.3`, `num_predict: 220`, `format` là JSON schema `{ giaiThich, yTuongChinh }`. Prompt tiếng Việt, giọng thầy giáo, cấm nêu nước đi hay con số ngoài dữ kiện, tối đa 3 câu.

**Kiểm duyệt** — không đạt điều nào là dùng câu mẫu:
1. Mọi nước SAN trong câu trả lời thuộc tập cho phép.
2. Mọi tên ô (a1–h8) có trong dữ kiện.
3. Không có số liệu không có trong dữ kiện.
4. Đúng schema, đúng độ dài, là tiếng Việt.

**Hàng đợi** (một GPU dùng chung cho mọi người): chạy 1 yêu cầu một lúc, hàng chờ tối đa 20, quá 20 giây thì trả câu mẫu; mỗi người tối đa 60 lời bình mỗi giờ.

**Công bằng khi chơi online:** server từ chối mọi yêu cầu HLV của người đang có ván online `live`, và giao diện ẩn thanh đánh giá, gợi ý trong ván online.

**Gợi ý 3 nấc** (chỉ khi chơi với máy): nấc 1 lấy từ thẻ mô-típ của nước tốt nhất, nấc 2 tô ô quân cần đi, nấc 3 vẽ mũi tên.

### 4.7 Học không giới hạn

- **Thẻ ôn tập** (`srs.ts`): mỗi nước Sai/Sai nghiêm trọng/Bỏ lỡ trong ván đã review (cả ván với máy và ván online) tạo một thẻ "Tìm nước tốt hơn". Hộp Leitner 1–5 với khoảng cách 1, 3, 7, 16, 35 ngày; giải đúng lên một hộp, sai về hộp 1.
- **Kho puzzle**: CSV Lichess có `FEN, Moves, Rating, Themes, Popularity, NbPlays`. Lưu ý `FEN` là thế cờ *trước* nước của đối phương, nước đầu trong `Moves` là của đối phương. Script nạp toàn bộ, bỏ bài độ phổ biến thấp. Lấy bài: chọn ngẫu nhiên một mốc rating trong khoảng ±150 quanh rating người chơi, lấy bài gần nhất theo chỉ mục, bỏ bài đã làm.
- **Rating puzzle**: Elo đơn giản, K = 40 trong 20 bài đầu rồi về 20.
- **"Ôn tập hôm nay"**: thẻ lỗi đến hạn trước, sau đó puzzle thuộc chủ đề người chơi sai nhiều nhất trong 10 ván gần nhất, rồi trộn ngẫu nhiên.
- **Bài học**: khoảng 30 bài, dữ liệu TS, mỗi bước `{ fen, deBai, loiGiai, goiY }`.

### 4.8 Ván online

- **Tạo ván**: chọn thời gian và màu quân (trắng/đen/ngẫu nhiên) → nhận link `/#/v/<mã>`. Người mở link (đã đăng nhập) vào ván. Người tạo có thể hủy khi chưa ai vào.
- **Server là trọng tài**: kiểm tra lượt và tính hợp lệ của từng nước bằng chess.js; ghi mỗi nước vào database ngay, để server khởi động lại vẫn khôi phục được ván.
- **Đồng hồ** do server tính (đồng hồ đơn điệu), cộng giờ sau mỗi nước; trình duyệt chỉ hiển thị và bù độ trễ.
- **Các tình huống:** hủy ván nếu chưa ai đi nước đầu sau 30 giây; mất kết nối được 60 giây để vào lại, quá hạn thì đối thủ được xử thắng; đầu hàng; đề nghị hòa / chấp nhận / từ chối; hết giờ (nếu bên kia không đủ quân chiếu hết thì hòa); các luật hòa tự động.
- **Tin nhắn WebSocket** (`shared/protocol.ts`, JSON): `join`, `move {uci, ply}`, `resign`, `draw-offer`, `draw-answer`, `sync` (gửi lại toàn bộ trạng thái khi vào lại). Server từ chối nước có `ply` sai để tránh gửi trùng.
- **Sau ván**: hộp kết quả có nút "Xem lại ván" → màn Review với HLV, như chế độ 1.

### 4.9 Vận hành trên máy này

- **Dev**: `npm run dev` chạy Vite (5173) + server (8787) cùng lúc, Vite chuyển `/api` và `/ws` sang server.
- **Chạy thật**: `npm run build` → server phục vụ `dist/` ở cổng 8787; tunnel trỏ vào 8787 với tên miền cố định.
- **Tự khởi động** cùng Windows bằng Task Scheduler, có giám sát tự chạy lại khi server chết.
- **Sao lưu**: hằng đêm `VACUUM INTO` ra thư mục ngoài repo, giữ 14 bản; bảng puzzle không cần sao lưu vì nạp lại được.

## 5. Việc từng giai đoạn

Mỗi giai đoạn: làm → test + kiểm tra trên trình duyệt → commit. Cỡ việc: S nhỏ, M vừa, L lớn.

### GĐ0 — Design system (L) — **đã làm, chờ bạn duyệt**
Chi tiết ở DESIGN.md mục 8.
- [x] Khung Vite 8 + TS 7 + Vitest; dọn `.gitignore`, `.gitattributes`, `.claude/launch.json`, bỏ `.vercelignore` của dự án cũ
- [x] `tokens.css` (sáng/tối), font IBM Plex tự host, bộ quân cburnett, 26 icon tự vẽ
- [x] Bàn cờ SVG (`src/board/Board.ts`) với 3 chủ đề màu, đánh dấu ô, nước hợp lệ, Vua bị chiếu, mũi tên, huy hiệu xếp loại
- [x] Bộ component (`src/ui/components/`) + trang mẫu `/#/thiet-ke`
- [x] 5 màn hình tĩnh với dữ liệu thật do Stockfish phân tích (`npm run fixtures`)
- [x] `npm run shots` chụp 24 ảnh; `npm run check:design` tự rà danh sách cấm
- [x] Đã chạy: `shared/winrate.ts` và `shared/fen.ts` có unit test (17 test)
- [x] **Vòng tút lại sau lần duyệt đầu** (bạn nhận xét "vẫn hơi AI"): bỏ kiểu mỗi mẩu
      thông tin một thẻ bo góc, gộp về một mặt nền mỗi cột chia bằng nét kẻ; bỏ ô số liệu
      kiểu bảng điều khiển; bỏ lời chào ở trang chủ; nước đi viết bằng ký hiệu hình; lời bình
      chuyển sang chữ có chân, trình bày như chú thích bên lề sách cờ; bên cầm quân hiện bằng
      con Vua nhỏ thay cho ô vuông tô màu (bị đọc nhầm thành ô tích chọn); việc phụ gom thành
      nhóm nút dính liền
- **Xong khi:** bạn duyệt giao diện. Chưa duyệt thì chưa sang GĐ1.

Những gì GĐ0 **chưa** có, đúng như kế hoạch: chưa đi được quân, chưa có engine chạy trong trình duyệt,
chưa có server, chưa có đăng nhập. Các màn hình là bản dựng tĩnh để chốt giao diện.

### GĐ1 — Server, database, đăng nhập (M) — **đã làm**
- [x] `server/main.ts`, `db.ts`, `auth.ts`, migration `001_init.sql`, phục vụ `dist/`
- [x] Đăng nhập Google + phiên + `/api/me`; đăng nhập thử cho lúc phát triển
- [x] [docs/GOOGLE-LOGIN.md](GOOGLE-LOGIN.md): hướng dẫn bạn tự tạo OAuth client ID
- [x] Màn Tài khoản, nav hiện tên người đăng nhập, đăng xuất
- [x] 23 test mới: xác minh token (sai `aud`, hết hạn, sai chữ ký, sai `iss` đều bị từ chối), phiên, cookie, migration
- **Còn lại để bạn làm:** đăng nhập bằng tài khoản Google thật (cần Client ID của bạn).
  Mình đã chạy thử hết phần còn lại: đăng nhập thử, phiên sống qua lần khởi động lại server, đăng xuất.

Ba chỗ vấp khi làm, đã sửa:
- Server đọc `PORT` thì bị trình xem trước của IDE đặt đè thành cổng của Vite; đổi sang `API_PORT`.
- Trên Windows, chạy `node.exe` qua shell bị hỏng vì đường dẫn có dấu cách.
- Vite nghe trên `::1`, nên gọi `127.0.0.1:5173` bị từ chối; phải dùng `localhost`.

### GĐ2 — Bàn cờ chơi được (M) — **đã làm**
- [x] `shared/chess.ts` + 25 test: nhập thành (cả hai bên, và các trường hợp bị cấm), bắt tốt
      qua đường (kể cả hết quyền sau một nước), phong cấp, bốn kiểu hòa, chiếu hết, PGN
- [x] `src/board/BoardView.ts`: bấm-chọn, kéo-thả, đi bằng bàn phím (mũi tên + Enter, Esc để bỏ chọn)
- [x] Màn `#/choi` chơi thật, hai người một máy; hộp chọn quân phong cấp; lật bàn; lùi nước
- [x] Sổ nước đi, tua lại bằng |◀ ◀ ▶ ▶|; đi quân khi đang tua thì cắt bỏ phần sau
- [x] Âm thanh tự tổng hợp bằng WebAudio (`src/app/sound.ts`) — không dùng file ngoài nên
      không vướng giấy phép; có nút bật/tắt, nhớ lựa chọn
- **Đã chạy thử trong trình duyệt:** đi quân, từ chối nước sai, không cầm được quân đối phương,
  bắt tốt qua đường, phong cấp thành Mã (`gxh8=N`), lật bàn rồi đi tiếp (toạ độ vẫn đúng),
  chiếu hết (`Qh4#` → "Đen thắng · chiếu hết"), bàn cờ khoá sau khi hết ván, tua về đầu và về cuối.

Hai lỗi phải sửa khi làm:
- Ban đầu dựng lại thế cờ từ FEN sau mỗi nước, nên mất lịch sử: luật lặp ba lần không bao giờ
  phát hiện được và PGN xuất ra rỗng. Phải giữ một ván đầy đủ từ đầu.
- Kiểu "ô cờ" có hai định nghĩa khác nhau (chuỗi bất kỳ ở `fen.ts`, kiểu chặt ở chess.js).
  Gộp về một kiểu chặt trong `shared/fen.ts`, giờ gõ nhầm `e9` là lỗi ngay khi biên dịch.

### GĐ3 — Chơi với máy (M) — **đã làm**
- [x] **Giấy phép đã chốt: GPL-3.0-or-later.** Thêm `LICENSE` và `THIRD-PARTY.md`; app có dòng
      chân trang mời xem mã nguồn (GPL-3 bắt buộc điều này với người nhận bản chạy)
- [x] Bản dựng mang theo engine (bỏ cờ `WITH_ENGINE`, không cần nữa)
- [x] `src/engine/uci.ts` (đọc dòng engine, đổi góc nhìn điểm số), `levels.ts` (8 cấp),
      `engine.ts` (Worker + hàng đợi lệnh) — 18 test
- [x] Màn `#/choi`: chọn đấu với máy hay hai người, chọn cấp, chọn bên cầm quân,
      thanh đánh giá bật/tắt, "Đi lại" lùi hai nước để vẫn đến lượt mình
- [x] Lưu ván lên server khi kết thúc, giữ 20 ván gần nhất (`server/games.ts`, 11 test)

**Đo thật, không phỏng đoán:** ở thế cờ có đòn ăn Hậu rõ ràng (`Nxf7+`, hơn 29 điểm),
cấp 1 bỏ lỡ **12/12 lần** (thường đi `Ng6` để hở Mã), cấp 4 tìm ra 4/4, cấp 8 tìm ra 6/6.
Đã chơi thử trong trình duyệt: máy đáp nước, giao diện không đứng khi máy nghĩ, "Đi lại"
trả đúng lượt, thanh đánh giá chạy, ván kết thúc được lưu lên server.

### GĐ4 — Review (M) — **đã làm**
- [x] `scripts/import-openings.mjs`: 3.835 thế cờ khai cuộc từ Lichess (CC0) → `public/data/openings.json`,
      tải riêng khi vào màn Xem lại nên không nặng gói chính
- [x] `src/analysis/review.ts`: chấm cả ván, chạy nền, có thanh tiến độ, dừng được giữa chừng — 12 test
- [x] `server/reviews.ts`: lưu kết quả chấm, sinh thẻ ôn tập theo hộp Leitner — 17 test
- [x] Màn Xem lại dùng dữ liệu thật: chọn ván đã lưu hoặc chấm ngay ván vừa chơi, huy hiệu xếp loại,
      biểu đồ diễn biến bấm được, nhảy tới nước hỏng, nước tốt hơn vẽ bằng mũi tên
- [x] Chơi xong có nút "Xem lại ván" ngay trên màn Chơi

**Đo thật:** ván 17 nước (35 thế cờ) chấm hết **18,2 giây** — dưới mốc 60 giây. Mở lại lần hai
mất 0,2 giây vì đọc kết quả đã lưu. Kiểm chứng chéo: màn Xem lại chấm ra `11.Qg4 ?? −7.1`,
nước tốt hơn `Qd1`, độ chính xác Trắng 90,6% — **khớp đúng** với dữ liệu mẫu sinh độc lập
bằng Stockfish ở GĐ0 (`npm run fixtures`). Khai cuộc nhận đúng: C50 Giuoco Pianissimo.

Bốn chỗ vấp khi làm:
- Nút nằm lồng trong nút: HTML không cho phép, trình duyệt tự cắt DOM nên bấm không ăn.
- `.gitignore` có dòng `data/` chặn luôn `public/data/` — bảng khai cuộc sẽ không lên được web.
  Đổi thành `/data/` để chỉ chặn database ở thư mục gốc.
- Server Node không tự nạp lại mã: sửa API xong phải khởi động lại `npm run dev`.
- Lại dính bẫy "đổi mỗi phần sau dấu # thì trang không tải lại" khi viết script kiểm thử.

### GĐ5 — HLV AI (L)
- [ ] Các mô-típ + thế cờ mẫu dương/âm tính
- [ ] `facts.ts`, `templates.ts`, `prompt.ts`, `validate.ts` + test kiểm duyệt (câu bịa nước, bịa ô, bịa số đều bị chặn)
- [ ] `server/advisor/queue.ts`: hàng đợi, giới hạn, lưu đệm, stream
- [ ] `CoachPanel`, nút "Vì sao?" trong Review, gợi ý 3 nấc khi chơi với máy
- [ ] `npm run eval:advisor`: chạy 50 thế cờ mẫu, in tỉ lệ bị chặn, thời gian, xuất câu trả lời ra file để đọc tay
- **Kiểm tra:** không câu nào nêu sai nước lọt qua kiểm duyệt; tắt Ollama thì vẫn có lời bình bằng câu mẫu; câu đầu tiên hiện ra dưới 5 giây khi hàng đợi trống.

### GĐ6 — Học không giới hạn (L) — **xong 17/11/2026**
- [x] `scripts/import-puzzles.mjs`: tải 310 MB, lọc lấy bài độ khó 600–1800 và phổ biến
- [x] `server/puzzles.ts` + 21 test: lấy bài theo chỉ mục, Elo với hệ số K giảm dần
- [x] Màn Ôn tập: thẻ lỗi của chính mình trước, hết thẻ mới lấy bài từ kho; gợi ý, xem lời giải
- [x] Tiến độ (trong màn Tài khoản): độ khó, chuỗi ngày luyện, thẻ theo hộp, kiểu lỗi hay gặp
- [x] Màn Sảnh thay số liệu giả bằng dữ liệu thật
- [x] 15 bài học trong 4 chương (`src/training/lessons.ts`), màn Học, đánh dấu bài đã xong
- **Kiểm tra (đã chạy):** kho **1.133.897 bài** lọc từ 6,19 triệu dòng, nạp hết trong 37 giây,
  database 255 MB. Lấy một bài **4 ms** (mốc đặt ra là dưới 50 ms). Giải một bài trên giao diện
  thì độ khó đổi 1000 → 981, chuỗi luyện lên 1 ngày. 189 test xanh, `check:design` sạch.

Kho bài tập làm mất nhiều thời gian nhất, và chẩn đoán sai một lần:
1. Mạng đứt ở 162/310 MB mà script coi như tải xong. Giờ ghi vào `.part` rồi mới đổi tên,
   và tải tiếp được bằng HTTP Range.
2. File của Lichess **không phải một khung zstd liền mạch** mà là 74 khung nối đuôi nhau
   (nén bằng pzstd), mỗi khung có một khung bỏ qua 12 byte đứng trước. Bộ giải nén của Node
   dừng ở khung bỏ qua thứ hai và báo `ZSTD_error_prefix_unknown` — đúng chỗ 33,6 MB, tức
   khoảng 32.000 bài. **Lần đầu mình đổ cho việc nối hai bản tải dở, và sai**: xoá hết tải lại
   từ đầu thì vẫn hỏng y như cũ, ở đúng byte đó. Phải tự đi theo chuỗi khung mới nạp được.
   Bài học: con số lỗi lặp lại **y hệt** sau khi đã thay dữ liệu đầu vào thì nguyên nhân không
   nằm ở dữ liệu.
3. Chạy được rồi mới thấy chậm: lấy một bài mất 282 ms. Ba chỗ, đều cùng một kiểu —
   làm việc nặng trên đường đi nóng:
   - `ORDER BY abs(rating - ?)` không dùng được chỉ mục nên quét cả chủ đề (riêng "endgame"
     634.000 dòng). Đổi sang `rating BETWEEN` quanh một mốc ngẫu nhiên rồi bốc trong nhúm nhỏ.
   - `count(*)` trên 1,13 triệu dòng và `GROUP BY` trên 2 triệu dòng, hỏi lại mỗi request.
     Nhớ kết quả một phút, vì kho chỉ đổi khi chạy lại script.
   - Mỗi request có đăng nhập đều `UPDATE users SET last_seen_at`, mà SQLite để
     `synchronous = FULL` nên mỗi lần ghi là một lần ép đĩa (~60 ms). Đổi sang `NORMAL`
     (an toàn khi đi với WAL) và năm phút mới ghi lại một lần.

   Kết quả: 282 ms → **3–4 ms**.

### GĐ7 — Chơi online (L) — **xong 17/11/2026**
- [x] `shared/protocol.ts`: các thông điệp hai bên nói với nhau
- [x] `server/live/clock.ts`: đồng hồ do server giữ, có cộng giờ; hết giờ mà đối thủ
      không đủ quân chiếu hết thì xử hòa (luật FIDE 6.9)
- [x] `server/live/rating.ts`: Elo ván đấu, tách khỏi Elo bài tập, hệ số K giảm dần
- [x] `server/live/rooms.ts`: máy trạng thái một ván — đi quân, đầu hàng, hòa, hết giờ,
      mất kết nối rồi vào lại
- [x] `server/live/queue.ts`: **hàng chờ ghép ngẫu nhiên theo Elo**, ±100 lúc đầu, mỗi
      5 giây nới thêm 40, tối đa ±800
- [x] `server/live/index.ts`: SSE + POST, ghép trận, lưu kết quả
- [x] Màn Đấu: sảnh (chọn thể thức, tìm trận, mời người quen), đang chờ, đang đánh, kết quả
- [x] Ẩn engine/HLV trong ván; **server trả 403** cho `/api/advisor/explain` khi đang có ván
- [x] Giữ 5 ván online gần nhất mỗi người, đếm riêng với ván đánh máy
- [x] 52 test mới (tổng 241)
- **Kiểm tra (đã chạy, hai trình duyệt thật):** hai tài khoản được ghép và đánh trọn ván;
  Elo đổi −20/+20 đúng chiều; Elo lệch 800↔2000 thì **không** ghép (khoảng mới ±100);
  đóng tab một bên → bên kia thấy ngay “Đối thủ mất kết nối · còn 59 giây”, mở lại trong
  hạn thì ván chạy tiếp; xin lời bình giữa ván bị trả 403; bấm “Xem lại ván” mở đúng ván.

**Vì sao SSE chứ không WebSocket.** Cần đẩy dữ liệu từ server xuống, nhưng cờ vua chỉ vài
thông điệp mỗi phút. SSE có sẵn trong `node:http`, không phải thêm thư viện nào, và
`EventSource` của trình duyệt **tự kết nối lại** khi đứt mạng — đúng cái yêu cầu "rút mạng
30 giây rồi cắm lại". Nước đi gửi lên bằng POST thường.

Mấy chỗ sai đáng ghi lại:
1. `constructor(private db: Db)` dịch được qua `tsc` nhưng Node chạy TypeScript ở chế độ
   **chỉ bóc kiểu**, mà thuộc tính khai trong tham số constructor thì phải sinh thêm mã.
   Kiểu lỗi này `tsc --noEmit` không bắt được, chỉ chạy thật mới lòi ra.
2. Đẩy trạng thái xuống khi **có người đi quân**, nhưng quên lúc **mất kết nối** — nên đối
   thủ không hề biết mình đã rớt cho tới khi có việc khác xảy ra. Thêm một lần đẩy ở chỗ
   đóng luồng và chỗ mở lại luồng.
3. Bộ định tuyến cắt hash theo `r in SCREENS`, nên `#/xem-lai?game=12` không khớp màn nào
   và rơi về Sảnh. Giờ bỏ phần `?...` trước khi tra (`src/app/route.ts`).
4. Đặt lớp CSS trùng tên `.game-result` với màn Chơi, suýt sửa chỗ này hỏng chỗ kia.
5. Sổ "5 ván online gần nhất" hỏi server đúng một lần rồi thôi, nên đánh xong quay về vẫn
   thấy sổ rỗng. Và ván đã xong thì phải bỏ khi rời màn, nếu không lần sau vào lại là thấy
   bàn cờ cũ chứ không phải sảnh.

**Còn thiếu, cần biết khi dùng thật:** hàng chờ và phòng chơi nằm trong bộ nhớ, nên server
khởi động lại giữa ván là mất ván đó (hai bên quay về sảnh, không ai bị tính thua). Lưu
phòng xuống database để khôi phục được là việc của GĐ8 nếu thấy cần.

### Sau GĐ7 — thao tác bàn cờ và rà lại thiết kế (17/11/2026)
- [x] Quân trượt 150 → 240ms, máy nghĩ 0,7–1,1 → 1,3–1,9 giây
- [x] Kéo thả thật (quân bám con trỏ), vẽ mũi tên/khoanh ô bằng chuột phải, đi trước khi
      đấu máy và đấu online — đã thử bằng chuột, bằng ngón tay (giả lập cảm ứng) và hai
      trình duyệt
- [x] Rà 16 màn hình (máy tính + điện thoại). Sửa những lỗi gốc chứ không vá từng màn:
  - nội dung có max-width mà **không căn giữa** → mọi màn dồn trái, nửa phải bỏ trống
  - chân trang đứng ngay dưới nội dung → màn ít chữ thì chân trang lơ lửng giữa màn hình
  - bàn cờ có một cột `1fr` rồi căn giữa trong cột đó → trôi xa cột bên cạnh
  - tiêu đề mục không có lề trên → dính vào dòng ngay trên (màn Tài khoản bị đè chữ)
  - hai nút trên đầu Sảnh **không gắn vào đâu**: bấm không có gì xảy ra
  - Sảnh có con số "1000" không nhãn; giờ có tên từng con số và một bài tập thật để giải
  - màn Đấu dựng lại cả trang mỗi giây cho đồng hồ → có thể nuốt mất cú bấm "Đầu hàng"
- Ảnh chụp toàn trang trên điện thoại vẽ thanh đầu/thanh dưới (sticky) vào giữa trang —
  đó là lỗi của cách chụp, không phải của trang. Chụp đúng khung màn hình mới thấy thật.
- [x] **Bàn cờ to lên**: bỏ tầng header thứ hai trên màn có bàn cờ, dồn tiêu đề và nút vào
      đầu cột phải. 1524×800: bàn cờ 470 → 622px. Nhân tiện phát hiện hộp thoại (chọn quân
      phong cấp, hỏi đầu hàng) nằm trong luồng trang chứ không phủ lên — tức là hiện tận
      cuối trang, ngoài tầm nhìn. Giờ `position: fixed`.

### Sau GĐ7 (tiếp) — bàn cờ chiếm trọn màn hình, mũi tên đúng luật (17/11/2026)
- [x] Màn đánh cờ vừa đúng một màn hình: bỏ chân trang, trang không cuộn, cột phải tự
      cuộn. Bàn cờ 1524×800 lên 610px.
- [x] Vào mục Chơi là thấy bàn cờ ngay, phần chọn đối thủ sang cột phải
- [x] Mũi tên của Mã vẽ gấp khúc chữ L như chess.com/Lichess; 10 test cho hình học mũi tên
- [x] Tỉ lệ mũi tên gọn lại theo Lichess; bỏ dòng nhắc "kéo quân…" sau nước đầu

Hai cái bẫy CSS đáng ghi lại:
1. Cột phải dùng lưới (grid) trong một ô cao cố định thì lưới **ép các khối co lại**.
   `.sheet` có `overflow: hidden` nên nó cắt cụt nội dung chứ không cho cuộn — sổ nước
   đi của màn Xem lại chỉ còn 2 dòng rưỡi, phần Tổng kết mất hẳn. Đổi sang flex với
   `flex: none` thì mỗi khối cao đúng nội dung và cả cột tự cuộn.
2. Trang không cuộn được nữa thì **tràn là mất hẳn**, không như trước là cuộn xuống vẫn
   xem được. Lần đầu đặt hụt 22px, thanh người chơi dưới bị cắt mà nhìn lướt không thấy.
   Phải đo từng phần rồi cộng dư, và thêm `max-height: 100%` làm chốt chặn.

### Sau GĐ7 (tiếp) — giao diện bàn cờ theo chess.com (17/11/2026)
- [x] Bàn cờ liền mép, bỏ viền và bo góc
- [x] Thanh người chơi: ảnh đại diện, tên + điểm, quân đã ăn xuống dòng dưới, đồng hồ
      thành ô to bên phải; bên đến lượt thì đồng hồ sáng hẳn
- [x] Đồng hồ bên không đến lượt nâng tương phản 4,36 → 6,42

**Không chép bộ quân của chess.com.** Bộ "Neo" của họ là tài sản riêng; app dùng
cburnett (CC BY-SA 3.0) như Lichess. Mặt bàn cờ cũng là màu phẳng chứ không có vân gỗ
— vân gỗ cần ảnh nền, mà màu phẳng thì nhẹ và kiểm tra tương phản được.

Bẫy gặp lại lần hai: thanh người chơi cao lên (ảnh đại diện + hàng quân đã ăn) làm
bàn cờ tràn khỏi màn hình, thanh dưới bị cắt. Trang không cuộn được nên tràn là mất
hẳn. Giờ thanh cao cố định 54px và phần chừa cho bàn cờ tính lại theo đúng con số đó.

### Sau GĐ7 (tiếp) — Sảnh là bàn cờ (17/11/2026)
- [x] Sảnh gọi thẳng `play(homeSide())`: dùng chung bàn cờ, cùng phần chọn đối thủ,
      cùng BoardView của màn Chơi. Mở trang chủ là đánh được luôn.
- [x] Bỏ bàn cờ bài tập xem trước ở Sảnh — giờ đã có bàn cờ thật, hai bàn trên một
      trang chỉ làm phân vân
- [x] Bỏ dòng việc "Chơi một ván" (đang đứng trên bàn cờ rồi còn mời vào chơi)

### Sau GĐ7 (tiếp) — làm lại HUD quanh bàn cờ (17/11/2026)
- [x] Bên đến lượt nổi lên, bên kia mờ 55%; bỏ "lượt Trắng" khỏi tiêu đề vì đã thừa
- [x] Sổ nước đi: vạch chia hai cột, nước đang xem tô rõ hơn
- [x] Hết ván hiện thẻ kết quả (ai thắng, vì sao, hai nút đi tiếp) thay cho một dòng chữ
- [x] Bỏ dòng "Nước vừa đi: …" — sổ nước đi đã tô sẵn nước đó
- [x] Tên khai cuộc hiện ngay trong lúc đánh

**Một lỗi tự gây ra, và một test vô dụng.** Thêm `loadOpenings().then(rerender)` vào
`mountPlay` mà quên rằng `mountPlay` chạy SAU mỗi lần vẽ: vẽ → gắn → vẽ → gắn, trang
treo cứng. `tsc` không bắt được.
Tệ hơn: test đầu tiên mình viết để canh lỗi này **vẫn xanh khi lỗi còn nguyên** — nó chỉ
dò xem phía trên có chữ `if (` nào không, mà `if (!host) return;` ở đầu hàm luôn khớp.
Phải thử bỏ cờ chặn ra, thấy test vẫn xanh, mới biết. Bản thay thế kiểm đúng một việc:
`openingsAsked = true` phải đứng trước `loadOpenings`, và đã xác nhận là nó đỏ khi bỏ
cờ chặn đi. **Test canh lỗi thì phải thử làm nó đỏ một lần, không thì chỉ là trang trí.**

### Sau GĐ7 (tiếp) — dọn lại phần chọn đối thủ (17/11/2026)
- [x] ~~Nét viền quân trên bàn cờ 1.5 → 2.1~~ **đã revert**: phóng to 2× thì thấy đậm
      và rõ, nhưng ở cỡ thật (ô ~74px) nét dày làm chi tiết dính vào nhau — Xe mất khe,
      Mã bết lại, nhìn xấu hơn bản gốc. Chọn độ dày nét phải nhìn ở ĐÚNG CỠ sẽ dùng,
      không phải trên ảnh phóng to.
- [x] Phần chọn đối thủ: hai nút Trắng/Đen chia đôi đều, nút Bắt đầu rộng hết cột,
      các thẻ cấp độ cao bằng nhau, nhãn "Trắng — đi trước" rút gọn cho khỏi xuống dòng

Ba chỗ vấp khi làm nét quân cờ, đều đáng nhớ:
1. Sửa thẳng `public/pieces/cburnett.svg` là vô ích — file đó do `copy-assets.mjs` sinh
   ra, chạy script (hay `npm install`) một cái là chép đè. Phải sửa ở khâu chép.
   Mình còn tự xoá mất thay đổi của chính mình bằng cách chạy `copy-assets` ngay sau
   khi sửa, rồi ngồi tưởng CSS không ăn.
2. Đặt `stroke-width` lên `#piece-sprite g` (phần tử gốc) thì nội dung `<use>` nhân bản
   lấy đúng giá trị đó, đè mất giá trị kế thừa từ `<use>` — nên bàn cờ không dày lên.
   Phải đặt lên chính thẻ `<use>` ở từng chỗ dùng.
3. So 1.5 với 2.8 mới thấy rõ là đường ống có ăn hay không. Nhìn một ảnh rồi đoán thì
   không phân biệt được "đổi rồi mà ít" với "không đổi gì cả".

CC BY-SA 3.0 cho phép sửa, miễn ghi rõ — đã ghi trong `THIRD-PARTY.md` và trong chính
file sprite. Hình dáng quân cờ không đổi, chỉ đổi độ dày nét.

### GĐ8 — Vận hành và phát hành (M) — **phần lớn đã làm 17/11/2026**
- [x] `npm run public`: dựng dist rồi để chính server Node phục vụ cả trang tĩnh lẫn
      `/api` trên MỘT cổng. Cùng origin nên cookie phiên chạy bình thường, không cần
      CORS, và Google OAuth chỉ phải khai đúng một origin.
- [x] Tunnel: `--tunnel=cloudflared` (mặc định, không cần tài khoản) hoặc `--tunnel=ngrok`.
      Script **không sửa** cấu hình tunnel của máy, chỉ đọc rồi tự sinh file riêng.
- [x] `npm run backup`: sao lưu hằng đêm, **chỉ dữ liệu người dùng**
- [x] `scripts/setup-autostart.ps1`: đăng ký Task Scheduler (chạy tay, không tự đăng ký)
- [x] `npm run e2e`: 9 mục, đi hết đường chính của người dùng
- [x] `npm run loadtest`: 10 ván online cùng lúc + 5 lời bình cùng lúc
- [x] `--tunnel=named`: chạy tunnel Cloudflare đã đặt tên, địa chỉ cố định
- [ ] **Còn lại (cần bạn, xem `docs/TEN-MIEN.md`):** đưa latbai.vn về Cloudflare rồi
      tạo tunnel `co-vua` → `co.latbai.vn`; tạo Google OAuth client ID; thử từ điện
      thoại qua 4G.

**Chốt hướng tên miền (17/11/2026): giữ `latbai.vn`, Vercel chuyển tiếp `/api`.**
Bạn yêu cầu bắt buộc dùng latbai.vn và không dùng Cloudflare. Đã kiểm: máy chạy server
**không nhận được kết nối vào từ ngoài** — địa chỉ `10.223.181.64`, gateway
`10.128.128.128` là node mesh WiFi không có chuyển tiếp cổng, IP ngoài `101.99.15.211`
dùng chung qua NAT nhà mạng. Nên DNS trỏ thẳng vào máy là không được, bất kể để DNS ở
đâu. Cách đi được: `latbai.vn` vẫn ở Vercel, Vercel chuyển tiếp `/api/*` sang tunnel của
máy. Trình duyệt chỉ nói chuyện với latbai.vn nên cookie và Google OAuth chỉ cần một
origin, và máy tắt thì trang vẫn mở, vẫn chơi với máy được. `npm run deploy` tự sinh
phần `rewrites` từ biến `PUBLIC_UPSTREAM`. **Còn thiếu: một địa chỉ tunnel cố định**
(ngrok tĩnh hoặc Tailscale Funnel) — và **đấu online qua đường này chưa thử**, vì SSE
có thể bị Vercel cắt khi chuyển tiếp.

**(Hướng Cloudflare đã bỏ.)** Ghi lại để khỏi tìm lại:  Có một điều kiện
trước mà lúc chọn chưa biết: `latbai.vn` đang để DNS ở **Mắt Bão**
(`ns1/ns2.matbao.vn`), không phải Cloudflare. Cloudflare Tunnel chỉ gắn được tên miền
nằm trong tài khoản Cloudflare, vì bản ghi `<id>.cfargotunnel.com` chỉ chạy khi
Cloudflare làm proxy — để ở nhà DNS khác thì vô nghĩa. Nên phải chuyển nameserver.
Đã kiểm trước cho chắc: tên miền chỉ có **một bản ghi A** (→ Vercel) và **một TXT**
xác minh Google, **không có MX** — tức là không có hòm thư nào để làm hỏng. Chuyển
khá an toàn.

**Kết quả thử tải** (10 ván song song, 100 nước, trên chính máy này):
ghép 10/10 ván, 100/100 nước đi thành công; đi một nước trung vị 9 ms, p95 25 ms;
toàn bộ xong trong 1,1 giây. Lời bình: 5 người cùng lúc mà Ollama còn **lạnh** thì
42–57 giây (hàng đợi LLM, một GPU 6 GB chạy lần lượt); lần sau cùng dữ kiện đó thì
lấy từ cache, 45 ms. Nghĩa là chỗ nghẽn là LLM chứ không phải server.

**Một lỗ bảo mật tự mình tạo ra từ GĐ1, tới giờ mới lòi.** `DEV_AUTH` chỉ xét ĐỊA CHỈ
SERVER ĐANG NGHE (`127.0.0.1`), mà chạy sau tunnel thì server vẫn nghe 127.0.0.1 trong
khi cả internet gọi vào được — ai cũng `POST /api/auth/dev` rồi lấy một phiên mang tên
bất kỳ. Giờ xét TỪNG REQUEST (`fromThisMachine` trong `server/auth.ts`): có bất kỳ
header `x-forwarded-*` nào là từ chối. Sai về phía đóng: người ở xa không bỏ header đi
được, người ngồi tại máy mà tự thêm vào thì chỉ tự tắt lối của mình. Có 4 test, và đã
thử thật qua tunnel: tại máy 200, qua tunnel 404.

**Thử tải tìm ra một lỗi thật:** `templateComment` gọi thẳng `MOTIF_TEXT[motif.kind]`
mà không tra trước, nên kiểu lỗi lạ làm server trả 500 — và đường `/api/advisor/explain`
giờ ra tới internet nên ai cũng gây được. Đã vá cả ở template lẫn ở chỗ kiểm dữ liệu
đầu vào (trả 400 thay vì để nó thành 500).

**Bản sao lưu nhỏ đi 1200 lần.** Lần đầu `VACUUM INTO` cả database: 251 MB một bản,
14 bản là 3,5 GB — mà 250 MB trong đó là kho bài tập, lần nào cũng y hệt và tải lại
được bằng `npm run puzzles`. Giờ chỉ chép bảng dữ liệu người dùng: **205 KB**.

**Chưa đụng tới của việc khác.** Máy này đang chạy sẵn: dịch vụ `cloudflared` (tunnel
Zero Trust, cấu hình từ dashboard) và một tunnel ngrok tên `latthe` trỏ vào cổng 11435.
Cái ngrok đó do `start-ngrok-ollama.bat` trong Startup bật lên, định đưa Ollama +
PostgREST ra ngoài qua `local-proxy.js` — nhưng file đó đã bị xoá khỏi repo từ
22/10/2026 (commit `7c9cbe2`, lúc đổi latbai.vn sang game đảo), nên **mấy tuần nay
tunnel ấy trỏ vào chỗ trống**. Không đụng vào, chỉ ghi lại.

### GĐ8 — còn lại

## 6. Thứ tự và phụ thuộc

```
GĐ0 -> GĐ1 -> GĐ2 -> GĐ3 -> GĐ4 -> GĐ5 ----> GĐ8
                 \            \           /
                  \            -> GĐ6 ---/
                   -> GĐ7 (phần review sau ván cần GĐ4–GĐ5) -/
```

## 7. Cần bạn quyết / làm

| Việc | Khi nào | Mặc định nếu bạn không đổi |
|---|---|---|
| Duyệt design system và 5 màn hình | Cuối GĐ0 | Không sang GĐ1 khi chưa duyệt |
| Tạo Google OAuth client ID | GĐ1 | Mình hướng dẫn từng bước |
| ~~Giấy phép~~ | đã chốt 17/11/2026 | **GPL-3.0-or-later**, xem `LICENSE` và `THIRD-PARTY.md` |
| ~~Tải file puzzle 310 MB~~ | đã xong 17/11/2026 | kho 1.133.897 bài, `data/chess.db` 255 MB |
| Tên miền cố định cho tunnel | GĐ8 (nên chốt sớm) | Tên miền tĩnh miễn phí của ngrok |
| Project Vercel cũ | GĐ8 | Giữ nguyên, không đụng tới |
| ~~Tên app~~ | đã chốt 16/11/2026 | **Lật Cờ**, đặt theo bộ với latbai.vn |
