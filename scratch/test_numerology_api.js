async function test() {
  const payload = {
    question: "Tôi có nên đổi hướng kinh doanh sang lĩnh vực dịch vụ công nghệ vào năm nay không?",
    context: JSON.stringify({
      fullName: "NGUYỄN VĂN A",
      birthDate: "15/09/1992",
      lifePath: "9",
      destiny: "5",
      soul: "2",
      personality: "3",
      attitude: "6",
      birthdayNumber: "6",
      arrows: "Mũi Tên Trí Tuệ (3-6-9), Mũi Tên Cảm Xúc (2-5-8)"
    }),
    type: "thansohoc",
    history: []
  };

  try {
    const res = await fetch('http://localhost:5005/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
