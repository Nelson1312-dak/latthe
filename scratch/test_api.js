async function test() {
  try {
    const res = await fetch('http://localhost:5005/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: "ngày hôm nay của tôi thế nào",
        context: "{\"mainName\":\"Khôn vi Địa\",\"mainText\":\"Thuận theo tự nhiên, nhu thuận dưỡng đức\",\"mutatedHao\":\"Không có\",\"mutatedHaoText\":\"Không có\"}",
        type: "gieoque",
        history: []
      })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
