/**
 * tarot/js/cards.js
 * 22 Major Arcana — Vietnamese names, meanings, advice
 */

const TAROT_CARDS = [
  {
    id: 0, number: 'O', symbol: '🤡',
    name: 'The Fool', vn: 'Gã Ngốc',
    keywords: ['Khởi đầu', 'Tự do', 'Phiêu lưu'],
    upright:  'Một hành trình mới đầy hứng khởi đang chờ bạn. Hãy dũng cảm bước đi mà không sợ thất bại — năng lượng tươi trẻ và ngây thơ chính là sức mạnh của bạn lúc này.',
    reversed: 'Bạn đang liều lĩnh một cách thiếu suy nghĩ, hoặc quá sợ hãi mà không dám bắt đầu. Hãy dừng lại, cân nhắc kỹ trước khi nhảy vào điều gì đó.',
    advice:   'Tin vào bản thân. Hành trình vạn dặm bắt đầu từ một bước chân.',
    element: '🌬️ Gió'
  },
  {
    id: 1, number: 'I', symbol: '🪄',
    name: 'The Magician', vn: 'Pháp Sư',
    keywords: ['Ý chí', 'Tài năng', 'Hành động'],
    upright:  'Bạn sở hữu đủ mọi công cụ và khả năng để biến ước mơ thành hiện thực. Đây là lúc tập trung ý chí và hành động quyết đoán.',
    reversed: 'Bạn đang lãng phí tiềm năng hoặc bị người khác thao túng. Hãy cẩn thận với những kẻ lừa đảo xung quanh.',
    advice:   'Sức mạnh đã ở trong tay bạn — hãy dùng nó.',
    element: '🌬️ Gió'
  },
  {
    id: 2, number: 'II', symbol: '🌙',
    name: 'The High Priestess', vn: 'Nữ Tư Tế',
    keywords: ['Trực giác', 'Bí ẩn', 'Nội tâm'],
    upright:  'Hãy lắng nghe tiếng nói bên trong bạn. Không phải lúc nào logic cũng đúng — trực giác của bạn đang nhìn thấy điều mà lý trí bỏ qua.',
    reversed: 'Bạn đang bỏ qua những tín hiệu quan trọng từ nội tâm, hoặc đang để lộ bí mật của mình quá nhiều.',
    advice:   'Im lặng và quan sát. Câu trả lời nằm trong sự tĩnh lặng.',
    element: '💧 Nước'
  },
  {
    id: 3, number: 'III', symbol: '🌸',
    name: 'The Empress', vn: 'Nữ Hoàng',
    keywords: ['Phong nhiêu', 'Sáng tạo', 'Thiên nhiên'],
    upright:  'Đây là giai đoạn nảy nở và sinh sôi — trong tình yêu, công việc hay sáng tạo. Hãy đón nhận sự dồi dào và nuôi dưỡng những gì bạn yêu quý.',
    reversed: 'Bạn đang cảm thấy bế tắc sáng tạo hoặc không được quan tâm đủ mức. Hãy chăm sóc bản thân trước.',
    advice:   'Hãy để mình được yêu thương và cho đi tình yêu đó.',
    element: '🌍 Đất'
  },
  {
    id: 4, number: 'IV', symbol: '👑',
    name: 'The Emperor', vn: 'Hoàng Đế',
    keywords: ['Quyền lực', 'Kỷ luật', 'Lãnh đạo'],
    upright:  'Bạn cần thể hiện sự quyết đoán và nắm quyền kiểm soát tình huống. Xây dựng cấu trúc vững chắc là chìa khóa lúc này.',
    reversed: 'Bạn đang lạm quyền hoặc bị người có quyền lực áp bức. Hãy tìm lại sự cân bằng trong mối quan hệ.',
    advice:   'Đặt ra quy tắc cho chính mình và giữ vững chúng.',
    element: '🌍 Đất'
  },
  {
    id: 5, number: 'V', symbol: '📿',
    name: 'The Hierophant', vn: 'Giáo Hoàng',
    keywords: ['Truyền thống', 'Đức tin', 'Giáo huấn'],
    upright:  'Hãy tìm đến người thầy, tổ chức hoặc truyền thống đáng tin cậy. Đây là lúc học hỏi từ kinh nghiệm của người đi trước.',
    reversed: 'Bạn đang bị ràng buộc bởi những quy tắc cứng nhắc. Đã đến lúc phá vỡ khuôn mẫu và tìm con đường của riêng mình.',
    advice:   'Tôn trọng truyền thống nhưng đừng để nó giam cầm bạn.',
    element: '🌍 Đất'
  },
  {
    id: 6, number: 'VI', symbol: '💑',
    name: 'The Lovers', vn: 'Tình Nhân',
    keywords: ['Tình yêu', 'Lựa chọn', 'Hòa hợp'],
    upright:  'Một mối quan hệ quan trọng hoặc quyết định lớn đang đến. Hãy lắng nghe trái tim và chọn con đường phù hợp với giá trị của bạn.',
    reversed: 'Đang có xung đột trong mối quan hệ hoặc bạn đang phải đối mặt với một sự lựa chọn khó khăn giữa lý trí và cảm xúc.',
    advice:   'Tình yêu thật sự đòi hỏi cả trái tim lẫn sự tỉnh táo.',
    element: '🌬️ Gió'
  },
  {
    id: 7, number: 'VII', symbol: '🏎️',
    name: 'The Chariot', vn: 'Chiến Xa',
    keywords: ['Chiến thắng', 'Ý chí', 'Kiểm soát'],
    upright:  'Bạn đang trên đường đến chiến thắng, nhưng đòi hỏi sự quyết tâm và tập trung cao độ. Hãy kiểm soát cả hai mặt của bản thân: lý trí và cảm xúc.',
    reversed: 'Bạn đang mất kiểm soát hoặc bị cuốn vào quá nhiều hướng cùng một lúc. Hãy dừng lại và xác định lại mục tiêu.',
    advice:   'Chiến thắng thuộc về người biết kiểm soát chính mình.',
    element: '💧 Nước'
  },
  {
    id: 8, number: 'VIII', symbol: '🦁',
    name: 'Strength', vn: 'Sức Mạnh',
    keywords: ['Can đảm', 'Kiên nhẫn', 'Nội lực'],
    upright:  'Sức mạnh thật sự không đến từ cơ bắp mà từ sự kiên nhẫn và lòng trắc ẩn. Hãy đối mặt với thử thách bằng sự bình tĩnh và yêu thương.',
    reversed: 'Bạn đang mất tự tin hoặc đang dùng sức mạnh sai cách — áp đặt thay vì thuyết phục.',
    advice:   'Thuần phục con thú bên trong bằng tình yêu, không phải bằng sợ hãi.',
    element: '🔥 Lửa'
  },
  {
    id: 9, number: 'IX', symbol: '🏮',
    name: 'The Hermit', vn: 'Ẩn Sĩ',
    keywords: ['Cô độc', 'Trí tuệ', 'Suy ngẫm'],
    upright:  'Đây là lúc rút lui khỏi ồn ào để tìm kiếm câu trả lời từ nội tâm. Sự cô đơn lúc này là cần thiết để bạn tìm thấy ánh sáng của chính mình.',
    reversed: 'Bạn đang tự cô lập mình quá mức, hoặc ngược lại, đang bỏ qua nhu cầu được nghỉ ngơi và chiêm nghiệm.',
    advice:   'Ánh đèn lồng của Ẩn Sĩ chỉ soi đường một bước — hãy bước đi.',
    element: '🌍 Đất'
  },
  {
    id: 10, number: 'X', symbol: '🎡',
    name: 'Wheel of Fortune', vn: 'Bánh Xe Số Phận',
    keywords: ['Số phận', 'Thay đổi', 'Cơ hội'],
    upright:  'Vận may đang mỉm cười với bạn. Đây là thời điểm tốt để đón nhận những thay đổi và tận dụng cơ hội mới.',
    reversed: 'Bạn đang trải qua giai đoạn xui xẻo hoặc chống lại những thay đổi không thể tránh khỏi. Hãy linh hoạt hơn.',
    advice:   'Bánh xe luôn quay — hãy thích nghi thay vì kháng cự.',
    element: '🌬️ Gió'
  },
  {
    id: 11, number: 'XI', symbol: '⚖️',
    name: 'Justice', vn: 'Công Lý',
    keywords: ['Công bằng', 'Sự thật', 'Nhân quả'],
    upright:  'Sự thật sẽ được phơi bày và công lý sẽ được thực thi. Hãy hành động trung thực và chấp nhận hậu quả từ những việc đã làm.',
    reversed: 'Đang có sự bất công hoặc bạn đang tránh né trách nhiệm. Hãy đối mặt với sự thật.',
    advice:   'Gieo nhân nào gặt quả đó — luật nhân quả không bao giờ sai.',
    element: '🌬️ Gió'
  },
  {
    id: 12, number: 'XII', symbol: '🙃',
    name: 'The Hanged Man', vn: 'Người Treo Ngược',
    keywords: ['Hy sinh', 'Buông bỏ', 'Góc nhìn mới'],
    upright:  'Đôi khi cần phải dừng lại và nhìn mọi thứ từ góc độ khác. Hãy buông bỏ sự kiểm soát và tin rằng sự hy sinh lúc này sẽ mang lại khai sáng.',
    reversed: 'Bạn đang trì hoãn điều không thể tránh khỏi, hoặc đang hy sinh mà không có lý do chính đáng.',
    advice:   'Có những thứ chỉ nhìn thấy khi bạn lộn ngược thế giới của mình.',
    element: '💧 Nước'
  },
  {
    id: 13, number: 'XIII', symbol: '💀',
    name: 'Death', vn: 'Tử Thần',
    keywords: ['Kết thúc', 'Biến đổi', 'Tái sinh'],
    upright:  'Một chương cuộc đời đang kết thúc để nhường chỗ cho điều mới. Hãy đón nhận sự chuyển hóa này — cái chết trong Tarot là sự tái sinh.',
    reversed: 'Bạn đang bám víu vào quá khứ và chống lại sự thay đổi. Hãy học cách buông tay.',
    advice:   'Cánh cửa này đóng lại để cánh cửa khác mở ra.',
    element: '💧 Nước'
  },
  {
    id: 14, number: 'XIV', symbol: '🏺',
    name: 'Temperance', vn: 'Điều Độ',
    keywords: ['Cân bằng', 'Kiên nhẫn', 'Hài hòa'],
    upright:  'Hãy tìm sự cân bằng trong mọi việc. Không thái quá, không bất cập — sự hài hòa chính là chìa khóa lúc này.',
    reversed: 'Bạn đang mất cân bằng — hoặc quá cực đoan hoặc thiếu kiên nhẫn. Hãy điều chỉnh lại nhịp sống.',
    advice:   'Nghệ thuật sống là biết pha trộn mọi thứ đúng tỉ lệ.',
    element: '🔥 Lửa'
  },
  {
    id: 15, number: 'XV', symbol: '😈',
    name: 'The Devil', vn: 'Ác Quỷ',
    keywords: ['Ràng buộc', 'Vật chất', 'Ảo tưởng'],
    upright:  'Bạn đang bị ràng buộc bởi những thói quen xấu, sự phụ thuộc hoặc những mối quan hệ độc hại. Hãy nhận ra rằng bạn có thể tự giải thoát mình.',
    reversed: 'Bạn đang dần thoát khỏi những xiềng xích của mình. Tiếp tục hướng đến tự do.',
    advice:   'Xiềng xích thường do chính chúng ta tự đeo vào người.',
    element: '🌍 Đất'
  },
  {
    id: 16, number: 'XVI', symbol: '⚡',
    name: 'The Tower', vn: 'Tháp Sét',
    keywords: ['Đổ vỡ', 'Cách mạng', 'Thức tỉnh'],
    upright:  'Một sự kiện bất ngờ sẽ phá vỡ cấu trúc cũ. Dù đau đớn, đây là sự thức tỉnh cần thiết để xây dựng lại trên nền vững chắc hơn.',
    reversed: 'Bạn đang tránh né một sự sụp đổ tất yếu, khiến thiệt hại chỉ tích lũy thêm. Hoặc bạn đang trải qua biến cố nhưng phục hồi.',
    advice:   'Đôi khi mọi thứ phải sụp đổ để có thể xây lại đúng cách.',
    element: '🔥 Lửa'
  },
  {
    id: 17, number: 'XVII', symbol: '⭐',
    name: 'The Star', vn: 'Ngôi Sao',
    keywords: ['Hy vọng', 'Chữa lành', 'Cảm hứng'],
    upright:  'Sau cơn bão là ánh sao. Đây là thời điểm của hy vọng, chữa lành và lấy lại niềm tin. Hãy tin vào tương lai tốt đẹp hơn.',
    reversed: 'Bạn đang mất niềm tin hoặc cảm thấy tuyệt vọng. Hãy nhớ rằng ánh sáng luôn ở đó, dù bạn chưa thấy.',
    advice:   'Ngôi sao soi đường qua đêm tối — hãy ngước nhìn lên.',
    element: '🌬️ Gió'
  },
  {
    id: 18, number: 'XVIII', symbol: '🌕',
    name: 'The Moon', vn: 'Mặt Trăng',
    keywords: ['Ảo giác', 'Vô thức', 'Sợ hãi'],
    upright:  'Mọi thứ không rõ ràng như bạn nghĩ. Có điều gì đó ẩn giấu dưới bề mặt. Hãy tin vào trực giác và đừng để sợ hãi kiểm soát bạn.',
    reversed: 'Sự mơ hồ đang tan dần. Sự thật đang dần được hé lộ — hãy chuẩn bị đón nhận.',
    advice:   'Trăng không nói dối — nhưng nó tạo ra bóng đổ.',
    element: '💧 Nước'
  },
  {
    id: 19, number: 'XIX', symbol: '☀️',
    name: 'The Sun', vn: 'Mặt Trời',
    keywords: ['Hạnh phúc', 'Thành công', 'Niềm vui'],
    upright:  'Đây là lá bài may mắn nhất! Hạnh phúc, thành công và sự rõ ràng đang chiếu rọi vào cuộc đời bạn. Hãy tận hưởng khoảnh khắc này.',
    reversed: 'Hạnh phúc đang bị che khuất tạm thời bởi sự bi quan hoặc hoàn cảnh. Hãy cố gắng nhìn ra ánh sáng bên trong bóng tối.',
    advice:   'Mặt trời mọc mỗi ngày — hãy để nó sưởi ấm bạn.',
    element: '🔥 Lửa'
  },
  {
    id: 20, number: 'XX', symbol: '📯',
    name: 'Judgement', vn: 'Phán Xét',
    keywords: ['Thức tỉnh', 'Tha thứ', 'Tái sinh'],
    upright:  'Đây là lúc đánh giá lại cuộc sống và đưa ra những quyết định quan trọng. Hãy tha thứ cho quá khứ và bước sang trang mới.',
    reversed: 'Bạn đang tự phán xét mình quá khắt khe, hoặc trì hoãn một quyết định quan trọng vì sợ hãi.',
    advice:   'Hãy tha thứ cho mình đủ để tiến về phía trước.',
    element: '🌬️ Gió'
  },
  {
    id: 21, number: 'XXI', symbol: '🌍',
    name: 'The World', vn: 'Thế Giới',
    keywords: ['Hoàn thành', 'Toàn vẹn', 'Chu kỳ mới'],
    upright:  'Bạn đã đến đích! Một chu kỳ lớn hoàn thành với sự viên mãn. Hãy ăn mừng những gì bạn đã đạt được trước khi bắt đầu cuộc hành trình tiếp theo.',
    reversed: 'Bạn đang gần đến đích nhưng chưa hoàn thành. Hãy kiên trì thêm một chút nữa.',
    advice:   'Mỗi kết thúc đều là một khởi đầu mới ở cấp độ cao hơn.',
    element: '🌍 Đất'
  }
];

// Spread layouts
const TAROT_SPREADS = {
  one: {
    name: '1 Lá — Thông Điệp Hôm Nay',
    positions: ['Thông điệp']
  },
  three: {
    name: '3 Lá — Quá Khứ / Hiện Tại / Tương Lai',
    positions: ['Quá Khứ', 'Hiện Tại', 'Tương Lai']
  },
  five: {
    name: '5 Lá — Tình Huống Phức Tạp',
    positions: ['Tình Huống', 'Thách Thức', 'Quá Khứ', 'Tương Lai', 'Kết Quả']
  }
};
