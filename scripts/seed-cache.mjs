// Using native global fetch available in Node.js 18+
const OLLAMA_URL = 'http://127.0.0.1:11434';
const POSTGREST_URL = 'http://127.0.0.1:3001';

const question = 'Tôi có nên nghỉ việc vào lúc này không?';

const dataToSeed = [
  {
    type: 'gieoque',
    question: question,
    context: JSON.stringify({
      mainName: "Trạch Thủy Khốn",
      mainText: "Kiệt sức và bế tắc. Đang trong giai đoạn khó khăn nhất. Hãy giữ vững phẩm giá và không từ bỏ giá trị của mình.. Lời khuyên: Anh hùng lộ diện trong lúc khốn cùng.",
      mutatedHao: "Hào 1, Hào 2, Hào 4",
      mutatedHaoText: "Biến đổi thành quẻ Địa Trạch Lâm (Tiếp cận và ảnh hưởng. Thời điểm thuận lợi để mở rộng và tiếp cận điều bạn mong muốn. Hãy hành động ngay.). Lời khuyên: Mùa xuân không chờ ai — hãy gieo hạt khi đất tốt."
    }),
    answer: `### 🔮 LỜI LUẬN GIẢI TỪ CỔ DỊCH ĐẠI SƯ\n\n- **Tâm nguyện người hỏi:** Tôi có nên nghỉ việc vào lúc này không?\n- **Thế trận Quẻ dịch:** Quẻ Trạch Thủy Khốn (Biến ở Hào 1 - Hào 2, Hào 4).\n\n---\n\n### 🌟 1. Phân Tích Cát Hùng (Tổng Quan)\nQuẻ Trạch Thủy Khốn (Đầm không có nước) báo hiệu bạn đang ở vào thời kỳ kiệt quệ, bế tắc và áp lực tinh thần đạt đến đỉnh điểm trong môi trường công sở hiện tại. Quẻ Khốn là tượng của sự giam hãm, năng lực không được phát huy và tài lộc bị vây hãm. Tuy nhiên, sự xuất hiện của các hào động tại Hào 1, Hào 2 và Hào 4 báo hiệu thế trận âm dương đang chuyển hóa mạnh mẽ. Điềm này thuộc về "Cực Khốn tắc Biến", nghịch cảnh đã đi đến tận cùng và chuẩn bị chuyển mình sang quẻ Địa Trạch Lâm (Sự tiếp cận, mùa xuân đang đến, thời cơ hanh thông rộng mở). Đây là thế trận chuyển Hung thành Cát, báo hiệu việc thay đổi công việc là một bước đi thuận theo lẽ tuần hoàn của tạo hóa.\n\n### 🎯 2. Ứng Nghiệm Vào Thực Tế\nXem xét việc rời bỏ công việc hiện tại, đây không đơn thuần là sự trốn chạy bộc phát mà là một quyết định tất yếu để giải phóng bản thân khỏi sự kìm hãm:\n- **Thời cuộc sự nghiệp:** Môi trường cũ đã cạn kiệt sinh khí và tài nguyên đối với bạn (như hồ nước đã cạn). Nỗ lực cống hiến thêm cũng khó mang lại kết quả xứng đáng.\n- **Thế trận Hào biến:** Hào 1 động cảnh báo thời kỳ đầu của sự bế tắc cần sự nhẫn nại; Hào 2 động chỉ ra dù khó khăn nhưng bạn vẫn có thực lực nội tại vững vàng; Hào 4 động báo hiệu việc tìm kiếm sự trợ giúp hoặc liên kết mới sẽ giúp bạn thoát ra nhanh chóng. Khi chuyển hóa thành quẻ Lâm, việc chủ động tiếp cận cái mới, mở rộng định hướng riêng hoặc nộp hồ sơ nơi khác sẽ cực kỳ hanh thông.\n- **Điểm mấu chốt:** Sự chuyển đổi này cần được tiến hành một cách điềm tĩnh và có lộ trình rõ ràng. Không nên vì quá ức chế mà tự ý bỏ ngang không bàn giao, vì điều đó sẽ làm suy tổn phước đức của bạn và tạo ra nghiệp quả xấu cho chặng đường sau.\n\n### 📜 3. Lời Khuyên (Cải Vận / Hành Động)\n- **Điều nên làm:** Hãy âm thầm chuẩn bị hồ sơ năng lực thật chu đáo, tìm hiểu kỹ các cơ hội mới và chủ động gửi CV. Khi nộp đơn xin nghỉ, hãy giữ thái độ lịch thiệp, thực hiện bàn giao công việc cũ một cách chuyên nghiệp, trọn vẹn nghĩa tình để tích thêm thiện duyên cho hành trình mới.\n- **Điều cần tránh:** Tránh nộp đơn xin nghỉ việc trong trạng thái tức giận, tranh cãi gay gắt với cấp trên hoặc đồng nghiệp. Tuyệt đối kiêng kị việc bỏ việc khi chưa có kế hoạch dự phòng tài chính hoặc chưa định hình được hướng đi tiếp theo.\n\n"Thời thế đổi thay, đức năng thắng số. Tùy cơ ứng biến, vạn sự bình an."`
  },
  {
    type: 'gieoque',
    question: question,
    context: JSON.stringify({
      mainName: "Thuần Càn",
      mainText: "Sức mạnh sáng tạo của trời. Đây là thời điểm hành động mạnh mẽ, tiến lên với ý chí kiên định. Vận may đang ở phía trước nếu bạn dũng cảm.. Lời khuyên: Hãy tiến lên, đừng do dự. Trời đất ủng hộ bạn.",
      mutatedHao: "Không có",
      mutatedHaoText: "Không có"
    }),
    answer: `### 🔮 LỜI LUẬN GIẢI TỪ CỔ DỊCH ĐẠI SƯ\n\n- **Tâm nguyện người hỏi:** Tôi có nên nghỉ việc vào lúc này không?\n- **Thế trận Quẻ dịch:** Quẻ Thuần Càn (Không có hào biến).\n\n---\n\n### 🌟 1. Phân Tích Cát Hùng (Tổng Quan)\nQuẻ Thuần Càn tượng trưng cho sức mạnh vô biên của Thiên đạo (Trời), mang tính cương kiện, sáng tạo dồi dào và chủ động tuyệt đối. Đây là một trong những quẻ đại cát, biểu thị thời thế mà dương khí cực thịnh, vận thế của bản thân bạn đang ở giai đoạn phát triển rực rỡ nhất. Đối với câu hỏi về việc nghỉ việc, quẻ Thuần Càn khẳng định bạn đang nắm giữ hoàn toàn quyền tự quyết và có đủ năng lực để tự dẫn dắt vận mệnh sự nghiệp của mình sang một trang mới độc lập và mạnh mẽ hơn.\n\n### 🎯 2. Ứng Nghiệm Vào Thực Tế\nQuyết định từ chức hay thay đổi định hướng công việc lúc này mang ý nghĩa của sự bứt phá vươn tầm, không phải là sự trốn tránh áp lực:\n- **Thời cuộc sự nghiệp:** Bạn đã tích lũy đủ kinh nghiệm, bản lĩnh và năng lực thực tế. Môi trường hiện tại đã trở nên quá chật hẹp, không còn đủ không gian cho bạn vẫy vùng hay phát huy hết tiềm năng sáng tạo của bản thân.\n- **Thế trận âm dương:** Với bản tính cương trực, kiên định của Càn, việc ra riêng để khởi nghiệp, nhận một chức vụ quản lý cấp cao hơn tại doanh nghiệp khác hoặc chuyển đổi hẳn sang một lĩnh vực mới đầy thử thách đều có cơ hội thành công cực lớn.\n- **Điểm mấu chốt:** Thời cơ vô cùng thuận lợi nhưng bạn cần giữ vững đạo đức, sự quang minh chính đại. Càn Long (Rồng Càn) bay cao thì phải có chí hướng rõ ràng và kế hoạch vững chắc, tránh kiêu ngạo hay chủ quan coi thường những chi tiết nhỏ.\n\n### 📜 3. Lời Khuyên (Cải Vận / Hành Động)\n- **Điều nên làm:** Dứt khoát bước ra khỏi vùng an toàn. Hãy tự tin triển khai các kế hoạch lớn như khởi nghiệp tự thân, tự làm chủ hoặc nhận những lời mời hợp tác từ các vị trí dẫn dắt, có tính thử thách cao hơn.\n- **Điều cần tránh:** Tuyệt đối tránh thái độ chần chừ, do dự làm lỡ mất thời cơ vàng. Đồng thời tránh hành xử ngạo mạn, coi thường đồng nghiệp cũ hay đối xử bất kính với người đi trước khi rời đi.\n\n"Thời thế đổi thay, đức năng thắng số. Tùy cơ ứng biến, vạn sự bình an."`
  },
  {
    type: 'gieoque',
    question: question,
    context: JSON.stringify({
      mainName: "Thuần Khảm",
      mainText: "Nguy hiểm kép và thử thách. Đang ở trong vực sâu — nhưng nước vẫn chảy qua. Hãy giữ vững đức hạnh qua gian khó.. Lời khuyên: Nước chảy qua đá — không phải vì mạnh mà vì kiên trì.",
      mutatedHao: "Không có",
      mutatedHaoText: "Không có"
    }),
    answer: `### 🔮 LỜI LUẬN GIẢI TỪ CỔ DỊCH ĐẠI SƯ\n\n- **Tâm nguyện người hỏi:** Tôi có nên nghỉ việc vào lúc này không?\n- **Thế trận Quẻ dịch:** Quẻ Thuần Khảm (Không có hào biến).\n\n---\n\n### 🌟 1. Phân Tích Cát Hùng (Tổng Quan)\nQuẻ Thuần Khảm tượng trưng cho vực thẳm kép, hiểm nguy trùng trùng, nước chảy cuồn cuộn không ngừng. Khảm là tượng của sự hãm hại, cạm bẫy và bế tắc lớn. Đối với câu hỏi về việc nghỉ việc, quẻ Thuần Khảm đưa ra lời cảnh báo cực kỳ nghiêm khắc. Đây là điềm Hung/Hiểm, báo hiệu rằng việc rời bỏ công việc cũ một cách vội vã lúc này sẽ không giúp bạn giải quyết được vấn đề mà trái lại, có thể khiến bạn rơi vào một vực thẳm tài chính và sự nghiệp sâu hơn, khó lường hơn.\n\n### 🎯 2. Ứng Nghiệm Vào Thực Tế\nThế trận hiểm nguy của Khảm đòi hỏi bạn phải có thái độ cực kỳ thận trọng, không được phép hành động cảm tính:\n- **Thời cuộc sự nghiệp:** Thị trường hoặc môi trường công việc bên ngoài đang vô cùng biến động, bất ổn và chứa đựng nhiều rủi ro hơn bạn tưởng tượng. Việc xin nghỉ lúc này giống như nhảy khỏi một con thuyền chao đảo thẳng xuống dòng nước xiết mà không có áo phao.\n- **Thế trận âm dương:** Bản chất của Khảm là nước — nước chảy qua khe đá nhờ sự kiên trì nhẫn nại và dòng chảy liên tục. Bài học dành cho bạn lúc này là sự tôi luyện bản lĩnh trong nghịch cảnh. Thay vì vội vã từ bỏ để trốn chạy áp lực, bạn cần nhìn nhận lại bản thân, học cách thích nghi và tìm kiếm điểm tựa nội tại.\n- **Điểm mấu chốt:** Cần duy trì sự bình tĩnh, dùng lý trí để dẫn đường. Hãy học cách tồn tại an toàn trong môi trường hiện tại trước khi nghĩ đến việc tìm kiếm một chân trời mới.\n\n### 📜 3. Lời Khuyên (Cải Vận / Hành Động)\n- **Điều nên làm:** Tiếp tục nhẫn nại làm tốt công việc hiện tại, hạn chế tối đa các xung đột công sở. Tập trung thắt chặt chi tiêu, tích lũy quỹ tài chính dự phòng thật vững chắc và lặng lẽ chuẩn bị, nâng cao năng lực chuyên môn để chờ thời thế xoay chuyển.\n- **Điều cần tránh:** Tuyệt đối không nộp đơn từ chức bốc đồng khi chưa tìm được bến đỗ mới có hợp đồng chính thức rõ ràng. Tránh xa các lời dụ dỗ đầu tư mạo hiểm hoặc các lời hứa hẹn không có cơ sở thực tế trong thời gian này.\n\n"Thời thế đổi thay, đức năng thắng số. Tùy cơ ứng biến, vạn sự bình an."`
  }
];

async function run() {
  console.log("Generating embedding for question:", question);
  let embedding = null;
  try {
    const embedRes = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: question })
    });
    if (!embedRes.ok) {
      throw new Error(`Ollama embed failed: ${embedRes.statusText}`);
    }
    const embedData = await embedRes.json();
    embedding = embedData.embedding;
    console.log("Embedding generated successfully. Length:", embedding.length);
  } catch (err) {
    console.error("Error generating embedding:", err);
    return;
  }

  for (const doc of dataToSeed) {
    console.log("Inserting/Updating document for:", doc.context.slice(0, 50));
    try {
      // First, check if a document with the same type, question, and context already exists, and delete it so we do not have duplicates.
      // This is local PostgREST, so we can delete using filter query parameters.
      const url = `${POSTGREST_URL}/documents?type=eq.${doc.type}&question=eq.${encodeURIComponent(doc.question)}&context=eq.${encodeURIComponent(doc.context)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Now insert the new detailed document.
      const res = await fetch(`${POSTGREST_URL}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: doc.type,
          question: doc.question,
          context: doc.context,
          answer: doc.answer,
          embedding: embedding
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Failed to insert document: ${res.status} ${errText}`);
      } else {
        console.log("Inserted successfully!");
      }
    } catch (err) {
      console.error("Error inserting document:", err);
    }
  }
}

run();
