/**
 * gieoque/js/hexagrams.js
 * 64 Quẻ Kinh Dịch (I Ching hexagrams)
 * lines: array of 6 values bottom→top: 6=old yin, 7=young yang, 8=young yin, 9=old yang
 * binary key: each line yang=1 yin=0, bottom to top → 6-bit number
 */

const HEXAGRAMS = {
  1:  {
    name: 'Càn',
    vn: 'Thuần Càn',
    symbol: '䷀',
    sign: '☰☰',
    meaning: 'Tượng trưng cho sức mạnh sáng tạo thuần khiết và vô hạn của Trời. Sự kết hợp giữa Thiên ở trên và Thiên ở dưới đại diện cho sự vận hành không ngừng nghỉ của vũ trụ, mang lại nguồn năng lượng khởi đầu mạnh mẽ và quang minh chính đại. Vận thế đang ở thời kỳ hưng thịnh, vạn vật hanh thông, hứa hẹn một tương lai xán lạn cho những ai có chí sắt đá.',
    advice: 'Quân tử hãy tự cường không tiếc, vững chí tiến lên mà không kiêu ngạo. Hãy giữ lòng trung chính, hành động hợp thời và tôn trọng quy luật tự nhiên.'
  },
  2:  {
    name: 'Khôn',
    vn: 'Thuần Khôn',
    symbol: '䷁',
    sign: '☷☷',
    meaning: 'Tượng trưng cho đức dày nuôi dưỡng vạn vật của Đất. Sự kết hợp giữa Địa ở trên và Địa ở dưới biểu thị sự nhu thuận, bao dung và nâng đỡ âm thầm. Đây là thời điểm vạn vật sinh sôi trong tĩnh lặng, vận thế tuy chậm nhưng vô cùng bền vững nếu biết thuận theo tự nhiên.',
    advice: 'Hãy giữ lòng nhu thuận, bao dung và đóng vai trò hỗ trợ đắc lực thay vì cố dẫn đầu. Kiên nhẫn tích lũy đức độ, thành công sẽ đến tự nhiên như đất lành chim đậu.'
  },
  3:  {
    name: 'Truân',
    vn: 'Thủy Lôi Truân',
    symbol: '䷂',
    sign: '☵☳',
    meaning: 'Tượng trưng cho sự gian nan trong buổi đầu dựng nghiệp. Sự kết hợp giữa Thủy ở trên và Lôi ở dưới biểu thị nguồn năng lượng muốn bứt phá nhưng bị kìm hãm giữa hiểm cảnh. Vận thế đang buổi hỗn độn, vạn sự khởi đầu nan, đòi hỏi sự kiên nhẫn tích lũy và định hình phương hướng.',
    advice: 'Đừng vội vàng manh động hay đơn thương độc mã đương đầu với sóng gió. Hãy tìm kiếm sự trợ giúp từ những bậc hiền giả và tập trung xây dựng nền móng vững chắc.'
  },
  4:  {
    name: 'Mông',
    vn: 'Sơn Thủy Mông',
    symbol: '䷃',
    sign: '☶☵',
    meaning: 'Tượng trưng cho thuở sơ khai còn mờ tối, ngây thơ cần được khai sáng. Sự kết hợp giữa Sơn ở trên và Thủy ở dưới chỉ ra sự bế tắc của kẻ chưa hiểu biết trước vực sâu hiểm nghèo. Đây là thời điểm thích hợp cho việc học hỏi, tầm sư học đạo để xua tan màn sương mù của tâm trí.',
    advice: 'Hãy giữ tâm thế khiêm nhường, thành tâm cầu tiến như người học trò đón nhận tri thức. Tránh tự phụ hay cố chấp, bởi chỉ có sự chân thành mới cảm hóa được người thầy vĩ đại.'
  },
  5:  {
    name: 'Nhu',
    vn: 'Thủy Thiên Nhu',
    symbol: '䷄',
    sign: '☵☰',
    meaning: 'Tượng trưng cho việc chờ đợi thời cơ chín muồi trong niềm tin và sự tự tại. Sự kết hợp giữa Thủy ở trên và Thiên ở dưới biểu thị thế trận hiểm nguy trước mắt nhưng nội lực vẫn vững vàng. Vận thế tuy có phần ngưng trệ, nhưng là sự ngưng trệ để tích lũy dưỡng chất trước khi dông bão qua đi.',
    advice: 'Hãy kiên nhẫn dưỡng sức, tận hưởng cuộc sống và củng cố chí hướng trong lúc chờ đợi. Tuyệt đối không manh động vượt rào, nước chảy đá mòn, thời cơ ắt sẽ tự đến.'
  },
  6:  {
    name: 'Tụng',
    vn: 'Thiên Thủy Tụng',
    symbol: '䷅',
    sign: '☰☵',
    meaning: 'Tượng trưng cho sự tranh chấp, bất hòa và kiện tụng. Sự kết hợp giữa Thiên ở trên và Thủy ở dưới biểu thị hai xu hướng hoàn toàn trái ngược, dẫn đến mâu thuẫn không thể dung hòa. Vận thế gặp nhiều trắc trở, lòng người ly tán, dễ chuốc lấy tai tiếng thị phi nếu cố chấp tranh hơn thua.',
    advice: 'Hãy sáng suốt dừng lại và tìm kiếm giải pháp hòa giải thay vì đẩy xung đột đi quá xa. Nhượng bộ một bước chính là bảo toàn phúc đức và trí tuệ của bậc quân tử.'
  },
  7:  {
    name: 'Sư',
    vn: 'Địa Thủy Sư',
    symbol: '䷆',
    sign: '☷☵',
    meaning: 'Tượng trưng cho binh quyền, sức mạnh tập thể và kỷ luật thép. Sự kết hợp giữa Địa ở trên và Thủy ở dưới biểu thị sức mạnh tiềm tàng của quần chúng cần được tổ chức chặt chẽ. Vận thế đòi hỏi sự đồng lòng, nhất trí và một sự dẫn dắt danh chính ngôn thuận để vượt qua thử thách lớn.',
    advice: 'Hãy dẫn dắt bằng chính đạo, giữ nghiêm kỷ cương và đặt lợi ích tập thể lên trên hết. Sự đoàn kết và lòng trung nghĩa sẽ biến nguy nan thành chiến thắng vang dội.'
  },
  8:  {
    name: 'Tỉ',
    vn: 'Thủy Địa Tỉ',
    symbol: '䷇',
    sign: '☵☷',
    meaning: 'Tượng trưng cho sự thân cận, đoàn kết và liên minh gắn bó. Sự kết hợp giữa Thủy ở trên và Địa ở dưới biểu thị nước thấm vào đất, tạo nên sự hòa quyện tự nhiên và bền chặt. Vận thế đang rất thuận lợi cho việc hợp tác, tìm kiếm đồng minh và xây dựng cộng đồng chung chí hướng.',
    advice: 'Hãy chọn lựa bạn đồng hành một cách khôn ngoan và đối đãi bằng tấm lòng chân thành nhất. Sự nghi ngờ hay đến trễ trong các liên minh tốt đẹp sẽ dẫn đến hối tiếc về sau.'
  },
  9:  {
    name: 'Tiểu Súc',
    vn: 'Phong Thiên Tiểu Súc',
    symbol: '䷈',
    sign: '☴☰',
    meaning: 'Tượng trưng cho sự kiềm chế nhỏ, gió bay trên trời nhưng chưa thể tụ thành mưa lớn. Sự kết hợp giữa Phong ở trên và Thiên ở dưới biểu thị sức mạnh tích lũy còn mỏng, chưa đủ để tạo nên sự thay đổi toàn diện. Vận thế tạm thời bị trì hoãn bởi những trở ngại nhỏ, đòi hỏi sự kiên nhẫn âm thầm.',
    advice: 'Hãy tập trung thu vén những việc nhỏ, tu dưỡng bản thân và tránh mưu cầu đại sự lúc này. Hãy như làn gió mát mềm mại, từ từ tích lũy sức mạnh chờ ngày mây tụ thành mưa.'
  },
  10: {
    name: 'Lý',
    vn: 'Thiên Trạch Lý',
    symbol: '䷉',
    sign: '☰☱',
    meaning: 'Tượng trưng cho việc bước đi trên lễ nghĩa và chuẩn mực dù hoàn cảnh đầy hiểm nguy. Sự kết hợp giữa Thiên ở trên và Trạch ở dưới biểu thị sự kính sợ trước quyền uy nhưng vẫn giữ được lòng thanh thản, khéo léo. Vận thế đòi hỏi sự cẩn trọng tột bậc trong giao tế và ứng xử để tránh tai họa.',
    advice: 'Dẫu phải giẫm lên đuôi hổ, hãy bước đi với thái độ ôn hòa, đúng mực và lòng quả cảm. Sự tôn trọng quy chuẩn đạo đức và ứng xử khéo léo sẽ giúp biến nguy thành an.'
  },
  11: {
    name: 'Thái',
    vn: 'Địa Thiên Thái',
    symbol: '䷊',
    sign: '☷☰',
    meaning: 'Tượng trưng cho sự hòa bình, hanh thông và thịnh vượng tột bậc. Sự kết hợp giữa Địa ở trên và Thiên ở dưới biểu thị âm dương giao hòa, đất trời tương thông, vạn vật sinh sôi nảy nở. Vận thế cát tường, mọi sự hanh thông, lòng người đồng thuận và các dự định đều dễ dàng đạt được.',
    advice: 'Hãy trân trọng thời kỳ hoàng kim này bằng cách gieo thêm nhân lành và giúp đỡ những kẻ khốn khó. Giữ thái độ khiêm cung để phúc trạch được kéo dài mãi về sau.'
  },
  12: {
    name: 'Bĩ',
    vn: 'Thiên Địa Bĩ',
    symbol: '䷋',
    sign: '☰☷',
    meaning: 'Tượng trưng cho sự bế tắc, trì trệ và âm dương cách trở. Sự kết hợp giữa Thiên ở trên và Địa ở dưới biểu thị hai cực xa rời nhau, lòng người ly tán, tiểu nhân đắc thế. Vận thế đang ở thời kỳ u ám, các lối đi đều bị đóng kín, mưu sự khó thành.',
    advice: 'Đây là lúc nên thu liễm hào quang, rút lui giữ mình và kiên quyết không thỏa hiệp với cái xấu. Hãy ẩn nhẫn chờ đợi thời cuộc xoay vần, tránh vì nôn nóng mà chuốc họa vào thân.'
  },
  13: {
    name: 'Đồng Nhân',
    vn: 'Thiên Hỏa Đồng Nhân',
    symbol: '䷌',
    sign: '☰☲',
    meaning: 'Tượng trưng cho sự đồng tâm hiệp lực, hòa hợp đại đồng giữa người với người. Sự kết hợp giữa Thiên ở trên và Hỏa ở dưới chiếu rọi muôn phương, tạo nên sự minh bạch và đồng lòng vượt qua biên giới. Vận thế rất tốt lành cho các hoạt động cộng đồng, xây dựng đại nghiệp dựa trên sự đồng thuận.',
    advice: 'Hãy mở rộng lòng mình, phá bỏ định kiến và tìm kiếm điểm chung với tha nhân. Sự công tâm và lòng bao dung chính là chìa khóa để hiệu triệu thiên hạ hướng về chính nghĩa.'
  },
  14: {
    name: 'Đại Hữu',
    vn: 'Hỏa Thiên Đại Hữu',
    symbol: '䷍',
    sign: '☲☰',
    meaning: 'Tượng trưng cho sự sở hữu lớn lao, sự sung túc và quang vinh tột bậc. Sự kết hợp giữa Hỏa ở trên và Thiên ở dưới biểu thị ánh dương soi sáng vạn vật, phô diễn sự giàu có và uy thế hiển hách. Vận thế đang cực kỳ thịnh vượng, tài lộc dồi dào, vị thế xã hội được củng cố vững chắc.',
    advice: 'Giàu sang đi đôi với trách nhiệm, hãy dùng tài sản và tầm ảnh hưởng của mình để ban phát ân huệ cho đời. Tránh kiêu ngạo tự mãn, bởi sự khiêm nhường mới là chiếc neo giữ vững sự thịnh vượng.'
  },
  15: {
    name: 'Khiêm',
    vn: 'Địa Sơn Khiêm',
    symbol: '䷎',
    sign: '☷☶',
    meaning: 'Tượng trưng cho đức tính khiêm tốn, nhún nhường và cao thượng. Sự kết hợp giữa Địa ở trên và Sơn ở dưới biểu thị ngọn núi hùng vĩ tự nguyện ẩn mình dưới lòng đất bao dung. Vận thế vô cùng tốt lành, người khiêm hạ đi đến đâu cũng được quỷ thần hộ trì, người đời kính phục.',
    advice: 'Hãy luôn giữ lòng khiêm tốn, hạ mình xuống để lắng nghe và nâng đỡ người khác. Sự tự tôn thầm lặng và từ tốn chính là sức mạnh tối thượng giúp vượt qua mọi sóng gió.'
  },
  16: {
    name: 'Dự',
    vn: 'Lôi Địa Dự',
    symbol: '䷏',
    sign: '☳☷',
    meaning: 'Tượng trưng cho sự vui tươi, hứng khởi và chuẩn bị chu đáo cho tương lai. Sự kết hợp giữa Lôi ở trên và Địa ở dưới biểu thị sấm vang trên đất, mang lại niềm vui tươi và năng lượng dồi dào của mùa xuân. Vận thế đang lên, lòng người phấn chấn, mở ra nhiều cơ hội hành động đầy hứa hẹn.',
    advice: 'Hãy dùng nhiệt huyết chân thành để truyền cảm hứng và kết nối lòng người xung quanh. Tuy nhiên, chớ say sưa trong niềm vui nhất thời mà quên đi việc dự phòng cho những ngày giông bão.'
  },
  17: {
    name: 'Tùy',
    vn: 'Trạch Lôi Tùy',
    symbol: '䷐',
    sign: '☱☳',
    meaning: 'Tượng trưng cho sự thích nghi, thuận theo thời thế và đi theo điều hay lẽ phải. Sự kết hợp giữa Trạch ở trên và Lôi ở dưới biểu thị sự vui vẻ thuận theo quy luật vận động tự nhiên. Vận thế tốt đẹp cho những ai biết linh hoạt uyển chuyển, từ bỏ định kiến để lắng nghe thời cuộc.',
    advice: 'Hãy như dòng nước mềm mại, biết uốn mình theo địa hình để tìm về biển lớn. Việc biết lắng nghe và đi theo những người hiền đức sẽ mang lại thành công ngoài mong đợi.'
  },
  18: {
    name: 'Cổ',
    vn: 'Sơn Phong Cổ',
    symbol: '䷑',
    sign: '☶☴',
    meaning: 'Tượng trưng cho sự suy thoái, đổ nát từ bên trong và nhu cầu chấn chỉnh cấp bách. Sự kết hợp giữa Sơn ở trên và Phong ở dưới biểu thị luồng gió bị chặn lại nơi chân núi, tạo nên sự ẩm mốc, tù đọng. Vận thế gặp nhiều thử thách do những sai lầm tích tụ từ quá khứ cần được cải tổ dứt điểm.',
    advice: 'Hãy dũng cảm đối mặt với sự truth, rà soát lại toàn bộ hệ thống và tiến hành cải tổ dứt khoát. Ba ngày trước và ba ngày sau cuộc đổi mới là thời điểm vàng để tái thiết lập trật tự.'
  },
  19: {
    name: 'Lâm',
    vn: 'Địa Trạch Lâm',
    symbol: '䷒',
    sign: '☷☱',
    meaning: 'Tượng trưng cho sự tiếp cận gần kề, sự tăng trưởng và tầm ảnh hưởng đang mở rộng. Sự kết hợp giữa Địa ở trên và Trạch ở dưới biểu thị dòng nước mát lành đang tràn ngập nuôi dưỡng vạn vật. Vận thế đang ở thời kỳ đầu xuân trỗi dậy mạnh mẽ, cơ hội thành công đang đến rất gần.',
    advice: 'Hãy nắm bắt thời cơ vàng này để tiến hành các dự định lớn với tất cả lòng nhiệt thành. Đồng thời, cần đề phòng sự suy thoái có thể xuất hiện khi thời kỳ thịnh vượng qua đi vào tháng Tám.'
  },
  20: {
    name: 'Quan',
    vn: 'Phong Địa Quan',
    symbol: '䷓',
    sign: '☴☷',
    meaning: 'Tượng trưng cho sự quan sát sâu sắc, chiêm nghiệm nội tâm và thị kiến tâm linh. Sự kết hợp giữa Phong ở trên và Địa ở dưới biểu thị làn gió thổi khắp mặt đất, quan sát và thấu hiểu mọi ngóc ngách của đời sống. Vận thế đòi hỏi sự điềm tĩnh, lùi lại một bước để có cái nhìn toàn cảnh trước khi hành động.',
    advice: 'Hãy tịnh tâm quán chiếu bản thân và thế sự để thấu suốt bản chất của mọi hiện tượng. Lấy sự chân thành làm gốc, biến mình thành tấm gương sáng để người đời tự soi vào và học tập.'
  },
  21: {
    name: 'Phệ Hạp',
    vn: 'Hỏa Lôi Phệ Hạp',
    symbol: '䷔',
    sign: '☲☳',
    meaning: 'Tượng trưng cho sự cắn xé trở ngại, thực thi pháp luật và phân định rạch ròi. Sự kết hợp giữa Hỏa ở trên và Lôi ở dưới biểu thị sự kết hợp giữa trí tuệ và quyền uy để trừng trị cái xấu. Vận thế đòi hỏi sự quyết đoán, không khoan nhượng trước các rào cản hay bất công.',
    advice: 'Hãy thẳng thắn đối diện trực tiếp với nút thắt và giải quyết dứt điểm bằng công lý, lẽ phải. Sự do dự hay nhu nhược lúc này chỉ khiến cho vết thương ngày càng thêm trầm trọng.'
  },
  22: {
    name: 'Bí',
    vn: 'Sơn Hỏa Bí',
    symbol: '䷕',
    sign: '☶☲',
    meaning: 'Tượng trưng cho vẻ đẹp trang sức, hình thức bên ngoài và sự trang nhã lịch thiệp. Sự kết hợp giữa Sơn ở trên và Hỏa ở dưới biểu thị ánh lửa tô điểm làm rạng rỡ chân núi trong đêm tối. Vận thế chỉ thuận lợi cho các việc nhỏ, các hoạt động văn hóa, nghệ thuật hay ngoại giao cần sự khéo léo.',
    advice: 'Hãy chú trọng đến lễ nghi, hình thức và sự tử tế trong ứng xử hàng ngày để tạo thiện cảm. Tuy nhiên, chớ để vẻ hào nhoáng bên ngoài che mờ đi bản chất chân thật và nội lực bên trong.'
  },
  23: {
    name: 'Bác',
    vn: 'Sơn Địa Bác',
    symbol: '䷖',
    sign: '☶☷',
    meaning: 'Tượng trưng cho sự sụp đổ, hao mòn và sức mạnh tiêu cực đang lấn lướt. Sự kết hợp giữa Sơn ở trên và Địa ở dưới biểu thị ngọn núi cao bị xói mòn và sạt lở xuống nền đất phẳng. Vận thế cực kỳ bất lợi, kẻ tiểu nhân đắc thế, người quân tử bị cô lập và mọi nỗ lực tiến lên đều vô vọng.',
    advice: 'Đây là thời điểm tuyệt đối không được manh động, hãy im lặng rút lui để bảo toàn sinh lực. Đứng vững trên nền tảng đạo đức vững chắc chính là cách duy nhất vượt qua cơn bão giông này.'
  },
  24: {
    name: 'Phục',
    vn: 'Địa Lôi Phục',
    symbol: '䷗',
    sign: '☷☳',
    meaning: 'Tượng trưng cho sự phục hồi, quay trở lại của ánh sáng và một chu kỳ mới bắt đầu. Sự kết hợp giữa Địa ở trên và Lôi ở dưới biểu thị mầm sống đầu tiên đang cựa quậy trỗi dậy sâu trong lòng đất mùa đông. Vận thế bắt đầu có dấu hiệu khởi sắc, bóng tối lùi dần và cơ hội tái sinh đang mở ra.',
    advice: 'Hãy kiên nhẫn đón nhận sự phục hồi này một cách tự nhiên, tránh vội vàng thúc ép quá trình phát triển. Tích lũy năng lượng từ từ, từng bước quay lại quỹ đạo cũ với sự cẩn trọng cao độ.'
  },
  25: {
    name: 'Vô Vọng',
    vn: 'Thiên Lôi Vô Vọng',
    symbol: '䷘',
    sign: '☰☳',
    meaning: 'Tượng trưng cho sự chân thật, vô tư và hành động không mưu cầu ảo vọng. Sự kết hợp giữa Thiên ở trên và Lôi ở dưới biểu thị sự vận hành tự nhiên, không chịu sự chi phối của lòng tham ích kỷ. Vận thế thuận lợi nếu bạn giữ vững sự chính trực và hành xử tự nhiên theo lương tâm.',
    advice: 'Hãy hành động vì điều đúng đắn mà không màng đến lợi ích hay phần thưởng trước mắt. Bất kỳ sự toan tính bất chính nào trong thời điểm này cũng sẽ dẫn đến tai họa khôn lường.'
  },
  26: {
    name: 'Đại Súc',
    vn: 'Sơn Thiên Đại Súc',
    symbol: '䷙',
    sign: '☶☰',
    meaning: 'Tượng trưng cho việc tích lũy lớn lao cả về tài sản lẫn đức độ và trí tuệ. Sự kết hợp giữa Sơn ở trên và Thiên ở dưới biểu thị sức mạnh vĩ đại của vũ trụ được chứa đựng và bảo tồn trong lòng núi. Vận thế vô cùng mạnh mẽ, tích lũy sâu dày hứa hẹn một bước nhảy vọt phi thường.',
    advice: 'Hãy tập trung học hỏi, rèn luyện nhân cách và tích lũy nguồn lực thay vì phung phí năng lượng vào những tranh chấp nhỏ. Khi nội lực đã đầy tràn, hãy dũng cảm bước qua sông lớn để lập đại nghiệp.'
  },
  27: {
    name: 'Di',
    vn: 'Sơn Lôi Di',
    symbol: '䷚',
    sign: '☶☳',
    meaning: 'Tượng trưng cho sự nuôi dưỡng, chăm sóc thể chất lẫn tinh thần và lời ăn tiếng nói. Sự kết hợp giữa Sơn ở trên và Lôi ở dưới phác họa hình ảnh chiếc hàm đang nhai để hấp thụ dinh dưỡng. Vận thế trung bình, đòi hỏi sự tự nhìn nhận lại nguồn năng lượng mà mình dung nạp và phát ra.',
    advice: 'Hãy cẩn trọng với những gì bạn thu nhận vào tâm trí cũng như những lời lẽ bạn nói ra ngoài đời. Nuôi dưỡng bản thân bằng những tư tưởng cao đẹp và nuôi dưỡng người khác bằng tình yêu thương.'
  },
  28: {
    name: 'Đại Quá',
    vn: 'Trạch Phong Đại Quá',
    symbol: '䷛',
    sign: '☱☴',
    meaning: 'Tượng trưng cho sự quá tải, vượt quá giới hạn chịu đựng hoặc hoàn cảnh phi thường. Sự kết hợp giữa Trạch ở trên và Phong ở dưới biểu thị chiếc cột nhà bị cong võng dưới sức nặng quá lớn. Vận thế đầy rẫy nguy cơ sụp đổ, đòi hỏi một tinh thần thép và giải pháp mang tính đột phá.',
    advice: 'Hãy dũng cảm gánh vác trách nhiệm và hành động dứt khoát dù phải đơn độc đối mặt với hiểm nguy. Sự linh hoạt kết hợp với ý chí kiên cường sẽ giúp bạn vượt qua thời khắc sinh tử này.'
  },
  29: {
    name: 'Khảm',
    vn: 'Thuần Khảm',
    symbol: '䷜',
    sign: '☵☵',
    meaning: 'Tượng trưng cho hiểm họa trùng trùng, vực sâu vây hãm và thử thách của lòng tin. Sự kết hợp giữa Thủy ở trên và Thủy ở dưới biểu thị dòng nước chảy xiết qua những hẻm đá hiểm trở mà không hề dừng lại. Vận thế đang ở vùng trũng của khó khăn, đòi hỏi sự kiên định tột bậc và tâm hồn trong sáng để không bị nhấn chìm.',
    advice: 'Hãy giữ vững niềm tin và bản lĩnh, đối diện với nỗi sợ hãi bằng một cái đầu lạnh. Như dòng nước chảy xiết, hãy tìm cách len lỏi qua các khe hở thay vì cố dùng sức đối đầu trực diện.'
  },
  30: {
    name: 'Ly',
    vn: 'Thuần Ly',
    symbol: '䷝',
    sign: '☲☲',
    meaning: 'Tượng trưng cho ánh sáng trí tuệ, sự sáng suốt và tinh thần bám trụ vào chính đạo. Sự kết hợp giữa Hỏa ở trên và Hỏa ở dưới biểu thị ngọn lửa đôi chiếu rọi rực rỡ, xua tan bóng tối và sưởi ấm vạn vật. Vận thế hanh thông, công lý và sự thật sẽ được phơi bày dưới ánh mặt trời rực rỡ.',
    advice: 'Hãy bám lấy những giá trị đạo đức tốt đẹp như ngọn lửa bám vào củi khô để tiếp tục tỏa sáng. Hành xử ôn hòa, giữ tâm trí tỉnh táo và tránh sự nóng giận nhất thời làm thiêu rụi đại nghiệp.'
  },
  31: {
    name: 'Hàm',
    vn: 'Trạch Sơn Hàm',
    symbol: '䷞',
    sign: '☱☶',
    meaning: 'Tượng trưng cho sự cảm ứng tâm giao, tình yêu đôi lứa và lực hút tự nhiên của đất trời. Sự kết hợp giữa Trạch ở trên và Sơn ở dưới biểu thị sự hòa quyện giữa sự mềm mại, nhạy cảm và lòng kiên định sâu sắc. Vận thế cát tường, các mối quan hệ tình cảm và hợp tác phát triển vô cùng tự nhiên.',
    advice: 'Hãy mở rộng lòng mình để đón nhận và thấu hiểu cảm xúc của những người xung quanh. Hãy để sự chân thành dẫn lối, tránh xa mọi toan tính vụ lợi trong các mối nhân duyên.'
  },
  32: {
    name: 'Hằng',
    vn: 'Lôi Phong Hằng',
    symbol: '䷟',
    sign: '☳☴',
    meaning: 'Tượng trưng cho sự kiên định, bền bỉ và thủy chung trước sau như một. Sự kết hợp giữa Lôi ở trên và Phong ở dưới biểu thị sự phối hợp hài hòa giữa chuyển động và thích nghi để duy trì sự hằng thường của vũ trụ. Vận thế vững vàng, thành công sẽ đến với những ai kiên trì theo đuổi mục tiêu.',
    advice: 'Hãy giữ vững lập trường, củng cố các giá trị cốt lõi và kiên trì đi hết con đường đã chọn. Tránh đứng núi này trông núi nọ, bởi sự nhất quán chính là gốc rễ của mọi thành tựu dài lâu.'
  },
  33: {
    name: 'Độn',
    vn: 'Thiên Sơn Độn',
    symbol: '䷠',
    sign: '☰☶',
    meaning: 'Tượng trưng cho sự rút lui chiến thuật, ẩn náu để bảo toàn lực lượng trước thế lực xấu. Sự kết hợp giữa Thiên ở trên và Sơn ở dưới biểu thị khoảng cách xa vời giữa bầu trời và mặt đất tĩnh lặng. Vận thế đang suy thoái, tiểu nhân đang thắng thế, không phải lúc để tiến lên giành quyền chủ động.',
    advice: 'Hãy biết dừng lại đúng lúc và rút lui trong danh dự để bảo toàn chí hướng cùng năng lượng của mình. Rút lui không phải là thất bại, mà là bước chuẩn bị khôn ngoan cho sự trở lại mạnh mẽ hơn.'
  },
  34: {
    name: 'Đại Tráng',
    vn: 'Lôi Thiên Đại Tráng',
    symbol: '䷡',
    sign: '☳☰',
    meaning: 'Tượng trưng cho sức mạnh vĩ đại vượt trội và sự tự tin mãnh liệt. Sự kết hợp giữa Lôi ở trên và Thiên ở dưới tạo nên nguồn năng lượng chấn động trời đất. Vận thế cực kỳ hưng thịnh, vị thế vững vàng, song hiểm họa cũng đang cận kề nếu thiếu đi sự tự kiểm soát.',
    advice: 'Sức mạnh thực sự nằm ở sự tự chủ và khả năng kiềm chế bản thân trước những cám dỗ của quyền lực. Hãy dùng sức mạnh đó để bảo vệ lẽ phải và nâng đỡ kẻ yếu thay vì phô trương vô ích.'
  },
  35: {
    name: 'Tấn',
    vn: 'Hỏa Địa Tấn',
    symbol: '䷢',
    sign: '☲☷',
    meaning: 'Tượng trưng cho sự thăng tiến nhanh chóng, ánh sáng ban mai chiếu rọi khắp mặt đất. Sự kết hợp giữa Hỏa ở trên và Địa ở dưới biểu thị thái dương mọc lên từ lòng đất, mang lại hơi ấm và ánh sáng cho muôn loài. Vận thế đang lên như diều gặp gió, tài năng của bạn được công nhận và tôn vinh rộng rãi.',
    advice: 'Hãy tận dụng thời cơ này để hành động mạnh mẽ và cống hiến hết mình cho cộng đồng. Giữ lòng trung chính và thái độ bao dung để ánh hào quang của bạn không bao giờ tắt.'
  },
  36: {
    name: 'Minh Di',
    vn: 'Địa Hỏa Minh Di',
    symbol: '䷣',
    sign: '☷☲',
    meaning: 'Tượng trưng cho ánh sáng bị che khuất, thời kỳ đen tối hoặc hiền tài bị vùi dập. Sự kết hợp giữa Địa ở trên và Hỏa ở dưới biểu thị mặt trời lặn sâu vào lòng đất, bóng tối bao trùm cảnh vật. Vận thế vô cùng trắc trở, lòng người hiểm ác, đòi hỏi sự kiên nhẫn chịu đựng tột bực.',
    advice: 'Hãy khôn ngoan ẩn giấu tài năng và suy nghĩ của mình như ngọn đèn giấu dưới lồng kính để tránh tai họa. Giữ vững niềm tin bên trong và âm thầm tu dưỡng, chờ đợi ngày ánh sáng trở lại.'
  },
  37: {
    name: 'Gia Nhân',
    vn: 'Phong Hỏa Gia Nhân',
    symbol: '䷤',
    sign: '☴☲',
    meaning: 'Tượng trưng cho đạo gia đình, sự hòa hợp trong mái ấm và trách nhiệm của mỗi thành viên. Sự kết hợp giữa Phong ở trên và Hỏa ở dưới biểu thị sự lan tỏa hơi ấm và trật tự từ trong gia đình ra ngoài xã hội. Vận thế ổn định, hạnh phúc đong đầy dựa trên sự đồng lòng và tôn trọng lẫn nhau.',
    advice: 'Hãy vun đắp cho tổ ấm của bạn bằng tình yêu thương chân thành và sự phân vai rõ ràng, đúng mực. Gia hòa vạn sự hưng, nền tảng gia đình vững chắc chính là bệ phóng cho mọi sự nghiệp.'
  },
  38: {
    name: 'Khuê',
    vn: 'Hỏa Trạch Khuê',
    symbol: '䷥',
    sign: '☲☱',
    meaning: 'Tượng trưng cho sự chia rẽ, đối lập và bất đồng quan điểm giữa các bên. Sự kết hợp giữa Hỏa ở trên và Trạch ở dưới biểu thị xu hướng ly tâm, khó tìm được tiếng nói chung. Vận thế trắc trở trong các đại sự, chỉ thích hợp cho những việc nhỏ cần sự độc lập hoạt động.',
    advice: 'Hãy học cách chấp nhận sự khác biệt và tìm kiếm những điểm đồng thuận nhỏ nhoi trong sự tương phản lớn. Giữ thái độ hòa nhã, tránh tranh cãi vô bổ vì vạn vật vốn dĩ khác biệt nhưng vẫn cùng tồn tại.'
  },
  39: {
    name: 'Kiển',
    vn: 'Thủy Sơn Kiển',
    symbol: '䷦',
    sign: '☵☶',
    meaning: 'Tượng trưng cho sự gian nan, trở ngại trùng khơi trước mắt làm chùn bước chân. Sự kết hợp giữa Thủy ở trên và Sơn ở dưới phác họa hiểm cảnh tiến thoái lưỡng nan. Vận thế cực kỳ khó khăn, cố tình lao vào hiểm nguy lúc này chỉ chuốc lấy thất bại ê chề.',
    advice: 'Hãy điềm tĩnh dừng lại, tự kiểm điểm bản thân và tìm kiếm lời khuyên từ các bậc trưởng bối giàu kinh nghiệm. Quay đầu hoặc đi đường vòng lúc này chính là biểu hiện của sự khôn ngoan tối thượng.'
  },
  40: {
    name: 'Giải',
    vn: 'Lôi Thủy Giải',
    symbol: '䷧',
    sign: '☳☵',
    meaning: 'Tượng trưng cho sự giải thoát, tháo gỡ khó khăn và sấm sét mang mưa về làm dịu mát mặt đất. Sự kết hợp giữa Lôi ở trên và Thủy ở dưới biểu thị dông bão qua đi, bầu trời quang đãng trở lại. Vận thế đang chuyển biến tích cực, các nút thắt dần được tháo gỡ và cơ hội mới đang mở ra.',
    advice: 'Hãy nhanh chóng hành động để giải quyết dứt điểm các vấn đề còn tồn đọng ngay khi thời cơ đến. Đồng thời, hãy khoan dung tha thứ cho những lỗi lầm cũ để lòng thanh thản hướng tới tương lai.'
  },
  41: {
    name: 'Tổn',
    vn: 'Sơn Trạch Tổn',
    symbol: '䷨',
    sign: '☶☱',
    meaning: 'Tượng trưng cho sự giảm bớt, hy sinh lợi ích ngắn hạn để hướng tới giá trị lâu dài. Sự kết hợp giữa Sơn ở trên và Trạch ở dưới biểu thị việc bồi đắp chân núi bằng cách đào sâu đầm lầy, thể hiện triết lý bớt dưới thêm trên. Vận thế tuy có hao tổn ban đầu nhưng chứa đựng mầm mống của sự đại thịnh về sau.',
    advice: 'Hãy chủ động cắt bỏ những ham muốn ích kỷ, đơn giản hóa cuộc sống và tập trung vào những điều cốt lõi. Sự chân thành và lòng vị tha trong giai đoạn này sẽ mang lại phúc đức vô bờ bến.'
  },
  42: {
    name: 'Ích',
    vn: 'Phong Lôi Ích',
    symbol: '䷩',
    sign: '☴☳',
    meaning: 'Tượng trưng cho sự gia tăng, bồi đắp lợi ích và cơ hội phát triển mạnh mẽ. Sự kết hợp giữa Phong ở trên và Lôi ở dưới biểu thị sự tương tác thúc đẩy lẫn nhau, làm tăng thêm sức mạnh của tự nhiên. Vận thế vô cùng hanh thông, thời cơ tốt đẹp để thực hiện những kế hoạch vĩ mô và giúp đỡ cộng đồng.',
    advice: 'Hãy chủ động hành động, dấn thân vào những thử thách lớn và lan tỏa lợi ích đến với mọi người xung quanh. Khi bạn làm giàu cho cuộc đời, vũ trụ sẽ tự động bồi đắp thêm nguồn lực cho bạn.'
  },
  43: {
    name: 'Quải',
    vn: 'Trạch Thiên Quải',
    symbol: '䷪',
    sign: '☱☰',
    meaning: 'Tượng trưng cho sự quyết liệt giải quyết dứt điểm cái xấu, sự đột phá vượt qua giới hạn. Sự kết hợp giữa Trạch ở trên và Thiên ở dưới biểu thị thế nước tích tụ sắp vỡ đê, đòi hỏi hành động khai thông dứt khoát. Vận thế yêu cầu sự cứng rắn, minh bạch và lòng dũng cảm đương đầu với thách thức.',
    advice: 'Hãy công khai đối đầu với thói xấu bằng sự chính trực và quyết tâm không khoan nhượng. Tuy nhiên, tránh dùng bạo lực hay sự tức giận, hãy giải quyết bằng trí tuệ và sự chuẩn bị kỹ lưỡng.'
  },
  44: {
    name: 'Cấu',
    vn: 'Thiên Phong Cấu',
    symbol: '䷫',
    sign: '☰☴',
    meaning: 'Tượng trưng cho cuộc gặp gỡ bất ngờ, sự giao thoa đột ngột giữa các lực lượng. Sự kết hợp giữa Thiên ở trên và Phong ở dưới biểu thị sức mạnh mềm mại nhưng thâm nhập rất sâu vào mọi ngõ ngách. Vận thế tiềm ẩn những yếu tố bất ngờ, dễ bị cuốn vào những ảnh hưởng tiêu cực nếu thiếu cảnh giác.',
    advice: 'Hãy cẩn trọng trước những lời đường mật hay cơ hội đến quá dễ dàng trong cuộc sống. Giữ vững nguyên tắc tự chủ để tránh bị lôi kéo vào những mối quan hệ độc hại hoặc sa bẫy tiểu nhân.'
  },
  45: {
    name: 'Tụy',
    vn: 'Trạch Địa Tụy',
    symbol: '䷬',
    sign: '☱☷',
    meaning: 'Tượng trưng cho sự tụ hội, đoàn kết nhân tâm và sức mạnh của đám đông. Sự kết hợp giữa Trạch ở trên và Địa ở dưới biểu thị nguồn nước quần tụ trên mặt đất, tạo nên sự trù phú và màu mỡ. Vận thế rất thuận lợi cho việc tập hợp lực lượng, củng cố tập thể và xây dựng niềm tin.',
    advice: 'Hãy dùng đức độ và sự chân thành để thu phục lòng người, tạo dựng một cộng đồng gắn kết chặt chẽ. Đề phòng những xung đột nhỏ phát sinh từ sự tụ họp bằng cách chuẩn bị sẵn sàng các phương án dự phòng.'
  },
  46: {
    name: 'Thăng',
    vn: 'Địa Phong Thăng',
    symbol: '䷭',
    sign: '☷☴',
    meaning: 'Tượng trưng cho sự thăng tiến vững chắc, từng bước đi lên dựa trên nỗ lực bền bỉ. Sự kết hợp giữa Địa ở trên và Phong ở dưới biểu thị mầm cây đang âm thầm vươn cao đón ánh nắng mặt trời. Vận thế vô cùng hanh thông, thành công đến từ sự kiên trì tích lũy từng ngày.',
    advice: 'Hãy tiếp tục bước tới với thái độ khiêm nhường, không tự mãn và tìm kiếm sự nâng đỡ của những bậc hiền tài. Đi lên từng bước một cách vững chắc tốt hơn là đốt cháy giai đoạn để rồi ngã đau.'
  },
  47: {
    name: 'Khốn',
    vn: 'Trạch Thủy Khốn',
    symbol: '䷮',
    sign: '☱☵',
    meaning: 'Tượng trưng cho sự khốn cùng, bế tắc tột bực và sự thử thách chí khí của con người. Sự kết hợp giữa Trạch ở trên và Thủy ở dưới biểu thị cảnh hồ nước cạn trơ đáy, cuộc sống rơi vào cảnh kiệt quệ tài nguyên. Vận thế đang ở mức thấp nhất, lời nói không được tin tưởng, hành động dễ gặp cản trở.',
    advice: 'Hãy kiên cường giữ vững phẩm giá và chí khí của người quân tử ngay cả trong nghịch cảnh đen tối nhất. Lời nói lúc này vô ích, hãy im lặng hành động và chứng minh giá trị thực của bản thân.'
  },
  48: {
    name: 'Tỉnh',
    vn: 'Thủy Phong Tỉnh',
    symbol: '䷯',
    sign: '☵☴',
    meaning: 'Tượng trưng cho chiếc giếng nước cổ, nguồn trí tuệ vô tận và giá trị cốt lõi bền vững theo thời gian. Sự kết hợp giữa Thủy ở trên và Phong ở dưới biểu thị việc khai thác nguồn nước ngầm sâu trong lòng đất để nuôi dưỡng cuộc sống. Vận thế ổn định, đề cao việc tìm về cội nguồn và tu dưỡng nội tâm.',
    advice: 'Hãy quay về chăm sóc tâm hồn và gìn giữ những giá trị căn bản, đạo đức làm người. Đừng quên rằng chiếc giếng chỉ có giá trị khi nước trong sạch và gàu múc không bị vỡ giữa chừng.'
  },
  49: {
    name: 'Cách',
    vn: 'Trạch Hỏa Cách',
    symbol: '䷰',
    sign: '☱☲',
    meaning: 'Tượng trưng cho sự cải cách toàn diện, cuộc cách mạng thay đổi vận mệnh và phá bỏ cái cũ. Sự kết hợp giữa Trạch ở trên và Hỏa ở dưới biểu thị cuộc đấu tranh sinh tử để thiết lập một trật tự mới tốt đẹp hơn. Vận thế đòi hỏi sự đổi mới tư duy sâu sắc, không thể tiếp tục đi theo lối mòn cũ.',
    advice: 'Hãy dũng cảm tiến hành các thay đổi cần thiết khi thời cơ đã chín muồi và lòng người đã đồng thuận. Hãy giữ lòng chính trực, hành động công tâm để cuộc cải cách mang lại hạnh phúc thật sự cho số đông.'
  },
  50: {
    name: 'Đỉnh',
    vn: 'Hỏa Phong Đỉnh',
    symbol: '䷱',
    sign: '☲☴',
    meaning: 'Tượng trưng cho chiếc vạc báu ba chân, sự chuyển hóa tâm linh và xác lập trật tự vững chãi. Sự kết hợp giữa Hỏa ở trên và Phong ở dưới biểu thị quá trình luyện kim, nấu chín thức ăn để dâng cúng thần linh và nuôi dưỡng hiền tài. Vận thế vô cùng cát tường, đại diện cho vị thế cao quý đi kèm với trí tuệ văn minh.',
    advice: 'Hãy dùng tài năng và đức độ để cống hiến cho xã hội, xác lập vị thế của mình bằng những hành động thực tế. Vun bồi đạo đức và nâng đỡ những người xung quanh chính là cách giữ cho ba chân vạc luôn vững vàng.'
  },
  51: {
    name: 'Chấn',
    vn: 'Thuần Chấn',
    symbol: '䷲',
    sign: '☳☳',
    meaning: 'Tượng trưng cho tiếng sấm vang dội trời đất, sự thức tỉnh đột ngột trước những biến động mạnh mẽ của cuộc đời. Sự kết hợp giữa Lôi ở trên và Lôi ở dưới biểu thị chuỗi sấm sét liên hoàn xua tan khí độc, chấn động tâm can vạn vật. Vận thế có nhiều biến động bất ngờ, thử thách bản lĩnh giữ bình tĩnh trước hiểm nguy.',
    advice: 'Hãy giữ vững tâm thế bình thản và định lực giữa cơn dông bão của cuộc đời. Khi tiếng sấm qua đi, bạn sẽ thấy tâm mình sáng tỏ hơn và tìm ra con đường đi đúng đắn nhất.'
  },
  52: {
    name: 'Cấn',
    vn: 'Thuần Cấn',
    symbol: '䷳',
    sign: '☶☶',
    meaning: 'Tượng trưng cho ngọn núi hùng vĩ đứng yên, sự tĩnh lặng tột cùng và định lực của tâm hồn. Sự kết hợp giữa Cấn ở trên và Cấn ở dưới biểu thị sự dừng lại đúng lúc, giữ mình trong sạch trước những chuyển động xô bồ bên ngoài. Vận thế đòi hỏi sự ngưng nghỉ, suy ngẫm sâu sắc và không hành động mù quáng.',
    advice: 'Hãy học cách dừng lại khi cần thiết, giữ cho tâm trí không bị cuốn theo dòng xoáy của ngoại cảnh. Sự tĩnh lặng nội tại chính là nguồn sức mạnh tối thượng giúp bạn vượt qua mọi cám dỗ.'
  },
  53: {
    name: 'Tiệm',
    vn: 'Phong Sơn Tiệm',
    symbol: '䷴',
    sign: '☴☶',
    meaning: 'Tượng trưng cho sự tiến triển tuần tự, từng bước vững chắc như cây mọc trên núi cao. Sự kết hợp giữa Phong ở trên và Sơn ở dưới biểu thị sự sinh trưởng tự nhiên, bám rễ sâu vào đá núi trước khi vươn cành đón nắng. Vận thế thuận lợi nếu bạn tuân theo quy luật tự nhiên, không nóng vội gặt hái kết quả.',
    advice: 'Hãy kiên nhẫn tiến bước theo đúng lộ trình đã đặt ra, tuyệt đối tránh tư tưởng đốt cháy giai đoạn. Sự bền bỉ và đúng quy chuẩn đạo đức sẽ đưa bạn đến đỉnh cao vinh quang một cách an toàn nhất.'
  },
  54: {
    name: 'Quy Muội',
    vn: 'Lôi Trạch Quy Muội',
    symbol: '䷵',
    sign: '☳☱',
    meaning: 'Tượng trưng cho việc đặt sai vị trí, sự vội vàng trong cam kết và hành động dựa trên cảm xúc nhất thời. Sự kết hợp giữa Lôi ở trên và Trạch ở dưới biểu thị sự kết hợp thiếu chín chắn, vi phạm các chuẩn mực xã hội truyền thống. Vận thế tiềm ẩn nhiều rủi ro đổ vỡ, lòng người dễ lay động bởi dục vọng và ảo tưởng.',
    advice: 'Hãy nghiêm khắc nhìn nhận lại vai trò và vị trí của mình trong các mối quan hệ hiện tại. Tránh đưa ra quyết định hệ trọng khi tâm trí đang bị xáo trộn bởi những cảm xúc nhất thời.'
  },
  55: {
    name: 'Phong',
    vn: 'Lôi Hỏa Phong',
    symbol: '䷶',
    sign: '☳☲',
    meaning: 'Tượng trưng cho sự thịnh vượng tột bậc, ánh sáng rực rỡ của buổi trưa hè và sự sung túc đầy tràn. Sự kết hợp giữa Lôi ở trên và Hỏa ở dưới tạo nên thế trận huy hoàng, rực rỡ như ánh mặt trời đỉnh điểm. Vận thế đang ở đỉnh cao, song bóng tối của buổi chiều tà cũng bắt đầu chực chờ xuất hiện.',
    advice: 'Hãy tận hưởng và chia sẻ sự thịnh vượng này với mọi người xung quanh trong tinh thần rộng lượng nhất. Đồng thời, hãy chuẩn bị tâm lý và nguồn lực dự phòng cho chu kỳ suy thoái tự nhiên tiếp theo.'
  },
  56: {
    name: 'Lữ',
    vn: 'Hỏa Sơn Lữ',
    symbol: '䷷',
    sign: '☲☶',
    meaning: 'Tượng trưng cho hành trình của người lữ khách phương xa, sự cô đơn và hoàn cảnh biến động không ngừng. Sự kết hợp giữa Hỏa ở trên và Sơn ở dưới biểu thị sự thiếu thốn gốc rễ vững chắc, phải liên tục dịch chuyển như lửa cháy trên sườn núi. Vận thế đòi hỏi khả năng thích ứng cao độ với môi trường mới.',
    advice: 'Hãy giữ thái độ hòa nhã, cẩn trọng trong từng lời ăn tiếng nói khi đặt chân đến những vùng đất lạ. Đi lại nhẹ nhàng và không bám víu vào những vật chất ngoài thân sẽ giúp chuyến đi được bình an.'
  },
  57: {
    name: 'Tốn',
    vn: 'Thuần Tốn',
    symbol: '䷸',
    sign: '☴☴',
    meaning: 'Tượng trưng cho làn gió thổi hiu hiu, sự mềm mại nhu thuận nhưng có sức xuyên thấu vô cùng mạnh mẽ. Sự kết hợp giữa Tốn ở trên và Tốn ở dưới biểu thị sự nhất quán, kiên trì lan tỏa tầm ảnh hưởng đến mọi ngóc ngách của đời sống. Vận thế thuận lợi cho việc giáo hóa, thuyết phục lòng người bằng thái độ ôn hòa.',
    advice: 'Hãy như làn gió mát lành, dùng sự mềm mỏng và kiên trì để uốn nắn những điều cứng nhắc xung quanh bạn. Tránh dùng vũ lực hay sự ép buộc, bởi sự chân thành thấm sâu mới tạo nên thay đổi bền vững.'
  },
  58: {
    name: 'Đoài',
    vn: 'Thuần Đoài',
    symbol: '䷹',
    sign: '☱☱',
    meaning: 'Tượng trưng cho niềm vui thuần khiết, sự trao đổi cởi mở và giao tiếp hài hòa giữa con người với nhau. Sự kết hợp giữa Đoài ở trên và Đoài ở dưới biểu thị hai hồ nước thông nhau, mang lại nguồn nước dồi dào tươi mát và sự đồng cảm sâu sắc. Vận thế cát tường, các cuộc đàm phán và giao tế đều đạt kết quả tốt đẹp.',
    advice: 'Hãy lan tỏa niềm vui chân thành và dùng ngôn từ tử tế để kết nối tâm hồn với mọi người xung quanh. Tránh sa đà vào những lời nịnh hót vô nghĩa hoặc những thú vui tầm thường làm tổn hại đức hạnh.'
  },
  59: {
    name: 'Hoán',
    vn: 'Phong Thủy Hoán',
    symbol: '䷺',
    sign: '☴☵',
    meaning: 'Tượng trưng cho sự gió thổi nước tan, làm tiêu tán những rào cản cứng nhắc và hàn gắn sự chia rẽ. Sự kết hợp giữa Phong ở trên và Thủy ở dưới biểu thị làn gió ấm áp lướt trên mặt nước làm tan băng giá mùa đông, đưa dòng chảy trở lại tự do. Vận thế mở ra cơ hội giảng hòa, tái thiết lập lòng tin sau thời gian ngăn cách.',
    advice: 'Hãy mở rộng lòng bao dung, xóa bỏ định kiến để hòa hợp với những người từng đối lập với mình. Dùng sức mạnh của chính đạo và sự công tâm để quy tụ lòng người hướng về đại cục.'
  },
  60: {
    name: 'Tiết',
    vn: 'Thủy Trạch Tiết',
    symbol: '䷻',
    sign: '☵☱',
    meaning: 'Tượng trưng cho sự tiết chế, giới hạn chừng mực và kỷ luật tự giác tạo nên khuôn khổ vững chắc. Sự kết hợp giữa Thủy ở trên và Trạch ở dưới biểu thị việc đắp đê ngăn lũ, giữ cho lượng nước trong hồ luôn ở mức an toàn ổn định. Vận thế đòi hỏi sự tự giác tiết chế ham muốn để bảo toàn năng lượng cốt lõi.',
    advice: 'Hãy tự thiết lập những giới hạn hợp lý cho bản thân trong sinh hoạt cũng như trong công việc hàng ngày. Tuy nhiên, chớ nên quá khắt khe khiến cuộc sống trở nên ngột ngạt và mất đi sự sáng tạo tự nhiên.'
  },
  61: {
    name: 'Trung Phu',
    vn: 'Phong Trạch Trung Phu',
    symbol: '䷼',
    sign: '☴☱',
    meaning: 'Tượng trưng cho lòng chân thật cốt lõi, sự tin tưởng tuyệt đối thấu suốt lòng người và cảm hóa được cả muôn loài. Sự kết hợp giữa Phong ở trên và Trạch ở dưới biểu thị sự đồng điệu sâu sắc giữa thiên nhiên tự do và lòng đầm lầy phản chiếu chân thực. Vận thế cát tường, sức mạnh của lòng tin sẽ giúp vượt qua những thử thách cam go nhất.',
    advice: 'Hãy đối xử với người khác bằng sự thành thật tuyệt đối xuất phát từ sâu thẳm trái tim mình. Sự chân thành không vụ lợi chính là chiếc chìa khóa vạn năng mở lối vào tâm hồn của muôn loài.'
  },
  62: {
    name: 'Tiểu Quá',
    vn: 'Lôi Sơn Tiểu Quá',
    symbol: '䷽',
    sign: '☳☶',
    meaning: 'Tượng trưng cho sự vượt quá một chút trong các chi tiết nhỏ, sự cẩn trọng tỉ mỉ phù hợp với hoàn cảnh khó khăn. Sự kết hợp giữa Lôi ở trên và Sơn ở dưới biểu thị tiếng sấm nhỏ chưa đủ chấn động núi cao, khuyên người ta nên giữ mình ở vị trí thấp. Vận thế yêu cầu sự khiêm nhường tối đa, tránh mưu cầu đại sự hay hành động táo bạo.',
    advice: 'Hãy tập trung hoàn thiện những công việc nhỏ với sự tận tụy và cẩn mật cao nhất có thể. Trong lúc này, biết thu mình lại và hành xử khiêm tốn chính là cách tốt nhất để tự bảo vệ bản thân.'
  },
  63: {
    name: 'Ký Tế',
    vn: 'Thủy Hỏa Ký Tế',
    symbol: '䷾',
    sign: '☵☲',
    meaning: 'Tượng trưng cho sự hoàn thành viên mãn, mọi việc đã vào đúng vị trí và âm dương đạt trạng thái cânân bằng tuyệt hảo. Sự kết hợp giữa Thủy ở trên và Hỏa ở dưới biểu thị sự tương tác hoàn mỹ giữa nước đun trên lửa tạo ra kết quả tối ưu. Vận thế tuy rất tốt đẹp nhưng đỉnh cao cũng chính là điểm khởi đầu cho sự suy thoái nếu lơ là cảnh giác.',
    advice: 'Hãy giữ vững sự cảnh giác cao độ và duy trì các thành quả đạt được bằng kỷ luật nghiêm ngặt. Tránh thái độ chủ quan tự mãn, bởi sóng gió thường nổi lên từ những nơi bình yên nhất.'
  },
  64: {
    name: 'Vị Tế',
    vn: 'Hỏa Thủy Vị Tế',
    symbol: '䷿',
    sign: '☲☵',
    meaning: 'Tượng trưng cho sự chưa hoàn thành, trạng thái chuyển giao trước ngưỡng cửa của một chu kỳ mới đầy hy vọng. Sự kết hợp giữa Hỏa ở trên và Thủy ở dưới biểu thị hai nguồn năng lượng lửa bốc lên nước chảy xuống chưa giao nhau để tạo nên sự hòa hợp cuối cùng. Vận thế hứa hẹn một tương lai xán lạn nếu bạn kiên trì đi nốt chặng đường còn lại.',
    advice: 'Hãy thận trọng trong từng bước đi cuối cùng trước khi chạm tay vào đích đến của thành công. Giữ vững ngọn lửa nhiệt huyết kết hợp với sự tỉnh táo của trí tuệ để vượt qua khúc cua quyết định.'
  }
};

// Build lookup: binary string (6 bits, bottom to top) → hexagram number
const BINARY_TO_HEX = {};
(function buildLookup() {
  // Trigram binary: ☰=111 ☱=110 ☲=101 ☳=100 ☴=011 ☵=010 ☶=001 ☷=000
  const TRIGRAMS = {
    '111':1,'110':2,'101':3,'100':4,'011':5,'010':6,'001':7,'000':8
  };
  // Upper trigram × 8 + lower trigram → hexagram number (King Wen sequence)
  // This maps [upper_trigram_num][lower_trigram_num] → hex number
  const TABLE = [
    //       ☰  ☱  ☲  ☳  ☴  ☵  ☶  ☷
    /* ☰ */ [ 1,43,14,34, 9, 5,26,11],
    /* ☱ */ [10,58,38,54,61,60,41,19],
    /* ☲ */ [13,49,30,55,37,63,22,36],
    /* ☳ */ [25,17,21,51,42,39,27,24],
    /* ☴ */ [44,28,50,32,57,48,18,46],
    /* ☵ */ [ 6,47,64,40,59,29, 4, 7],
    /* ☶ */ [33,31,56,62,53,39,52,15],
    /* ☷ */ [12,45,35,16,20, 8,23, 2]
  ];
  // trigram index: ☰=0 ☱=1 ☲=2 ☳=3 ☴=4 ☵=5 ☶=6 ☷=7
  const trigramIndex = {'111':0,'110':1,'101':2,'100':3,'011':4,'010':5,'001':6,'000':7};

  for (let upper = 0; upper < 8; upper++) {
    for (let lower = 0; lower < 8; lower++) {
      const upperBits = upper.toString(2).padStart(3, '0');
      const lowerBits = lower.toString(2).padStart(3, '0');
      // Full 6-bit key: lower 3 bits (bottom lines) + upper 3 bits (top lines)
      const key = lowerBits + upperBits;
      BINARY_TO_HEX[key] = TABLE[upper][lower];
    }
  }
})();

function getHexagramFromLines(lines) {
  // lines: array of 6, index 0 = bottom line
  // yang line: value 7 or 9. yin line: value 6 or 8
  const bits = lines.map(v => (v === 7 || v === 9) ? '1' : '0').join('');
  const hexNum = BINARY_TO_HEX[bits];
  return HEXAGRAMS[hexNum] || HEXAGRAMS[1];
}

function getChangedHexagram(lines) {
  // Moving lines: 6=old yin→yang, 9=old yang→yin
  const changed = lines.map(v => {
    if (v === 6) return 7; // old yin becomes yang
    if (v === 9) return 8; // old yang becomes yin
    return v;
  });
  return getHexagramFromLines(changed);
}

function hasMovingLines(lines) {
  return lines.some(v => v === 6 || v === 9);
}

// Generate a coin toss (3 coins) → line value
// Each coin: heads=3, tails=2
// Sum: 6(old yin), 7(young yang), 8(young yin), 9(old yang)
function throwCoins() {
  const coins = [
    Math.random() < 0.5 ? 3 : 2,
    Math.random() < 0.5 ? 3 : 2,
    Math.random() < 0.5 ? 3 : 2
  ];
  return coins.reduce((a, b) => a + b, 0);
}

function buildHexagram() {
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push(throwCoins());
  return lines;
}
