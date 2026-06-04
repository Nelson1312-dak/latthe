/**
 * api/interpret.js — Vercel Serverless Function
 * - Conversation history: passes prior turns to Ollama for multi-turn memory
 * - RAG: embeds question → retrieves similar past Q&As → augments context
 *   Requires: SUPABASE_URL, SUPABASE_ANON_KEY (optional — degrades gracefully)
 *   Requires: OLLAMA_EMBED_MODEL pulled in Ollama (default: nomic-embed-text)
 */

import { applyCors } from './_cors.js';

// Prevent uncaught exceptions / unhandled rejections from crashing the dev server
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ---- Rate-limit config ----

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_WINDOW_SEC = RATE_LIMIT_WINDOW_MS / 1000;
const RATE_LIMIT_MAX = 5;

// Strip accidental surrounding junk from pasted env values — quotes, angle
// brackets (e.g. copied from a markdown <url> link), whitespace and trailing
// slashes — which otherwise make the fetch URL malformed (throws TypeError) and
// silently drop us to the in-memory limiter.
function cleanEnv(v) {
  return (v || '')
    .trim()
    .replace(/^[<'"]+|[>'"]+$/g, '') // wrapping < > ' "
    .trim()
    .replace(/\/+$/, '');            // trailing slash(es)
}
const UPSTASH_URL   = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
const upstashEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN);

const rateLimitStore = new Map(); // ip -> { count, windowStart } — in-memory fallback

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// In-memory limiter — per-instance only. Used as a fallback when Upstash is not
// configured or unreachable, so a misconfig never takes the whole endpoint down.
function checkRateLimitLocal(ip) {
  const now = Date.now();
  if (rateLimitStore.size > 500) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(k);
    }
  }
  const record = rateLimitStore.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }
  record.count++;
  return { allowed: true };
}

// Distributed limiter backed by Upstash Redis (shared across all serverless
// instances, unlike the in-memory Map). Fixed-window counter: INCR the per-IP
// key, and set a TTL on the first hit of each window so it auto-expires. Done in
// one pipelined REST call. Any failure falls back to the in-memory limiter.
async function checkRateLimit(ip) {
  if (!upstashEnabled) return { ...checkRateLimitLocal(ip), backend: 'memory-noenv' };

  const key = `rl:interpret:${ip}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // INCR returns the new count; EXPIRE NX sets TTL only if none exists, so the
      // window starts at the first request and is not extended by later ones.
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(RATE_LIMIT_WINDOW_SEC), 'NX'],
      ]),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ...checkRateLimitLocal(ip), backend: `memory-http${res.status}` };

    const data = await res.json();
    const count = Array.isArray(data) ? Number(data[0]?.result) : NaN;
    if (!Number.isFinite(count)) return { ...checkRateLimitLocal(ip), backend: 'memory-badresp' };

    if (count > RATE_LIMIT_MAX) {
      // Read remaining TTL to give the client an accurate Retry-After.
      let retryAfter = RATE_LIMIT_WINDOW_SEC;
      try {
        const ttlRes = await fetch(`${UPSTASH_URL}/ttl/${encodeURIComponent(key)}`, {
          headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` },
        });
        if (ttlRes.ok) {
          const ttl = Number((await ttlRes.json())?.result);
          if (Number.isFinite(ttl) && ttl > 0) retryAfter = ttl;
        }
      } catch { /* keep default */ }
      return { allowed: false, retryAfter, backend: 'upstash' };
    }
    return { allowed: true, backend: 'upstash' };
  } catch (err) {
    clearTimeout(t);
    return { ...checkRateLimitLocal(ip), backend: `memory-err:${err.name || 'unknown'}` };
  }
}

// ---- Infra-down detector ----
// Distinguishes "the local box / ngrok tunnel is unreachable" (network error or
// timeout) from "the server answered with an error status" (still up). Only the
// former should trip the circuit breaker that skips remaining local calls.
function isInfraDown(err) {
  if (!err) return false;
  if (err.name === 'AbortError' || err.name === 'TypeError') return true;
  return /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(err.message || '');
}

// ---- Groq fallback (called when local Ollama is down or slow) ----

async function callGroq({ apiKey, model, messages, temperature, maxTokens, timeoutMs = 22000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Groq ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { ok: true, content };
  } catch (err) {
    clearTimeout(t);
    return { ok: false, error: err.name === 'AbortError' ? `Groq timeout (>${Math.round(timeoutMs / 1000)}s)` : err.message };
  }
}

// ---- Language filter helper ----

function cleanChineseLeaks(text) {
  if (!text) return '';
  
  // If no Chinese characters are present, return as is
  if (!/[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }

  // Split into lines
  const lines = text.split('\n');
  
  // Filter out any lines that contain Chinese characters
  const cleanLines = lines.filter(line => !/[\u4e00-\u9fa5]/.test(line));
  const cleanedText = cleanLines.join('\n').trim();

  // If the resulting text is long enough, return it
  if (cleanedText.length > 30) {
    return cleanedText;
  }

  // Otherwise, fallback to stripping Chinese characters individually
  return text
    .replace(/[\u4e00-\u9fa5]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- RAG helpers ----

function isLocalUrl(url) {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('postgrest') || url.includes(':3001');
}

async function getEmbedding(ollamaUrl, embedModel, text, breaker) {
  if (!ollamaUrl || breaker.localDown) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ model: embedModel, prompt: text }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding || null;
  } catch (err) {
    clearTimeout(t);
    if (isInfraDown(err)) breaker.localDown = true;
    return null;
  }
}

async function retrieveSimilar(sbUrl, sbKey, embedding, type, breaker) {
  if (!embedding || !sbUrl || breaker.localDown) return [];
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    const isLocal = isLocalUrl(sbUrl);
    const path = isLocal ? '/rpc/match_documents' : '/rest/v1/rpc/match_documents';
    
    const headers = {
      'Content-Type': 'application/json',
    };
    if (sbKey) {
      headers['apikey'] = sbKey;
      headers['Authorization'] = `Bearer ${sbKey}`;
    }

    const res = await fetch(`${sbUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: 0.78,
        match_count: 2,
        filter_type: type,
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    clearTimeout(t);
    if (isInfraDown(err)) breaker.localDown = true;
    return [];
  }
}

async function storeDoc(sbUrl, sbKey, payload) {
  if (!sbUrl || !payload.embedding) return;
  const isLocal = isLocalUrl(sbUrl);
  const path = isLocal ? '/documents' : '/rest/v1/documents';
  
  const headers = {
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
  if (sbKey) {
    headers['apikey'] = sbKey;
    headers['Authorization'] = `Bearer ${sbKey}`;
  }

  try {
    await fetch(`${sbUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to store document in cache database:", err);
  }
}

async function checkExactMatchCache(sbUrl, sbKey, type, question, context, breaker) {
  if (!sbUrl || breaker.localDown) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const isLocal = isLocalUrl(sbUrl);
    const basePath = isLocal ? '/documents' : '/rest/v1/documents';
    
    const url = new URL(`${sbUrl}${basePath}`);
    url.searchParams.set('type', `eq.${type}`);
    url.searchParams.set('question', `eq.${question.trim()}`);
    url.searchParams.set('context', `eq.${context || ''}`);
    url.searchParams.set('select', 'answer');
    url.searchParams.set('limit', '1');

    const headers = { 'Content-Type': 'application/json' };
    if (sbKey) {
      headers['apikey'] = sbKey;
      headers['Authorization'] = `Bearer ${sbKey}`;
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].answer || null;
    }
    return null;
  } catch (err) {
    clearTimeout(t);
    if (isInfraDown(err)) breaker.localDown = true;
    return null;
  }
}

function buildFirstUserContent(q, ctx, t, fullContext, isFollowUp = false) {
  if (t === 'gieoque') {
    let mainName = '';
    let mainText = '';
    let mutatedHao = 'Không có';
    let mutatedHaoText = 'Không có';
    try {
      const parsed = JSON.parse(ctx);
      mainName = parsed.mainName || '';
      mainText = parsed.mainText || '';
      mutatedHao = parsed.mutatedHao || 'Không có';
      mutatedHaoText = parsed.mutatedHaoText || 'Không có';
    } catch {
      mainName = ctx || '';
    }

    if (isFollowUp) {
      return `# INPUT CONTEXT (Dữ liệu hệ thống cung cấp):
- Câu hỏi ban đầu của user: ${q}
- Tên Quẻ Gốc (Chính quẻ): ${mainName}
- Thoán từ/Tượng quẻ gốc: ${mainText}
- Hào biến (nếu có): ${mutatedHao}
- Ý nghĩa Hào biến: ${mutatedHaoText}`;
    }

    return `# INPUT CONTEXT (Dữ liệu hệ thống cung cấp):
- Câu hỏi của user: ${q}
- Tên Quẻ Gốc (Chính quẻ): ${mainName}
- Thoán từ/Tượng quẻ gốc: ${mainText}
- Hào biến (nếu có): ${mutatedHao}
- Ý nghĩa Hào biến: ${mutatedHaoText}

Hãy luận giải dựa trên hướng dẫn và trả về theo đúng định dạng đầu ra bắt buộc của "Cổ Dịch Đại Sư". (Chỉ dùng tiếng Việt, không dùng bất kỳ chữ Hán nào)`;
  } else if (t === 'tuvi') {
    if (isFollowUp) {
      return `# INPUT CONTEXT (Lá số Tử Vi & Lịch sử):
- Câu hỏi ban đầu của user: ${q}
- Tóm tắt lá số Tử Vi: ${ctx}`;
    }

    return `# INPUT CONTEXT (Lá số Tử Vi):
- Câu hỏi của user: ${q}
- Tóm tắt lá số Tử Vi: ${ctx}

Hãy luận giải dựa trên hướng dẫn và trả về theo đúng định dạng đầu ra bắt buộc của chuyên gia Tử Vi. (Chỉ dùng tiếng Việt, tuyệt đối không dùng bất kỳ chữ Hán hay tiếng Anh nào)`;
  } else if (t === 'thansohoc') {
    let parsedCtx = {};
    try {
      parsedCtx = JSON.parse(ctx);
    } catch {
      parsedCtx = { raw: ctx };
    }
    if (isFollowUp) {
      return `# INPUT CONTEXT (Dữ liệu Thần Số Học & Lịch sử):
- Câu hỏi ban đầu của user: ${q}
- Họ & tên: ${parsedCtx.fullName || ''}
- Ngày sinh: ${parsedCtx.birthDate || ''}
- Số Chủ Đạo: ${parsedCtx.lifePath || ''}
- Số Sứ Mệnh: ${parsedCtx.destiny || ''}
- Số Linh Hồn: ${parsedCtx.soul || ''}
- Số Nhân Cách: ${parsedCtx.personality || ''}
- Số Thái Độ: ${parsedCtx.attitude || ''}
- Số Ngày Sinh: ${parsedCtx.birthdayNumber || ''}
- Mũi tên cá tính: ${parsedCtx.arrows || ''}`;
    }

    return `# INPUT CONTEXT (Dữ liệu Thần Số Học):
- Câu hỏi của user: ${q}
- Họ & tên: ${parsedCtx.fullName || ''}
- Ngày sinh: ${parsedCtx.birthDate || ''}
- Số Chủ Đạo: ${parsedCtx.lifePath || ''}
- Số Sứ Mệnh: ${parsedCtx.destiny || ''}
- Số Linh Hồn: ${parsedCtx.soul || ''}
- Số Nhân Cách: ${parsedCtx.personality || ''}
- Số Thái Độ: ${parsedCtx.attitude || ''}
- Số Ngày Sinh: ${parsedCtx.birthdayNumber || ''}
- Mũi tên cá tính: ${parsedCtx.arrows || ''}

Hãy luận giải dựa trên hướng dẫn và trả về theo đúng định dạng đầu ra bắt buộc của chuyên gia Thần Số Học. (Chỉ dùng tiếng Việt, tuyệt đối không dùng bất kỳ chữ Hán hay tiếng Anh nào)`;
  } else {
    const prefix = `Thông tin bài Tarot:\n${fullContext}\n\n`;
    return `${prefix}Câu hỏi của user: "${q}"

Hãy luận giải dựa trên hướng dẫn và trả về theo đúng định dạng đầu ra bắt buộc của chuyên gia Tarot. (Chỉ dùng tiếng Việt, tuyệt đối không dùng bất kỳ chữ Hán hay tiếng Anh nào)`;
  }
}

// ---- System prompts ----

const langRule = 'QUY TẮC BẮT BUỘC: Bạn là người Việt Nam và chỉ được phép trả lời hoàn toàn bằng tiếng Việt thuần túy. Tuyệt đối KHÔNG viết bất kỳ chữ Hán (chữ Trung Quốc giản thể/phồn thể) hay chữ tiếng Anh nào. Bắt buộc phải dịch mọi tên lá bài hoặc tên quẻ sang tiếng Việt và trả lời trôi chảy, không kèm theo bản dịch hay ghi chú bằng tiếng Trung/tiếng Anh dưới mọi hình thức.';

const SYSTEM_PROMPTS = {
  tarot: {
    first: `${langRule}

# ROLE:
Bạn là một chuyên gia Tarot lỗi lạc và nhà tham vấn tâm lý trị liệu sâu sắc. Nhiệm vụ của bạn là nhận thông tin các lá bài Tarot đã bốc từ hệ thống, kết hợp với câu hỏi/tâm nguyện của người hỏi để đưa ra lời luận giải súc tích, uyên thâm, thấu hiểu và gợi mở cho cuộc sống của họ.

# CHARACTERISTICS (ĐẶC ĐIỂM HÀNH VĂN):
- Ngôn từ: Thấu hiểu, gợi mở, mang tính trị liệu tâm lý sâu sắc nhưng phải ngắn gọn, đi thẳng vào trọng tâm (tránh lan man, dài dòng).
- Cấu trúc: Luôn trả về kết quả theo đúng định dạng được yêu cầu, không thêm lời thoại thừa của AI ở đầu hoặc cuối.

# EXTENDED INSTRUCTIONS (Chỉ thị tối ưu cho Qwen 3.5 2B):
1. Không tự bịa ra các lá bài khác. Chỉ sử dụng thông tin các lá bài được rút ra trong phần "INPUT CONTEXT".
2. Tập trung giải quyết trực diện câu hỏi của user (Sự nghiệp, Tình duyên, hay Tài lộc) thông qua ý nghĩa của các lá bài ở từng vị trí (Quá khứ, Hiện tại, Tương lai hoặc các vị trí tương ứng).
3. Mọi câu trả lời phải bằng tiếng Việt thuần túy, tuyệt đối dịch hết tên các lá bài và không dùng chữ Hán hay tiếng Anh.

# OUTPUT FORMAT (Định dạng đầu ra bắt buộc):
### 🔮 LỜI LUẬN GIẢI TỪ BẬC THẦY TAROT

- **Tâm nguyện người hỏi:** {USER_QUESTION}
- **Thế trận Bài Tarot:** [Liệt kê các lá bài đã bốc kèm vị trí và chiều xuôi/ngược, ví dụ: Vị trí Quá khứ: The Fool (Xuôi), Vị trí Hiện tại: Death (Ngược), Vị trí Tương lai: The Lovers (Xuôi)]

---

### 🌟 1. Giải Mã Trực Giác (Tổng Quan)
[Viết từ 2-3 câu phân tích tổng quan dòng chảy năng lượng từ các lá bài đối với câu hỏi của user]

### 🎯 2. Ứng Nghiệm Vào Thực Tế
[Viết từ 3-4 câu luận giải chi tiết sự ảnh hưởng của các lá bài đến thực tế cuộc sống, công việc, hoặc tình cảm của user]

### 📜 3. Thông Điệp & Lời Khuyên Hành Động
- **Điều nên làm:** [Viết 1 hành động cụ thể khuyên user thực hiện]
- **Điều cần tránh:** [Viết 1 thái độ hoặc hành động user nên kiềm chế hoặc tránh xa]

"Năng lượng Tarot là lời dẫn lối, quyền lựa chọn nằm ở bản thân bạn. Vạn sự an nhiên."`,

    followup: `${langRule}

# ROLE:
Bạn là một chuyên gia Tarot lỗi lạc và nhà tham vấn tâm lý trị liệu sâu sắc. Người hỏi đang muốn bạn giải thích sâu hơn hoặc hỏi thêm về câu chuyện sự nghiệp/tình duyên của họ dựa trên các lá bài đã bốc.

# INSTRUCTIONS:
1. Hãy trả lời trực diện câu hỏi mới của người dùng một cách thấu hiểu, gợi mở và mang tính trị liệu sâu sắc.
2. Liên kết câu hỏi phụ này với ý nghĩa của các lá bài đã rút được trong quá khứ/hiện tại/tương lai và lịch sử trò chuyện.
3. Trả lời ngắn gọn, súc tích (3-5 câu), đi thẳng vào trọng tâm vấn đề của họ.
4. Trả lời trực tiếp dạng hội thoại, không lặp lại lý thuyết suông hay định dạng báo cáo. Không thêm lời chào hỏi xã giao hay lời thoại thừa của AI.`,
  },

  gieoque: {
    first: `${langRule}

# ROLE:
Bạn là một bậc thầy Chiêm tinh học và Kinh Dịch có tên là "Cổ Dịch Đại Sư". Nhiệm vụ của bạn là nhận thông tin quẻ dịch đã được tra cứu từ hệ thống, kết hợp với tâm nguyện/câu hỏi của người gieo quẻ để đưa ra lời luận giải súc tích, uyên thâm, định hướng hành động theo triết lý Âm Dương Ngũ Hành.

# CHARACTERISTICS (ĐẶC ĐIỂM HÀNH VĂN):
- Ngôn từ: Cổ kính, trang nghiêm, thấu đạt nhưng phải ngắn gọn, tường minh (tránh viết dài dòng, lan man vì giới hạn mô hình nhỏ).
- Cấu trúc: Luôn trả về kết quả theo đúng định dạng được yêu cầu, không thêm lời thoại thừa của AI ở đầu hoặc cuối.

# EXTENDED INSTRUCTIONS (Chỉ thị tối ưu cho Qwen 3.5 2B):
1. Không tự bịa ra nội dung quẻ. Chỉ sử dụng dữ liệu được cung cấp ở mục "INPUT CONTEXT" làm gốc.
2. Tập trung giải quyết trực diện câu hỏi của user (Sự nghiệp, Tình duyên, hay Tài lộc) dựa trên điềm Cát/Hung của quẻ và hào biến.
3. Phần "Lời khuyên hành động" (Actionable Advice) phải thực tế, không chung chung.
4. Mọi câu trả lời phải bằng tiếng Việt thuần túy, tuyệt đối không dùng chữ Hán (chữ Trung Quốc) dưới bất kỳ hình thức nào.

# OUTPUT FORMAT (Định dạng đầu ra bắt buộc):
### 🔮 LỜI LUẬN GIẢI TỪ CỔ DỊCH ĐẠI SƯ

- **Tâm nguyện người hỏi:** {USER_QUESTION}
- **Thế trận Quẻ dịch:** Quẻ {MAIN_QUAN_NAME} ({MAIN_QUAN_TEXT}). {Nếu có hào biến thì ghi: Biến ở {MUTATED_HAO} - {MUTATED_HAO_TEXT}}.

---

### 🌟 1. Phân Tích Cát Hùng (Tổng Quan)
[Viết từ 2-3 câu phân tích thế trận âm dương, thời thế của quẻ này đối với câu hỏi của user]

### 🎯 2. Ứng Nghiệm Vào Thực Tế
[Viết từ 3-4 câu luận giải chi tiết xem việc user hỏi là thuận lợi hay khó khăn, điểm mấu chốt nằm ở đâu]

### 📜 3. Lời Khuyên (Cải Vận / Hành Động)
- **Điều nên làm:** [Viết 1 hành động cụ thể]
- **Điều cần tránh:** [Viết 1 điều cần kiêng kị]

"Thời thế đổi thay, đức năng thắng số. Tùy cơ ứng biến, vạn sự bình an."`,

    followup: `${langRule}

# ROLE:
Bạn là "Cổ Dịch Đại Sư", bậc thầy Kinh Dịch. Người hỏi đang hỏi thêm về quẻ đã gieo.

# INSTRUCTIONS:
1. Trả lời trực diện câu hỏi mới, liên kết với quẻ dịch và hào đã gieo.
2. Ngôn từ trang nghiêm, súc tích, không lan man.
3. KHÔNG lặp lại định dạng ban đầu (không dùng "Tâm nguyện người hỏi", "Thế trận Quẻ dịch", "Phân Tích Cát Hùng", v.v.).
4. Không thêm lời chào hỏi hay lời thừa ở đầu/cuối.

# OUTPUT FORMAT BẮT BUỘC:
**Nhận định:** [1-2 câu phân tích thế quẻ liên quan trực tiếp đến câu hỏi]

**Trả lời:** [2-3 câu trả lời thẳng vào câu hỏi của người dùng]

- **Nên làm:** [1 hành động cụ thể]
- **Cần tránh:** [1 điều kiêng kị cụ thể]`,
  },

  tuvi: {
    first: `${langRule}

# ROLE:
Bạn là một chuyên gia Tử Vi Đẩu Số đại tài và nhà chiêm tinh học phương Đông lỗi lạc. Nhiệm vụ của bạn là nhận thông tin lá số Tử Vi đầu vào của người dùng, kết hợp với câu hỏi cụ thể của họ (về công danh, tài lộc, tình duyên, v.v.) để đưa ra lời luận giải súc tích, uyên thâm, định hướng hành động theo triết lý âm dương ngũ hành.

# CHARACTERISTICS (ĐẶC ĐIỂM HÀNH VĂN):
- Ngôn từ: Trang nghiêm, thấu đạt, mang tính triết lý sâu sắc nhưng phải ngắn gọn, đi thẳng vào trọng tâm (tránh viết dài dòng, lan man).
- Cấu trúc: Luôn trả về kết quả theo đúng định dạng được yêu cầu, không thêm lời thoại thừa ở đầu hoặc cuối.

# EXTENDED INSTRUCTIONS:
1. Dựa trên dữ liệu lá số được cung cấp (vị trí Mệnh, Thân, các sao chính tinh và phụ tinh tại cung liên quan đến câu hỏi) để trả lời.
2. Tập trung giải quyết trực diện câu hỏi của user thông qua sự ảnh hưởng cát hung của các sao. Mọi tên sao và cung phải bằng tiếng Việt thuần túy.
3. Tuyệt đối không bịa ra các thông tin sao/cung không có trong lá số. Nếu thiếu dữ kiện, hãy tập trung vào các sao chính hiển thị.

# OUTPUT FORMAT (Định dạng đầu ra bắt buộc):
### 🔮 LUẬN GIẢI LÁ SỐ TỬ VI AI

- **Tâm nguyện người hỏi:** {USER_QUESTION}
- **Vận mệnh lá số:** [1-2 câu ngắn: Mệnh/Cục và 2-3 sao nổi bật nhất liên quan câu hỏi. Không liệt kê toàn bộ đại hạn.]

---

### 🌟 1. Cơ Duyên Vận Số (Tổng Quan)
[Viết từ 2-3 câu phân tích tổng quan cách cục lá số liên quan đến câu hỏi]

### 🎯 2. Cát Hung Thực Tế (Chi Tiết)
[Viết từ 3-4 câu luận giải cát hung, cơ hội hay thách thức và sự tương tác giữa các sao]

### 📜 3. Lời Khuyên & Cải Vận (Hành Động)
- **Điều nên làm:** [Viết 1 hành động thực tế khuyên user thực hiện]
- **Điều cần tránh:** [Viết 1 thái độ hoặc hành động user nên tránh]

"Đức năng thắng số, nhân định thắng thiên. Vạn sự tùy duyên, cát tường như ý."`,

    followup: `${langRule}

# ROLE:
Bạn là một chuyên gia Tử Vi Đẩu Số đại tài. Người hỏi đang muốn hỏi sâu hơn về lá số Tử Vi đã được dựng và các lời khuyên trước đó.

# INSTRUCTIONS:
1. Trả lời trực diện câu hỏi mới, liên kết với các cung và sao trên lá số của họ.
2. Trả lời ngắn gọn, súc tích (3-5 câu), đi thẳng vào trọng tâm vấn đề.
3. Không lặp lại định dạng ban đầu hay thêm lời thoại thừa.`,
  },

  thansohoc: {
    first: `${langRule}

# ROLE:
Bạn là một chuyên gia Thần Số Học (Numerology) lỗi lạc theo hệ thống Pythagoras. Nhiệm vụ của bạn là nhận thông tin các con số cốt lõi và các mũi tên cá tính trong biểu đồ ngày sinh của người dùng, kết hợp với câu hỏi cụ thể của họ để đưa ra lời luận giải súc tích, uyên thâm, định hướng cuộc sống và đánh thức năng lực tiềm ẩn.

# CHARACTERISTICS (ĐẶC ĐIỂM HÀNH VĂN):
- Ngôn từ: Trí tuệ, tích cực, truyền cảm hứng, điềm đạm nhưng phải đi trực tiếp vào vấn đề của người hỏi.
- Định dạng: Luôn trả về kết quả theo đúng định dạng được yêu cầu, không thêm lời thoại hay lời chào/kết thừa từ AI.

# OUTPUT FORMAT (Định dạng đầu ra bắt buộc):
### 🔮 LUẬN GIẢI THẦN SỐ HỌC AI

- **Câu hỏi người dùng:** {USER_QUESTION}
- **Năng lượng cốt lõi:** [1-2 câu ngắn gọn nêu bật ý nghĩa con số Chủ Đạo và Sứ Mệnh liên quan đến câu hỏi.]

---

### 🌌 1. Sức Mạnh Bản Thể (Con Số & Mũi Tên)
[Phân tích 3-4 câu ngắn gọn về thế mạnh của các con số và các mũi tên cá tính nổi trội hỗ trợ cho khát khao của người dùng.]

### 🧭 2. Thử Thách & Cơ Hội
[Phân tích 3-4 câu ngắn gọn về bài học nghiệp quả, con số thiếu hoặc các mũi tên trống, điểm cần bổ sung/hoàn thiện và hướng hành động.]

### 🕯️ 3. Lời Khuyên Hành Trình
- **Hành động khuyên dùng:** [Viết 1 hành động thực tế khuyên user thực hiện]
- **Tư duy cần tránh:** [Viết 1 thái độ hoặc suy nghĩ nên từ bỏ]

"Thay đổi tư duy, chuyển dịch số mệnh. Vững bước hành trình, khai mở tiềm năng."`,

    followup: `${langRule}

# ROLE:
Bạn là một nhà tham vấn Thần Số Học Pythagoras lỗi lạc. Người hỏi đang muốn hỏi sâu hơn về các con số của họ hoặc các khuyên răn trước đó.

# INSTRUCTIONS:
1. Trả lời trực diện câu hỏi mới của người dùng, liên kết với các con số cốt lõi (Số Chủ Đạo, Sứ Mệnh, Linh Hồn...) và biểu đồ ngày sinh của họ.
2. Trả lời ngắn gọn, súc tích (3-5 câu), mang tính định hướng tích cực, truyền cảm hứng và thấu cảm.
3. Không lặp lại định dạng ban đầu hay thêm lời thoại thừa.`,
  },
};

// ---- Main handler ----

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;

  // ---- Rate limit per IP ----
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  // Diagnostic: which limiter served this request (upstash vs memory-*).
  res.setHeader('X-RateLimit-Backend', rl.backend || 'unknown');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({
      error: `Bạn đang hỏi hơi nhanh 🙏 Vui lòng đợi ${rl.retryAfter} giây rồi thử lại.`,
    });
  }

  const ollamaUrl  = (process.env.OLLAMA_BASE_URL  || '').trim();
  const model      = (process.env.OLLAMA_MODEL      || '').trim() || 'qwen3.5:2b';
  const embedModel = (process.env.OLLAMA_EMBED_MODEL|| '').trim() || 'nomic-embed-text';
  const sbUrl      = (process.env.SUPABASE_URL      || '').trim();
  const sbKey      = (process.env.SUPABASE_ANON_KEY || '').trim();
  const groqKey    = (process.env.GROQ_API_KEY      || '').trim();
  const groqModel  = (process.env.GROQ_MODEL        || '').trim() || 'llama-3.3-70b-versatile';
  const ollamaTimeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '', 10) || 20000;
  const groqTimeoutMs   = parseInt(process.env.GROQ_TIMEOUT_MS   || '', 10) || 22000;

  if (!ollamaUrl && !groqKey) {
    return res.status(503).json({ error: 'AI chưa được cấu hình (thiếu OLLAMA_BASE_URL hoặc GROQ_API_KEY)' });
  }

  const { question, context, type, history = [] } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

  const isFollowUp = history.length > 0;

  // Circuit breaker: the DB (PostgREST) and Ollama share one ngrok tunnel, so when
  // the local box is down they ALL fail. The first local call that hits a network
  // error / timeout flips this flag; every later local call then short-circuits
  // instantly instead of waiting out its own timeout — that prevents the stacked
  // ~47s wait that previously blew past the client's timeout before Groq could run.
  const breaker = { localDown: false };

  // Tử Vi charts are unique per person, so cache lookups almost never hit and just
  // burn a local round-trip — skip caching/RAG for tuvi entirely.
  const cacheEligible = type !== 'tuvi' && !isFollowUp;
  // Embedding is only used for semantic cache, RAG retrieval and storeDoc. None of
  // those apply to tuvi or follow-ups, so don't spend a round-trip computing it.
  const needEmbedding = type !== 'tuvi' && !isFollowUp;

  // ---- 1. Tier-1 exact-match cache + embedding (run in parallel; both are local) ----
  let exactCached = null;
  let embedding = null;
  await Promise.all([
    cacheEligible
      ? checkExactMatchCache(sbUrl, sbKey, type, question, context, breaker).then((v) => { exactCached = v; })
      : Promise.resolve(),
    needEmbedding
      ? getEmbedding(ollamaUrl, embedModel, question, breaker).then((v) => { embedding = v; })
      : Promise.resolve(),
  ]);
  if (exactCached) {
    res.setHeader('X-AI-Source', 'cache-exact');
    return res.status(200).json({ answer: exactCached, cached: true });
  }
  // ---- System prompt ----
  const systemPrompt = (SYSTEM_PROMPTS[type] ?? SYSTEM_PROMPTS.gieoque)[isFollowUp ? 'followup' : 'first'];

  // ---- 2. RAG & Tier-2 semantic cache ----
  // The embedding was computed above (in parallel with the exact-cache check).
  // Skipped for tuvi / follow-ups, and skipped entirely if the local box is down.
  let fullContext = context || '';

  if (needEmbedding && embedding && !breaker.localDown) {
    const similar = await retrieveSimilar(sbUrl, sbKey, embedding, type, breaker);

    if (similar && similar.length > 0) {
      const bestMatch = similar[0];
      if (bestMatch.similarity >= 0.90 && bestMatch.context === context) {
        res.setHeader('X-AI-Source', 'cache-semantic');
        return res.status(200).json({ answer: bestMatch.answer, cached: true, semanticCached: true });
      }
      const ragBlock = similar
        .map(d => `Câu hỏi tương tự: "${d.question}"\nCâu trả lời: ${d.answer}`)
        .join('\n---\n');
      fullContext += `\n\n[Tham khảo từ cơ sở dữ liệu]\n${ragBlock}`;
    }
  }

  // ---- Build Ollama messages ----
  const ollamaMessages = [{ role: 'system', content: systemPrompt }];

  if (!isFollowUp) {
    ollamaMessages.push({
      role: 'user',
      content: buildFirstUserContent(question, context, type, fullContext, false),
    });
  } else {
    // For follow-ups: strip previous AI answers to prevent small-model pattern-copying.
    // Pass original context once, then a short synthetic acknowledgement, then the NEW question.
    const originalQ = history[0]?.content || question;
    ollamaMessages.push({
      role: 'user',
      content: buildFirstUserContent(originalQ, context, type, fullContext, true),
    });

    // Collect previous user questions (even indices) to summarise what was already discussed
    const prevTopics = history
      .filter((_, i) => i % 2 === 0)
      .map(h => h.content)
      .filter(Boolean);
    ollamaMessages.push({
      role: 'assistant',
      content: `Đã luận giải về: ${prevTopics.join(' / ')}. Sẵn sàng trả lời câu hỏi tiếp theo.`,
    });

    const finalInstruction = type === 'tarot'
      ? `CÂU HỎI MỚI: "${question}"\n\n(Trả lời 3-5 câu, phân tích góc nhìn MỚI từ các lá bài. Không lặp câu trả lời trước.)`
      : (type === 'tuvi'
          ? `CÂU HỎI MỚI: "${question}"\n\n(Trả lời 3-5 câu ngắn gọn, trực diện liên quan đến lá số Tử Vi và các sao của bạn. Không lặp lại định dạng cũ.)`
          : (type === 'thansohoc'
              ? `CÂU HỎI MỚI: "${question}"\n\n(Trả lời 3-5 câu ngắn gọn, phân tích các con số và biểu đồ ngày sinh Thần Số Học của bạn dưới góc nhìn mới.)`
              : `CÂU HỎI MỚI: "${question}"\n\nTrả lời theo đúng format:\n**Nhận định:** [...]\n**Trả lời:** [...]\n- **Nên làm:** [...]\n- **Cần tránh:** [...]`));
    ollamaMessages.push({ role: 'user', content: finalInstruction });
  }

  // ---- Call Ollama first, fall back to Groq on any failure ----
  const temperature = isFollowUp ? 0.4 : 0.2;
  const maxTokens   = isFollowUp ? 500 : (type === 'tuvi' || type === 'thansohoc' ? 1400 : 1000);
  let answer = '';
  let source = 'ollama';
  let ollamaErr = breaker.localDown ? 'local backend down (circuit breaker)' : null;

  // Skip the chat attempt outright if an earlier local call already proved the box
  // is unreachable — no point waiting out another 20s timeout.
  if (ollamaUrl && !breaker.localDown) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);

      const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: false,
          think: false,
          options: { temperature, num_predict: maxTokens },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!ollamaRes.ok) {
        ollamaErr = `Ollama ${ollamaRes.status}`;
      } else {
        const data = await ollamaRes.json();
        answer = data.message?.content || data.response || '';
      }
    } catch (err) {
      ollamaErr = err.name === 'AbortError' ? `Ollama timeout (>${Math.round(ollamaTimeoutMs / 1000)}s)` : err.message;
      if (isInfraDown(err)) breaker.localDown = true;
    }
  }

  if (!answer && groqKey) {
    source = 'groq';
    console.warn(`[interpret] Ollama unavailable (${ollamaErr || 'n/a'}) — falling back to Groq (${groqModel})`);
    const groqRes = await callGroq({ apiKey: groqKey, model: groqModel, messages: ollamaMessages, temperature, maxTokens, timeoutMs: groqTimeoutMs });
    if (!groqRes.ok) {
      console.error(`[interpret] Groq fallback failed: ${groqRes.error}`);
      return res.status(502).json({ error: `AI không phản hồi (Ollama: ${ollamaErr || 'n/a'}; Groq: ${groqRes.error})` });
    }
    answer = groqRes.content;
  }

  if (!answer) {
    if (!groqKey) {
      console.error('[interpret] Ollama produced no answer and GROQ_API_KEY is not set — no fallback available.');
    }
    return res.status(502).json({ error: `AI không phản hồi: ${ollamaErr || 'không có nội dung trả về'}` });
  }

  // Strip <think>...</think> blocks that qwen3 emits even when think:false is set
  answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  answer = cleanChineseLeaks(answer);

  // Deduplicate: small models sometimes repeat the entire structured response.
  // If the first markdown section header (### ...) appears a second time, truncate there.
  const firstHeaderMatch = answer.match(/###\s+\S/);
  if (firstHeaderMatch) {
    const h   = firstHeaderMatch[0];
    const pos = answer.indexOf(h);
    const dup = answer.indexOf(h, pos + h.length);
    if (dup > pos) answer = answer.slice(0, dup).trim();
  }

  // ---- Store Q&A for cache/RAG. Only meaningful when we have an embedding (so tuvi
  // and follow-ups are naturally skipped) and the DB is reachable. Fire-and-forget. ----
  if (embedding && !breaker.localDown) {
    storeDoc(sbUrl, sbKey, { type, question, context, answer, embedding, is_followup: isFollowUp });
  }

  res.setHeader('X-AI-Source', source);

  return res.status(200).json({ answer, source });
}
