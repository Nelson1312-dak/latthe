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
