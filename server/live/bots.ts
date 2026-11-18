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
  /** Cách tìm nước: yếu thì nghĩ nông rồi cố ý chọn lệch; mạnh thì dùng giới hạn Elo của Stockfish. */
  search: { depth?: number; uciElo?: number; movetimeMs: number; multipv: number; weights?: number[] };
  /** Thích ăn quân và chiếu: trong các nước gần tốt nhất, ưu tiên nước ăn/chiếu. */
  aggressive?: boolean;
  /** Chịu thua khi đã hết cửa (thay vì đánh tới khi bị chiếu hết). */
  resigns: boolean;
  /** Nghĩ nhanh hay chậm so với người thường (1 là bình thường). */
  tempo: number;
  lines: Record<BotEvent, string[]>;
}

/**
 * Sáu bot, từ người mới tập tới cao thủ. Elo dưới 1320 là mức thấp nhất
 * Stockfish tự giới hạn được, nên bot yếu dùng cách khác: nghĩ nông (depth
 * 1–4) rồi bốc nước theo trọng số — ra những lỗi giống người thật (để hở quân,
 * bỏ lỡ nước ăn) chứ không phải đi bừa.
 */
export const BOTS: BotPersona[] = [
  {
    id: 'nhim',
    name: 'Bot Nhím',
    elo: 600,
    blurb: 'Mới tập chơi, hay quên giữ quân. Hiền khô.',
    search: { depth: 1, movetimeMs: 60, multipv: 5, weights: [1, 3, 4, 4, 4] },
    resigns: false,
    tempo: 0.8,
    lines: {
      greet: ['Chào bạn! Mình mới tập chơi, nương tay nha.', 'Hi! Mình là Nhím, chơi vui là chính nhé.'],
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
    id: 'sen',
    name: 'Bot Sen',
    elo: 900,
    blurb: 'Chơi chậm rãi, chắc tay, thích đổi quân cho gọn.',
    search: { depth: 2, movetimeMs: 80, multipv: 5, weights: [2, 3, 3, 2, 2] },
    resigns: false,
    tempo: 1.1,
    lines: {
      greet: ['Chào bạn, mình là Sen. Chúc ván vui.', 'Xin chào! Mình đi từ tốn thôi, bạn cứ thong thả.'],
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
    id: 'mai',
    name: 'Bot Mai',
    elo: 1200,
    blurb: 'Ưa tấn công: thấy chiếu là chiếu, thấy ăn là ăn.',
    search: { depth: 4, movetimeMs: 120, multipv: 4, weights: [5, 3, 2, 1] },
    aggressive: true,
    resigns: true,
    tempo: 0.7,
    lines: {
      greet: ['Mai đây! Mình đánh nhanh lắm, theo kịp không?', 'Vào việc luôn nhé!'],
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
    id: 'tung',
    name: 'Bot Tùng',
    elo: 1500,
    blurb: 'Chơi thế trận, ít khi sai lớn. Kiên nhẫn chờ bạn hở.',
    search: { uciElo: 1500, movetimeMs: 300, multipv: 1 },
    resigns: true,
    tempo: 1.2,
    lines: {
      greet: ['Chào bạn. Mình là Tùng, chơi chậm mà chắc.', 'Ván hay nhé. Mình sẵn sàng.'],
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
    id: 'dai-bang',
    name: 'Bot Đại Bàng',
    elo: 1900,
    blurb: 'Tính sâu, ra đòn chiến thuật sắc. Thua là phải tâm phục.',
    search: { uciElo: 1900, movetimeMs: 500, multipv: 1 },
    resigns: true,
    tempo: 1,
    lines: {
      greet: ['Đại Bàng đây. Cho mình thấy bạn tính được bao xa.', 'Bắt đầu thôi.'],
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
    id: 'thay-do',
    name: 'Bot Thầy Đồ',
    elo: 2300,
    blurb: 'Cao thủ trầm tính. Thắng được ông là lên trình thật.',
    search: { uciElo: 2300, movetimeMs: 800, multipv: 1 },
    resigns: true,
    tempo: 1.3,
    lines: {
      greet: ['Ta là Thầy Đồ. Cứ đánh hết sức, thua cũng là học.', 'Mời trò đi trước một bước suy nghĩ.'],
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
 * - Bot mạnh (multipv 1): đi nước engine chọn.
 * - Bot yếu: bốc theo trọng số — đôi khi không phải nước tốt nhất.
 * - Bot ưa tấn công: nước ăn/chiếu nào không kém nước tốt nhất quá 60cp thì
 *   được nhân đôi cơ hội.
 * - Không bao giờ bỏ qua chiếu hết có sẵn (bot yếu cũng biết chiếu hết một nước).
 */
export function chooseMove(bot: BotPersona, cands: Candidate[], random: () => number = Math.random): string | null {
  if (!cands.length) return null;
  if (cands[0].cp >= 100_000 - 2) return cands[0].uci; // chiếu hết ngay
  const w = bot.search.weights ?? [1];
  const best = cands[0].cp;
  const trọng = cands.map((c, i) => {
    let t = w[i] ?? 0;
    if (bot.aggressive && c.forcing && best - c.cp <= 60) t *= 2;
    return t;
  });
  const tổng = trọng.reduce((a, b) => a + b, 0);
  if (tổng <= 0) return cands[0].uci;
  let r = random() * tổng;
  for (let i = 0; i < cands.length; i++) {
    r -= trọng[i];
    if (r < 0) return cands[i].uci;
  }
  return cands[cands.length - 1].uci;
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
