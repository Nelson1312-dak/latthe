// Đo chất lượng lời bình của Huấn luyện viên.
// Chạy: npm run eval:advisor
//
// Cách đo: lấy các nước sai có thật từ ván mẫu và một bộ thế cờ dựng sẵn, cho
// mô hình viết lời bình, rồi đếm xem bao nhiêu câu bị bộ kiểm duyệt chặn và vì
// sao. Lời bình được ghi ra file để đọc bằng mắt — máy không chấm được câu nào
// dễ hiểu, câu nào khó hiểu.

import { writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { buildFacts, type Facts } from '../shared/advisor/facts.ts';
import { detectMotifs, type Motif } from '../shared/advisor/motifs.ts';
import { templateComment } from '../shared/advisor/templates.ts';
import { parseModelReply, validateComment } from '../shared/advisor/validate.ts';
import { SYSTEM_PROMPT, userPrompt } from '../shared/advisor/prompt.ts';
import { material } from '../shared/fen.ts';
import type { MoveClass } from '../shared/winrate.ts';

const OLLAMA = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:8b';
const LIMIT = Number(process.env.EVAL_LIMIT ?? 0);

interface Case {
  ten: string;
  fenBefore: string;
  san: string;
  cls: MoveClass;
  best: string[];
  /** Số thứ tự nước trong ván, để số nước in ra đúng như thật. */
  ply?: number;
}

/** Thế cờ dựng sẵn: mỗi cái nhắm một kiểu lỗi. */
const CASES: Case[] = [
  {
    ten: 'Để hở Hậu giữa bàn',
    fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    san: 'Qh5',
    cls: 'mistake',
    best: ['O-O', 'd3'],
  },
  {
    ten: 'Bỏ lỡ nước ăn Hậu',
    fenBefore: 'q6k/8/8/8/8/8/8/R6K w - - 0 1',
    san: 'Kg1',
    cls: 'blunder',
    best: ['Rxa8+'],
  },
  {
    ten: 'Bỏ lỡ chiếu hết hàng cuối',
    fenBefore: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    san: 'Rd2',
    cls: 'miss',
    best: ['Rd8#'],
  },
  {
    ten: 'Đưa Mã vào chỗ bị Tốt đuổi',
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1',
    san: 'Ng5',
    cls: 'inaccuracy',
    best: ['Nxe5', 'd4'],
  },
  {
    ten: 'Nước khai cuộc bình thường',
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    san: 'e4',
    cls: 'book',
    best: ['e4'],
  },
];

/** Thêm các nước sai có thật từ ván mẫu đã phân tích bằng Stockfish. */
async function casesFromFixtures(): Promise<Case[]> {
  const fx = (await import('../src/mock/fixtures.json', { with: { type: 'json' } })).default as {
    game1: { moves: { ply: number; san: string; fenBefore: string; cls: string; best: { san: string }[] }[] };
  };
  return fx.game1.moves
    .filter((m) => ['blunder', 'mistake', 'inaccuracy', 'miss'].includes(m.cls))
    .map((m) => ({
      ten: `Ván thật: ${m.san} (${m.cls})`,
      fenBefore: m.fenBefore,
      san: m.san,
      cls: m.cls as MoveClass,
      best: m.best.map((b) => b.san),
      ply: m.ply,
    }));
}

function factsOf(c: Case): Facts {
  const board = new Chess(c.fenBefore);
  const side = board.turn() as 'w' | 'b';
  let motifs: Motif[] = [];
  let fenAfter = c.fenBefore;
  try {
    const m = board.move(c.san);
    fenAfter = board.fen();
    const sign = side === 'w' ? 1 : -1;
    motifs = detectMotifs({
      fenBefore: c.fenBefore,
      fenAfter,
      san: m.san,
      side,
      materialBefore: sign * material(c.fenBefore).diff,
      materialAfter: sign * material(fenAfter).diff,
    });
  } catch {
    /* nước không hợp lệ trong thế cờ mẫu: vẫn đo được phần còn lại */
  }
  return buildFacts({
    side,
    ply: c.ply ?? 11,
    san: c.san,
    cls: c.cls,
    best: c.best.map((san) => ({ san, score: { cp: 0 } })),
    pv: [],
    motifs,
  });
}

async function ask(facts: Facts): Promise<string | null> {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      // Giữ mô hình thường trú: lần nạp đầu mất hàng chục giây vì 5,2 GB phải
      // vào card 6 GB, để nó rơi ra rồi nạp lại là người dùng phải chờ dài
      keep_alive: '15m',
      think: false,
      format: { type: 'object', properties: { giaiThich: { type: 'string' } }, required: ['giaiThich'] },
      options: { temperature: 0.3, num_predict: 220 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(facts) },
      ],
    }),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { message?: { content?: string } }).message?.content ?? null;
}

const alive = await fetch(`${OLLAMA}/api/version`, { signal: AbortSignal.timeout(2000) })
  .then((r) => r.ok)
  .catch(() => false);

let cases = [...CASES, ...(await casesFromFixtures())];
if (LIMIT) cases = cases.slice(0, LIMIT);

console.log(`${cases.length} thế cờ · Ollama ${alive ? 'đang chạy' : 'KHÔNG chạy — chỉ đo câu mẫu'}\n`);

const rows: string[] = [];
let qua = 0;
let bịChặn = 0;
const lýDo: Record<string, number> = {};
let tổngMs = 0;

for (const c of cases) {
  const factsGoc = factsOf(c);
  const mẫu = templateComment(factsGoc);
  const facts: Facts = { ...factsGoc, suThat: mẫu };
  const vMẫu = validateComment(mẫu, facts);

  let lời = '(không gọi mô hình)';
  let nguồn = 'câu mẫu';
  let ms = 0;

  if (alive) {
    const t0 = Date.now();
    const raw = await ask(facts).catch(() => null);
    ms = Date.now() - t0;
    tổngMs += ms;
    const text = raw ? parseModelReply(raw) : null;
    if (!text) {
      bịChặn++;
      lýDo['câu trả lời sai dạng'] = (lýDo['câu trả lời sai dạng'] ?? 0) + 1;
      lời = mẫu;
    } else {
      const v = validateComment(text, facts);
      if (v.ok) {
        qua++;
        lời = text;
        nguồn = 'mô hình';
      } else {
        bịChặn++;
        const khóa = (v.reason ?? '?').replace(/: .*/, '');
        lýDo[khóa] = (lýDo[khóa] ?? 0) + 1;
        lời = `${mẫu}\n      (lời mô hình bị chặn — ${v.reason}: "${text}")`;
      }
    }
  } else {
    lời = mẫu;
  }

  console.log(`• ${c.ten}`);
  console.log(`  mô-típ: ${facts.the.map((m) => m.kind).join(', ') || '(không có)'}`);
  console.log(`  [${nguồn}${ms ? ` ${ms}ms` : ''}] ${lời}`);
  if (!vMẫu.ok) console.log(`  !! CÂU MẪU KHÔNG QUA KIỂM DUYỆT: ${vMẫu.reason}`);
  console.log('');

  rows.push(
    `## ${c.ten}\n\n- mô-típ: ${facts.the.map((m) => m.kind).join(', ') || '(không có)'}\n` +
      `- câu mẫu: ${mẫu}\n- lời bình: ${lời}\n`,
  );
}

mkdirSync('shots', { recursive: true });
writeFileSync('shots/advisor-eval.md', `# Lời bình của Huấn luyện viên\n\n${rows.join('\n')}`);

console.log('─'.repeat(60));
if (alive) {
  const tổng = qua + bịChặn;
  console.log(`Lời mô hình dùng được: ${qua}/${tổng} (${Math.round((qua / tổng) * 100)}%)`);
  console.log(`Bị chặn: ${bịChặn}` + (bịChặn ? ` — ${Object.entries(lýDo).map(([k, v]) => `${k}: ${v}`).join(', ')}` : ''));
  console.log(`Thời gian trung bình: ${Math.round(tổngMs / tổng)}ms`);
} else {
  console.log('Ollama không chạy: mọi lời bình đều là câu mẫu, app vẫn dùng được bình thường.');
}
console.log('Đã ghi shots/advisor-eval.md để đọc bằng mắt.');
