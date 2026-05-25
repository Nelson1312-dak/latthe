/**
 * gieoque/js/hexagrams.js
 * 64 Quẻ Kinh Dịch (I Ching hexagrams)
 * lines: array of 6 values bottom→top: 6=old yin, 7=young yang, 8=young yin, 9=old yang
 * binary key: each line yang=1 yin=0, bottom to top → 6-bit number
 */

const HEXAGRAMS = {
  1:  { name:'Càn',   vn:'Thuần Càn',       symbol:'䷀', sign:'☰☰', meaning:'Sức mạnh sáng tạo của trời. Đây là thời điểm hành động mạnh mẽ, tiến lên với ý chí kiên định. Vận may đang ở phía trước nếu bạn dũng cảm.', advice:'Hãy tiến lên, đừng do dự. Trời đất ủng hộ bạn.' },
  2:  { name:'Khôn',  vn:'Thuần Khôn',      symbol:'䷁', sign:'☷☷', meaning:'Sức mạnh nuôi dưỡng của đất. Hãy kiên nhẫn, tiếp nhận và hỗ trợ người khác. Thành công đến từ sự mềm mại và bền bỉ.', advice:'Theo sau, đừng cố dẫn đầu. Đất nuôi dưỡng vạn vật.' },
  3:  { name:'Truân', vn:'Thủy Lôi Truân',  symbol:'䷂', sign:'☵☳', meaning:'Khó khăn ban đầu. Mọi thứ đang hình thành, còn nhiều hỗn loạn. Hãy kiên nhẫn và tìm sự giúp đỡ.', advice:'Đừng hành động một mình. Xây nền tảng trước.' },
  4:  { name:'Mông',  vn:'Sơn Thủy Mông',   symbol:'䷃', sign:'☶☵', meaning:'Sự ngây thơ và học hỏi. Hãy khiêm tốn nhận lấy sự hướng dẫn. Đây là lúc học, không phải lúc dạy.', advice:'Hãy như học trò chân thành — thầy sẽ xuất hiện.' },
  5:  { name:'Nhu',   vn:'Thủy Thiên Nhu',  symbol:'䷄', sign:'☵☰', meaning:'Chờ đợi với sự tự tin. Nguy hiểm đang phía trước nhưng thời điểm chưa chín muồi. Hãy kiên nhẫn và nuôi dưỡng bản thân.', advice:'Đợi đúng thời điểm. Nước không chảy ngược.' },
  6:  { name:'Tụng',  vn:'Thiên Thủy Tụng', symbol:'䷅', sign:'☰☵', meaning:'Xung đột và tranh chấp. Hãy tránh kiện tụng nếu có thể. Tìm sự hòa giải thay vì đối đầu.', advice:'Nhượng bộ đôi khi mạnh hơn là thắng.' },
  7:  { name:'Sư',    vn:'Địa Thủy Sư',     symbol:'䷆', sign:'☷☵', meaning:'Sức mạnh tập thể. Lãnh đạo với kỷ luật và đạo đức. Tổ chức và hành động tập thể sẽ mang lại chiến thắng.', advice:'Đoàn kết là sức mạnh. Dẫn dắt bằng gương sáng.' },
  8:  { name:'Tỉ',    vn:'Thủy Địa Tỉ',     symbol:'䷇', sign:'☵☷', meaning:'Đoàn kết và liên minh. Hãy tìm kiếm những người đồng tâm và xây dựng mối quan hệ bền vững.', advice:'Ai đứng cạnh bạn? Hãy chọn đồng đội khôn ngoan.' },
  9:  { name:'Tiểu Súc', vn:'Phong Thiên Tiểu Súc', symbol:'䷈', sign:'☴☰', meaning:'Kiềm chế nhỏ. Những trở ngại nhỏ đang làm chậm tiến trình. Hãy tích lũy sức mạnh trong yên lặng.', advice:'Kiên nhẫn trong những điều nhỏ nhoi dẫn đến thành công lớn.' },
  10: { name:'Lý',    vn:'Thiên Trạch Lý',  symbol:'䷉', sign:'☰☱', meaning:'Đi theo con đường đúng đắn dù nguy hiểm. Hành xử đúng mực và tôn trọng lẽ phải dù hoàn cảnh khó khăn.', advice:'Bước trên đuôi hổ — hãy cẩn thận nhưng đừng dừng lại.' },
  11: { name:'Thái',  vn:'Địa Thiên Thái',  symbol:'䷊', sign:'☷☰', meaning:'Hòa bình và thịnh vượng. Trời đất giao hòa — đây là thời điểm tốt lành nhất. Mọi việc đều thuận buồm xuôi gió.', advice:'Tận dụng thời điểm vàng này để hành động lớn.' },
  12: { name:'Bĩ',    vn:'Thiên Địa Bĩ',    symbol:'䷋', sign:'☰☷', meaning:'Trì trệ và đình đốn. Trời đất không giao hòa — tạm thời bế tắc. Hãy rút lui và bảo toàn sức lực.', advice:'Khi đường đóng, đừng ép. Hãy chờ cửa khác mở.' },
  13: { name:'Đồng Nhân', vn:'Thiên Hỏa Đồng Nhân', symbol:'䷌', sign:'☰☲', meaning:'Đồng thuận và hợp tác. Đoàn kết với những người cùng chí hướng. Sức mạnh tập thể sẽ vượt qua mọi trở ngại.', advice:'Cùng nhau làm được những điều không ai làm một mình được.' },
  14: { name:'Đại Hữu', vn:'Hỏa Thiên Đại Hữu', symbol:'䷍', sign:'☲☰', meaning:'Sở hữu lớn lao. Thành công rực rỡ và sung túc. Hãy chia sẻ tài lộc và dùng sức mạnh để làm điều thiện.', advice:'Giàu có thực sự là biết sử dụng những gì mình có.' },
  15: { name:'Khiêm',  vn:'Địa Sơn Khiêm',  symbol:'䷎', sign:'☷☶', meaning:'Khiêm tốn là đức tính cao quý nhất. Người khiêm tốn được thiên hạ kính trọng và thần linh phù hộ.', advice:'Núi cao nhất lại nằm sâu trong lòng đất — đó là khiêm tốn.' },
  16: { name:'Dự',     vn:'Lôi Địa Dự',     symbol:'䷏', sign:'☳☷', meaning:'Hứng khởi và chuẩn bị. Hãy dùng năng lượng tích cực để truyền cảm hứng cho người khác và chuẩn bị chu đáo.', advice:'Niềm vui chia sẻ là niềm vui nhân đôi.' },
  17: { name:'Tùy',    vn:'Trạch Lôi Tùy',  symbol:'䷐', sign:'☱☳', meaning:'Thích nghi và theo đuổi. Hãy linh hoạt và đi theo điều đúng đắn. Sự thích nghi sẽ mang lại thành công.', advice:'Nước chảy theo địa hình — hãy mềm mại và thích nghi.' },
  18: { name:'Cổ',     vn:'Sơn Phong Cổ',   symbol:'䷑', sign:'☶☴', meaning:'Sửa chữa điều suy thoái. Đang có vấn đề từ quá khứ cần được giải quyết. Đây là lúc cải cách và làm mới.', advice:'Đối mặt với vết thương mới lành được.' },
  19: { name:'Lâm',    vn:'Địa Trạch Lâm',  symbol:'䷒', sign:'☷☱', meaning:'Tiếp cận và ảnh hưởng. Thời điểm thuận lợi để mở rộng và tiếp cận điều bạn mong muốn. Hãy hành động ngay.', advice:'Mùa xuân không chờ ai — hãy gieo hạt khi đất tốt.' },
  20: { name:'Quan',   vn:'Phong Địa Quan',  symbol:'䷓', sign:'☴☷', meaning:'Quan sát và chiêm nghiệm. Hãy lùi lại để nhìn toàn cảnh trước khi hành động. Quan sát sâu sắc là nền tảng của khôn ngoan.', advice:'Người hiểu người khác là khôn — người hiểu mình là sáng suốt.' },
  21: { name:'Phệ Hạp', vn:'Hỏa Lôi Phệ Hạp', symbol:'䷔', sign:'☲☳', meaning:'Cắn qua trở ngại. Cần quyết đoán và có hành động cụ thể để vượt qua rào cản. Không được trì hoãn.', advice:'Cắn vào vấn đề — đừng nhai quanh.' },
  22: { name:'Bí',     vn:'Sơn Hỏa Bí',     symbol:'䷕', sign:'☶☲', meaning:'Vẻ đẹp và trang trí. Hình thức quan trọng nhưng không phải tất cả. Hãy chú ý đến cả nội dung bên trong.', advice:'Áo đẹp không làm người đẹp — nhưng áo sạch thể hiện tự trọng.' },
  23: { name:'Bác',    vn:'Sơn Địa Bác',     symbol:'䷖', sign:'☶☷', meaning:'Sụp đổ và tan rã. Đang có lực lượng tiêu cực xói mòn. Hãy rút lui và bảo toàn những gì quan trọng.', advice:'Đứng vững trên nền đất chắc — đừng xây trên cát.' },
  24: { name:'Phục',   vn:'Địa Lôi Phục',   symbol:'䷗', sign:'☷☳', meaning:'Trở lại và phục hồi. Sau thời gian tăm tối, ánh sáng đang quay trở lại. Một chu kỳ mới bắt đầu.', advice:'Hạt mầm đầu tiên sau đông giá — hãy chào đón sự trở lại.' },
  25: { name:'Vô Vọng', vn:'Thiên Lôi Vô Vọng', symbol:'䷘', sign:'☰☳', meaning:'Trong sáng và không ảo tưởng. Hãy hành động tự nhiên và chân thật, không vụ lợi. Sự thật thà sẽ được phúc đức.', advice:'Làm điều tốt mà không cầu thưởng — đó mới là đức hạnh.' },
  26: { name:'Đại Súc', vn:'Sơn Thiên Đại Súc', symbol:'䷙', sign:'☶☰', meaning:'Kiềm chế lớn và tích lũy. Hãy kiên nhẫn tích lũy sức mạnh và kiến thức. Thời điểm vĩ đại sẽ đến.', advice:'Núi chứa đựng sức mạnh của trời — hãy tích lũy để bùng phát.' },
  27: { name:'Di',     vn:'Sơn Lôi Di',     symbol:'䷚', sign:'☶☳', meaning:'Nuôi dưỡng và chăm sóc. Chú ý đến những gì bạn nuôi dưỡng — trong cơ thể, tâm trí và tinh thần.', advice:'Hãy chọn kỹ những gì bạn ăn vào và những gì bạn nói ra.' },
  28: { name:'Đại Quá', vn:'Trạch Phong Đại Quá', symbol:'䷛', sign:'☱☴', meaning:'Vượt quá giới hạn. Tình trạng khẩn cấp đòi hỏi hành động phi thường. Hãy hành động dứt khoát dù rủi ro.', advice:'Đôi khi dầm chịu lũ — không phải vì liều mà vì cần.' },
  29: { name:'Khảm',   vn:'Thuần Khảm',     symbol:'䷜', sign:'☵☵', meaning:'Nguy hiểm kép và thử thách. Đang ở trong vực sâu — nhưng nước vẫn chảy qua. Hãy giữ vững đức hạnh qua gian khó.', advice:'Nước chảy qua đá — không phải vì mạnh mà vì kiên trì.' },
  30: { name:'Ly',     vn:'Thuần Ly',       symbol:'䷝', sign:'☲☲', meaning:'Lửa sáng và sự phụ thuộc. Hãy bám vào điều đúng đắn như ngọn lửa bám vào củi. Sự rõ ràng và sáng suốt là chìa khóa.', advice:'Ánh sáng chỉ đường khi bạn không sợ nhìn thẳng vào nó.' },
  31: { name:'Hàm',    vn:'Trạch Sơn Hàm',  symbol:'䷞', sign:'☱☶', meaning:'Cảm ứng và thu hút. Có sức hút tự nhiên giữa hai lực lượng. Trong tình yêu và công việc, hãy để trái tim dẫn dắt.', advice:'Sự thu hút thật không cần nỗ lực — hãy là chính mình.' },
  32: { name:'Hằng',   vn:'Lôi Phong Hằng', symbol:'䷟', sign:'☳☴', meaning:'Kiên định và bền vững. Thành công đến từ sự nhất quán theo thời gian. Hãy giữ vững nguyên tắc và tiếp tục.', advice:'Không phải nhanh nhất mà là bền nhất mới đến đích.' },
  33: { name:'Độn',    vn:'Thiên Sơn Độn',  symbol:'䷠', sign:'☰☶', meaning:'Lui về và ẩn náu. Đây không phải thất bại mà là chiến thuật khôn ngoan. Rút lui để bảo toàn sức mạnh.', advice:'Biết lúc nào nên rút — đó là dũng cảm thật sự.' },
  34: { name:'Đại Tráng', vn:'Lôi Thiên Đại Tráng', symbol:'䷡', sign:'☳☰', meaning:'Sức mạnh vĩ đại. Bạn đang rất mạnh — hãy dùng sức mạnh đó một cách đúng đắn và có nguyên tắc.', advice:'Sức mạnh không có kỷ luật là sức mạnh nguy hiểm.' },
  35: { name:'Tấn',    vn:'Hỏa Địa Tấn',    symbol:'䷢', sign:'☲☷', meaning:'Tiến lên nhanh chóng. Mặt trời mọc cao — đây là lúc thăng tiến và được công nhận. Hãy hành động tự tin.', advice:'Mặt trời không lo ngại bóng tối — hãy tỏa sáng.' },
  36: { name:'Minh Di', vn:'Địa Hỏa Minh Di', symbol:'䷣', sign:'☷☲', meaning:'Ánh sáng bị che khuất. Đang ở thời kỳ khó khăn hoặc bị hiểu nhầm. Hãy giữ vững trí tuệ trong bóng tối.', advice:'Đèn giấu trong bóng tối không mất ánh sáng — chỉ chờ thời.' },
  37: { name:'Gia Nhân', vn:'Phong Hỏa Gia Nhân', symbol:'䷤', sign:'☴☲', meaning:'Gia đình và cộng đồng. Trật tự trong gia đình là nền tảng của mọi thành công. Hãy vun đắp các mối quan hệ thân cận.', advice:'Nhà yên ấm là nền tảng của mọi sự nghiệp.' },
  38: { name:'Khuê',   vn:'Hỏa Trạch Khuê', symbol:'䷥', sign:'☲☱', meaning:'Đối lập và bất đồng. Đang có sự chia rẽ nhưng cũng có cơ hội tìm điểm chung. Hãy tìm sự hài hòa trong khác biệt.', advice:'Lửa và nước khác nhau nhưng cùng nấu chín thức ăn.' },
  39: { name:'Kiển',   vn:'Thủy Sơn Kiển',  symbol:'䷦', sign:'☵☶', meaning:'Trở ngại và khó khăn. Đường phía trước nguy hiểm. Hãy tìm sự giúp đỡ và suy ngẫm trước khi tiến.', advice:'Núi cao có đường vòng — người khôn biết lúc nào đi thẳng lúc nào đi vòng.' },
  40: { name:'Giải',   vn:'Lôi Thủy Giải',  symbol:'䷧', sign:'☳☵', meaning:'Giải phóng và tháo gỡ. Rào cản đang được dỡ bỏ. Hãy nhanh chóng hành động và trân trọng cơ hội này.', advice:'Khi gút tháo ra — hãy bước qua ngay, đừng ngập ngừng.' },
  41: { name:'Tổn',    vn:'Sơn Trạch Tổn',  symbol:'䷨', sign:'☶☱', meaning:'Giảm bớt và hy sinh. Đôi khi cần bớt đi để thêm vào. Sự đơn giản và hy sinh có mục đích sẽ mang lại kết quả tốt.', advice:'Bớt đi điều thừa để thêm vào điều cốt lõi.' },
  42: { name:'Ích',    vn:'Phong Lôi Ích',   symbol:'䷩', sign:'☴☳', meaning:'Gia tăng và lợi ích. Đây là thời điểm thuận lợi để phát triển và giúp đỡ người khác. Mọi nỗ lực đều sinh trái ngọt.', advice:'Chia sẻ lợi nhuận là cách nhân lên lợi nhuận.' },
  43: { name:'Quải',   vn:'Trạch Thiên Quải', symbol:'䷪', sign:'☱☰', meaning:'Quyết tâm và đột phá. Đã đến lúc đối mặt dứt khoát với vấn đề. Hãy công khai và kiên quyết.', advice:'Nói thẳng — sự mơ hồ chỉ kéo dài vấn đề.' },
  44: { name:'Cấu',    vn:'Thiên Phong Cấu', symbol:'䷫', sign:'☰☴', meaning:'Gặp gỡ bất ngờ. Có điều gì đó hoặc ai đó đang tiếp cận bạn. Hãy cảnh giác với ảnh hưởng tiêu cực.', advice:'Không phải mọi cơ hội xuất hiện đột ngột đều là may mắn.' },
  45: { name:'Tụy',    vn:'Trạch Địa Tụy',  symbol:'䷬', sign:'☱☷', meaning:'Tụ họp và đoàn kết. Đây là thời điểm tụ tập cộng đồng và xây dựng sức mạnh tập thể.', advice:'Giọt nước nhỏ tụ lại thành biển cả.' },
  46: { name:'Thăng',  vn:'Địa Phong Thăng', symbol:'䷭', sign:'☷☴', meaning:'Tiến lên và thăng tiến. Hãy tiếp tục tiến về phía trước với sự khiêm tốn. Thành công đang đến dần dần nhưng chắc chắn.', advice:'Cây từ từ lớn nhưng bền vững hơn hoa nở sớm tàn.' },
  47: { name:'Khốn',   vn:'Trạch Thủy Khốn', symbol:'䷮', sign:'☱☵', meaning:'Kiệt sức và bế tắc. Đang trong giai đoạn khó khăn nhất. Hãy giữ vững phẩm giá và không từ bỏ giá trị của mình.', advice:'Anh hùng lộ diện trong lúc khốn cùng.' },
  48: { name:'Tỉnh',   vn:'Thủy Phong Tỉnh', symbol:'䷯', sign:'☵☴', meaning:'Giếng nước và nguồn cội. Hãy tìm về nguồn gốc và những giá trị cơ bản. Trí tuệ cộng đồng luôn sẵn có.', advice:'Giếng không cạn nếu được khai thác đúng cách.' },
  49: { name:'Cách',   vn:'Trạch Hỏa Cách',  symbol:'䷰', sign:'☱☲', meaning:'Cách mạng và thay đổi. Đây là lúc cải cách sâu sắc. Thay đổi là cần thiết và sẽ được ủng hộ.', advice:'Mùa thay đổi không hỏi ý kiến — hãy sẵn sàng.' },
  50: { name:'Đỉnh',   vn:'Hỏa Phong Đỉnh',  symbol:'䷱', sign:'☲☴', meaning:'Vạc lớn và văn minh. Hãy nuôi dưỡng tinh thần và sử dụng tài năng để phục vụ mục đích cao cả.', advice:'Nấu chín trí tuệ — đừng chỉ thu thập nguyên liệu thô.' },
  51: { name:'Chấn',   vn:'Thuần Chấn',      symbol:'䷲', sign:'☳☳', meaning:'Sấm sét và cú sốc. Sự kiện đột ngột sẽ làm bạn thức tỉnh. Hãy đón nhận với bình tĩnh và học hỏi từ nó.', advice:'Sấm không đánh người kính sợ trời đất.' },
  52: { name:'Cấn',    vn:'Thuần Cấn',       symbol:'䷳', sign:'☶☶', meaning:'Tĩnh lặng và dừng lại. Đây là lúc thiền định và không hành động. Sự bất động có sức mạnh riêng của nó.', advice:'Núi không chạy đua với ai — nhưng ai cũng thấy núi.' },
  53: { name:'Tiệm',   vn:'Phong Sơn Tiệm',  symbol:'䷴', sign:'☴☶', meaning:'Tiến triển từ từ. Hãy kiên nhẫn và tuân theo trình tự tự nhiên. Không thể đốt cháy giai đoạn trong những điều quan trọng.', advice:'Chim nhạn bay từng bước — đừng vội vàng khi chưa sẵn sàng.' },
  54: { name:'Quy Muội', vn:'Lôi Trạch Quy Muội', symbol:'䷵', sign:'☳☱', meaning:'Hôn nhân và cam kết. Hãy rõ ràng về vị trí và vai trò của mình trong mối quan hệ. Tránh hành động dại dột vì cảm xúc nhất thời.', advice:'Biết mình là ai trong mỗi mối quan hệ.' },
  55: { name:'Phong',   vn:'Lôi Hỏa Phong',  symbol:'䷶', sign:'☳☲', meaning:'Sung mãn và đỉnh cao. Đây là thời điểm đỉnh cao — hãy tận dụng nhưng nhớ rằng mọi đỉnh cao đều có lúc xuống.', advice:'Thịnh cực thì suy — hãy khôn ngoan khi đang thịnh.' },
  56: { name:'Lữ',     vn:'Hỏa Sơn Lữ',     symbol:'䷷', sign:'☲☶', meaning:'Lữ hành và xa quê. Bạn đang hoặc cần ở trong trạng thái tạm thời. Hãy thích nghi nhanh và không bám víu.', advice:'Người lữ hành nhẹ hành lý đi xa hơn.' },
  57: { name:'Tốn',    vn:'Thuần Tốn',       symbol:'䷸', sign:'☴☴', meaning:'Gió nhẹ và thâm nhập. Hãy kiên nhẫn và liên tục như gió. Ảnh hưởng lâu dài đến từ sự nhất quán, không phải từ cú đấm.', advice:'Gió không thấy được nhưng uốn cong được cây.' },
  58: { name:'Đoài',   vn:'Thuần Đoài',      symbol:'䷹', sign:'☱☱', meaning:'Niềm vui và giao tiếp. Hãy chia sẻ niềm vui và học hỏi qua trao đổi. Đây là lúc của sự vui vẻ và kết nối.', advice:'Nụ cười chân thật mở được cánh cửa đóng.' },
  59: { name:'Hoán',   vn:'Phong Thủy Hoán', symbol:'䷺', sign:'☴☵', meaning:'Tan rã và phân tán. Những rào cản cứng nhắc đang được hòa tan. Hãy để sự cởi mở chữa lành chia rẽ.', advice:'Tan chảy không phải là mất — đó là trở về với tổng thể.' },
  60: { name:'Tiết',   vn:'Thủy Trạch Tiết', symbol:'䷻', sign:'☵☱', meaning:'Tiết chế và giới hạn. Hãy đặt ra giới hạn rõ ràng và hợp lý. Kỷ luật tạo ra tự do thực sự.', advice:'Bờ sông giúp nước chảy đúng hướng.' },
  61: { name:'Trung Phu', vn:'Phong Trạch Trung Phu', symbol:'䷼', sign:'☴☱', meaning:'Sự thành thật và tin tưởng. Hãy hành động xuất phát từ lòng chân thật. Sự thành thật tạo ra kết nối sâu sắc nhất.', advice:'Lòng thành thật thấu suốt mọi trái tim.' },
  62: { name:'Tiểu Quá', vn:'Lôi Sơn Tiểu Quá', symbol:'䷽', sign:'☳☶', meaning:'Vượt quá một chút. Hãy cẩn thận không vượt quá giới hạn. Những bước nhỏ cẩn thận phù hợp hơn những bước táo bạo lúc này.', advice:'Đôi khi ít hơn một chút lại tốt hơn đúng mức.' },
  63: { name:'Ký Tế',  vn:'Thủy Hỏa Ký Tế', symbol:'䷾', sign:'☵☲', meaning:'Hoàn thành và cân bằng. Mọi thứ đang ở đúng chỗ — nhưng đây không phải là lúc buông lỏng. Hãy duy trì cảnh giác.', advice:'Thành công không phải điểm kết thúc mà là điểm khởi đầu mới.' },
  64: { name:'Vị Tế',  vn:'Hỏa Thủy Vị Tế', symbol:'䷿', sign:'☲☵', meaning:'Chưa hoàn thành. Bạn đang đứng trước ngưỡng cửa chuyển hóa lớn. Hãy thận trọng trong những bước cuối cùng.', advice:'Gần đến đích nhất thì càng cần cẩn thận nhất.' }
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
