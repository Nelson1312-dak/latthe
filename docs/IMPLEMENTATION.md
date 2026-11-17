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

### GĐ3 — Chơi với máy (M)
- [ ] Chốt giấy phép GPL-3, thêm `LICENSE`
- [ ] `copy-engine.mjs`, `uci.ts`, `engine.ts`, `levels.ts` + test đọc dòng UCI
- [ ] Màn Chơi với máy: chọn cấp và màu, thanh đánh giá bật/tắt, xin đi lại
- [ ] Lưu ván lên server khi kết thúc (giữ 20 ván)
- **Kiểm tra:** cấp 1 hay để hở quân; cấp 8 không thua ván dễ; giao diện không đứng khi máy nghĩ.

### GĐ4 — Review (M)
- [ ] `import-openings.mjs`, nhận nước "Sách" và tên khai cuộc
- [ ] `winrate.ts` + test, `review.ts` (chạy nền, tiến độ, hủy được), lưu `reviews`
- [ ] Màn Review: huy hiệu xếp loại, `EvalGraph`, độ chính xác, nhảy tới nước sai, "thử lại từ đây"
- [ ] Sinh thẻ ôn tập từ nước sai
- **Kiểm tra:** review 5 ván PGN mẫu, so với phân tích Lichess của cùng ván: khớp phần lớn các nước Sai/Sai nghiêm trọng; ván 40 nước dưới 60 giây.

### GĐ5 — HLV AI (L)
- [ ] Các mô-típ + thế cờ mẫu dương/âm tính
- [ ] `facts.ts`, `templates.ts`, `prompt.ts`, `validate.ts` + test kiểm duyệt (câu bịa nước, bịa ô, bịa số đều bị chặn)
- [ ] `server/advisor/queue.ts`: hàng đợi, giới hạn, lưu đệm, stream
- [ ] `CoachPanel`, nút "Vì sao?" trong Review, gợi ý 3 nấc khi chơi với máy
- [ ] `npm run eval:advisor`: chạy 50 thế cờ mẫu, in tỉ lệ bị chặn, thời gian, xuất câu trả lời ra file để đọc tay
- **Kiểm tra:** không câu nào nêu sai nước lọt qua kiểm duyệt; tắt Ollama thì vẫn có lời bình bằng câu mẫu; câu đầu tiên hiện ra dưới 5 giây khi hàng đợi trống.

### GĐ6 — Học không giới hạn (L)
- [ ] `import-puzzles.mjs` (**hỏi bạn trước khi tải file 310 MB**), chỉ mục, đo tốc độ lấy bài
- [ ] Màn Puzzle: theo chủ đề hoặc trộn, rating, gợi ý, xem lời giải
- [ ] Màn Ôn tập hôm nay: thẻ lỗi đến hạn + puzzle theo chủ đề yếu
- [ ] Khoảng 30 bài học (soạn nội dung tiếng Việt)
- [ ] Màn Tiến độ: chủ đề mạnh/yếu, chuỗi ngày luyện, số thẻ theo hộp
- **Kiểm tra:** lấy một puzzle dưới 50 ms; rating lên/xuống hợp lý sau 30 bài; thẻ sai quay lại đúng hạn (test với đồng hồ giả).

### GĐ7 — Chơi online (L)
- [ ] `shared/protocol.ts`, `server/live/rooms.ts`, `clock.ts` + test máy trạng thái và đồng hồ
- [ ] Tạo ván, link mời, vào ván, hủy ván
- [ ] Đi quân, đồng hồ, đầu hàng, hòa, hết giờ, mất kết nối / vào lại, khôi phục sau khi server khởi động lại
- [ ] Ẩn engine/HLV trong ván; server chặn yêu cầu HLV
- [ ] Giữ 5 ván gần nhất mỗi người; màn Hồ sơ liệt kê 5 ván đó → Review
- **Kiểm tra:** hai trình duyệt (hai tài khoản) chơi trọn ván; rút mạng một bên 30 giây rồi cắm lại vẫn chơi tiếp; tắt server giữa ván rồi bật lại, ván khôi phục; chơi ván thứ 6 thì ván cũ nhất biến mất.

### GĐ8 — Vận hành và phát hành (M)
- [ ] Tunnel với tên miền cố định, thêm origin đó vào Google OAuth
- [ ] Task Scheduler + giám sát, sao lưu hằng đêm
- [ ] Playwright: đăng nhập giả → chơi với máy → review → ôn tập; hai người chơi online
- [ ] Thử tải: 10 ván online cùng lúc + 5 người xin lời bình cùng lúc
- [ ] Gỡ hoặc giữ project Vercel cũ (**bạn quyết**)
- **Kiểm tra:** truy cập từ điện thoại qua 4G bằng tên miền thật, chơi trọn một ván online.

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
| Giấy phép GPL-3 | Trước GĐ3 | Thêm `LICENSE` GPL-3 |
| Tải file puzzle 310 MB | Đầu GĐ6 | Mình hỏi lại trước khi tải |
| Tên miền cố định cho tunnel | GĐ8 (nên chốt sớm) | Tên miền tĩnh miễn phí của ngrok |
| Project Vercel cũ | GĐ8 | Giữ nguyên, không đụng tới |
| ~~Tên app~~ | đã chốt 16/11/2026 | **Lật Cờ**, đặt theo bộ với latbai.vn |
