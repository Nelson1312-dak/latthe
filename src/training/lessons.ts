// Lộ trình bài học.
//
// Mỗi bài gồm phần giải thích tự soạn bằng tiếng Việt, rồi vài bài tập lấy từ
// kho Lichess theo đúng chủ đề đang dạy. Làm vậy thì thế cờ luôn hợp lệ và đã
// được hàng nghìn người giải, thay vì mình tự dựng tay rồi dò lỗi.

export interface Lesson {
  id: string;
  /** Nhóm bài, để xếp thành chương. */
  chapter: string;
  title: string;
  /** Giải thích ngắn, đọc trước khi làm bài. 2–4 câu. */
  intro: string;
  /** Điều cần nhớ sau bài này. */
  keyPoint: string;
  /** Chủ đề bài tập trong kho Lichess. */
  theme: string;
  /** Độ khó tối đa của bài tập trong bài học này. */
  maxRating: number;
  /** Số bài tập phải giải để qua bài. */
  count: number;
}

export const LESSONS: Lesson[] = [
  /* ---- Chương 1: Ăn quân cho đúng ---- */
  {
    id: 'hanging',
    chapter: 'Ăn quân cho đúng',
    title: 'Quân không ai bảo vệ',
    intro:
      'Trước mỗi nước đi, hãy nhìn xem đối thủ có quân nào đang đứng một mình không. Một quân "không ai bảo vệ" là quân mà nếu bạn ăn, không có quân nào của đối thủ ăn lại được. Đây là cách thắng quân dễ nhất, và cũng là lỗi người mới hay mắc nhất khi để quân mình như vậy.',
    keyPoint: 'Mỗi nước, hãy hỏi: quân nào của đối thủ đang không ai đỡ?',
    theme: 'hangingPiece',
    maxRating: 1000,
    count: 3,
  },
  {
    id: 'capturing-defender',
    chapter: 'Ăn quân cho đúng',
    title: 'Ăn quân đang đỡ',
    intro:
      'Một quân được bảo vệ thì không ăn được. Nhưng nếu bạn ăn mất chính quân đang bảo vệ nó, thì nó trở thành quân không ai đỡ. Đây là cách phá vỡ những thế phòng thủ trông có vẻ chắc chắn.',
    keyPoint: 'Muốn ăn quân được bảo vệ, hãy loại bỏ quân đang bảo vệ nó trước.',
    theme: 'capturingDefender',
    maxRating: 1300,
    count: 3,
  },

  /* ---- Chương 2: Đòn chiến thuật cơ bản ---- */
  {
    id: 'fork',
    chapter: 'Đòn chiến thuật cơ bản',
    title: 'Đòn đôi',
    intro:
      'Đòn đôi là một quân cùng lúc tấn công hai mục tiêu. Đối thủ chỉ cứu được một, bạn ăn cái còn lại. Mã là quân đánh đòn đôi giỏi nhất vì nó đi theo kiểu không quân nào chặn được, và nhiều người mới hay bỏ sót đường đi của nó.',
    keyPoint: 'Tìm ô nào mà từ đó một quân nhắm được hai thứ giá trị cùng lúc.',
    theme: 'fork',
    maxRating: 1200,
    count: 4,
  },
  {
    id: 'pin',
    chapter: 'Đòn chiến thuật cơ bản',
    title: 'Ghim quân',
    intro:
      'Ghim là khi một quân không dám đi vì đi thì để lộ quân giá trị hơn phía sau nó. Nếu phía sau là Vua thì quân bị ghim không được phép đi chút nào. Quân bị ghim coi như đứng im, nên bạn có thể thong thả dồn thêm quân vào tấn công nó.',
    keyPoint: 'Quân bị ghim vào Vua thì không đi được — hãy tấn công nó thêm.',
    theme: 'pin',
    maxRating: 1300,
    count: 3,
  },
  {
    id: 'skewer',
    chapter: 'Đòn chiến thuật cơ bản',
    title: 'Đòn xiên',
    intro:
      'Đòn xiên giống ghim nhưng ngược lại: quân giá trị đứng trước, quân nhỏ hơn đứng sau. Bạn tấn công quân phía trước, nó buộc phải tránh, và bạn ăn quân phía sau. Chiếu Vua theo kiểu này là mạnh nhất, vì Vua bắt buộc phải tránh.',
    keyPoint: 'Chiếu Vua dọc một đường, rồi ăn quân đứng sau nó.',
    theme: 'skewer',
    maxRating: 1400,
    count: 3,
  },
  {
    id: 'discovered',
    chapter: 'Đòn chiến thuật cơ bản',
    title: 'Đòn mở',
    intro:
      'Khi bạn dời một quân đi, quân đứng sau nó được mở đường. Nếu nước đi đó vừa tạo ra lời đe dọa mới, vừa mở đường cho quân sau tấn công, đối thủ không đỡ nổi cả hai. Đây là một trong những đòn mạnh nhất trong cờ vua.',
    keyPoint: 'Dời một quân để quân phía sau nó tấn công, mà quân dời đi cũng đe dọa.',
    theme: 'discoveredAttack',
    maxRating: 1500,
    count: 3,
  },
  {
    id: 'deflection',
    chapter: 'Đòn chiến thuật cơ bản',
    title: 'Đánh lạc hướng',
    intro:
      'Một quân của đối thủ đang làm nhiệm vụ quan trọng: giữ một ô, bảo vệ một quân. Nếu bạn ép nó phải rời chỗ, nhiệm vụ đó bỏ trống. Thường thì bạn phải hy sinh một quân để dụ nó đi.',
    keyPoint: 'Ép quân đang canh gác phải rời vị trí, rồi khai thác chỗ nó bỏ trống.',
    theme: 'deflection',
    maxRating: 1500,
    count: 3,
  },
  {
    id: 'trapped',
    chapter: 'Đòn chiến thuật cơ bản',
    title: 'Quân bị kẹt',
    intro:
      'Một quân mạnh nhưng không có ô nào để đi thì coi như mất. Hậu lao vào sâu quá, Tượng chui vào góc, Mã ra biên — tất cả đều có thể bị vây. Tìm cách bịt hết đường về của nó.',
    keyPoint: 'Quân to mà hết ô để đi thì cũng chỉ là quân sắp mất.',
    theme: 'trappedPiece',
    maxRating: 1500,
    count: 3,
  },

  /* ---- Chương 3: Chiếu hết ---- */
  {
    id: 'mate1',
    chapter: 'Chiếu hết',
    title: 'Chiếu hết một nước',
    intro:
      'Chiếu hết là khi Vua bị chiếu mà không có cách nào thoát: không chạy được, không chặn được, không ăn được quân đang chiếu. Trước khi đi bất kỳ nước nào, hãy thử xem có nước chiếu nào kết thúc ván luôn không.',
    keyPoint: 'Luôn ngó qua các nước chiếu trước khi tính nước khác.',
    theme: 'mateIn1',
    maxRating: 1000,
    count: 4,
  },
  {
    id: 'backrank',
    chapter: 'Chiếu hết',
    title: 'Chiếu hết hàng cuối',
    intro:
      'Sau khi nhập thành, Vua thường bị chính ba con Tốt nhà chắn hết đường lên. Một quân Xe hay Hậu xuống được hàng cuối là chiếu hết ngay. Phòng bệnh rất đơn giản: đẩy một Tốt lên để Vua có lỗ thở.',
    keyPoint: 'Vua sau khi nhập thành cần một lỗ thở — nếu không, hàng cuối là tử huyệt.',
    theme: 'backRankMate',
    maxRating: 1200,
    count: 3,
  },
  {
    id: 'mate2',
    chapter: 'Chiếu hết',
    title: 'Chiếu hết hai nước',
    intro:
      'Nước đầu thường là một nước hy sinh hoặc một nước chiếu ép Vua vào chỗ chết. Đừng tìm nước "đẹp" — hãy tìm nước làm Vua đối thủ hết đường chạy, rồi mới tính nước kết liễu.',
    keyPoint: 'Nước đầu là để bịt đường chạy của Vua, nước sau mới kết thúc.',
    theme: 'mateIn2',
    maxRating: 1400,
    count: 4,
  },
  {
    id: 'smothered',
    chapter: 'Chiếu hết',
    title: 'Chiếu hết nghẹt thở',
    intro:
      'Vua bị chính quân nhà vây kín, chỉ một con Mã nhảy vào là hết. Đây là thế chiếu hết đẹp nhất trong cờ vua và xuất hiện nhiều hơn bạn tưởng, nhất là khi đối thủ vừa nhập thành xong.',
    keyPoint: 'Vua bị quân nhà vây kín thì chỉ cần một con Mã.',
    theme: 'smotheredMate',
    maxRating: 1600,
    count: 2,
  },

  /* ---- Chương 4: Tàn cuộc ---- */
  {
    id: 'advanced-pawn',
    chapter: 'Tàn cuộc',
    title: 'Tốt sắp phong cấp',
    intro:
      'Tốt đi tới hàng cuối thì thành Hậu. Trong tàn cuộc, một con Tốt vượt lên được thường quyết định cả ván. Hãy tính xem Vua đối thủ có kịp quay về chặn không — đếm số nước, đừng đoán.',
    keyPoint: 'Trong tàn cuộc, một con Tốt vượt xa đáng giá hơn bạn nghĩ.',
    theme: 'advancedPawn',
    maxRating: 1400,
    count: 3,
  },
  {
    id: 'pawn-endgame',
    chapter: 'Tàn cuộc',
    title: 'Tàn cuộc Tốt',
    intro:
      'Khi chỉ còn Vua và Tốt, Vua trở thành quân tấn công mạnh. Đưa Vua lên trước, đẩy Tốt sau. Nhiều ván hòa oan chỉ vì người chơi để Vua đứng yên ở nhà.',
    keyPoint: 'Tàn cuộc thì Vua phải đi lên, không được ngồi nhà.',
    theme: 'pawnEndgame',
    maxRating: 1500,
    count: 3,
  },
  {
    id: 'rook-endgame',
    chapter: 'Tàn cuộc',
    title: 'Tàn cuộc Xe',
    intro:
      'Đây là loại tàn cuộc hay gặp nhất. Xe thích đứng ở chỗ thoáng, phía sau Tốt đang tiến — của mình hay của đối thủ cũng vậy. Xe đứng bó chân sau đám Tốt nhà là Xe vô dụng.',
    keyPoint: 'Xe đứng sau Tốt đang tiến, đừng để Xe bị kẹt.',
    theme: 'rookEndgame',
    maxRating: 1600,
    count: 3,
  },
];

export const CHAPTERS = [...new Set(LESSONS.map((l) => l.chapter))];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
