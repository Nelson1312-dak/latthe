/**
 * thansohoc/js/app.js
 * Numerology Pythagorean calculations, birth chart rendering, arrow detection, and AI master chat.
 */

// ==================== DICTIONARIES & EXPLANATIONS ====================
const INDICATORS_INFO = {
  lifepath: {
    name: "Số Chủ Đạo (Life Path Number)",
    desc: {
      "2": "<h4>Hành trình của Người Hòa Giải & Kết Nối</h4><p>Bạn sở hữu tần số nhạy cảm cao, trực giác nhạy bén, khả năng thấu cảm và lắng nghe xuất sắc. Bạn thích làm việc nhóm hơn là dẫn đầu, là nhân tố hòa giải tuyệt vời trong mọi xung đột.</p><h4>Lời khuyên:</h4><ul><li>Học cách nói 'không' khi cần thiết.</li><li>Tin tưởng vào trực giác của mình.</li><li>Tránh gánh vác cảm xúc tiêu cực của người khác.</li></ul>",
      "3": "<h4>Hành trình của Người Truyền Cảm Hứng & Trí Tuệ</h4><p>Bạn là người có tư duy nhanh nhạy, hoạt ngôn, có khiếu hài hước và khả năng truyền đạt xuất sắc. Bạn tỏa sáng khi được thể hiện sự sáng tạo và năng lượng trí tuệ.</p><h4>Lời khuyên:</h4><ul><li>Tránh chỉ trích người khác bằng lời nói sắc bén.</li><li>Tập trung năng lượng vào các dự án cụ thể, tránh phân tán.</li><li>Rèn luyện tính kiên nhẫn.</li></ul>",
      "4": "<h4>Hành trình của Người Kiến Tạo & Kỷ Luật</h4><p>Bạn thực tế, ngăn nắp, coi trọng tính chính xác và an toàn. Bạn là điểm tựa vững chắc, đáng tin cậy trong công việc lẫn cuộc sống gia đình nhờ sự chăm chỉ và nguyên tắc.</p><h4>Lời khuyên:</h4><ul><li>Học cách linh hoạt và mở lòng đón nhận thay đổi.</li><li>Tránh làm việc quá sức (Workaholic).</li><li>Dành thời gian phát triển thế giới tinh thần.</li></ul>",
      "5": "<h4>Hành trình của Người Khám Phá & Tự Do</h4><p>Năng lượng của bạn là tự do, phiêu lưu, thích trải nghiệm những điều mới lạ. Bạn có óc sáng tạo cao, giàu lòng trắc ẩn và rất linh hoạt trong mọi hoàn cảnh.</p><h4>Lời khuyên:</h4><ul><li>Xây dựng kỷ luật tự thân để tránh mất phương hướng.</li><li>Tránh các thói quen tiêu cực do ham muốn tự do thái quá.</li><li>Suy nghĩ kỹ trước khi đưa ra quyết định lớn.</li></ul>",
      "6": "<h4>Hành trình của Người Sáng Tạo & Nuôi Dưỡng</h4><p>Bạn mang năng lượng của tình yêu thương gia đình, sự chăm sóc và trách nhiệm cao cả. Bạn có khiếu thẩm mỹ tốt và khát khao cống hiến vẻ đẹp cho đời.</p><h4>Lời khuyên:</h4><ul><li>Học cách chăm sóc bản thân trước khi lo lắng cho người khác.</li><li>Tránh áp đặt tiêu chuẩn hoàn hảo lên người thân.</li><li>Bớt lo lắng thái quá về những chuyện chưa xảy ra.</li></ul>",
      "7": "<h4>Hành trình của Người Tìm Kiếm Chân Lý & Trải Nghiệm</h4><p>Bạn thích tự mình trải nghiệm để đúc rút bài học sâu sắc. Bạn có năng lượng của một nhà triết học, nhà nghiên cứu tâm linh hoặc người dẫn đường bằng trí tuệ thực chứng.</p><h4>Lời khuyên:</h4><ul><li>Tránh tự cô lập bản thân quá lâu.</li><li>Nhìn nhận thất bại như là bài học quý giá thay vì oán trách.</li><li>Chia sẻ kiến thức rộng rãi hơn.</li></ul>",
      "8": "<h4>Hành trình của Người Độc Lập & Thực Thi</h4><p>Bạn độc lập, tự chủ, có năng lực quản lý và thu hút sự thịnh vượng vật chất mạnh mẽ. Tuy nhiên, sâu thẳm bên trong bạn là một người giàu lòng trắc ẩn và tình cảm ấm áp.</p><h4>Lời khuyên:</h4><ul><li>Học cách thể hiện cảm xúc và tình yêu thương rõ ràng hơn.</li><li>Tránh để cái tôi và lòng kiêu hãnh cản trở mối quan hệ.</li><li>Cân bằng giữa thế giới vật chất và tinh thần.</li></ul>",
      "9": "<h4>Hành trình của Người Nhân Ái & Hoài Bão</h4><p>Bạn mang hoài bão lớn, giàu lý tưởng xã hội, luôn hướng về cộng đồng và sự nhân văn. Bạn sống có trách nhiệm và sẵn sàng tha thứ, giúp đỡ người khác.</p><h4>Lời khuyên:</h4><ul><li>Học cách kiên định và thực tế hơn trong kế hoạch cá nhân.</li><li>Đừng để những thất vọng về thế giới làm bạn chán nản.</li><li>Giải quyết những vết thương lòng trong quá khứ.</li></ul>",
      "10": "<h4>Hành trình của Người Tiên Phong & Thích Ứng</h4><p>Bạn tự tin, năng động, dễ thích nghi với mọi môi trường mới. Bạn sở hữu lòng dũng cảm của người tiên phong và khả năng thu hút đám đông rất tự nhiên.</p><h4>Lời khuyên:</h4><ul><li>Tránh rơi vào trạng thái tự cao tự đại.</li><li>Kiên trì theo đuổi mục tiêu thay vì dễ cả thèm chóng chán.</li><li>Lắng nghe ý kiến của người khác nhiều hơn.</li></ul>",
      "11": "<h4>Hành trình của Người Dẫn Đường Tâm Linh (Master 11)</h4><p>Bạn sở hữu trực giác siêu nhạy, khả năng tâm linh bẩm sinh và nhận thức sâu sắc về thế giới tinh thần. Bạn ở đây để mang ánh sáng nhận thức và hòa bình đến cho nhân loại.</p><h4>Lời khuyên:</h4><ul><li>Học cách cân bằng cảm xúc cá nhân để tránh căng thẳng thần kinh.</li><li>Tránh xa thế giới vật chất cám dỗ làm mờ đi sứ mệnh.</li><li>Thực hành thiền định hoặc kết nối thiên nhiên.</li></ul>",
      "22/4": "<h4>Hành trình của Người Kiến Tạo Vĩ Đại (Master 22/4)</h4><p>Được coi là con số mạnh nhất trong Thần số học. Bạn kết hợp trực giác nhạy bén của số 11 và tính thực tế vững chắc của số 4. Bạn có khả năng hiện thực hóa những ý tưởng vĩ mô có tầm ảnh hưởng lớn.</p><h4>Lời khuyên:</h4><ul><li>Tránh rơi vào cái bẫy của sự tham vọng quá mức hoặc lười biếng.</li><li>Hãy chịu trách nhiệm lớn lao với sự khiêm tốn.</li><li>Cân bằng năng lượng thể chất và tinh thần.</li></ul>",
      "33/6": "<h4>Hành trình của Người Thầy Chữa Lành Vĩ Đại (Master 33/6)</h4><p>Bạn mang năng lượng của lòng vị tha thuần khiết, tình yêu thương vô điều kiện và sức mạnh sáng tạo nghệ thuật vượt trội. Bạn truyền cảm hứng và nâng đỡ tinh thần cho nhân loại.</p><h4>Lời khuyên:</h4><ul><li>Tránh hy sinh bản thân đến mức kiệt quệ năng lượng.</li><li>Học cách thiết lập ranh giới lành mạnh.</li><li>Tin tưởng vào con đường nghệ thuật/chữa lành.</li></ul>"
    }
  },
  destiny: {
    name: "Số Sứ Mệnh (Destiny / Expression Number)",
    desc: "<h4>Mục tiêu & Hướng đi của cuộc đời</h4><p>Số Sứ Mệnh (tính từ tổng giá trị các chữ cái cấu thành họ và tên) tiết lộ mục tiêu cuối cùng của bạn trên hành trình này, năng lực bạn cần phát triển và cách thức bạn đạt được thành công tối đa.</p><p>Năng lượng của con số này định hướng sự nghiệp, hoạt động xã hội và cách bạn cống hiến cho thế giới xung quanh.</p>"
  },
  soul: {
    name: "Số Linh Hồn (Soul Urge Number)",
    desc: "<h4>Khát khao sâu thẳm trong nội tâm</h4><p>Số Linh Hồn (tính từ tổng các nguyên âm trong họ tên) đại diện cho tiếng nói nội tâm, những khao khát sâu kín nhất, động lực thực sự khiến bạn cảm thấy hạnh phúc và bình yên trọn vẹn.</p><p>Nó phản ánh những gì bạn cần nuôi dưỡng cho tinh thần của mình, độc lập với những kỳ vọng bên ngoài.</p>"
  },
  personality: {
    name: "Số Nhân Cách (Personality Number)",
    desc: "<h4>Ấn tượng đầu tiên trong mắt người khác</h4><p>Số Nhân Cách (tính từ tổng các phụ âm trong họ tên) phản ánh vỏ bọc bên ngoài, cách bạn thể hiện bản thân ra thế giới và ấn tượng đầu tiên mà mọi người cảm nhận về bạn.</p><p>Nó giống như chiếc bộ lọc giúp bạn tự bảo vệ nội tâm bên trong đồng thời giao tiếp hiệu quả với xã hội.</p>"
  },
  birthday: {
    name: "Số Ngày Sinh (Birth Day Number)",
    desc: "<h4>Năng lực tự nhiên & Tài năng bẩm sinh</h4><p>Số Ngày Sinh (rút gọn từ ngày sinh của bạn) đại diện cho những công cụ, món quà đặc biệt và năng khiếu mà vũ trụ ban tặng sẵn cho bạn ngay khi chào đời.</p><p>Nó giúp bạn vượt qua các thử thách đầu đời một cách thuận lợi nếu biết tận dụng đúng cách.</p>"
  },
  attitude: {
    name: "Số Thái Độ (Attitude Number)",
    desc: "<h4>Cách bạn phản ứng với các tình huống</h4><p>Số Thái Độ (rút gọn từ Ngày + Tháng sinh) phản ánh phản xạ tự nhiên của bạn trước các biến cố, cơ hội hay nghịch cảnh trong đời.</p><p>Thái độ tích cực phù hợp với con số này sẽ giúp bạn xoay chuyển tình thế, biến thách thức thành bàn đạp phát triển.</p>"
  }
};

const ARROWS_INFO = {
  "3-6-9": {
    name: "Mũi Tên Trí Tuệ",
    strength: "<h4>Mũi Tên Trí Tuệ (3-6-9 đầy đủ)</h4><p>Bạn sở hữu khả năng tư duy logic xuất sắc, óc sáng tạo phong phú và một trí nhớ đáng kinh ngạc. Bạn học hỏi rất nhanh và thích làm việc với kiến thức học thuật, nghiên cứu hoặc nghệ thuật tư duy.</p>",
    weakness: "<h4>Mũi Tên Trống Trí Nhớ (3-6-9 trống)</h4><p>Bạn có xu hướng dễ quên hoặc mất tập trung khi học hỏi những điều mới. Cần rèn luyện ghi chép, hệ thống hóa thông tin và tạo thói quen rèn luyện trí nhớ đều đặn hằng ngày.</p>"
  },
  "2-5-8": {
    name: "Mũi Tên Cảm Xúc",
    strength: "<h4>Mũi Tên Cảm Xúc (2-5-8 đầy đủ)</h4><p>Bạn có trực giác nhạy bén, khả năng tự cân bằng cảm xúc rất tốt và trái tim ấm áp, thấu cảm sâu sắc với mọi người xung quanh. Bạn là chỗ dựa tinh thần tuyệt vời.</p>",
    weakness: "<h4>Mũi Tên Trống Cảm Xúc (2-5-8 trống)</h4><p>Bạn dễ rơi vào trạng thái nhạy cảm quá mức, khó bộc lộ cảm xúc thật hoặc dễ cảm thấy cô độc, tổn thương. Hãy học cách mở lòng, chia sẻ và yêu thương bản thân nhiều hơn.</p>"
  },
  "1-4-7": {
    name: "Mũi Tên Thực Tế",
    strength: "<h4>Mũi Tên Thực Tế (1-4-7 đầy đủ)</h4><p>Bạn là người thực tế, thích hành động và có đôi tay khéo léo. Bạn chỉ tin vào những trải nghiệm thực tế và có năng khiếu sắp xếp, quản lý các công việc cụ thể cực tốt.</p>",
    weakness: "<h4>Mũi Tên Trống Thực Tế (1-4-7 trống)</h4><p>Bạn dễ mơ mộng, thiếu tính thực tiễn trong cuộc sống hoặc ngại va chạm với các công việc tay chân, thực tế. Hãy học cách lập kế hoạch tài chính cụ thể và bắt tay làm việc nhỏ mỗi ngày.</p>"
  },
  "1-2-3": {
    name: "Mũi Tên Kế Hoạch",
    strength: "<h4>Mũi Tên Kế Hoạch (1-2-3 đầy đủ)</h4><p>Bạn là người có đầu óc tổ chức, lập kế hoạch chi tiết và thực thi mọi việc theo trình tự ngăn nắp. Bạn luôn chuẩn bị kỹ càng trước khi bắt đầu hành trình.</p>",
    weakness: "<h4>Mũi Tên Trống Kế Hoạch (1-2-3 trống)</h4><p>Bạn dễ làm việc tùy hứng, thiếu ngăn nắp và gặp khó khăn trong việc thiết lập trật tự cuộc sống. Hãy tập thói quen viết To-do list hằng ngày và tuân thủ thời gian biểu.</p>"
  },
  "4-5-6": {
    name: "Mũi Tên Ý Chí",
    strength: "<h4>Mũi Tên Ý Chí (4-5-6 đầy đủ)</h4><p>Bạn sở hữu ý chí quật cường, lòng kiên định vượt qua nghịch cảnh và tinh thần tự chủ rất cao. Bạn kiên trì bảo vệ lý tưởng và mục tiêu của bản thân.</p>",
    weakness: "<h4>Mũi Tên Trống Ý Chí (4-5-6 trống)</h4><p>Bạn dễ rơi vào cảm giác bất an, tự ti hoặc hay lo lắng thái quá dẫn đến việc trì hoãn. Hãy tập trung xây dựng niềm tin nội lực và học cách buông bỏ nỗi sợ mơ hồ.</p>"
  },
  "7-8-9": {
    name: "Mũi Tên Hoạt Động",
    strength: "<h4>Mũi Tên Hoạt Động (7-8-9 đầy đủ)</h4><p>Bạn năng động, thích khám phá thế giới, đam mê trải nghiệm thực tế và du lịch trải nghiệm. Bạn tràn đầy năng lượng khi được tự do vận động và trải nghiệm cuộc sống ngoài trời.</p>",
    weakness: "<h4>Mũi Tên Trống Hoạt Động (7-8-9 trống)</h4><p>Bạn có xu hướng thụ động, ngại thay đổi và thích trốn trong vùng an toàn quen thuộc của mình. Hãy rèn luyện thể chất năng nổ hơn và can đảm thử những trải nghiệm mới lạ.</p>"
  },
  "1-5-9": {
    name: "Mũi Tên Quyết Tâm",
    strength: "<h4>Mũi Tên Quyết Tâm (1-5-9 đầy đủ)</h4><p>Mũi tên vàng của sự kiên trì. Bạn cực kỳ kiên định, đã quyết làm việc gì là sẽ theo đuổi đến cùng bất chấp khó khăn thử thách. Sức bền của bạn là vô địch.</p>",
    weakness: "<h4>Mũi Tên Trì Hoãn (1-5-9 trống)</h4><p>Bạn hay chần chừ, trì hoãn công việc và dễ nản lòng bỏ cuộc giữa chừng. Hãy chia nhỏ mục tiêu lớn thành các việc nhỏ dễ làm để tạo đà chiến thắng mỗi ngày.</p>"
  },
  "3-5-7": {
    name: "Mũi Tên Nhạy Bén / Tâm Linh",
    strength: "<h4>Mũi Tên Nhạy Bén (3-5-7 đầy đủ)</h4><p>Bạn sở hữu trực giác tâm linh nhạy bén vượt trội, khả năng thấu thị cảm xúc và lòng tin sâu sắc vào thế giới tinh thần. Bạn rất thấu cảm với nỗi đau nhân sinh.</p>",
    weakness: "<h4>Mũi Tên Hoài Nghi (3-5-7 trống)</h4><p>Bạn có xu hướng đa nghi, chỉ tin vào những thứ chứng minh được bằng logic thuần túy và dễ hoài nghi về lòng tốt của người khác. Hãy rèn luyện lòng biết ơn để mở lòng hơn.</p>"
  }
};

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
  while (lpSum > 11 && lpSum !== 22 && lpSum !== 33) {
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

  // Click indicators to show detail drawer
  document.querySelectorAll('.indicator-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      const info = INDICATORS_INFO[type];
      if (!info || !currentProfileData) return;

      let val = currentProfileData[type];
      let body = info.desc;
      if (type === 'lifepath') {
        body = info.desc[val] || info.desc["2"]; // fallback
      }
      openDrawer(info.name, val, body);
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
