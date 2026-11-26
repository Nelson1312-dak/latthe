// Bot đấu online: thay người khi hàng chờ trống.
//
// Giai đoạn đầu chưa có ai chơi, bấm "Tìm trận" là ngồi chờ mãi. Nên chờ đủ
// BOT_AFTER_MS mà không ghép được người thì server ghép với một bot có Elo gần
// nhất. Bot LUÔN mang nhãn AI, và trình duyệt báo rõ "bạn đang đấu với AI" —
// không bao giờ giả làm người.
//
// Mỗi bot có tính cách và lời thoại viết sẵn (không dùng mô hình ngôn ngữ: viết
// sẵn thì không chậm, không nói bậy, không bịa nước cờ).
//
// File này chỉ có dữ liệu và hàm thuần — chọn bot, chọn nước, thời gian nghĩ,
// chọn câu thoại — để test không cần chạy engine.

import { pickByLoss, type LossStyle } from '../../src/engine/levels.ts';

/** Chờ chừng này không ghép được người thì cho bot vào. */
export const BOT_AFTER_MS = 5_000;

export type BotEvent =
  | 'greet' // vừa vào ván
  | 'pounce' // người chơi vừa đi hỏng, bot chớp được
  | 'oops' // chính bot vừa đi hỏng
  | 'winning' // bot đang thắng rõ
  | 'losing' // bot đang thua rõ
  | 'resign' // bot xin thua
  | 'draw-yes' // nhận hòa
  | 'draw-no' // từ chối hòa
  | 'won' // hết ván, bot thắng
  | 'lost' // hết ván, bot thua
  | 'drawn'; // hết ván, hòa

export interface BotPersona {
  /** Mã ngắn, cố định — dùng làm khoá và để test. */
  id: string;
  name: string;
  /** Elo cố định của bot. Ván với bot tính Elo cho người chơi; Elo bot không đổi. */
  elo: number;
  /** Một dòng giới thiệu, hiện trong thông báo "bạn đang đấu với AI". */
  blurb: string;
  /**
   * Cách tìm nước: engine tính tới `depth` (hoặc hết `movetimeMs`), xem `multipv`
   * nước tốt nhất rồi chọn theo mức thiệt, như máy ở màn Chơi (src/engine/levels.ts).
   */
  search: { depth?: number; movetimeMs: number; multipv: number };
  /** Kiểu tay: lỏng tới đâu, sơ suất bao nhiêu. */
  style: LossStyle;
  /** Thích ăn quân và chiếu: trong các nước gần tốt nhất, ưu tiên nước ăn/chiếu. */
  aggressive?: boolean;
  /** Chịu thua khi đã hết cửa (thay vì đánh tới khi bị chiếu hết). */
  resigns: boolean;
  /** Nghĩ nhanh hay chậm so với người thường (1 là bình thường). */
  tempo: number;
  lines: Record<BotEvent, string[]>;
}

/**
 * Sáu bot, từ người mới tập tới cao thủ. Bot nào cũng để engine tính thật rồi
 * chọn theo mức thiệt: bot yếu lỏng tay và hay sơ suất hơn, nhưng thấy quân
 * cho không thì ăn, thấy chiếu hết thì chiếu. (Trước 11/2026 bot yếu nhìn 1–4
 * nước rồi bốc bừa, bot mạnh dùng UCI_LimitStrength: cả hai đi hỏng vô lý.)
 */
export const BOTS: BotPersona[] = [
  {
    id: 'rookie',
    name: 'Tập sự',
    elo: 600,
    blurb: 'Mới tập chơi, hay quên giữ quân. Hiền khô.',
    search: { depth: 4, movetimeMs: 400, multipv: 6 },
    style: { spreadCp: 110, maxLossCp: 300, slipChance: 0.15, slipLossCp: 600 },
    resigns: false,
    tempo: 0.8,
    lines: {
      greet: ['Chào bạn! Mình mới tập chơi, nương tay nha.', 'Hi! Mình là Rookie, chơi vui là chính nhé.'],
      pounce: ['Ơ… quân này cho mình hả? Cảm ơn nha!', 'Hihi, mình ăn được rồi!'],
      oops: ['Ấy chết, mình quên giữ quân…', 'Ôi, mình đi nhầm mất rồi.'],
      winning: ['Ủa, hình như mình đang hơn?', 'Lạ ghê, hôm nay mình đánh hay ta.'],
      losing: ['Bạn chơi giỏi quá à.', 'Mình rối quá, quân đâu mất hết rồi…'],
      resign: ['Mình chịu rồi.'],
      'draw-yes': ['Hòa nha, vui mà!'],
      'draw-no': ['Mình muốn đánh tiếp thêm chút nữa!'],
      won: ['Mình thắng thật hả?! Ván sau bạn phục thù nhé.'],
      lost: ['Bạn giỏi quá! Cảm ơn đã chơi với mình.'],
      drawn: ['Hòa rồi, ván vui ghê!'],
    },
  },
  {
    id: 'steady',
    name: 'Vững vàng',
    elo: 900,
    blurb: 'Chơi chậm rãi, chắc tay, thích đổi quân cho gọn.',
    search: { depth: 6, movetimeMs: 500, multipv: 5 },
    style: { spreadCp: 75, maxLossCp: 200, slipChance: 0.1, slipLossCp: 450 },
    resigns: false,
    tempo: 1.1,
    lines: {
      greet: ['Chào bạn, mình là Steady. Chúc ván vui.', 'Xin chào! Mình đi từ tốn thôi, bạn cứ thong thả.'],
      pounce: ['Nước vừa rồi hơi vội đó bạn.', 'Mình xin quân này nhé.'],
      oops: ['Hừm, nước vừa rồi mình tính chưa kỹ.', 'Mình sơ ý rồi.'],
      winning: ['Ván này đang thuận cho mình.', 'Mình giữ chắc lợi thế nhé.'],
      losing: ['Bạn đang ép mình khá chặt.', 'Thế cờ này khó cho mình quá.'],
      resign: ['Mình xin thua, bạn chơi hay lắm.'],
      'draw-yes': ['Đồng ý hòa, ván cân tài cân sức.'],
      'draw-no': ['Mình nghĩ ván còn dài, đánh tiếp nhé.'],
      won: ['Cảm ơn ván đấu! Bạn xem lại vài nước hỏng nhé.'],
      lost: ['Bạn thắng xứng đáng. Hẹn ván sau!'],
      drawn: ['Hòa là đẹp. Cảm ơn bạn.'],
    },
  },
  {
    id: 'blitz',
    name: 'Chớp nhoáng',
    elo: 1200,
    blurb: 'Ưa tấn công: thấy chiếu là chiếu, thấy ăn là ăn.',
    search: { depth: 9, movetimeMs: 700, multipv: 5 },
    style: { spreadCp: 45, maxLossCp: 130, slipChance: 0.05, slipLossCp: 300 },
    aggressive: true,
    resigns: true,
    tempo: 0.7,
    lines: {
      greet: ['Blitz đây! Mình đánh nhanh lắm, theo kịp không?', 'Vào việc luôn nhé!'],
      pounce: ['Bắt được rồi!', 'Sơ hở là mình lao vào liền!'],
      oops: ['Lao nhanh quá, vấp mất rồi.', 'Úi, hơi liều.'],
      winning: ['Tấn công tiếp nào!', 'Vua bạn đang lạnh gáy đó.'],
      losing: ['Phòng thủ khéo đấy…', 'Hừ, chưa xong đâu!'],
      resign: ['Được rồi, bạn thắng. Ván sau mình đánh tiếp!'],
      'draw-yes': ['Ừ hòa đi, mệt rồi!'],
      'draw-no': ['Hòa á? Không đời nào, đánh tiếp!'],
      won: ['Tấn công là phòng thủ tốt nhất mà!'],
      lost: ['Bạn chịu đòn giỏi thật. Phục!'],
      drawn: ['Hòa à… lần sau mình chiếu hết bạn!'],
    },
  },
  {
    id: 'solid',
    name: 'Chắc tay',
    elo: 1500,
    blurb: 'Chơi thế trận, ít khi sai lớn. Kiên nhẫn chờ bạn hở.',
    search: { depth: 12, movetimeMs: 1000, multipv: 4 },
    style: { spreadCp: 27, maxLossCp: 75, slipChance: 0.02, slipLossCp: 200 },
    resigns: true,
    tempo: 1.2,
    lines: {
      greet: ['Chào bạn. Mình là Solid, chơi chậm mà chắc.', 'Ván hay nhé. Mình sẵn sàng.'],
      pounce: ['Nước đó để lại một điểm yếu.', 'Mình tận dụng nhé.'],
      oops: ['Nước vừa rồi chưa chuẩn.', 'Mình tính sót một nhánh.'],
      winning: ['Thế cờ đang nghiêng về mình.', 'Từ đây chỉ cần đi chính xác.'],
      losing: ['Bạn chơi rất chặt chẽ.', 'Khó rồi đây.'],
      resign: ['Thế cờ hết cứu. Mình xin thua — bạn chơi tốt.'],
      'draw-yes': ['Thế cân bằng, mình đồng ý hòa.'],
      'draw-no': ['Mình vẫn thấy còn cơ hội, đánh tiếp nhé.'],
      won: ['Cảm ơn ván đấu. Bảng chấm ván sẽ chỉ ra chỗ ván đổi chiều.'],
      lost: ['Ván rất chặt. Bạn thắng xứng đáng.'],
      drawn: ['Hòa hợp lý. Cảm ơn bạn.'],
    },
  },
  {
    id: 'sharp',
    name: 'Sắc bén',
    elo: 1900,
    blurb: 'Tính sâu, ra đòn chiến thuật sắc. Thua là phải tâm phục.',
    search: { depth: 16, movetimeMs: 1500, multipv: 3 },
    style: { spreadCp: 11, maxLossCp: 35, slipChance: 0.005, slipLossCp: 120 },
    resigns: true,
    tempo: 1,
    lines: {
      greet: ['Sharp đây. Cho mình thấy bạn tính được bao xa.', 'Bắt đầu thôi.'],
      pounce: ['Thấy rồi.', 'Đòn này bạn bỏ sót.'],
      oops: ['Hừm. Mình đánh giá sai.', 'Nước hiếm hoi mình hớ.'],
      winning: ['Mọi thứ đã rõ.', 'Bạn còn ba nước để tìm cách cứu.'],
      losing: ['Bạn chơi rất mạnh.', 'Ấn tượng đấy.'],
      resign: ['Mình xin thua. Bạn tính sâu hơn mình ván này.'],
      'draw-yes': ['Hòa. Ván ngang tài.'],
      'draw-no': ['Chưa. Còn đánh được.'],
      won: ['Ván tốt. Xem lại nước hỏng đầu tiên của bạn nhé.'],
      lost: ['Bạn thắng một bot 1900. Đáng tự hào đấy!'],
      drawn: ['Hòa với mình là kết quả tốt đó.'],
    },
  },
  {
    id: 'master',
    name: 'Cao thủ',
    elo: 2300,
    blurb: 'Cao thủ trầm tính. Thắng được ông là lên trình thật.',
    search: { movetimeMs: 2000, multipv: 2 },
    style: { spreadCp: 5, maxLossCp: 20, slipChance: 0, slipLossCp: 0 },
    resigns: true,
    tempo: 1.3,
    lines: {
      greet: ['Ta là Master. Cứ đánh hết sức, thua cũng là học.', 'Mời trò đi trước một bước suy nghĩ.'],
      pounce: ['Một nước vội vàng.', 'Trò để hở rồi.'],
      oops: ['Ta cũng có lúc lơ đễnh.', 'Nước này ta đi chưa khéo.'],
      winning: ['Thế trận đã định.', 'Trò thử tìm nước cầm cự xem.'],
      losing: ['Khá lắm.', 'Trò đi rất có bài bản.'],
      resign: ['Ta chịu. Trò đánh rất hay — ván này đáng giữ lại.'],
      'draw-yes': ['Hòa cũng là một cái kết đẹp.'],
      'draw-no': ['Chưa vội. Thế cờ còn nhiều điều.'],
      won: ['Thua không có gì xấu. Mở bảng chấm ván ra xem chỗ nào cần sửa.'],
      lost: ['Trò thắng ta. Thật sự lên trình rồi đấy!'],
      drawn: ['Cầm hòa được ta là giỏi rồi.'],
    },
  },
];

export const botById = (id: string): BotPersona | null => BOTS.find((b) => b.id === id) ?? null;

/**
 * Chọn bot cho người chơi: bot có Elo gần nhất; lệch ngang nhau thì bốc một.
 * `random` tách ra để test không phụ thuộc may rủi.
 */
export function pickBot(rating: number, random: () => number = Math.random): BotPersona {
  const xếp = [...BOTS].sort((a, b) => Math.abs(a.elo - rating) - Math.abs(b.elo - rating));
  const gần = xếp.filter((b) => Math.abs(b.elo - rating) === Math.abs(xếp[0].elo - rating));
  return gần[Math.floor(random() * gần.length)] ?? xếp[0];
}

export interface Candidate {
  uci: string;
  /** Điểm theo góc nhìn BÊN ĐANG ĐI (bot), centipawn; chiếu hết quy ra ±100000. */
  cp: number;
  /** Nước ăn quân hoặc chiếu. */
  forcing: boolean;
}

/**
 * Chọn một nước trong các nước engine đưa ra, theo tính cách bot.
 *
 * - Chọn theo mức thiệt so với nước tốt nhất (pickByLoss): bot càng yếu càng
 *   lỏng tay, thỉnh thoảng sơ suất nhưng có giới hạn.
 * - Bot ưa tấn công: nước ăn/chiếu được cộng 30cp khi chọn, nên hay chọn nước
 *   ăn/chiếu gần tốt nhất hơn.
 * - Không bao giờ bỏ qua chiếu hết có sẵn (bot yếu cũng biết chiếu hết một nước).
 */
export function chooseMove(bot: BotPersona, cands: Candidate[], random: () => number = Math.random): string | null {
  if (!cands.length) return null;
  if (cands[0].cp >= 100_000 - 2) return cands[0].uci; // chiếu hết ngay
  const values = cands.map((c) => c.cp + (bot.aggressive && c.forcing ? 30 : 0));
  return cands[pickByLoss(bot.style, values, random)].uci;
}

/**
 * Bot nghĩ bao lâu cho nước này, tính bằng ms — giống người: khai cuộc đi nhanh,
 * giữa ván nghĩ lâu hơn, gần hết giờ thì đi vội, có chút lệch ngẫu nhiên.
 * Thời gian này trừ thẳng vào đồng hồ của bot.
 */
export function thinkMs(
  bot: BotPersona,
  o: { ply: number; remainingMs: number; incrementMs: number },
  random: () => number = Math.random,
): number {
  const lệch = 0.6 + random() * 0.8;
  let base: number;
  if (o.ply < 8) base = 900; // khai cuộc: thuộc bài, đi nhanh
  else base = Math.min(9_000, o.remainingMs / 35 + o.incrementMs * 0.8);
  if (o.remainingMs < 20_000) base = Math.min(base, 700); // sắp hết giờ: đi vội
  const ms = base * bot.tempo * lệch;
  // Không bao giờ dưới 400ms (đi tức thì trông như máy), không bao giờ quá 1/10 giờ còn lại
  return Math.round(Math.max(400, Math.min(ms, o.remainingMs / 10)));
}

/** Bốc một câu thoại cho sự kiện. */
export function lineFor(bot: BotPersona, ev: BotEvent, random: () => number = Math.random): string {
  const ds = bot.lines[ev];
  return ds[Math.floor(random() * ds.length)] ?? '';
}
