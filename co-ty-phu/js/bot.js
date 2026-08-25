/* ============================================================
   bot.js — Increment 3: bot biết định giá. Logic THUẦN, không chạm DOM,
   không gọi Render. Nhận state → trả QUYẾT ĐỊNH; app.js mới là chỗ thi hành.

   Ý chính: giá trị một ô KHÔNG phải tiền thuê, mà là TIỀN THUÊ × TẦN SUẤT ĐÁP,
   và tiền thuê đáng kể chỉ xuất hiện KHI CÓ NHÀ. Bot bản increment 2 quyết định
   bằng "còn dư ≥150tr thì mua" nên mua bừa rồi hết tiền, trông rất ngờ nghệch.

   ⚠️ ĐÍNH CHÍNH tuyên bố của increment 1 ("LAND_FREQ là bí quyết để bot mua
   hàng trông thông minh"). Đã ĐO: trong 28 ô mua được, freq chỉ chênh 1.48×
   (2.17%–3.22%), còn tỷ lệ sinh lời rent[3]/giá chênh 2.33× (1.50–3.50). Mấy ô
   freq cao thật (Trạm Giam 5.97%, Bãi Đỗ 2.86%) thì KHÔNG mua được. Nên
   LAND_FREQ là thành phần PHỤ, hữu ích và rẻ nhưng không phải thứ quyết định;
   thứ quyết định là tỷ lệ giá-trên-thuê-khi-đã-xây + gom đủ nhóm để được xây.
   Đừng kỳ vọng freq một mình làm bot khôn.

   Đơn vị chung của cả file: "thu nhập kỳ vọng mỗi VÒNG" (mỗi đối thủ đi 1 lượt)
     inc = số đối thủ × (freq/100) × tiền thuê
   rồi mọi quyết định so bằng SỐ VÒNG HOÀN VỐN = giá / inc. Nhỏ hơn là tốt hơn.
   ============================================================ */

(() => {
  'use strict';

  const W = window;
  const CTP = (W.CTP = W.CTP || {});

  const AVG_DICE = 7;   // kỳ vọng 2 xúc xắc, dùng cho ô dịch vụ (thuê = xúc xắc × hệ số)

  /* 3 hạng bot. Khác nhau THẬT ở các con số, không chỉ đổi tên:
     - buffer/floor : giữ lại bao nhiêu tiền mặt trước khi dám chi (chống phá sản)
     - buyPay       : chấp nhận MUA nếu hoàn vốn trong ≤ bao nhiêu vòng
     - buildPay     : ngưỡng riêng cho XÂY, cố ý CAO hơn buyPay
     - mono/block   : coi nước chốt độc quyền / chặn đối thủ nặng cỡ nào

     ⚠️ BÀI HỌC ĐO ĐƯỢC — đừng làm "Cá Mập" thành hạng THỤ ĐỘNG. Bản đầu mình
     cho camap buyPay thấp nhất (30), buffer cao nhất (5) và trần 3 nhà, nghĩ
     "kỷ luật = mạnh". Kết quả đo ở chế độ cổ điển: camap chỉ thắng thuong
     11.7% và phá sản 159/250 ván — vì mua quá ít nên KHÔNG CÓ THU NHẬP rồi
     chảy máu tiền thuê tới chết. Trong game này thụ động là chết. Cá Mập đúng
     nghĩa phải HUNG HÃN mà vẫn trụ: mua nhiều, xây tới cùng, ưu tiên độc
     quyền/chặn, chỉ khác Tay Mơ ở chỗ nó không mua rác và luôn chừa tiền sống.

     buildPay > buyPay ở mọi hạng là CÓ CHỦ Ý: khi đã độc quyền thì xây là nước
     lãi nhất bàn (rent 150→450 ở căn thứ 3), lãi hơn mua thêm ô lẻ. */
  const TIERS = {
    // Tay Mơ: mua gần như mọi thứ kể cả ô rác, gần như không chừa tiền, và
    // KHÔNG nhận ra xây nhà mới là chỗ ra tiền ⇒ phá sản nhiều.
    taymo:  { buffer: 0.5, floor: 30,  buyPay: 95, buildPay: 38,  mono: 0.20, block: 0.05, hardCap: 5 },
    thuong: { buffer: 2.5, floor: 90,  buyPay: 52, buildPay: 78,  mono: 1.00, block: 0.50, hardCap: 5 },
    camap:  { buffer: 3.2, floor: 150, buyPay: 68, buildPay: 120, mono: 2.00, block: 1.20, hardCap: 5 },
  };
  const cfgOf = (tier) => TIERS[tier] || TIERS.thuong;

  const opponentsAlive = (state, me) =>
    state.players.filter((p) => p.idx !== me && !p.bankrupt).length;

  const ownedInGroup = (state, nhom, who) =>
    CTP_GROUP_TILES[nhom].filter((i) => state.tiles[i].owner === who).length;

  /* Tiền thuê kỳ vọng thu được từ ô `i` mỗi lượt đối thủ đi, theo trạng thái
     HIỆN TẠI của state (ai là chủ, mấy nhà). levelOverride để thử "nếu xây thêm". */
  function expRent(state, i, owner, levelOverride) {
    const t = CTP_BOARD[i];
    const f = CTP_LAND_FREQ[i] / 100;
    if (f <= 0) return 0;
    if (t.kind === 'dat') {
      const lv = levelOverride == null ? state.tiles[i].level : levelOverride;
      let r;
      if (lv > 0) r = t.rent[lv];
      else {
        // đất trống nhưng độc quyền cả nhóm thì thuê nhân đôi (khớp engine)
        const all = CTP_GROUP_TILES[t.nhom].every((g) => state.tiles[g].owner === owner);
        r = all ? t.rent[0] * 2 : t.rent[0];
      }
      return f * r;
    }
    if (t.kind === 'sanbay') {
      const n = CTP_SANBAY_TILES.filter((x) => state.tiles[x].owner === owner).length;
      return n > 0 ? f * 25 * Math.pow(2, n - 1) : 0;
    }
    if (t.kind === 'tienich') {
      const n = CTP_TIENICH_TILES.filter((x) => state.tiles[x].owner === owner).length;
      return n > 0 ? f * AVG_DICE * (n >= 2 ? 10 : 4) : 0;
    }
    return 0;
  }

  /* "Lượt đau" — tổng tiền thuê kỳ vọng mình phải trả cho NGƯỜI KHÁC mỗi lượt.
     Đây là thước đo rủi ro để quyết định giữ lại bao nhiêu tiền mặt. Bot cũ
     không có khái niệm này nên hay mua xong là phá sản ở cú thuê kế tiếp. */
  function dangerPerTurn(state, me) {
    let s = 0;
    for (let i = 0; i < 40; i++) {
      const st = state.tiles[i];
      if (st && st.owner != null && st.owner !== me) s += expRent(state, i, st.owner, null);
    }
    return s;
  }

  const reserveOf = (state, p, cfg) =>
    Math.max(cfg.floor, dangerPerTurn(state, p.idx) * cfg.buffer);

  /* Chạy `fn` trong trạng thái GIẢ ĐỊNH "ô i đã thuộc về owner", rồi trả lại
     nguyên trạng. Cần vì giá trị sân bay/dịch vụ và thuê-độc-quyền phụ thuộc
     vào việc mình có ô đó hay chưa — không giả lập thì luôn định giá thấp. */
  function withOwned(state, i, owner, fn) {
    const st = state.tiles[i];
    const oldOwner = st.owner, oldLevel = st.level;
    st.owner = owner; st.level = 0;
    try { return fn(); } finally { st.owner = oldOwner; st.level = oldLevel; }
  }

  /* Định giá theo TIỀM NĂNG, không theo thuê đất trống.
     ⚠️ ĐÂY LÀ CHỖ DỄ SAI NHẤT CẢ FILE — bản đầu mình lấy thuê đất trống chia
     giá và ra 315–1382 VÒNG hoàn vốn cho mọi ô, cao hơn mọi ngưỡng, nên bot
     không mua gì suốt cả ván và 3 hạng giống hệt nhau (đo được: 50.2% ~ ngẫu
     nhiên). Tiền thuê thật chỉ xuất hiện khi CÓ NHÀ, nên phải định giá bằng
     đường đi tới 3 nhà, chiết khấu theo xác suất gom đủ nhóm.
     Trả { inv, inc } — vốn phải bỏ và thu nhập kỳ vọng mỗi vòng. */
  function potential(state, i, me, k) {
    const t = CTP_BOARD[i];
    const f = CTP_LAND_FREQ[i] / 100;
    if (f <= 0) return { inv: t.gia || 0, inc: 0 };

    if (t.kind === 'dat') {
      const need = CTP_GROUP_TILES[t.nhom].length;
      const have = ownedInGroup(state, t.nhom, me) + 1;   // tính cả ô đang xét
      const pC = Math.min(1, have / need);                // xác suất gom đủ nhóm (thô)
      const T = 3;                                        // mốc 3 nhà: rent nhảy mạnh nhất
      const rentNow = pC >= 1 ? t.rent[0] * 2 : t.rent[0];
      const inc = k * f * (pC * t.rent[T] + (1 - pC) * rentNow);
      const inv = t.gia + pC * T * t.xay;                 // tiền nhà chỉ tính theo phần khả thi
      return { inv, inc };
    }
    // Sân bay / dịch vụ KHÔNG xây được: giá trị đúng bằng mức thuê sau khi mua.
    // Không thổi thêm hệ số "biết đâu gom thêm" — chúng vốn yếu trong luật này,
    // và bot tự khắc mua khi đã có sẵn vài cái (thuê nhân đôi mỗi lần thêm).
    const inc = k * withOwned(state, i, me, () => expRent(state, i, me, null));
    return { inv: t.gia, inc };
  }

  /* ---------- quyết định MUA ---------- */
  function wantBuy(state) {
    const p = state.players[state.turn];
    const pend = state.pending;
    if (!pend || pend.kind !== 'buy') return false;
    const i = pend.tile, t = CTP_BOARD[i];
    if (p.cash < t.gia) return false;

    const cfg = cfgOf(p.tier);
    const k = Math.max(1, opponentsAlive(state, p.idx));
    const { inv, inc } = potential(state, i, p.idx, k);
    if (inc <= 0) return false;

    let payback = inv / inc;

    // Nước chốt độc quyền: mua xong là đủ cả nhóm ⇒ mở khoá xây nhà + thuê ×2
    let mono = false, block = false;
    if (t.kind === 'dat') {
      const need = CTP_GROUP_TILES[t.nhom].length;
      if (ownedInGroup(state, t.nhom, p.idx) === need - 1) mono = true;
      // Chặn: có đối thủ đang giữ n-1 ô của nhóm này, đây là ô cuối
      for (const o of state.players) {
        if (o.idx === p.idx || o.bankrupt) continue;
        if (ownedInGroup(state, t.nhom, o.idx) === need - 1) { block = true; break; }
      }
    }
    if (mono)  payback /= (1 + cfg.mono);
    if (block) payback /= (1 + cfg.block);

    // Đủ tiền dự phòng chưa? Nước chốt/chặn thì được phá lệ, nhưng vẫn phải
    // chừa một nửa sàn để không tự sát ngay cú thuê sau.
    const reserve = reserveOf(state, p, cfg);
    if (p.cash - t.gia < reserve) {
      if (!(mono || block)) return false;
      if (p.cash - t.gia < cfg.floor * 0.5) return false;
    }
    return payback <= cfg.buyPay;
  }

  /* ---------- quyết định XÂY ----------
     Trả index ô nên xây, hoặc null. Chọn ô có SỐ VÒNG HOÀN VỐN BIÊN nhỏ nhất:
     tiền bỏ ra 1 căn / phần thuê tăng thêm × tần suất đáp. */
  function chooseBuild(state) {
    const E = CTP.Engine;
    if (!E) return null;
    const p = state.players[state.turn];
    const ids = E.buildableTiles(state);
    if (!ids.length) return null;

    const cfg = cfgOf(p.tier);
    const k = Math.max(1, opponentsAlive(state, p.idx));
    const reserve = reserveOf(state, p, cfg);
    // Trần nhà là mềm: rất nhiều tiền thì cứ xây tiếp, đọng vốn không còn là vấn đề
    const rich = p.cash > reserve * 3;
    const cap = rich ? 5 : cfg.hardCap;

    /* Xét theo ĐƯỜNG ĐI tới mốc T, không theo 1 căn lẻ.
       ⚠️ Cùng lớp lỗi với potential(): tính riêng căn thứ 1 thì hoàn vốn ~94
       vòng (rent 10→50) nên chẳng bao giờ đạt ngưỡng, mà luật xây đều bắt buộc
       phải qua căn 1-2 mới tới căn 3 — nơi rent nhảy 150→450. Vậy phải so vốn
       CỘNG DỒN tới T với thu nhập TẠI T, rồi mới xây 1 căn theo hướng đó. */
    let best = null, bestPay = Infinity;
    for (const i of ids) {
      const t = CTP_BOARD[i], st = state.tiles[i];
      if (st.level >= cap) continue;
      if (p.cash - t.xay < reserve) continue;
      const f = CTP_LAND_FREQ[i] / 100;
      for (let T = st.level + 1; T <= Math.min(cap, 5); T++) {
        const gain = k * f * (t.rent[T] - t.rent[st.level]);
        if (gain <= 0) continue;
        const pay = ((T - st.level) * t.xay) / gain;
        if (pay < bestPay) { bestPay = pay; best = i; }
      }
    }
    return bestPay <= cfg.buildPay ? best : null;
  }

  /* ---------- quyết định trong TÙ ----------
     'card' | 'pay' | 'roll'. Điểm tinh tế: về cuối ván, TÙ LÀ CHỖ AN TOÀN —
     ngồi trong tù không phải trả thuê cho ai. Cá Mập biết điều đó, Tay Mơ thì
     luôn nôn nóng ra ngoài rồi đi đúng vào bãi khách sạn của đối thủ. */
  function jailPlan(state) {
    const p = state.players[state.turn];
    const cfg = cfgOf(p.tier);
    const danger = dangerPerTurn(state, p.idx);
    const late = danger * 6 > p.cash;      // sắp tới lúc mỗi vòng đi là mất lớn

    if (p.tier === 'camap') {
      if (late) return 'roll';             // nằm im, chờ tung đôi, khỏi trả thuê
      if (p.jailCards > 0) return 'card';
      return p.cash >= CTP_DEFAULTS.jailFine * 3 ? 'pay' : 'roll';
    }
    if (p.tier === 'taymo') {
      if (p.jailCards > 0) return 'card';
      return p.cash >= CTP_DEFAULTS.jailFine ? 'pay' : 'roll';
    }
    // Con Buôn: ra sớm để còn mua, nhưng không dốc túi
    if (late && p.cash < danger * 3) return 'roll';
    if (p.jailCards > 0) return 'card';
    return p.cash >= CTP_DEFAULTS.jailFine * 4 ? 'pay' : 'roll';
  }

  CTP.Bot = {
    wantBuy, chooseBuild, jailPlan,
    // export để mô phỏng/kiểm thử ngoài UI
    expRent, dangerPerTurn, TIERS,
  };
})();
