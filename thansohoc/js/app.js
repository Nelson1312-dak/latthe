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

// Fully reduce to a single digit 1-9 (no master numbers) — for intermediate steps.
function reduceToSingle(num) {
  while (num > 9) {
    num = num.toString().split('').reduce((sum, d) => sum + parseInt(d), 0);
  }
  return num;
}

function calculateNumerology(fullName, day, month, year) {
  const cleanName = removeVietnameseAccents(fullName).replace(/[^A-Z]/g, '');
  
  // 1. Số Chủ Đạo (Life Path)
  const dobString = `${day}${month}${year}`.replace(/\D/g, '');
  let lpSum = dobString.split('').reduce((sum, d) => sum + parseInt(d), 0);
  const lpRawSum = lpSum; // giữ tổng gốc để soi nợ nghiệp 13/14/16/19
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
  const nameCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

  for (let i = 0; i < cleanName.length; i++) {
    const char = cleanName[i];
    const val = PYTHAGOREAN_MAP[char] || 0;
    destinySum += val;
    if (val) nameCounts[val]++; // biểu đồ tên + đam mê tiềm ẩn + bài học nghiệp
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

  // 6. Số Trưởng Thành (Maturity) = rút gọn(Chủ Đạo + Sứ Mệnh)
  const maturityVal = reduceNumber(
    reduceToSingle(parseInt(lifePathVal)) + reduceToSingle(parseInt(destinyVal)),
    true
  ).toString();

  // 7. Năm Cá Nhân (Personal Year) cho năm hiện tại
  const nowYear = new Date().getFullYear();
  const personalYearVal = reduceToSingle(
    reduceToSingle(parseInt(day)) + reduceToSingle(parseInt(month)) + reduceToSingle(nowYear)
  ).toString();

  // 8. Đỉnh Cuộc Đời (Pinnacles) + mốc tuổi
  const m = reduceToSingle(parseInt(month));
  const d = reduceToSingle(parseInt(day));
  const y = reduceToSingle(parseInt(year));
  const p1 = reduceNumber(m + d, true);
  const p2 = reduceNumber(d + y, true);
  const p3 = reduceNumber(reduceToSingle(p1) + reduceToSingle(p2), true);
  const p4 = reduceNumber(m + y, true);
  const end1 = 36 - reduceToSingle(parseInt(lifePathVal));
  const pinnacles = [
    { num: p1.toString(), age: `0 – ${end1} tuổi` },
    { num: p2.toString(), age: `${end1 + 1} – ${end1 + 9} tuổi` },
    { num: p3.toString(), age: `${end1 + 10} – ${end1 + 18} tuổi` },
    { num: p4.toString(), age: `${end1 + 19} tuổi trở đi` },
  ];

  // 9. Thử Thách (Challenges) — hiệu tuyệt đối, có thể bằng 0
  const c1 = Math.abs(m - d);
  const c2 = Math.abs(d - y);
  const c3 = Math.abs(c1 - c2);
  const c4 = Math.abs(m - y);
  const challenges = [
    { num: c1.toString(), label: "Thử thách đầu đời" },
    { num: c2.toString(), label: "Thử thách trung niên" },
    { num: c3.toString(), label: "Thử thách chủ đạo" },
    { num: c4.toString(), label: "Thử thách cuối đời" },
  ];

  // ==================== TẦNG GIẢI MÃ MỞ RỘNG ====================
  // 10. Biểu đồ tên & biểu đồ tổng hợp
  const combinedCounts = {};
  for (let i = 1; i <= 9; i++) combinedCounts[i] = cellCounts[i] + nameCounts[i];

  // 11. Đam mê tiềm ẩn: số xuất hiện nhiều nhất trong tên
  const maxNameCount = Math.max(...Object.values(nameCounts));
  const hiddenPassions = maxNameCount > 0
    ? Object.keys(nameCounts).filter(k => nameCounts[k] === maxNameCount)
    : [];

  // 12. Bài học nghiệp quả: các số vắng mặt trong tên
  const karmicLessons = Object.keys(nameCounts).filter(k => nameCounts[k] === 0);

  // 13. Số tiềm thức = 9 − số bài học còn thiếu
  const subconsciousVal = (9 - karmicLessons.length).toString();

  // 14. Số cân bằng: tổng chữ cái đầu của mỗi từ trong họ tên
  const nameWords = removeVietnameseAccents(fullName).split(/[^A-Z]+/).filter(Boolean);
  let balanceSum = 0;
  nameWords.forEach(w => { balanceSum += PYTHAGOREAN_MAP[w[0]] || 0; });
  const balanceVal = reduceToSingle(balanceSum).toString();

  // 15. Nợ nghiệp: soi 13/14/16/19 xuất hiện ở bước trung gian các phép tính lõi
  const debtsIn = (num) => {
    const found = [];
    let n = num;
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
      if (n === 13 || n === 14 || n === 16 || n === 19) found.push(n);
      n = n.toString().split('').reduce((s, ch) => s + parseInt(ch), 0);
    }
    return found;
  };
  const karmicDebts = [];
  [[lpRawSum, 'Số Chủ Đạo'], [destinySum, 'Số Sứ Mệnh'], [soulSum, 'Số Linh Hồn'],
   [personalitySum, 'Số Nhân Cách'], [parseInt(day), 'Số Ngày Sinh']].forEach(([n, src]) => {
    debtsIn(n).forEach(dNum => {
      const exist = karmicDebts.find(x => x.num === dNum);
      if (exist) { if (!exist.sources.includes(src)) exist.sources.push(src); }
      else karmicDebts.push({ num: dNum, sources: [src] });
    });
  });

  // 16. Tháng cá nhân hiện tại = năm cá nhân + tháng hiện tại
  const nowMonth = new Date().getMonth() + 1;
  const personalMonthVal = reduceToSingle(parseInt(personalYearVal) + nowMonth).toString();

  // 17. Ba chu kỳ đường đời (gieo trồng – kết trái – thu hoạch), mốc chung với đỉnh 1
  const lifeCycles = [
    { num: reduceNumber(m, true).toString(), label: 'Chu kỳ Gieo Trồng', age: `0 – ${end1} tuổi` },
    { num: reduceNumber(d, true).toString(), label: 'Chu kỳ Kết Trái',  age: `${end1 + 1} – ${end1 + 27} tuổi` },
    { num: reduceNumber(y, true).toString(), label: 'Chu kỳ Thu Hoạch', age: `${end1 + 28} tuổi trở đi` },
  ];

  return {
    fullName,
    birthDate: `${day}/${month}/${year}`,
    lifePath: lifePathVal,
    destiny: destinyVal,
    soul: soulVal,
    personality: personalityVal,
    birthdayNumber: birthdayVal,
    attitude: attitudeVal,
    maturity: maturityVal,
    personalYear: personalYearVal,
    pinnacles,
    challenges,
    cellCounts,
    arrows: detectedArrows,
    // tầng mở rộng
    nameCounts,
    combinedCounts,
    hiddenPassions,
    karmicLessons,
    subconscious: subconsciousVal,
    balance: balanceVal,
    karmicDebts,
    personalMonth: personalMonthVal,
    lifeCycles
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
  const indMaturity      = document.getElementById('ind-maturity');
  const indPersonalYear  = document.getElementById('ind-personalyear');
  const arrowsList       = document.getElementById('arrows-list');
  const pinnaclesList    = document.getElementById('pinnacles-list');
  const challengesList   = document.getElementById('challenges-list');

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
    if (indMaturity)     indMaturity.textContent = data.maturity;
    if (indPersonalYear) indPersonalYear.textContent = data.personalYear;
    renderPinnacles(data.pinnacles || []);
    renderChallenges(data.challenges || []);

    // Tầng mở rộng: tháng cá nhân, đam mê tiềm ẩn, tiềm thức, cân bằng, nghiệp số, chu kỳ
    const indPersonalMonth = document.getElementById('ind-personalmonth');
    if (indPersonalMonth) indPersonalMonth.textContent = data.personalMonth || '-';
    const indHP  = document.getElementById('ind-hiddenpassion');
    if (indHP)  indHP.textContent  = (data.hiddenPassions && data.hiddenPassions.length) ? data.hiddenPassions.join(' & ') : '-';
    const indSub = document.getElementById('ind-subconscious');
    if (indSub) indSub.textContent = data.subconscious || '-';
    const indBal = document.getElementById('ind-balance');
    if (indBal) indBal.textContent = data.balance || '-';
    renderKarmic(data);
    renderCycles(data.lifeCycles || []);

    // Render ma trận 3x3 theo tab đang chọn (mặc định: ngày sinh)
    setChartTab('birth');

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

    // Draw the detected arrows as lines over the 3x3 grid
    drawArrowsOnChart(data.arrows);

    // Nghi thức reveal: section trồi dần + các chỉ số đếm lên
    playRevealFX();
  }

  // Connect the cells of each detected arrow with an SVG line over the chart.
  // Strength arrows = solid indigo, weakness (empty) = dashed rose.
  function drawArrowsOnChart(arrows) {
    const svg = document.getElementById('chart-arrows-svg');
    const grid = svg && svg.parentElement;
    if (!svg || !grid) return;
    requestAnimationFrame(() => {
      svg.innerHTML = '';
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect.width) return;
      const center = (num) => {
        const cell = grid.querySelector(`.grid-cell[data-num="${num}"]`);
        const r = cell.getBoundingClientRect();
        return { x: r.left + r.width / 2 - svgRect.left, y: r.top + r.height / 2 - svgRect.top };
      };
      arrows.forEach((arr, i) => {
        const nums = arr.key.split('-').map(Number);
        const a = center(nums[0]);
        const b = center(nums[nums.length - 1]);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('class', arr.type === 'strength' ? 'arrow-strong' : 'arrow-weak');
        // mũi tên thế mạnh: vẽ nét chạy bằng stroke-dash (pathLength chuẩn hóa = 1);
        // mũi tên trống giữ nét đứt nên chỉ fade như cũ
        if (arr.type === 'strength') line.setAttribute('pathLength', '1');
        line.style.animationDelay = (0.5 + i * 0.18) + 's';
        svg.appendChild(line);
      });
    });
  }

  // Redraw arrow lines if the viewport size changes (orientation, etc.)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!currentProfileData || !screenResult.classList.contains('active')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawArrowsOnChart(currentProfileData.arrows), 150);
  });

  // ==================== BA LỚP BIỂU ĐỒ: NGÀY SINH / TÊN / TỔNG HỢP ====================
  function renderChartCounts(counts) {
    for (let i = 1; i <= 9; i++) {
      const cell = document.getElementById(`cell-cnt-${i}`);
      const count = (counts && counts[i]) || 0;
      const digits = i.toString().repeat(count);
      // mỗi chữ số là 1 span để nảy vào lần lượt
      cell.innerHTML = digits.split('').map((ch, k) =>
        `<span class="cd" style="--ci:${k}">${ch}</span>`).join('');
    }
  }

  function setChartTab(tab) {
    if (!currentProfileData) return;
    document.querySelectorAll('.chart-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    const note = document.getElementById('chart-tab-note');
    if (note && typeof CHART_TAB_NOTES !== 'undefined') {
      note.innerHTML = CHART_TAB_NOTES[tab] || '';
    }
    const counts = tab === 'name'     ? currentProfileData.nameCounts
                 : tab === 'combined' ? currentProfileData.combinedCounts
                 :                      currentProfileData.cellCounts;
    renderChartCounts(counts);
    // Mũi tên cá tính chỉ có ý nghĩa trên biểu đồ ngày sinh
    const svg = document.getElementById('chart-arrows-svg');
    if (svg) svg.style.display = tab === 'birth' ? '' : 'none';
  }

  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => setChartTab(btn.dataset.tab));
  });

  // ==================== GIẢI MÃ TÊN & NGHIỆP SỐ ====================
  function renderKarmic(data) {
    const lessonsEl = document.getElementById('karmic-lessons-list');
    if (lessonsEl) {
      lessonsEl.innerHTML = '';
      const lessons = data.karmicLessons || [];
      if (!lessons.length) {
        lessonsEl.innerHTML = '<p class="karmic-none"><i class="ti ti-confetti"></i> Tên bạn có đủ cả 9 con số — trường hợp rất hiếm gặp, không thiếu bài học nào!</p>';
      } else {
        lessons.forEach(n => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'karmic-chip';
          chip.innerHTML = `<span class="kc-num">${n}</span> Bài học số ${n}`;
          chip.addEventListener('click', () => {
            const body = (typeof KARMIC_LESSON_MEANINGS !== 'undefined' && KARMIC_LESSON_MEANINGS[n]) ||
              `<p>Bài học số <strong>${n}</strong> — đang cập nhật.</p>`;
            openDrawer(`Bài Học Nghiệp Quả — thiếu số ${n}`, n, body);
          });
          lessonsEl.appendChild(chip);
        });
      }
    }

    const debtsEl = document.getElementById('karmic-debts-list');
    if (debtsEl) {
      debtsEl.innerHTML = '';
      const debts = data.karmicDebts || [];
      if (!debts.length) {
        debtsEl.innerHTML = '<p class="karmic-none"><i class="ti ti-shield-check"></i> Không phát hiện nợ nghiệp 13 · 14 · 16 · 19 nào trong các chỉ số cốt lõi của bạn.</p>';
      } else {
        debts.forEach(dt => {
          const reduced = dt.num % 9 === 0 ? 9 : dt.num % 9;
          const item = document.createElement('div');
          item.className = 'layer-item karmic-debt-item';
          item.innerHTML =
            `<span class="layer-num debt-num">${dt.num}</span>` +
            `<div class="layer-info"><span class="layer-item-title">Nợ nghiệp ${dt.num}/${reduced}</span>` +
            `<span class="layer-item-meta">Xuất hiện ở: ${dt.sources.join(', ')}</span></div>` +
            `<i class="ti ti-chevron-right layer-arrow"></i>`;
          item.addEventListener('click', () => {
            const body = (typeof KARMIC_DEBT_MEANINGS !== 'undefined' && KARMIC_DEBT_MEANINGS[dt.num]) ||
              `<p>Nợ nghiệp <strong>${dt.num}</strong> — đang cập nhật.</p>`;
            openDrawer(`Nợ Nghiệp ${dt.num}`, dt.num, body);
          });
          debtsEl.appendChild(item);
        });
      }
    }
  }

  // 3 thẻ chỉ số nghiệp số mở drawer riêng
  document.querySelectorAll('.karmic-card').forEach(card => {
    card.addEventListener('click', () => {
      if (!currentProfileData) return;
      const kind = card.dataset.karmic;
      if (kind === 'hiddenPassion') {
        const hp = currentProfileData.hiddenPassions || [];
        const body = hp.length
          ? hp.map(n => (typeof HIDDEN_PASSION_MEANINGS !== 'undefined' && HIDDEN_PASSION_MEANINGS[n]) || '')
              .join('<hr style="border:none;border-top:1px dashed rgba(99,102,241,.3);margin:14px 0;">')
          : '<p>Chưa xác định được đam mê tiềm ẩn từ tên này.</p>';
        openDrawer('Đam Mê Tiềm Ẩn', hp.join(' & ') || '-', body);
      } else if (kind === 'subconscious') {
        const v = currentProfileData.subconscious;
        if (v === undefined) return;
        const body = (typeof SUBCONSCIOUS_MEANINGS !== 'undefined' && SUBCONSCIOUS_MEANINGS[v]) ||
          `<p>Số tiềm thức <strong>${v}</strong>: bạn còn ${9 - parseInt(v)} bài học nghiệp cần bổ sung — càng lấp đủ các con số thiếu, phản xạ trước biến cố của bạn càng vững vàng.</p>`;
        openDrawer('Số Tiềm Thức', v, body);
      } else if (kind === 'balance') {
        const v = currentProfileData.balance;
        if (v === undefined) return;
        const body = (typeof BALANCE_MEANINGS !== 'undefined' && BALANCE_MEANINGS[v]) ||
          `<p>Số cân bằng <strong>${v}</strong> — đang cập nhật.</p>`;
        openDrawer('Số Cân Bằng', v, body);
      }
    });
  });

  // ==================== 3 CHU KỲ ĐƯỜNG ĐỜI ====================
  function renderCycles(cycles) {
    const el = document.getElementById('cycles-list');
    if (!el) return;
    el.innerHTML = '';
    cycles.forEach(c => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.innerHTML =
        `<span class="layer-num">${c.num}</span>` +
        `<div class="layer-info"><span class="layer-item-title">${c.label}</span>` +
        `<span class="layer-item-meta">${c.age}</span></div>` +
        `<i class="ti ti-chevron-right layer-arrow"></i>`;
      item.addEventListener('click', () => {
        const body = (typeof LIFE_CYCLE_MEANINGS !== 'undefined' && LIFE_CYCLE_MEANINGS[c.num]) ||
          `<p>Chu kỳ số <strong>${c.num}</strong> — đang cập nhật.</p>`;
        openDrawer(`${c.label} · ${c.age}`, c.num, body);
      });
      el.appendChild(item);
    });
  }

  // ==================== REVEAL FX: SỐ ĐẾM LÊN + SECTION TRỒI DẦN ====================
  function playRevealFX() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    screenResult.classList.remove('tsh-reveal');
    void screenResult.offsetWidth;
    screenResult.classList.add('tsh-reveal');

    document.querySelectorAll('#screen-result .ind-val').forEach((el, i) => {
      const finalText = el.textContent;
      const target = parseInt(finalText);
      if (isNaN(target) || target <= 0) return;
      const dur = 800;
      const startAt = performance.now() + i * 90;
      function tick(now) {
        const t = Math.min(1, Math.max(0, (now - startAt) / dur));
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = t >= 1 ? finalText : Math.max(1, Math.round(target * eased)).toString();
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ---- Deeper layers: Pinnacles & Challenges ----
  function renderPinnacles(pins) {
    if (!pinnaclesList) return;
    pinnaclesList.innerHTML = '';
    pins.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.innerHTML =
        `<span class="layer-num">${p.num}</span>` +
        `<div class="layer-info"><span class="layer-item-title">Đỉnh ${idx + 1}</span>` +
        `<span class="layer-item-meta">${p.age}</span></div>` +
        `<i class="ti ti-chevron-right layer-arrow"></i>`;
      item.addEventListener('click', () => {
        const body = PINNACLE_MEANINGS[p.num] ||
          `<p>Đỉnh số <strong>${p.num}</strong> — đang cập nhật. Hãy hỏi chuyên gia AI để được luận giải sâu hơn.</p>`;
        openDrawer(`Đỉnh ${idx + 1} Cuộc Đời · ${p.age}`, p.num, body);
      });
      pinnaclesList.appendChild(item);
    });
  }

  function renderChallenges(chs) {
    if (!challengesList) return;
    challengesList.innerHTML = '';
    chs.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.innerHTML =
        `<span class="layer-num">${c.num}</span>` +
        `<div class="layer-info"><span class="layer-item-title">${c.label}</span>` +
        `<span class="layer-item-meta">Bấm để xem bài học cần vượt qua</span></div>` +
        `<i class="ti ti-chevron-right layer-arrow"></i>`;
      item.addEventListener('click', () => {
        const body = CHALLENGE_MEANINGS[c.num] ||
          `<p>Thử thách số <strong>${c.num}</strong> — đang cập nhật.</p>`;
        openDrawer(`${c.label} (Số ${c.num})`, c.num, body);
      });
      challengesList.appendChild(item);
    });
  }

  // Maturity / Personal Year / Personal Month cards open their own detail drawer
  document.querySelectorAll('.layer-card').forEach(card => {
    card.addEventListener('click', () => {
      if (!currentProfileData) return;
      const layer = card.dataset.layer; // 'maturity' | 'personalYear' | 'personalMonth'
      const val = currentProfileData[layer];
      if (val === undefined) return; // hồ sơ cũ trong lịch sử chưa có chỉ số mới
      const MEANINGS_BY_LAYER = {
        maturity: MATURITY_MEANINGS,
        personalYear: PERSONAL_YEAR_MEANINGS,
        personalMonth: (typeof PERSONAL_MONTH_MEANINGS !== 'undefined' ? PERSONAL_MONTH_MEANINGS : {})
      };
      const TITLES = { maturity: 'Số Trưởng Thành', personalYear: 'Năm Cá Nhân', personalMonth: 'Tháng Cá Nhân Hiện Tại' };
      const meanings = MEANINGS_BY_LAYER[layer] || {};
      const name = TITLES[layer] || (typeof LAYER_NAMES !== 'undefined' && LAYER_NAMES[layer]) || layer;
      const body = meanings[val] ||
        `<p>Số <strong>${val}</strong> — đang cập nhật luận giải.</p>`;
      openDrawer(name, val, body);
    });
  });

  // Click indicators to show detail drawer — per-number meaning for every indicator
  document.querySelectorAll('.indicator-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      if (!type || !currentProfileData) return; // layer cards (no data-type) handled separately

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
    if (chipsEl) chipsEl.innerHTML = '';

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
      maturity: currentProfileData.maturity,
      personalYear: currentProfileData.personalYear,
      pinnacles: (currentProfileData.pinnacles || []).map((p, i) => `Đỉnh ${i + 1} (${p.age}): ${p.num}`).join('; '),
      challenges: (currentProfileData.challenges || []).map(c => `${c.label}: ${c.num}`).join('; '),
      arrows: currentProfileData.arrows.map(a => a.name).join(', '),
      // tầng mở rộng
      personalMonth: currentProfileData.personalMonth || '',
      hiddenPassions: (currentProfileData.hiddenPassions || []).join(' & '),
      subconscious: currentProfileData.subconscious || '',
      balance: currentProfileData.balance || '',
      karmicLessons: (currentProfileData.karmicLessons || []).join(', ') || 'Không thiếu số nào',
      karmicDebts: (currentProfileData.karmicDebts || []).map(dt => `${dt.num} (từ ${dt.sources.join('/')})`).join('; ') || 'Không có',
      lifeCycles: (currentProfileData.lifeCycles || []).map(c => `${c.label} (${c.age}): ${c.num}`).join('; '),
    });
  }

  // ---- Chips hỏi nhanh theo hồ sơ ----
  const chipsEl = document.getElementById('tsh-chips');

  function buildChips() {
    if (!chipsEl || !currentProfileData) return;
    chipsEl.innerHTML = '';
    const d = currentProfileData;
    const defs = [
      { icon: 'ti-briefcase', label: 'Nghề nghiệp phù hợp',
        q: `Với số chủ đạo ${d.lifePath} và số sứ mệnh ${d.destiny}, tôi phù hợp với những nghề nghiệp và môi trường làm việc nào?` },
      { icon: 'ti-heart', label: 'Tình duyên của tôi',
        q: 'Các chỉ số thần số học của tôi nói gì về tình duyên và kiểu người phù hợp với tôi?' },
      { icon: 'ti-calendar', label: `Năm cá nhân ${d.personalYear} nên làm gì?`,
        q: `Năm cá nhân số ${d.personalYear} này tôi nên tập trung làm gì và tránh điều gì?` },
    ];
    (d.karmicDebts || []).forEach(dt => defs.push({
      karmic: true, icon: 'ti-scale', label: `Hóa giải nợ nghiệp ${dt.num}`,
      q: `Nợ nghiệp ${dt.num} trong biểu đồ của tôi ảnh hưởng thế nào đến cuộc sống và làm sao để hóa giải?`
    }));
    (d.arrows || []).filter(a => a.type === 'weakness').slice(0, 2).forEach(a => defs.push({
      karmic: true, icon: 'ti-vector', label: a.name,
      q: `${a.name} trong biểu đồ ngày sinh của tôi cần khắc phục như thế nào trong thực tế?`
    }));
    defs.forEach(def => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tsh-chip' + (def.karmic ? ' tsh-chip-karmic' : '');
      b.innerHTML = `<i class="ti ${def.icon}"></i> ${def.label}`;
      b.addEventListener('click', () => askQuestion(def.q));
      chipsEl.appendChild(b);
    });
  }

  function startAIReading() {
    if (!currentProfileData) return;
    chatHistory = [];
    questionsAsked = 0;
    aiChatMessages.innerHTML = '';
    aiChatInput.value = '';
    aiError.classList.add('hidden');
    buildChips();
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
    askQuestion(aiChatInput.value.trim());
  }

  function askQuestion(q) {
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
