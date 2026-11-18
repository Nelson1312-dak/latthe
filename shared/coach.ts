// Huấn luyện viên: nhìn cả lịch sử ván (không phải từng ván) để chỉ ra lỗi bạn
// hay lặp lại, rồi gợi ý lộ trình học.
//
// Phần này TÍNH bằng code từ kết quả chấm của Stockfish và bộ nhận diện mô-típ —
// kiểm thử được, và là nguồn sự thật duy nhất. AI (mô hình ngôn ngữ) chỉ được
// viết lời khuyên từ đúng các nhận định ở đây; mọi con số nó viết ra phải có sẵn
// trong nhận định (validateAdvice), sai một chỗ là bỏ, dùng lời viết sẵn.

import { Game } from './chess.ts';
import { material, type Square } from './fen.ts';
import { detectMotifs, type MotifKind } from './advisor/motifs.ts';

export const COACH_VERSION = 'c1';
/** Xem tối đa ngần này ván gần nhất. */
export const COACH_GAMES = 20;
/** Ít hơn ngần này ván đã chấm thì chưa đủ để nói "hay mắc". */
export const COACH_MIN_GAMES = 3;

type S = { cp?: number; mate?: number };

/** Một nước đã chấm, như lưu trong bảng reviews (các trường có thể thiếu ở dữ liệu cũ). */
export interface CoachMove {
  ply: number;
  san: string;
  uci: string;
  side: 'w' | 'b';
  fenBefore: string;
  fenAfter?: string;
  cls: string;
  accuracy: number;
  scoreBefore?: S;
  scoreAfter: S;
  best?: { uci: string; san?: string }[];
}

export interface CoachGame {
  side: 'w' | 'b';
  winner: 'w' | 'b' | 'draw';
  moves: CoachMove[];
}

export interface CoachFacts {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Độ chính xác trung bình của bạn, %. */
  accuracy: number;
  /** Theo giai đoạn (chỉ giai đoạn có đủ nước để tin được). */
  phases: { name: string; accuracy: number }[];
  /** Trung bình mỗi ván. */
  perGame: { blunder: number; mistake: number };
  /** Kiểu lỗi lặp lại, nhiều nhất trước. */
  motifs: { kind: MotifKind; count: number; games: number }[];
}

/** Tên kiểu lỗi cho người học đọc. */
export const MOTIF_NAME: Record<MotifKind, string> = {
  hanging: 'để quân không ai bảo vệ',
  missedCapture: 'bỏ qua quân đối thủ để hở',
  missedMate: 'bỏ lỡ nước chiếu hết',
  hangsMate: 'đi nước để đối thủ chiếu hết',
  fork: 'để dính đòn đôi',
  backRank: 'để hở hàng cuối',
  badTrade: 'đổi quân bị thiệt',
};

/** Kiểu lỗi → bài học nên làm (id trong src/training/lessons.ts). */
const MOTIF_LESSONS: Record<MotifKind, string[]> = {
  hanging: ['hanging'],
  missedCapture: ['hanging', 'capturing-defender'],
  missedMate: ['mate1', 'mate2'],
  hangsMate: ['mate1', 'backrank'],
  fork: ['fork'],
  backRank: ['backrank'],
  badTrade: ['capturing-defender'],
};

const BAD = new Set(['blunder', 'mistake', 'miss']);
const r1 = (x: number) => Math.round(x * 10) / 10;

function phaseOf(ply: number): string {
  const n = Math.ceil(ply / 2);
  return n <= 12 ? 'khai cuộc' : n <= 35 ? 'trung cuộc' : 'tàn cuộc';
}

/** Thế cờ sau nước đi (dữ liệu cũ không lưu thì tự đi lại). */
function after(m: CoachMove): string | null {
  if (m.fenAfter) return m.fenAfter;
  try {
    const g = new Game(m.fenBefore);
    return g.move(m.uci.slice(0, 2) as Square, m.uci.slice(2, 4) as Square, m.uci[4])?.fen ?? null;
  } catch {
    return null;
  }
}

/** Kiểu lỗi của một nước hỏng (giống lời bình trong ván: cùng bộ nhận diện). */
function motifsOf(m: CoachMove, scoreBefore: S): MotifKind[] {
  const fenAfter = after(m);
  if (!fenAfter) return [];
  const sign = m.side === 'w' ? 1 : -1;
  try {
    return detectMotifs({
      fenBefore: m.fenBefore,
      fenAfter,
      san: m.san,
      side: m.side,
      replyUci: m.best?.[0]?.uci,
      hadMate: scoreBefore.mate !== undefined && sign * scoreBefore.mate > 0,
      allowsMate: m.scoreAfter.mate !== undefined && sign * m.scoreAfter.mate < 0,
      materialBefore: sign * material(m.fenBefore).diff,
      materialAfter: sign * material(fenAfter).diff,
    }).map((x) => x.kind);
  } catch {
    return [];
  }
}

export function coachFacts(games: CoachGame[]): CoachFacts {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const accs: number[] = [];
  const byPhase = new Map<string, number[]>();
  let blunder = 0;
  let mistake = 0;
  const motif = new Map<MotifKind, { count: number; games: Set<number> }>();

  games.forEach((g, gi) => {
    if (g.winner === 'draw') draws++;
    else if (g.winner === g.side) wins++;
    else losses++;
    const moves = [...g.moves].sort((a, b) => a.ply - b.ply);
    moves.forEach((m, i) => {
      if (m.side !== g.side) return;
      accs.push(m.accuracy);
      const ph = phaseOf(m.ply);
      byPhase.set(ph, [...(byPhase.get(ph) ?? []), m.accuracy]);
      if (m.cls === 'blunder' || m.cls === 'miss') blunder++;
      if (m.cls === 'mistake') mistake++;
      if (!BAD.has(m.cls)) return;
      const before = m.scoreBefore ?? moves[i - 1]?.scoreAfter ?? { cp: 0 };
      // Một nước chỉ tính kiểu lỗi chính (cái đầu tiên bộ nhận diện thấy)
      const k = motifsOf(m, before)[0];
      if (!k) return;
      const e = motif.get(k) ?? { count: 0, games: new Set<number>() };
      e.count++;
      e.games.add(gi);
      motif.set(k, e);
    });
  });

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const n = games.length || 1;
  return {
    games: games.length,
    wins,
    losses,
    draws,
    accuracy: Math.round(avg(accs)),
    phases: ['khai cuộc', 'trung cuộc', 'tàn cuộc']
      .map((name) => ({ name, xs: byPhase.get(name) ?? [] }))
      .filter((p) => p.xs.length >= 15)
      .map((p) => ({ name: p.name, accuracy: Math.round(avg(p.xs)) })),
    perGame: { blunder: r1(blunder / n), mistake: r1(mistake / n) },
    motifs: [...motif.entries()]
      .map(([kind, e]) => ({ kind, count: e.count, games: e.games.size }))
      .sort((a, b) => b.count - a.count || b.games - a.games),
  };
}

/** Ba bài học nên làm tiếp, theo kiểu lỗi hay gặp nhất, rồi tới giai đoạn yếu. */
export function lessonsFor(f: CoachFacts, done: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (!out.includes(id) && out.length < 3) out.push(id);
  };
  for (const m of f.motifs) for (const id of MOTIF_LESSONS[m.kind]) if (!done.has(id)) add(id);
  const yếuNhất = [...f.phases].sort((a, b) => a.accuracy - b.accuracy)[0];
  if (yếuNhất?.name === 'tàn cuộc') for (const id of ['pawn-endgame', 'rook-endgame']) if (!done.has(id)) add(id);
  // Chưa đủ dấu hiệu thì đi theo thứ tự lộ trình
  for (const id of ['hanging', 'fork', 'pin', 'mate1', 'backrank']) if (!done.has(id)) add(id);
  return out;
}

/** Các nhận định đã kiểm chứng, viết thành câu. Là thứ duy nhất AI được dựa vào. */
export function factLines(f: CoachFacts): string[] {
  const lines = [
    `Đã xem ${f.games} ván gần nhất: thắng ${f.wins}, thua ${f.losses}, hòa ${f.draws}. Độ chính xác trung bình ${f.accuracy}%.`,
  ];
  if (f.phases.length >= 2) {
    const xếp = [...f.phases].sort((a, b) => b.accuracy - a.accuracy);
    const [tốt, kém] = [xếp[0], xếp[xếp.length - 1]];
    if (tốt.accuracy - kém.accuracy >= 5) {
      lines.push(`Chơi chắc nhất ở ${tốt.name} (${tốt.accuracy}%), yếu nhất ở ${kém.name} (${kém.accuracy}%).`);
    }
  }
  lines.push(
    `Trung bình mỗi ván có ${f.perGame.blunder} nước sai nghiêm trọng và ${f.perGame.mistake} nước sai.`,
  );
  for (const m of f.motifs.slice(0, 3)) {
    lines.push(`Lỗi lặp lại: ${MOTIF_NAME[m.kind]} — ${m.count} lần, trong ${m.games} ván.`);
  }
  return lines;
}

/* ---------------- Lời khuyên (AI viết, code kiểm) ---------------- */

export const COACH_PROMPT = `Bạn là huấn luyện viên cờ vua, nói tiếng Việt, đang nhận xét cho một người mới học
dựa trên thống kê nhiều ván gần đây của họ.

Bạn nhận: các nhận định ĐÃ ĐƯỢC KIỂM CHỨNG, và danh sách bài học sẽ đề xuất.
Hãy viết:
1. "nhanXet": 2–3 câu nhận xét tổng quát — điểm mạnh nếu có, rồi điều cần sửa nhất. Giọng ấm áp, cụ thể.
2. "loTrinh": với TỪNG bài học (đúng thứ tự, đúng số lượng), một câu ngắn nói vì sao bài này giúp sửa lỗi của họ.

Quy tắc bắt buộc:
- Mọi con số phải lấy đúng từ nhận định. Không thêm con số, phần trăm hay ô cờ nào khác.
- Không thêm sự kiện mới, không nhắc tên engine, không hứa hẹn kết quả ("sẽ thắng", "sẽ lên Elo").
- Xưng "bạn" với người học. Mỗi câu tối đa 35 chữ.

Trả lời đúng dạng JSON: {"nhanXet": "...", "loTrinh": ["...", "..."]}`;

export function coachUserPrompt(lines: string[], lessons: { title: string; keyPoint: string }[]): string {
  return (
    `Nhận định:\n${lines.map((t) => `- ${t}`).join('\n')}\n\n` +
    `Bài học sẽ đề xuất:\n${lessons.map((l, i) => `${i + 1}. ${l.title} — ${l.keyPoint}`).join('\n')}`
  );
}

export interface Advice {
  nhanXet: string;
  loTrinh: string[];
}

const số = (s: string) => new Set(s.match(/\d+(?:[.,]\d+)?/g)?.map((x) => x.replace(',', '.')) ?? []);

/**
 * Kiểm lời khuyên AI viết. Trả về lời khuyên dùng được, hoặc null nếu phải bỏ:
 * sai dạng, sai số lượng, có con số không có trong nhận định, có ô cờ, hay đoán kết cục.
 */
export function validateAdvice(lines: string[], lessonCount: number, out: unknown): Advice | null {
  const o = out as Partial<Advice> | null;
  if (!o || typeof o.nhanXet !== 'string' || !Array.isArray(o.loTrinh)) return null;
  if (o.loTrinh.length !== lessonCount) return null;
  const cho = new Set(lines.flatMap((l) => [...số(l)]));
  const sạch = (t: unknown, max: number): string | null => {
    if (typeof t !== 'string') return null;
    const s = t.replace(/\s+/g, ' ').trim();
    if (s.length < 8 || s.length > max) return null;
    for (const x of số(s)) if (!cho.has(x)) return null;
    if (/\b[a-h][1-8]\b/.test(s)) return null;
    if (/sẽ\s+(không\s+)?(thắng|thua|hòa|hoà|lên)/i.test(s)) return null;
    return s;
  };
  const nhanXet = sạch(o.nhanXet, 420);
  const loTrinh = o.loTrinh.map((t) => sạch(t, 220));
  if (!nhanXet || loTrinh.some((t) => t === null)) return null;
  return { nhanXet, loTrinh: loTrinh as string[] };
}

/** Lời khuyên viết sẵn từ nhận định (khi AI tắt hoặc viết sai). */
export function templateAdvice(f: CoachFacts, lessons: { title: string; keyPoint: string }[]): Advice {
  const top = f.motifs[0];
  const yếu = [...f.phases].sort((a, b) => a.accuracy - b.accuracy)[0];
  const câu = [
    `Trong ${f.games} ván gần nhất, độ chính xác trung bình của bạn là ${f.accuracy}%.`,
    top
      ? `Lỗi bạn lặp lại nhiều nhất là ${MOTIF_NAME[top.kind]} (${top.count} lần) — sửa được lỗi này là đỡ mất quân oan nhiều nhất.`
      : f.perGame.blunder >= 1
        ? `Mỗi ván bạn vẫn có khoảng ${f.perGame.blunder} nước sai nghiêm trọng — trước mỗi nước, hãy nhìn xem quân nào đang bị tấn công.`
        : 'Bạn ít khi đi hỏng nặng — giờ là lúc học các đòn chiến thuật để thắng nhanh hơn.',
  ];
  if (yếu && f.phases.length >= 2) câu.push(`Giai đoạn bạn cần chú ý nhất là ${yếu.name}.`);
  return { nhanXet: câu.join(' '), loTrinh: lessons.map((l) => l.keyPoint) };
}
