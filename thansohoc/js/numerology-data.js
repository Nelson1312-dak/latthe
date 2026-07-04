/**
 * thansohoc/js/numerology-data.js
 * All interpretation content for the numerology module — per-number meanings
 * for each of the 6 core indicators, plus the personality-arrow texts.
 * Loaded before app.js (exposes globals NUM_MEANINGS, INDICATOR_NAMES, ARROWS_INFO).
 *
 * Master numbers are keyed "11" / "22" / "33". Life Path additionally keeps the
 * traditional dual notation "22/4" and "33/6".
 */

const INDICATOR_NAMES = {
  lifepath:    "Số Chủ Đạo (Life Path)",
  destiny:     "Số Sứ Mệnh (Expression)",
  soul:        "Số Linh Hồn (Soul Urge)",
  personality: "Số Nhân Cách (Personality)",
  birthday:    "Số Ngày Sinh (Birth Day)",
  attitude:    "Số Thái Độ (Attitude)",
};

const NUM_MEANINGS = {
  // ============================================================
  // SỐ CHỦ ĐẠO — bài học & hành trình đường đời
  // ============================================================
  lifepath: {
    "1": "<h4>Người Lãnh Đạo & Tiên Phong</h4><p>Bạn đến thế gian để học cách <strong>độc lập, tự chủ và dẫn đầu</strong>. Bạn có ý chí mạnh mẽ, óc sáng tạo và bản lĩnh dám đi con đường riêng không ai dám đi.</p><h4>Lời khuyên:</h4><ul><li>Tin vào chính mình nhưng tránh độc đoán, áp đặt.</li><li>Học cách lắng nghe và hợp tác thay vì làm tất cả một mình.</li><li>Kiên trì với mục tiêu, đừng bỏ cuộc khi gặp phản đối.</li></ul>",
    "2": "<h4>Người Hòa Giải & Kết Nối</h4><p>Bạn sở hữu tần số nhạy cảm cao, trực giác nhạy bén, khả năng thấu cảm và lắng nghe xuất sắc. Bạn thích làm việc nhóm hơn là dẫn đầu, là nhân tố hòa giải tuyệt vời trong mọi xung đột.</p><h4>Lời khuyên:</h4><ul><li>Học cách nói 'không' khi cần thiết.</li><li>Tin tưởng vào trực giác của mình.</li><li>Tránh gánh vác cảm xúc tiêu cực của người khác.</li></ul>",
    "3": "<h4>Người Truyền Cảm Hứng & Sáng Tạo</h4><p>Bạn là người có tư duy nhanh nhạy, hoạt ngôn, có khiếu hài hước và khả năng truyền đạt xuất sắc. Bạn tỏa sáng khi được thể hiện sự sáng tạo và năng lượng trí tuệ.</p><h4>Lời khuyên:</h4><ul><li>Tránh chỉ trích người khác bằng lời nói sắc bén.</li><li>Tập trung năng lượng vào dự án cụ thể, tránh phân tán.</li><li>Rèn luyện tính kiên nhẫn.</li></ul>",
    "4": "<h4>Người Kiến Tạo & Kỷ Luật</h4><p>Bạn thực tế, ngăn nắp, coi trọng tính chính xác và an toàn. Bạn là điểm tựa vững chắc, đáng tin cậy trong công việc lẫn cuộc sống gia đình nhờ sự chăm chỉ và nguyên tắc.</p><h4>Lời khuyên:</h4><ul><li>Học cách linh hoạt và mở lòng đón nhận thay đổi.</li><li>Tránh làm việc quá sức (workaholic).</li><li>Dành thời gian phát triển thế giới tinh thần.</li></ul>",
    "5": "<h4>Người Khám Phá & Tự Do</h4><p>Năng lượng của bạn là tự do, phiêu lưu, thích trải nghiệm những điều mới lạ. Bạn có óc sáng tạo cao, giàu lòng trắc ẩn và rất linh hoạt trong mọi hoàn cảnh.</p><h4>Lời khuyên:</h4><ul><li>Xây dựng kỷ luật tự thân để tránh mất phương hướng.</li><li>Tránh các thói quen tiêu cực do ham muốn tự do thái quá.</li><li>Suy nghĩ kỹ trước khi đưa ra quyết định lớn.</li></ul>",
    "6": "<h4>Người Nuôi Dưỡng & Trách Nhiệm</h4><p>Bạn mang năng lượng của tình yêu thương gia đình, sự chăm sóc và trách nhiệm cao cả. Bạn có khiếu thẩm mỹ tốt và khát khao cống hiến vẻ đẹp cho đời.</p><h4>Lời khuyên:</h4><ul><li>Học cách chăm sóc bản thân trước khi lo cho người khác.</li><li>Tránh áp đặt tiêu chuẩn hoàn hảo lên người thân.</li><li>Bớt lo lắng thái quá về những chuyện chưa xảy ra.</li></ul>",
    "7": "<h4>Người Tìm Kiếm Chân Lý</h4><p>Bạn thích tự mình trải nghiệm để đúc rút bài học sâu sắc. Bạn có năng lượng của một nhà triết học, nhà nghiên cứu tâm linh hoặc người dẫn đường bằng trí tuệ thực chứng.</p><h4>Lời khuyên:</h4><ul><li>Tránh tự cô lập bản thân quá lâu.</li><li>Nhìn nhận thất bại như bài học quý giá thay vì oán trách.</li><li>Chia sẻ kiến thức rộng rãi hơn.</li></ul>",
    "8": "<h4>Người Bản Lĩnh & Thịnh Vượng</h4><p>Bạn độc lập, tự chủ, có năng lực quản lý và thu hút sự thịnh vượng vật chất mạnh mẽ. Tuy nhiên, sâu thẳm bên trong bạn là một người giàu lòng trắc ẩn và tình cảm ấm áp.</p><h4>Lời khuyên:</h4><ul><li>Học cách thể hiện cảm xúc và tình yêu thương rõ ràng hơn.</li><li>Tránh để cái tôi và lòng kiêu hãnh cản trở mối quan hệ.</li><li>Cân bằng giữa thế giới vật chất và tinh thần.</li></ul>",
    "9": "<h4>Người Nhân Ái & Hoài Bão</h4><p>Bạn mang hoài bão lớn, giàu lý tưởng xã hội, luôn hướng về cộng đồng và sự nhân văn. Bạn sống có trách nhiệm và sẵn sàng tha thứ, giúp đỡ người khác.</p><h4>Lời khuyên:</h4><ul><li>Học cách kiên định và thực tế hơn trong kế hoạch cá nhân.</li><li>Đừng để những thất vọng về thế giới làm bạn chán nản.</li><li>Giải quyết những vết thương lòng trong quá khứ.</li></ul>",
    "11": "<h4>Người Dẫn Đường Tâm Linh (Master 11)</h4><p>Bạn sở hữu trực giác siêu nhạy, khả năng tâm linh bẩm sinh và nhận thức sâu sắc về thế giới tinh thần. Bạn ở đây để mang ánh sáng nhận thức và hòa bình đến cho nhân loại.</p><h4>Lời khuyên:</h4><ul><li>Cân bằng cảm xúc cá nhân để tránh căng thẳng thần kinh.</li><li>Tránh xa cám dỗ vật chất làm mờ đi sứ mệnh.</li><li>Thực hành thiền định hoặc kết nối thiên nhiên.</li></ul>",
    "22/4": "<h4>Người Kiến Tạo Vĩ Đại (Master 22/4)</h4><p>Được coi là con số mạnh nhất trong Thần số học. Bạn kết hợp trực giác nhạy bén của số 11 và tính thực tế vững chắc của số 4, có khả năng hiện thực hóa những ý tưởng vĩ mô có tầm ảnh hưởng lớn.</p><h4>Lời khuyên:</h4><ul><li>Tránh cái bẫy của tham vọng quá mức hoặc lười biếng.</li><li>Gánh trách nhiệm lớn lao với sự khiêm tốn.</li><li>Cân bằng năng lượng thể chất và tinh thần.</li></ul>",
    "33/6": "<h4>Người Thầy Chữa Lành Vĩ Đại (Master 33/6)</h4><p>Bạn mang năng lượng của lòng vị tha thuần khiết, tình yêu thương vô điều kiện và sức mạnh sáng tạo nghệ thuật vượt trội. Bạn truyền cảm hứng và nâng đỡ tinh thần cho nhân loại.</p><h4>Lời khuyên:</h4><ul><li>Tránh hy sinh bản thân đến mức kiệt quệ năng lượng.</li><li>Học cách thiết lập ranh giới lành mạnh.</li><li>Tin tưởng vào con đường nghệ thuật/chữa lành.</li></ul>",
  },

  // ============================================================
  // SỐ SỨ MỆNH — mục tiêu, tài năng cần phát triển, cách thể hiện
  // ============================================================
  destiny: {
    "1": "<h4>Sứ mệnh Tiên Phong</h4><p>Mục tiêu đời bạn là trở thành người <strong>khởi xướng và dẫn dắt</strong> — đứng đầu một lĩnh vực, khởi nghiệp hoặc tạo ra điều chưa từng có. Tài năng cần phát triển là sự tự tin, quyết đoán và khả năng tự đứng trên đôi chân mình.</p>",
    "2": "<h4>Sứ mệnh Kết Nối</h4><p>Bạn được sinh ra để <strong>hợp tác, hòa giải và xây dựng quan hệ</strong>. Thành công lớn nhất đến qua làm việc cùng người khác — ngoại giao, tư vấn, cộng sự. Hãy phát triển sự kiên nhẫn, tinh tế và khả năng đặt mình vào vị trí người khác.</p>",
    "3": "<h4>Sứ mệnh Sáng Tạo & Lan Tỏa</h4><p>Mục tiêu của bạn là <strong>truyền cảm hứng và làm đẹp cuộc sống</strong> qua ngôn từ, nghệ thuật, giao tiếp. Bạn cần học cách kỷ luật để biến tài năng phong phú thành tác phẩm hoàn chỉnh thay vì bỏ dở giữa chừng.</p>",
    "4": "<h4>Sứ mệnh Xây Dựng Nền Tảng</h4><p>Bạn đến để <strong>kiến tạo những thứ bền vững</strong> — hệ thống, tổ chức, công trình, gia đình vững chãi. Tài năng cần phát huy là tính kỷ luật, sự tỉ mỉ và khả năng biến kế hoạch thành hiện thực qua lao động bền bỉ.</p>",
    "5": "<h4>Sứ mệnh Khai Phá & Truyền Bá</h4><p>Mục tiêu của bạn là <strong>mang đến sự thay đổi và tự do</strong> — kết nối con người, lan tỏa ý tưởng, trải nghiệm đa dạng. Hãy phát triển khả năng thích nghi và biết chọn lọc giữa muôn vàn cơ hội để không phân tán.</p>",
    "6": "<h4>Sứ mệnh Chăm Sóc & Chữa Lành</h4><p>Bạn được giao trọng trách <strong>nuôi dưỡng, bảo bọc và mang lại sự hài hòa</strong> cho cộng đồng và gia đình. Tài năng của bạn nằm ở sự tận tụy, thẩm mỹ và trách nhiệm — nhưng cần học cách cho đi mà không đánh mất chính mình.</p>",
    "7": "<h4>Sứ mệnh Tìm Kiếm Sự Thật</h4><p>Mục tiêu đời bạn là <strong>nghiên cứu, phân tích và khám phá những tầng sâu</strong> của tri thức và tâm linh. Bạn cống hiến cho thế giới bằng trí tuệ và sự thông thái — hãy học cách chia sẻ thay vì giữ riêng cho mình.</p>",
    "8": "<h4>Sứ mệnh Quyền Lực & Thịnh Vượng</h4><p>Bạn sinh ra để <strong>quản trị, lãnh đạo và tạo ra giá trị vật chất lớn</strong>. Sứ mệnh là làm chủ tiền bạc và quyền lực một cách chính trực, dùng nguồn lực để kiến tạo. Cần cân bằng tham vọng với đạo đức và lòng nhân ái.</p>",
    "9": "<h4>Sứ mệnh Phụng Sự Nhân Loại</h4><p>Mục tiêu cao cả của bạn là <strong>cho đi và phục vụ cộng đồng</strong> bằng lòng nhân ái và tầm nhìn rộng. Bạn thành công khi sống vì điều lớn hơn bản thân — nghệ thuật, từ thiện, lý tưởng. Hãy học cách buông bỏ và tha thứ.</p>",
    "11": "<h4>Sứ mệnh Truyền Cảm Hứng (Master 11)</h4><p>Bạn mang sứ mệnh <strong>khai sáng và nâng đỡ tinh thần</strong> nhân loại bằng trực giác và tầm nhìn vượt thời đại. Năng lượng của bạn rất mạnh nhưng nhạy cảm — cần làm chủ cảm xúc để tỏa sáng đúng vai trò người dẫn đường.</p>",
    "22": "<h4>Sứ mệnh Kiến Tạo Vĩ Đại (Master 22)</h4><p>Bạn đến để <strong>biến những giấc mơ lớn thành hiện thực hữu hình</strong> có lợi cho số đông — công trình, tổ chức, di sản. Kết hợp tầm nhìn của 11 và sức xây dựng của 4, bạn có thể để lại dấu ấn lâu dài nếu dám gánh trách nhiệm.</p>",
    "33": "<h4>Sứ mệnh Người Thầy Chữa Lành (Master 33)</h4><p>Sứ mệnh hiếm có: <strong>yêu thương và chữa lành vô điều kiện</strong>, nâng đỡ nhân loại bằng sự tận hiến. Bạn là tấm gương của lòng vị tha — hãy phụng sự bằng trái tim rộng mở nhưng nhớ giữ gìn năng lượng cho chính mình.</p>",
  },

  // ============================================================
  // SỐ LINH HỒN — khao khát nội tâm, điều khiến bạn hạnh phúc
  // ============================================================
  soul: {
    "1": "<h4>Khao khát được Độc Lập</h4><p>Sâu thẳm bên trong, bạn khao khát <strong>tự chủ, được công nhận và dẫn đầu</strong>. Bạn hạnh phúc nhất khi được tự quyết định cuộc đời mình và đạt thành tựu bằng chính nỗ lực bản thân.</p>",
    "2": "<h4>Khao khát Yêu Thương & Bình Yên</h4><p>Nội tâm bạn mong mỏi <strong>sự gắn kết, hòa hợp và được yêu thương</strong>. Bạn tìm thấy bình yên trong những mối quan hệ sâu sắc, sự đồng điệu và một môi trường êm đềm, không xung đột.</p>",
    "3": "<h4>Khao khát được Thể Hiện</h4><p>Trái tim bạn khao khát <strong>được sáng tạo, được nói lên và lan tỏa niềm vui</strong>. Bạn hạnh phúc khi được tự do biểu đạt cảm xúc, nghệ thuật và kết nối với mọi người bằng sự lạc quan.</p>",
    "4": "<h4>Khao khát Sự Ổn Định</h4><p>Bên trong, bạn mong muốn <strong>an toàn, trật tự và một nền tảng vững chắc</strong>. Bạn cảm thấy bình yên khi mọi thứ rõ ràng, có kế hoạch và khi xây dựng được điều gì đó bền lâu cho mình và người thân.</p>",
    "5": "<h4>Khao khát Tự Do</h4><p>Linh hồn bạn khao khát <strong>tự do, trải nghiệm và sự đổi mới không ngừng</strong>. Bạn hạnh phúc khi được khám phá, dịch chuyển và không bị ràng buộc bởi khuôn khổ hay thói quen tù túng.</p>",
    "6": "<h4>Khao khát được Chăm Sóc & Cống Hiến</h4><p>Nội tâm bạn mong mỏi <strong>một mái ấm, được yêu thương và chăm sóc người khác</strong>. Bạn tìm thấy ý nghĩa khi gia đình hòa thuận và khi mang vẻ đẹp, sự ấm áp đến cho những người quanh mình.</p>",
    "7": "<h4>Khao khát Sự Thấu Hiểu</h4><p>Sâu bên trong, bạn khao khát <strong>tri thức, sự tĩnh lặng và chân lý</strong>. Bạn hạnh phúc khi có không gian riêng để suy ngẫm, nghiên cứu và kết nối với những tầng ý nghĩa sâu xa của cuộc sống.</p>",
    "8": "<h4>Khao khát Thành Tựu</h4><p>Trái tim bạn mong muốn <strong>thành công, sự sung túc và được nể trọng</strong>. Bạn cảm thấy trọn vẹn khi làm chủ được nguồn lực, đạt mục tiêu lớn và dùng quyền lực của mình một cách xứng đáng.</p>",
    "9": "<h4>Khao khát được Cho Đi</h4><p>Linh hồn bạn khao khát <strong>phụng sự, yêu thương nhân loại và sống vì lý tưởng</strong>. Bạn hạnh phúc nhất khi giúp được người khác và cảm thấy mình đang góp phần làm thế giới tốt đẹp hơn.</p>",
    "11": "<h4>Khao khát Khai Sáng (Master 11)</h4><p>Nội tâm bạn mong mỏi <strong>kết nối tâm linh và truyền cảm hứng</strong> cho người khác. Bạn tìm thấy ý nghĩa sâu sắc khi sống theo trực giác và mang ánh sáng, sự bình an đến cho những người xung quanh.</p>",
    "22": "<h4>Khao khát Để Lại Di Sản (Master 22)</h4><p>Sâu thẳm, bạn khao khát <strong>tạo ra điều vĩ đại và lâu bền</strong> cho số đông. Bạn hạnh phúc khi biến tầm nhìn lớn thành hiện thực và thấy công sức của mình tạo ảnh hưởng tích cực đến cộng đồng.</p>",
    "33": "<h4>Khao khát Chữa Lành (Master 33)</h4><p>Trái tim bạn mong mỏi <strong>yêu thương và chữa lành vô điều kiện</strong>. Bạn tìm thấy bình yên trọn vẹn khi nâng đỡ tinh thần người khác và lan tỏa lòng từ bi không vụ lợi.</p>",
  },

  // ============================================================
  // SỐ NHÂN CÁCH — ấn tượng bên ngoài, cách người khác nhìn bạn
  // ============================================================
  personality: {
    "1": "<h4>Vẻ ngoài Mạnh Mẽ & Quyết Đoán</h4><p>Người khác nhìn bạn như một người <strong>tự tin, độc lập và có khí chất lãnh đạo</strong>. Bạn toát ra sự bản lĩnh, dứt khoát — đôi khi khiến người ta thấy hơi xa cách hoặc khó gần lúc đầu.</p>",
    "2": "<h4>Vẻ ngoài Dịu Dàng & Thân Thiện</h4><p>Bạn để lại ấn tượng <strong>nhẹ nhàng, tinh tế và dễ gần</strong>. Mọi người cảm thấy được lắng nghe và thoải mái bên bạn, xem bạn là người đáng tin và biết quan tâm.</p>",
    "3": "<h4>Vẻ ngoài Cuốn Hút & Vui Tươi</h4><p>Bạn tỏa ra năng lượng <strong>lạc quan, hoạt ngôn và đầy sức sống</strong>. Người khác bị thu hút bởi sự duyên dáng, hài hước và khả năng làm bừng sáng bầu không khí của bạn.</p>",
    "4": "<h4>Vẻ ngoài Đáng Tin & Vững Vàng</h4><p>Bạn cho người khác cảm giác <strong>chững chạc, nghiêm túc và đáng tin cậy</strong>. Mọi người xem bạn là người thực tế, có trách nhiệm — chỗ dựa chắc chắn khi cần giải quyết việc quan trọng.</p>",
    "5": "<h4>Vẻ ngoài Năng Động & Tự Do</h4><p>Bạn toát lên sự <strong>linh hoạt, phóng khoáng và thú vị</strong>. Người khác thấy bạn cuốn hút, ưa khám phá và khó đoán — một người luôn mang đến làn gió mới và cảm giác phiêu lưu.</p>",
    "6": "<h4>Vẻ ngoài Ấm Áp & Trách Nhiệm</h4><p>Bạn để lại ấn tượng <strong>nhân hậu, có gu thẩm mỹ và đáng mến</strong>. Mọi người cảm nhận được sự che chở, quan tâm từ bạn và thường tìm đến bạn để được an ủi, sẻ chia.</p>",
    "7": "<h4>Vẻ ngoài Bí Ẩn & Sâu Sắc</h4><p>Bạn mang một vẻ <strong>trầm tĩnh, trí tuệ và hơi khó đoán</strong>. Người khác cảm thấy ở bạn có chiều sâu, sự uyên bác — đôi khi thấy bạn kín đáo, cần thời gian mới thật sự hiểu.</p>",
    "8": "<h4>Vẻ ngoài Quyền Uy & Thành Đạt</h4><p>Bạn toát ra khí chất <strong>bản lĩnh, chuyên nghiệp và thành công</strong>. Mọi người cảm nhận được sự uy tín, tham vọng và năng lực điều hành ở bạn ngay từ ấn tượng đầu.</p>",
    "9": "<h4>Vẻ ngoài Bao Dung & Cao Thượng</h4><p>Bạn để lại ấn tượng <strong>nhân ái, rộng lượng và có chiều sâu nhân văn</strong>. Người khác thấy ở bạn sự bao dung, lý tưởng và một tấm lòng hướng về điều tốt đẹp lớn lao.</p>",
    "11": "<h4>Vẻ ngoài Truyền Cảm Hứng (Master 11)</h4><p>Bạn tỏa ra một <strong>khí chất đặc biệt, cuốn hút và đầy nội lực tinh thần</strong>. Người khác cảm nhận được sự nhạy cảm, trực giác và nguồn cảm hứng toát ra từ con người bạn.</p>",
    "22": "<h4>Vẻ ngoài Tầm Vóc (Master 22)</h4><p>Bạn mang phong thái của người <strong>có tầm nhìn và năng lực kiến tạo lớn</strong>. Mọi người cảm nhận được sự vững vàng kết hợp với chiều sâu — một người vừa thực tế vừa có lý tưởng cao.</p>",
    "33": "<h4>Vẻ ngoài Từ Bi (Master 33)</h4><p>Bạn toát ra <strong>sự ấm áp bao trùm và lòng từ bi hiếm có</strong>. Người khác cảm thấy được chữa lành, được nâng đỡ tinh thần khi ở bên bạn.</p>",
  },

  // ============================================================
  // SỐ NGÀY SINH — tài năng bẩm sinh, món quà của vũ trụ
  // ============================================================
  birthday: {
    "1": "<h4>Năng khiếu Lãnh Đạo</h4><p>Vũ trụ ban tặng bạn <strong>khả năng tiên phong và tự lập bẩm sinh</strong>. Bạn có sẵn sự quyết đoán và ý chí để khởi xướng, dẫn dắt — một món quà giúp bạn vượt khó ngay từ sớm.</p>",
    "2": "<h4>Năng khiếu Thấu Cảm</h4><p>Bạn sinh ra với <strong>trực giác và khả năng kết nối con người tinh tế</strong>. Tài năng tự nhiên của bạn là lắng nghe, hòa giải và làm dịu mọi căng thẳng quanh mình.</p>",
    "3": "<h4>Năng khiếu Sáng Tạo</h4><p>Món quà của bạn là <strong>khả năng diễn đạt, nghệ thuật và sự duyên dáng bẩm sinh</strong>. Bạn dễ dàng truyền cảm hứng và làm vui lòng người khác qua ngôn từ và sự sáng tạo.</p>",
    "4": "<h4>Năng khiếu Tổ Chức</h4><p>Bạn được trời phú <strong>tính kỷ luật, tỉ mỉ và khả năng xây dựng nền tảng</strong>. Tài năng tự nhiên là biến ý tưởng thành hệ thống thực tế, chắc chắn và đáng tin.</p>",
    "5": "<h4>Năng khiếu Thích Ứng</h4><p>Vũ trụ ban cho bạn <strong>sự linh hoạt, nhanh nhẹn và bản năng phiêu lưu</strong>. Bạn dễ dàng thích nghi với mọi hoàn cảnh và nắm bắt cơ hội mới mẻ trước người khác.</p>",
    "6": "<h4>Năng khiếu Chăm Sóc</h4><p>Món quà của bạn là <strong>lòng yêu thương, tinh thần trách nhiệm và khiếu thẩm mỹ</strong>. Bạn có bản năng che chở, nuôi dưỡng và làm đẹp cho không gian sống quanh mình.</p>",
    "7": "<h4>Năng khiếu Phân Tích</h4><p>Bạn sinh ra với <strong>trí tuệ sắc bén và khả năng nhìn thấu bản chất</strong>. Tài năng tự nhiên là nghiên cứu, suy ngẫm và khám phá những điều ẩn sâu mà người khác bỏ qua.</p>",
    "8": "<h4>Năng khiếu Quản Trị</h4><p>Vũ trụ ban tặng bạn <strong>bản lĩnh kinh doanh và năng lực quản lý nguồn lực</strong>. Bạn có sẵn nhạy bén với tiền bạc, quyền lực và khả năng tổ chức để đạt thành tựu lớn.</p>",
    "9": "<h4>Năng khiếu Nhân Văn</h4><p>Món quà của bạn là <strong>lòng trắc ẩn, tầm nhìn rộng và tâm hồn nghệ sĩ</strong>. Bạn có bản năng đồng cảm và mong muốn cống hiến cho điều gì đó lớn lao hơn bản thân.</p>",
    "11": "<h4>Năng khiếu Trực Giác (Master 11)</h4><p>Bạn được ban <strong>trực giác siêu nhạy và khả năng truyền cảm hứng bẩm sinh</strong>. Đây là món quà tâm linh mạnh mẽ giúp bạn cảm nhận điều người khác không thấy.</p>",
    "22": "<h4>Năng khiếu Kiến Tạo (Master 22)</h4><p>Vũ trụ trao cho bạn <strong>khả năng hiện thực hóa những ý tưởng lớn</strong>. Bạn có sẵn cả tầm nhìn lẫn sự thực tế để xây dựng những điều có ảnh hưởng lâu dài.</p>",
  },

  // ============================================================
  // SỐ THÁI ĐỘ — phản xạ tự nhiên trước tình huống, ấn tượng ban đầu
  // ============================================================
  attitude: {
    "1": "<h4>Thái độ Chủ Động</h4><p>Trước mọi tình huống, phản xạ của bạn là <strong>đứng ra hành động và tự giải quyết</strong>. Bạn tiếp cận vấn đề với sự quyết đoán, không chờ đợi — nhưng nhớ kiềm chế sự nóng vội và cái tôi.</p>",
    "2": "<h4>Thái độ Hợp Tác</h4><p>Bạn phản ứng với mọi việc bằng <strong>sự mềm mỏng, cân nhắc và tìm điểm chung</strong>. Bản năng của bạn là hòa giải thay vì đối đầu — đôi khi cần dứt khoát hơn để không bị động.</p>",
    "3": "<h4>Thái độ Lạc Quan</h4><p>Phản xạ tự nhiên của bạn là <strong>nhìn vào mặt tích cực và xử lý bằng sự nhẹ nhàng, hài hước</strong>. Bạn lan tỏa năng lượng vui vẻ — nhưng cần tránh né tránh hoặc xem nhẹ vấn đề nghiêm túc.</p>",
    "4": "<h4>Thái độ Thận Trọng</h4><p>Bạn tiếp cận tình huống một cách <strong>thực tế, có kế hoạch và từng bước chắc chắn</strong>. Phản xạ của bạn là phân tích rủi ro trước khi hành động — hãy bớt cứng nhắc khi cần linh hoạt.</p>",
    "5": "<h4>Thái độ Linh Hoạt</h4><p>Trước biến cố, bạn phản ứng <strong>nhanh nhạy, thích ứng và tìm hướng đi mới</strong>. Bạn xoay chuyển tốt trong hỗn loạn — nhưng cần tránh hấp tấp hoặc thay đổi quyết định liên tục.</p>",
    "6": "<h4>Thái độ Trách Nhiệm</h4><p>Bản năng của bạn là <strong>gánh vác, quan tâm và lo cho mọi người</strong> khi có chuyện. Bạn phản ứng bằng sự ấm áp và trách nhiệm — nhớ đừng ôm đồm đến mức quên chính mình.</p>",
    "7": "<h4>Thái độ Suy Xét</h4><p>Phản xạ của bạn là <strong>lùi lại quan sát, phân tích trước khi phản ứng</strong>. Bạn xử lý mọi việc bằng lý trí và chiều sâu — đôi khi nên tin vào cảm xúc và hành động dứt khoát hơn.</p>",
    "8": "<h4>Thái độ Bản Lĩnh</h4><p>Trước thử thách, bạn phản ứng bằng <strong>sự tự tin, quyết liệt và hướng đến kết quả</strong>. Bạn nắm quyền kiểm soát tình huống tốt — nhưng nhớ cân bằng giữa cứng rắn và bao dung.</p>",
    "9": "<h4>Thái độ Bao Dung</h4><p>Phản xạ của bạn là <strong>nhìn bức tranh lớn và xử lý bằng lòng vị tha</strong>. Bạn dễ tha thứ và đặt lợi ích chung lên trên — hãy tránh để cảm xúc lý tưởng làm bạn thất vọng quá mức.</p>",
    "11": "<h4>Thái độ Trực Cảm (Master 11)</h4><p>Bạn phản ứng với tình huống theo <strong>trực giác nhạy bén và cảm nhận tinh tế</strong>. Bản năng mách bảo bạn điều đúng đắn — hãy giữ bình tĩnh để không bị cảm xúc cuốn đi.</p>",
    "22": "<h4>Thái độ Tầm Nhìn (Master 22)</h4><p>Trước mọi việc, bạn phản ứng bằng <strong>tầm nhìn dài hạn và tính toán thực tế</strong>. Bạn nhìn ra cách biến khó khăn thành cơ hội kiến tạo điều lớn lao.</p>",
    "33": "<h4>Thái độ Từ Bi (Master 33)</h4><p>Phản xạ của bạn là <strong>phản ứng bằng tình thương và mong muốn chữa lành</strong>. Bạn xoa dịu căng thẳng quanh mình bằng sự bao dung — nhớ giữ năng lượng cho bản thân.</p>",
  },
};

// ============================================================
// MŨI TÊN CÁ TÍNH — các hàng/cột/chéo đầy hoặc trống
// ============================================================
const ARROWS_INFO = {
  "3-6-9": {
    name: "Mũi Tên Trí Tuệ",
    cells: [3, 6, 9],
    strength: "<h4>Mũi Tên Trí Tuệ (3-6-9 đầy đủ)</h4><p>Bạn sở hữu khả năng tư duy logic xuất sắc, óc sáng tạo phong phú và một trí nhớ đáng kinh ngạc. Bạn học hỏi rất nhanh và thích làm việc với kiến thức học thuật, nghiên cứu hoặc nghệ thuật tư duy.</p>",
    weakness: "<h4>Mũi Tên Trống Trí Nhớ (3-6-9 trống)</h4><p>Bạn có xu hướng dễ quên hoặc mất tập trung khi học hỏi điều mới. Cần rèn luyện ghi chép, hệ thống hóa thông tin và tạo thói quen rèn trí nhớ đều đặn hằng ngày.</p>"
  },
  "2-5-8": {
    name: "Mũi Tên Cảm Xúc",
    cells: [2, 5, 8],
    strength: "<h4>Mũi Tên Cảm Xúc (2-5-8 đầy đủ)</h4><p>Bạn có trực giác nhạy bén, khả năng tự cân bằng cảm xúc rất tốt và trái tim ấm áp, thấu cảm sâu sắc với mọi người xung quanh. Bạn là chỗ dựa tinh thần tuyệt vời.</p>",
    weakness: "<h4>Mũi Tên Trống Cảm Xúc (2-5-8 trống)</h4><p>Bạn dễ rơi vào trạng thái nhạy cảm quá mức, khó bộc lộ cảm xúc thật hoặc dễ cảm thấy cô độc, tổn thương. Hãy học cách mở lòng, chia sẻ và yêu thương bản thân nhiều hơn.</p>"
  },
  "1-4-7": {
    name: "Mũi Tên Thực Tế",
    cells: [1, 4, 7],
    strength: "<h4>Mũi Tên Thực Tế (1-4-7 đầy đủ)</h4><p>Bạn là người thực tế, thích hành động và có đôi tay khéo léo. Bạn chỉ tin vào trải nghiệm thực tế và có năng khiếu sắp xếp, quản lý các công việc cụ thể cực tốt.</p>",
    weakness: "<h4>Mũi Tên Trống Thực Tế (1-4-7 trống)</h4><p>Bạn dễ mơ mộng, thiếu tính thực tiễn hoặc ngại va chạm với công việc tay chân. Hãy học cách lập kế hoạch tài chính cụ thể và bắt tay làm việc nhỏ mỗi ngày.</p>"
  },
  "1-2-3": {
    name: "Mũi Tên Kế Hoạch",
    cells: [1, 2, 3],
    strength: "<h4>Mũi Tên Kế Hoạch (1-2-3 đầy đủ)</h4><p>Bạn là người có đầu óc tổ chức, lập kế hoạch chi tiết và thực thi mọi việc theo trình tự ngăn nắp. Bạn luôn chuẩn bị kỹ càng trước khi bắt đầu hành trình.</p>",
    weakness: "<h4>Mũi Tên Trống Kế Hoạch (1-2-3 trống)</h4><p>Bạn dễ làm việc tùy hứng, thiếu ngăn nắp và gặp khó khăn trong việc thiết lập trật tự cuộc sống. Hãy tập thói quen viết to-do list hằng ngày và tuân thủ thời gian biểu.</p>"
  },
  "4-5-6": {
    name: "Mũi Tên Ý Chí",
    cells: [4, 5, 6],
    strength: "<h4>Mũi Tên Ý Chí (4-5-6 đầy đủ)</h4><p>Bạn sở hữu ý chí quật cường, lòng kiên định vượt qua nghịch cảnh và tinh thần tự chủ rất cao. Bạn kiên trì bảo vệ lý tưởng và mục tiêu của bản thân.</p>",
    weakness: "<h4>Mũi Tên Trống Ý Chí (4-5-6 trống)</h4><p>Bạn dễ rơi vào cảm giác bất an, tự ti hoặc hay lo lắng thái quá dẫn đến trì hoãn. Hãy tập trung xây dựng niềm tin nội lực và học cách buông bỏ nỗi sợ mơ hồ.</p>"
  },
  "7-8-9": {
    name: "Mũi Tên Hoạt Động",
    cells: [7, 8, 9],
    strength: "<h4>Mũi Tên Hoạt Động (7-8-9 đầy đủ)</h4><p>Bạn năng động, thích khám phá thế giới, đam mê trải nghiệm thực tế và du lịch. Bạn tràn đầy năng lượng khi được tự do vận động và trải nghiệm cuộc sống ngoài trời.</p>",
    weakness: "<h4>Mũi Tên Trống Hoạt Động (7-8-9 trống)</h4><p>Bạn có xu hướng thụ động, ngại thay đổi và thích trốn trong vùng an toàn quen thuộc. Hãy rèn luyện thể chất năng nổ hơn và can đảm thử những trải nghiệm mới lạ.</p>"
  },
  "1-5-9": {
    name: "Mũi Tên Quyết Tâm",
    cells: [1, 5, 9],
    strength: "<h4>Mũi Tên Quyết Tâm (1-5-9 đầy đủ)</h4><p>Mũi tên vàng của sự kiên trì. Bạn cực kỳ kiên định, đã quyết làm việc gì là theo đuổi đến cùng bất chấp khó khăn. Sức bền của bạn là vô địch.</p>",
    weakness: "<h4>Mũi Tên Trì Hoãn (1-5-9 trống)</h4><p>Bạn hay chần chừ, trì hoãn công việc và dễ nản lòng bỏ cuộc giữa chừng. Hãy chia nhỏ mục tiêu lớn thành các việc nhỏ dễ làm để tạo đà chiến thắng mỗi ngày.</p>"
  },
  "3-5-7": {
    name: "Mũi Tên Tâm Linh",
    cells: [3, 5, 7],
    strength: "<h4>Mũi Tên Nhạy Bén (3-5-7 đầy đủ)</h4><p>Bạn sở hữu trực giác tâm linh nhạy bén vượt trội, khả năng thấu thị cảm xúc và lòng tin sâu sắc vào thế giới tinh thần. Bạn rất thấu cảm với nỗi đau nhân sinh.</p>",
    weakness: "<h4>Mũi Tên Hoài Nghi (3-5-7 trống)</h4><p>Bạn có xu hướng đa nghi, chỉ tin vào những thứ chứng minh được bằng logic thuần túy và dễ hoài nghi lòng tốt của người khác. Hãy rèn luyện lòng biết ơn để mở lòng hơn.</p>"
  }
};

// ============================================================
// CÁC TẦNG SÂU HƠN — Trưởng Thành, Năm Cá Nhân, Đỉnh Cuộc Đời, Thử Thách
// ============================================================

// SỐ TRƯỞNG THÀNH — con người bạn trở thành ở nửa sau cuộc đời (~ tuổi 35+)
const MATURITY_MEANINGS = {
  "1": "<h4>Trưởng thành thành Người Dẫn Đầu</h4><p>Nửa sau cuộc đời, bạn trở nên <strong>độc lập, quyết đoán và tự tin</strong> hơn bao giờ hết. Đây là giai đoạn bạn dám đứng ra dẫn dắt và sống đúng với ý chí của mình.</p>",
  "2": "<h4>Trưởng thành thành Người Kết Nối</h4><p>Bạn ngày càng <strong>điềm tĩnh, tinh tế và giỏi hợp tác</strong>. Hạnh phúc về sau đến từ các mối quan hệ sâu sắc và vai trò hòa giải, cố vấn cho người khác.</p>",
  "3": "<h4>Trưởng thành thành Người Truyền Cảm Hứng</h4><p>Về sau bạn tỏa sáng với <strong>khả năng sáng tạo và giao tiếp</strong>. Đây là lúc bạn được công nhận nhờ tài năng biểu đạt và tinh thần lạc quan.</p>",
  "4": "<h4>Trưởng thành thành Người Kiến Tạo</h4><p>Bạn trở nên <strong>vững vàng, kỷ luật và đáng tin cậy</strong>. Nửa sau cuộc đời, bạn gặt hái thành quả từ những nền tảng đã kiên trì xây dựng.</p>",
  "5": "<h4>Trưởng thành thành Người Tự Do</h4><p>Càng lớn tuổi bạn càng <strong>cởi mở, linh hoạt và ưa trải nghiệm</strong>. Đây là giai đoạn bạn cho phép mình sống phóng khoáng và đón nhận thay đổi.</p>",
  "6": "<h4>Trưởng thành thành Người Nuôi Dưỡng</h4><p>Bạn dồn năng lượng vào <strong>gia đình, cộng đồng và trách nhiệm yêu thương</strong>. Hạnh phúc về sau gắn với tổ ấm và việc chăm sóc người khác.</p>",
  "7": "<h4>Trưởng thành thành Người Hiền Triết</h4><p>Nửa sau cuộc đời nghiêng về <strong>chiều sâu nội tâm, tri thức và tâm linh</strong>. Bạn tìm thấy sự bình an trong suy ngẫm và thấu hiểu bản chất cuộc sống.</p>",
  "8": "<h4>Trưởng thành thành Người Thành Đạt</h4><p>Bạn bước vào giai đoạn <strong>gặt hái về tài chính, quyền lực và uy tín</strong>. Đây là lúc năng lực quản trị và bản lĩnh của bạn được đền đáp xứng đáng.</p>",
  "9": "<h4>Trưởng thành thành Người Nhân Ái</h4><p>Về sau bạn sống vì <strong>lý tưởng lớn và sự phụng sự</strong>. Bạn tìm thấy ý nghĩa khi cho đi, tha thứ và đóng góp cho điều gì đó vượt khỏi bản thân.</p>",
  "11": "<h4>Trưởng thành thành Người Khai Sáng (11)</h4><p>Bạn trở thành nguồn <strong>cảm hứng và ánh sáng tinh thần</strong> cho người khác, sống theo trực giác và sứ mệnh dẫn đường của mình.</p>",
  "22": "<h4>Trưởng thành thành Người Kiến Tạo Lớn (22)</h4><p>Nửa sau cuộc đời, bạn có thể <strong>hiện thực hóa những công trình để đời</strong> có ảnh hưởng đến nhiều người.</p>",
  "33": "<h4>Trưởng thành thành Người Thầy (33)</h4><p>Bạn trở thành biểu tượng của <strong>tình thương và sự chữa lành</strong>, nâng đỡ tinh thần cho cộng đồng quanh mình.</p>",
};

// NĂM CÁ NHÂN — năng lượng chủ đạo của năm nay trong chu kỳ 9 năm
const PERSONAL_YEAR_MEANINGS = {
  "1": "<h4>Năm Khởi Đầu</h4><p>Một chu kỳ 9 năm mới bắt đầu. Đây là năm để <strong>gieo hạt, khởi sự dự án mới và hành động độc lập</strong>. Hãy dũng cảm bắt đầu — những gì bạn khởi xướng năm nay sẽ định hình cả chu kỳ.</p>",
  "2": "<h4>Năm Vun Đắp</h4><p>Năm của <strong>kiên nhẫn, hợp tác và xây dựng quan hệ</strong>. Mọi việc cần thời gian chín muồi; hãy nuôi dưỡng những gì đã gieo, lắng nghe và kết nối thay vì vội vàng.</p>",
  "3": "<h4>Năm Tỏa Sáng</h4><p>Năng lượng <strong>sáng tạo, giao tiếp và niềm vui</strong> lên cao. Đây là năm mở rộng quan hệ xã hội, thể hiện bản thân và tận hưởng cuộc sống. Tránh phân tán quá nhiều hướng.</p>",
  "4": "<h4>Năm Xây Nền</h4><p>Năm của <strong>lao động chăm chỉ, kỷ luật và xây dựng nền tảng</strong>. Không phải lúc để bay bổng — hãy tổ chức, làm việc bền bỉ và đặt những viên gạch vững chắc cho tương lai.</p>",
  "5": "<h4>Năm Chuyển Động</h4><p>Năm của <strong>thay đổi, tự do và cơ hội bất ngờ</strong>. Có thể có dịch chuyển, du lịch, công việc mới. Hãy linh hoạt đón nhận, nhưng tránh quyết định bốc đồng.</p>",
  "6": "<h4>Năm Tổ Ấm</h4><p>Năm xoay quanh <strong>gia đình, tình yêu và trách nhiệm</strong>. Thích hợp cho cưới hỏi, vun vén tổ ấm, chăm sóc người thân. Hãy cân bằng giữa cho đi và giữ gìn năng lượng bản thân.</p>",
  "7": "<h4>Năm Hướng Nội</h4><p>Năm của <strong>nghỉ ngơi, học hỏi và chiêm nghiệm</strong>. Hãy dành thời gian cho bản thân, trau dồi tri thức và lắng nghe nội tâm. Đừng ép mình chạy theo thành tích vật chất.</p>",
  "8": "<h4>Năm Gặt Hái</h4><p>Năm của <strong>thành tựu, tài chính và quyền lực</strong>. Nỗ lực nhiều năm có thể được đền đáp. Đây là thời điểm tốt cho kinh doanh, thăng tiến và các quyết định lớn về tiền bạc.</p>",
  "9": "<h4>Năm Hoàn Tất</h4><p>Năm khép lại chu kỳ — thời điểm <strong>buông bỏ, dọn dẹp và cho đi</strong>. Hãy kết thúc những điều không còn phù hợp để chuẩn bị cho khởi đầu mới. Sống vị tha và rộng lượng.</p>",
};

// ĐỈNH CUỘC ĐỜI (Pinnacles) — 4 giai đoạn lớn, mỗi giai đoạn mang một bài học
const PINNACLE_MEANINGS = {
  "1": "<h4>Đỉnh của sự Độc Lập</h4><p>Giai đoạn rèn luyện <strong>tính tự chủ, ý chí và khả năng tự đứng vững</strong>. Bạn học cách tự quyết định và khẳng định bản thân.</p>",
  "2": "<h4>Đỉnh của sự Hợp Tác</h4><p>Giai đoạn phát triển <strong>sự nhạy cảm, kiên nhẫn và kỹ năng quan hệ</strong>. Bài học là làm việc cùng người khác và xây dựng sự đồng điệu.</p>",
  "3": "<h4>Đỉnh của sự Sáng Tạo</h4><p>Giai đoạn nở rộ về <strong>biểu đạt, giao tiếp và niềm vui sống</strong>. Đây là lúc tài năng nghệ thuật và sức cuốn hút xã hội của bạn được khai mở.</p>",
  "4": "<h4>Đỉnh của sự Xây Dựng</h4><p>Giai đoạn của <strong>lao động, kỷ luật và tạo lập nền tảng</strong>. Bạn học giá trị của sự kiên trì và xây dựng những thứ bền vững.</p>",
  "5": "<h4>Đỉnh của sự Đổi Thay</h4><p>Giai đoạn nhiều <strong>biến động, tự do và trải nghiệm mới</strong>. Bài học là thích nghi với thay đổi và tận dụng cơ hội mà không mất phương hướng.</p>",
  "6": "<h4>Đỉnh của Trách Nhiệm</h4><p>Giai đoạn xoay quanh <strong>gia đình, tình yêu và sự cống hiến</strong>. Bạn học cách yêu thương, gánh vác và mang lại sự hài hòa cho người thân.</p>",
  "7": "<h4>Đỉnh của Trí Tuệ</h4><p>Giai đoạn hướng vào <strong>chiều sâu, tri thức và tâm linh</strong>. Đây là thời kỳ chiêm nghiệm, nghiên cứu và tìm hiểu bản chất cuộc sống.</p>",
  "8": "<h4>Đỉnh của Thành Tựu</h4><p>Giai đoạn của <strong>quyền lực, tài chính và sự nghiệp lớn</strong>. Bạn học cách làm chủ nguồn lực và gặt hái thành công vật chất.</p>",
  "9": "<h4>Đỉnh của sự Cho Đi</h4><p>Giai đoạn sống vì <strong>lý tưởng, lòng nhân ái và cộng đồng</strong>. Bài học là bao dung, phụng sự và buông bỏ cái tôi.</p>",
  "11": "<h4>Đỉnh Khai Sáng (11)</h4><p>Giai đoạn đặc biệt với <strong>trực giác mạnh và sứ mệnh truyền cảm hứng</strong>. Năng lượng tâm linh dâng cao, đòi hỏi bạn làm chủ cảm xúc.</p>",
  "22": "<h4>Đỉnh Kiến Tạo Lớn (22)</h4><p>Giai đoạn có thể <strong>hiện thực hóa những điều vĩ đại</strong> có ích cho số đông, kết hợp tầm nhìn và sức xây dựng.</p>",
};

// THỬ THÁCH (Challenges) — điểm yếu/bài học cần vượt qua, có thể bằng 0
const CHALLENGE_MEANINGS = {
  "0": "<h4>Thử thách số 0 — Tự Do Lựa Chọn</h4><p>Bạn không bị ràng buộc bởi một bài học cố định mà phải <strong>tự chọn con đường của mình</strong>. Thử thách là dùng tự do ấy một cách khôn ngoan, không né tránh trách nhiệm.</p>",
  "1": "<h4>Thử thách số 1 — Tự Tin</h4><p>Bài học là vượt qua <strong>sự phụ thuộc, rụt rè và thiếu chính kiến</strong>. Hãy học cách tự quyết, đứng vững trên đôi chân mình và dám nói lên ý kiến.</p>",
  "2": "<h4>Thử thách số 2 — Nhạy Cảm</h4><p>Bạn dễ <strong>quá nhạy cảm, sợ bị phán xét và mất tự tin</strong> trong quan hệ. Hãy học cách cân bằng cảm xúc và tin vào giá trị bản thân.</p>",
  "3": "<h4>Thử thách số 3 — Biểu Đạt</h4><p>Bài học là vượt qua <strong>sự tự ti khi thể hiện, hoặc xu hướng chỉ trích, tản mạn</strong>. Hãy dùng lời nói và sáng tạo một cách tích cực, có trọng tâm.</p>",
  "4": "<h4>Thử thách số 4 — Kỷ Luật</h4><p>Bạn cần khắc phục <strong>sự lười biếng, thiếu tổ chức hoặc cứng nhắc</strong>. Hãy xây dựng thói quen, tính kiên nhẫn và làm việc có hệ thống.</p>",
  "5": "<h4>Thử thách số 5 — Tiết Chế</h4><p>Bài học là kiểm soát <strong>ham muốn tự do thái quá, bốc đồng và sa đà</strong>. Hãy tận hưởng trải nghiệm nhưng giữ kỷ luật và trách nhiệm.</p>",
  "6": "<h4>Thử thách số 6 — Kỳ Vọng</h4><p>Bạn dễ <strong>áp đặt tiêu chuẩn hoàn hảo và ôm đồm trách nhiệm</strong>. Hãy học cách yêu thương vô điều kiện và thiết lập ranh giới lành mạnh.</p>",
  "7": "<h4>Thử thách số 7 — Niềm Tin</h4><p>Bài học là vượt qua <strong>sự hoài nghi, khép kín và cô lập</strong>. Hãy mở lòng tin tưởng người khác và chia sẻ thế giới nội tâm của mình.</p>",
  "8": "<h4>Thử thách số 8 — Tiền Bạc & Quyền Lực</h4><p>Bạn cần cân bằng mối quan hệ với <strong>tiền bạc, quyền lực và cái tôi</strong>. Hãy theo đuổi thành công một cách chính trực, không để vật chất chi phối.</p>",
};

const LAYER_NAMES = {
  maturity:    "Số Trưởng Thành",
  personalYear:"Năm Cá Nhân",
  pinnacle:    "Đỉnh Cuộc Đời",
  challenge:   "Thử Thách",
};


// ==================== TẦNG GIẢI MÃ MỞ RỘNG (2026-07) ====================
// Nợ nghiệp, bài học nghiệp quả, đam mê tiềm ẩn, số tiềm thức, số cân bằng,
// tháng cá nhân, 3 chu kỳ đường đời, ghi chú 3 loại biểu đồ.

const HIDDEN_PASSION_MEANINGS = {
  "1": "<h4>Đam Mê Tiềm Ẩn số 1 — Khát Khao Dẫn Đầu</h4><p>Số 1 lặp lại nhiều nhất trong tên cho thấy bên trong bạn luôn <strong>khao khát được tự quyết, tiên phong và chứng tỏ bản thân</strong>. Bạn khó chịu khi phải làm nền cho người khác. Năng lượng này là động cơ mạnh nhưng cần tránh biến thành hiếu thắng, độc đoán.</p>",
  "2": "<h4>Đam Mê Tiềm Ẩn số 2 — Khát Khao Kết Nối</h4><p>Bạn thầm <strong>khao khát sự hòa hợp, được thấu hiểu và đồng hành</strong>. Bạn nhạy bén với cảm xúc người khác và giỏi vun đắp quan hệ. Hãy cẩn thận với xu hướng phụ thuộc cảm xúc hoặc né tránh xung đột bằng mọi giá.</p>",
  "3": "<h4>Đam Mê Tiềm Ẩn số 3 — Khát Khao Biểu Đạt</h4><p>Trong bạn luôn có <strong>nguồn sáng tạo và nhu cầu được thể hiện</strong> — qua lời nói, chữ viết hay nghệ thuật. Bạn hạnh phúc nhất khi được kể chuyện, trình diễn, tạo ra cái đẹp. Nếu bị kìm nén, năng lượng này dễ chuyển thành tán gẫu, phóng đại.</p>",
  "4": "<h4>Đam Mê Tiềm Ẩn số 4 — Khát Khao Trật Tự</h4><p>Bạn có nhu cầu sâu xa về <strong>sự ổn định, hệ thống và thành quả hữu hình</strong>. Xây dựng thứ gì đó bền vững khiến bạn thấy cuộc đời có ý nghĩa. Mặt trái là dễ cầu toàn, cứng nhắc và tự tạo áp lực bằng công việc.</p>",
  "5": "<h4>Đam Mê Tiềm Ẩn số 5 — Khát Khao Tự Do</h4><p>Bên trong bạn là <strong>tinh thần phiêu lưu không chịu đứng yên</strong>: thèm trải nghiệm mới, chuyển động, gặp gỡ. Sự gò bó là 'thuốc độc' với bạn. Bài học là tự do có kỷ luật — tự do để phát triển chứ không phải để trốn chạy.</p>",
  "6": "<h4>Đam Mê Tiềm Ẩn số 6 — Khát Khao Chăm Sóc</h4><p>Bạn tìm thấy ý nghĩa khi <strong>được yêu thương, chăm lo và chịu trách nhiệm cho người khác</strong>. Gia đình và cộng đồng là trung tâm thế giới của bạn. Cẩn thận với việc ôm đồm quá mức rồi âm thầm oán trách vì hy sinh không được ghi nhận.</p>",
  "7": "<h4>Đam Mê Tiềm Ẩn số 7 — Khát Khao Thấu Hiểu</h4><p>Bạn bị cuốn hút bởi <strong>tri thức, bí ẩn và chiều sâu của mọi thứ</strong>. Bạn cần thời gian một mình để suy ngẫm và 'sạc pin'. Đam mê này cho bạn trí tuệ khác biệt, nhưng đừng để nó biến thành sự xa cách, hoài nghi.</p>",
  "8": "<h4>Đam Mê Tiềm Ẩn số 8 — Khát Khao Thành Tựu</h4><p>Trong bạn có <strong>tham vọng mạnh mẽ về thành công, tài chính và vị thế</strong>. Bạn nhạy bén với quyền lực và cách vận hành của tiền bạc. Được dùng đúng, đây là năng lượng của doanh nhân lớn; dùng sai, nó thành sự ám ảnh vật chất.</p>",
  "9": "<h4>Đam Mê Tiềm Ẩn số 9 — Khát Khao Cống Hiến</h4><p>Bạn thầm mong cuộc đời mình <strong>có ý nghĩa vượt khỏi bản thân</strong> — giúp người, truyền cảm hứng, để lại dấu ấn nhân văn. Lòng trắc ẩn là tài sản lớn nhất của bạn; bài học là cho đi mà không kiệt sức hay lý tưởng hóa quá mức.</p>"
};

const KARMIC_LESSON_MEANINGS = {
  "1": "<h4>Thiếu số 1 — Bài học về Chính Kiến</h4><p>Tên bạn không có chữ cái mang số 1: kiếp này bạn cần học <strong>sự tự tin, dám quyết định và tự chịu trách nhiệm</strong>. Bạn dễ dựa dẫm ý kiến người khác. Hãy tập nói 'tôi chọn', bắt đầu từ những quyết định nhỏ.</p>",
  "2": "<h4>Thiếu số 2 — Bài học về Kiên Nhẫn & Hợp Tác</h4><p>Bạn cần học <strong>sự tinh tế, biết lắng nghe và làm việc cùng người khác</strong>. Cuộc sống sẽ liên tục đưa bạn vào tình huống buộc phải phối hợp, chờ đợi và để ý cảm xúc của người xung quanh.</p>",
  "3": "<h4>Thiếu số 3 — Bài học về Biểu Đạt</h4><p>Bạn cần học cách <strong>thể hiện cảm xúc và ý tưởng một cách cởi mở</strong>. Bạn có thể ngại nói trước đám đông hoặc khó diễn đạt điều mình nghĩ. Viết, kể chuyện, tham gia nhóm — mọi cơ hội biểu đạt đều là lớp học của bạn.</p>",
  "4": "<h4>Thiếu số 4 — Bài học về Kỷ Luật</h4><p>Bài học kiếp này là <strong>sự bền bỉ, ngăn nắp và tôn trọng quy trình</strong>. Bạn dễ chán việc lặp lại và muốn đi đường tắt. Cuộc sống sẽ dạy bạn rằng nền móng vững mới đỡ được thành công lớn.</p>",
  "5": "<h4>Thiếu số 5 — Bài học về Thích Nghi</h4><p>Bạn cần học cách <strong>đón nhận thay đổi và bước ra khỏi vùng an toàn</strong>. Bạn có xu hướng bám vào sự quen thuộc. Những biến động bất ngờ trong đời chính là lời mời bạn linh hoạt hơn.</p>",
  "6": "<h4>Thiếu số 6 — Bài học về Trách Nhiệm Yêu Thương</h4><p>Bài học là <strong>cam kết, chăm sóc và gánh vác trong gia đình</strong>. Bạn có thể né tránh ràng buộc tình cảm hoặc trách nhiệm tổ ấm. Học cách hiện diện trọn vẹn với người thân là chìa khóa trưởng thành của bạn.</p>",
  "7": "<h4>Thiếu số 7 — Bài học về Chiều Sâu</h4><p>Bạn cần học <strong>sự chiêm nghiệm, đặt câu hỏi và tin vào trí tuệ nội tâm</strong>. Bạn dễ sống vội, tin vào bề nổi. Cuộc sống sẽ tạo ra những khoảng lặng buộc bạn nhìn vào bên trong — đừng sợ chúng.</p>",
  "8": "<h4>Thiếu số 8 — Bài học về Quản Trị</h4><p>Bài học kiếp này liên quan đến <strong>tiền bạc, quyền hạn và cách quản lý nguồn lực</strong>. Bạn có thể vụng về với tài chính hoặc e ngại quyền lực. Học cách định giá bản thân và quản lý tiền là nhiệm vụ quan trọng.</p>",
  "9": "<h4>Thiếu số 9 — Bài học về Bao Dung</h4><p>Bạn cần học <strong>lòng trắc ẩn, sự tha thứ và nhìn xa hơn lợi ích cá nhân</strong>. Cuộc sống sẽ đưa đến những tình huống đòi hỏi bạn đặt mình vào vị trí người khác và cho đi không điều kiện.</p>"
};

const KARMIC_DEBT_MEANINGS = {
  "13": "<h4>Nợ Nghiệp 13/4 — Nợ của sự Lười Biếng</h4><p>Con số 13 xuất hiện trong các phép tính lõi cho thấy kiếp trước bạn có thể đã <strong>trốn tránh lao động, đùn đẩy gánh nặng cho người khác</strong>. Kiếp này thành công chỉ đến qua <strong>làm việc chăm chỉ gấp đôi người thường</strong> — không có đường tắt. Tin tốt: khi chấp nhận kỷ luật, số 13/4 xây được những thành tựu cực kỳ bền vững. Hãy tập trung một mục tiêu, hoàn thành từng việc, tránh trì hoãn.</p>",
  "14": "<h4>Nợ Nghiệp 14/5 — Nợ của sự Buông Thả</h4><p>Số 14 gợi ý kiếp trước bạn có thể đã <strong>lạm dụng tự do, sa đà hưởng thụ</strong>. Kiếp này bạn liên tục bị thử thách bởi <strong>cám dỗ, thay đổi đột ngột và sự bất ổn</strong>. Chìa khóa hóa giải là <strong>điều độ và cam kết</strong>: giữ thói quen lành mạnh, tránh nghiện ngập (rượu, cờ bạc, mua sắm), học cách hoàn thành điều đã hứa. Khi tiết chế được, bạn trở thành người cực kỳ linh hoạt và lôi cuốn.</p>",
  "16": "<h4>Nợ Nghiệp 16/7 — Nợ của Cái Tôi</h4><p>Số 16 mang bài học về <strong>sự sụp đổ của cái tôi để tái sinh</strong>. Kiếp trước có thể liên quan đến những mối quan hệ tổn thương do kiêu ngạo hoặc ích kỷ. Kiếp này bạn có thể trải qua những lần <strong>đổ vỡ bất ngờ (tình cảm, danh tiếng, kế hoạch)</strong> — mỗi lần như vậy là một lời nhắc buông cái tôi xuống. Hãy sống khiêm nhường, chân thật; sau mỗi lần 'lột xác', bạn mạnh mẽ và sâu sắc hơn hẳn.</p>",
  "19": "<h4>Nợ Nghiệp 19/1 — Nợ của sự Lạm Quyền</h4><p>Số 19 gợi ý kiếp trước bạn có thể đã <strong>dùng quyền lực vì lợi ích riêng, phớt lờ người khác</strong>. Kiếp này bạn buộc phải học <strong>tự lập trong cô độc</strong>: thường phải tự xoay xở mà khó nhận trợ giúp, dù xung quanh không thiếu người. Bài học kép là <strong>tự đứng vững VÀ biết khiêm tốn nhờ giúp đỡ</strong>. Khi cân bằng được, bạn trở thành thủ lĩnh thực sự — mạnh mẽ nhưng biết nâng người khác lên.</p>"
};

const BALANCE_MEANINGS = {
  "1": "<h4>Số Cân Bằng 1</h4><p>Khi khủng hoảng, bạn có xu hướng <strong>tự xử lý một mình và hành động ngay</strong>. Sức mạnh của bạn là sự quyết đoán; điểm mù là cô lập bản thân. Hãy dám chia sẻ vấn đề — nhờ giúp đỡ không làm bạn yếu đi.</p>",
  "2": "<h4>Số Cân Bằng 2</h4><p>Dưới áp lực, bạn <strong>nhạy cảm hơn bình thường và dễ lo lắng về cách người khác nghĩ</strong>. Cách lấy lại thăng bằng tốt nhất là nói chuyện với người bạn tin tưởng và tách cảm xúc khỏi sự việc. Đừng ôm nỗi lo một mình.</p>",
  "3": "<h4>Số Cân Bằng 3</h4><p>Khi căng thẳng, bạn dễ <strong>dùng sự hài hước để né vấn đề</strong> hoặc phóng đại cảm xúc. Sức mạnh thật của bạn là nhìn ra góc sáng của tình huống — hãy dùng óc lạc quan để giải quyết, không phải để trốn tránh.</p>",
  "4": "<h4>Số Cân Bằng 4</h4><p>Gặp khó khăn, bạn <strong>bám vào lý trí, quy trình và cố kiểm soát mọi thứ</strong>. Điều này giúp bạn ổn định nhưng dễ khiến bạn cứng nhắc, giận dữ khi mọi việc chệch kế hoạch. Hãy tập chấp nhận điều không kiểm soát được.</p>",
  "5": "<h4>Số Cân Bằng 5</h4><p>Khi khủng hoảng, phản xạ của bạn là <strong>tránh né hoặc 'đổi cảnh' — đi đâu đó, làm việc khác</strong>. Khoảng nghỉ ngắn giúp bạn tỉnh táo, nhưng vấn đề chưa giải quyết sẽ chờ bạn quay lại. Hãy quay về đúng hạn và đối diện.</p>",
  "6": "<h4>Số Cân Bằng 6</h4><p>Dưới áp lực, bạn <strong>gánh trách nhiệm về mình và lo cho mọi người trước</strong>, kể cả khi chính bạn đang tổn thương. Sự tận tâm là sức mạnh của bạn, nhưng hãy nhớ: bạn không thể rót nước từ chiếc bình rỗng.</p>",
  "7": "<h4>Số Cân Bằng 7</h4><p>Khi khó khăn ập đến, bạn <strong>rút vào thế giới nội tâm để phân tích</strong>. Khoảng lặng giúp bạn nhìn thấu vấn đề, nhưng ở trong đó quá lâu sẽ thành cô lập. Hãy đặt giới hạn thời gian suy ngẫm rồi hành động.</p>",
  "8": "<h4>Số Cân Bằng 8</h4><p>Bạn phản ứng với khủng hoảng bằng cách <strong>nắm quyền kiểm soát và giải quyết như một bài toán quản trị</strong>. Hiệu quả cao, nhưng dễ bỏ quên cảm xúc của mình và người khác. Cân bằng lý trí với sự thấu cảm là chìa khóa.</p>",
  "9": "<h4>Số Cân Bằng 9</h4><p>Khi biến cố xảy ra, bạn có xu hướng <strong>nhìn bức tranh lớn và tìm ý nghĩa của sự việc</strong>. Góc nhìn rộng giúp bạn tha thứ và buông bỏ nhanh, nhưng đừng dùng 'mọi chuyện đều có lý do' để né nỗi buồn thật của mình.</p>"
};

const SUBCONSCIOUS_MEANINGS = {
  "3": "<h4>Số Tiềm Thức 3</h4><p>Trước tình huống bất ngờ, bạn dễ <strong>phản ứng theo cảm xúc</strong> — hoảng hốt, cười trừ hoặc nói nhiều hơn bình thường. Bạn còn nhiều bài học nghiệp cần bổ sung; khi lấp dần các con số thiếu, khả năng ứng biến sẽ vững hơn hẳn.</p>",
  "4": "<h4>Số Tiềm Thức 4</h4><p>Khi có biến, bạn <strong>cần thời gian định thần và muốn có quy trình rõ ràng</strong> trước khi hành động. Bạn xử lý tốt nếu được chuẩn bị, nhưng dễ lúng túng với điều hoàn toàn bất ngờ. Rèn luyện tính linh hoạt sẽ giúp nhiều.</p>",
  "5": "<h4>Số Tiềm Thức 5</h4><p>Phản xạ của bạn trước khủng hoảng là <strong>hành động ngay — đôi khi hơi bốc đồng</strong>. Bạn không đứng yên chịu trận, nhưng quyết định vội có thể tạo rắc rối mới. Hít thở sâu 10 giây trước khi làm gì đó là 'bùa hộ mệnh' của bạn.</p>",
  "6": "<h4>Số Tiềm Thức 6</h4><p>Trong tình huống khẩn cấp, bạn <strong>nghĩ đến người thân trước tiên</strong> và hành động để bảo vệ những người mình yêu. Đây là phản xạ của người có trách nhiệm; chỉ cần nhớ chính bạn cũng nằm trong danh sách cần được bảo vệ.</p>",
  "7": "<h4>Số Tiềm Thức 7</h4><p>Bạn phản ứng với biến cố bằng <strong>sự bình tĩnh và phân tích</strong> — lùi một bước, quan sát, rồi mới hành động. Người xung quanh thấy bạn 'lạnh' nhưng thực ra bạn đang xử lý thông tin. Đây là phản xạ rất đáng tin cậy.</p>",
  "8": "<h4>Số Tiềm Thức 8</h4><p>Trước khủng hoảng, bạn <strong>tự động nắm quyền chỉ huy</strong>: đánh giá thiệt hại, phân công, giải quyết. Bạn là người mà mọi người tìm đến khi có chuyện. Chỉ cần tránh ôm hết mọi thứ về mình.</p>",
  "9": "<h4>Số Tiềm Thức 9</h4><p>Bạn phản ứng với tình huống bất ngờ bằng <strong>sự điềm tĩnh gần như toàn diện</strong> — hiếm khi mất bình tĩnh, nhìn được toàn cảnh và trấn an được người khác. Đây là mức phản xạ trưởng thành nhất trong thần số học.</p>"
};

const PERSONAL_MONTH_MEANINGS = {
  "1": "<h4>Tháng Cá Nhân 1 — Khởi Động</h4><p>Tháng này thích hợp để <strong>bắt đầu việc mới, đưa ra quyết định và hành động độc lập</strong>. Năng lượng khởi đầu đang ủng hộ bạn — đừng chần chừ.</p>",
  "2": "<h4>Tháng Cá Nhân 2 — Kết Nối</h4><p>Tháng của <strong>kiên nhẫn và quan hệ</strong>. Ưu tiên lắng nghe, đàm phán, vun đắp tình cảm. Việc lớn nên chờ chín muồi thay vì ép tiến độ.</p>",
  "3": "<h4>Tháng Cá Nhân 3 — Tỏa Sáng</h4><p>Tháng thuận lợi cho <strong>giao tiếp, sáng tạo và gặp gỡ</strong>. Hãy thể hiện bản thân, ra mắt ý tưởng, mở rộng vòng quan hệ. Tránh hứa nhiều hơn khả năng thực hiện.</p>",
  "4": "<h4>Tháng Cá Nhân 4 — Củng Cố</h4><p>Tháng để <strong>dọn dẹp, tổ chức lại và làm việc chăm chỉ</strong>. Xử lý giấy tờ, hoàn thiện hệ thống, chăm sóc sức khỏe theo kỷ luật. Nền móng đặt tháng này sẽ đỡ cả năm.</p>",
  "5": "<h4>Tháng Cá Nhân 5 — Chuyển Động</h4><p>Tháng nhiều <strong>thay đổi và cơ hội bất ngờ</strong>: chuyến đi, lời mời, tin mới. Hãy linh hoạt và nắm bắt, nhưng đọc kỹ mọi thứ trước khi ký.</p>",
  "6": "<h4>Tháng Cá Nhân 6 — Vun Vén</h4><p>Tháng hướng về <strong>gia đình, tình cảm và trách nhiệm</strong>. Thích hợp sửa sang nhà cửa, hàn gắn quan hệ, chăm sóc người thân. Sự hiện diện của bạn là món quà lớn nhất.</p>",
  "7": "<h4>Tháng Cá Nhân 7 — Lắng Đọng</h4><p>Tháng để <strong>đi chậm lại, học hỏi và chiêm nghiệm</strong>. Tốt cho nghiên cứu, khóa học, kỳ nghỉ yên tĩnh. Đừng ép bản thân phải 'ra số' tháng này.</p>",
  "8": "<h4>Tháng Cá Nhân 8 — Bứt Phá</h4><p>Tháng của <strong>tiền bạc, công việc và các quyết định lớn</strong>. Đàm phán lương, chốt hợp đồng, đẩy mạnh kinh doanh đều được ủng hộ. Hành động dứt khoát và chuyên nghiệp.</p>",
  "9": "<h4>Tháng Cá Nhân 9 — Khép Lại</h4><p>Tháng để <strong>hoàn tất và buông bỏ</strong>: kết thúc dự án dang dở, thanh lý đồ không dùng, tha thứ và cho đi. Dọn chỗ trống để chu kỳ mới bắt đầu vào tháng sau.</p>"
};

const LIFE_CYCLE_MEANINGS = {
  "1": "<h4>Chu kỳ số 1 — Giai đoạn Tự Lập</h4><p>Giai đoạn này cuộc sống thúc đẩy bạn <strong>tự đứng vững, xây dựng bản sắc và dám khác biệt</strong>. Nhiều quyết định phải tự mình đưa ra — đó chính là bài tập rèn bản lĩnh.</p>",
  "2": "<h4>Chu kỳ số 2 — Giai đoạn Vun Đắp</h4><p>Giai đoạn của <strong>quan hệ, hợp tác và sự nhạy cảm</strong>. Thành công đến từ khả năng kết nối và kiên nhẫn chờ thời điểm, không phải từ sự đơn độc bứt phá.</p>",
  "3": "<h4>Chu kỳ số 3 — Giai đoạn Nở Hoa</h4><p>Giai đoạn <strong>sáng tạo và mở rộng xã hội</strong>. Tài năng biểu đạt của bạn được khai mở, cuộc sống nhiều màu sắc, bạn bè và cơ hội thể hiện.</p>",
  "4": "<h4>Chu kỳ số 4 — Giai đoạn Xây Móng</h4><p>Giai đoạn đòi hỏi <strong>lao động bền bỉ và tính hệ thống</strong>. Có thể cảm giác chậm và nặng, nhưng mọi viên gạch đặt lúc này đều là tài sản lâu dài của bạn.</p>",
  "5": "<h4>Chu kỳ số 5 — Giai đoạn Biến Chuyển</h4><p>Giai đoạn <strong>nhiều thay đổi, dịch chuyển và trải nghiệm</strong>: đổi chỗ ở, đổi nghề, những rẽ hướng bất ngờ. Sự linh hoạt là kỹ năng sống còn của thời kỳ này.</p>",
  "6": "<h4>Chu kỳ số 6 — Giai đoạn Tổ Ấm</h4><p>Giai đoạn cuộc sống xoay quanh <strong>gia đình, hôn nhân và trách nhiệm yêu thương</strong>. Bạn học cách cam kết, chăm sóc và tạo ra sự hài hòa cho những người thuộc về mình.</p>",
  "7": "<h4>Chu kỳ số 7 — Giai đoạn Thức Tỉnh</h4><p>Giai đoạn hướng vào <strong>tri thức, chuyên môn sâu và đời sống nội tâm</strong>. Thích hợp để học lên cao, nghiên cứu, phát triển tâm linh. Vật chất không phải trọng tâm của thời kỳ này.</p>",
  "8": "<h4>Chu kỳ số 8 — Giai đoạn Gặt Hái</h4><p>Giai đoạn của <strong>sự nghiệp, tài chính và vị thế</strong>. Năng lực quản trị được thử thách và đền đáp. Hãy chơi lớn nhưng giữ sự chính trực.</p>",
  "9": "<h4>Chu kỳ số 9 — Giai đoạn Viên Mãn</h4><p>Giai đoạn của <strong>cho đi, ảnh hưởng rộng và hoàn thiện</strong>. Bạn sống với bức tranh lớn: cống hiến, truyền lại kinh nghiệm, buông những gì không còn phục vụ mình.</p>",
  "11": "<h4>Chu kỳ số 11 — Giai đoạn Trực Giác</h4><p>Giai đoạn đặc biệt với <strong>độ nhạy tinh thần rất cao</strong>. Trực giác dẫn đường cho bạn, nhưng cảm xúc cũng dao động mạnh — thiền định, nghệ thuật và đời sống tinh thần là điểm tựa.</p>",
  "22": "<h4>Chu kỳ số 22 — Giai đoạn Kiến Tạo Lớn</h4><p>Giai đoạn hiếm có mang tiềm năng <strong>xây dựng công trình ảnh hưởng đến nhiều người</strong>. Áp lực đi kèm rất lớn; hãy nghĩ lớn nhưng triển khai từng bước thực tế.</p>"
};

const CHART_TAB_NOTES = {
  birth: "Ma trận từ <strong>ngày–tháng–năm sinh</strong>: nét tính cách bẩm sinh trời cho, không đổi suốt đời.",
  name: "Ma trận từ <strong>các chữ cái trong họ tên</strong> (quy đổi Pythagoras): năng lượng mà cái tên bồi đắp thêm cho bạn.",
  combined: "Ma trận <strong>tổng hợp ngày sinh + họ tên</strong>: bức tranh năng lượng đầy đủ nhất — ô nào càng dày số, năng lượng đó càng mạnh."
};
