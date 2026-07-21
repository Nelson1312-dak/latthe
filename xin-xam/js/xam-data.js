/**
 * xin-xam/js/xam-data.js — 100 quẻ xăm, phỏng theo tinh thần Quan Âm linh xăm
 * truyền thống (điển cố thật, thơ tự biên theo ý xăm gốc — KHÔNG phải bản dịch
 * nguyên văn). Nội dung mang tính chiêm nghiệm & giải trí.
 *
 * hang: thuong-thuong | thuong-cat | trung-binh | ha | ha-ha
 * Phân bố: TT 15 · TC 25 · TB 38 · H 17 · HH 5 (theo tỷ lệ ống xăm truyền thống)
 */
const XAM_DATA = [
  {
    so: 1, ten: 'Khương Thái Công câu cá sông Vị', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Buông câu sông Vị đợi thời lai', 'Tám mươi tuổi hạc gặp chương đài', 'Người kiên chí cả trời không phụ', 'Công danh phú quý tự nhiên khai'],
    y: 'Xăm đại cát. Như Khương Tử Nha tám mươi tuổi còn gặp Văn Vương, người bền chí ắt được trọng dụng. Việc lớn đang chín muồi, chỉ cần giữ vững đạo tâm, thời cơ tự tìm đến.',
    dienco: 'Khương Thái Công ngồi câu bên sông Vị bằng lưỡi câu thẳng, không mồi — câu thời chứ không câu cá. Văn Vương nghe danh tìm đến, rước về phong làm Thượng phụ, mở nghiệp nhà Chu tám trăm năm.',
    linhvuc: { giadao: 'Nhà cửa yên vui, người trên kẻ dưới thuận hòa, có tin mừng về người lớn tuổi.', tailoc: 'Tài lộc đến muộn nhưng đến lớn, chớ nóng vội bán rẻ công sức.', tinhduyen: 'Duyên lành đã định, người chân thành sẽ gặp được người xứng đáng.', suckhoe: 'Bệnh cũ thuyên giảm, người già cần giữ ấm nhưng không đáng lo.' }
  },
  {
    so: 2, ten: 'Tô Tần khổ học thành danh', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Dùi mài kinh sử suốt canh thâu', 'Chích đùi giữ chí chẳng sờn đâu', 'Một mai sáu nước đeo tướng ấn', 'Khổ tận cam lai đứng đỉnh đầu'],
    y: 'Xăm tốt về đường công danh học vấn. Cái khổ hôm nay là vốn liếng ngày mai. Việc đang cầu phải qua giai đoạn mài giũa nữa mới thành, nhưng kết quả sẽ vượt mong đợi.',
    dienco: 'Tô Tần thuở hàn vi bị người nhà khinh rẻ, đêm đọc sách buồn ngủ lấy dùi chích vào đùi cho tỉnh. Sau thành thuyết khách lừng lẫy, đeo ấn tướng quốc của sáu nước hợp tung chống Tần.',
    linhvuc: { giadao: 'Trong nhà có người sắp thành đạt, hãy nâng đỡ thay vì trách móc.', tailoc: 'Tiền bạc còn eo hẹp một thời gian ngắn, sau đó hanh thông.', tinhduyen: 'Người đang xa cách sẽ nhìn nhận lại giá trị của bạn.', suckhoe: 'Chớ thức khuya quá độ, giữ sức mới đi được đường dài.' }
  },
  {
    so: 3, ten: 'Chiêu Quân xuất tái', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Gót ngọc rời cung vạn dặm xa', 'Tỳ bà ôm trọn mối sơn hà', 'Thân tuy đất khách lòng son sắt', 'Danh thơm hậu thế vượt phong ba'],
    y: 'Xăm trung bình, được mất song hành. Việc cầu phải chấp nhận đánh đổi — rời chỗ quen thuộc mới có cơ hội mới. Thiệt thòi trước mắt nhưng để lại giá trị lâu dài.',
    dienco: 'Vương Chiêu Quân, mỹ nhân đời Hán, tự nguyện sang đất Hồ hòa thân. Xa quê hương nhưng đổi lấy mấy chục năm biên cương yên ổn, tên tuổi lưu thơm sử sách.',
    linhvuc: { giadao: 'Có thể phải xa nhà hoặc có người trong nhà đi xa, là chuyện nên thuận theo.', tailoc: 'Tài lộc ở phương xa, tại chỗ khó cầu.', tinhduyen: 'Duyên phận có yếu tố xa cách, bền hay không do lòng người giữ.', suckhoe: 'Tâm bệnh nặng hơn thân bệnh, giải tỏa nỗi lòng thì khỏe.' }
  },
  {
    so: 4, ten: 'Ngu Cơ biệt Hạng Vương', hang: 'ha-ha', hangLabel: 'Hạ Hạ',
    tho: ['Trướng dạ ca tàn tiếng sáo ai', 'Anh hùng mạt lộ lệ tuôn dài', 'Gươm thiêng gãy giữa vòng vây hãm', 'Chớ đem sức mọn chống thiên tai'],
    y: 'Xăm xấu, cảnh anh hùng cùng đường. Việc đang cầu thế cục đã nghiêng, càng cố càng tổn thất. Nên chủ động thu quân, bảo toàn những gì còn giữ được, chờ vận sau.',
    dienco: 'Hạng Vũ bị vây ở Cai Hạ, bốn bề tiếng ca nước Sở. Ngu Cơ múa gươm vĩnh biệt rồi tự vẫn để chồng nhẹ lòng phá vây. Anh hùng cái thế cũng có lúc phải cúi đầu trước thời vận.',
    linhvuc: { giadao: 'Nhà có sóng gió, cần một người biết nhún nhường để giữ hòa khí.', tailoc: 'Kỵ đầu tư mạo hiểm, kỵ gỡ gạc — dừng lại là bớt lỗ.', tinhduyen: 'Mối duyên đang xét có nhiều nghịch cảnh, níu kéo thêm đau lòng.', suckhoe: 'Chú ý nghiêm túc, có bệnh phải khám ngay chớ chần chừ.' }
  },
  {
    so: 5, ten: 'Lưu Bị tam cố thảo lư', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Ba phen sương tuyết viếng lều tranh', 'Lòng thành lay động bậc cao minh', 'Rồng nằm một sớm tung mây dậy', 'Nghiệp lớn từ đây định đế thành'],
    y: 'Xăm tốt. Việc cầu không thể một lần mà được, phải kiên trì hạ mình cầu đến hai ba lần. Quý nhân khó tính nhưng một khi đã gật đầu thì tận tâm giúp đến cùng.',
    dienco: 'Lưu Bị ba lần đội mưa tuyết đến lều cỏ mời Gia Cát Lượng. Lòng thành cảm động Ngọa Long, từ đó có người vạch kế chia ba thiên hạ, dựng nên nhà Thục Hán.',
    linhvuc: { giadao: 'Muốn người nhà nghe theo, hãy lấy lòng thành thay vì áp đặt.', tailoc: 'Cầu tài phải nhờ đúng người dẫn mối, đừng ngại mở lời lần nữa.', tinhduyen: 'Chân thành theo đuổi ắt được đáp lại, một lần từ chối chưa phải hết.', suckhoe: 'Nên kiên trì theo một thầy một thuốc, đổi liên tục khó khỏi.' }
  },
  {
    so: 6, ten: 'Ngưu Lang Chức Nữ thất tịch', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Sông Ngân cách trở mối tơ duyên', 'Ô thước bắc cầu mỗi độ nguyên', 'Tương ngộ ngắn mà tình chẳng cạn', 'Xa nhau càng rõ nghĩa ưu phiền'],
    y: 'Xăm trung bình. Việc cầu có thành nhưng cách quãng, không được trọn vẹn liền mạch. Quý ở chỗ bền lòng — thứ gì phải chờ đợi mới có thường sâu đậm hơn thứ dễ dàng.',
    dienco: 'Ngưu Lang và Chức Nữ bị Thiên Hậu chia cắt hai bờ sông Ngân, mỗi năm chỉ được gặp nhau đêm mồng bảy tháng bảy nhờ đàn quạ bắc cầu.',
    linhvuc: { giadao: 'Người thân xa nhà, tin tức thưa nhưng tình cảm không nhạt.', tailoc: 'Thu nhập theo đợt, lúc có lúc không — cần biết tích lũy.', tinhduyen: 'Yêu xa hoặc ít gặp; giữ được lời hẹn thì bền lâu.', suckhoe: 'Bệnh tái đi tái lại theo mùa, phòng hơn chữa.' }
  },
  {
    so: 7, ten: 'Hàn Tín chịu nhục lòn trôn', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Chợ đông chịu nhục dưới chân người', 'Nuốt hận không hề đổi chí trai', 'Một sớm đăng đàn cầm ấn soái', 'Mới hay nhẫn nhịn chẳng hề sai'],
    y: 'Xăm trung bình thiên cát về sau. Hiện tại phải chịu điều khó nuốt, bị xem thường. Nhẫn được cái nhục nhỏ hôm nay thì gặt cái danh lớn mai sau; phản kháng lúc này chỉ thiệt thân.',
    dienco: 'Hàn Tín thuở hàn vi bị tên hàng thịt thách chui qua háng giữa chợ. Ông cúi mình chui qua, giữ mạng chờ thời — về sau thành đại tướng của Lưu Bang, được phong Sở Vương.',
    linhvuc: { giadao: 'Trong nhà có lời qua tiếng lại, nhịn một câu sóng yên bể lặng.', tailoc: 'Chưa phải lúc ra mặt tranh phần, giữ vốn chờ cơ hội.', tinhduyen: 'Bị hiểu lầm hoặc coi nhẹ — thời gian sẽ trả lại công bằng.', suckhoe: 'Sức khỏe ổn, chú ý dạ dày do uất khí.' }
  },
  {
    so: 8, ten: 'Đường Tăng thỉnh kinh Tây Trúc', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Muôn dặm đường xa hướng Phật đài', 'Chín chín nạn tai chẳng chuyển dời', 'Bền gan sắt đá qua sông lửa', 'Chân kinh cầm được rạng gương đời'],
    y: 'Xăm tốt cho việc lớn đường dài. Mục tiêu chính đáng nhưng thử thách nhiều lớp, không được nản giữa chừng. Đi đến cùng ắt viên mãn, lại có người phù trợ dọc đường.',
    dienco: 'Đường Huyền Trang vượt vạn dặm sang Tây Trúc thỉnh kinh, trải tám mươi mốt kiếp nạn. Nhờ đạo tâm kiên cố và các đồ đệ hộ trì, cuối cùng mang chân kinh về Đại Đường.',
    linhvuc: { giadao: 'Việc nhà nhiều mối bận nhưng gỡ dần từng việc sẽ xong.', tailoc: 'Dự án dài hơi mới là mỏ vàng; lợi nhanh chỉ là bọt nước.', tinhduyen: 'Tình cảm bị thử thách nhiều lần — vượt qua thì thành chính quả.', suckhoe: 'Đường ruột, ăn uống dọc đường cần cẩn thận.' }
  },
  {
    so: 9, ten: 'Trang Tử mộng hồ điệp', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Gối mộng thành bươm bướm lượn bay', 'Tỉnh ra chẳng biết bướm hay ai', 'Được thua thực ảo như sương khói', 'Lòng nhẹ thì hoa nở suốt ngày'],
    y: 'Xăm trung bình, thiên về buông xả. Việc đang cầu hư thực lẫn lộn, kỳ vọng có phần xa thực tế. Bớt cưỡng cầu thì tự khắc thấy đường; chấp nhất chỉ thêm mộng mị.',
    dienco: 'Trang Chu nằm mộng thấy mình hóa bướm, tỉnh dậy hoang mang không biết Trang Chu mộng hóa bướm hay bướm mộng hóa Trang Chu — ngụ ý được mất, thực ảo vốn không có ranh giới.',
    linhvuc: { giadao: 'Đừng so nhà mình với nhà người, hạnh phúc ở cách nhìn.', tailoc: 'Món lợi đang nhắm có phần ảo, xem kỹ giấy tờ thực hư.', tinhduyen: 'Đối phương khó nắm bắt; yêu người thật chứ đừng yêu hình bóng.', suckhoe: 'Mất ngủ, mộng nhiều — bớt nghĩ ngợi, tập thở buông lỏng.' }
  },
  {
    so: 10, ten: 'Bao Công xử án Trần Thế Mỹ', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Gương sáng treo cao giữa phủ đường', 'Long đao chẳng nể kẻ quyền vương', 'Oan tình một sớm phơi ra ánh', 'Công lý muôn đời vẫn tỏa hương'],
    y: 'Xăm tốt cho việc kiện tụng, minh oan, đòi công bằng. Điều khuất tất sắp được đưa ra ánh sáng, người ngay thẳng thắng thế. Cứ theo đường chính mà đi, có người cầm cân công tâm.',
    dienco: 'Trần Thế Mỹ đỗ trạng nguyên, bỏ vợ con để làm phò mã. Vợ là Tần Hương Liên lặn lội kêu oan, Bao Công bất chấp áp lực hoàng thân, khai đao trảm kẻ bạc nghĩa.',
    linhvuc: { giadao: 'Chuyện ấm ức trong nhà sẽ được phân xử rõ, người ngay không thiệt.', tailoc: 'Nợ khó đòi có cửa đòi được, giấy tờ hợp đồng là vũ khí.', tinhduyen: 'Kẻ hai lòng sẽ lộ mặt; người chung thủy được đền đáp.', suckhoe: 'Khám đúng bệnh viện lớn, có chẩn đoán rõ ràng thì yên tâm.' }
  },
  {
    so: 11, ten: 'Mạnh mẫu ba lần dời nhà', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Ba bận dời nhà chọn láng giềng', 'Vì con tìm chốn học đường bên', 'Cắt khung dệt dở răn con trẻ', 'Đất tốt ươm mầm phúc vững bền'],
    y: 'Xăm tốt, đặc biệt về chuyển dời và giáo dục. Thay đổi môi trường lúc này là đúng — chỗ mới hợp hơn chỗ cũ. Đầu tư cho học hành, cho con cái ắt không uổng.',
    dienco: 'Mẹ thầy Mạnh Tử ba lần chuyển nhà, từ cạnh nghĩa địa, cạnh chợ, đến cạnh trường học, để con được lớn lên trong môi trường tốt. Mạnh Tử sau thành bậc á thánh của Nho gia.',
    linhvuc: { giadao: 'Chuyển nhà, đổi chỗ ở lúc này là cát; con cái được nhờ.', tailoc: 'Tiền chi cho học hành, kỹ năng là khoản đầu tư lãi nhất.', tinhduyen: 'Môi trường mới mở ra mối duyên mới đáng trân trọng.', suckhoe: 'Đổi không khí, đổi nếp sinh hoạt thì bệnh vặt tự lui.' }
  },
  {
    so: 12, ten: 'Tái ông thất mã', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Ngựa lạc biên thùy chớ vội than', 'Ngựa về dắt bạn kéo theo đàn', 'Con ngã gãy chân thoát binh lửa', 'Họa phúc xoay vần mắt thế gian'],
    y: 'Xăm trung bình, họa phúc khó lường. Cái vừa mất chưa chắc là mất, cái vừa được chưa chắc là được. Gặp chuyện chớ vội mừng vội lo, cứ điềm nhiên mà ứng biến.',
    dienco: 'Ông lão ở biên ải mất ngựa, người ta chia buồn, ông nói "biết đâu là phúc". Ngựa về dắt theo ngựa quý; con trai cưỡi ngã gãy chân, nhưng nhờ vậy thoát chết khi trai tráng bị bắt lính.',
    linhvuc: { giadao: 'Chuyện không như ý trong nhà có thể là may mắn trá hình.', tailoc: 'Lỡ một thương vụ chưa hẳn thiệt — vụ đó có thể là hố sâu.', tinhduyen: 'Chia tay hay lỡ hẹn, hãy chờ xem — chưa phải kết cục.', suckhoe: 'Nhân chuyện nhỏ phát hiện sớm chuyện lớn, là may trong rủi.' }
  },
  {
    so: 13, ten: 'Vua Nghiêu nhường ngôi cho Thuấn', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Thiên hạ vì công chẳng vị nhà', 'Chọn người hiền đức trao sơn hà', 'Trời xanh soi thấu lòng son ấy', 'Vạn thuở thái bình khúc hoan ca'],
    y: 'Xăm đại cát. Việc cầu được người trên tin tưởng trao gửi trọng trách vượt kỳ vọng. Đức độ của bạn đã được nhìn nhận — cứ làm việc bằng cái tâm, phần thưởng tự đến.',
    dienco: 'Vua Nghiêu không truyền ngôi cho con mà chọn Thuấn — người cày ruộng chí hiếu, đức độ — để trao thiên hạ. Hai đời Nghiêu Thuấn thành biểu tượng thái bình thịnh trị muôn đời.',
    linhvuc: { giadao: 'Gia đình êm ấm hiếm có, là phúc phần nên biết gìn giữ.', tailoc: 'Được giao quản việc lớn, tiền tài đi kèm trách nhiệm.', tinhduyen: 'Gặp được người đức hạnh, đáng gửi gắm cả đời.', suckhoe: 'Khí sắc hồng hào, tinh thần thư thái, đại an.' }
  },
  {
    so: 14, ten: 'Bá Nha Tử Kỳ tri âm', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Non cao nước chảy tiếng đàn ngân', 'Một khúc mà nên nghĩa cố nhân', 'Tri kỷ đời người đâu dễ gặp', 'Gặp rồi xin trọng chớ phân vân'],
    y: 'Xăm tốt về nhân duyên gặp gỡ. Sắp gặp người hiểu mình sâu sắc — đối tác, bạn hữu hay tri kỷ. Mối quan hệ này quý hơn tiền bạc, nên dốc lòng vun đắp.',
    dienco: 'Du Bá Nha gảy đàn nghĩ đến núi cao, Chung Tử Kỳ khen "vòi vọi như Thái Sơn"; nghĩ đến nước chảy, Tử Kỳ khen "cuồn cuộn như sông dài". Tử Kỳ mất, Bá Nha đập đàn không gảy nữa.',
    linhvuc: { giadao: 'Trong nhà có người thật lòng hiểu bạn, hãy tâm sự nhiều hơn.', tailoc: 'Hợp tác với người hợp ý thì một vốn bốn lời.', tinhduyen: 'Duyên tri kỷ hiếm gặp đang ở rất gần, đừng để lỡ.', suckhoe: 'Tinh thần được chia sẻ thì thân bệnh cũng nhẹ đi.' }
  },
  {
    so: 15, ten: 'Tào Tháo hành quân khát nước', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Đường xa quân khát cổ khô ran', 'Chỉ hướng rừng mơ nói vọng vang', 'Nghĩ đến vị chua bừng sức bước', 'Cái khôn ứng biến vượt gian nan'],
    y: 'Xăm trung bình. Nguồn lực thực tế đang thiếu, phải dùng trí khéo léo động viên mình và người để vượt đoạn khó. Giải pháp tạm nhưng hữu hiệu; qua đoạn này phải bù đắp thật.',
    dienco: 'Tào Tháo hành quân giữa nắng hạn, quân sĩ khát lả. Ông chỉ về phía trước nói có rừng mơ chín, quân sĩ nghe nhắc vị chua, miệng ứa nước bọt, hăng hái đi tiếp tới nguồn nước.',
    linhvuc: { giadao: 'Lời động viên đúng lúc quý hơn tiền bạc lúc nhà khó khăn.', tailoc: 'Xoay dòng tiền tạm thời được, nhưng chớ để lời hứa thành nợ.', tinhduyen: 'Lời ngọt cho qua chuyện không nuôi được tình lâu dài.', suckhoe: 'Cơ thể đang gồng — bù nước, bù ngủ trước khi kiệt.' }
  },
  {
    so: 16, ten: 'Vương Tường nằm băng cầu cá chép', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Giữa đông cởi áo úp mình băng', 'Hiếu cảm trời cao chép hiện tầng', 'Một tấm lòng son trời đất chứng', 'Cầu gì cũng ứng phúc thêm phần'],
    y: 'Xăm tốt. Lòng thành đến mức cảm động trời đất thì việc khó mấy cũng có lối ra. Việc cầu tưởng bất khả thi nhưng sự chân thành tuyệt đối sẽ mở đường bất ngờ.',
    dienco: 'Vương Tường đời Tấn, mẹ kế giữa mùa đông đòi ăn cá tươi. Ông ra sông cởi áo nằm lên băng ủ cho tan; băng nứt, đôi cá chép nhảy lên. Là một trong Nhị thập tứ hiếu.',
    linhvuc: { giadao: 'Hiếu thuận với cha mẹ là gốc phúc của cả nhà lúc này.', tailoc: 'Tài lộc đến từ việc làm tử tế tưởng như thiệt thòi.', tinhduyen: 'Chân thành đến cùng sẽ làm tan chảy người băng giá nhất.', suckhoe: 'Kiêng lạnh, giữ ấm bụng và bàn chân.' }
  },
  {
    so: 17, ten: 'Trương Lương nhặt dép cầu thầy', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Cầu Dĩ ba phen nhặt chiếc hài', 'Nhún mình thờ lão chẳng đơn sai', 'Binh thư một quyển trao tay ngọc', 'Giúp Hán dựng nên nghiệp lớn dài'],
    y: 'Xăm tốt. Gặp người có vẻ khó chịu, thử thách lòng kiên nhẫn — nhưng đó chính là quý nhân cải mệnh. Chịu nhún, chịu khó vài lần, sẽ nhận được bí quyết thay đổi cuộc chơi.',
    dienco: 'Trương Lương gặp ông lão trên cầu Dĩ, bị sai nhặt dép ba lần rồi hẹn gặp lúc gà gáy. Qua được thử thách, ông lão Hoàng Thạch Công trao binh thư; nhờ đó Trương Lương giúp Lưu Bang dựng nhà Hán.',
    linhvuc: { giadao: 'Người lớn tuổi khó tính trong nhà chính là kho kinh nghiệm quý.', tailoc: 'Cơ hội tiền bạc đến từ người thầy, người đi trước — đừng tiếc công hầu hạ.', tinhduyen: 'Thử thách từ gia đình đối phương — nhẫn nại sẽ được chấp thuận.', suckhoe: 'Kiên trì theo liệu trình, dục tốc bất đạt.' }
  },
  {
    so: 18, ten: 'Tây Thi giặt lụa bến Trữ La', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Bến nước giặt là bóng nghiêng soi', 'Sắc nước nghiêng thành vận nước trôi', 'Hồng nhan là phúc hay là lụy', 'Giữ được lòng trong mới trọn đời'],
    y: 'Xăm trung bình. Có tài sắc, có lợi thế nổi bật, nhưng chính lợi thế ấy có thể cuốn vào vòng thị phi, toan tính của người khác. Được trọng dụng nhưng nên tự hỏi mình là quân cờ hay người chơi.',
    dienco: 'Tây Thi, người con gái giặt lụa ở Trữ La, được Việt Vương Câu Tiễn dâng cho Ngô Vương Phù Sai làm kế mỹ nhân. Nước Ngô vì nàng mà lơi việc nước, cuối cùng bị Việt diệt.',
    linhvuc: { giadao: 'Vẻ ngoài êm ấm nhưng có toan tính ngầm, để ý lời ra tiếng vào.', tailoc: 'Được mời gọi hấp dẫn — đọc kỹ xem ai thực sự hưởng lợi.', tinhduyen: 'Được săn đón nhiều, nhưng mấy ai thật lòng — cần thời gian thử.', suckhoe: 'Đẹp bên ngoài chưa chắc khỏe bên trong, nên khám tổng quát.' }
  },
  {
    so: 19, ten: 'Nhạc Phi tinh trung báo quốc', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Lưng khắc bốn châu dạ sắt son', 'Mười hai kim bài lệnh dập dồn', 'Phong Ba đình lạnh trung thần khuất', 'Trời để oan này hậu thế còn'],
    y: 'Xăm xấu. Người ngay bị kẻ gian cản trở, càng trung càng bị nghi. Việc cầu gặp tiểu nhân quyền thế chèn ép, thời điểm này khó minh oan — nên lui về giữ mình, lịch sử sẽ trả lại tên.',
    dienco: 'Nhạc Phi, danh tướng chống Kim, lưng khắc bốn chữ "tinh trung báo quốc". Đang thắng thì bị gian thần Tần Cối giả lệnh vua ban mười hai kim bài triệu về, rồi hãm hại ở đình Phong Ba.',
    linhvuc: { giadao: 'Lòng tốt trong nhà bị hiểu lầm — giải thích một lần rồi im lặng.', tailoc: 'Bị giành công, cướp mối — giữ bằng chứng, chưa phải lúc đối đầu.', tinhduyen: 'Có kẻ thứ ba gièm pha; tin nhau thì sống, nghe lời ngoài thì tan.', suckhoe: 'Uất ức hại gan, tim mạch — phải tìm chỗ xả cho bằng được.' }
  },
  {
    so: 20, ten: 'Đào viên kết nghĩa', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Vườn đào rượu chuốc kết tâm giao', 'Sống thác cùng nhau vẹn chí hào', 'Ba cội một lòng nên nghiệp lớn', 'Nghĩa tình muôn thuở ngát trăng sao'],
    y: 'Xăm đại cát về hợp tác, kết giao. Những người cùng chí hướng đang tụ về — liên minh lập lúc này bền vững cả đời. Việc chung sẽ thành nhờ chữ nghĩa đặt trên chữ lợi.',
    dienco: 'Lưu Bị, Quan Vũ, Trương Phi kết nghĩa anh em ở vườn đào, thề không sinh cùng ngày nhưng nguyện chết cùng ngày. Ba người nương nhau từ tay trắng dựng nên nhà Thục Hán.',
    linhvuc: { giadao: 'Anh em hòa thuận là lúc nhà hưng vượng nhất.', tailoc: 'Hùn hạp lúc này đại lợi, chọn người trọng nghĩa mà kết.', tinhduyen: 'Tình yêu bắt đầu từ tình bạn chí cốt — bền hơn sét đánh.', suckhoe: 'Có bạn đồng hành tập luyện thì sức khỏe đi lên rõ.' }
  },
  {
    so: 21, ten: 'Thôi Oanh Oanh chờ Trương Quân Thụy', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Mái tây chờ đợi ánh trăng thề', 'Thư gửi lòng theo mỗi hẹn về', 'Cách trở chưa phai màu giấy mực', 'Kiên tâm rồi vẹn ước phu thê'],
    y: 'Xăm trung bình thiên cát về tình duyên. Việc cầu phải qua giai đoạn chờ đợi, thư từ qua lại, có người ngăn trở. Nhưng hai lòng cùng giữ thì cuối cùng nên duyên, nên việc.',
    dienco: 'Chuyện Tây Sương Ký: Thôi Oanh Oanh và thư sinh Trương Quân Thụy yêu nhau, bị mẹ nàng ngăn cản, buộc chàng phải đỗ đạt mới cho cưới. Nhờ a hoàn Hồng Nương giúp, cuối cùng nên vợ chồng.',
    linhvuc: { giadao: 'Người lớn đang chưa ưng — cần thời gian và thành tích chứng minh.', tailoc: 'Khoản thu bị hẹn lần hẹn lữa nhưng sẽ về đủ.', tinhduyen: 'Có người mai mối nhiệt tình giúp; giữ lời hẹn là thành.', suckhoe: 'Nhớ nhung sinh mất ngủ, giữ nếp sinh hoạt điều độ.' }
  },
  {
    so: 22, ten: 'Ngũ Tử Tư qua ải Chiêu Quan', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Một đêm bạc trắng mái đầu xanh', 'Cửa ải trùng vây bước độc hành', 'Thoát hiểm rồi mang lòng hận cũ', 'Được thua cũng nhuộm máu sông tanh'],
    y: 'Xăm xấu. Đang ở thế bị truy đuổi, áp lực tứ phía, lo âu bạc đầu. Có đường thoát nhưng phải trả giá đắt; và cẩn thận — nuôi hận trả đũa sẽ kéo mình vào vòng xoáy không hồi kết.',
    dienco: 'Ngũ Tử Tư bị vua Sở giết cha và anh, chạy trốn qua ải Chiêu Quan, lo nghĩ đến mức một đêm tóc bạc trắng. Sau giúp Ngô phá Sở báo thù, nhưng cuối đời cũng chết vì lời gièm.',
    linhvuc: { giadao: 'Mâu thuẫn gia tộc sâu, đừng biến mình thành ngọn lửa lan.', tailoc: 'Đang bị siết nợ hoặc cạnh tranh rát — thoát thân trước, gỡ vốn sau.', tinhduyen: 'Rời khỏi mối quan hệ độc hại là thắng lợi, đừng ngoái lại.', suckhoe: 'Stress bào mòn nhanh, tóc rụng mất ngủ — nghỉ ngơi là mệnh lệnh.' }
  },
  {
    so: 23, ten: 'Tô Vũ chăn dê giữ tiết', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Tuyết trắng Bắc Hải cỏ không mầm', 'Cờ sứ trong tay mười chín năm', 'Đói khát không mòn lòng tiết tháo', 'Ngày về đầu bạc rạng thanh âm'],
    y: 'Xăm trung bình, khổ tận cam lai rất chậm. Hoàn cảnh cô độc, ít người hỗ trợ, thời gian thử thách dài hơn dự kiến nhiều. Nhưng ai giữ vững nguyên tắc sẽ về đích trong danh dự.',
    dienco: 'Tô Vũ đi sứ Hung Nô bị giữ lại, đày ra Bắc Hải chăn dê đực với lời "khi nào dê đực đẻ con mới được về". Mười chín năm ăn tuyết nuốt lông vẫn giữ cờ sứ, cuối cùng được về Hán trong vinh dự.',
    linhvuc: { giadao: 'Xa nhà lâu ngày, giữ liên lạc đều để người thân yên tâm.', tailoc: 'Thu nhập tối thiểu kéo dài — sống tối giản là vũ khí sinh tồn.', tinhduyen: 'Tình cảm bị thời gian và khoảng cách bào mòn, chỉ lòng chung thủy cứu được.', suckhoe: 'Thiếu chất, thiếu ấm lâu ngày — bồi bổ có kế hoạch.' }
  },
  {
    so: 24, ten: 'Chu Mãi Thần gánh củi đọc sách', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Vai củi lưng đèo quyển sách mang', 'Người cười ta đọc giữa non ngàn', 'Năm mươi tuổi ấy ơn vua chiếu', 'Áo gấm về quê rạng xóm làng'],
    y: 'Xăm tốt cho người khởi đầu muộn. Đừng để tuổi tác hay lời chê cười làm nản — công thành danh toại đến trễ nhưng chắc chắn. Cứ vừa mưu sinh vừa trau dồi, chiếu chỉ sẽ đến.',
    dienco: 'Chu Mãi Thần nhà nghèo, gánh củi vẫn treo sách trên đòn gánh mà đọc, vợ chê bỏ đi. Ngoài năm mươi tuổi được Hán Vũ Đế trọng dụng, làm thái thú áo gấm về quê.',
    linhvuc: { giadao: 'Người nhà chưa tin bạn — kết quả sẽ thay lời muốn nói.', tailoc: 'Nghề tay trái nuôi giấc mơ lớn; đừng bỏ cuộc giữa chừng.', tinhduyen: 'Ai rời bỏ lúc hàn vi sẽ tiếc; người đến sau trân trọng bạn hơn.', suckhoe: 'Lao lực kèm học hành — chia giờ nghỉ rõ ràng.' }
  },
  {
    so: 25, ten: 'Hằng Nga bôn nguyệt', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Trộm thuốc trường sinh nuốt vội vàng', 'Nhẹ mình bay tít tận cung Hằng', 'Quảng Hàn lạnh lẽo ôm cô quạnh', 'Được tiếng tiên mà mất thế gian'],
    y: 'Xăm xấu. Vì ham muốn chiếm riêng cái không thuộc phần mình mà đánh mất hạnh phúc đang có. Việc cầu nếu đạt bằng đường tắt sẽ đổi lấy cô đơn, hối tiếc lâu dài.',
    dienco: 'Hằng Nga lén nuốt thuốc trường sinh Tây Vương Mẫu ban cho chồng là Hậu Nghệ, thân bay lên cung trăng. Thành tiên nhưng đời đời ở lại Quảng Hàn lạnh lẽo, xa cách người thương.',
    linhvuc: { giadao: 'Đừng giành phần hơn với người nhà — được của mất tình.', tailoc: 'Món lợi chiếm riêng sẽ thành gánh nặng; minh bạch mới bền.', tinhduyen: 'Tham vọng cá nhân đang đẩy người thương ra xa.', suckhoe: 'Cẩn thận thuốc men không rõ nguồn gốc, đừng nghe mách bảo.' }
  },
  {
    so: 26, ten: 'Khổng Minh mượn gió đông', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Đàn cao thất tinh gió chưa về', 'Cờ phướn lặng im vạn kẻ chê', 'Một sớm đông phong bừng lửa đỏ', 'Xích Bích công thành vẹn ước thề'],
    y: 'Xăm đại cát. Mọi thứ đã chuẩn bị xong, chỉ thiếu đúng một điều kiện — và điều kiện ấy sắp đến đúng hẹn. Người ngoài chưa hiểu cứ nghi ngờ, mặc họ; thời cơ đến thì một trận định thắng thua.',
    dienco: 'Trận Xích Bích, hỏa công cần gió đông giữa mùa gió tây bắc. Khổng Minh lập đàn thất tinh "cầu gió", thực chất đã tính chắc ngày trở gió. Gió đông nổi, lửa cháy lan, tám mươi vạn quân Tào tan tành.',
    linhvuc: { giadao: 'Việc nhà đợi đúng dịp đoàn tụ sẽ giải quyết trọn một lần.', tailoc: 'Giữ hàng chờ đúng con nước — thời điểm là tất cả.', tinhduyen: 'Khoảnh khắc thuận lợi để tỏ bày sắp đến, chuẩn bị sẵn lòng.', suckhoe: 'Cơ thể sắp qua giai đoạn giao mùa, giữ gìn thêm ít bữa.' }
  },
  {
    so: 27, ten: 'Lã Vọng gặp thời phong hầu', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Sáu chục năm ròng chửa gặp minh quân', 'Chí lớn không phai giữa phong trần', 'Xe rước một chiều nghiêng thiên hạ', 'Muộn màng mà rực rỡ muôn phần'],
    y: 'Xăm tốt. Chờ đợi đã quá lâu, đến mức tưởng vô vọng — nhưng chính lúc này vận lớn mở. Điều sắp đến to hơn tất cả những gì đã lỡ. Tuổi tác, thâm niên là lợi thế chứ không phải gánh nặng.',
    dienco: 'Lã Vọng (tức Khương Tử Nha) nghèo khó đến già, ngoài sáu mươi vẫn chưa gặp thời. Văn Vương đi săn gặp ông bên sông Vị, mời lên xe cùng về, phong làm thầy — từ đó nhà Chu hưng thịnh.',
    linhvuc: { giadao: 'Người lớn tuổi trong nhà sắp có tin vui, chuyện mong đã lâu.', tailoc: 'Khoản đầu tư ủ lâu năm bắt đầu sinh trái ngọt.', tinhduyen: 'Duyên muộn mà đậm, người đến sau cùng là người ở lại.', suckhoe: 'Tuổi cao vẫn còn sức bền, chỉ cần điều độ là hưởng phúc dài.' }
  },
  {
    so: 28, ten: 'Trần Đoàn lão tổ ngủ say', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Núi Hoa gối đá giấc mơ màng', 'Trăm ngày một giấc mặc trần gian', 'Việc đời chưa tới đừng lay gọi', 'Ngủ đủ rồi ra ắt gặp vàng'],
    y: 'Xăm trung bình, chủ về chờ thời. Việc cầu chưa đến lúc, có cố lay cũng không dậy. Giai đoạn này nên dưỡng sức, học hỏi, tích lũy — hành động bây giờ là phí sức vô ích.',
    dienco: 'Trần Đoàn lão tổ tu trên núi Hoa Sơn, nổi tiếng với giấc ngủ trăm ngày. Ông từ chối ra làm quan nhiều lần, chờ đúng chân mệnh thiên tử Triệu Khuông Dận mới xuống núi chỉ điểm.',
    linhvuc: { giadao: 'Chuyện nhà chưa cần quyết ngay, để qua mùa này sẽ rõ.', tailoc: 'Tiền nên gửi chỗ an toàn mà ngủ, chưa phải lúc đánh thức.', tinhduyen: 'Duyên chưa chín, giục chín ép sẽ chát.', suckhoe: 'Ngủ đủ là thuốc bổ nhất lúc này, đừng tiếc giờ ngủ.' }
  },
  {
    so: 29, ten: 'Mộc Lan tòng quân thay cha', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Thay cha khoác giáp vượt quan san', 'Mười hai năm trận dạ không hàng', 'Về quê cởi giáp cài trâm ngọc', 'Hiếu dũng lưu danh khắp thế gian'],
    y: 'Xăm tốt. Gánh vác việc vốn không thuộc phần mình vì thương người thân — gánh nặng ấy sẽ thành vinh quang. Phụ nữ cầu xăm này càng ứng: bản lĩnh của bạn sắp khiến mọi người kinh ngạc.',
    dienco: 'Hoa Mộc Lan giả trai tòng quân thay cha già, chinh chiến mười hai năm lập công lớn. Vua ban thưởng, nàng chỉ xin về quê phụng dưỡng cha mẹ, đồng đội đến thăm mới biết là gái.',
    linhvuc: { giadao: 'Bạn đang là trụ cột thay ai đó — công sức này cả nhà đều ghi nhận.', tailoc: 'Nhận việc khó không ai dám nhận, phần thưởng xứng đáng theo sau.', tinhduyen: 'Người thương bạn vì nghị lực chứ không vì vẻ ngoài — đó là người thật.', suckhoe: 'Sức bền tốt bất ngờ, nhưng đừng quên mình cũng cần được chăm.' }
  },
  {
    so: 30, ten: 'Thúc Nha tiến cử Quản Trọng', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Bạn cũ từng chia lãi chẳng đều', 'Hiểu nhau nào tính thiệt hơn nhiều', 'Một lời tiến cử nghiêng thiên hạ', 'Quản Bào tình nghĩa đẹp muôn chiều'],
    y: 'Xăm tốt về được tiến cử, giới thiệu. Có người hiểu rõ cả ưu lẫn khuyết của bạn và vẫn hết lòng đề bạt. Việc cầu thành nhờ một lời nói giúp đúng chỗ — hãy trân trọng người bạn ấy.',
    dienco: 'Bào Thúc Nha buôn chung với Quản Trọng, bạn lấy phần hơn vẫn không trách vì biết bạn nghèo. Sau Thúc Nha tiến cử Quản Trọng làm tướng quốc thay mình, giúp Tề Hoàn Công nên nghiệp bá.',
    linhvuc: { giadao: 'Anh em bạn bè tốt như ruột thịt, có việc cứ mở lời.', tailoc: 'Mối làm ăn qua giới thiệu đáng tin hơn tự tìm.', tinhduyen: 'Người quen mai mối lần này rất đáng gặp.', suckhoe: 'Nghe lời khuyên của người từng trải bệnh tương tự.' }
  },
  {
    so: 31, ten: 'Chử Đồng Tử gặp Tiên Dung', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Bãi cát che thân phận khó nghèo', 'Thuyền rồng đâu ngỡ ghé nơi neo', 'Trời xe duyên ấy nên giai ngẫu', 'Phúc lộc theo nhau đến vạn chiều'],
    y: 'Xăm đại cát, nhất là cầu duyên và đổi vận. Đang ở đáy của khốn khó thì vận may từ trên trời rơi xuống — cuộc gặp định mệnh thay đổi cả đời. Cứ sống lương thiện, phúc tự tìm đến tận nơi.',
    dienco: 'Chử Đồng Tử nghèo đến mức không có khố che thân, vùi mình trong cát. Công chúa Tiên Dung ghé bãi tắm, màn quây đúng chỗ chàng nấp. Cho là duyên trời, nàng kết hôn cùng chàng; sau hai người đắc đạo, thành một trong Tứ bất tử.',
    linhvuc: { giadao: 'Nhà nghèo mà có đức, phúc sắp gõ cửa bất ngờ.', tailoc: 'Lộc trời cho không hẹn trước — cứ chăm chỉ là hứng trọn.', tinhduyen: 'Duyên trời định, chênh lệch mấy cũng nên đôi.', suckhoe: 'Vượng khí đang lên, bệnh cũ lui dần.' }
  },
  {
    so: 32, ten: 'Thạch Sanh chém chằn tinh', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Gốc đa nghèo khó vững lòng ngay', 'Chém mãng xà tinh cứu mạng người', 'Kẻ cướp công kia rồi đền tội', 'Cây đàn thần vọng thấu cung mây'],
    y: 'Xăm tốt cho người ngay bị cướp công. Bạn làm thật, người khác nhận thưởng — nhưng đừng nản: sự thật như tiếng đàn trong ngục, kiểu gì cũng vọng đến tai người cần nghe. Công sẽ về đúng chủ.',
    dienco: 'Thạch Sanh chém chằn tinh, bắn đại bàng cứu công chúa, đều bị Lý Thông cướp công. Đến khi tiếng đàn trong ngục tố nỗi oan, công chúa nhận ra ân nhân, Lý Thông bị trời trừng phạt.',
    linhvuc: { giadao: 'Người hiền trong nhà đang chịu thiệt, sắp được minh oan.', tailoc: 'Hợp đồng, công trạng cần giấy trắng mực đen từ nay.', tinhduyen: 'Người ta sẽ nhận ra ai mới là thật lòng, kiên nhẫn thêm chút.', suckhoe: 'Làm phúc gặp lành, tinh thần thanh thản là thuốc quý.' }
  },
  {
    so: 33, ten: 'Tấm Cám — thử hài dự hội', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Cá bống nuôi nấng thuở gian truân', 'Hội mở hài rơi lối ngựa dừng', 'Chân ngọc vừa in duyên đã định', 'Qua bao hóa kiếp lại thành xuân'],
    y: 'Xăm tốt. Bị chèn ép, bị giành giật nhưng phúc phận của bạn không ai lấy được — đánh rơi cũng có người nhặt trả về đúng lúc. Qua mấy lần "hóa kiếp" thử thách, vị trí xứng đáng vẫn là của bạn.',
    dienco: 'Cô Tấm bị mẹ con Cám hãm hại hết lần này lượt khác, hóa chim vàng anh, cây xoan, khung cửi, quả thị — nhưng nhờ ăn ở hiền lành, cuối cùng vẫn trở lại làm hoàng hậu.',
    linhvuc: { giadao: 'Có người ganh trong họ hàng, sống tử tế là khiên chắn tốt nhất.', tailoc: 'Của rơi của mất sẽ quay về theo cách không ngờ.', tinhduyen: 'Chính duyên khó đoạt — người đúng sẽ nhận ra bạn giữa đám đông.', suckhoe: 'Qua đợt yếu này cơ thể tự phục hồi mạnh mẽ.' }
  },
  {
    so: 34, ten: 'Ông Táo về trời tâu chuyện', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Cưỡi chép về chầu tấu Ngọc Hoàng', 'Chuyện nhà năm cũ đủ đôi hàng', 'Lành thưa dữ báo không thiên vị', 'Ăn ở sao cho sổ sách sang'],
    y: 'Xăm trung bình, mang tính nhắc nhở. Mọi việc làm đều đang được "ghi sổ" — người trên, cấp trên biết nhiều hơn bạn tưởng. Cuối kỳ sẽ có tổng kết thưởng phạt phân minh; còn kịp sửa từ hôm nay.',
    dienco: 'Hằng năm ngày 23 tháng Chạp, Táo Quân cưỡi cá chép về trời tâu với Ngọc Hoàng chuyện tốt xấu của gia chủ trong năm. Nhà nhà cúng tiễn, mong Táo nói giảm điều dở, tâu thêm điều lành.',
    linhvuc: { giadao: 'Trong nhà có "tai mắt" vô hình — lời nói lúc nóng giận cũng thành dấu vết.', tailoc: 'Sổ sách minh bạch thì cuối năm ăn ngon ngủ yên.', tinhduyen: 'Đối xử với người ta thế nào, người xung quanh đều thấy cả.', suckhoe: 'Đến kỳ khám định kỳ rồi, đừng khất nữa.' }
  },
  {
    so: 35, ten: 'Sơn Tinh Thủy Tinh tranh hôn', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Voi chín ngà dâng lễ sớm mai', 'Kẻ sau dâng sóng ngập non đoài', 'Hằng năm nước réo cơn ghen cũ', 'Tranh đoạt còn vương hận tháng ngày'],
    y: 'Xăm xấu về cạnh tranh. Việc cầu có đối thủ mạnh và dai dẳng; dù thắng keo này, đối thủ vẫn quay lại quấy phá định kỳ. Thắng nhờ nhanh chân là chưa đủ — phải xây "núi cao" phòng thủ lâu dài.',
    dienco: 'Vua Hùng kén rể cho Mỵ Nương. Sơn Tinh mang lễ đến trước rước dâu, Thủy Tinh đến sau nổi giận dâng nước đánh. Sơn Tinh dời núi chặn nước; từ đó năm nào Thủy Tinh cũng dâng lũ báo thù.',
    linhvuc: { giadao: 'Tranh chấp tài sản, đất đai dai dẳng — cần giấy tờ pháp lý vững.', tailoc: 'Thị trường có kẻ phá giá quyết liệt, đấu lâu dài bằng chất lượng.', tinhduyen: 'Tình tay ba căng thẳng; chọn dứt khoát và giữ vững lựa chọn.', suckhoe: 'Bệnh theo mùa nước, chú ý gan mật và nguồn nước sạch.' }
  },
  {
    so: 36, ten: 'Từ Thức gặp tiên', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Động tiên một bước lạc trần duyên', 'Nửa khắc thiên thai nửa kiếp miền', 'Về lại làng xưa người đã khác', 'Sướng vui nào giữ được lâu bền'],
    y: 'Xăm trung bình thiên hạ. Đang có khoảng thời gian sung sướng như mơ — nhưng coi chừng nó làm bạn lỡ nhịp với đời thực. Vui chơi có chừng mực, quay về sớm còn kịp; đắm chìm quá thì mất chỗ đứng cũ.',
    dienco: 'Từ Thức từ quan ngao du, lạc vào động tiên lấy nàng Giáng Hương. Một năm tiên giới bằng trăm năm trần thế; khi nhớ nhà xin về thì làng xưa đã mấy đời, thành người không chốn nương.',
    linhvuc: { giadao: 'Mải việc riêng quên việc nhà — về sớm kẻo người thân tủi.', tailoc: 'Khoản lời dễ dàng đang ru ngủ; chốt lời sớm, đừng tham hiệp cuối.', tinhduyen: 'Tình cảm như mơ nhưng thiếu nền thực tế — kéo nhau về mặt đất.', suckhoe: 'Chơi bời thức khuya bào sức, cơ thể đòi nợ nhanh lắm.' }
  },
  {
    so: 37, ten: 'Quan Vũ qua năm ải chém sáu tướng', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Một đao một ngựa vượt quan hà', 'Năm ải băng băng chẳng nể tà', 'Lòng đã hướng về nơi cố chủ', 'Ai người cản nổi bước trung nga'],
    y: 'Xăm tốt cho việc vượt rào cản. Đường đi có năm bảy cửa ải, cửa nào cũng có kẻ gây khó — nhưng khi mục tiêu chính đáng và ý chí sắt đá thì không ai cản nổi. Cứ đi thẳng, danh chính ngôn thuận.',
    dienco: 'Quan Vũ tạm hàng Tào Tháo, nghe tin Lưu Bị liền treo ấn gói vàng, hộ tống hai chị dâu vượt năm cửa ải, chém sáu tướng cản đường để về với cố chủ. Tào Tháo cũng phải phục mà cho đi.',
    linhvuc: { giadao: 'Thủ tục giấy tờ nhà cửa nhiều cửa nhưng cửa nào cũng qua được.', tailoc: 'Đàm phán nhiều vòng, giữ vững giá trị cốt lõi thì chốt được.', tinhduyen: 'Vượt được sự ngăn cản của nhiều phía nếu lòng đủ kiên định.', suckhoe: 'Sức khỏe hồi phục qua từng "cửa ải" điều trị, đừng bỏ giữa chừng.' }
  },
  {
    so: 38, ten: 'Đỗ Phủ mài mực chờ khoa', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Tài cao mà phận vẫn long đong', 'Thi cử lận đận chửa thỏa lòng', 'Câu chữ nghìn năm còn để lại', 'Hơn thua một khoa bảng hư không'],
    y: 'Xăm trung bình. Thi cử, xét duyệt đợt này chưa như ý dù thực lực có thừa — hệ thống đánh giá chưa nhìn ra bạn. Nhưng giá trị thật không nằm ở một kỳ thi; cứ trau dồi, đường dài mới thấy ai bền.',
    dienco: 'Đỗ Phủ, thi thánh đời Đường, tài cao học rộng nhưng lận đận khoa cử, cả đời nghèo khó phiêu bạt. Vậy mà thơ ông sống mãi nghìn năm, được tôn là "thi sử" của muôn đời.',
    linhvuc: { giadao: 'Con cái thi cử chưa đạt kỳ vọng — đồng hành thay vì trách mắng.', tailoc: 'Hồ sơ xin xét duyệt bị chậm, chuẩn bị phương án dự phòng.', tinhduyen: 'Chưa được gia đình đối phương "chấm" — giá trị của bạn cần thời gian.', suckhoe: 'Áp lực thi cử hại dạ dày và giấc ngủ, học có giờ giấc.' }
  },
  {
    so: 39, ten: 'Bà Trưng phất cờ khởi nghĩa', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Nợ nước thù nhà một gánh mang', 'Voi gầm Mê Linh dậy cờ vàng', 'Sáu lăm thành quách theo về hết', 'Gái Việt nghìn thu rạng sử vàng'],
    y: 'Xăm đại cát cho việc khởi sự, đứng ra làm chủ. Thời thế đang cần một người dám đứng dậy — và người đó là bạn. Cất tiếng đúng lúc này sẽ được hưởng ứng đông đảo bất ngờ, thành công vang dội.',
    dienco: 'Hai Bà Trưng phất cờ khởi nghĩa ở Mê Linh trả nợ nước thù nhà, sáu mươi lăm thành trì hưởng ứng theo về, đuổi thái thú Tô Định, xưng vương — trang sử vàng của phụ nữ Việt.',
    linhvuc: { giadao: 'Bạn là người đứng mũi chịu sào — cả nhà sẽ theo một lòng.', tailoc: 'Khởi nghiệp, ra riêng lúc này được thiên thời địa lợi nhân hòa.', tinhduyen: 'Chủ động ngỏ lời — sự dứt khoát của bạn chính là sức hút.', suckhoe: 'Khí thế đang vượng, duy trì vận động để giữ lửa.' }
  },
  {
    so: 40, ten: 'Kinh Kha thích Tần', hang: 'ha-ha', hangLabel: 'Hạ Hạ',
    tho: ['Sông Dịch gió lùa buốt tiếng ca', 'Tráng sĩ ra đi chẳng lại nhà', 'Chủy thủ trong tay đồ sự lỡ', 'Liều thân một chuyến hận muôn xa'],
    y: 'Xăm rất xấu. Kế hoạch mang tính "được ăn cả ngã về không" này gần như chắc chắn thất bại, mà thất bại là mất trắng không đường lui. Dù quyết tâm bi tráng đến đâu, hãy dừng lại — còn người là còn của.',
    dienco: 'Kinh Kha sang Tần hành thích Tần Thủy Hoàng, bên sông Dịch hát "Gió hiu hắt chừ sông Dịch lạnh, tráng sĩ ra đi chừ không trở về". Dao găm giấu trong bản đồ lộ ra, việc bại, thân chết, nước Yên bị diệt nhanh hơn.',
    linhvuc: { giadao: 'Quyết định nóng vội kiểu "một mất một còn" sẽ kéo cả nhà xuống.', tailoc: 'Tuyệt đối không all-in, không vay nóng đánh cược.', tinhduyen: 'Tối hậu thư lúc này sẽ nhận về kết cục không mong muốn.', suckhoe: 'Kỵ liều lĩnh vận động quá sức, kỵ tự ý điều trị mạnh tay.' }
  },
  {
    so: 41, ten: 'Ngọc Hoàng thử lòng Thần Bếp', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Áo gấm hay tro cũng một lòng', 'Giàu nghèo thử mãi mới hay trong', 'Đèn trời soi tận từng ngăn bếp', 'Của nả không qua được chữ đồng'],
    y: 'Xăm trung bình, chủ về bị thử thách lòng dạ. Giai đoạn này người trên, đối tác đang âm thầm quan sát cách bạn ứng xử khi được và khi mất. Cứ trước sau như một — đó là bài kiểm tra duy nhất.',
    dienco: 'Tục kể Ngọc Hoàng thường sai chư tiên giả dạng kẻ nghèo hèn xuống trần thử lòng người. Ai giữ được thiện tâm cả khi không ai nhìn thấy mới được ghi phúc vào sổ trời.',
    linhvuc: { giadao: 'Đối xử với người giúp việc, người dưới thế nào, phúc họa theo đó.', tailoc: 'Món hời đến kèm phép thử đạo đức — chọn sạch thì bền.', tinhduyen: 'Người ta đang lặng lẽ xem bạn cư xử với cha mẹ, với người phục vụ.', suckhoe: 'Tâm an thì thân an, đừng để lòng dạ thấp thỏm.' }
  },
  {
    so: 42, ten: 'Lưu Nguyễn nhập Thiên Thai', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Hái thuốc non xanh lạc suối đào', 'Gặp tiên kết mối phút tơ trao', 'Nửa năm chốn ấy trần gian mấy', 'Ngoảnh lại quê nhà hóa chiêm bao'],
    y: 'Xăm trung bình. Cơ hội hưởng thụ, chuyến đi xa hay mối tình đẹp đang mở ra — nhưng có giá của nó là lỡ nhịp những thứ ở nhà. Cân nhắc kỹ trước khi bước vào, và hẹn ngày về rõ ràng.',
    dienco: 'Lưu Thần, Nguyễn Triệu đời Hán vào núi Thiên Thai hái thuốc, lạc đến động tiên, kết duyên cùng hai tiên nữ. Nửa năm về thăm quê thì đã qua bảy đời người, trở lại tìm động tiên thì mây khói mịt mù.',
    linhvuc: { giadao: 'Đi xa lâu ngày nhớ giữ mối liên hệ, kẻo về thành người lạ.', tailoc: 'Cơ hội ở xứ xa hấp dẫn nhưng tính cả chi phí "tái hòa nhập".', tinhduyen: 'Mối tình đẹp như mơ — hỏi mình sống được với nó ngoài đời không.', suckhoe: 'Thay đổi môi trường tốt cho tinh thần, đi có lịch trình.' }
  },
  {
    so: 43, ten: 'Trạng Quỳnh dâng "đại phong"', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Món lạ dâng vua chữ hiểm hóc', 'Đại phong là gió đổ chùa xiêu', 'Tượng lo tương lộn cười ra nước', 'Trí khôn một mẹo đáng trăm điều'],
    y: 'Xăm trung bình, chủ về đấu trí. Đối phương mạnh hơn về quyền thế, đừng đấu sức — hãy đấu bằng sự dí dỏm, khéo léo, lách qua khe cửa hẹp. Mẹo nhỏ đúng lúc gỡ được thế bí lớn.',
    dienco: 'Trạng Quỳnh dâng chúa món "đại phong" khiến chúa tò mò. Giải rằng: đại phong là gió to, gió to đổ chùa, đổ chùa tượng lo, tượng lo là lọ tương — món ăn dân dã mà chúa ăn thấy ngon vì đói.',
    linhvuc: { giadao: 'Chuyện khó nói trong nhà, nói bằng câu đùa khéo lại xong.', tailoc: 'Sản phẩm bình dân đóng gói khéo thành hàng độc — marketing là vua.', tinhduyen: 'Sự hài hước là vũ khí tán tỉnh lợi hại nhất của bạn lúc này.', suckhoe: 'Một nụ cười bằng mười thang thuốc bổ, đúng nghĩa đen.' }
  },
  {
    so: 44, ten: 'Vua Lê trả gươm rùa thần', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Gươm báu mười năm định giặc thù', 'Hồ xanh rùa hiện đón gươm thu', 'Vật thiêng về chốn khi tròn phận', 'Biết đủ là gương sáng vạn thu'],
    y: 'Xăm tốt, chủ về công thành thân thoái. Việc lớn đã xong hoặc sắp xong — điều nên làm bây giờ là "trả gươm": buông đúng lúc, trả lại những gì đã mượn, khép giai đoạn cũ trong danh dự để mở vận mới.',
    dienco: 'Lê Lợi được rùa thần cho mượn gươm báu đánh đuổi giặc Minh. Thái bình rồi, vua dạo hồ Tả Vọng, rùa vàng nổi lên đòi gươm; gươm bay về miệng rùa lặn xuống — hồ mang tên Hoàn Kiếm từ đó.',
    linhvuc: { giadao: 'Của mượn của gửi nên hoàn trả sòng phẳng, nhà cửa nhẹ nhõm.', tailoc: 'Chốt lời, tất toán đúng đỉnh — tham thêm là mất duyên tiền.', tinhduyen: 'Mối cũ đã trọn vai trò của nó, buông trong biết ơn để đón mới.', suckhoe: 'Xong đợt gắng sức, phải cho cơ thể "trả gươm" nghỉ ngơi.' }
  },
  {
    so: 45, ten: 'Trọng Thủy Mỵ Châu — nỏ thần', hang: 'ha-ha', hangLabel: 'Hạ Hạ',
    tho: ['Lông ngỗng rắc đường ai oán ai', 'Nỏ thần trao nhẹ mất thành dài', 'Tin người chẳng xét nên cơ sự', 'Giếng ngọc còn soi hận vạn ngày'],
    y: 'Xăm rất xấu, chủ về bị phản bội vì cả tin. Người đầu ấp tay gối, đối tác thân tín có thể chính là lỗ rò làm mất "nỏ thần" — bí mật, tài sản cốt lõi của bạn. Rà soát ngay ai đang nắm gì; tình cảm không thay được kiểm chứng.',
    dienco: 'An Dương Vương có nỏ thần giữ nước, gả Mỵ Châu cho Trọng Thủy — con trai Triệu Đà. Trọng Thủy dỗ vợ cho xem rồi tráo lẫy nỏ; Triệu Đà tiến đánh, thành mất, vua chém con gái rồi xuống biển.',
    linhvuc: { giadao: 'Chuyện trong nhà lọt ra ngoài — xem lại người ra vào thân cận.', tailoc: 'Bí mật kinh doanh, mật khẩu tài khoản phải đổi và siết ngay.', tinhduyen: 'Yêu là cho nhưng không phải cho cả chìa khóa két — tỉnh táo.', suckhoe: 'Đừng giao sức khỏe cho lời mách không kiểm chứng.' }
  },
  {
    so: 46, ten: 'Phạm Lãi rong thuyền Ngũ Hồ', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Giúp Việt phục thù nghiệp đã thành', 'Không màng khanh tướng bỏ đô thành', 'Ngũ Hồ một lá thuyền thong thả', 'Ba bận gom vàng lại phát nhanh'],
    y: 'Xăm tốt. Biết tiến biết lui đúng lúc là đại trí — rời vị trí cũ khi đỉnh cao không phải mất mà là thoát nạn. Chuyển hướng sang con đường mới sẽ còn phát đạt hơn con đường cũ.',
    dienco: 'Phạm Lãi giúp Câu Tiễn diệt Ngô xong liền treo ấn từ quan, biết vua chỉ chung hoạn nạn không chung phú quý. Ông rong thuyền Ngũ Hồ, ba lần buôn thành cự phú, ba lần đem của chia người nghèo — hiệu Đào Chu Công.',
    linhvuc: { giadao: 'Rút khỏi cuộc tranh giành gia sản là giữ được cả tình lẫn phúc.', tailoc: 'Nghỉ việc ra làm ăn riêng — số bạn buôn bán phát tài.', tinhduyen: 'Rời mối quan hệ đã cạn đúng lúc, cửa hạnh phúc khác đang mở.', suckhoe: 'Đổi lối sống lành mạnh lúc này, về sau khỏe hưởng dài.' }
  },
  {
    so: 47, ten: 'Bà Triệu cưỡi voi đánh giặc', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Chẳng cam cúi mặt phận tỳ nô', 'Cưỡi sóng chém kình giữa biển to', 'Voi trắng một ngà vang trận mạc', 'Chí lớn nghìn thu gái đất Ngô'],
    y: 'Xăm tốt cho chí lớn không cam phận. Đừng để ai đóng khung bạn vào vai nhỏ bé — khí phách "cưỡi cơn gió mạnh, đạp luồng sóng dữ" trong bạn đang trỗi dậy đúng lúc. Dám nghĩ lớn thì trời trao việc lớn.',
    dienco: 'Bà Triệu Thị Trinh nói câu bất hủ: "Tôi muốn cưỡi cơn gió mạnh, đạp luồng sóng dữ, chém cá kình ở biển Đông... chứ không chịu khom lưng làm tỳ thiếp cho người". Bà cưỡi voi trắng một ngà, lãnh đạo nghĩa quân chống Đông Ngô.',
    linhvuc: { giadao: 'Đừng để định kiến "phận con gái/phận em út" trói chân trong nhà.', tailoc: 'Nghĩ lớn làm lớn — kế hoạch tham vọng lúc này được ủng hộ.', tinhduyen: 'Người xứng với bạn phải nể chí bạn, không phải muốn bạn nhỏ lại.', suckhoe: 'Năng lượng dồi dào, hợp môn thể thao mạnh.' }
  },
  {
    so: 48, ten: 'Nghêu sò tranh nhau, ngư ông đắc lợi', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Cò mổ trai kìm giữa bãi sông', 'Hai bên găng mãi chẳng ai buông', 'Ngư ông chèo tới thu về giỏ', 'Tranh chấp dai lâu thiệt cả dòng'],
    y: 'Xăm xấu về tranh chấp. Bạn và đối thủ đang ghì chặt nhau, không ai chịu nhả — trong khi kẻ thứ ba đứng ngoài chờ hốt trọn. Ai tỉnh trước, buông trước, người đó thoát; càng găng càng dâng lợi cho người ngoài.',
    dienco: 'Con trai há miệng phơi nắng, cò sà xuống mổ, trai kẹp chặt mỏ cò. Hai bên giằng co không ai chịu buông, ông chài đi qua tóm gọn cả đôi bỏ giỏ — điển tích "bạng duật tương trì, ngư ông đắc lợi".',
    linhvuc: { giadao: 'Anh em kiện tụng nhau chỉ béo người ngoài — ngồi lại chia cho xong.', tailoc: 'Cuộc chiến giá cả hai bên cùng lỗ, kẻ thứ ba chiếm thị trường.', tinhduyen: 'Hai người giành nhau một bóng hình, người thứ ba ung dung đến sau.', suckhoe: 'Căng thẳng đấu đá bào mòn sức — ai buông trước khỏe trước.' }
  },
  {
    so: 49, ten: 'Mai An Tiêm trồng dưa đảo hoang', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Đảo vắng tay không chẳng oán trời', 'Hạt dưa chim thả hóa xanh khơi', 'Của mình tay tạo là hơn cả', 'Sóng đẩy thuyền vua lại rước mời'],
    y: 'Xăm tốt cho người bị đẩy vào thế khó. Bị cắt hết chỗ dựa, bị đày ra "đảo hoang" — chính là lúc chứng minh "của biếu là của lo, của cho là của nợ, của mình làm ra mới bền". Tự lực rồi sẽ được phục vị vẻ vang.',
    dienco: 'Mai An Tiêm vì câu nói tự lực bị vua Hùng đày ra đảo hoang. Chàng trồng giống dưa lạ chim thả xuống, khắc chữ thả biển làm tin. Dưa hấu đến tay vua, vua hiểu ra, rước gia đình chàng trở về.',
    linhvuc: { giadao: 'Ra riêng tay trắng vẫn dựng được cơ ngơi, đừng sợ.', tailoc: 'Sản phẩm tự tay làm ra chính là "giống dưa quý" đổi vận.', tinhduyen: 'Không cần môn đăng hộ đối — hai bàn tay xây tổ ấm được nể trọng.', suckhoe: 'Tự rèn nếp sống kỷ luật, cơ thể đền đáp thấy rõ.' }
  },
  {
    so: 50, ten: 'Lang Liêu dâng bánh chưng bánh giầy', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Các anh sơn hào với hải trân', 'Riêng em gạo nếp quyện tình dân', 'Trời tròn đất vuông tâm ý gói', 'Ngôi báu về tay kẻ chí chân'],
    y: 'Xăm đại cát. Đừng chạy đua bằng sự hào nhoáng — hãy thắng bằng sự chân thành, mộc mạc và ý nghĩa sâu sắc. Thứ giản dị nhất mà chứa đựng tâm huyết sẽ vượt qua mọi đối thủ xa hoa.',
    dienco: 'Vua Hùng truyền ai dâng lễ vật ý nghĩa nhất được nối ngôi. Các hoàng tử tìm sơn hào hải vị; Lang Liêu nghèo được thần mách, làm bánh chưng vuông tượng đất, bánh giầy tròn tượng trời — và được truyền ngôi.',
    linhvuc: { giadao: 'Bữa cơm nhà giản dị gắn kết hơn tiệc tùng linh đình.', tailoc: 'Sản phẩm mộc mạc đánh trúng lòng người thắng hàng xa xỉ.', tinhduyen: 'Món quà tự tay làm giá trị hơn quà đắt tiền gấp bội.', suckhoe: 'Ăn uống đạm bạc đúng chất quê nhà, bụng dạ êm ru.' }
  },
  {
    so: 51, ten: 'Thánh Gióng vươn vai đánh giặc', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Ba năm chẳng nói chẳng cười chi', 'Nghe hịch vươn vai hóa tướng uy', 'Ngựa sắt phun trào tre cũng trận', 'Đuổi tan giặc Ân hóa thần phi'],
    y: 'Xăm đại cát. Tiềm năng ngủ yên lâu ngày sắp bùng nổ đúng lúc đất nước, tổ chức cần đến. Sự trưởng thành đến nhanh phi thường — hôm nay còn im lặng, ngày mai đã gánh vác việc lớn khiến mọi người kinh ngạc.',
    dienco: 'Cậu bé làng Gióng ba tuổi không nói không cười, nghe sứ giả rao tìm người đánh giặc Ân liền cất tiếng xin ngựa sắt roi sắt. Cơm ăn mấy nong cũng hết, vươn vai thành tráng sĩ, roi gãy thì nhổ tre đánh giặc, thắng rồi bay về trời.',
    linhvuc: { giadao: 'Đứa trẻ chậm nói chậm lớn trong nhà chính là viên ngọc ẩn.', tailoc: 'Dự án ấp ủ lâu bùng nổ vượt mọi dự phóng.', tinhduyen: 'Tình cảm âm ỉ lâu ngày sắp được thổ lộ mạnh mẽ.', suckhoe: 'Sức bật hồi phục đáng kinh ngạc, cứ tin vào cơ thể.' }
  },
  {
    so: 52, ten: 'Ngu Công dời núi', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Hai núi chắn nhà chí chẳng lay', 'Cháu con đào mãi tháng năm dài', 'Lòng bền đá cũng thành đường lộ', 'Trời cảm sai thần chuyển núi ngay'],
    y: 'Xăm đại cát cho việc trường kỳ. Trở ngại to như núi nhưng quyết tâm của bạn còn bền hơn núi. Cứ làm từng chút mỗi ngày không nghỉ — đến độ nào đó, "ông trời" (quý nhân, thời thế) sẽ ra tay dọn nốt phần còn lại.',
    dienco: 'Ngu Công chín mươi tuổi quyết đào hai quả núi chắn trước nhà. Người cười ông gàn, ông đáp: ta chết có con, con chết có cháu, núi không cao thêm ắt có ngày bằng. Trời cảm động sai thần khiêng hai núi đi.',
    linhvuc: { giadao: 'Thói quen xấu lâu đời trong nhà sửa được nếu cả nhà bền bỉ.', tailoc: 'Tích tiểu thành đại — kế hoạch tích lũy dài hạn thắng lớn.', tinhduyen: 'Cảm hóa được cả người cứng rắn nhất bằng sự kiên trì chân thành.', suckhoe: 'Tập luyện đều đặn mỗi ngày một chút, bệnh mãn tính lui dần.' }
  },
  {
    so: 53, ten: 'Phạm Ngũ Lão đan sọt giữa đường', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Ngồi đan sọt nhỏ nghĩ việc to', 'Giáo đâm chẳng biết máu đang trào', 'Hưng Đạo nhìn ra người tướng giỏi', 'Từ vệ đường lên tận tướng trào'],
    y: 'Xăm tốt. Bạn đang mải nghĩ việc lớn đến quên cả xung quanh — người thường thấy lạ, nhưng người tinh mắt sẽ nhận ra tài năng. Cuộc gặp tình cờ bên "vệ đường" sắp đưa bạn thẳng vào chỗ xứng tầm.',
    dienco: 'Phạm Ngũ Lão ngồi đan sọt bên đường, mải nghĩ binh thư đến mức quân lính Trần Hưng Đạo dẹp đường đâm giáo vào đùi không hay biết. Hưng Đạo Vương thấy lạ hỏi chuyện, phục tài, tiến cử — sau thành danh tướng hai lần phá Nguyên.',
    linhvuc: { giadao: 'Người nhà tưởng bạn "lơ ngơ" — sắp có người chứng minh họ sai.', tailoc: 'Cứ giỏi thật, đám đông chưa thấy nhưng người trả lương cao sẽ thấy.', tinhduyen: 'Vẻ trầm lặng của bạn lọt mắt xanh một người tinh tế.', suckhoe: 'Tập trung quá quên ăn quên đau — đặt giờ nhắc nghỉ.' }
  },
  {
    so: 54, ten: 'Trương Chi tiếng hát bến sông', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Tiếng hát đêm trăng động khuê phòng', 'Gặp mặt tình tan giấc mộng hồng', 'Khối tình mang xuống dòng sông lạnh', 'Chén ngọc còn in bóng thuyền không'],
    y: 'Xăm xấu về tình duyên và kỳ vọng. Yêu qua hình bóng, qua giọng nói, qua màn hình — gặp thực tế dễ vỡ mộng, mà vỡ mộng rồi tổn thương khó lành. Đừng trao trọn trái tim cho thứ mình chưa chạm vào thật.',
    dienco: 'Mỵ Nương nghe tiếng hát chàng chài Trương Chi mà tương tư; gặp mặt thấy chàng xấu xí, tình tan. Trương Chi ôm mối hận chết, khối tình kết thành ngọc; tạc chén, rót trà thấy bóng thuyền, nước mắt Mỵ Nương rơi chén mới tan.',
    linhvuc: { giadao: 'Kỳ vọng về người thân khác xa thực tế — hạ tiêu chuẩn ảo xuống.', tailoc: 'Món đầu tư "nghe hay" cần thấy tận mắt sổ sách rồi hãy xuống tiền.', tinhduyen: 'Tình online, tình qua lời đồn — gặp thật sớm kẻo lún sâu.', suckhoe: 'U uất vì thất vọng dễ sinh bệnh, tìm người trút nỗi lòng.' }
  },
  {
    so: 55, ten: 'Hòn Vọng Phu — đá đợi chồng', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Bồng con lên đỉnh ngóng thuyền xa', 'Sương gió bao năm chẳng thấy nhà', 'Người hóa thành non lòng hóa đá', 'Chờ mong mòn mỏi xót phần hoa'],
    y: 'Xăm xấu về chờ đợi. Điều đang ngóng — người đi xa, tin tức, khoản tiền — sẽ lâu hơn sức chịu đựng, thậm chí có thể không về theo cách mong muốn. Đừng hóa đá đời mình vì một sự chờ; hãy sống tiếp phần chủ động được.',
    dienco: 'Người vợ bồng con lên núi ngóng chồng đi biền biệt không về, đứng mãi qua mưa nắng đến khi cả hai mẹ con hóa đá. Nhiều ngọn núi mang tên Vọng Phu trên đất Việt còn ghi tích ấy.',
    linhvuc: { giadao: 'Người đi xa bặt tin — chủ động dò hỏi qua kênh khác thay vì chỉ đợi.', tailoc: 'Khoản nợ, khoản hùn khó thu hồi — coi như học phí và xoay hướng khác.', tinhduyen: 'Đừng treo cả thanh xuân vào một lời hứa mơ hồ.', suckhoe: 'Trầm uất vì mong mỏi — ra ngoài vận động, gặp gỡ ngay.' }
  },
  {
    so: 56, ten: 'Sự tích trầu cau', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Anh em một dạ bỗng nghi nhau', 'Kẻ trước người sau hóa đá sầu', 'Vôi trắng cau xanh cùng quấn quýt', 'Muộn màng thắm lại miếng trầu đau'],
    y: 'Xăm xấu về hiểu lầm người thân. Một sự nhầm lẫn nhỏ đang đẩy anh em, vợ chồng xa nhau; nếu không nói rõ sớm, cái giá phải trả là sự chia lìa không cứu vãn nổi. Về nhà nói chuyện thẳng ngay hôm nay.',
    dienco: 'Hai anh em sinh đôi Tân và Lang giống nhau như đúc; người vợ nhầm em là chồng, người em tủi phận bỏ đi hóa đá, anh đi tìm hóa cây cau, vợ tìm chồng hóa dây trầu quấn quanh — trầu cau vôi từ đó thành nghĩa keo sơn.',
    linhvuc: { giadao: 'Hiểu lầm giữa các thành viên phải gỡ ngay trong tuần, để lâu hóa đá.', tailoc: 'Tiền bạc giữa anh em, bạn thân cần rạch ròi kẻo mất cả hai.', tinhduyen: 'Ghen nhầm, trách oan — kiểm chứng trước khi tổn thương nhau.', suckhoe: 'Buồn phiền chuyện nhà hại tim mạch, giải tỏa sớm.' }
  },
  {
    so: 57, ten: 'Thầy bói xem voi', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Người sờ vòi bảo giống đỉa trơn', 'Kẻ ôm chân cãi cột nhà hơn', 'Mỗi người một mảnh mà tranh đúng', 'Ghép lại mới ra dáng voi tròn'],
    y: 'Xăm trung bình, chủ về thông tin phiến diện. Việc đang xét mỗi người kể một kiểu, ai cũng chỉ nắm một mảnh. Đừng vội kết luận hay cãi nhau — gom đủ các góc nhìn, tự mình "xem cả con voi" rồi hãy quyết.',
    dienco: 'Năm ông thầy bói mù chung tiền xem voi. Ông sờ vòi bảo voi như đỉa, ông sờ ngà bảo như đòn càn, sờ tai như quạt, sờ chân như cột, sờ đuôi như chổi — cãi nhau toác đầu vì ai cũng chỉ đúng một phần.',
    linhvuc: { giadao: 'Nghe chuyện nhà từ một phía dễ trách oan người.', tailoc: 'Khảo sát đủ nguồn trước khi xuống tiền, đừng tin một bản chào hàng.', tinhduyen: 'Đừng đánh giá người ta qua lời kể của một người bạn.', suckhoe: 'Khám vài nơi đối chiếu kết quả trước khi điều trị lớn.' }
  },
  {
    so: 58, ten: 'Chú Cuội gốc đa cung trăng', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Thuốc quý cây thiêng cứu mạng người', 'Dặn dò một chút lỡ làng ôi', 'Cây bay theo gió người theo gốc', 'Ngồi gốc đa già ngắm cõi vui'],
    y: 'Xăm trung bình. Nắm trong tay thứ rất quý nhưng sơ suất trong khâu dặn dò, bàn giao khiến công sức bay mất. Việc cầu được nửa chừng rồi tuột vì một chi tiết nhỏ — từ nay quy trình phải chặt từng li.',
    dienco: 'Cuội có cây đa thần cải tử hoàn sinh, dặn vợ không được tưới nước bẩn. Vợ quên, cây bật gốc bay lên trời; Cuội nắm rễ níu lại bị kéo theo lên cung trăng, ngồi mãi dưới gốc đa nhìn xuống trần gian.',
    linhvuc: { giadao: 'Dặn dò việc nhà phải rõ ràng, viết ra giấy càng tốt.', tailoc: 'Sai một li trong hợp đồng, đi cả cơ nghiệp — đọc kỹ điều khoản.', tinhduyen: 'Lời nói vô ý của người kia làm hỏng chuyện, cho nhau cơ hội sửa.', suckhoe: 'Uống thuốc đúng liều đúng giờ, sai cách thì thuốc quý cũng hỏng.' }
  },
  {
    so: 59, ten: 'Khổng Dung nhường lê', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Bốn tuổi nhường lê chọn quả còi', 'Kính trên nhường dưới đạo làm người', 'Miếng ăn là nhỏ tình là lớn', 'Lễ nghĩa gieo con phúc trọn đời'],
    y: 'Xăm trung bình thiên cát. Việc cầu nên lấy nhường nhịn làm đầu — chịu phần nhỏ trước mắt để giữ đạo nghĩa, tiếng thơm về sau lớn hơn nhiều. Dạy con, đối nhân lúc này đều nên theo hướng ấy.',
    dienco: 'Khổng Dung đời Hán mới bốn tuổi, khi chia lê tự chọn quả nhỏ nhất, nói: em nhỏ nên nhường anh lớn quả to, mình nhỏ ăn quả nhỏ. Chuyện nhường lê thành bài học lễ nghĩa thuộc lòng của trẻ nhỏ ngàn năm.',
    linhvuc: { giadao: 'Nhường nhau miếng ăn chỗ ở, nhà cửa ấm êm bền lâu.', tailoc: 'Chịu lãi mỏng giữ mối lâu dài, hơn ăn dày một lần.', tinhduyen: 'Nhường lời trong lúc cãi vã là thắng cả cuộc tình.', suckhoe: 'Ăn ít một chút, bụng nhẹ người khỏe.' }
  },
  {
    so: 60, ten: 'Tư Mã Ý nhẫn đợi thời', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Áo phụ nhân kia mặc cũng cười', 'Cổng thành đóng chặt mặc ai mời', 'Nhịn qua mấy độ Khổng Minh hết', 'Thiên hạ rơi về kẻ biết chờ'],
    y: 'Xăm trung bình, chủ về phòng thủ. Đối thủ đang khiêu khích đủ kiểu mong bạn nóng mặt ra đòn — đừng mắc bẫy. Cứ cố thủ, để thời gian bào mòn đối phương; ai nhịn giỏi hơn, người đó thu cả bàn cờ.',
    dienco: 'Khổng Minh đem áo phụ nữ tặng Tư Mã Ý để khích ông ra đánh. Tư Mã Ý cười nhận áo, vẫn đóng chặt cổng thành. Khổng Minh hao mòn mất ở gò Ngũ Trượng; họ Tư Mã sau thâu tóm cả thiên hạ ba nước.',
    linhvuc: { giadao: 'Bị nói khích trong họ hàng — cười trừ là thượng sách.', tailoc: 'Thị trường dụ dỗ lướt sóng, giữ chặt vốn chờ giá tốt thật.', tinhduyen: 'Người cũ khiêu khích, người mới thử lòng — bình thản là đáp án.', suckhoe: 'Không đua theo trào lưu ăn kiêng cấp tốc, giữ nhịp riêng.' }
  },
  {
    so: 61, ten: 'Mạnh Thường Quân — kê minh cẩu đạo', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Ba nghìn thực khách chật sân nhà', 'Kẻ trộm người gà cũng chẳng tha', 'Đến lúc lâm nguy tài mọn cứu', 'Chớ khinh nghề nhỏ phận người ta'],
    y: 'Xăm trung bình. Đừng coi thường người có vẻ tầm thường quanh mình — lúc nguy cấp, chính kỹ năng "nhỏ mọn" của họ cứu cả cuộc diện. Việc cầu thành nhờ sự trợ giúp từ nơi không ngờ nhất.',
    dienco: 'Mạnh Thường Quân nuôi ba nghìn môn khách, có cả kẻ giả tiếng gà, người giỏi trộm vặt. Khi bị vua Tần giam, kẻ trộm lấy áo cầu dâng ái phi xin tha, người giả gà gáy lừa mở cửa ải lúc nửa đêm — thoát nạn nhờ hai "tài mọn".',
    linhvuc: { giadao: 'Người giúp việc, hàng xóm bình thường sẽ giúp việc lớn bất ngờ.', tailoc: 'Kỹ năng phụ tưởng vô dụng sắp thành nguồn thu chính.', tinhduyen: 'Người mai mối không ngờ tới lại se được mối tốt.', suckhoe: 'Mẹo dân gian nhỏ đúng lúc lại đỡ hơn thuốc đắt tiền.' }
  },
  {
    so: 62, ten: 'Cây tre trăm đốt', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Ở hiền làm lụng chẳng so đo', 'Chủ hứa rồi quên chuyện hẹn hò', 'Bụt dạy khắc xuất rồi khắc nhập', 'Trăm đốt liền cây vẹn hẹn ước to'],
    y: 'Xăm tốt cho người làm công chăm chỉ. Bị hứa hẹn rồi lật lọng, bị giao việc bất khả thi — nhưng đúng lúc bế tắc sẽ có "Bụt" hiện ra: một người, một công cụ, một câu thần chú giúp bạn lật ngược thế cờ, buộc kẻ thất hứa giữ lời.',
    dienco: 'Anh nông dân ở rể ba năm, phú ông hứa gả con gái rồi lật lọng, bắt tìm cây tre trăm đốt. Bụt dạy câu "khắc nhập" ghép trăm đốt liền cây, "khắc xuất" tháo ra; phú ông dính vào cây tre, đành giữ lời hứa gả con.',
    linhvuc: { giadao: 'Lời hứa trong nhà sắp được thực hiện nhờ một cú hích bất ngờ.', tailoc: 'Lương thưởng bị khất sẽ đòi được, kèm cả phần bù.', tinhduyen: 'Bị gia đình đối phương làm khó — sẽ có quý nhân gỡ nút thắt.', suckhoe: 'Phương pháp điều trị tưởng vô vọng gặp bác sĩ mát tay.' }
  },
  {
    so: 63, ten: 'Lý Bạch mài sắt nên kim', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Trốn học ham chơi gặp lão bà', 'Mài thanh sắt lớn giữa sương sa', 'Sắt kia mài mãi thành kim nhỏ', 'Tỉnh ngộ nên thi bá một nhà'],
    y: 'Xăm tốt cho học hành, rèn luyện. Đang chểnh mảng, chán nản giữa chừng — nhưng một hình ảnh, một lời nói sắp thức tỉnh bạn. Quay lại con đường mài giũa, tài năng vốn có sẽ đưa bạn lên hàng đầu lĩnh vực.',
    dienco: 'Lý Bạch thuở nhỏ trốn học, gặp bà lão ngồi mài thanh sắt bên suối, hỏi thì đáp "mài mãi thành kim thêu". Cậu bé tỉnh ngộ quay về khổ luyện, sau thành Thi Tiên lừng danh thiên cổ.',
    linhvuc: { giadao: 'Con trẻ ham chơi chỉ cần một tấm gương đúng lúc, đừng đánh mắng.', tailoc: 'Nghề đang học dở dang — quay lại mài tiếp, đó là cần câu cơm vàng.', tinhduyen: 'Tình cảm nguội đi vì thiếu vun đắp, chăm lại là ấm lại.', suckhoe: 'Bỏ tập giữa chừng mấy lần rồi — lần này duy trì tối thiểu 100 ngày.' }
  },
  {
    so: 64, ten: 'Đẽo cày giữa đường', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Đẽo cày ai góp cũng nghe theo', 'Gọt tới gọt lui gỗ chẳng còn', 'Chín người mười ý mình không chủ', 'Trắng tay ôm mảnh gỗ tí teo'],
    y: 'Xăm xấu về thiếu chính kiến. Việc đang làm bị quá nhiều người góp ý, mỗi người một phách — nghe hết thì sản phẩm nát, vốn liếng mòn. Chốt lại tiêu chuẩn của chính mình rồi đóng cửa làm cho xong.',
    dienco: 'Anh thợ đẽo cày bên đường, ai đi qua góp ý gì cũng nghe: người bảo to quá, đẽo nhỏ; kẻ bảo nhỏ quá, đẽo lại. Cuối cùng khúc gỗ chỉ còn mẩu vụn, cày không thành cày, trắng tay.',
    linhvuc: { giadao: 'Chuyện nhà mình đừng để họ hàng mỗi người lái một hướng.', tailoc: 'Kế hoạch kinh doanh sửa theo mọi lời khuyên sẽ thành thứ không ai mua.', tinhduyen: 'Yêu ai là chuyện của mình, đừng thăm dò ý kiến cả thế giới.', suckhoe: 'Mỗi người mách một bài thuốc — chỉ nghe bác sĩ chính.' }
  },
  {
    so: 65, ten: 'Ếch ngồi đáy giếng', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Đáy giếng trời cao bằng vung tròn', 'Xưng vương với ốc với rêu mòn', 'Ra ngoài trời rộng còn ngơ ngác', 'Kiêu ngạo xưa nay hại mất khôn'],
    y: 'Xăm xấu về tầm nhìn. Đang tự tin trong "cái giếng" của mình mà không biết bên ngoài thiên hạ rộng lớn cỡ nào. Việc cầu sẽ va vấp đau nếu mang tâm thế cũ ra biển lớn — hạ cái tôi xuống, đi học hỏi trước đã.',
    dienco: 'Con ếch sống lâu dưới đáy giếng, nhìn lên thấy trời chỉ bằng cái vung, xưng chúa tể với cua ốc. Mưa lớn nước tràn đưa ếch ra ngoài, vẫn nghênh ngang như cũ, bị trâu đi qua giẫm bẹp.',
    linhvuc: { giadao: 'Kinh nghiệm "nhà mình xưa nay vậy" không còn đúng nữa đâu.', tailoc: 'Thị trường ngoài kia đã đổi luật chơi, khảo sát lại trước khi mở rộng.', tinhduyen: 'Tiêu chuẩn tự đặt quá cao so với mặt bằng thực, ra ngoài gặp gỡ nhiều hơn.', suckhoe: 'Đừng chủ quan "trước giờ vẫn khỏe" — tuổi này khác rồi.' }
  },
  {
    so: 66, ten: 'Trần Hưng Đạo — Hịch tướng sĩ', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Ta thường quên bữa giữa canh trường', 'Hịch truyền rung chuyển vạn quân cường', 'Sát Thát khắc tay lòng một dạ', 'Bạch Đằng cọc nhọn táng Nguyên vương'],
    y: 'Xăm đại cát. Lời nói tâm huyết của bạn có sức lay chuyển lòng người — đây là lúc đứng ra hiệu triệu, thuyết trình, kêu gọi. Tập thể trên dưới một lòng thì kẻ địch mạnh mấy cũng phá được.',
    dienco: 'Trần Hưng Đạo viết Hịch tướng sĩ thổi bùng lòng quân, binh sĩ khắc hai chữ "Sát Thát" lên tay. Ba lần kháng Nguyên toàn thắng, đỉnh cao là trận cọc nhọn Bạch Đằng chôn vùi đại quân xâm lược.',
    linhvuc: { giadao: 'Lời gan ruột của bạn sẽ thống nhất được cả nhà đang phân tán.', tailoc: 'Bài thuyết trình, lời chào hàng lúc này có sức nặng ngàn vàng.', tinhduyen: 'Lời tỏ bày chân thành đúng lúc thắng mọi chiêu trò.', suckhoe: 'Tinh thần thống soái thân thể — ý chí đang rất mạnh.' }
  },
  {
    so: 67, ten: 'Thạch Sùng khoe của', hang: 'ha-ha', hangLabel: 'Hạ Hạ',
    tho: ['Giàu nứt đố xưa thi của quý', 'Thiếu niêu đất mẻ mất cơ đồ', 'Tiếc thân hóa kiếp loài chắt lưỡi', 'Của cải phù vân chớ cậy nhờ'],
    y: 'Xăm rất xấu về khoe khoang và cá cược. Đang có của, có thành tích, nhưng thói phô trương và máu hơn thua sẽ dẫn đến vụ cược mất tất cả chỉ vì thiếu một thứ tưởng chừng vặt vãnh. Khiêm tốn và giữ lại "niêu đất mẻ" — đường lui của mình.',
    dienco: 'Thạch Sùng giàu nứt đố đổ vách, cược với Vương Khải xem ai nhiều của hơn, giao kèo ai thiếu một món thì mất hết. Thạch Sùng thiếu đúng cái niêu đất mẻ thuở hàn vi, mất sạch cơ nghiệp, chết hóa con thạch sùng chắt lưỡi tiếc của.',
    linhvuc: { giadao: 'Khoe của trên mạng đang rước họa vào nhà.', tailoc: 'Tuyệt đối không cược "được ăn cả", không đốt đường lui.', tinhduyen: 'Ganh đua thể diện với người yêu cũ sẽ trả giá đắt.', suckhoe: 'Chủ quan khoe khỏe rồi bỏ khám định kỳ — đừng.' }
  },
  {
    so: 68, ten: 'Liêm Pha phụ kinh thỉnh tội', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Tướng già cậy sức lấn quan văn', 'Người tránh ba phen giữ nghĩa dân', 'Cởi áo mang gai sang tạ lỗi', 'Văn võ chung vai nước vững ngàn cân'],
    y: 'Xăm đại cát về hòa giải. Mâu thuẫn với đồng nghiệp, đối tác sắp được hóa giải trọn vẹn — một bên đủ độ lượng, một bên đủ dũng khí nhận sai. Sau hòa giải, liên minh này vững như bàn thạch, việc chung đại thành.',
    dienco: 'Lão tướng Liêm Pha ghen tị với Lạn Tương Như được phong cao hơn, nhiều lần khiêu khích; Tương Như đều tránh, nói "hai hổ đấu nhau, nước Triệu nguy". Liêm Pha nghe được, cởi trần mang cành gai sang tạ tội, hai người kết bạn sống chết.',
    linhvuc: { giadao: 'Người trong nhà sắp chủ động làm lành — hãy mở rộng vòng tay.', tailoc: 'Hai phe trong công ty bắt tay, dự án chung thắng lớn.', tinhduyen: 'Sau cãi vã lớn là sự thấu hiểu sâu — đừng ngại nhận lỗi trước.', suckhoe: 'Giải được khúc mắc trong lòng, huyết áp cũng dịu theo.' }
  },
  {
    so: 69, ten: 'Biển Thước gặp Tề Hoàn Công', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Bệnh ở ngoài da chửa hiểm nghèo', 'Ba lần can gián chúa không theo', 'Đến khi vào tủy thần y trốn', 'Giấu bệnh xưa nay họa vẫn đeo'],
    y: 'Xăm xấu, lời cảnh báo nghiêm khắc. Vấn đề — sức khỏe, tài chính hay quan hệ — đã được cảnh báo nhiều lần nhưng bạn gạt đi vì "vẫn thấy ổn". Còn ở ngoài da thì dễ chữa; để vào xương tủy thì thần y cũng bó tay. Hành động NGAY.',
    dienco: 'Thần y Biển Thước ba lần yết kiến Tề Hoàn Công, lần lượt báo bệnh ở da, ở cơ, ở dạ dày, vua đều cười "ta không bệnh". Lần thứ tư Biển Thước thấy vua liền bỏ trốn: bệnh đã vào tủy, hết thuốc. Năm ngày sau vua phát bệnh mà mất.',
    linhvuc: { giadao: 'Rạn nứt gia đình đã được nhắc khéo nhiều lần — đừng lờ nữa.', tailoc: 'Lỗ hổng dòng tiền nhỏ đang thành hố; vá ngay tháng này.', tinhduyen: 'Dấu hiệu bất ổn rõ rành rành, đối diện sớm còn cứu được.', suckhoe: 'Triệu chứng âm ỉ kéo dài — ĐI KHÁM NGAY TUẦN NÀY.' }
  },
  {
    so: 70, ten: 'Huyền Trân công chúa', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Gót ngọc sang Chiêm mở cõi bờ', 'Hai châu Ô Lý đáp ơn chờ', 'Phận hồng đổi lấy nghìn thu đất', 'Được nước thiệt mình sử vẫn thơ'],
    y: 'Xăm trung bình. Việc cầu buộc phải hy sinh quyền lợi cá nhân cho lợi ích chung lớn hơn — cuộc "hôn nhân chính trị" theo nghĩa nào đó. Thiệt phần mình nhưng đổi lại giá trị bền vững; đời sau sẽ ghi công.',
    dienco: 'Vua Trần gả công chúa Huyền Trân cho vua Chiêm Chế Mân, đổi lấy hai châu Ô, Lý — dải đất từ Quảng Trị đến Thừa Thiên ngày nay. Phận nữ nhi gánh việc mở cõi, được sử sách ghi ơn.',
    linhvuc: { giadao: 'Nhận phần thiệt để cả nhà được yên — công của bạn không vô hình.', tailoc: 'Nhượng bộ điều khoản nhỏ đổi lấy hợp đồng khung dài hạn.', tinhduyen: 'Mối duyên có yếu tố sắp đặt, vun vào vẫn thành tình thật.', suckhoe: 'Gồng gánh cho người khác nhiều — đặt lịch chăm sóc riêng mình.' }
  },
  {
    so: 71, ten: 'Án Anh sứ Sở — cửa nhỏ người lớn', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Vua Sở khoét tường mở lối khinh', 'Sứ lùn đối đáp sáng như gương', 'Cam kia sang đất chua thành trái', 'Một tấc lưỡi mềm giữ quốc cường'],
    y: 'Xăm tốt cho đối đáp, đàm phán ở thế yếu. Bị xem thường vì vẻ ngoài, vì xuất thân — nhưng trí tuệ và bản lĩnh ứng khẩu sẽ khiến đối phương từ khinh thành nể. Vào cuộc họp cứ tự tin, bạn sẽ tỏa sáng đúng khoảnh khắc bị ép.',
    dienco: 'Án Anh người thấp bé đi sứ nước Sở, vua Sở mở cửa nhỏ bên cổng để nhục mạ. Ông đáp "sứ nước chó mới chui cửa chó"; vua đành mở cổng lớn. Vua chỉ tù nhân người Tề, ông đáp "cam trồng Hoài Nam ngọt, sang Hoài Bắc chua — tại đất" khiến vua Sở tự nhận nhục.',
    linhvuc: { giadao: 'Bị họ hàng coi nhẹ — một dịp sắp tới bạn sẽ khiến họ đổi cách nhìn.', tailoc: 'Đàm phán với đối tác lớn: nhỏ mà có võ, đừng tự ti giá trị.', tinhduyen: 'Bị chê "không xứng" — trí tuệ và cách ứng xử của bạn là câu trả lời.', suckhoe: 'Vóc dáng không nói lên sức bền, cứ tự tin vận động.' }
  },
  {
    so: 72, ten: 'Đồng tiền Vạn Lịch', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Buôn to giàu bởi vợ hiền xưa', 'Nghi kỵ đuổi đi phúc cũng thưa', 'Gặp lại mới hay mình phụ nghĩa', 'Ăn năn đền đáp có hơi thừa'],
    y: 'Xăm trung bình thiên hạ. Cẩn thận thói nghi kỵ vô cớ — đuổi đi người mang phúc cho mình rồi mới nhận ra thì đã muộn màng. Xét lại xem gần đây có nghi oan, phụ bạc ai không; còn kịp giữ thì giữ ngay.',
    dienco: 'Lái buôn Vạn Lịch giàu có nhờ phúc người vợ hiền, chỉ vì nghi vợ trò chuyện với anh đánh giậm mà ruồng bỏ. Người vợ lấy anh đánh giậm, giúp chồng mới phát đạt, còn Vạn Lịch sa sút; gặp lại hối hận thì việc đã rồi.',
    linhvuc: { giadao: 'Người "mát tay" trong nhà đang tủi thân — trân trọng họ ngay.', tailoc: 'Vía tài lộc gắn với một người cộng sự, đừng để họ dứt áo.', tinhduyen: 'Ghen bóng gió một lần nữa là mất người thật lòng.', suckhoe: 'Đa nghi hại tâm, học cách tin và buông bớt kiểm soát.' }
  },
  {
    so: 73, ten: 'Treo biển bán cá', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Biển đề "ở đây có bán cá tươi"', 'Mỗi người qua góp bớt một lời', 'Gỡ dần từng chữ rồi thôi biển', 'Chiều khách trăm phương hóa chuyện cười'],
    y: 'Xăm trung bình. Sản phẩm, kế hoạch của bạn vốn ổn; đừng vì vài lời chê lặt vặt mà gọt sạch bản sắc. Lắng nghe có chọn lọc — khách góp ý không phải ai cũng là khách mua.',
    dienco: 'Nhà nọ treo biển "Ở đây có bán cá tươi". Người bảo chữ "tươi" thừa, kẻ nói "ở đây" thừa, người khác chê "có bán" thừa — gỡ dần đến khi cất luôn tấm biển, ai đi qua cũng chẳng biết nhà bán gì.',
    linhvuc: { giadao: 'Nếp nhà mình ổn thì giữ, đừng chạy theo chuẩn nhà người.', tailoc: 'Giữ điểm bán hàng độc nhất của mình, khác biệt là sống.', tinhduyen: 'Đừng gọt mình theo mọi lời chê của đối phương đến mất chất riêng.', suckhoe: 'Chế độ đang hợp cơ thể thì duy trì, đừng đổi theo trend.' }
  },
  {
    so: 74, ten: 'Bá Lý Hề — năm bộ da dê', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Tuổi bảy mươi còn chăn trâu thuê', 'Năm tấm da dê chuộc kẻ quê', 'Tần công một sớm trao quyền tướng', 'Ngọc nát trong bùn vẫn sáng lòe'],
    y: 'Xăm trung bình thiên cát. Giá trị thật của bạn đang bị định giá rẻ mạt — như tướng quốc bị chuộc bằng năm tấm da dê. Nhưng người sành sỏi sắp xuất hiện và trả đúng giá. Đừng tự hạ giá mình trong lúc chờ.',
    dienco: 'Bá Lý Hề tài trùm đời mà lưu lạc chăn trâu, bị chuộc về nước Tần với giá năm bộ da dê. Tần Mục Công nghe ông bàn quốc sự ba ngày, phong ngay làm tướng quốc — "Ngũ cổ đại phu" giúp Tần xưng bá.',
    linhvuc: { giadao: 'Ông bà lớn tuổi trong nhà là kho báu bị lãng quên.', tailoc: 'Đang bị trả lương dưới giá trị — chuẩn bị hồ sơ, cửa xứng đáng sắp mở.', tinhduyen: 'Người từng bị "định giá thấp" hóa ra là mảnh ghép vàng.', suckhoe: 'Tuổi tác không phải rào cản, cơ thể còn nhiều sức bền hơn bạn nghĩ.' }
  },
  {
    so: 75, ten: 'Mèo lại hoàn mèo', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Đặt tên Trời, Mây, Gió, Tường cao', 'Vòng quanh một lượt nghĩ mà chao', 'Chuột kia cắn khố tường thua chuột', 'Mèo vẫn là mèo có sao đâu'],
    y: 'Xăm trung bình. Đừng tô vẽ, đổi danh xưng cho việc/người vốn dĩ đã đúng bản chất — vòng vo một hồi lại quay về chỗ cũ. Việc cầu nên gọi đúng tên, làm đúng vai, chấp nhận thực chất thì mọi thứ trơn tru.',
    dienco: 'Người nọ nuôi mèo đặt tên Trời cho oai; bạn bàn: trời thua mây, mây thua gió, gió thua tường, tường thua chuột đục, chuột lại thua mèo — đổi quanh một vòng, tên "Mèo" là đúng nhất.',
    linhvuc: { giadao: 'Vai ai nấy giữ, đừng gồng làm "nóc nhà" khi mình hợp làm mái hiên.', tailoc: 'Đổi tên thương hiệu không cứu được sản phẩm — cải chất lượng đi.', tinhduyen: 'Người ấy là ai cứ nhìn hành động, đừng nghe danh xưng hoa mỹ.', suckhoe: 'Về với những bài tập cơ bản, cơ thể đáp ứng tốt nhất.' }
  },
  {
    so: 76, ten: 'Cóc kiện trời', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Hạn lớn trần gian cỏ cháy đồng', 'Cóc bèn dẫn hội kiện thiên cung', 'Trống vang một tiếng trời nghiêng xuống', 'Nghiến răng mưa đổ khắp non sông'],
    y: 'Xăm đại cát cho việc khiếu nại, đòi quyền lợi với "bề trên". Bé nhỏ nhưng có lý, có đồng minh và có gan gõ đúng cửa — đến vua trời cũng phải nhượng bộ. Từ nay chỉ cần "nghiến răng" ra tín hiệu là việc chạy.',
    dienco: 'Hạn hán ba năm, Cóc dẫn Cua, Gấu, Cọp, Ong lên kiện trời. Bố trí trận khéo léo, đánh bại cả thiên binh; Ngọc Hoàng phải gọi "cậu" và hứa hễ cóc nghiến răng là cho mưa — "con cóc là cậu ông trời".',
    linhvuc: { giadao: 'Đứng ra đòi quyền lợi chính đáng cho cả nhà, sẽ thắng.', tailoc: 'Khiếu nại bảo hiểm, thuế, đền bù — theo đuổi đến cùng là được xử đẹp.', tinhduyen: 'Chủ động "gõ cửa" trước đi, đối phương chờ tín hiệu của bạn.', suckhoe: 'Cơn "hạn" sức khỏe qua rồi, mưa lành đang tới.' }
  },
  {
    so: 77, ten: 'Đại Vũ trị thủy', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Cha đắp đê ngăn nước phá tan', 'Con khơi dòng chảy thuận muôn ngàn', 'Ba qua cửa nhà không ghé nghỉ', 'Trị xong hồng thủy nhận ngai vàng'],
    y: 'Xăm đại cát. Vấn đề nan giải nhiều đời không xong vì cách tiếp cận sai — đừng "chặn", hãy "khơi dòng": thuận theo quy luật mà dẫn dắt. Cách nghĩ mới của bạn sẽ giải quyết triệt để và đưa bạn lên vị trí cao nhất.',
    dienco: 'Cha của Vũ đắp đê ngăn lụt chín năm thất bại. Vũ đổi cách: đục núi khơi sông dẫn nước ra biển, mười ba năm ba lần qua cửa nhà không vào. Trị thủy thành công, được vua Thuấn truyền ngôi, mở nhà Hạ.',
    linhvuc: { giadao: 'Con cái, người thân — dẫn dắt theo sở trường thay vì cấm đoán.', tailoc: 'Đổi mô hình thuận dòng thị trường, lợi nhuận tự chảy về.', tinhduyen: 'Đừng kìm giữ đối phương, cho không gian thì tình lại đầy.', suckhoe: 'Điều trị theo hướng lưu thông, đả thông thay vì đè nén triệu chứng.' }
  },
  {
    so: 78, ten: 'Nguyễn Hiền — trạng nguyên mười ba tuổi', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Mười ba đỗ trạng tuổi thần đồng', 'Chăn trâu học lỏm chữ thánh thông', 'Xâu kiến qua oan nhờ trí sáng', 'Vua vời ra giúp nước non sông'],
    y: 'Xăm đại cát cho học hành thi cử và người trẻ tuổi. Tài năng chín sớm, thi đâu đỗ đó — kể cả từng bị đánh giá thấp vì "còn non", trí tuệ thực sẽ khiến người trên phải thân chinh mời về. Cứ tự tin ứng thí.',
    dienco: 'Nguyễn Hiền nhà nghèo, chăn trâu học lỏm, mười ba tuổi đỗ trạng nguyên trẻ nhất sử Việt. Vua chê nhỏ tuổi cho về; đến khi sứ Tàu đố xâu chỉ qua ruột ốc, cả triều bó tay, phải rước trạng — ngài bày buộc chỉ vào kiến, bôi mỡ đầu kia.',
    linhvuc: { giadao: 'Con em trong nhà có tố chất vượt trội, đầu tư không tiếc.', tailoc: 'Ý tưởng "trẻ con" của bạn sắp giải bài toán người lớn bó tay.', tinhduyen: 'Chênh lệch tuổi tác không cản nổi sự chín chắn thật.', suckhoe: 'Trí óc minh mẫn, chỉ cần rèn thêm thể lực song hành.' }
  },
  {
    so: 79, ten: 'Mao Toại tự tiến cử', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Ba năm túi gấm giấu hình dùi', 'Tự tiến ra đi chẳng thẹn lời', 'Ấn kiếm ép minh thề hợp tung', 'Một lần lộ mũi sáng ngời ngời'],
    y: 'Xăm tốt cho tự ứng cử. Đừng chờ được cất nhắc — cơ hội lần này phải tự giơ tay giành lấy. Bị mỉa "chưa thấy tài" cũng mặc: vào việc rồi bạn sẽ là người chốt hạ khiến tất cả tâm phục.',
    dienco: 'Bình Nguyên Quân tuyển hai mươi môn khách đi cầu cứu Sở, thiếu một người. Mao Toại tự tiến; chủ mỉa "dùi trong túi ắt lòi mũi, ba năm chưa thấy tài ông". Sang Sở, đàm phán bế tắc, chính Mao Toại chống kiếm ép vua Sở ký minh ước.',
    linhvuc: { giadao: 'Chủ động nhận việc khó trong nhà, vị thế của bạn thay đổi hẳn.', tailoc: 'Tự đề xuất tăng lương, tự chào hàng — cửa thắng cao.', tinhduyen: 'Tỏ tình trước đi, "dùi trong túi" mãi thì ai thấy mũi nhọn.', suckhoe: 'Chủ động đặt lịch khám tầm soát thay vì chờ có triệu chứng.' }
  },
  {
    so: 80, ten: 'Yết Kiêu đục thuyền giặc', hang: 'thuong-cat', hangLabel: 'Thượng Cát',
    tho: ['Nín thở xuyên đêm đáy nước sâu', 'Đục chìm thuyền giặc chẳng ai hay', 'Tài riêng một ngón nên công lớn', 'Sông nước ngàn năm nhớ tên này'],
    y: 'Xăm tốt cho sở trường chuyên môn sâu. Không cần giỏi mọi thứ — một kỹ năng luyện đến tuyệt đỉnh đủ lập công lớn mà người thường không làm nổi. Việc cầu nên đánh vào đúng "một ngón nghề" của mình, âm thầm mà chắc chắn.',
    dienco: 'Yết Kiêu, gia nô của Trần Hưng Đạo, bơi lặn như rái cá, đêm đêm lặn xuống đục đáy thuyền giặc Nguyên, chìm không biết bao nhiêu chiến thuyền. Một tài lẻ luyện tới cực hạn thành vũ khí phá cường địch.',
    linhvuc: { giadao: 'Mỗi người trong nhà một sở trường, phân công đúng thì việc chạy êm.', tailoc: 'Đào sâu thị trường ngách, thành "tay lặn" số một là hốt trọn.', tinhduyen: 'Điểm mạnh riêng biệt của bạn chính là thứ khiến người ấy nhớ mãi.', suckhoe: 'Môn bơi lội đang hợp mệnh, xuống nước là khỏe.' }
  },
  {
    so: 81, ten: 'Sọ Dừa', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Hình hài xấu xí ẩn tài trai', 'Chăn giỏi thổi tiêu chẳng kém ai', 'Út thảo nhìn ra người trong ngọc', 'Thi đỗ vinh quy rạng mặt mày'],
    y: 'Xăm trung bình thiên cát. Giá trị thật đang bị vỏ ngoài che khuất — bị đánh giá thấp, bị chê cười. Nhưng người có mắt xanh (như cô Út) sẽ nhìn ra, và khi "trút vỏ dừa", tất cả những kẻ từng khinh sẽ phải cúi đầu.',
    dienco: 'Sọ Dừa hình hài kỳ dị, chăn bò giỏi, thổi sáo hay. Hai cô chị hắt hủi, cô Út tinh mắt nhận lời lấy chàng. Sọ Dừa trút lốt thành chàng trai khôi ngô, đỗ trạng nguyên, hai cô chị xấu hổ bỏ đi biệt xứ.',
    linhvuc: { giadao: 'Đừng xét người nhà qua thành tích bề nổi, có viên ngọc đang ẩn.', tailoc: 'Sản phẩm bao bì xấu ruột tốt — đầu tư lại vỏ là bùng nổ.', tinhduyen: 'Người ngoại hình bình thường đang theo đuổi bạn là "hàng thật giá hời".', suckhoe: 'Thể trạng bên ngoài gầy yếu nhưng nội lực tốt, cứ bồi dưỡng đều.' }
  },
  {
    so: 82, ten: 'Quan Âm Thị Kính', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Cắt râu oan nỗi giết chồng mang', 'Giả trai nương cửa Phật am vàng', 'Thị Mầu vu vạ càng cam chịu', 'Nhẫn đến vô cùng hóa đài trang'],
    y: 'Xăm trung bình, oan khuất nhưng kết thiện. Đang chịu tiếng oan không thể tự giải thích — càng thanh minh càng rối. Chọn con đường nhẫn và cứ làm điều thiện; oan sẽ tự tỏ, và chính chuỗi oan khuất ấy nâng bạn lên tầm cao mới.',
    dienco: 'Thị Kính cắt sợi râu mọc ngược cho chồng, bị vu giết chồng, phải giả trai vào chùa tu. Thị Mầu vu cho tiểu Kính Tâm làm mình có thai; nàng nhẫn nhục nuôi đứa bé. Khi mất, sự thật tỏ tường, được tôn thành Quan Âm Thị Kính.',
    linhvuc: { giadao: 'Tiếng oan trong nhà chưa gỡ được ngay, thời gian là quan tòa.', tailoc: 'Bị đổ lỗi thất thoát — cứ minh bạch từng đồng, sổ sách sẽ nói.', tinhduyen: 'Bị đồn thổi thị phi, người thật lòng sẽ không tin lời đồn.', suckhoe: 'Nhẫn mà đừng nuốt uất — thiền, viết nhật ký để xả.' }
  },
  {
    so: 83, ten: 'Ăn khế trả vàng', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Chim ăn khế ngọt hẹn đền vàng', 'May túi ba gang đủ giàu sang', 'Kẻ tham may bảy sa lòng biển', 'Đủ mới là dư — nhớ kỹ càng'],
    y: 'Xăm trung bình, lời răn về lòng tham. Cơ hội "chim thần" sắp đến trả công xứng đáng cho sự tử tế của bạn — nhưng đề bài có hạn mức. Lấy đúng "túi ba gang" thì đổi đời; nống lên gấp đôi gấp ba là rơi xuống biển sâu.',
    dienco: 'Người em hiền lành được chim thần ăn khế trả vàng, may túi ba gang theo lời dặn, đủ giàu sang. Người anh tham đổi cả gia tài lấy cây khế, may túi bảy gang nhét đầy vàng, chim đuối cánh, rơi xuống biển cả người lẫn của.',
    linhvuc: { giadao: 'Chia gia tài đừng giành phần hơn — phần phúc quan trọng hơn phần của.', tailoc: 'Chốt lời đúng mục tiêu đề ra, gồng thêm là mất cả gốc.', tinhduyen: 'Được yêu thương rồi đừng đòi hỏi vô độ, đủ là đẹp.', suckhoe: 'Thuốc bổ quá liều thành thuốc độc, ăn uống điều độ.' }
  },
  {
    so: 84, ten: 'Vương Hi Chi luyện chữ ao mực', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Rửa bút ao nhà nước hóa đen', 'Mười tám vại nước mực thành quen', 'Một nét xuyên gỗ ba phân thấm', 'Thư thánh nào đâu bởi phép tiên'],
    y: 'Xăm trung bình thiên cát về rèn luyện. Việc cầu chưa thành vì độ luyện chưa đủ "đen cái ao" — tài năng có nhưng số giờ khổ luyện còn thiếu. Không có đường tắt; bù đủ giờ tập, kết quả sẽ "thấm gỗ ba phân".',
    dienco: 'Vương Hi Chi luyện thư pháp bên ao, ngày ngày rửa bút đến nước ao đen kịt, dùng cạn mười tám vại nước mực. Chữ ông viết lên gỗ, thợ khắc thấy mực thấm sâu ba phân — thành Thư thánh muôn đời.',
    linhvuc: { giadao: 'Kèm con học cần bền bỉ như mài mực, không có lớp học cấp tốc nào thay được.', tailoc: 'Tay nghề chưa tới thì đừng vội mở tiệm, luyện thêm một mùa.', tinhduyen: 'Tình cảm sâu nhờ tích lũy từng ngày, không nhờ vài cử chỉ lớn.', suckhoe: 'Bài tập nhàm nhưng đúng — lặp lại đủ nghìn lần sẽ thấy khác.' }
  },
  {
    so: 85, ten: 'Giấc mộng kê vàng', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Gối sứ lim dim quán dọc đàng', 'Một đời vinh nhục giấc mơ mang', 'Tỉnh ra nồi kê còn chưa chín', 'Công danh nhìn lại hạt kê vàng'],
    y: 'Xăm trung bình, thức tỉnh về danh lợi. Thứ đang theo đuổi ráo riết — chức tước, hư danh — khi đạt được có thể chỉ như giấc mộng ngắn ngủi trước nồi kê chưa chín. Xem lại điều gì thật sự đáng để đổi cả đời mình.',
    dienco: 'Lư sinh than nghèo ở quán trọ, đạo sĩ cho mượn chiếc gối sứ. Chàng mơ thấy cả đời vinh hoa: đỗ đạt, làm tướng, bị hại, được phục chức, con cháu đầy đàn, thọ tám mươi. Tỉnh dậy, nồi kê chủ quán nấu vẫn chưa chín.',
    linhvuc: { giadao: 'Mải công danh quên bữa cơm nhà — thứ thật đang ở cạnh bạn.', tailoc: 'Chức danh ảo không bằng dòng tiền thật, đánh giá lại offer.', tinhduyen: 'Hào nhoáng bên ngoài của đối phương có thể là giấc kê vàng.', suckhoe: 'Đổi sức khỏe lấy danh vọng là thương vụ lỗ nhất đời.' }
  },
  {
    so: 86, ten: 'Lợn cưới áo mới', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Kẻ khoe áo mới đứng chờ ai', 'Người hỏi lợn kia sổng chuồng ngoài', 'Hai bên cùng ngứa khoe cho được', 'Chuyện chẳng đâu vào hóa chuyện cười'],
    y: 'Xăm trung bình, răn về sĩ diện. Việc cầu đang bị chính nhu cầu thể hiện làm chậm — họp hành, giao tiếp mất thì giờ vào khoe khéo thay vì vào việc. Bớt một câu khoe, nhanh một bước tiến.',
    dienco: 'Anh có áo mới đứng hóng cả ngày chờ người khen. Anh mất lợn chạy qua hỏi "có thấy con lợn cưới của tôi không?"; anh kia đáp "từ lúc mặc cái áo mới này, tôi chẳng thấy lợn nào". Hai kẻ khoe gặp nhau thành chuyện cười.',
    linhvuc: { giadao: 'Họp mặt gia đình bớt màn "báo cáo thành tích", thêm hỏi han thật lòng.', tailoc: 'Networking để bán hàng, đừng để khoe hàng — khách chạy hết.', tinhduyen: 'Buổi hẹn đầu hỏi về người ta nhiều hơn kể về mình.', suckhoe: 'Tập cho khỏe chứ không phải để check-in, đừng quá sức vì cái ảnh.' }
  },
  {
    so: 87, ten: 'Khoa Phụ đuổi mặt trời', hang: 'ha-ha', hangLabel: 'Hạ Hạ',
    tho: ['Vác gậy băng đồng đuổi ánh dương', 'Uống cạn sông Hà vẫn khát trương', 'Gục giữa đường xa thân hóa núi', 'Sức người có hạn chớ đo lường'],
    y: 'Xăm rất xấu. Mục tiêu đang đuổi vượt xa giới hạn nguồn lực — như đuổi theo mặt trời, càng chạy càng khát, kiệt sức giữa đường. Không phải bàn lùi: đây là bài toán sai đề. Đổi mục tiêu khả thi trước khi cạn kiệt hoàn toàn.',
    dienco: 'Khổng lồ Khoa Phụ quyết đuổi kịp mặt trời, chạy đến đâu khát đến đó, uống cạn cả Hoàng Hà, Vị Hà vẫn không đủ, cuối cùng gục chết giữa đường, cây gậy hóa thành rừng đào.',
    linhvuc: { giadao: 'Chuẩn sống chạy theo "con nhà người ta" đang vắt kiệt cả nhà.', tailoc: 'Mục tiêu doanh số phi thực tế — điều chỉnh ngay kẻo đội ngũ gãy.', tinhduyen: 'Theo đuổi người ngoài tầm với bằng mọi giá chỉ chuốc kiệt quệ.', suckhoe: 'CẢNH BÁO kiệt sức: cơ thể đã cạn, nghỉ dài hạn là bắt buộc.' }
  },
  {
    so: 88, ten: 'Trí khôn của ta đây', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Cọp hỏi trí khôn ở chốn nao', 'Người rằng để ở nhà chưa mang', 'Trói xong châm lửa cười khanh khách', 'To xác thua mưu chuyện rõ ràng'],
    y: 'Xăm trung bình. Đối thủ to xác, nhiều vốn, nhiều quyền — nhưng thiếu mưu. Việc cầu nên thắng bằng trí: đặt điều kiện, dùng đòn tâm lý, khiến đối phương tự nộp mình. Nhỏ mà khôn thắng lớn mà khờ.',
    dienco: 'Cọp thấy trâu to bị người sai khiến, hỏi người về "trí khôn". Người bảo để quên ở nhà, xin trói cọp lại kẻo cọp ăn trâu trong lúc về lấy. Trói xong, người châm lửa đốt: "Trí khôn của ta đây!" — cọp từ đó có vằn đen.',
    linhvuc: { giadao: 'Xử lý người nhà cứng đầu bằng mẹo mềm, đừng đối đầu trực diện.', tailoc: 'Điều khoản hợp đồng là "dây trói" hợp pháp — soạn thật khéo.', tinhduyen: 'Kẻ ỷ thế chèn ép sẽ thua bạn ở một nước cờ cao hơn.', suckhoe: 'Chữa bệnh bằng cái đầu: đọc hiểu bệnh của mình để phối hợp với bác sĩ.' }
  },
  {
    so: 89, ten: 'Chu Văn An dâng Thất trảm sớ', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Sớ dâng xin chém bảy gian thần', 'Vua chẳng nghe lời đành cáo thân', 'Về núi mở trường gieo hạt chữ', 'Thanh danh muôn thuở sáng còn ngần'],
    y: 'Xăm trung bình. Lời can gián ngay thẳng của bạn không được cấp trên nghe — đừng cố đấm ăn xôi nơi không trọng lẽ phải. Rút về "mở trường" theo cách của mình: giá trị của bạn sẽ tỏa sáng ở nơi khác và bền hơn.',
    dienco: 'Chu Văn An dâng Thất trảm sớ xin chém bảy nịnh thần lộng hành. Vua Trần Dụ Tông không nghe, ông treo mũ từ quan về núi Phượng Hoàng dạy học — trở thành "vạn thế sư biểu" của nước Việt.',
    linhvuc: { giadao: 'Khuyên can hết lời mà người nhà không nghe — giữ khoảng cách an toàn, đừng cạn tình.', tailoc: 'Công ty không nghe cảnh báo rủi ro — chuẩn bị phương án riêng cho mình.', tinhduyen: 'Góp ý mãi không đổi thì đừng biến mình thành người cằn nhằn — chọn đi hay ở.', suckhoe: 'Đổi môi trường sống trong lành hơn, sức khỏe tinh thần đi lên.' }
  },
  {
    so: 90, ten: 'Hậu Nghệ bắn chín mặt trời', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Chín vầng lửa đỏ đốt nhân gian', 'Thần tiễn giương cung cứu vạn dân', 'Công lớn về sau sinh ngạo mạn', 'Anh hùng gãy bởi chính tay chân'],
    y: 'Xăm trung bình, cảnh báo sau thành công. Việc cầu sẽ thành công vang dội — nhưng hồi sau mới là đề khó: công lớn dễ sinh kiêu, kiêu sinh họa từ chính người thân cận. Thắng rồi càng phải khiêm cung, thu phục lòng người dưới.',
    dienco: 'Mười mặt trời cùng mọc thiêu đốt nhân gian, Hậu Nghệ giương thần cung bắn rụng chín vầng, cứu muôn dân. Nhưng về sau ông sinh bạo ngược, bị chính học trò Bàng Mông dùng cung nghề thầy dạy hại chết.',
    linhvuc: { giadao: 'Là công thần của gia đình cũng đừng lấy công ra kể, dễ sinh oán.', tailoc: 'Sau cú thắng lớn, rủi ro lớn nhất là chính sự tự tin của bạn.', tinhduyen: 'Đừng ngủ quên trên chiến thắng chinh phục — giữ người khó hơn được người.', suckhoe: 'Hồi phục tốt rồi đừng phá — tái phát lần hai nặng hơn lần đầu.' }
  },
  {
    so: 91, ten: 'Tinh Vệ lấp biển', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Chim nhỏ ngậm cành đá núi tây', 'Thả xuống trùng dương tháng lại ngày', 'Biển cả chưa vơi lòng chẳng mỏi', 'Chí kia đáng phục — lượng sức này'],
    y: 'Xăm trung bình. Ý chí của bạn đáng khâm phục nhưng bài toán chọn có thể quá lớn so với một đời người. Hoặc chấp nhận đây là "sự nghiệp nhiều thế hệ" và làm vì ý nghĩa, hoặc thu nhỏ mục tiêu thành thứ hoàn thành được — chọn tỉnh táo.',
    dienco: 'Con gái Viêm Đế chết đuối ở biển Đông, hóa thành chim Tinh Vệ, ngày ngày ngậm đá cành cây từ núi Tây thả xuống quyết lấp biển. Nghìn năm chưa lấp nổi nhưng chưa từng bỏ cuộc — biểu tượng của ý chí phi thường.',
    linhvuc: { giadao: 'Cải tạo một người là việc cả đời — kiên trì nhưng đừng đánh cược hạnh phúc.', tailoc: 'Dự án tầm cỡ "lấp biển" cần chia nhỏ ra từng cột mốc bán được.', tinhduyen: 'Cảm hóa người băng giá — hỏi mình chờ được bao lâu và đáng không.', suckhoe: 'Bệnh mãn tính sống chung được, quản lý tốt hơn là đòi trị tận gốc.' }
  },
  {
    so: 92, ten: 'Điêu Thuyền liên hoàn kế', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Bái nguyệt lầu trăng lệ mấy hàng', 'Một thân gánh vác kế liên hoàn', 'Cha con Đổng Lữ tan vì sắc', 'Việc lớn thành nhưng phận bẽ bàng'],
    y: 'Xăm trung bình. Kế hoạch nhiều lớp đang vận hành và sẽ thành công — nhưng người đứng giữa các bên (có thể là bạn) sẽ chịu tổn thất riêng. Nếu buộc phải làm "mắt xích", định trước lối ra cho mình từ bây giờ.',
    dienco: 'Vương Doãn dùng con nuôi Điêu Thuyền thi hành liên hoàn kế: hứa gả cho cả Đổng Trác lẫn Lữ Bố, khiến cha con nghi kỵ. Lữ Bố giết Đổng Trác, trừ được đại họa — nhưng phận Điêu Thuyền sau đó mờ mịt bẽ bàng.',
    linhvuc: { giadao: 'Đứng giữa hai phe trong nhà — làm cầu nối chứ đừng làm quân cờ.', tailoc: 'Deal phức tạp nhiều bên: xác định rõ mình được gì trên giấy.', tinhduyen: 'Cẩn thận bị dùng làm "quân bài" khích tướng người khác.', suckhoe: 'Căng thẳng vì phải đóng nhiều vai — tìm một chỗ được là chính mình.' }
  },
  {
    so: 93, ten: 'Mua hộp trả ngọc', hang: 'trung-binh', hangLabel: 'Trung Bình',
    tho: ['Hộp gỗ trầm hương khảm ngọc trai', 'Người mua giữ hộp trả châu ngay', 'Vỏ ngoài lấn át điều chân quý', 'Mắt tục nghìn xưa vẫn thế hoài'],
    y: 'Xăm trung bình. Cẩn thận việc "mua hộp trả ngọc" — bị hình thức lấp lánh hút mắt mà bỏ qua giá trị cốt lõi, hoặc chính bạn đang gói giá trị thật trong lớp vỏ khiến người ta chỉ nhớ cái vỏ. Định vị lại đâu là ngọc, đâu là hộp.',
    dienco: 'Người nước Sở bán ngọc, làm chiếc hộp gỗ mộc lan xông trầm, khảm trai lộng lẫy đựng ngọc. Khách nước Trịnh mua xong giữ lại hộp, trả viên ngọc — điển tích "mãi độc hoàn châu" chê kẻ trọng vỏ bỏ ruột.',
    linhvuc: { giadao: 'Chọn trường cho con: đừng vì cơ sở đẹp mà quên chất lượng dạy.', tailoc: 'Ngân sách marketing đang nuốt ngân sách sản phẩm — cân lại.', tinhduyen: 'Đám cưới là cái hộp, hôn nhân là viên ngọc — đầu tư đúng chỗ.', suckhoe: 'Thực phẩm chức năng bao bì đẹp không thay được bữa ăn thật.' }
  },
  {
    so: 94, ten: 'Ôm cây đợi thỏ', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Thỏ đâm gốc rạ chết queo nằm', 'Bỏ cả cày bừa giữ gốc chăm', 'Ruộng hoang cỏ mọc thỏ nào đến', 'May một lần thôi chớ tưởng năm'],
    y: 'Xăm xấu. Thành công lần trước là ăn may, không phải công thức — mà bạn đang bỏ bê công việc nền tảng để chờ vận may lặp lại. Thỏ không đâm vào gốc cây hai lần; quay về cày ruộng ngay kẻo mất cả mùa.',
    dienco: 'Anh nông dân nước Tống thấy con thỏ chạy đâm vào gốc cây gãy cổ chết, được bữa no. Từ đó bỏ cày, ngày ngày ôm gốc cây đợi thỏ khác. Thỏ không đến nữa, ruộng bỏ hoang, thành trò cười nước Tống.',
    linhvuc: { giadao: 'Trúng đợt may đừng nghĩ lo được cả nhà mãi — quay về kế sinh nhai chính.', tailoc: 'Trúng một kèo không biến bạn thành cao thủ — dừng "ôm cây" ngay.', tinhduyen: 'Đừng ngồi chờ người cũ quay lại như lần trước, cuộc sống phải tiếp diễn.', suckhoe: 'Lần trước tự khỏi không có nghĩa lần này tự khỏi — đi khám đi.' }
  },
  {
    so: 95, ten: 'Khắc thuyền tìm gươm', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Gươm rơi giữa sóng nước mênh mang', 'Khắc dấu mạn thuyền dạ vững vàng', 'Thuyền cập bến xa mò đáy nước', 'Dấu còn gươm mất nghĩ mà than'],
    y: 'Xăm xấu về tư duy lỗi thời. Hoàn cảnh đã trôi đi mà bạn vẫn dùng "cái dấu khắc" cũ để tìm lời giải — kinh nghiệm xưa, địa chỉ cũ, cách làm cũ. Việc cầu sẽ hỏng nếu không cập nhật theo dòng chảy hiện tại.',
    dienco: 'Người nước Sở qua sông đánh rơi gươm, bình thản khắc dấu lên mạn thuyền chỗ gươm rơi. Thuyền cập bến, anh ta theo dấu khắc nhảy xuống mò — thuyền đã trôi xa, gươm nằm lại giữa sông.',
    linhvuc: { giadao: 'Cách dạy con thời mình không còn khớp với thời con — cập nhật.', tailoc: 'Công thức thắng năm ngoái đang lỗ năm nay, đọc lại thị trường.', tinhduyen: 'Người ta đã thay đổi, đừng đối xử theo "phiên bản cũ" của họ.', suckhoe: 'Đơn thuốc cũ không hợp bệnh mới, tái khám lấy phác đồ mới.' }
  },
  {
    so: 96, ten: 'Nhổ mạ cho chóng lớn', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Thương lúa nhà ta chậm tấc gang', 'Nhổ lên từng gốc giúp cao càng', 'Sớm mai ra ruộng đồng khô héo', 'Nóng vội xưa nay hỏng vạn hàng'],
    y: 'Xăm xấu về nóng vội. Đang can thiệp quá tay vào tiến trình cần thời gian tự nhiên — thúc con học, ép deal chín non, đẩy tình cảm đi nhanh. Càng "kéo mạ" càng chết cả ruộng; lùi lại chăm gốc bón phân là cách duy nhất.',
    dienco: 'Người nước Tống sốt ruột thấy mạ chậm lớn, ra ruộng nhổ từng cây lên cao thêm một đoạn, về khoe "hôm nay giúp mạ lớn". Con trai chạy ra xem: cả ruộng mạ héo rũ chết khô — điển tích "yết miêu trợ trưởng".',
    linhvuc: { giadao: 'Ép con thành tài sớm đang phản tác dụng thấy rõ.', tailoc: 'Rót thêm tiền ép tăng trưởng nóng sẽ gãy mô hình.', tinhduyen: 'Giục cưới, giục cam kết lúc này là đuổi người ta đi.', suckhoe: 'Tăng liều, tăng cường độ tập gấp đôi không giúp khỏi nhanh gấp đôi.' }
  },
  {
    so: 97, ten: 'Đông Thi bắt chước nhăn mặt', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Tây Thi ôm ngực nét càng duyên', 'Cô Đông bắt chước nhăn mày liền', 'Xóm giềng đóng cửa người xa lánh', 'Cái đẹp vay người hóa lụy phiền'],
    y: 'Xăm xấu về sao chép. Đang bắt chước công thức thành công của người khác mà không có cái nền của họ — càng cố giống càng lộ vụng. Việc cầu chỉ thành khi quay về thế mạnh thật của chính mình.',
    dienco: 'Tây Thi đau tim, nhăn mặt ôm ngực mà càng đẹp não nùng. Đông Thi xấu xí thấy vậy cũng ôm ngực nhăn mày đi khắp làng; người giàu đóng chặt cửa, người nghèo dắt vợ con bỏ chạy.',
    linhvuc: { giadao: 'Copy cách nuôi dạy con nhà người nổi tiếng — con mình khác con họ.', tailoc: 'Nhái mô hình đối thủ khi không có vốn và ekip của họ là tự sát.', tinhduyen: 'Gồng theo hình mẫu trên mạng, người ta yêu bản gốc chứ không yêu bản sao.', suckhoe: 'Chế độ ăn của vận động viên không dành cho dân văn phòng.' }
  },
  {
    so: 98, ten: 'Chu Du mất phu nhân lại thiệt quân', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Giả gả Kiều em bẫy Kinh Châu', 'Gậy ông đập lại tính sao đâu', 'Người về thuyền thắm quân tơi tả', 'Mưu hỏng hai lần hận bạc đầu'],
    y: 'Xăm xấu. Kế hoạch tưởng cao tay nhằm "bẫy" đối phương sẽ bị nhìn thấu và lật ngược — mất cả chì lẫn chài, còn mang tiếng cười. Đối thủ hiện tại cao hơn bạn một bậc về mưu; chuyển sang đường chính đạo, minh bạch mà đi.',
    dienco: 'Chu Du bày kế gả em gái Tôn Quyền để dụ Lưu Bị sang Đông Ngô rồi bắt giữ đòi Kinh Châu. Khổng Minh tương kế tựu kế, Lưu Bị cưới được vợ thật rồi rút êm; quân Ngô truy kích bị phục kích tơi tả — "chu lang diệu kế an thiên hạ, đã mất phu nhân lại thiệt quân".',
    linhvuc: { giadao: 'Dùng mẹo thử lòng người nhà sẽ tự làm mình tổn thương.', tailoc: 'Cài bẫy điều khoản với đối tác khôn hơn — họ đọc ra và phản đòn.', tinhduyen: 'Kế "khích tướng cho ghen" sẽ đẩy người ta vào vòng tay kẻ khác thật.', suckhoe: 'Giấu bệnh để thử sự quan tâm — trò này hại chính mình.' }
  },
  {
    so: 99, ten: 'Nguyễn Trãi — vụ án Lệ Chi Viên', hang: 'ha', hangLabel: 'Hạ',
    tho: ['Công lớn mười năm giúp dựng triều', 'Vườn vải một đêm họa hiểm nghèo', 'Ba họ hàm oan trời chửa thấu', 'Hai mươi năm lẻ tuyết mới gieo'],
    y: 'Xăm xấu, đại hạn về thị phi vu vạ. Ở vị trí càng cao, càng gần "chỗ nhạy cảm" càng dễ bị cuốn vào vòng xoáy không phải lỗi mình. Giai đoạn này nên chủ động lui về, tránh dính líu chuyện của người quyền thế; sự trong sạch cần thời gian rất dài mới được chứng minh.',
    dienco: 'Vua Lê Thái Tông băng hà đột ngột ở Lệ Chi Viên sau khi ghé nhà Nguyễn Trãi. Triều đình khép ông tội giết vua, tru di tam tộc. Hơn hai mươi năm sau vua Lê Thánh Tông mới minh oan: "Ức Trai tâm thượng quang Khuê tảo".',
    linhvuc: { giadao: 'Tránh đứng tên, ký hộ, dính líu tài sản nhạy cảm của người khác.', tailoc: 'Rời xa các phi vụ "gần lửa" dù lợi nhuận hấp dẫn.', tinhduyen: 'Tránh làm người thứ ba bất đắc dĩ trong drama của cặp khác.', suckhoe: 'Họa từ miệng người — giữ tinh thần, đừng để lời đồn gặm sức khỏe.' }
  },
  {
    so: 100, ten: 'Nữ Oa luyện đá vá trời', hang: 'thuong-thuong', hangLabel: 'Thượng Thượng',
    tho: ['Trời thủng bốn phương lửa nước tràn', 'Luyện đá năm màu vá vững vàng', 'Chặt chân ngao lớn chống bốn cực', 'Càn khôn từ đó lại bình an'],
    y: 'Xăm đại cát, quẻ viên mãn khép ống xăm. Cục diện tưởng sụp đổ hoàn toàn sẽ được chính tay bạn vá lành — đủ tài, đủ tâm và đủ "đá ngũ sắc" (nguồn lực nhiều mặt). Sau biến cố, mọi thứ vững chãi hơn cả lúc chưa đổ vỡ.',
    dienco: 'Cung Công húc đổ núi Bất Chu làm trời thủng một góc, nước lửa tràn lan. Nữ Oa luyện đá ngũ sắc vá trời, chặt chân ngao lớn dựng bốn cực, trị hồng thủy — trời đất từ đó yên ổn, muôn loài sinh sôi.',
    linhvuc: { giadao: 'Gia đình sau sóng gió được hàn gắn bền chặt hơn xưa.', tailoc: 'Khủng hoảng chính là cơ hội tái cấu trúc — bạn là người "vá trời".', tinhduyen: 'Rạn nứt lớn được vá lành bằng sự bao dung phi thường, tình thêm sâu.', suckhoe: 'Đại phẫu, đại bệnh qua khỏi — cơ thể tái sinh mạnh mẽ.' }
  },
];
