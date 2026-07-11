/**
 * tuvi/js/congiap-2027-data.js — Tử vi 12 con giáp năm Đinh Mùi 2027.
 * Nội dung biên soạn tay theo quan hệ địa chi với Thái Tuế Mùi:
 *   - Mùi: năm tuổi (phạm Thái Tuế) + năm tam tai cuối của nhóm Hợi–Mão–Mùi
 *   - Sửu: lục xung Thái Tuế + tam hình Sửu–Mùi–Tuất
 *   - Tuất: tam hình Thái Tuế
 *   - Tý: lục hại Thái Tuế
 *   - Ngọ: lục hợp Thái Tuế
 *   - Hợi, Mão: tam hợp Thái Tuế nhưng năm tam tai cuối
 *   - Dần, Thìn, Tỵ, Thân, Dậu: bình hòa
 * Dùng bởi scripts/build-congiap-pages.mjs. Global: CONGIAP_2027.
 */

const CONGIAP_2027 = {
  'Tý': {
    slug: 'ty', vat: 'Chuột', quanHe: 'Lục hại Thái Tuế',
    tongQuan: 'Năm Đinh Mùi 2027, tuổi Tý rơi vào thế lục hại với Thái Tuế — không dữ dội như xung, nhưng âm ỉ kiểu "kỳ đà cản mũi": việc sắp thành lại phát sinh trục trặc nhỏ, dễ vướng lời ra tiếng vào. Vận trình tổng thể ở mức trung bình, tiến chậm mà chắc thì vẫn có thành quả, nóng vội thì hao tâm.',
    suNghiep: 'Công việc ổn định nhưng ít đột phá; các kế hoạch lớn nên chia nhỏ thành từng chặng. Đề phòng tiểu nhân sau lưng ở quý 2 âm lịch — làm gì cũng nên có giấy tờ, tin nhắn rõ ràng. Người làm nghề cần giao tiếp (bán hàng, môi giới) lại có duyên bất ngờ nhờ quý nhân tuổi Thân, Thìn.',
    taiLoc: 'Tài chính vào đều nhưng ra cũng nhanh vì các khoản phát sinh gia đình. Tránh cho vay tiền lớn và tuyệt đối không đứng tên bảo lãnh hộ ai trong năm hại Thái Tuế. Đầu tư dài hạn ổn hơn lướt sóng.',
    tinhCam: 'Người có đôi dễ giận hờn vặt vì hiểu lầm lời nói — nói rõ, nói sớm là tan. Người độc thân có duyên gặp gỡ qua bạn bè giới thiệu, nửa cuối năm sáng hơn nửa đầu.',
    sucKhoe: 'Chú ý hệ tiêu hóa và giấc ngủ; năm hại dễ suy nghĩ nhiều. Duy trì vận động nhẹ đều đặn tốt hơn tập nặng thất thường.',
    loiKhuyen: 'Năm của chữ "nhẫn nhỏ": nhịn một câu nói, chậm một nhịp ký — tránh được phần lớn cái hại của năm. Làm việc thiện, giúp người là cách hóa giải lục hại tự nhiên nhất.',
  },
  'Sửu': {
    slug: 'suu', vat: 'Trâu', quanHe: 'Xung Thái Tuế (lục xung) + tam hình',
    tongQuan: 'Tuổi Sửu là con giáp chịu áp lực lớn nhất năm 2027: vừa lục xung vừa nằm trong thế tam hình Sửu–Mùi–Tuất với Thái Tuế. Biến động là từ khóa của năm — công việc, chỗ ở, các mối quan hệ đều có thể xáo trộn. Tin tốt: xung Thái Tuế cũng là năm "bứt gốc" — ai chủ động thay đổi (chuyển việc, chuyển nhà, tái cấu trúc) thường lại hợp thời hơn người cố thủ.',
    suNghiep: 'Không nên ký các cam kết ràng buộc dài hạn thiếu đường lui. Nếu định nhảy việc, năm xung lại là thời điểm dứt khoát tốt — nhưng cần có bến đỗ rõ ràng trước khi rời bến cũ. Tránh đối đầu trực diện với cấp trên vào các tháng xung (tháng Giêng, tháng 6 âm).',
    taiLoc: 'Hao tài là đặc trưng năm xung — chủ động "hao có kế hoạch" bằng khoản chi lớn hữu ích (sửa nhà, học hành, sức khỏe) để hóa giải. Tránh hùn vốn mới và các kênh đầu tư rủi ro cao trong cả năm.',
    tinhCam: 'Cảm xúc dễ căng, va chạm với người thân tăng. Cưới hỏi năm xung Thái Tuế theo quan niệm cổ nên cân nhắc kỹ ngày giờ hoặc lùi thời điểm; nếu vẫn tiến hành, chọn ngày cẩn thận và giữ nghi lễ chu toàn.',
    sucKhoe: 'Đề phòng va chạm khi di chuyển, nhất là các tháng đầu năm; lái xe chậm lại. Xương khớp và răng lợi là hai điểm cần để ý của tuổi Sửu năm nay.',
    loiKhuyen: 'Dĩ động chế động: năm xung không hợp ngồi yên chịu trận — hãy là người chủ động tạo thay đổi thay vì bị thay đổi tìm đến. Đầu năm nên làm lễ cúng Thái Tuế theo phong tục để an tâm khởi sự.',
  },
  'Dần': {
    slug: 'dan', vat: 'Hổ', quanHe: 'Bình hòa với Thái Tuế',
    tongQuan: 'Tuổi Dần đi qua 2027 ở thế bình hòa — không vướng xung hình hại, không tam tai. Đây là năm "trời yên biển lặng" hiếm có để tuổi Dần tăng tốc: mọi thành quả đến từ chính nội lực chứ không bị thời vận cản trở hay nâng đỡ quá đà.',
    suNghiep: 'Thời điểm đẹp để nhận thêm trách nhiệm, học kỹ năng mới hoặc khởi động dự án ấp ủ. Quý nhân của năm là người tuổi Ngọ và tuổi Tuất — hợp tác nhóm tam hợp Dần–Ngọ–Tuất đặc biệt thuận.',
    taiLoc: 'Tài lộc tăng trưởng theo đúng công sức bỏ ra, ít khoản bất ngờ cả thu lẫn chi. Năm phù hợp để tích lũy quỹ dự phòng và tái đầu tư vào chính mình.',
    tinhCam: 'Bình ổn, ấm áp. Người độc thân nên chủ động mở rộng giao tiếp — duyên năm nay không tự gõ cửa nhưng đáp lại rất nhanh khi bạn bước ra ngoài.',
    sucKhoe: 'Nền sức khỏe tốt; chỉ cần giữ nhịp sinh hoạt điều độ, tránh chủ quan thức khuya kéo dài khi công việc thuận đà.',
    loiKhuyen: 'Năm bình hòa là vốn quý — đừng lãng phí vào sự trì hoãn. Việc lớn nào cần nền móng dài hạn (học, chuyển hướng nghề, mua tài sản), hãy khởi công trong năm nay.',
  },
  'Mão': {
    slug: 'mao', vat: 'Mèo', quanHe: 'Tam hợp Thái Tuế · năm tam tai cuối',
    tongQuan: 'Tuổi Mão năm 2027 ở thế đặc biệt: được Thái Tuế nâng đỡ nhờ tam hợp Hợi–Mão–Mùi, nhưng đồng thời là năm tam tai cuối cùng của nhóm. Hiểu đơn giản: cơ hội thật sự đến nhiều hơn hẳn hai năm trước, nhưng chân vẫn còn vướng dây — nắm cơ hội được, chỉ cần đi từng bước có kiểm soát.',
    suNghiep: 'Được người có vai vế để mắt và trao cơ hội; các mối quan hệ hợp tác mới nở rộ từ giữa năm. Tam tai cuối chỉ nhắc một điều: đọc kỹ hợp đồng, không đi đường tắt pháp lý — sai sót giấy tờ là cái bẫy điển hình của năm.',
    taiLoc: 'Thu nhập khởi sắc rõ so với 2025–2026, nhất là nguồn thu từ hợp tác. Vẫn nên giữ nguyên tắc tam tai: không dốc toàn bộ vốn vào một thương vụ, chừa đường lui 30%.',
    tinhCam: 'Năm ấm cho tình cảm — tam hợp Thái Tuế mang lại nhiều dịp gặp gỡ chất lượng. Người có đôi tính chuyện lâu dài khá thuận nếu chọn ngày kỹ.',
    sucKhoe: 'Sức khỏe cải thiện so với hai năm tam tai trước, nhưng đừng "trả thù" bằng lịch làm việc dày đặc — hệ thần kinh cần được thả lỏng có chủ đích.',
    loiKhuyen: 'Năm bản lề để thoát hẳn vùng trũng: nhận cơ hội, nhưng ký gì đọc nấy. Qua Tết 2028 là tuổi Mão sạch tam tai — hãy để 2027 là bệ phóng chứ không phải cú trượt phút chót.',
  },
  'Thìn': {
    slug: 'thin', vat: 'Rồng', quanHe: 'Bình hòa với Thái Tuế',
    tongQuan: 'Năm 2027 tuổi Thìn không vướng xung hình hại hại nào với Thái Tuế Mùi — một năm bình ổn để củng cố những gì đã gây dựng. Vận trình lên đều từ quý 2, đặc biệt thuận cho việc hoàn thiện các dự án dang dở.',
    suNghiep: 'Hợp các việc mang tính "đóng gói và nâng cấp": hoàn tất chứng chỉ, chuẩn hóa quy trình, xây thương hiệu cá nhân. Cuối năm có tin vui về vị trí hoặc ghi nhận. Quý nhân tuổi Thân và tuổi Tý.',
    taiLoc: 'Dòng tiền ổn định; có lộc nhỏ bất ngờ vào khoảng tháng 8 âm. Thích hợp cơ cấu lại danh mục tiết kiệm – đầu tư cho gọn, tránh dàn trải.',
    tinhCam: 'Êm đềm, ít sóng gió. Các cặp đôi lâu năm nên làm mới bằng một chuyến đi xa — tháng tam hợp (tháng 7, 11 âm) là thời điểm đẹp.',
    sucKhoe: 'Để ý huyết áp và cân nặng khi nhịp sống dễ chịu khiến bạn chủ quan; duy trì một môn vận động cố định trong tuần.',
    loiKhuyen: 'Năm của sự bồi đắp — không cần cú nhảy lớn nào cả. Ai kiên trì vun từng viên gạch trong 2027 sẽ có nền rất dày để bung sức vào năm Thân 2028.',
  },
  'Tỵ': {
    slug: 'ti', vat: 'Rắn', quanHe: 'Bình hòa với Thái Tuế · vừa thoát tam tai',
    tongQuan: 'Tuổi Tỵ bước vào 2027 với hành trang nhẹ nhất trong nhiều năm: không xung, không hình, không hại với Thái Tuế Mùi, và cũng không dính tam tai (nhóm Tỵ–Dậu–Sửu chỉ gặp tam tai vào các năm Hợi, Tý, Sửu). Vận thế hanh thông thuộc nhóm dễ chịu nhất 12 con giáp — một năm để trí tuệ tuổi Tỵ phát huy trọn vẹn.',
    suNghiep: 'Trí tuệ và sự tinh tế của tuổi Tỵ được việc trong năm Đinh Mùi — hợp các vai trò cố vấn, phân tích, đàm phán. Cơ hội thăng tiến rõ nét vào quý 3. Hợp tác với người tuổi Dậu, Sửu (tam hợp của bạn) đặc biệt ăn ý.',
    taiLoc: 'Tài vận sáng, có thể có nguồn thu phụ từ chuyên môn (dạy, viết, tư vấn). Đầu tư nên theo hướng bạn am hiểu sâu thay vì theo đám đông.',
    tinhCam: 'Duyên đến kiểu chậm mà chắc; người độc thân dễ gặp đối tượng chín chắn hơn mình vài tuổi. Người có đôi nên chia sẻ kế hoạch dài hạn để tránh mỗi người một hướng.',
    sucKhoe: 'Ổn định; để ý hệ hô hấp lúc giao mùa và đừng ngồi lì quá lâu khi công việc cuốn.',
    loiKhuyen: 'Năm đẹp để làm việc lớn có tính toán: mua tài sản, mở rộng kinh doanh, học lên cao. Tỵ vốn thận trọng — năm nay có thể tự tin nới tay hơn bình thường một chút.',
  },
  'Ngọ': {
    slug: 'ngo', vat: 'Ngựa', quanHe: 'Lục hợp Thái Tuế',
    tongQuan: 'Ngọ là con giáp được Thái Tuế "cầm tay" năm 2027 nhờ thế lục hợp Ngọ–Mùi — vận khí thuận nhất 12 con giáp. Việc khó có người gỡ, việc thuận có người đẩy; cảm giác "đúng thời" hiện diện trong hầu hết các lĩnh vực.',
    suNghiep: 'Năm bứt phá: đề xuất được duyệt, dự án được chọn, tên tuổi được nhắc đến. Đừng ngại nhận vai trò lớn hơn năng lực hiện tại một nấc — thời vận đang bù cho phần còn thiếu. Chỉ cần tránh kiêu binh vào lúc đỉnh cao quý 4.',
    taiLoc: 'Tài lộc vượng, cả chính tài lẫn lộc bất ngờ. Là năm hiếm hoi hợp cả đầu tư lẫn mở rộng — nhưng vượng tài càng cần kỷ luật: chốt lời theo kế hoạch, không để "được ăn cả".',
    tinhCam: 'Đào hoa sáng rực — người độc thân có thể gặp đúng người trong nửa đầu năm; người có đôi hợp cưới hỏi, sinh con trong năm lục hợp Thái Tuế.',
    sucKhoe: 'Năng lượng dồi dào nhưng lịch trình dày; đặt lịch nghỉ như đặt lịch họp, kẻo cuối năm hụt hơi đúng lúc cần tỏa sáng.',
    loiKhuyen: 'Thời vận là gió — thuyền vẫn phải tự chèo. Hãy đặt mục tiêu năm 2027 cao hơn thường lệ 30%, và nhớ chia lộc: năm hợp Thái Tuế làm việc thiện, lộc càng bền.',
  },
  'Mùi': {
    slug: 'mui', vat: 'Dê', quanHe: 'Năm tuổi — phạm Thái Tuế · tam tai cuối',
    tongQuan: 'Năm 2027 là năm tuổi của Mùi — phạm Thái Tuế trực tiếp, lại là năm tam tai cuối của nhóm Hợi–Mão–Mùi. Người xưa nói "Thái Tuế đương đầu tọa, vô hỷ khủng hữu họa": năm tuổi dễ biến động, nhưng cũng là năm "lột xác" — nhiều người nhìn lại thấy năm tuổi chính là bước ngoặt lớn nhất thập kỷ của mình.',
    suNghiep: 'Áp lực và cơ hội đến cùng lúc, thường dưới dạng thay đổi không do mình chọn: tái cơ cấu, đổi sếp, đổi địa bàn. Nguyên tắc năm tuổi: thích ứng nhanh nhưng cam kết chậm — nhận thay đổi, hoãn ký kết ràng buộc dài hạn đến cuối năm.',
    taiLoc: 'Giữ tiền quan trọng hơn kiếm tiền trong năm tuổi. Lập quỹ khẩn cấp 6 tháng chi tiêu, tránh mọi hình thức đầu tư mình chưa hiểu rõ. Chi lớn chủ động (sức khỏe, học hành) tốt hơn để tiền "tự đội nón ra đi".',
    tinhCam: 'Cảm xúc năm tuổi nhạy hơn thường lệ, dễ tủi thân và dễ nói lời làm tổn thương người gần nhất. "Hỷ sự hóa giải Thái Tuế" — cưới hỏi, thêm thành viên trong năm tuổi theo quan niệm dân gian lại là cách trấn vận tốt, miễn chọn ngày chu đáo.',
    sucKhoe: 'Ưu tiên số một của năm. Khám tổng quát đầu năm, xử lý dứt điểm các vấn đề nhỏ đang trì hoãn, và tuyệt đối cẩn thận khi di chuyển xa vào các tháng xung (tháng Chạp, tháng 6 âm).',
    loiKhuyen: 'Đầu năm lễ cúng Thái Tuế, cả năm sống chậm lại một nhịp. Năm tuổi không phải án phạt — nó là kỳ "bảo trì lớn" của vận trình: ai chịu dừng để sửa mình, sau năm Mùi sẽ chạy êm cả chặng dài.',
  },
  'Thân': {
    slug: 'than', vat: 'Khỉ', quanHe: 'Bình hòa với Thái Tuế',
    tongQuan: 'Tuổi Thân bước qua 2027 ở thế bình hòa, không vướng bận gì với Thái Tuế Mùi. Vận trình sáng dần theo thời gian trong năm — khởi đầu bình lặng nhưng càng về cuối càng nhiều tin vui, như thể năm Đinh Mùi đang "làm nóng máy" cho chính năm tuổi Thân 2028.',
    suNghiep: 'Sự lanh lẹ của tuổi Thân gặp đất diễn ở các việc cần xoay xở: xử lý khủng hoảng, mở thị trường mới, thử nghiệm sản phẩm. Nửa cuối năm có quý nhân tuổi Tý hoặc Thìn đưa đến cơ hội đáng giá.',
    taiLoc: 'Tiền vào từ nhiều nguồn nhỏ hơn là một khoản lớn — hợp mô hình "nhiều giỏ trứng". Cuối năm nên gom về, chốt sổ gọn để bước vào năm tuổi 2028 với tài chính rõ ràng.',
    tinhCam: 'Vui vẻ, nhiều mối quan tâm; người độc thân cẩn thận "bắt cá hai tay" không chủ đích vì quá đông người để ý. Chân thành chọn một là lộc tình cảm của năm.',
    sucKhoe: 'Tốt, chỉ cần để ý da liễu và dị ứng lúc giao mùa. Năm nay nên tạo thói quen sức khỏe mới — nó sẽ là lá chắn cho năm tuổi kế tiếp.',
    loiKhuyen: 'Dùng 2027 làm năm chuẩn bị chiến lược: trả bớt nợ, học kỹ năng, củng cố quan hệ. Bước vào năm tuổi 2028 với tay gọn nhẹ là lợi thế lớn nhất bạn có thể tự tặng mình.',
  },
  'Dậu': {
    slug: 'dau', vat: 'Gà', quanHe: 'Bình hòa với Thái Tuế',
    tongQuan: 'Năm 2027 tuổi Dậu thong dong: không xung hình hại, không tam tai, Thái Tuế Mùi lại là Thổ sinh Kim — bản khí tuổi Dậu được nuôi dưỡng ngầm. Một năm thuận cho cả công danh lẫn đời sống riêng, đặc biệt với người làm nghề cần sự chỉn chu, chi tiết.',
    suNghiep: 'Sự tỉ mỉ được trả công xứng đáng: các việc kiểm định, tài chính, kỹ thuật, sáng tạo nội dung đều hanh thông. Có thể được giao "dọn" một mảng đang bừa bộn — nhận đi, đó là bàn đạp thăng tiến của năm.',
    taiLoc: 'Chính tài vững, thêm lộc từ nghề tay trái nếu có. Hợp mua sắm tài sản giá trị bền (vàng, thiết bị làm nghề) hơn là tiêu sản.',
    tinhCam: 'Người độc thân có duyên với người quen cũ quay lại hoặc đồng nghiệp gần gũi. Người có đôi: bớt cầu toàn với nửa kia — "đúng ý mình" không quan trọng bằng "ấm nhà".',
    sucKhoe: 'Để ý họng, phổi (điểm yếu bản mệnh Kim) và tránh làm việc trong môi trường khói bụi kéo dài. Còn lại đều ổn.',
    loiKhuyen: 'Năm để tuổi Dậu làm sâu thay vì làm rộng: chọn 1-2 mục tiêu tinh, hoàn thiện đến mức xuất sắc — thành quả 2027 sẽ mang thương hiệu cá nhân rất rõ của bạn.',
  },
  'Tuất': {
    slug: 'tuat', vat: 'Chó', quanHe: 'Tam hình Thái Tuế (Sửu–Mùi–Tuất)',
    tongQuan: 'Tuổi Tuất năm 2027 vướng thế tam hình với Thái Tuế — kiểu trở ngại "hình" đặc trưng: không phải sóng lớn mà là ma sát ngầm trong các mối quan hệ, dễ vướng thị phi, hiểu lầm, giấy tờ pháp lý lằng nhằng. Vận trình khoảng 6/10 — vượt được phần "hình" thì phần còn lại của năm khá êm.',
    suNghiep: 'Nguyên tắc vàng: mọi thỏa thuận phải trên giấy. Tránh đứng giữa các phe trong cơ quan, tránh nhận lời "cầm hộ, ký hộ". Công việc chuyên môn thuần túy lại tiến triển tốt — càng ít dây vào chuyện người, năm càng thuận.',
    taiLoc: 'Tài chính trung bình khá; rủi ro nằm ở các khoản liên quan pháp lý (hợp đồng, thuế, tranh chấp). Chi một khoản cho tư vấn chuyên nghiệp khi cần — rẻ hơn nhiều so với sửa sai.',
    tinhCam: 'Dễ bị người ngoài "châm dầu" vào chuyện đôi lứa; quy tắc của năm là chuyện hai người chỉ giải quyết giữa hai người. Độc thân nên tránh vội vàng công khai mối quan hệ mới trong nửa đầu năm.',
    sucKhoe: 'Căng thẳng tinh thần là hao tổn chính — thiền, thể thao, hoặc đơn giản là bớt lướt mạng. Để ý dạ dày khi lo nghĩ nhiều.',
    loiKhuyen: 'Khẩu nghiệp là cửa dẫn "hình" vào nhà: năm nay nói ít, làm nhiều, tránh bình luận chuyện người khác kể cả trên mạng. Giữ được miệng là giữ được vận.',
  },
  'Hợi': {
    slug: 'hoi', vat: 'Lợn', quanHe: 'Tam hợp Thái Tuế · năm tam tai cuối',
    tongQuan: 'Giống tuổi Mão, tuổi Hợi năm 2027 vừa được tam hợp Thái Tuế nâng đỡ vừa đi năm tam tai cuối. Cán cân nghiêng về phía tích cực: quý nhân xuất hiện đúng lúc, cơ hội quay lại sau hai năm ì ạch — chỉ cần không lặp lại đúng những sai lầm của 2025–2026.',
    suNghiep: 'Các mối quan hệ cũ mang lại cơ hội mới: sếp cũ, đối tác cũ, bạn học cũ. Đừng ngại chủ động kết nối lại. Tam tai cuối nhắc: không thay đổi lớn cùng lúc (vừa đổi việc vừa chuyển nhà vừa đầu tư) — chọn một việc lớn duy nhất cho năm.',
    taiLoc: 'Dòng tiền phục hồi rõ; ưu tiên vá các "lỗ rò" cũ (nợ, khoản treo) trước khi mở kèo mới. Lộc tam hợp thường đến qua người khác — chia sẻ sòng phẳng thì lộc còn quay lại.',
    tinhCam: 'Ấm dần lên; các mối quan hệ được hàn gắn. Người độc thân dễ có duyên với người tuổi Mão hoặc Mùi — tam hợp gặp nhau tự nhiên hợp cạ.',
    sucKhoe: 'Cải thiện so với hai năm trước nhưng đừng buông thói quen tốt vừa gây dựng; chú ý cân nặng và mỡ máu khi tiệc tùng nhiều trở lại.',
    loiKhuyen: 'Năm 2027 là "cửa thoát" của tuổi Hợi: đi chậm, đi chắc, đi cùng người tin cậy. Qua năm nay, chặng 2028–2030 của bạn thênh thang hơn nhiều — đừng ngã ở mét cuối cùng.',
  },
};
