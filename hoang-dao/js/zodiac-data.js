/**
 * hoang-dao/js/zodiac-data.js — Dữ liệu 12 cung hoàng đạo + pool tử vi hằng ngày.
 * Globals: ZODIAC (mảng 12 cung theo thứ tự), zodiacOfDate(d,m), DAILY_POOLS,
 *          Z_COLORS, Z_ELEMENTS.
 */

// Thứ tự chuẩn Bạch Dương → Song Ngư. range = [thángBắtĐầu, ngàyBắtĐầu] (ngày đầu cung).
const ZODIAC = [
  {
    ten: 'Bạch Dương', en: 'Aries', sym: '♈', bieuTuong: 'Con Cừu',
    range: '21/3 – 19/4', nguyeTo: 'Hỏa', tinhChat: 'Thống Lĩnh (Cardinal)',
    sao: 'Sao Hỏa (Mars)', mau: 'Đỏ', so: '9', ngay: 'Thứ Ba', da: 'Kim cương',
    tongQuan: 'Bạch Dương là cung mở đầu hoàng đạo — biểu tượng của sự khởi đầu, nhiệt huyết và lòng dũng cảm. Bạn hành động theo bản năng của người tiên phong, dám nghĩ dám làm, ghét trì hoãn và luôn muốn là người đầu tiên.',
    manh: ['Quyết đoán, dám tiên phong', 'Nhiệt huyết, tràn năng lượng', 'Thẳng thắn, trung thực', 'Lãnh đạo bẩm sinh'],
    yeu: ['Nóng vội, thiếu kiên nhẫn', 'Bốc đồng, dễ nổi nóng', 'Đôi khi ích kỷ, hiếu thắng'],
    tinhYeu: 'Yêu mãnh liệt và chủ động theo đuổi, nhưng cần học sự kiên nhẫn và lắng nghe đối phương.',
    suNghiep: 'Hợp vai trò lãnh đạo, khởi nghiệp, thể thao, quân đội — nơi cần quyết định nhanh và tinh thần tiên phong.',
    taiChinh: 'Kiếm tiền giỏi nhưng tiêu nhanh; nên rèn kỷ luật chi tiêu và tránh đầu tư bốc đồng.',
    hop: ['Sư Tử', 'Nhân Mã', 'Song Tử', 'Bảo Bình'], khac: ['Cự Giải', 'Ma Kết'],
  },
  {
    ten: 'Kim Ngưu', en: 'Taurus', sym: '♉', bieuTuong: 'Con Bò',
    range: '20/4 – 20/5', nguyeTo: 'Thổ', tinhChat: 'Kiên Định (Fixed)',
    sao: 'Sao Kim (Venus)', mau: 'Xanh lá', so: '6', ngay: 'Thứ Sáu', da: 'Ngọc lục bảo',
    tongQuan: 'Kim Ngưu vững vàng, kiên nhẫn và yêu cái đẹp, sự ổn định. Bạn xây dựng cuộc sống chậm mà chắc, trung thành và đáng tin — nhưng cũng khá bảo thủ và ngại thay đổi.',
    manh: ['Kiên định, bền bỉ', 'Đáng tin, trung thành', 'Thực tế, giỏi tài chính', 'Gu thẩm mỹ tốt'],
    yeu: ['Bảo thủ, cứng đầu', 'Ngại thay đổi, thích an toàn', 'Đôi khi chiếm hữu, ham vật chất'],
    tinhYeu: 'Chung thủy và lãng mạn kiểu bền vững; cần đối phương kiên nhẫn và cho cảm giác an toàn.',
    suNghiep: 'Hợp tài chính, ngân hàng, bất động sản, ẩm thực, nghệ thuật — nơi cần sự tỉ mỉ và bền bỉ.',
    taiChinh: 'Bậc thầy tích lũy, biết giữ tiền và đầu tư an toàn dài hạn; đây là điểm mạnh lớn nhất của bạn.',
    hop: ['Xử Nữ', 'Ma Kết', 'Cự Giải', 'Song Ngư'], khac: ['Sư Tử', 'Bảo Bình'],
  },
  {
    ten: 'Song Tử', en: 'Gemini', sym: '♊', bieuTuong: 'Cặp Song Sinh',
    range: '21/5 – 20/6', nguyeTo: 'Khí', tinhChat: 'Linh Hoạt (Mutable)',
    sao: 'Sao Thủy (Mercury)', mau: 'Vàng', so: '5', ngay: 'Thứ Tư', da: 'Mã não',
    tongQuan: 'Song Tử linh hoạt, tò mò và giỏi ngôn từ. Trí óc bạn chạy nhanh, thích giao tiếp và khám phá cái mới — nhưng dễ phân tán và thiếu kiên định.',
    manh: ['Thông minh, nhanh nhạy', 'Giao tiếp xuất sắc', 'Linh hoạt, thích nghi tốt', 'Hài hước, cuốn hút'],
    yeu: ['Thiếu tập trung, cả thèm chóng chán', 'Hay do dự, "hai mặt"', 'Nói nhiều hơn làm'],
    tinhYeu: 'Cần người bạn đời thông minh, biết trò chuyện; sợ nhàm chán nên cần sự mới mẻ liên tục.',
    suNghiep: 'Hợp truyền thông, báo chí, bán hàng, MC, marketing — mọi nghề cần ngôn từ và kết nối.',
    taiChinh: 'Kiếm tiền từ nhiều nguồn nhưng chi tiêu thất thường; nên tập trung một hướng để tích lũy.',
    hop: ['Thiên Bình', 'Bảo Bình', 'Bạch Dương', 'Sư Tử'], khac: ['Xử Nữ', 'Song Ngư'],
  },
  {
    ten: 'Cự Giải', en: 'Cancer', sym: '♋', bieuTuong: 'Con Cua',
    range: '21/6 – 22/7', nguyeTo: 'Thủy', tinhChat: 'Thống Lĩnh (Cardinal)',
    sao: 'Mặt Trăng (Moon)', mau: 'Bạc / Trắng', so: '2', ngay: 'Thứ Hai', da: 'Ngọc trai',
    tongQuan: 'Cự Giải nhạy cảm, giàu tình cảm và gắn bó gia đình sâu sắc. Bạn chăm sóc người khác bằng cả trái tim, trực giác mạnh — nhưng dễ tổn thương và hay thu mình.',
    manh: ['Giàu tình cảm, tận tụy', 'Trực giác nhạy bén', 'Chung thủy, biết chở che', 'Trí nhớ tốt'],
    yeu: ['Quá nhạy cảm, dễ tổn thương', 'Hay lo âu, bám víu quá khứ', 'Tâm trạng thất thường'],
    tinhYeu: 'Yêu sâu sắc và cần cảm giác an toàn; là người bạn đời ấm áp, tận tụy với tổ ấm.',
    suNghiep: 'Hợp chăm sóc sức khỏe, giáo dục, ẩm thực, bất động sản, tâm lý — nơi cần sự thấu cảm.',
    taiChinh: 'Biết tiết kiệm cho gia đình và tương lai; thận trọng, ít mạo hiểm với tiền bạc.',
    hop: ['Bọ Cạp', 'Song Ngư', 'Kim Ngưu', 'Xử Nữ'], khac: ['Bạch Dương', 'Thiên Bình'],
  },
  {
    ten: 'Sư Tử', en: 'Leo', sym: '♌', bieuTuong: 'Con Sư Tử',
    range: '23/7 – 22/8', nguyeTo: 'Hỏa', tinhChat: 'Kiên Định (Fixed)',
    sao: 'Mặt Trời (Sun)', mau: 'Vàng kim / Cam', so: '1', ngay: 'Chủ Nhật', da: 'Hồng ngọc',
    tongQuan: 'Sư Tử tự tin, hào phóng và có sức hút thủ lĩnh. Bạn sinh ra để tỏa sáng, truyền cảm hứng và dẫn dắt — nhưng cần giữ khiêm nhường để không sa vào kiêu ngạo.',
    manh: ['Tự tin, cuốn hút', 'Hào phóng, ấm áp', 'Lãnh đạo, truyền cảm hứng', 'Trung thành, chính trực'],
    yeu: ['Kiêu ngạo, thích được khen', 'Bảo thủ, cái tôi lớn', 'Đôi khi độc đoán'],
    tinhYeu: 'Lãng mạn, nồng nhiệt và tận tâm; cần được ngưỡng mộ và tôn trọng từ đối phương.',
    suNghiep: 'Hợp quản lý, nghệ thuật biểu diễn, chính trị, kinh doanh — nơi bạn được đứng ở trung tâm.',
    taiChinh: 'Rộng rãi, thích hưởng thụ và thể hiện; cần cân đối giữa "sĩ diện" và tích lũy thực tế.',
    hop: ['Bạch Dương', 'Nhân Mã', 'Song Tử', 'Thiên Bình'], khac: ['Kim Ngưu', 'Bọ Cạp'],
  },
  {
    ten: 'Xử Nữ', en: 'Virgo', sym: '♍', bieuTuong: 'Trinh Nữ',
    range: '23/8 – 22/9', nguyeTo: 'Thổ', tinhChat: 'Linh Hoạt (Mutable)',
    sao: 'Sao Thủy (Mercury)', mau: 'Nâu / Xanh navy', so: '5', ngay: 'Thứ Tư', da: 'Ngọc bích',
    tongQuan: 'Xử Nữ tỉ mỉ, thực tế và cầu toàn. Bạn nhìn ra điều người khác bỏ sót, làm việc tận tâm và có tổ chức — nhưng dễ khắt khe với bản thân và người khác.',
    manh: ['Tỉ mỉ, chu đáo', 'Thực tế, có tổ chức', 'Chăm chỉ, đáng tin', 'Phân tích sắc bén'],
    yeu: ['Cầu toàn, hay soi xét', 'Lo lắng thái quá', 'Khó hài lòng, hay tự trách'],
    tinhYeu: 'Kín đáo, chân thành và tận tụy; thể hiện tình yêu qua sự quan tâm chi tiết hằng ngày.',
    suNghiep: 'Hợp y tế, kế toán, biên tập, nghiên cứu, dịch vụ — nơi cần sự chính xác và tận tâm.',
    taiChinh: 'Quản lý tiền khoa học, chi tiêu hợp lý, giỏi lập kế hoạch — rất ít khi thiếu hụt.',
    hop: ['Kim Ngưu', 'Ma Kết', 'Cự Giải', 'Bọ Cạp'], khac: ['Song Tử', 'Nhân Mã'],
  },
  {
    ten: 'Thiên Bình', en: 'Libra', sym: '♎', bieuTuong: 'Cái Cân',
    range: '23/9 – 22/10', nguyeTo: 'Khí', tinhChat: 'Thống Lĩnh (Cardinal)',
    sao: 'Sao Kim (Venus)', mau: 'Hồng / Xanh pastel', so: '6', ngay: 'Thứ Sáu', da: 'Sapphire',
    tongQuan: 'Thiên Bình hài hòa, công bằng và duyên dáng trong quan hệ. Bạn là người kiến tạo sự cân bằng, yêu cái đẹp và sự thanh lịch — nhưng hay do dự và ngại xung đột.',
    manh: ['Công bằng, khách quan', 'Duyên dáng, ngoại giao khéo', 'Yêu hòa bình, biết lắng nghe', 'Gu thẩm mỹ cao'],
    yeu: ['Do dự, khó quyết định', 'Ngại va chạm, cả nể', 'Phụ thuộc ý kiến người khác'],
    tinhYeu: 'Lãng mạn và trọng sự cân bằng; cần một mối quan hệ bình đẳng, đẹp đẽ và hòa hợp.',
    suNghiep: 'Hợp luật, ngoại giao, thiết kế, tư vấn, nhân sự — nơi cần sự công tâm và khéo léo.',
    taiChinh: 'Thích sự thoải mái và cái đẹp nên dễ chi cho phong cách sống; nên đặt hạn mức rõ ràng.',
    hop: ['Song Tử', 'Bảo Bình', 'Sư Tử', 'Nhân Mã'], khac: ['Cự Giải', 'Ma Kết'],
  },
  {
    ten: 'Bọ Cạp', en: 'Scorpio', sym: '♏', bieuTuong: 'Con Bọ Cạp',
    range: '23/10 – 21/11', nguyeTo: 'Thủy', tinhChat: 'Kiên Định (Fixed)',
    sao: 'Sao Diêm Vương (Pluto)', mau: 'Đỏ đô / Đen', so: '9', ngay: 'Thứ Ba', da: 'Topaz',
    tongQuan: 'Bọ Cạp sâu sắc, mãnh liệt và ý chí sắt đá. Bạn nhìn thấu bản chất mọi việc, không ngại chiều sâu và bí ẩn — nhưng dễ chiếm hữu và khó buông bỏ.',
    manh: ['Ý chí mạnh, quyết liệt', 'Sâu sắc, trực giác cao', 'Trung thành tuyệt đối', 'Bản lĩnh, dám dấn thân'],
    yeu: ['Chiếm hữu, hay ghen', 'Cố chấp, khó tha thứ', 'Bí ẩn đến mức khó gần'],
    tinhYeu: 'Yêu nồng nàn và toàn tâm toàn ý; cần sự chân thành tuyệt đối, ghét bị phản bội.',
    suNghiep: 'Hợp điều tra, tâm lý, tài chính, y khoa, nghiên cứu — nơi cần chiều sâu và sự kiên định.',
    taiChinh: 'Nhạy bén với cơ hội lớn, dám đầu tư mạnh; giỏi biến khủng hoảng thành lợi thế.',
    hop: ['Cự Giải', 'Song Ngư', 'Xử Nữ', 'Ma Kết'], khac: ['Sư Tử', 'Bảo Bình'],
  },
  {
    ten: 'Nhân Mã', en: 'Sagittarius', sym: '♐', bieuTuong: 'Cung Thủ / Nhân Mã',
    range: '22/11 – 21/12', nguyeTo: 'Hỏa', tinhChat: 'Linh Hoạt (Mutable)',
    sao: 'Sao Mộc (Jupiter)', mau: 'Tím / Xanh dương', so: '3', ngay: 'Thứ Năm', da: 'Lam ngọc (Turquoise)',
    tongQuan: 'Nhân Mã phóng khoáng, lạc quan và khát khao tự do, tri thức. Bạn là nhà thám hiểm của cuộc đời, yêu du lịch và triết lý — nhưng dễ thiếu kiên nhẫn và thẳng thắn đến vô ý.',
    manh: ['Lạc quan, phóng khoáng', 'Yêu tự do, ham học hỏi', 'Chân thành, hào sảng', 'Tầm nhìn rộng'],
    yeu: ['Thiếu kiên nhẫn, cả tin', 'Nói thẳng đến mất lòng', 'Ngại ràng buộc, hay hứa suông'],
    tinhYeu: 'Cần một người bạn đồng hành yêu tự do và phiêu lưu; ghét sự gò bó, kiểm soát.',
    suNghiep: 'Hợp du lịch, giáo dục, xuất bản, luật, thể thao — nơi có sự tự do và mở rộng tầm nhìn.',
    taiChinh: 'May mắn về tiền bạc nhưng tiêu hào phóng; nên giữ quỹ dự phòng và tránh cá cược.',
    hop: ['Bạch Dương', 'Sư Tử', 'Thiên Bình', 'Bảo Bình'], khac: ['Xử Nữ', 'Song Ngư'],
  },
  {
    ten: 'Ma Kết', en: 'Capricorn', sym: '♑', bieuTuong: 'Con Dê Biển',
    range: '22/12 – 19/1', nguyeTo: 'Thổ', tinhChat: 'Thống Lĩnh (Cardinal)',
    sao: 'Sao Thổ (Saturn)', mau: 'Nâu đất / Đen', so: '8', ngay: 'Thứ Bảy', da: 'Mã não đen',
    tongQuan: 'Ma Kết kỷ luật, tham vọng và bền bỉ. Bạn leo đến đỉnh bằng sự kiên trì và trách nhiệm, thực tế và đáng tin — nhưng dễ quá nghiêm khắc và ôm đồm áp lực.',
    manh: ['Kỷ luật, trách nhiệm', 'Tham vọng, bền bỉ', 'Thực tế, đáng tin', 'Kiên nhẫn dài hạn'],
    yeu: ['Cứng nhắc, bi quan', 'Ôm việc, tham công tiếc việc', 'Khó mở lòng, khô khan'],
    tinhYeu: 'Nghiêm túc và chung thủy; yêu chậm nhưng bền, tìm người bạn đời cùng xây tương lai.',
    suNghiep: 'Hợp quản trị, tài chính, kỹ thuật, luật, xây dựng — nơi tưởng thưởng sự bền bỉ và kỷ luật.',
    taiChinh: 'Bậc thầy tích lũy và đầu tư dài hạn; kiếm và giữ tiền đều rất giỏi, ít rủi ro.',
    hop: ['Kim Ngưu', 'Xử Nữ', 'Bọ Cạp', 'Song Ngư'], khac: ['Bạch Dương', 'Thiên Bình'],
  },
  {
    ten: 'Bảo Bình', en: 'Aquarius', sym: '♒', bieuTuong: 'Người Mang Nước',
    range: '20/1 – 18/2', nguyeTo: 'Khí', tinhChat: 'Kiên Định (Fixed)',
    sao: 'Sao Thiên Vương (Uranus)', mau: 'Xanh điện / Bạc', so: '4', ngay: 'Thứ Bảy', da: 'Thạch anh tím',
    tongQuan: 'Bảo Bình độc lập, sáng tạo và tư duy khác biệt, nhân văn. Bạn đi trước thời đại, yêu tự do và lý tưởng cộng đồng — nhưng đôi khi xa cách và bướng bỉnh.',
    manh: ['Sáng tạo, đột phá', 'Độc lập, tư duy khác biệt', 'Nhân văn, vì cộng đồng', 'Cởi mở, tiến bộ'],
    yeu: ['Xa cách cảm xúc', 'Bướng bỉnh, khó đoán', 'Nổi loạn, ngại cam kết'],
    tinhYeu: 'Cần một tri kỷ tôn trọng sự tự do và cá tính; coi trọng tình bạn trong tình yêu.',
    suNghiep: 'Hợp công nghệ, khoa học, sáng tạo, hoạt động xã hội — nơi khuyến khích sự đổi mới.',
    taiChinh: 'Kiếm tiền theo cách không truyền thống; nên tránh các quyết định tài chính quá ngẫu hứng.',
    hop: ['Song Tử', 'Thiên Bình', 'Bạch Dương', 'Nhân Mã'], khac: ['Kim Ngưu', 'Bọ Cạp'],
  },
  {
    ten: 'Song Ngư', en: 'Pisces', sym: '♓', bieuTuong: 'Đôi Cá',
    range: '19/2 – 20/3', nguyeTo: 'Thủy', tinhChat: 'Linh Hoạt (Mutable)',
    sao: 'Sao Hải Vương (Neptune)', mau: 'Xanh biển / Tím nhạt', so: '7', ngay: 'Thứ Năm', da: 'Ngọc mắt mèo',
    tongQuan: 'Song Ngư mơ mộng, trực giác và giàu lòng trắc ẩn, nghệ thuật. Bạn cảm nhận thế giới bằng tâm hồn, đồng cảm sâu sắc — nhưng cần ranh giới rõ để không chìm trong cảm xúc người khác.',
    manh: ['Giàu trực giác, nghệ thuật', 'Nhân hậu, đồng cảm', 'Lãng mạn, giàu tưởng tượng', 'Vị tha, dịu dàng'],
    yeu: ['Mơ mộng, thiếu thực tế', 'Dễ bị lợi dụng, cả nể', 'Trốn tránh, hay ủy mị'],
    tinhYeu: 'Lãng mạn và tận hiến; yêu bằng cả tâm hồn, cần người trân trọng sự nhạy cảm của bạn.',
    suNghiep: 'Hợp nghệ thuật, âm nhạc, chữa lành, từ thiện, tâm linh — nơi cần trực giác và lòng trắc ẩn.',
    taiChinh: 'Không giỏi quản tiền theo bản năng; nên nhờ công cụ/kế hoạch rõ ràng và tránh cho vay cả nể.',
    hop: ['Cự Giải', 'Bọ Cạp', 'Kim Ngưu', 'Ma Kết'], khac: ['Song Tử', 'Nhân Mã'],
  },
];

// Ngày bắt đầu mỗi cung (tháng, ngày) — xác định cung từ ngày sinh
const Z_RANGES = [
  ['Ma Kết', 1, 1], ['Bảo Bình', 1, 20], ['Song Ngư', 2, 19], ['Bạch Dương', 3, 21],
  ['Kim Ngưu', 4, 20], ['Song Tử', 5, 21], ['Cự Giải', 6, 21], ['Sư Tử', 7, 23],
  ['Xử Nữ', 8, 23], ['Thiên Bình', 9, 23], ['Bọ Cạp', 10, 23], ['Nhân Mã', 11, 22],
  ['Ma Kết', 12, 22],
];
function zodiacOfDate(day, month) {
  let name = 'Ma Kết';
  for (const [n, m, d] of Z_RANGES) {
    if (month === m && day >= d) name = n;
    else if (month === m && day < d) break;
    else if (month > m) name = n;
  }
  return ZODIAC.find((z) => z.ten === name);
}

const Z_COLORS = ['Đỏ', 'Cam', 'Vàng', 'Xanh lá', 'Xanh dương', 'Tím', 'Hồng', 'Trắng', 'Bạc', 'Vàng kim'];

// Pool nội dung tử vi hằng ngày — chọn theo seed(cung + ngày + khía cạnh).
const DAILY_POOLS = {
  tongQuan: [
    'Hôm nay năng lượng của bạn dồi dào — hãy chủ động nắm bắt cơ hội đến bất ngờ.',
    'Một ngày thích hợp để lùi lại quan sát trước khi ra quyết định quan trọng.',
    'Vũ trụ ủng hộ những khởi đầu mới; đừng ngại bước ra khỏi vùng an toàn.',
    'Giữ tâm thế bình tĩnh sẽ giúp bạn hóa giải một tình huống dễ gây căng thẳng.',
    'Trực giác hôm nay khá nhạy — hãy tin vào cảm nhận đầu tiên của mình.',
    'Ngày của sự kết nối: một cuộc trò chuyện có thể mở ra hướng đi mới.',
    'Hãy dành thời gian cho bản thân; nạp lại năng lượng quan trọng hơn bạn nghĩ.',
    'Một tin vui nhỏ có thể đến; giữ tinh thần cởi mở để đón nhận.',
    'Đừng ôm đồm quá nhiều — chọn một việc quan trọng nhất và làm cho tới.',
    'Sự kiên nhẫn hôm nay sẽ được đền đáp; đừng vội vàng đốt cháy giai đoạn.',
  ],
  tinhYeu: [
    'Chuyện tình cảm ấm áp hơn nếu bạn chủ động bày tỏ sự quan tâm.',
    'Người độc thân có cơ hội gặp gỡ thú vị qua bạn bè hoặc mạng xã hội.',
    'Hãy lắng nghe nhiều hơn nói — đối phương đang cần được thấu hiểu.',
    'Một hiểu lầm nhỏ có thể xuất hiện; sự chân thành sẽ hóa giải tất cả.',
    'Dành một cử chỉ bất ngờ cho người ấy, tình cảm sẽ thêm gắn kết.',
    'Đừng để công việc lấn át; người thương cần sự hiện diện của bạn hôm nay.',
    'Cảm xúc dâng cao — hãy diễn đạt bằng sự dịu dàng thay vì nóng vội.',
  ],
  suNghiep: [
    'Công việc hanh thông; đây là lúc thể hiện năng lực trước người có thẩm quyền.',
    'Một dự án cũ có tiến triển tích cực nếu bạn kiên trì theo đuổi.',
    'Hợp tác nhóm mang lại kết quả tốt hơn là ôm việc một mình.',
    'Cẩn trọng với giấy tờ, hợp đồng — đọc kỹ trước khi đặt bút ký.',
    'Ý tưởng sáng tạo của bạn được đón nhận; mạnh dạn trình bày.',
    'Giữ sự tập trung, tránh để những việc vặt làm phân tán mục tiêu chính.',
    'Một cơ hội học hỏi/nâng cấp bản thân xuất hiện — nắm lấy nó.',
  ],
  taiChinh: [
    'Tài chính ổn định; thích hợp lập kế hoạch tiết kiệm dài hạn.',
    'Có thể có khoản thu bất ngờ, nhưng đừng vội chi tiêu hết.',
    'Cân nhắc kỹ trước khi cho vay hoặc đầu tư theo lời rủ rê.',
    'Ngày tốt để rà soát lại chi tiêu và cắt bỏ những khoản không cần thiết.',
    'Đừng quyết định tài chính lớn khi đang cảm xúc; hãy chờ thêm thông tin.',
    'Một cơ hội tăng thu nhập phụ đáng để bạn tìm hiểu nghiêm túc.',
  ],
  loiKhuyen: [
    'Hãy mỉm cười nhiều hơn — thái độ tích cực kéo may mắn đến gần.',
    'Uống đủ nước và nghỉ ngơi hợp lý để giữ năng lượng cả ngày.',
    'Nói lời cảm ơn với một người đã giúp đỡ bạn gần đây.',
    'Dành 10 phút tĩnh lặng để sắp xếp lại suy nghĩ.',
    'Đừng so sánh mình với người khác; tập trung vào tiến bộ của chính bạn.',
    'Một hành động tử tế nhỏ hôm nay sẽ quay lại với bạn.',
  ],
};
