/**
 * hoang-dao/js/app.js — Cung Hoàng Đạo: nhận diện cung, luận giải chi tiết,
 * tử vi hằng ngày (seeded), độ hợp cặp đôi, AI luận giải, share card.
 * Cần: zodiac-data.js (ZODIAC, zodiacOfDate, DAILY_POOLS, Z_COLORS),
 *      profile.js (tùy chọn), ai.js + chat.js (window.Chat).
 */
(function () {
  'use strict';

  const P = window.LatbaiProfile || null;
  const root = document.getElementById('hd-root');
  if (!root) return;

  const MAX_HISTORY = 12;   // đồng bộ 6 module (server cap 20)
  const MAX_ASK = 5;        // số câu hỏi tối đa mỗi phiên
  let currentSign = null;
  let chatHistory = [];
  let questionsAsked = 0;
  let chat = null;

  function seedHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  const pick = (arr, seed) => arr[seed % arr.length];

  // ==================== PICKER ====================
  function renderPicker() {
    root.innerHTML = `
      <div class="hd-card hd-picker">
        <h2 class="hd-picker-title"><i class="ti ti-sparkles"></i> Chọn cung hoàng đạo của bạn</h2>
        <p class="hd-picker-sub">Nhập ngày sinh để tự nhận diện, hoặc chọn thẳng cung bên dưới.</p>
        <form id="hd-form" class="hd-form">
          <select id="hd-day" class="hd-select" aria-label="Ngày sinh"><option value="">Ngày</option></select>
          <select id="hd-month" class="hd-select" aria-label="Tháng sinh"><option value="">Tháng</option></select>
          <button type="submit" class="hd-btn"><i class="ti ti-search"></i> Xem cung</button>
        </form>
        <div class="hd-grid">
          ${ZODIAC.map((z) => `<button type="button" class="hd-sign-chip" data-sign="${z.ten}">
            <span class="hd-chip-sym">${z.sym}</span><span class="hd-chip-name">${z.ten}</span>
            <span class="hd-chip-range">${z.range}</span></button>`).join('')}
        </div>
      </div>`;

    const dSel = document.getElementById('hd-day');
    const mSel = document.getElementById('hd-month');
    for (let i = 1; i <= 31; i++) dSel.innerHTML += `<option value="${i}">${i}</option>`;
    for (let i = 1; i <= 12; i++) mSel.innerHTML += `<option value="${i}">${i}</option>`;

    document.getElementById('hd-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = parseInt(dSel.value), m = parseInt(mSel.value);
      if (!d || !m) return;
      show(zodiacOfDate(d, m));
    });
    root.querySelectorAll('.hd-sign-chip').forEach((b) => {
      b.addEventListener('click', () => show(ZODIAC.find((z) => z.ten === b.dataset.sign)));
    });
  }

  // ==================== DAILY ====================
  function dailyFor(sign) {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const s = (k) => seedHash(sign.en + '|' + dateKey + '|' + k);
    const stars = 3 + (s('star') % 3); // 3–5 sao
    return {
      dateLabel: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
      stars,
      tongQuan: pick(DAILY_POOLS.tongQuan, s('tq')),
      tinhYeu: pick(DAILY_POOLS.tinhYeu, s('ty')),
      suNghiep: pick(DAILY_POOLS.suNghiep, s('sn')),
      taiChinh: pick(DAILY_POOLS.taiChinh, s('tc')),
      loiKhuyen: pick(DAILY_POOLS.loiKhuyen, s('lk')),
      soMayMan: (s('num') % 99) + 1,
      mauMayMan: pick(Z_COLORS, s('color')),
    };
  }

  // ==================== COMPATIBILITY ====================
  function compat(a, bName) {
    let score, verdict;
    if (a.hop.includes(bName)) { score = 82 + (seedHash(a.en + bName) % 14); verdict = 'Rất hợp'; }
    else if (a.khac.includes(bName)) { score = 44 + (seedHash(a.en + bName) % 14); verdict = 'Cần dung hòa'; }
    else { score = 62 + (seedHash(a.en + bName) % 18); verdict = 'Khá hợp'; }
    return { score, verdict };
  }

  // ==================== NHÓM NGUYÊN TỐ (Tứ Đại) ====================
  function elementCard(sign) {
    const E = (typeof Z_ELEMENTS !== 'undefined') ? Z_ELEMENTS[sign.nguyeTo] : null;
    if (!E) return '';
    const hopNames = E.hopVoi.map((k) => Z_ELEMENTS[k] ? Z_ELEMENTS[k].ten : k).join(' và ');
    const signChips = E.cung.map((c) =>
      `<span class="hd-el-sign${c === sign.ten ? ' is-me' : ''}" data-sign="${c}">${c}</span>`).join('');
    return `
      <div class="hd-card hd-element" style="--el:${E.mau}">
        <div class="hd-sec-head"><i class="ti ti-flame"></i> Nhóm nguyên tố · ${E.icon} ${E.ten}</div>
        <div class="hd-el-hero">
          <span class="hd-el-badge">${E.icon}</span>
          <div>
            <p class="hd-el-name">Cung ${E.en} — nhóm ${E.ten}</p>
            <p class="hd-el-signs">${signChips}</p>
          </div>
        </div>
        <p class="hd-body">${E.khiChat}</p>
        <div class="hd-sw">
          <div class="hd-sw-col hd-strong">
            <span class="hd-sw-title"><i class="ti ti-plus"></i> Chất mạnh nhóm ${E.ten}</span>
            <ul>${E.manh.map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
          <div class="hd-sw-col hd-weak">
            <span class="hd-sw-title"><i class="ti ti-minus"></i> Mặt cần tiết chế</span>
            <ul>${E.bongToi.map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="hd-el-facets">
          <p><b>Trong tình yêu:</b> ${E.tinhYeu}</p>
          <p><b>Trong công việc:</b> ${E.congViec}</p>
        </div>
        <p class="hd-el-compat"><i class="ti ti-arrows-shuffle"></i> Nhóm ${E.ten} cộng hưởng tự nhiên với <b>nhóm ${hopNames}</b> và các cung cùng ${E.ten}; dễ va chạm hơn với <b>${E.thachThuc}</b>.</p>
      </div>`;
  }

  // ==================== NHÓM TÍNH CHẤT (Tam Thái) ====================
  function modalityCard(sign) {
    const M = (typeof Z_MODALITY !== 'undefined') ? Z_MODALITY[sign.tinhChat] : null;
    if (!M) return '';
    const signChips = M.cung.map((c) =>
      `<span class="hd-el-sign${c === sign.ten ? ' is-me' : ''}" data-sign="${c}">${c}</span>`).join('');
    return `
      <div class="hd-card hd-element" style="--el:${M.mau}">
        <div class="hd-sec-head"><i class="ti ti-adjustments"></i> Nhóm tính chất · ${M.icon} ${M.ten}</div>
        <div class="hd-el-hero">
          <span class="hd-el-badge">${M.icon}</span>
          <div>
            <p class="hd-el-name">${M.en} — nhóm ${M.ten}</p>
            <p class="hd-el-signs">${signChips}</p>
          </div>
        </div>
        <p class="hd-body">${M.khiChat}</p>
        <div class="hd-el-facets">
          <p><b>Chất riêng của nhóm ${M.ten}:</b> ${M.manh.join(' · ')}.</p>
        </div>
      </div>`;
  }

  // Giải thích "vì sao hợp" theo nguyên tố — suy từ Z_ELEMENTS.hopVoi (không data trùng).
  function elementWhy(elA, elB) {
    const E = (typeof Z_ELEMENTS !== 'undefined') ? Z_ELEMENTS : null;
    if (!E || !E[elA] || !E[elB]) return '';
    if (elA === elB) return `Cùng nhóm ${E[elA].ten} — chung khí chất, dễ đồng điệu và hiểu nhau không cần giải thích.`;
    if (E[elA].hopVoi.includes(elB)) return `${E[elA].ten} gặp ${E[elB].ten} — hai nguyên tố cộng hưởng tự nhiên, bổ khuyết cho nhau.`;
    return `${E[elA].ten} và ${E[elB].ten} khác khí chất — hút nhau kiểu đối cực, cần dung hòa và đối thoại nhiều hơn.`;
  }

  // ==================== RENDER SIGN ====================
  function show(sign) {
    currentSign = sign;
    const d = dailyFor(sign);
    const starHtml = '★'.repeat(d.stars) + '☆'.repeat(5 - d.stars);

    root.innerHTML = `
      <div class="hd-card hd-hero">
        <div class="hd-hero-sym">${sign.sym}</div>
        <h2 class="hd-hero-name">${sign.ten} <span class="hd-hero-en">${sign.en}</span></h2>
        <p class="hd-hero-range">${sign.range}</p>
        <div class="hd-hero-chips">
          <span><i class="ti ti-flame"></i> ${sign.nguyeTo}</span>
          <span><i class="ti ti-planet"></i> ${sign.sao}</span>
          <span><i class="ti ti-palette"></i> ${sign.mau}</span>
          <span><i class="ti ti-number"></i> Số ${sign.so}</span>
        </div>
      </div>

      <div class="hd-card hd-daily">
        <div class="hd-sec-head"><i class="ti ti-sun"></i> Tử vi hôm nay · ${d.dateLabel}</div>
        <div class="hd-stars">${starHtml}</div>
        <p class="hd-daily-main">${d.tongQuan}</p>
        <div class="hd-daily-grid">
          <div><span class="hd-daily-label"><i class="ti ti-heart"></i> Tình yêu</span><p>${d.tinhYeu}</p></div>
          <div><span class="hd-daily-label"><i class="ti ti-briefcase"></i> Sự nghiệp</span><p>${d.suNghiep}</p></div>
          <div><span class="hd-daily-label"><i class="ti ti-coins"></i> Tài chính</span><p>${d.taiChinh}</p></div>
        </div>
        <p class="hd-daily-lucky">May mắn hôm nay: số <b>${d.soMayMan}</b> · màu <b>${d.mauMayMan}</b></p>
        <p class="hd-daily-advice"><i class="ti ti-bulb"></i> ${d.loiKhuyen}</p>
      </div>

      <div class="hd-card">
        <div class="hd-sec-head"><i class="ti ti-user-circle"></i> Tính cách ${sign.ten}</div>
        <p class="hd-body">${sign.tongQuan}</p>
        <div class="hd-sw">
          <div class="hd-sw-col hd-strong">
            <span class="hd-sw-title"><i class="ti ti-plus"></i> Điểm mạnh</span>
            <ul>${sign.manh.map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
          <div class="hd-sw-col hd-weak">
            <span class="hd-sw-title"><i class="ti ti-minus"></i> Điểm yếu</span>
            <ul>${sign.yeu.map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
        </div>
      </div>

      ${elementCard(sign)}

      ${modalityCard(sign)}

      <div class="hd-card">
        <div class="hd-sec-head"><i class="ti ti-heart"></i> Tình yêu · Sự nghiệp · Tài chính</div>
        <div class="hd-aspect"><span class="hd-aspect-label">💕 Tình yêu</span><p>${sign.tinhYeu}</p></div>
        <div class="hd-aspect"><span class="hd-aspect-label">💼 Sự nghiệp</span><p>${sign.suNghiep}</p></div>
        <div class="hd-aspect"><span class="hd-aspect-label">💰 Tài chính</span><p>${sign.taiChinh}</p></div>
      </div>

      <div class="hd-card hd-match">
        <div class="hd-sec-head"><i class="ti ti-hearts"></i> Độ hợp cặp đôi</div>
        <p class="hd-match-hint">Chọn cung của người ấy để xem độ hợp với ${sign.ten}:</p>
        <select id="hd-match-sel" class="hd-select">
          <option value="">— Chọn cung —</option>
          ${ZODIAC.filter((z) => z.ten !== sign.ten).map((z) => `<option value="${z.ten}">${z.sym} ${z.ten}</option>`).join('')}
        </select>
        <div id="hd-match-result"></div>
        <div class="hd-match-quick">
          <span class="hd-hop"><i class="ti ti-check"></i> Hợp nhất: ${sign.hop.join(', ')}</span>
          <span class="hd-khac"><i class="ti ti-alert-triangle"></i> Cần dung hòa: ${sign.khac.join(', ')}</span>
        </div>
      </div>

      <div id="hd-ai" class="hd-card hd-ai">
        <div class="hd-sec-head"><i class="ti ti-wand"></i> Hỏi chuyên gia Chiêm tinh AI</div>
        <div id="hd-chat" class="hd-chat"></div>
        <div id="hd-loading" class="hd-loading hidden"><span>Chuyên gia đang luận giải...</span></div>
        <div class="hd-chips">
          <button type="button" class="hd-qchip" data-q="Năm nay ${sign.ten} nên chú ý điều gì về sự nghiệp và tình duyên?">Vận năm nay của tôi</button>
          <button type="button" class="hd-qchip" data-q="${sign.ten} hợp với công việc, ngành nghề nào nhất?">Nghề phù hợp</button>
          <button type="button" class="hd-qchip" data-q="Làm sao để ${sign.ten} cải thiện điểm yếu của mình?">Cải thiện điểm yếu</button>
        </div>
        <div class="hd-chat-row">
          <input id="hd-chat-input" class="hd-chat-input" type="text" placeholder="Hỏi về cung ${sign.ten} của bạn..." maxlength="300" aria-label="Câu hỏi cho AI">
          <button id="hd-ask" class="hd-ask"><i class="ti ti-send"></i></button>
        </div>
      </div>

      <div class="hd-actions">
        <button type="button" id="hd-share" class="hd-btn"><i class="ti ti-share"></i> Chia sẻ</button>
        <button type="button" id="hd-other" class="hd-btn-sub"><i class="ti ti-arrows-left-right"></i> Xem cung khác</button>
      </div>
      <p class="hd-disclaimer">Nội dung chiêm tinh phương Tây mang tính tham khảo &amp; giải trí, không thay thế quyết định của bạn.</p>
    `;

    // compatibility
    document.getElementById('hd-match-sel').addEventListener('change', (e) => {
      const bName = e.target.value;
      const box = document.getElementById('hd-match-result');
      if (!bName) { box.innerHTML = ''; return; }
      const r = compat(sign, bName);
      const bSign = ZODIAC.find((z) => z.ten === bName);
      const why = bSign ? elementWhy(sign.nguyeTo, bSign.nguyeTo) : '';
      const cls = r.score >= 80 ? 'good' : r.score >= 62 ? 'mid' : 'low';
      box.innerHTML = `<div class="hd-match-score hd-${cls}">
        <span class="hd-match-pct">${r.score}%</span>
        <span class="hd-match-verdict">${sign.ten} × ${bName}: ${r.verdict}</span>
      </div>${why ? `<p class="hd-match-why"><i class="ti ti-flame"></i> ${why}</p>` : ''}`;
    });

    document.getElementById('hd-other').addEventListener('click', renderPicker);
    document.getElementById('hd-share').addEventListener('click', () => shareCard(sign, d));

    // Bấm cung cùng nhóm nguyên tố → chuyển sang cung đó
    root.querySelectorAll('.hd-el-sign[data-sign]').forEach((el) => {
      el.addEventListener('click', () => {
        const z = ZODIAC.find((s) => s.ten === el.dataset.sign);
        if (z && z.ten !== sign.ten) show(z);
      });
    });

    // AI
    setupAI(sign);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== AI ====================
  function buildContext(sign) {
    const E = (typeof Z_ELEMENTS !== 'undefined') ? Z_ELEMENTS[sign.nguyeTo] : null;
    const MOD = (typeof Z_MODALITY !== 'undefined') ? Z_MODALITY[sign.tinhChat] : '';
    return JSON.stringify({
      cung: sign.ten, en: sign.en, nguyeTo: sign.nguyeTo, sao: sign.sao,
      tinhChat: sign.tinhChat, manh: sign.manh.join(', '), yeu: sign.yeu.join(', '),
      hop: sign.hop.join(', '), khac: sign.khac.join(', '),
      nhomNguyenTo: E ? `${E.ten} (${E.cung.join(', ')}) — ${E.khiChat}` : sign.nguyeTo,
      nguyenToCongHuong: E ? `${E.hopVoi.map((k) => Z_ELEMENTS[k] ? Z_ELEMENTS[k].ten : k).join(', ')}` : '',
      tinhChatVanHanh: MOD ? MOD.tomTat : sign.tinhChat,
      nhomTinhChat: MOD ? `${MOD.ten} (${MOD.cung.join(', ')})` : sign.tinhChat,
    });
  }

  function setupAI(sign) {
    // chat.js khai báo `const Chat` (global nhưng KHÔNG nằm trên window)
    const ChatLib = (typeof Chat !== 'undefined') ? Chat : null;
    if (!ChatLib) { document.getElementById('hd-ai').style.display = 'none'; return; }
    chatHistory = []; questionsAsked = 0;
    const messagesEl = document.getElementById('hd-chat');
    const loadingEl = document.getElementById('hd-loading');
    const inputEl = document.getElementById('hd-chat-input');
    const btnEl = document.getElementById('hd-ask');
    chat = ChatLib.createChat({ messagesEl, loadingEl, inputEl, btnEl });
    chat.appendBubble('ai', `Chào bạn! Mình là chuyên gia chiêm tinh. Hãy hỏi bất cứ điều gì về cung **${sign.ten}** của bạn — tình duyên, sự nghiệp, hay cách phát huy thế mạnh nhé.`);

    const disableChips = () => document.querySelectorAll('.hd-qchip').forEach(b => b.disabled = true);

    function send(q) {
      q = (q || '').trim();
      if (!q || !chat) return;
      // hoang-dao không tự gửi lượt đầu (lời chào là bubble tĩnh) nên đếm MỌI câu.
      if (questionsAsked >= MAX_ASK) {
        chat.appendBubble('ai', `💡 *Thông báo:* Bạn đã hỏi đủ ${MAX_ASK} câu cho phiên này. Hãy **tải lại trang** hoặc xem cung khác để hỏi tiếp nhé!`);
        disableChips();
        return;
      }
      questionsAsked++;
      inputEl.value = '';
      chat.sendWithUI({
        question: q, context: buildContext(sign), type: 'hoangdao', history: chatHistory,
        onDone(ans) {
          chatHistory.push({ role: 'user', content: q });
          chatHistory.push({ role: 'assistant', content: ans });
          if (chatHistory.length > MAX_HISTORY) chatHistory = chatHistory.slice(-MAX_HISTORY);
          if (questionsAsked >= MAX_ASK) {
            inputEl.placeholder = `Đã đạt giới hạn ${MAX_ASK} câu hỏi...`;
            inputEl.disabled = true;
            btnEl.disabled = true;
            disableChips();
            chat.appendBubble('ai', `💡 *Thông báo:* Bạn đã dùng đủ ${MAX_ASK} câu hỏi cho phiên này. Xem cung khác hoặc tải lại trang để hỏi tiếp nhé!`);
          }
        },
        onError() {
          questionsAsked--;   // hoàn lượt, lỗi không tính
        },
      });
    }
    btnEl.addEventListener('click', () => send(inputEl.value));
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(inputEl.value); } });
    document.querySelectorAll('.hd-qchip').forEach((c) => c.addEventListener('click', () => send(c.dataset.q)));
  }

  // ==================== SHARE CARD ====================
  // Thẻ hoàng đạo dùng visual TỐI riêng (gradient tím, viền tím đơn) khác
  // scaffold nền-kem — nên chỉ mượn setup/F/wrapText/shareOrDownload, tự vẽ nền.
  async function shareCard(sign, d) {
    const S = window.LatbaiShareCard;
    const W = 1080, H = 1350;
    const { cv, ctx } = await S.setup(W, H);
    const F = S.F;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241a3a'); g.addColorStop(1, '#0f0a1e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(196,164,252,0.7)'; ctx.lineWidth = 6; ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c4a4fc'; ctx.font = F(30, 800); ctx.fillText('CUNG HOÀNG ĐẠO · LATBAI.VN', W / 2, 118);
    ctx.fillStyle = '#fff'; ctx.font = '200px serif'; ctx.fillText(sign.sym, W / 2, 380);
    ctx.font = F(64, 900); ctx.fillText(sign.ten, W / 2, 480);
    ctx.fillStyle = '#c9bce0'; ctx.font = F(34, 600); ctx.fillText(sign.range + '  ·  ' + sign.nguyeTo, W / 2, 540);
    // sao
    ctx.fillStyle = '#f5c451'; ctx.font = '54px serif';
    ctx.fillText('★'.repeat(d.stars) + '☆'.repeat(5 - d.stars), W / 2, 640);
    // tử vi hôm nay
    ctx.fillStyle = '#eee'; ctx.font = F(30, 500);
    S.wrapText(ctx, 'Tử vi hôm nay: ' + d.tongQuan, W / 2, 720, W - 200, 46, 20);
    ctx.fillStyle = '#c4a4fc'; ctx.font = F(28, 700);
    ctx.fillText('May mắn: số ' + d.soMayMan + ' · màu ' + d.mauMayMan, W / 2, 980);
    // footer riêng (màu tím, khác scaffold footer nền-kem)
    ctx.fillStyle = '#8a7ba8'; ctx.font = F(26, 600);
    ctx.fillText('Xem cung của bạn tại  latbai.vn/hoang-dao', W / 2, H - 90);

    await S.shareOrDownload(cv, {
      fileName: `cung-${sign.en.toLowerCase()}.png`,
      title: 'Cung ' + sign.ten,
      text: `Mình là cung ${sign.ten} ${sign.sym}! Xem cung của bạn tại latbai.vn/hoang-dao`,
      wantShare: true,
    });
  }

  // ==================== BOOT ====================
  function boot() {
    const p = P && P.get();
    if (p && p.day && p.month) show(zodiacOfDate(p.day, p.month));
    else renderPicker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
