/**
 * scripts/eval-rag.mjs — quality eval for the AI answers ("đánh giá" / stage 7).
 *
 * Runs a set of sample cases through the live /api/interpret endpoint, then uses
 * DeepSeek as an LLM-judge to score each answer on:
 *   - Faithfulness : bám sát context (lá số/quẻ/bài), không bịa thông tin
 *   - Relevance    : trả lời đúng trọng tâm câu hỏi
 *   - Language     : tiếng Việt thuần, không lẫn chữ Hán/tiếng Anh
 * Each 1–5. Prints per-case scores + averages so you can tell if a prompt/model
 * change actually improved things instead of flying blind.
 *
 * Env:
 *   API_BASE          (default https://latbai.vn)
 *   DEEPSEEK_API_KEY  (required — the judge)
 *   DEEPSEEK_MODEL    (default deepseek-chat)
 *   EVAL_DELAY_MS     (default 13000 — respects the 5 req/60s rate limit)
 *
 * Run:  node scripts/eval-rag.mjs
 */
const API_BASE = (process.env.API_BASE || 'https://latbai.vn').replace(/\/+$/, '');
const DS_KEY = process.env.DEEPSEEK_API_KEY || '';
const DS_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DELAY = parseInt(process.env.EVAL_DELAY_MS || '', 10) || 13000;

const CASES = [
  {
    type: 'gieoque',
    question: 'Tôi có nên chuyển sang công việc mới không?',
    context: JSON.stringify({
      mainName: 'Thuần Càn',
      mainText: 'Sức mạnh sáng tạo của trời. Thời điểm hành động mạnh mẽ, tiến lên với ý chí kiên định.',
      mutatedHao: 'Không có', mutatedHaoText: 'Không có',
    }),
  },
  {
    type: 'gieoque',
    question: 'Chuyện tình cảm của tôi sắp tới ra sao?',
    context: JSON.stringify({
      mainName: 'Trạch Sơn Hàm',
      mainText: 'Sự cảm ứng, giao hòa giữa hai người. Tình cảm chân thành, đồng điệu.',
      mutatedHao: 'Hào 3', mutatedHaoText: 'Biến thành quẻ Thuần Đoài — niềm vui, sự hoan hỉ.',
    }),
  },
  {
    type: 'thansohoc',
    question: 'Sự nghiệp của tôi hợp với hướng nào?',
    context: JSON.stringify({
      fullName: 'Nguyễn Văn An', birthDate: '15/9/1992',
      lifePath: '8', destiny: '5', soul: '3', personality: '2',
      attitude: '6', birthdayNumber: '6', arrows: 'Mũi Tên Ý Chí',
    }),
  },
  {
    type: 'tarot',
    question: 'Tôi nên làm gì để cải thiện tài chính?',
    context: 'Vị trí Quá khứ: The Tower (Ngược). Vị trí Hiện tại: Ace of Pentacles (Xuôi). Vị trí Tương lai: The Sun (Xuôi).',
  },
  {
    type: 'tuvi',
    question: 'Vận sự nghiệp của tôi trong giai đoạn này thế nào?',
    context: 'Giới tính: Dương Nam | Cục: Kim Tứ Cục | Mệnh: Tử Vi, Thiên Phủ tại Dần. Đại hạn đang chạy (35–44): cung Quan Lộc [Vũ Khúc, Thất Sát].',
  },
];

async function getAnswer(c) {
  // Production CORS chỉ nhận request có Origin nằm trong whitelist (api/_cors.js).
  // Eval là server-side script nên phải tự khai Origin hợp lệ, không thì bị 403.
  const ORIGIN = (process.env.EVAL_ORIGIN || 'https://latbai.vn').replace(/\/+$/, '');
  const res = await fetch(`${API_BASE}/api/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN },
    body: JSON.stringify({ question: c.question, context: c.context, type: c.type, history: [] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 160)}`);
  return { answer: JSON.parse(text).answer || '', source: res.headers.get('x-ai-source') || '?' };
}

async function judge(c, answer) {
  const prompt = `Bạn là giám khảo đánh giá chất lượng luận giải ${c.type}. Chấm câu trả lời theo 3 tiêu chí, mỗi tiêu chí từ 1 đến 5:
- faithfulness: có bám sát DỮ LIỆU context (quẻ/lá số/bài) không, có bịa DỮ LIỆU sai sự thật không. LƯU Ý: giọng văn nhân vật (vd "Cổ Dịch Đại Sư", "Thầy Xăm"), tiêu đề định dạng, và việc nêu lại đúng dữ liệu context (kể cả "không có hào biến") KHÔNG tính là bịa — đừng trừ điểm.
- relevance: có trả lời đúng trọng tâm CÂU HỎI không.
- language: CHỈ trừ điểm khi có (a) ký tự chữ Hán/chữ Trung thật (漢字, vd 乾 坤 财) hoặc (b) từ tiếng Anh. TUYỆT ĐỐI KHÔNG trừ điểm từ Hán-Việt viết bằng chữ Latinh (vd "lãnh đạo", "tài chính", "tâm nguyện", "ứng nghiệm", "cát hung", "cải vận") — đó là tiếng Việt chuẩn, hoàn toàn hợp lệ.

CÂU HỎI: ${c.question}
CONTEXT: ${c.context}
CÂU TRẢ LỜI:
${answer}

Chỉ trả về JSON đúng định dạng, không thêm chữ nào khác:
{"faithfulness":<1-5>,"relevance":<1-5>,"language":<1-5>,"reason":"<1 câu ngắn>"}`;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DS_KEY}` },
    body: JSON.stringify({ model: DS_MODEL, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 160)}`);
  let txt = (await res.json()).choices?.[0]?.message?.content || '{}';
  txt = txt.replace(/```json|```/g, '').trim();
  return JSON.parse(txt);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  if (!DS_KEY) { console.error('Set DEEPSEEK_API_KEY to run the judge.'); process.exit(1); }
  console.log(`Eval ${CASES.length} cases against ${API_BASE}\n`);
  const rows = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    try {
      const { answer, source } = await getAnswer(c);
      const s = await judge(c, answer);
      rows.push({ type: c.type, ...s, source });
      console.log(`[${c.type}] F=${s.faithfulness} R=${s.relevance} L=${s.language} (${source}) — ${s.reason}`);
    } catch (e) {
      console.error(`[${c.type}] ERROR: ${e.message}`);
    }
    if (i < CASES.length - 1) await sleep(DELAY); // respect rate limit
  }
  if (rows.length) {
    const avg = (k) => (rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) / rows.length).toFixed(2);
    console.log(`\n=== Trung bình (${rows.length} cases) ===`);
    console.log(`Faithfulness: ${avg('faithfulness')} | Relevance: ${avg('relevance')} | Language: ${avg('language')}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
