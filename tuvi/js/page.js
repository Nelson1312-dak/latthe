    import { getTuViChart } from './tuvi.js';

    // ==================== CONSTANTS ====================
    const CUNG_KEYS = ["Ty","Suu","Dan","Mao","Thin","Ty2","Ngo","Mui","Than","Dau","Tuat","Hoi"];
    const CUNG_CHI  = ["Tý","Sửu","Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi"];
    const CHI_ELEMENTS = ["thuy", "tho", "moc", "moc", "tho", "hoa", "hoa", "tho", "kim", "kim", "tho", "thuy"];

    const GOOD_STARS = new Set(["Lộc Tồn", "Thiên Khôi", "Thiên Việt", "Tả Phù", "Hữu Bật", "Văn Xương", "Văn Khúc", "Thiên Mã", "Đào Hoa", "Hồng Loan", "Thiên Hỷ", "Ân Quang", "Thiên Quý", "Tam Thai", "Bát Tọa", "Thiên Quan", "Thiên Phúc", "Quốc Ấn", "Đường Phù", "Bác Sĩ", "Thanh Long", "Tướng Quân", "Tấu Thư", "Hỷ Thần", "Hoa Cái", "Long Trì", "Phượng Các", "Giải Thần", "Thiếu Dương", "Thiếu Âm", "Long Đức", "Phúc Đức", "Thiên Đức", "Nguyệt Đức", "Hóa Lộc", "Hóa Quyền", "Hóa Khoa"]);
    const BAD_STARS = new Set(["Kình Dương", "Đà La", "Địa Không", "Địa Kiếp", "Thiên Khốc", "Thiên Hư", "Hóa Kỵ", "Cô Thần", "Quả Tú", "Đại Hao", "Tiểu Hao", "Tang Môn", "Tuế Phá", "Bạch Hổ", "Điếu Khách", "Trực Phù", "Bệnh Phù", "Phi Liêm", "Phục Binh", "Quan Phù", "Thiên Không", "Kiếp Sát", "Lưu Hà", "Thiên Riêu", "Thiên Hình", "Thiên Y", "Thiên Sứ", "Thiên Sử", "Phá Toái", "Thái Tuế", "Tử Phù", "Thiên La", "Địa Võng"]);

    const ALL_STARS_ELEMENTS = {
      "Tử Vi": "tho", "Liêm Trinh": "hoa", "Thiên Đồng": "thuy", "Vũ Khúc": "kim", "Thái Dương": "hoa",
      "Thiên Cơ": "moc", "Thiên Phủ": "tho", "Thái Âm": "thuy", "Tham Lang": "moc", "Cự Môn": "thuy",
      "Thiên Tướng": "thuy", "Thiên Lương": "moc", "Thất Sát": "kim", "Phá Quân": "thuy",
      "Hóa Lộc": "moc", "Hóa Quyền": "moc", "Hóa Khoa": "moc", "Hóa Kỵ": "thuy",
      "Lộc Tồn": "tho", "Kình Dương": "kim", "Đà La": "kim", "Thiên Khôi": "hoa", "Thiên Việt": "hoa",
      "Tả Phù": "tho", "Hữu Bật": "thuy", "Văn Xương": "kim", "Văn Khúc": "thuy", "Thiên Mã": "hoa",
      "Đào Hoa": "moc", "Hồng Loan": "thuy", "Thiên Hỷ": "thuy", "Ân Quang": "moc", "Thiên Quý": "tho",
      "Tam Thai": "thuy", "Bát Tọa": "moc", "Thiên Quan": "hoa", "Thiên Phúc": "tho", "Quốc Ấn": "tho",
      "Đường Phù": "moc", "Bác Sĩ": "thuy", "Thanh Long": "thuy", "Tướng Quân": "moc", "Tấu Thư": "kim",
      "Hỷ Thần": "hoa", "Hoa Cái": "kim", "Long Trì": "thuy", "Phượng Các": "tho", "Giải Thần": "moc",
      "Thiếu Dương": "hoa", "Thiếu Âm": "thuy", "Long Đức": "thuy", "Phúc Đức": "tho", "Thiên Đức": "hoa",
      "Nguyệt Đức": "hoa", "Thiên Khốc": "kim", "Thiên Hư": "kim", "Địa Không": "hoa", "Địa Kiếp": "hoa",
      "Cô Thần": "tho", "Quả Tú": "tho", "Đại Hao": "hoa", "Tiểu Hao": "hoa", "Tang Môn": "moc",
      "Tuế Phá": "hoa", "Bạch Hổ": "kim", "Điếu Khách": "hoa", "Trực Phù": "hoa", "Bệnh Phù": "tho",
      "Phi Liêm": "hoa", "Phục Binh": "hoa", "Quan Phù": "hoa", "Thiên Không": "hoa", "Kiếp Sát": "hoa",
      "Lưu Hà": "thuy", "Thiên Riêu": "thuy", "Thiên Hình": "hoa", "Thiên Y": "thuy", "Thiên Sứ": "thuy",
      "Thiên Sử": "thuy", "Phá Toái": "hoa", "Thái Tuế": "hoa", "Tử Phù": "hoa",
      "Thiên La": "tho", "Địa Võng": "tho"
    };

    const STAR_ELEMENTS = {
      "Tử Vi": "tho", "Liêm Trinh": "hoa", "Thiên Đồng": "thuy", "Vũ Khúc": "kim", "Thái Dương": "hoa",
      "Thiên Cơ": "moc", "Thiên Phủ": "tho", "Thái Âm": "thuy", "Tham Lang": "moc", "Cự Môn": "thuy",
      "Thiên Tướng": "thuy", "Thiên Lương": "moc", "Thất Sát": "kim", "Phá Quân": "thuy"
    };

    const RATING_FULL = { 'M': 'Miếu', 'V': 'Vượng', 'Đ': 'Đắc', 'B': 'Bình hòa', 'H': 'Hãm' };

    const STAR_RATINGS = {
      "Tử Vi":      ["B", "M", "M", "V", "M", "V", "M", "M", "M", "V", "M", "V"],
      "Liêm Trinh": ["V", "Đ", "M", "H", "M", "H", "M", "Đ", "M", "H", "M", "H"],
      "Thiên Đồng": ["V", "H", "M", "M", "H", "M", "H", "H", "Đ", "H", "H", "M"],
      "Vũ Khúc":    ["V", "M", "M", "H", "M", "H", "M", "M", "M", "V", "M", "H"],
      "Thái Dương": ["H", "H", "V", "M", "V", "V", "M", "Đ", "H", "H", "H", "H"],
      "Thiên Cơ":   ["M", "H", "M", "M", "V", "Đ", "M", "H", "M", "M", "V", "Đ"],
      "Thiên Phủ":  ["M", "M", "M", "Đ", "M", "Đ", "M", "M", "M", "V", "M", "V"],
      "Thái Âm":    ["M", "M", "H", "H", "H", "H", "H", "H", "H", "M", "M", "M"],
      "Tham Lang":  ["V", "M", "H", "H", "M", "H", "V", "M", "H", "H", "M", "H"],
      "Cự Môn":     ["V", "H", "V", "M", "H", "H", "V", "H", "M", "M", "H", "H"],
      "Thiên Tướng":["V", "M", "M", "H", "M", "Đ", "M", "M", "M", "V", "M", "H"],
      "Thiên Lương":["M", "V", "M", "M", "M", "H", "M", "V", "M", "H", "M", "H"],
      "Thất Sát":   ["V", "M", "M", "H", "M", "H", "M", "M", "M", "H", "M", "H"],
      "Phá Quân":   ["M", "V", "H", "H", "M", "H", "M", "V", "H", "H", "M", "H"]
    };

    const AUX_RATINGS = {
      "Kình Dương": { 1: "Đ", 4: "Đ", 7: "Đ", 10: "Đ" },
      "Đà La": { 1: "Đ", 4: "Đ", 7: "Đ", 10: "Đ" },
      "Địa Không": { 0: "Đ", 6: "Đ", 5: "Đ", 11: "Đ" },
      "Địa Kiếp": { 0: "Đ", 6: "Đ", 5: "Đ", 11: "Đ" },
      "Thiên Khốc": { 2: "Đ", 8: "Đ", 9: "Đ", 3: "Đ" },
      "Thiên Hư": { 2: "Đ", 8: "Đ", 9: "Đ", 3: "Đ" },
      "Thiên Hình": { 2: "Đ", 8: "Đ", 9: "Đ", 10: "Đ" },
      "Thiên Riêu": { 2: "Đ", 8: "Đ", 9: "Đ", 4: "Đ" },
      "Đại Hao": { 2: "Đ", 8: "Đ", 3: "Đ", 9: "Đ" },
      "Tiểu Hao": { 2: "Đ", 8: "Đ", 3: "Đ", 9: "Đ" },
      "Tang Môn": { 2: "Đ", 8: "Đ", 3: "Đ", 9: "Đ" },
      "Bạch Hổ": { 2: "Đ", 8: "Đ", 3: "Đ", 9: "Đ" }
    };

    const AUX_HAM = {
      "Hóa Kỵ": [0, 3, 6, 9]
    };

    // Can heavenly stems
    const CAN_NAMES = ['Giáp','Ất','Bính','Đinh','Mậu','Kỷ','Canh','Tân','Nhâm','Quý'];

    // Mệnh chủ lookup by giờ sinh chi index (0=Tý…11=Hợi)
    const MENH_CHU = [
      'Tham Lang','Cự Môn','Thiên Tướng','Thiên Lương','Thiên Đồng','Văn Xương',
      'Tham Lang','Cự Môn','Thiên Tướng','Thiên Lương','Thiên Đồng','Văn Khúc'
    ];

    // Thân chủ lookup by Thân palace chi index (0=Tý…11=Hợi)
    const THAN_CHU = [
      'Thiên Tướng','Thiên Lương','Thiên Đồng','Văn Xương','Tham Lang','Cự Môn',
      'Thiên Tướng','Thiên Lương','Thiên Đồng','Văn Khúc',  'Tham Lang','Cự Môn'
    ];

    // Convert hour value → giờ chi index (0=Tý)
    function hourToChiIdx(h) {
      if (h === 23) return 0;
      return Math.floor((h + 1) / 2) % 12;
    }

    // Get Can abbreviation for a palace at chiIdx, given year Can
    function getPalaceCanAbbr(chiIdx, yearCanIdx) {
      // Ngũ Hổ Độn: Can of Dần palace
      const danCan = ((yearCanIdx % 5) * 2 + 2) % 10;
      const palaceCan = (danCan + ((chiIdx - 2 + 12) % 12)) % 10;
      return CAN_NAMES[palaceCan];
    }

    function getCanChiYear(lunarYear) {
      const cans = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
      const chis = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];
      let canIdx = (lunarYear - 4) % 10;
      if (canIdx < 0) canIdx += 10;
      let chiIdx = (lunarYear - 4) % 12;
      if (chiIdx < 0) chiIdx += 12;
      return { canIdx, chiIdx, text: `${cans[canIdx]} ${chis[chiIdx]}` };
    }

    function getAuxStarHTML(s, idx) {
      const el = ALL_STARS_ELEMENTS[s] || "neutral";
      let rating = "";
      if (AUX_RATINGS[s]) {
        const abbr = AUX_RATINGS[s][idx] || 'H';
        rating = ` (${RATING_FULL[abbr] || abbr})`;
      } else if (AUX_HAM[s] && AUX_HAM[s].includes(idx)) {
        rating = " (Hãm)";
      }
      return `<span class="star-item color-${el}">${s}${rating}</span>`;
    }

    // ==================== POPULATE DROPDOWNS ====================
    (function fill() {
      const dayEl   = document.getElementById('f-day');
      const monEl   = document.getElementById('f-month');
      const yrEl    = document.getElementById('f-year');
      const nxEl    = document.getElementById('f-namxem');
      const curYr   = new Date().getFullYear();

      for (let d = 1; d <= 31; d++)
        dayEl.innerHTML += `<option value="${d}">${d}</option>`;

      for (let m = 1; m <= 12; m++)
        monEl.innerHTML += `<option value="${m}">${m}</option>`;

      for (let y = curYr - 10; y >= 1920; y--)
        yrEl.innerHTML += `<option value="${y}">${y}</option>`;

      for (let y = curYr - 1; y <= curYr + 6; y++) {
        const sel = y === curYr ? ' selected' : '';
        nxEl.innerHTML += `<option value="${y}"${sel}>Năm xem ${y}</option>`;
      }
    })();

    // ==================== DEMO DATA ====================
    document.getElementById('btn-demo').addEventListener('click', e => {
      e.preventDefault();

      const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
      const midNames  = ["Thành", "Đức", "Văn", "Mạnh", "Hữu", "Khánh", "Minh", "Quang", "Anh", "Ngọc", "Tuấn", "Thanh", "Như", "Kim", "Quốc", "Tấn"];
      const firstNames = ["Đạt", "Hiển", "Hùng", "Hải", "Sơn", "Nam", "Bình", "Phong", "Huy", "Tùng", "Duy", "Linh", "Trang", "Lan", "Hương", "Vy", "Yến", "Mai", "Cường", "Dũng", "Hoàng", "Tuấn", "Trung", "Khang", "Phúc"];

      const randItem = arr => arr[Math.floor(Math.random() * arr.length)];

      const randomName = `${randItem(lastNames)} ${randItem(midNames)} ${randItem(firstNames)}`;
      const randomDay = Math.floor(Math.random() * 28) + 1; // Avoid day-of-month validation issues
      const randomMonth = Math.floor(Math.random() * 12) + 1;
      const randomYear = Math.floor(Math.random() * (2005 - 1960 + 1)) + 1960;
      
      const hoursList = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
      const randomHour = randItem(hoursList);
      const randomGender = Math.random() > 0.5 ? "1" : "0";
      const randomCal = Math.random() > 0.2 ? "solar" : "lunar";

      document.getElementById('f-name').value  = randomName;
      document.getElementById('f-day').value   = String(randomDay);
      document.getElementById('f-month').value = String(randomMonth);
      document.getElementById('f-year').value  = String(randomYear);
      document.getElementById('f-cal').value   = randomCal;
      document.getElementById('f-hour').value  = String(randomHour);
      document.getElementById('f-gender').value= randomGender;

      demoFill = true;
      document.getElementById('tuvi-form').requestSubmit();
    });

    // ==================== HỒ SƠ HUYỀN HỌC (dùng chung toàn site) ====================
    (function prefillFromProfile() {
      if (!window.LatbaiProfile) return;
      const p = window.LatbaiProfile.get();
      if (!p) return;
      const nameEl = document.getElementById('f-name');
      if (nameEl && !nameEl.value) nameEl.value = p.name;
      if (p.day)   document.getElementById('f-day').value   = String(p.day);
      if (p.month) document.getElementById('f-month').value = String(p.month);
      if (p.year)  document.getElementById('f-year').value  = String(p.year);
      if (p.hour !== undefined && p.hour !== null)     document.getElementById('f-hour').value   = String(p.hour);
      if (p.gender !== undefined && p.gender !== null) document.getElementById('f-gender').value = String(p.gender);
      if (p.cal) document.getElementById('f-cal').value = p.cal;
    })();

    // ==================== STATE ====================
    let currentChart     = null;
    let currentBirthYear = null;
    let currentNamXem    = null;
    let chatHistory      = [];
    let questionsAsked   = 0;
    let demoFill         = false; // đang submit dữ liệu demo → không ghi đè hồ sơ

    const form        = document.getElementById('tuvi-form');
    const chartWrapper= document.getElementById('chart-wrapper');
    const aiPanel     = document.getElementById('ai-panel');
    const chatLog     = document.getElementById('ai-chat-log');
    const askBtn      = document.getElementById('btn-ask-ai');
    const qInput      = document.getElementById('ai-question');

    const chat = Chat.createChat({
      messagesEl: chatLog,
      loadingEl: null,
      inputEl: qInput,
      btnEl: askBtn
    });

    // ==================== FORM SUBMIT ====================
    form.addEventListener('submit', e => {
      e.preventDefault();

      const name   = document.getElementById('f-name').value.trim();
      const day    = parseInt(document.getElementById('f-day').value);
      const month  = parseInt(document.getElementById('f-month').value);
      const year   = parseInt(document.getElementById('f-year').value);
      const cal    = document.getElementById('f-cal').value;
      const hour   = parseInt(document.getElementById('f-hour').value);
      const gender = parseInt(document.getElementById('f-gender').value);
      const namXem = parseInt(document.getElementById('f-namxem').value);

      if (!day || !month || !year || isNaN(hour)) {
        alert('Vui lòng điền đầy đủ thông tin ngày tháng năm sinh và giờ sinh.');
        return;
      }

      const chart = getTuViChart({
        namSinh: year, thangSinh: month, ngaySinh: day,
        gioSinh: hour, gioiTinh: gender,
        namXem, inputCalendar: cal
      });
      currentChart     = chart;
      currentBirthYear = year;
      currentNamXem    = namXem;

      // Lưu hồ sơ dùng chung (bỏ qua khi là dữ liệu demo ngẫu nhiên)
      if (!demoFill && window.LatbaiProfile) {
        window.LatbaiProfile.save({ name, day, month, year, hour, gender, cal });
      }
      demoFill = false;

      // Reset chat state
      chatHistory = []; questionsAsked = 0;
      qInput.disabled = false; askBtn.disabled = false;
      qInput.placeholder = 'Nhập câu hỏi của bạn về lá số...';
      askBtn.textContent = 'THAM VẤN AI';
      document.querySelectorAll('.prompt-chip').forEach(b => b.disabled = false);
      chatLog.innerHTML = '';
      chat.appendBubble('ai', `Lá số Tử Vi của **${name}** đã được lập thành công. Hãy chọn chủ đề bên dưới hoặc nhập câu hỏi để bắt đầu luận giải.`);

      // Update chart title
      document.getElementById('chart-title').textContent = `Lá số Tử Vi · ${name}`;

      // Update center panel
      const al = chart.thong_tin_goc.am_lich;
      document.getElementById('disp-name').textContent     = name;
      document.getElementById('disp-class').textContent    = chart.thong_tin_goc.phan_loai;
      document.getElementById('disp-solar').textContent    = `${day}/${month}/${year}`;
      document.getElementById('disp-ly-year').textContent  = al.nam;
      document.getElementById('disp-ly-month').textContent = `(${al.thang_so}) ${al.thang}`;
      document.getElementById('disp-ly-day').textContent   = `(${al.ngay_so}) ${al.ngay}`;
      
      const hrSelect = document.getElementById('f-hour');
      const hrText = hrSelect.options[hrSelect.selectedIndex].text.split(' · ')[0];
      document.getElementById('disp-ly-hour').textContent  = `${hrText} (${al.gio})`;
      
      document.getElementById('disp-namxem').textContent   = `${namXem} (${getCanChiYear(namXem).text})`;
      document.getElementById('disp-phanloai').textContent = `${chart.thong_tin_goc.phan_loai} (${chart.thong_tin_goc.am_duong_text})`;
      document.getElementById('disp-menh-napam').textContent = chart.thong_tin_goc.menh_nap_am;
      document.getElementById('disp-cuc').textContent      = `${chart.thong_tin_goc.cuc} (${chart.thong_tin_goc.menh_cuc_relation})`;

      // Mệnh chủ / Thân chủ
      const gioChiIdx  = hourToChiIdx(hour);
      const thanChiIdx = (chart.thong_tin_goc.than_pos - 1 + 12) % 12;
      document.getElementById('disp-menhchu').textContent = MENH_CHU[gioChiIdx]  || '—';
      document.getElementById('disp-thanchu').textContent = THAN_CHU[thanChiIdx] || '—';

      // Year Can for palace headers
      const yearCanStr = chart.thong_tin_goc.am_lich.nam.split(' ')[0];
      const yearCanIdx = CAN_NAMES.indexOf(yearCanStr);

      // Render palace cards
      CUNG_KEYS.forEach((key, idx) => {
        const p    = chart.la_so[key];
        const card = document.getElementById(`cung-${key}`);
        const isMenh = p.ten_cung === 'Mệnh';
        const isThan = p.is_than;

        card.className = `palace-card${isMenh ? ' is-menh' : ''}`;

        const canAbbr  = yearCanIdx >= 0 ? getPalaceCanAbbr(idx, yearCanIdx) : '';
        const branchColorClass = `color-${CHI_ELEMENTS[idx]}`;
        const chiLabel = canAbbr ? `<span class="${branchColorClass}">${canAbbr}.${CUNG_CHI[idx]}</span>` : CUNG_CHI[idx];

        const chinhHTML = p.chinh_tinh.map((s, si) => {
          const ratingAbbr = STAR_RATINGS[s] ? STAR_RATINGS[s][idx] : "";
          const ratingFull = RATING_FULL[ratingAbbr] || ratingAbbr;
          const el = STAR_ELEMENTS[s] || "neutral";
          return `<span class="star-main color-${el}" style="--si:${si}">${s} (${ratingFull})</span>`;
        }).join('');

        const phuTinh = [...p.phu_tinh];
        if (idx === 4)  phuTinh.push('Thiên La');
        if (idx === 10) phuTinh.push('Địa Võng');

        const goodStars = phuTinh.filter(s => GOOD_STARS.has(s));
        const badStars = phuTinh.filter(s => BAD_STARS.has(s));
        const otherStars = phuTinh.filter(s => !GOOD_STARS.has(s) && !BAD_STARS.has(s));

        const goodStarsHTML = goodStars.map(s => getAuxStarHTML(s, idx)).join('');
        const badStarsHTML = badStars.map(s => getAuxStarHTML(s, idx)).join('');
        const otherStarsHTML = otherStars.map(s => getAuxStarHTML(s, idx)).join('');

        const thanBadge = isThan ? `<span class="pc-than-badge">Thân</span>` : '';
        let ttLabel = '';
        if (p.tuan && p.triet) ttLabel = `<span class="pc-tt-badge black">T.Triệt</span>`;
        else if (p.tuan)        ttLabel = `<span class="pc-tt-badge blue">Tuần</span>`;
        else if (p.triet)       ttLabel = `<span class="pc-tt-badge red">Triệt</span>`;

        card.innerHTML = `
          <div class="pc-header">
            <span class="pc-chi">${chiLabel} ${ttLabel}</span>
            <div class="pc-cung-wrap">
              <span class="pc-cung">${isMenh ? '<span class="badge-menh">MỆNH</span>' : p.ten_cung}</span>${thanBadge}
            </div>
            <span class="pc-daihan">${p.dai_han}</span>
          </div>
          <div class="pc-stars">
            <div class="pc-chinh">${chinhHTML}</div>
            <div class="pc-phu">
              <div class="phu-col-left">${goodStarsHTML}</div>
              <div class="phu-col-right">${badStarsHTML}${otherStarsHTML}</div>
            </div>
          </div>
          <div class="pc-footer">
            <span class="pc-trangs" style="color: #006622; font-style: italic; font-weight:700;">${p.trang_sinh || ''}</span>
            <span class="pc-nguyet">${p.nguyet_han ? 'T.' + p.nguyet_han : ''}</span>
          </div>`;
      });

      // Show sections: timeline đại hạn + nghi thức an sao (AI panel hiện khi nghi thức xong)
      chartWrapper.style.display = 'block';
      buildDaihanTimeline();
      chartWrapper.scrollIntoView({ behavior: 'smooth' });
      playReveal();
    });
    // ==================== IMAGE EXPORT ====================
    // html2canvas (~200KB) chỉ nạp khi thật sự bấm xuất ảnh — không đè lên first load
    let html2canvasPromise = null;
    function ensureHtml2canvas() {
      if (window.html2canvas) return Promise.resolve(window.html2canvas);
      if (!html2canvasPromise) {
        html2canvasPromise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = () => resolve(window.html2canvas);
          s.onerror = () => { html2canvasPromise = null; reject(new Error('Không tải được html2canvas')); };
          document.head.appendChild(s);
        });
      }
      return html2canvasPromise;
    }

    document.getElementById('btn-export-img').addEventListener('click', () => {
      const target = document.querySelector('.chart-outer');
      const nameVal = document.getElementById('f-name').value.trim() || 'vo-danh';
      const exportBtn = document.getElementById('btn-export-img');

      exportBtn.disabled = true;
      exportBtn.textContent = 'Đang xuất... ⏳';

      ensureHtml2canvas().then((html2canvas) => {
        html2canvas(target, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#faf6ed'
        }).then(canvas => {
          const link = document.createElement('a');
          link.download = `la-so-tu-vi-${nameVal.replace(/\s+/g, '-')}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i class="ti ti-camera"></i> Xuất ảnh lá số';
        }).catch(err => {
          console.error('Export error:', err);
          alert('Có lỗi xảy ra khi xuất ảnh lá số.');
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i class="ti ti-camera"></i> Xuất ảnh lá số';
        });
      }).catch(err => {
        console.error('html2canvas load error:', err);
        alert('Không tải được công cụ xuất ảnh. Kiểm tra kết nối mạng rồi thử lại.');
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="ti ti-camera"></i> Xuất ảnh lá số';
      });
    });
    // ==================== AI CONSULTATION ====================
    askBtn.addEventListener('click', () => {
      const q = qInput.value.trim();
      if (q) handleAskAI(q);
    });

    qInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') { const q = qInput.value.trim(); if (q) handleAskAI(q); }
    });

    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (questionsAsked >= 5) {
          alert('Đã đạt giới hạn 5 câu hỏi. Vui lòng tạo lá số mới để tiếp tục.');
          return;
        }
        handleAskAI(chip.getAttribute('data-q'));
      });
    });

    function handleAskAI(questionText) {
      if (!currentChart) return;
      const isFollowUp = chatHistory.length > 0;
      if (isFollowUp && questionsAsked >= 5) {
        alert('Đã đạt giới hạn 5 câu hỏi. Vui lòng tạo lá số mới để tiếp tục.');
        return;
      }
      if (isFollowUp) questionsAsked++;

      qInput.value = '';
      askBtn.textContent = 'ĐANG LUẬN...';
      document.querySelectorAll('.prompt-chip').forEach(b => b.disabled = true);

      chat.sendWithUI({
        question: questionText,
        context: buildSummary(currentChart, currentBirthYear, currentNamXem),
        type: 'tuvi',
        history: chatHistory,
        onDone(fullAnswer) {
          chatHistory.push({ role: 'user', content: questionText });
          chatHistory.push({ role: 'assistant', content: fullAnswer });
          if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);

          askBtn.textContent = 'THAM VẤN AI';
          document.querySelectorAll('.prompt-chip').forEach(b => b.disabled = false);

          if (questionsAsked >= 5) {
            qInput.placeholder = 'Đã đạt giới hạn 5 câu hỏi bổ sung...';
            qInput.disabled = true; askBtn.disabled = true;
            document.querySelectorAll('.prompt-chip').forEach(b => b.disabled = true);
          }
        },
        onError() {
          if (isFollowUp) questionsAsked--;
          askBtn.textContent = 'THAM VẤN AI';
          document.querySelectorAll('.prompt-chip').forEach(b => b.disabled = false);
        }
      });
    }

    function buildSummary(chart, birthYear, namXem) {
      const al = chart.thong_tin_goc.am_lich;
      const ti = chart.thong_tin_goc;
      const currentAge = namXem - birthYear;
      let menhInfo = '', thanInfo = '';
      let currentDH = null, nextDH = null;
      const palaces = [];

      Object.entries(chart.la_so).forEach(([, p]) => {
        const chinh = p.chinh_tinh.join(', ') || 'Vô tinh';
        const phu = p.phu_tinh.slice(0, 3).join(', ');
        palaces.push(`${p.ten_cung}: [${chinh}]${phu ? ' + ' + phu : ''}`);
        if (p.ten_cung === 'Mệnh') menhInfo = chinh;
        if (p.is_than) thanInfo = `${p.ten_cung} [${chinh}]`;
        if (p.dai_han <= currentAge && (!currentDH || p.dai_han > currentDH.dai_han)) {
          currentDH = p;
        }
      });

      if (currentDH) {
        const nextAge = currentDH.dai_han + 10;
        Object.entries(chart.la_so).forEach(([, p]) => {
          if (p.dai_han === nextAge) nextDH = p;
        });
      }

      let s = `Giới tính: ${ti.phan_loai} | Cục: ${ti.cuc} | Mệnh nạp âm: ${ti.menh_nap_am}\n`;
      s += `Âm lịch: ${al.ngay}/${al.thang}/${al.nam} | Giờ: ${al.gio} | Tuổi hiện tại: ~${currentAge}\n`;
      s += `Mệnh cung: [${menhInfo}] | Thân cung: ${thanInfo}\n`;
      if (currentDH) {
        const c = currentDH.chinh_tinh.join(', ') || 'Vô tinh';
        s += `Đại hạn đang chạy (tuổi ${currentDH.dai_han}–${currentDH.dai_han + 9}): cung ${currentDH.ten_cung} [${c}]\n`;
      }
      if (nextDH) {
        const n = nextDH.chinh_tinh.join(', ') || 'Vô tinh';
        s += `Đại hạn kế tiếp (tuổi ${nextDH.dai_han}–${nextDH.dai_han + 9}): cung ${nextDH.ten_cung} [${n}]\n`;
      }
      s += '\nTóm tắt 12 cung:\n' + palaces.join('\n');
      return s;
    }

    // ==================== CHIẾU OVERLAY ====================
    (function initChieuOverlay() {
      const outer = document.querySelector('.chart-outer');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'chieu-svg';
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;overflow:visible;';
      outer.appendChild(svg);

      // Tam phương tứ chính: cung hiện tại + tam hợp 2 cung (±4) + cung đối diện (±6)
      function getRelated(idx) {
        return [(idx + 4) % 12, (idx + 6) % 12, (idx + 8) % 12];
      }

      function cardCenter(key) {
        const card = document.getElementById(`cung-${key}`);
        const or = outer.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        return { x: cr.left - or.left + cr.width / 2, y: cr.top - or.top + cr.height / 2 };
      }

      function clearOverlay() {
        svg.innerHTML = '';
        CUNG_KEYS.forEach(k => {
          const c = document.getElementById(`cung-${k}`);
          c.classList.remove('is-chieu-self', 'is-chieu', 'is-chieu-dim');
        });
      }

      let clearTimer = null;

      CUNG_KEYS.forEach((key, idx) => {
        const card = document.getElementById(`cung-${key}`);

        card.addEventListener('mouseenter', () => {
          if (!currentChart) return;
          clearTimeout(clearTimer);
          clearOverlay();

          const relatedIdxs = getRelated(idx);
          const allHighlighted = new Set([idx, ...relatedIdxs]);

          CUNG_KEYS.forEach((k, i) => {
            const c = document.getElementById(`cung-${k}`);
            if (i === idx) c.classList.add('is-chieu-self');
            else if (allHighlighted.has(i)) c.classList.add('is-chieu');
            else c.classList.add('is-chieu-dim');
          });

          // Draw lines + dots connecting the 4 related palaces
          const allIdxs = [idx, ...relatedIdxs];
          const centers = allIdxs.map(i => cardCenter(CUNG_KEYS[i]));

          for (let a = 0; a < centers.length; a++) {
            for (let b = a + 1; b < centers.length; b++) {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', centers[a].x); line.setAttribute('y1', centers[a].y);
              line.setAttribute('x2', centers[b].x); line.setAttribute('y2', centers[b].y);
              line.setAttribute('stroke', 'rgba(190, 100, 12, 0.5)');
              line.setAttribute('stroke-width', '1.5');
              line.setAttribute('stroke-dasharray', '6 3');
              svg.appendChild(line);
            }
          }

          // Dots at each palace center (hovered = larger)
          centers.forEach((c, i) => {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', c.x);
            dot.setAttribute('cy', c.y);
            dot.setAttribute('r',  i === 0 ? '5' : '3.5');
            dot.setAttribute('fill', i === 0 ? 'rgba(220, 105, 10, 0.9)' : 'rgba(190, 100, 12, 0.65)');
            dot.setAttribute('stroke', 'rgba(255,255,255,0.6)');
            dot.setAttribute('stroke-width', '1.5');
            svg.appendChild(dot);
          });
        });

        card.addEventListener('mouseleave', () => {
          clearTimer = setTimeout(clearOverlay, 80);
        });
      });

      // Also clear when mouse leaves the whole grid
      document.getElementById('chart-grid').addEventListener('mouseleave', () => {
        clearTimeout(clearTimer);
        clearOverlay();
      });
    })();

    // ==================== NGHI THỨC AN SAO (reveal sequence) ====================
    let revealTimers = [];

    function clearRevealTimers() {
      revealTimers.forEach(clearTimeout);
      revealTimers = [];
    }

    function finishReveal(outer) {
      clearRevealTimers();
      outer.classList.remove('is-revealing');
      outer.classList.add('reveal-done');
      CUNG_KEYS.forEach(k => document.getElementById(`cung-${k}`).classList.remove('pc-in'));
      aiPanel.style.display = 'block';
    }

    function playReveal() {
      const outer = document.querySelector('.chart-outer');
      outer.classList.remove('reveal-done');
      clearRevealTimers();

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishReveal(outer);
        return;
      }

      aiPanel.style.display = 'none';
      outer.classList.add('is-revealing');

      // Thứ tự an cung: đi trọn vòng địa bàn, kết thúc tại cung Mệnh
      let menhIdx = CUNG_KEYS.findIndex(k => currentChart.la_so[k].ten_cung === 'Mệnh');
      if (menhIdx < 0) menhIdx = 0;
      const order = [];
      for (let s = 1; s <= 12; s++) order.push((menhIdx + s) % 12);

      const START = 900;  // chờ địa bàn trung tâm xoay vào vị trí
      const STEP  = 190;

      order.forEach((idx, i) => {
        revealTimers.push(setTimeout(() => {
          document.getElementById(`cung-${CUNG_KEYS[idx]}`).classList.add('pc-in');
        }, START + i * STEP));
      });

      // Mệnh bùng sáng khép lại nghi thức
      revealTimers.push(setTimeout(() => {
        const menhCard = document.getElementById(`cung-${CUNG_KEYS[menhIdx]}`);
        menhCard.classList.add('pc-menh-flash');
        setTimeout(() => menhCard.classList.remove('pc-menh-flash'), 1300);
      }, START + 12 * STEP + 150));

      revealTimers.push(setTimeout(() => finishReveal(outer), START + 12 * STEP + 800));

      // Chạm/click bất kỳ đâu trên lá số để bỏ qua nghi thức
      outer.addEventListener('click', function skip() {
        if (outer.classList.contains('is-revealing')) finishReveal(outer);
      }, { once: true });
    }

    // ==================== SHEET CHI TIẾT CUNG + AI THEO CUNG ====================
    const PALACE_MEANINGS = {
      'Mệnh':      'Cung quan trọng nhất của lá số — phản ánh tính cách bẩm sinh, tư chất, ngoại hình và cách bạn tiếp cận cuộc sống.',
      'Phụ Mẫu':   'Nói về cha mẹ, mối quan hệ với đấng sinh thành và phúc ấm mà gia đình truyền lại cho bạn.',
      'Phúc Đức':  'Phúc phần của dòng họ, đời sống tinh thần và nguồn may mắn tiềm ẩn theo bạn cả đời.',
      'Điền Trạch':'Nhà cửa, đất đai, tài sản cố định và khả năng tích lũy bất động sản của bạn.',
      'Quan Lộc':  'Sự nghiệp, công danh, con đường thăng tiến và phong cách làm việc của bạn.',
      'Nô Bộc':    'Bạn bè, đồng nghiệp, cấp dưới và quý nhân — những người trợ lực hoặc kéo lùi bạn.',
      'Thiên Di':  'Môi trường bên ngoài, chuyện xuất hành, cơ hội nơi xa và cách người đời nhìn nhận bạn.',
      'Tật Ách':   'Sức khỏe, bệnh tật tiềm ẩn và những tai ách cần phòng bị trong đời.',
      'Tài Bạch':  'Tiền bạc, cách kiếm tiền, cách giữ tiền và duyên của bạn với tài lộc.',
      'Tử Tức':    'Con cái, đường con và mối duyên giữa bạn với thế hệ sau.',
      'Phu Thê':   'Hôn nhân, người bạn đời và chất lượng đời sống tình cảm của bạn.',
      'Huynh Đệ':  'Anh chị em ruột và sự hỗ trợ lẫn nhau giữa các anh em trong nhà.'
    };

    let openPalaceSheet = null; // gán trong initPalaceSheet, timeline dùng chung

    (function initPalaceSheet() {
      const sheet = document.createElement('div');
      sheet.id = 'palace-sheet';
      sheet.hidden = true;
      sheet.innerHTML = `
        <div class="ps-backdrop"></div>
        <div class="ps-panel" role="dialog" aria-modal="true" aria-labelledby="ps-cung">
          <div class="ps-handle"></div>
          <div class="ps-head">
            <div>
              <div class="ps-cung" id="ps-cung">—</div>
              <div class="ps-sub" id="ps-sub">—</div>
            </div>
            <button type="button" class="ps-close" aria-label="Đóng">✕</button>
          </div>
          <p class="ps-desc" id="ps-desc"></p>
          <div class="ps-stars-title">Chính tinh</div>
          <div class="ps-stars" id="ps-chinh"></div>
          <div class="ps-stars-title">Phụ tinh</div>
          <div class="ps-stars" id="ps-phu"></div>
          <div class="ps-actions">
            <button type="button" class="ps-ask"><i class="ti ti-wand"></i> Hỏi AI về cung này</button>
            <button type="button" class="ps-ask-dh">Hỏi về đại hạn</button>
          </div>
        </div>`;
      document.body.appendChild(sheet);

      const elCung  = sheet.querySelector('#ps-cung');
      const elSub   = sheet.querySelector('#ps-sub');
      const elDesc  = sheet.querySelector('#ps-desc');
      const elChinh = sheet.querySelector('#ps-chinh');
      const elPhu   = sheet.querySelector('#ps-phu');
      let curIdx = -1;

      function close() { sheet.hidden = true; }
      sheet.querySelector('.ps-backdrop').addEventListener('click', close);
      sheet.querySelector('.ps-close').addEventListener('click', close);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

      openPalaceSheet = function (idx) {
        if (!currentChart) return;
        curIdx = idx;
        const key = CUNG_KEYS[idx];
        const p = currentChart.la_so[key];

        const yearCanStr = currentChart.thong_tin_goc.am_lich.nam.split(' ')[0];
        const yearCanIdx = CAN_NAMES.indexOf(yearCanStr);
        const canAbbr = yearCanIdx >= 0 ? getPalaceCanAbbr(idx, yearCanIdx) : '';

        elCung.innerHTML = `Cung ${p.ten_cung}` +
          (p.ten_cung === 'Mệnh' ? '<span class="ps-menh-tag">MỆNH</span>' : '') +
          (p.is_than ? '<span class="ps-menh-tag">THÂN</span>' : '');
        elSub.textContent = `${canAbbr ? canAbbr + '.' : ''}${CUNG_CHI[idx]} · Đại hạn ${p.dai_han}–${p.dai_han + 9} tuổi` +
          (p.trang_sinh ? ` · ${p.trang_sinh}` : '');
        elDesc.textContent = PALACE_MEANINGS[p.ten_cung] || '';

        if (p.chinh_tinh.length) {
          elChinh.innerHTML = p.chinh_tinh.map(s => {
            const abbr = STAR_RATINGS[s] ? STAR_RATINGS[s][idx] : '';
            const full = RATING_FULL[abbr] || abbr;
            const el = STAR_ELEMENTS[s] || 'neutral';
            return `<span class="ps-star ps-star-main color-${el}">${s}${full ? ' · ' + full : ''}</span>`;
          }).join('');
        } else {
          elChinh.innerHTML = '<span class="ps-empty">Vô chính diệu — cung mượn sao tam phương tứ chính để luận.</span>';
        }

        const phuTinh = [...p.phu_tinh];
        if (idx === 4)  phuTinh.push('Thiên La');
        if (idx === 10) phuTinh.push('Địa Võng');
        const sorted = [
          ...phuTinh.filter(s => GOOD_STARS.has(s)),
          ...phuTinh.filter(s => !GOOD_STARS.has(s) && !BAD_STARS.has(s)),
          ...phuTinh.filter(s => BAD_STARS.has(s))
        ];
        elPhu.innerHTML = sorted.length
          ? sorted.map(s => `<span class="ps-star color-${ALL_STARS_ELEMENTS[s] || 'neutral'}">${s}</span>`).join('')
          : '<span class="ps-empty">Không có phụ tinh.</span>';

        sheet.hidden = false;
      };

      sheet.querySelector('.ps-ask').addEventListener('click', () => {
        if (curIdx < 0 || !currentChart) return;
        const p = currentChart.la_so[CUNG_KEYS[curIdx]];
        const chinh = p.chinh_tinh.join(', ') || 'Vô chính diệu';
        close();
        aiPanel.scrollIntoView({ behavior: 'smooth' });
        handleAskAI(`Luận giải chi tiết cung ${p.ten_cung} (${chinh}) trong lá số của tôi: các sao ở cung này ảnh hưởng thế nào, điểm mạnh, điểm yếu và lời khuyên cụ thể?`);
      });

      sheet.querySelector('.ps-ask-dh').addEventListener('click', () => {
        if (curIdx < 0 || !currentChart) return;
        const p = currentChart.la_so[CUNG_KEYS[curIdx]];
        close();
        aiPanel.scrollIntoView({ behavior: 'smooth' });
        handleAskAI(`Luận giải vận trình đại hạn ${p.dai_han}–${p.dai_han + 9} tuổi tại cung ${p.ten_cung} trong lá số của tôi: giai đoạn này thuận lợi hay khó khăn, cần lưu ý và tận dụng điều gì?`);
      });

      // Click cung → mở sheet (không mở khi đang chạy nghi thức an sao)
      CUNG_KEYS.forEach((key, idx) => {
        document.getElementById(`cung-${key}`).addEventListener('click', () => {
          if (!currentChart) return;
          if (document.querySelector('.chart-outer').classList.contains('is-revealing')) return;
          openPalaceSheet(idx);
        });
      });
    })();

    // ==================== TIMELINE ĐẠI HẠN ====================
    function buildDaihanTimeline() {
      const holder = document.getElementById('dh-holder');
      const wrap = document.getElementById('dh-timeline');
      if (!holder || !wrap || !currentChart) return;

      const items = CUNG_KEYS
        .map((key, idx) => ({ idx, p: currentChart.la_so[key] }))
        .sort((a, b) => a.p.dai_han - b.p.dai_han);

      const age = currentNamXem - currentBirthYear + 1; // tuổi mụ

      wrap.innerHTML = '';
      let currentBtn = null;
      items.forEach(({ idx, p }) => {
        const isCur = age >= p.dai_han && age < p.dai_han + 10;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dh-seg' + (isCur ? ' dh-current' : '');
        btn.innerHTML =
          `<span class="dh-age">${p.dai_han}–${p.dai_han + 9}</span>` +
          `<span class="dh-cung">${p.ten_cung}</span>` +
          (isCur ? '<span class="dh-now">HIỆN TẠI</span>' : '');
        btn.addEventListener('click', () => openPalaceSheet && openPalaceSheet(idx));
        wrap.appendChild(btn);
        if (isCur) currentBtn = btn;
      });

      holder.style.display = 'block';
      if (currentBtn) {
        wrap.scrollLeft = currentBtn.offsetLeft - wrap.clientWidth / 2 + currentBtn.clientWidth / 2;
      }
    }
