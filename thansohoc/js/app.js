/**
 * thansohoc/js/app.js
 * Numerology Pythagorean calculations, birth chart rendering, arrow detection, and AI master chat.
 */

// Interpretation content (NUM_MEANINGS, INDICATOR_NAMES, ARROWS_INFO) lives in js/numerology-data.js

// ==================== CALCULATION HELPERS ====================
function removeVietnameseAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

const PYTHAGOREAN_MAP = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9
};

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

function reduceNumber(num, keepMaster = true) {
  while (num > 9) {
    if (keepMaster && (num === 11 || num === 22 || num === 33)) {
      break;
    }
    num = num.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  }
  return num;
}

function calculateNumerology(fullName, day, month, year) {
  const cleanName = removeVietnameseAccents(fullName).replace(/[^A-Z]/g, '');
  
  // 1. Số Chủ Đạo (Life Path)
  const dobString = `${day}${month}${year}`.replace(/\D/g, '');
  let lpSum = dobString.split('').reduce((sum, d) => sum + parseInt(d), 0);
  // Reduce to a single digit, except the master numbers 11/22/33 which are kept.
  while (lpSum > 9 && lpSum !== 11 && lpSum !== 22 && lpSum !== 33) {
    lpSum = lpSum.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  }
  let lifePathVal = lpSum.toString();
  if (lpSum === 22) lifePathVal = "22/4";
  if (lpSum === 33) lifePathVal = "33/6";

  // 2. Số Ngày Sinh (Birthday Number)
  const birthdayVal = reduceNumber(parseInt(day), true).toString();

  // 3. Số Thái Độ (Attitude Number)
  const attitudeVal = reduceNumber(parseInt(day) + parseInt(month), true).toString();

  // Name calculations
  let destinySum = 0;
  let soulSum = 0;
  let personalitySum = 0;

  for (let i = 0; i < cleanName.length; i++) {
    const char = cleanName[i];
    const val = PYTHAGOREAN_MAP[char] || 0;
    destinySum += val;
    if (VOWELS.has(char)) {
      soulSum += val;
    } else {
      personalitySum += val;
    }
  }

  const destinyVal = reduceNumber(destinySum, true).toString();
  const soulVal = reduceNumber(soulSum, true).toString();
  const personalityVal = reduceNumber(personalitySum, true).toString();

  // 4. Birth Chart digit counts
  const cellCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < dobString.length; i++) {
    const d = dobString[i];
    if (cellCounts[d] !== undefined) {
      cellCounts[d]++;
    }
  }

  // 5. Personality Arrows detection
  const detectedArrows = [];
  const checkLines = [
    { key: "3-6-9", nums: [3, 6, 9] },
    { key: "2-5-8", nums: [2, 5, 8] },
    { key: "1-4-7", nums: [1, 4, 7] },
    { key: "1-2-3", nums: [1, 2, 3] },
    { key: "4-5-6", nums: [4, 5, 6] },
    { key: "7-8-9", nums: [7, 8, 9] },
    { key: "1-5-9", nums: [1, 5, 9] },
    { key: "3-5-7", nums: [3, 5, 7] }
  ];

  for (const line of checkLines) {
    const hasAll = line.nums.every(n => cellCounts[n] > 0);
    const hasNone = line.nums.every(n => cellCounts[n] === 0);
    
    if (hasAll) {
      detectedArrows.push({ key: line.key, type: 'strength', name: ARROWS_INFO[line.key].name, desc: ARROWS_INFO[line.key].strength });
    } else if (hasNone) {
      detectedArrows.push({ key: line.key, type: 'weakness', name: ARROWS_INFO[line.key].name + " (Trống)", desc: ARROWS_INFO[line.key].weakness });
    }
  }

  return {
    fullName,
    birthDate: `${day}/${month}/${year}`,
    lifePath: lifePathVal,
    destiny: destinyVal,
    soul: soulVal,
    personality: personalityVal,
    birthdayNumber: birthdayVal,
    attitude: attitudeVal,
    cellCounts,
    arrows: detectedArrows
  };
}

// ==================== APP CONTROLLER ====================
document.addEventListener('DOMContentLoaded', () => {
  const form             = document.getElementById('tsh-form');
  const daySelect        = document.getElementById('f-day');
  const monthSelect      = document.getElementById('f-month');
  const yearSelect       = document.getElementById('f-year');
  const screenInput      = document.getElementById('screen-input');
  const screenResult     = document.getElementById('screen-result');
  const btnRestart       = document.getElementById('btn-restart');
  const btnNewCalc       = document.getElementById('btn-new-calc');
  const btnHistory       = document.getElementById('btn-history');
  
  // Profile displays
  const dispName         = document.getElementById('display-name');
  const dispDob          = document.getElementById('display-dob');
  const indLifePath      = document.getElementById('ind-lifepath');
  const indDestiny       = document.getElementById('ind-destiny');
  const indSoul          = document.getElementById('ind-soul');
  const indPersonality   = document.getElementById('ind-personality');
  const indBirthday      = document.getElementById('ind-birthday');
  const indAttitude      = document.getElementById('ind-attitude');
  const arrowsList       = document.getElementById('arrows-list');

  // Drawers
  const detailDrawer     = document.getElementById('tsh-drawer');
  const drawerTitle      = document.getElementById('drawer-title');
  const drawerNumVal     = document.getElementById('drawer-number-val');
  const drawerDesc       = document.getElementById('drawer-desc');
  const btnCloseDrawer   = document.getElementById('btn-close-drawer');
  const drawerOverlay    = detailDrawer.querySelector('.tsh-drawer-overlay');

  const historyDrawer    = document.getElementById('history-drawer');
  const historyList      = document.getElementById('history-list');
  const btnCloseHistory  = document.getElementById('btn-close-history');
  const historyOverlay   = historyDrawer.querySelector('.tsh-drawer-overlay');

  // AI Chat DOMs
  const aiSection        = document.getElementById('ai-section');
  const aiQuestionDisplay = document.getElementById('ai-question-display');
  const aiChatMessages   = document.getElementById('ai-chat-messages');
  const aiLoading        = document.getElementById('ai-loading');
  const aiError          = document.getElementById('ai-error');
  const aiChatInput      = document.getElementById('ai-chat-input');
  const btnAskAI         = document.getElementById('btn-ask-ai');

  let currentProfileData = null;
  let chatHistory        = [];
  let questionsAsked     = 0;

  // Initialize Select dropdowns
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    daySelect.appendChild(opt);
  }
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    monthSelect.appendChild(opt);
  }
  const currYear = new Date().getFullYear();
  for (let i = currYear; i >= 1940; i--) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    yearSelect.appendChild(opt);
  }

  // Demo: fill a random sample profile and submit, so users can preview a chart.
  const btnDemo = document.getElementById('btn-demo');
  if (btnDemo) {
    btnDemo.addEventListener('click', (e) => {
      e.preventDefault();
      const lastNames  = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý"];
      const midNames   = ["Thành", "Đức", "Văn", "Mạnh", "Hữu", "Khánh", "Minh", "Quang", "Anh", "Ngọc", "Tuấn", "Thanh", "Như", "Kim", "Quốc"];
      const firstNames = ["Đạt", "Hiển", "Hùng", "Hải", "Sơn", "Nam", "Bình", "Phong", "Huy", "Tùng", "Duy", "Linh", "Trang", "Lan", "Hương", "Vy", "Yến", "Mai", "Cường", "Dũng", "Khang", "Phúc"];
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];

      document.getElementById('f-name').value = `${pick(lastNames)} ${pick(midNames)} ${pick(firstNames)}`;
      daySelect.value   = String(Math.floor(Math.random() * 28) + 1);
      monthSelect.value = String(Math.floor(Math.random() * 12) + 1);
      yearSelect.value  = String(Math.floor(Math.random() * (2005 - 1960 + 1)) + 1960);

      form.requestSubmit();
    });
  }

  // Drawers trigger
  function openDrawer(title, val, content) {
    drawerTitle.textContent = title;
    drawerNumVal.textContent = val;
    drawerDesc.innerHTML = content;
    detailDrawer.classList.add('open');
  }
  function closeDrawer() {
    detailDrawer.classList.remove('open');
  }
  btnCloseDrawer.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  function openHistory() {
    renderHistory();
    historyDrawer.classList.add('open');
  }
  function closeHistory() {
    historyDrawer.classList.remove('open');
  }
  btnHistory.addEventListener('click', openHistory);
  btnCloseHistory.addEventListener('click', closeHistory);
  historyOverlay.addEventListener('click', closeHistory);

  // Form submission & calculation
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    const day = daySelect.value;
    const month = monthSelect.value;
    const year = yearSelect.value;

    if (!name || !day || !month || !year) return;

    const data = calculateNumerology(name, day, month, year);
    currentProfileData = data;

    // Save profile to history
    saveToHistory(data);

    renderResult(data);

    // Show result screen
    screenInput.classList.remove('active');
    screenResult.classList.add('active');
    btnRestart.classList.remove('hidden');

    // Trigger initial AI reading
    startAIReading();
  });

  function renderResult(data) {
    dispName.textContent = data.fullName;
    dispDob.textContent = `Sinh ngày: ${data.birthDate}`;
    
    indLifePath.textContent = data.lifePath;
    indDestiny.textContent = data.destiny;
    indSoul.textContent = data.soul;
    indPersonality.textContent = data.personality;
    indBirthday.textContent = data.birthdayNumber;
    indAttitude.textContent = data.attitude;

    // Render 3x3 birth chart grid
    for (let i = 1; i <= 9; i++) {
      const cell = document.getElementById(`cell-cnt-${i}`);
      const count = data.cellCounts[i];
      if (count > 0) {
        cell.textContent = i.toString().repeat(count);
      } else {
        cell.textContent = '';
      }
    }

    // Render Arrows List
    arrowsList.innerHTML = '';
    if (data.arrows.length === 0) {
      const emptyItem = document.createElement('p');
      emptyItem.style.fontSize = '13px';
      emptyItem.style.color = 'var(--muted)';
      emptyItem.textContent = 'Không phát hiện mũi tên cá tính đặc biệt nào.';
      arrowsList.appendChild(emptyItem);
    } else {
      data.arrows.forEach(arr => {
        const item = document.createElement('div');
        item.className = `arrow-item ${arr.type}`;
        item.innerHTML = `
          <div class="arrow-header">
            <span class="arrow-name">${arr.name}</span>
            <span class="arrow-badge">${arr.type === 'strength' ? 'Thế mạnh' : 'Điểm cần cải thiện'}</span>
          </div>
          <p class="arrow-desc">Bấm để xem chi tiết ảnh hưởng của mũi tên này.</p>
        `;
        item.addEventListener('click', () => {
          openDrawer(arr.name, arr.key, arr.desc);
        });
        arrowsList.appendChild(item);
      });
    }
  }

  // Click indicators to show detail drawer — per-number meaning for every indicator
  document.querySelectorAll('.indicator-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      if (!currentProfileData) return;

      const val = currentProfileData[type];
      const name = INDICATOR_NAMES[type] || type;
      const meanings = NUM_MEANINGS[type] || {};
      const body = meanings[val] ||
        `<p>Số <strong>${val}</strong> — phần luận giải chi tiết cho chỉ số này đang được cập nhật. Hãy hỏi chuyên gia AI bên dưới để được luận giải sâu hơn nhé!</p>`;
      openDrawer(name, val, body);
    });
  });

  // Restart / recalculate
  function restart() {
    form.reset();
    currentProfileData = null;
    chatHistory = [];
    questionsAsked = 0;
    aiChatMessages.innerHTML = '';
    aiChatInput.value = '';
    aiChatInput.disabled = false;
    btnAskAI.disabled = false;

    screenResult.classList.remove('active');
    screenInput.classList.add('active');
    btnRestart.classList.add('hidden');
  }
  btnRestart.addEventListener('click', restart);
  btnNewCalc.addEventListener('click', restart);

  // ==================== LOCAL HISTORY HELPERS ====================
  function saveToHistory(profile) {
    let history = JSON.parse(localStorage.getItem('tsh_history') || '[]');
    // Avoid exact duplicates
    history = history.filter(p => !(p.fullName === profile.fullName && p.birthDate === profile.birthDate));
    history.unshift(profile);
    if (history.length > 8) history = history.slice(0, 8);
    localStorage.setItem('tsh_history', JSON.stringify(history));
  }

  function renderHistory() {
    const history = JSON.parse(localStorage.getItem('tsh_history') || '[]');
    if (history.length === 0) {
      historyList.innerHTML = '<p class="history-empty">Chưa có lịch sử tra cứu nào.</p>';
      return;
    }
    historyList.innerHTML = '';
    history.forEach(p => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-item-left">
          <span class="hist-name">${p.fullName}</span>
          <span class="hist-meta">Sinh ngày: ${p.birthDate}</span>
        </div>
        <div class="hist-lp-badge" title="Số Chủ Đạo: ${p.lifePath}">${p.lifePath}</div>
      `;
      item.addEventListener('click', () => {
        currentProfileData = p;
        chatHistory = [];
        questionsAsked = 0;
        aiChatMessages.innerHTML = '';
        renderResult(p);
        closeHistory();
        screenInput.classList.remove('active');
        screenResult.classList.add('active');
        btnRestart.classList.remove('hidden');
        startAIReading();
      });
      historyList.appendChild(item);
    });
  }

  // ==================== CHAT AI CONTROLLER ====================
  const chat = Chat.createChat({ messagesEl: aiChatMessages, loadingEl: aiLoading, inputEl: aiChatInput, btnEl: btnAskAI });

  function buildThansohocContext() {
    return JSON.stringify({
      fullName: currentProfileData.fullName,
      birthDate: currentProfileData.birthDate,
      lifePath: currentProfileData.lifePath,
      destiny: currentProfileData.destiny,
      soul: currentProfileData.soul,
      personality: currentProfileData.personality,
      attitude: currentProfileData.attitude,
      birthdayNumber: currentProfileData.birthdayNumber,
      arrows: currentProfileData.arrows.map(a => a.name).join(', '),
    });
  }

  function startAIReading() {
    if (!currentProfileData) return;
    chatHistory = [];
    questionsAsked = 0;
    aiChatMessages.innerHTML = '';
    aiChatInput.value = '';
    aiError.classList.add('hidden');
    aiQuestionDisplay.textContent = `Luận giải biểu đồ Thần Số Học: ${currentProfileData.fullName}`;

    chat.sendWithUI({
      question: `Hãy giải mã cuộc đời tôi dựa trên họ tên ${currentProfileData.fullName} và ngày sinh ${currentProfileData.birthDate}`,
      context: buildThansohocContext(),
      type: 'thansohoc',
      history: [],
      onDone(answer) {
        chatHistory.push({ role: 'user', content: 'Hãy giải mã cuộc đời tôi.' });
        chatHistory.push({ role: 'assistant', content: answer });
        aiChatInput.placeholder = "Hỏi thêm chuyên gia Nhân số học...";
      },
    });
  }

  function handleAskFollowUp() {
    const q = aiChatInput.value.trim();
    if (!q || !currentProfileData || questionsAsked >= 5) return;
    questionsAsked++;
    aiChatInput.value = '';
    aiError.classList.add('hidden');

    chat.sendWithUI({
      question: q,
      context: buildThansohocContext(),
      type: 'thansohoc',
      history: chatHistory,
      onDone(answer) {
        chatHistory.push({ role: 'user', content: q });
        chatHistory.push({ role: 'assistant', content: answer });
        if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
        if (questionsAsked >= 5) {
          aiChatInput.placeholder = "Đã đạt giới hạn 5 câu hỏi bổ sung...";
          aiChatInput.disabled = true;
          btnAskAI.disabled = true;
          chat.appendBubble('ai', '💡 *Thông báo:* Bạn đã gửi đủ 5 câu hỏi bổ sung cho bản đồ này. Để hỏi tiếp các câu hỏi mới, vui lòng bấm nút **Tra Cứu Lần Khác** nhé!');
        } else {
          aiChatInput.placeholder = "Hỏi thêm chuyên gia Nhân số học...";
        }
      },
    });
  }

  btnAskAI.addEventListener('click', handleAskFollowUp);
  aiChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAskFollowUp();
    }
  });
});
