// ============================================================
// cards.js — Drinking Games 🍻 Card Data & Deck Logic
// Vietnamese drinking card game content
// ============================================================

// ---------- Card Type Configuration ----------
const CARD_TYPES = {
  truth:            { name: 'Sự Thật',           emoji: '🤔', color: '#00d4ff', gradient: 'linear-gradient(135deg, #00d4ff, #0099cc)' },
  dare:             { name: 'Thử Thách',         emoji: '🔥', color: '#ff4444', gradient: 'linear-gradient(135deg, #ff4444, #ff8800)' },
  group:            { name: 'Cả Nhóm',           emoji: '👥', color: '#00ff88', gradient: 'linear-gradient(135deg, #00ff88, #00cc66)' },
  never_have_i_ever:{ name: 'Tôi Chưa Bao Giờ', emoji: '🙈', color: '#ff66ff', gradient: 'linear-gradient(135deg, #ff66ff, #cc44cc)' },
  vote:             { name: 'Bình Chọn',         emoji: '🗳️', color: '#ffd700', gradient: 'linear-gradient(135deg, #ffd700, #ffaa00)' }
};

// ---------- All Cards ----------
const ALL_CARDS = [

  // =============================================
  //  TRUTH (Sự Thật) — 16 cards
  // =============================================

  // — mild (6) —
  { id: 1,  type: 'truth', content: 'Crush đầu tiên của bạn tên gì?',                                         penalty: 1, intensity: 'mild',   emoji: '🤔', targetCount: 1 },
  { id: 2,  type: 'truth', content: 'Món ăn mà bạn ghét nhất nhưng vẫn phải giả vờ thích là gì?',              penalty: 1, intensity: 'mild',   emoji: '🤔', targetCount: 1 },
  { id: 3,  type: 'truth', content: 'Lần cuối bạn khóc là khi nào và vì sao?',                                 penalty: 1, intensity: 'mild',   emoji: '🤔', targetCount: 1 },
  { id: 4,  type: 'truth', content: 'Bạn có bao giờ nói xấu ai trong nhóm này không?',                         penalty: 1, intensity: 'mild',   emoji: '🤔', targetCount: 1 },
  { id: 5,  type: 'truth', content: 'Điều gì bạn sợ nhất trên đời?',                                           penalty: 1, intensity: 'mild',   emoji: '🤔', targetCount: 1 },
  { id: 6,  type: 'truth', content: 'Bạn đã từng giả bệnh để nghỉ học/nghỉ làm chưa?',                        penalty: 1, intensity: 'mild',   emoji: '🤔', targetCount: 1 },

  // — medium (5) —
  { id: 7,  type: 'truth', content: 'Lần say xỉn nhất của bạn diễn ra như thế nào?',                            penalty: 2, intensity: 'medium', emoji: '🤔', targetCount: 1 },
  { id: 8,  type: 'truth', content: 'Bạn đã từng nói dối bạn bè điều gì nghiêm trọng?',                       penalty: 2, intensity: 'medium', emoji: '🤔', targetCount: 1 },
  { id: 9,  type: 'truth', content: 'Tin nhắn xấu hổ nhất trong điện thoại bạn là gì?',                        penalty: 2, intensity: 'medium', emoji: '🤔', targetCount: 1 },
  { id: 10, type: 'truth', content: 'Bạn có bí mật nào mà chưa kể cho ai trong nhóm này chưa?',                penalty: 2, intensity: 'medium', emoji: '🤔', targetCount: 1 },
  { id: 11, type: 'truth', content: 'Người bên trái bạn — bạn thật sự nghĩ gì về họ lần đầu gặp?',            penalty: 2, intensity: 'medium', emoji: '🤔', targetCount: 1 },

  // — spicy (5) —
  { id: 12, type: 'truth', content: 'Kể lại kỷ niệm "quê độ" nhất đời bạn!',                                   penalty: 3, intensity: 'spicy',  emoji: '🤔', targetCount: 1 },
  { id: 13, type: 'truth', content: 'Bạn đã từng lén xem điện thoại của người yêu chưa? Thấy gì?',            penalty: 3, intensity: 'spicy',  emoji: '🤔', targetCount: 1 },
  { id: 14, type: 'truth', content: 'Nếu phải hẹn hò 1 người trong nhóm, bạn chọn ai?',                       penalty: 3, intensity: 'spicy',  emoji: '🤔', targetCount: 1 },
  { id: 15, type: 'truth', content: 'Bạn có crush ai trong nhóm này không? Nếu có thì ai?',                    penalty: 3, intensity: 'spicy',  emoji: '🤔', targetCount: 1 },
  { id: 16, type: 'truth', content: 'Chuyện tình cảm "drama" nhất mà bạn từng trải qua là gì?',               penalty: 3, intensity: 'spicy',  emoji: '🤔', targetCount: 1 },

  // =============================================
  //  DARE (Thử Thách) — 16 cards
  // =============================================

  // — mild (6) —
  { id: 17, type: 'dare', content: 'Nhắn tin "Anh/em nhớ bạn" cho người cuối cùng trong danh bạ!',             penalty: 1, intensity: 'mild',   emoji: '🔥', targetCount: 1 },
  { id: 18, type: 'dare', content: 'Bắt chước tiếng con vật mà người bên phải chọn!',                          penalty: 1, intensity: 'mild',   emoji: '🔥', targetCount: 1 },
  { id: 19, type: 'dare', content: 'Selfie với biểu cảm xấu nhất có thể và đăng lên story!',                  penalty: 1, intensity: 'mild',   emoji: '🔥', targetCount: 1 },
  { id: 20, type: 'dare', content: 'Hát 1 đoạn bài hát yêu thích bằng giọng opera!',                          penalty: 1, intensity: 'mild',   emoji: '🔥', targetCount: 1 },
  { id: 21, type: 'dare', content: 'Nói chuyện bằng giọng em bé trong 2 lượt tiếp theo!',                     penalty: 1, intensity: 'mild',   emoji: '🔥', targetCount: 1 },
  { id: 22, type: 'dare', content: 'Kể 1 câu chuyện cười — nếu không ai cười, uống!',                          penalty: 1, intensity: 'mild',   emoji: '🔥', targetCount: 1 },

  // — medium (5) —
  { id: 23, type: 'dare', content: 'Gọi điện cho người cuối cùng trong danh bạ và hát 1 câu!',                 penalty: 2, intensity: 'medium', emoji: '🔥', targetCount: 1 },
  { id: 24, type: 'dare', content: 'Nhảy sexy dance 10 giây — nhóm chấm điểm!',                                penalty: 2, intensity: 'medium', emoji: '🔥', targetCount: 1 },
  { id: 25, type: 'dare', content: 'Để người bên phải đăng story Instagram giùm bạn!',                         penalty: 2, intensity: 'medium', emoji: '🔥', targetCount: 1 },
  { id: 26, type: 'dare', content: 'Diễn cảnh tỏ tình với người bên trái thật lãng mạn!',                     penalty: 2, intensity: 'medium', emoji: '🔥', targetCount: 1 },
  { id: 27, type: 'dare', content: 'Gọi bố/mẹ và nói "Con yêu bố/mẹ" bằng giọng say!',                       penalty: 2, intensity: 'medium', emoji: '🔥', targetCount: 1 },

  // — spicy (5) —
  { id: 28, type: 'dare', content: 'Đưa điện thoại cho người bên phải — họ được gửi 1 tin nhắn bất kỳ!',      penalty: 3, intensity: 'spicy',  emoji: '🔥', targetCount: 1 },
  { id: 29, type: 'dare', content: 'Nhắn tin cho crush/người yêu cũ: "Nhớ bạn quá!" rồi screenshot cho nhóm!', penalty: 3, intensity: 'spicy',  emoji: '🔥', targetCount: 1 },
  { id: 30, type: 'dare', content: 'Catwalk quanh phòng với phong cách siêu mẫu trong 15 giây!',               penalty: 3, intensity: 'spicy',  emoji: '🔥', targetCount: 1 },
  { id: 31, type: 'dare', content: 'Để nhóm chọn 1 filter xấu nhất — chụp ảnh đăng story giữ 1 tiếng!',       penalty: 3, intensity: 'spicy',  emoji: '🔥', targetCount: 1 },
  { id: 32, type: 'dare', content: 'Gọi video call cho 1 người bất kỳ và giả vờ khóc 10 giây!',               penalty: 3, intensity: 'spicy',  emoji: '🔥', targetCount: 1 },

  // =============================================
  //  GROUP (Cả Nhóm) — 16 cards
  // =============================================

  // — mild (6) —
  { id: 33, type: 'group', content: 'Cả nhóm cùng uống! 🍻 Cheers!',                                           penalty: 1, intensity: 'mild',   emoji: '👥', targetCount: 0 },
  { id: 34, type: 'group', content: 'Đếm 1-2-3, ai chỉ tay cùng hướng phải uống!',                            penalty: 1, intensity: 'mild',   emoji: '👥', targetCount: 0 },
  { id: 35, type: 'group', content: 'Người cuối cùng chạm mũi phải uống!',                                     penalty: 1, intensity: 'mild',   emoji: '👥', targetCount: 0 },
  { id: 36, type: 'group', content: 'Oẳn tù tì — ai thua phải uống! (chơi loại trực tiếp)',                   penalty: 1, intensity: 'mild',   emoji: '👥', targetCount: 0 },
  { id: 37, type: 'group', content: 'Người cuối cùng giơ tay lên phải uống!',                                   penalty: 1, intensity: 'mild',   emoji: '👥', targetCount: 0 },
  { id: 38, type: 'group', content: 'Đếm ngược từ 5 — người cuối cùng đứng dậy phải uống!',                   penalty: 1, intensity: 'mild',   emoji: '👥', targetCount: 0 },

  // — medium (5) —
  { id: 39, type: 'group', content: 'Vòng quay "Sam Sam Sam" — ai thua uống!',                                  penalty: 2, intensity: 'medium', emoji: '👥', targetCount: 0 },
  { id: 40, type: 'group', content: 'Cả nhóm hát 1 bài — ai quên lời trước phải uống!',                       penalty: 2, intensity: 'medium', emoji: '👥', targetCount: 0 },
  { id: 41, type: 'group', content: 'Kể tên thủ đô các nước — ai không trả lời được trong 3 giây phải uống!', penalty: 2, intensity: 'medium', emoji: '👥', targetCount: 0 },
  { id: 42, type: 'group', content: 'Nối từ — bắt đầu từ "Tình yêu" — ai hết từ phải uống!',                  penalty: 2, intensity: 'medium', emoji: '👥', targetCount: 0 },
  { id: 43, type: 'group', content: 'Cả nhóm nhắm mắt — đếm 1-2-3 chỉ vào 1 người — ai bị chỉ nhiều nhất uống!', penalty: 2, intensity: 'medium', emoji: '👥', targetCount: 0 },

  // — spicy (5) —
  { id: 44, type: 'group', content: 'Waterfall! Người đọc bắt đầu uống, người tiếp theo uống theo — chỉ được dừng khi người trước dừng!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },
  { id: 45, type: 'group', content: 'Cả nhóm đổi điện thoại sang trái — được đọc tin nhắn gần nhất!',         penalty: 3, intensity: 'spicy',  emoji: '👥', targetCount: 0 },
  { id: 46, type: 'group', content: 'Mỗi người nói 1 bí mật chưa ai biết — ai từ chối phải uống gấp đôi!',   penalty: 3, intensity: 'spicy',  emoji: '👥', targetCount: 0 },
  { id: 47, type: 'group', content: 'Cả nhóm gọi điện cho 1 người ngẫu nhiên và hát Happy Birthday!',         penalty: 3, intensity: 'spicy',  emoji: '👥', targetCount: 0 },
  { id: 48, type: 'group', content: 'Ai trong nhóm có ảnh xấu nhất trong gallery? Cả nhóm cùng kiểm tra — người thua uống!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },

  // =============================================
  //  NEVER HAVE I EVER (Tôi Chưa Bao Giờ) — 16 cards
  // =============================================

  // — mild (6) —
  { id: 49, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ quên sinh nhật bạn thân!',                   penalty: 1, intensity: 'mild',   emoji: '🙈', targetCount: 0 },
  { id: 50, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ giả vờ không thấy tin nhắn!',               penalty: 1, intensity: 'mild',   emoji: '🙈', targetCount: 0 },
  { id: 51, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ đi ngủ mà quên đánh răng!',                 penalty: 1, intensity: 'mild',   emoji: '🙈', targetCount: 0 },
  { id: 52, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ hát karaoke một mình trong phòng!',         penalty: 1, intensity: 'mild',   emoji: '🙈', targetCount: 0 },
  { id: 53, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ ăn cắp đồ ăn của bạn cùng phòng!',         penalty: 1, intensity: 'mild',   emoji: '🙈', targetCount: 0 },
  { id: 54, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ gửi nhầm tin nhắn cho sai người!',          penalty: 1, intensity: 'mild',   emoji: '🙈', targetCount: 0 },

  // — medium (5) —
  { id: 55, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ stalk crush trên Facebook lúc 2h sáng!',    penalty: 2, intensity: 'medium', emoji: '🙈', targetCount: 0 },
  { id: 56, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ nói dối để trốn đi chơi!',                 penalty: 2, intensity: 'medium', emoji: '🙈', targetCount: 0 },
  { id: 57, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ say đến mức không nhớ gì!',                 penalty: 2, intensity: 'medium', emoji: '🙈', targetCount: 0 },
  { id: 58, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ khóc vì phim hoạt hình!',                   penalty: 2, intensity: 'medium', emoji: '🙈', targetCount: 0 },
  { id: 59, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ lén đọc nhật ký/tin nhắn của người khác!',  penalty: 2, intensity: 'medium', emoji: '🙈', targetCount: 0 },

  // — spicy (5) —
  { id: 60, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ giả vờ say để được chở về!',                penalty: 3, intensity: 'spicy',  emoji: '🙈', targetCount: 0 },
  { id: 61, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ nhắn tin cho người yêu cũ lúc say!',        penalty: 3, intensity: 'spicy',  emoji: '🙈', targetCount: 0 },
  { id: 62, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ nói xấu ai trong nhóm này sau lưng!',       penalty: 3, intensity: 'spicy',  emoji: '🙈', targetCount: 0 },
  { id: 63, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ tạo tài khoản ảo để stalk ai đó!',         penalty: 3, intensity: 'spicy',  emoji: '🙈', targetCount: 0 },
  { id: 64, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ có "tình một đêm"!',                        penalty: 3, intensity: 'spicy',  emoji: '🙈', targetCount: 0 },

  // =============================================
  //  VOTE (Bình Chọn) — 16 cards
  // =============================================

  // — mild (6) —
  { id: 65, type: 'vote', content: 'Ai là người hay đến muộn nhất?',                                            penalty: 1, intensity: 'mild',   emoji: '🗳️', targetCount: 1 },
  { id: 66, type: 'vote', content: 'Ai là người ngủ nhiều nhất trong nhóm?',                                    penalty: 1, intensity: 'mild',   emoji: '🗳️', targetCount: 1 },
  { id: 67, type: 'vote', content: 'Ai là người ăn nhiều nhất?',                                                penalty: 1, intensity: 'mild',   emoji: '🗳️', targetCount: 1 },
  { id: 68, type: 'vote', content: 'Ai sẽ say đầu tiên tối nay?',                                              penalty: 1, intensity: 'mild',   emoji: '🗳️', targetCount: 1 },
  { id: 69, type: 'vote', content: 'Ai là người photogenic nhất nhóm?',                                         penalty: 1, intensity: 'mild',   emoji: '🗳️', targetCount: 1 },
  { id: 70, type: 'vote', content: 'Ai là người hài hước nhất nhóm?',                                           penalty: 1, intensity: 'mild',   emoji: '🗳️', targetCount: 1 },

  // — medium (5) —
  { id: 71, type: 'vote', content: 'Ai giỏi nói dối nhất?',                                                     penalty: 2, intensity: 'medium', emoji: '🗳️', targetCount: 1 },
  { id: 72, type: 'vote', content: 'Ai là người dễ bị "cắm sừng" nhất?',                                       penalty: 2, intensity: 'medium', emoji: '🗳️', targetCount: 1 },
  { id: 73, type: 'vote', content: 'Ai là người có nhiều bí mật nhất?',                                         penalty: 2, intensity: 'medium', emoji: '🗳️', targetCount: 1 },
  { id: 74, type: 'vote', content: 'Ai sẽ nổi tiếng nhất trong 10 năm nữa?',                                   penalty: 2, intensity: 'medium', emoji: '🗳️', targetCount: 1 },
  { id: 75, type: 'vote', content: 'Ai là người flirt giỏi nhất nhóm?',                                        penalty: 2, intensity: 'medium', emoji: '🗳️', targetCount: 1 },

  // — spicy (5) —
  { id: 76, type: 'vote', content: 'Ai là người "toxic" nhất khi yêu?',                                         penalty: 3, intensity: 'spicy',  emoji: '🗳️', targetCount: 1 },
  { id: 77, type: 'vote', content: 'Ai có khả năng "bắt cá hai tay" cao nhất?',                                penalty: 3, intensity: 'spicy',  emoji: '🗳️', targetCount: 1 },
  { id: 78, type: 'vote', content: 'Ai sẽ là người kết hôn cuối cùng trong nhóm?',                             penalty: 3, intensity: 'spicy',  emoji: '🗳️', targetCount: 1 },
  { id: 79, type: 'vote', content: 'Ai trong nhóm mà bạn muốn "ship" với nhau nhất?',                          penalty: 3, intensity: 'spicy',  emoji: '🗳️', targetCount: 1 },
  { id: 80, type: 'vote', content: 'Ai là người dễ "fall in love" nhất nhóm?',                                  penalty: 3, intensity: 'spicy',  emoji: '🗳️', targetCount: 1 },

  // =============================================
  //  HOANG DẠI PACK — extra spicy cards
  // =============================================

  // — Sự Thật (Truth) hoang dại — 8 cards —
  { id: 81,  type: 'truth', content: 'Bạn có đang thích ai trong nhóm này không? Không được nói dối!',             penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 82,  type: 'truth', content: 'Kể lần gần nhất bạn làm điều gì liều lĩnh vì một người?',                    penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 83,  type: 'truth', content: 'Lần cuối bạn flirt với ai là khi nào và kết quả thế nào?',                   penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 84,  type: 'truth', content: 'Nếu phải ngủ cùng 1 người trong nhóm tối nay — bạn chọn ai?',                penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 85,  type: 'truth', content: 'Bạn đã từng ghen với ai trong nhóm này vì lý do tình cảm chưa?',             penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 86,  type: 'truth', content: 'App hẹn hò nào bạn đã dùng và câu chuyện buồn cười nhất bạn gặp?',           penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 87,  type: 'truth', content: 'Ai trong nhóm mà bạn nghĩ hấp dẫn nhất về mặt ngoại hình? Nói thật!',        penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },
  { id: 88,  type: 'truth', content: 'Điều gì bạn từng làm mà nếu bố mẹ biết thì xỉu tại chỗ?',                   penalty: 3, intensity: 'spicy', emoji: '🤔', targetCount: 1 },

  // — Thử Thách (Dare) hoang dại — 8 cards —
  { id: 89,  type: 'dare', content: 'Để người bên phải đặt tên liên lạc của bạn thành gì tùy họ — giữ cả tối!',    penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 90,  type: 'dare', content: 'Để cả nhóm soạn và gửi 1 tin nhắn bất kỳ từ điện thoại của bạn!',             penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 91,  type: 'dare', content: 'Đưa điện thoại cho người bên trái — họ được đọc 5 tin nhắn gần nhất của bạn!', penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 92,  type: 'dare', content: 'Nhắn tin cho người yêu cũ: "Em/Anh vẫn nhớ đến bạn" rồi đọc to phản hồi!',   penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 93,  type: 'dare', content: 'Chụp ảnh mặt mộc rồi đặt làm ảnh đại diện trong 1 tiếng!',                    penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 94,  type: 'dare', content: 'Gọi điện bố hoặc mẹ ngay bây giờ và nói "Bố/Mẹ ơi, con yêu bố/mẹ lắm!"',    penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 95,  type: 'dare', content: 'Nói thật 1 điều bạn chưa bao giờ dám nói với người ngồi bên trái trong nhóm!', penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },
  { id: 96,  type: 'dare', content: 'Khóa điện thoại và đặt lên bàn cho người bên phải giữ trong 3 phút!',          penalty: 3, intensity: 'spicy', emoji: '🔥', targetCount: 1 },

  // — Cả Nhóm (Group) hoang dại — 6 cards —
  { id: 97,  type: 'group', content: 'Mỗi người tiết lộ notification cuối trên điện thoại to cho cả nhóm nghe — ai xấu hổ nhất uống 2!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },
  { id: 98,  type: 'group', content: 'Cả nhóm im lặng tuyệt đối — ai nói trước hoặc cười trước uống 2 shots!',      penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },
  { id: 99,  type: 'group', content: 'Mỗi người nói thật 1 điều họ thực sự nghĩ về người ngồi bên phải — không được nịnh!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },
  { id: 100, type: 'group', content: 'Điện thoại sang trái — người nhận được đặt ảnh đại diện tùy thích trong 5 phút!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },
  { id: 101, type: 'group', content: 'Cả nhóm đếm 1-2-3 và đồng loạt chỉ vào người mà mình nghĩ "nguy hiểm" nhất tối nay!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },
  { id: 102, type: 'group', content: 'Mỗi người nhắn 1 tin bí ẩn cho người mình thích nhất trong nhóm — không được reveal!', penalty: 3, intensity: 'spicy', emoji: '👥', targetCount: 0 },

  // — Chưa Từng (Never Have I Ever) hoang dại — 5 cards —
  { id: 103, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ xóa toàn bộ lịch sử chat vì sợ ai đó xem!',    penalty: 3, intensity: 'spicy', emoji: '🙈', targetCount: 0 },
  { id: 104, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ có crush với người đã có người yêu!',           penalty: 3, intensity: 'spicy', emoji: '🙈', targetCount: 0 },
  { id: 105, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ hối hận về điều gì đó xảy ra sau một đêm say!', penalty: 3, intensity: 'spicy', emoji: '🙈', targetCount: 0 },
  { id: 106, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ nói "Tôi yêu bạn" mà không thực sự nghĩ vậy!', penalty: 3, intensity: 'spicy', emoji: '🙈', targetCount: 0 },
  { id: 107, type: 'never_have_i_ever', content: 'Tôi chưa bao giờ giả vờ không nhận ra ai để tránh nói chuyện!',  penalty: 3, intensity: 'spicy', emoji: '🙈', targetCount: 0 },

  // — Bình Chọn (Vote) hoang dại — 4 cards —
  { id: 108, type: 'vote', content: 'Ai trong nhóm có khả năng làm mọi người say mê nhất?',                         penalty: 3, intensity: 'spicy', emoji: '🗳️', targetCount: 1 },
  { id: 109, type: 'vote', content: 'Ai ẩn chứa nhiều bí mật tình cảm nhất trong nhóm?',                           penalty: 3, intensity: 'spicy', emoji: '🗳️', targetCount: 1 },
  { id: 110, type: 'vote', content: 'Ai sẽ làm điều điên rồ nhất tối nay nếu say đủ?',                             penalty: 3, intensity: 'spicy', emoji: '🗳️', targetCount: 1 },
  { id: 111, type: 'vote', content: 'Ai trong nhóm mà bạn muốn được hôn nhất nếu tất cả đều FA?',                  penalty: 3, intensity: 'spicy', emoji: '🗳️', targetCount: 1 },
];


// ---------- CardDeck Class ----------
class CardDeck {
  /**
   * @param {'mild'|'medium'|'spicy'} intensity
   * @param {string[]} allowedTypes List of card types to include, e.g. ['truth', 'dare']
   */
  constructor(intensity, allowedTypes = []) {
    this.intensity = intensity;
    this.allowedTypes = allowedTypes.length > 0 ? allowedTypes : Object.keys(CARD_TYPES);
    this.cards = this._filter(ALL_CARDS, this.intensity, this.allowedTypes);
    this.played = [];
    this.shuffle();
  }

  /**
   * Filter cards by both intensity and card types.
   */
  _filter(cards, intensity, allowedTypes) {
    let filtered = cards.filter(c => allowedTypes.includes(c.type));
    
    if (intensity === 'mild') {
      return filtered.filter(c => c.intensity === 'mild');
    }
    if (intensity === 'medium') {
      return filtered.filter(c => c.intensity === 'mild' || c.intensity === 'medium');
    }
    return filtered; // spicy = all matching allowedTypes
  }

  /**
   * Fisher-Yates (Durstenfeld) in-place shuffle.
   */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Draw the next card from the deck.
   * @returns {object|null} A card object, or null if the deck is empty.
   */
  draw() {
    if (this.cards.length === 0) return null;
    const card = this.cards.pop();
    this.played.push(card);
    return card;
  }

  /**
   * Number of cards remaining in the draw pile.
   */
  remaining() {
    return this.cards.length;
  }

  /**
   * Reset the deck: re-filter from the master list, clear played, and shuffle.
   */
  reset() {
    this.cards = this._filter(ALL_CARDS, this.intensity, this.allowedTypes);
    this.played = [];
    this.shuffle();
  }
}
