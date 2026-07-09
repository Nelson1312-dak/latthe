/**
 * bao-cao/js/report-data.js — dữ liệu luận giải cho Báo Cáo Vận Mệnh Tổng Hợp.
 * Cung hoàng đạo phương Tây, ngũ hành nạp âm, con giáp. Globals:
 * RP_ZODIAC, RP_ELEMENT, RP_GIAP.
 */

// 12 cung hoàng đạo phương Tây — [tên, biểu tượng, nguyên tố, blurb]
const RP_ZODIAC = {
  'Bạch Dương':  { sym: '♈\uFE0E', el: 'Hỏa', d: 'Tiên phong, nhiệt huyết, dám nghĩ dám làm. Bạn lao về phía trước bằng bản năng của người mở đường — mạnh ở khởi đầu, cần rèn sự kiên nhẫn khi về đích.' },
  'Kim Ngưu':    { sym: '♉\uFE0E', el: 'Thổ', d: 'Vững vàng, kiên định, yêu cái đẹp và sự ổn định. Bạn xây dựng chậm mà chắc, trung thành và đáng tin — chỉ cần đề phòng tính bảo thủ, ngại thay đổi.' },
  'Song Tử':     { sym: '♊\uFE0E', el: 'Khí', d: 'Linh hoạt, tò mò, giỏi ngôn từ và kết nối. Trí óc bạn chạy nhanh, hợp mọi việc cần giao tiếp — bài học là tập trung để không phân tán năng lượng.' },
  'Cự Giải':     { sym: '♋\uFE0E', el: 'Thủy', d: 'Nhạy cảm, giàu tình cảm, gắn bó gia đình. Bạn chăm sóc người khác bằng cả trái tim — hãy học cách bảo vệ năng lượng của mình khỏi việc ôm đồm cảm xúc.' },
  'Sư Tử':       { sym: '♌\uFE0E', el: 'Hỏa', d: 'Tự tin, hào phóng, có sức hút thủ lĩnh. Bạn sinh ra để tỏa sáng và truyền cảm hứng — giữ được sự khiêm nhường thì ánh sáng ấy càng bền.' },
  'Xử Nữ':       { sym: '♍\uFE0E', el: 'Thổ', d: 'Tỉ mỉ, thực tế, cầu toàn và tận tâm. Bạn nhìn ra điều người khác bỏ sót — nhớ rằng "đủ tốt" đôi khi quý hơn "hoàn hảo".' },
  'Thiên Bình':  { sym: '♎\uFE0E', el: 'Khí', d: 'Hài hòa, công bằng, duyên dáng trong quan hệ. Bạn là người kiến tạo sự cân bằng — bài học là dám ra quyết định thay vì mãi phân vân.' },
  'Bọ Cạp':      { sym: '♏\uFE0E', el: 'Thủy', d: 'Sâu sắc, mãnh liệt, ý chí sắt đá. Bạn nhìn thấu bản chất và không ngại chiều sâu — sức mạnh lớn nhất là biết buông và tha thứ.' },
  'Nhân Mã':     { sym: '♐\uFE0E', el: 'Hỏa', d: 'Phóng khoáng, lạc quan, khát khao tự do và tri thức. Bạn là nhà thám hiểm của cuộc đời — giữ lời hứa và sự tập trung sẽ đưa bạn đi xa hơn.' },
  'Ma Kết':      { sym: '♑\uFE0E', el: 'Thổ', d: 'Kỷ luật, tham vọng, bền bỉ leo đến đỉnh. Bạn xây sự nghiệp như xây núi — nhớ dành chỗ cho niềm vui và người thân trên hành trình.' },
  'Bảo Bình':    { sym: '♒\uFE0E', el: 'Khí', d: 'Độc lập, sáng tạo, tư duy khác biệt và nhân văn. Bạn đi trước thời đại — sức mạnh nằm ở việc kết nối tầm nhìn lớn với con người thật.' },
  'Song Ngư':    { sym: '♓\uFE0E', el: 'Thủy', d: 'Mơ mộng, trực giác, giàu lòng trắc ẩn và nghệ thuật. Bạn cảm nhận thế giới bằng tâm hồn — cần ranh giới rõ để không chìm trong cảm xúc người khác.' },
};

// Ngày bắt đầu mỗi cung (tháng, ngày) — dùng để xác định cung từ ngày sinh
const RP_ZODIAC_RANGES = [
  ['Ma Kết', 1, 1], ['Bảo Bình', 1, 20], ['Song Ngư', 2, 19], ['Bạch Dương', 3, 21],
  ['Kim Ngưu', 4, 20], ['Song Tử', 5, 21], ['Cự Giải', 6, 21], ['Sư Tử', 7, 23],
  ['Xử Nữ', 8, 23], ['Thiên Bình', 9, 23], ['Bọ Cạp', 10, 23], ['Nhân Mã', 11, 22],
  ['Ma Kết', 12, 22],
];

function zodiacOf(day, month) {
  let name = 'Ma Kết';
  for (const [n, m, d] of RP_ZODIAC_RANGES) {
    if (month === m && day >= d) name = n;
    else if (month === m && day < d) break;
    else if (month > m) name = n;
  }
  return name;
}

// 5 ngũ hành nạp âm — tính cách + màu hợp + hướng + mệnh tương sinh
const RP_ELEMENT = {
  'Kim': { d: 'Mệnh Kim mang khí chất cứng cỏi, quyết đoán và trọng nguyên tắc. Bạn có tố chất lãnh đạo, nói là làm, coi trọng danh dự. Điểm cần lưu ý: bớt cứng nhắc, học sự mềm dẻo để giữ hòa khí.', colors: 'Trắng, ghi, vàng ánh kim', dir: 'Tây, Tây Bắc', sinh: 'Thổ (được nuôi dưỡng) & Thủy (bạn nuôi dưỡng)' },
  'Mộc': { d: 'Mệnh Mộc tràn sức sống, nhân hậu và hướng thượng như cây vươn ánh sáng. Bạn giàu ý tưởng, thích phát triển và giúp người. Điểm cần lưu ý: tránh ôm đồm, biết cắt tỉa để lớn vững.', colors: 'Xanh lá, xanh ngọc', dir: 'Đông, Đông Nam', sinh: 'Thủy (được nuôi dưỡng) & Hỏa (bạn nuôi dưỡng)' },
  'Thủy': { d: 'Mệnh Thủy thông minh, linh hoạt và sâu sắc như nước — thích nghi mọi hoàn cảnh. Bạn giỏi giao tiếp, trực giác tốt. Điểm cần lưu ý: giữ lập trường, tránh trôi theo hoàn cảnh.', colors: 'Xanh dương, đen', dir: 'Bắc', sinh: 'Kim (được nuôi dưỡng) & Mộc (bạn nuôi dưỡng)' },
  'Hỏa': { d: 'Mệnh Hỏa nhiệt tình, cuốn hút và đầy đam mê như ngọn lửa. Bạn truyền năng lượng cho người quanh mình, dám bứt phá. Điểm cần lưu ý: tiết chế nóng vội, giữ lửa cháy bền thay vì bùng rồi tắt.', colors: 'Đỏ, hồng, cam, tím', dir: 'Nam', sinh: 'Mộc (được nuôi dưỡng) & Thổ (bạn nuôi dưỡng)' },
  'Thổ': { d: 'Mệnh Thổ vững chãi, bao dung và đáng tin như đất mẹ. Bạn là chỗ dựa của mọi người, thực tế và kiên trì. Điểm cần lưu ý: cởi mở với cái mới, tránh quá thận trọng mà lỡ cơ hội.', colors: 'Vàng, nâu đất', dir: 'Trung tâm, Đông Bắc, Tây Nam', sinh: 'Hỏa (được nuôi dưỡng) & Kim (bạn nuôi dưỡng)' },
};

// 12 con giáp — blurb ngắn + nhóm tam hợp (tên các con giáp hợp)
const RP_GIAP = {
  'Chuột': { d: 'Nhanh nhạy, tháo vát, giỏi xoay xở và tích lũy.', hop: 'Rồng, Khỉ' },
  'Trâu':  { d: 'Cần cù, kiên nhẫn, đáng tin và bền bỉ.', hop: 'Rắn, Gà' },
  'Hổ':    { d: 'Dũng cảm, độc lập, giàu khí phách thủ lĩnh.', hop: 'Ngựa, Chó' },
  'Mèo':   { d: 'Ôn hòa, tinh tế, khéo léo và giàu thẩm mỹ.', hop: 'Dê, Lợn' },
  'Rồng':  { d: 'Bản lĩnh, tham vọng, có sức hút và may mắn.', hop: 'Chuột, Khỉ' },
  'Rắn':   { d: 'Sâu sắc, khôn ngoan, trực giác và quyết đoán ngầm.', hop: 'Trâu, Gà' },
  'Ngựa':  { d: 'Phóng khoáng, nhiệt huyết, yêu tự do và hành động.', hop: 'Hổ, Chó' },
  'Dê':    { d: 'Dịu dàng, sáng tạo, nhân hậu và giàu nghệ thuật.', hop: 'Mèo, Lợn' },
  'Khỉ':   { d: 'Thông minh, hài hước, linh hoạt và nhiều mưu trí.', hop: 'Chuột, Rồng' },
  'Gà':    { d: 'Chăm chỉ, ngăn nắp, thẳng thắn và cầu tiến.', hop: 'Trâu, Rắn' },
  'Chó':   { d: 'Trung thành, chính trực, tận tâm và giàu công lý.', hop: 'Hổ, Ngựa' },
  'Lợn':   { d: 'Chân thành, rộng lượng, lạc quan và biết hưởng thụ.', hop: 'Mèo, Dê' },
};
