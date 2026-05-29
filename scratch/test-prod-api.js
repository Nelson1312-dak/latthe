const body = {
  question: "Test question",
  type: "gieoque",
  context: '{"mainName": "Quẻ Hàm", "mainText": "Trạch Sơn Hàm"}',
};

try {
  const res = await fetch("https://latbai.vn/api/interpret", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://latbai.vn",
    },
    body: JSON.stringify(body),
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  console.log("Body:", await res.text());
} catch (err) {
  console.error("Fetch error:", err);
}
