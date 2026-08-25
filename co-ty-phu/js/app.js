/* ============================================================
   app.js — Wiring. Increment 2: cắm Engine vào UI (tung xúc xắc, mua/trả,
   xây nhà, tù, kết thúc ván). Bot chỉ có quyết định ĐƠN GIẢN (mua nếu còn dư
   dả, luôn trả nợ, ra tù sớm nếu đủ tiền) — AI thật (dùng CTP_LAND_FREQ để
   định giá ROI) là increment 3. Đăng ký sw.js/sitemap/trang chủ là increment 4.
   ============================================================ */

(() => {
  'use strict';

  const W = window;
  const CTP = (W.CTP = W.CTP || {});
  const R = CTP.Render;
  const E = CTP.Engine;
  const $ = (id) => document.getElementById(id);

  const boardEl = $('mb-board');
  const railEl = $('mb-rail');
  const tickEl = $('mb-tick');

  let state = null;      // state ván hiện tại (null ở màn setup)
  let rolling = false;   // khoá double-click trong lúc quân đang bay
  let fastBots = false;  // nút "Tăng tốc lượt bot"
  let prevCash = [];     // để biết tiền tăng hay giảm mà flash đúng màu
  let hopFlip = false;   // luân phiên class nảy a/b (xem .mb-token.is-hop-* )

  /* ---------- cấu hình ván (setup) ---------- */
  const cfg = {
    mode: CTP_DEFAULTS.mode,
    seats: [
      { name: 'Bạn',      kind: 'human', tier: null },
      { name: 'Con Buôn', kind: 'bot',   tier: 'thuong' },
      null,
      null,
    ],
  };

  const TIERS = [
    { v: 'human',  label: 'Người thật' },
    { v: 'taymo',  label: 'Bot · Tay Mơ' },
    { v: 'thuong', label: 'Bot · Con Buôn' },
    { v: 'camap',  label: 'Bot · Cá Mập' },
    { v: 'off',    label: '— Trống —' },
  ];

  /* ---------- màn setup ---------- */
  function renderSeats() {
    const box = $('mb-seats');
    box.textContent = '';
    for (let i = 0; i < 4; i++) {
      const seat = cfg.seats[i] || null;
      const row = R.el('div', 'mb-seat');

      const dot = R.el('span', 'mb-seat-dot');
      dot.style.setProperty('--tk', CTP_TOKENS[i].mau);
      row.appendChild(dot);

      const inp = R.el('input', 'mb-input');
      inp.type = 'text';
      inp.maxLength = 12;
      inp.placeholder = 'Tên người chơi ' + (i + 1);
      inp.value = seat ? seat.name : '';
      inp.disabled = !seat;
      inp.addEventListener('input', () => { if (cfg.seats[i]) cfg.seats[i].name = inp.value; });
      row.appendChild(inp);

      const sel = R.el('select', 'mb-select');
      for (const t of TIERS) {
        // 2 ghế đầu không được bỏ trống — cần tối thiểu 2 người chơi
        if (t.v === 'off' && i < 2) continue;
        const o = R.el('option', null, t.label);
        o.value = t.v;
        sel.appendChild(o);
      }
      sel.value = !seat ? 'off' : seat.kind === 'human' ? 'human' : seat.tier;
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === 'off') cfg.seats[i] = null;
        else if (v === 'human') cfg.seats[i] = { name: inp.value || 'Người ' + (i + 1), kind: 'human', tier: null };
        else {
          const lbl = TIERS.find(t => t.v === v).label.replace('Bot · ', '');
          cfg.seats[i] = { name: inp.value || lbl, kind: 'bot', tier: v };
        }
        renderSeats();
      });
      row.appendChild(sel);

      box.appendChild(row);
    }
  }

  function bindMode() {
    const box = $('mb-mode');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.mb-seg-b');
      if (!b) return;
      cfg.mode = b.dataset.mode;
      box.querySelectorAll('.mb-seg-b').forEach(x => x.classList.toggle('is-on', x === b));
    });
  }

  function showScreen(which) {
    $('mb-screen-setup').classList.toggle('is-on', which === 'setup');
    $('mb-screen-play').classList.toggle('is-on', which === 'play');
  }

  /* ---------- ticker: xếp hàng, hiện lần lượt để đọc kịp luồng sự kiện ---------- */
  let tickQueue = [];
  let tickTimer = null;

  /* Nhịp rút hàng ĐỘNG, không phải setInterval cố định 950ms.
     Lý do (đo được, không phải phòng xa): 4 bot đánh liên tục sinh 1–3 dòng mỗi
     lượt trong khi lượt bot chỉ mất ~700ms + 380ms lắc, tức sinh nhanh hơn
     tiêu thụ ⇒ queue phình vô hạn và ticker tụt hậu càng lúc càng xa bàn. Đã
     bắt tận tay: xúc xắc hiện 3-5 "Tổng: 8" mà ticker còn đọc "Bạn tung 4-5"
     của lượt TRƯỚC. Queue dài thì rút nhanh, và cắt bớt phần cũ nếu quá dài —
     dòng cũ đã lỡ thì không còn giá trị gì. */
  function drainTick() {
    if (!tickQueue.length) { tickTimer = null; return; }
    const msg = tickQueue.shift();
    tickEl.textContent = '';
    tickEl.appendChild(R.el('div', 'mb-tick-line', msg));
    const n = tickQueue.length;
    tickTimer = setTimeout(drainTick, n > 4 ? 260 : n > 1 ? 520 : 900);
  }
  function pushTicks(events) {
    if (!events || !events.length) return;
    events.forEach((e) => tickQueue.push(e.msg));
    if (tickQueue.length > 8) tickQueue = tickQueue.slice(-8);
    if (!tickTimer) drainTick();
  }

  /* ---------- rail người chơi ---------- */
  function renderRail() {
    if (!state) return;
    const players = state.players;
    railEl.style.setProperty('--n', String(players.length));
    railEl.dataset.n = String(players.length);
    railEl.textContent = '';
    const groupKeys = Object.keys(CTP_GROUPS);
    players.forEach((p, i) => {
      const b = R.el('button', 'mb-pl' + (i === state.turn ? ' is-turn' : '') + (p.bankrupt ? ' is-out' : ''));
      b.type = 'button';
      b.style.setProperty('--tk', CTP_TOKENS[i].mau);   // nhuốm cả chip, xem CSS
      const top = R.el('div', 'mb-pl-top');
      const dot = R.el('span', 'mb-pl-dot');
      dot.style.setProperty('--tk', CTP_TOKENS[i].mau);
      top.appendChild(dot);
      top.appendChild(R.el('span', 'mb-pl-name', p.name + (p.jail ? ' 🔒' : '')));
      if (p.kind === 'bot') top.appendChild(R.el('span', 'mb-pl-bot', 'bot'));
      b.appendChild(top);
      // renderRail dựng lại DOM mỗi lần nên chỉ cần GẮN class là animation chạy
      const dir = prevCash[i] == null || p.cash === prevCash[i] ? ''
        : p.cash > prevCash[i] ? ' is-up' : ' is-down';
      b.appendChild(R.el('div', 'mb-pl-cash mb-num' + dir, R.fmtMoney(p.cash)));
      const strip = R.el('div', 'mb-pl-strip');
      groupKeys.forEach((g) => {
        const seg = R.el('span', 'mb-pl-seg');
        if (CTP_GROUP_TILES[g].some((ti) => state.tiles[ti].owner === i)) {
          seg.classList.add('is-on');
          seg.style.setProperty('--sg', CTP_GROUPS[g].mau);
        }
        strip.appendChild(seg);
      });
      b.appendChild(strip);
      b.addEventListener('click', () => sheetPlayer(i));
      railEl.appendChild(b);
    });
    prevCash = players.map((p) => p.cash);
  }

  /* ---------- tâm bàn: ai đang đi + đang chờ gì ---------- */
  function renderCentre() {
    const live = $('mb-centre-live');
    if (!live) return;
    live.textContent = '';
    if (!state) return;
    if (state.over) {
      const w = state.players[state.winner];
      const who = R.el('div', 'mb-cl-who');
      const dot = R.el('span', 'mb-cl-dot');
      dot.style.setProperty('--tk', CTP_TOKENS[w.idx].mau);
      who.appendChild(dot);
      who.appendChild(R.el('span', 'mb-cl-name', w.name));
      live.appendChild(who);
      live.appendChild(R.el('div', 'mb-cl-what is-money', '🏆 thắng ván'));
      return;
    }
    const p = state.players[state.turn];
    const who = R.el('div', 'mb-cl-who');
    const dot = R.el('span', 'mb-cl-dot');
    dot.style.setProperty('--tk', CTP_TOKENS[p.idx].mau);
    who.appendChild(dot);
    who.appendChild(R.el('span', 'mb-cl-name', p.name));
    live.appendChild(who);

    let what = 'đang tới lượt', money = false;
    const pend = state.pending;
    if (pend && pend.kind === 'buy') { what = 'mua ' + CTP_BOARD[pend.tile].ten + '?'; money = true; }
    else if (pend && pend.kind === 'pay') { what = 'phải trả ' + pend.amount + ' tr'; money = true; }
    else if (p.jail) what = 'đang trong tù';
    else if (p.kind === 'bot') what = 'bot đang tính…';
    const w = R.el('div', 'mb-cl-what' + (money ? ' is-money' : ''), what);
    live.appendChild(w);
  }

  /* Viền vàng ở ô người đang đi đứng. CSS .is-here có từ increment 1 nhưng
     chưa ai set — bàn vì thế không có mốc "tôi đang ở đâu". */
  function setHere(pos) {
    boardEl.querySelectorAll('.mb-tile.is-here').forEach((x) => x.classList.remove('is-here'));
    const t = boardEl.querySelector('.mb-tile[data-i="' + pos + '"]');
    if (t) t.classList.add('is-here');
  }

  /* Bloom báo trước ô đích — chạy TRƯỚC khi quân tới để cú tung có sức nặng.
     Cũng là CSS chết từ increment 1 (.is-target). */
  function flashTarget(pos) {
    const t = boardEl.querySelector('.mb-tile[data-i="' + pos + '"]');
    if (!t) return;
    t.classList.remove('is-target');
    void t.offsetWidth;            // buộc reflow để animation replay
    t.classList.add('is-target');
    setTimeout(() => t.classList.remove('is-target'), 460);
  }

  /* ---------- sheet ---------- */
  function openSheet(build) {
    const body = $('mb-sheet-body');
    body.textContent = '';
    build(body);
    $('mb-sheet-back').classList.add('is-on');
  }
  function closeSheet() {
    $('mb-sheet-back').classList.remove('is-on');
    boardEl.querySelectorAll('.mb-tile.is-focus').forEach(x => x.classList.remove('is-focus'));
  }

  function sheetTile(i) {
    const t = CTP_BOARD[i];
    openSheet((body) => {
      const deed = R.el('div', 'mb-deed');
      deed.style.setProperty('--grp', R.tileColor(t));
      const head = R.el('div', 'mb-deed-head');
      const kindLabel = {
        dat: 'Ô đất · ' + (t.nhom ? CTP_GROUPS[t.nhom].ten : ''),
        sanbay: 'Sân bay', tienich: 'Dịch vụ công', cohoi: 'Thẻ Cơ Hội',
        vanmenh: 'Thẻ Vận Mệnh', thue: 'Thuế', goc: 'Ô đặc biệt',
      }[t.kind];
      head.appendChild(R.el('div', 'mb-deed-kind', kindLabel));
      head.appendChild(R.el('div', 'mb-deed-name', t.ten));
      deed.appendChild(head);

      const rows = R.el('div', 'mb-deed-rows');
      const add = (k, v, isNow) => {
        const r = R.el('div', 'mb-deed-row' + (isNow ? ' is-now' : ''));
        r.appendChild(R.el('span', null, k));
        r.appendChild(R.el('b', 'mb-num', v));
        rows.appendChild(r);
      };
      if (state && (t.kind === 'dat' || t.kind === 'sanbay' || t.kind === 'tienich')) {
        const st = state.tiles[i];
        add('Hiện tại', st.owner != null
          ? state.players[st.owner].name + (st.level > 0 ? ' · ' + (st.level === 5 ? 'khách sạn' : st.level + ' nhà') : '')
          : 'Chưa ai sở hữu', true);
      }
      if (t.kind === 'dat') {
        add('Giá mua', R.fmtFull(t.gia));
        add('Thuê (đất trống)', R.fmtFull(t.rent[0]));
        for (let k = 1; k <= 4; k++) add(k + ' nhà', R.fmtFull(t.rent[k]));
        add('Khách sạn', R.fmtFull(t.rent[5]));
        add('Giá mỗi nhà', R.fmtFull(t.xay));
        add('Bán lại nhà băng', R.fmtFull(t.gia / 2));
      } else if (t.kind === 'sanbay') {
        add('Giá mua', R.fmtFull(t.gia));
        [1, 2, 3, 4].forEach(n => add('Khi có ' + n + ' sân bay', R.fmtFull(25 * Math.pow(2, n - 1))));
      } else if (t.kind === 'tienich') {
        add('Giá mua', R.fmtFull(t.gia));
        add('Có 1 dịch vụ', 'xúc xắc × 4');
        add('Có 2 dịch vụ', 'xúc xắc × 10');
      } else if (t.kind === 'thue') {
        add('Phải nộp', R.fmtFull(t.tien));
      } else {
        rows.appendChild(R.el('p', 'mb-sheet-sub',
          t.i === 0 ? 'Mỗi lần đi qua đây nhận ' + CTP_DEFAULTS.goSalary + ' triệu.'
          : t.i === 10 ? 'Ghé thăm thì không mất gì. Chỉ mất lượt khi bị bắt vào tù.'
          : t.i === 20 ? 'Ô an toàn — không mất gì, không được gì.'
          : 'Vào thẳng Trạm Giam, không đi qua Xuất Phát, không nhận lương.'));
      }
      deed.appendChild(rows);
      body.appendChild(deed);
    });
  }

  function sheetList() {
    openSheet((body) => {
      body.appendChild(R.el('p', 'mb-sheet-title', 'Danh sách 40 ô'));
      body.appendChild(R.el('p', 'mb-sheet-sub', 'Bản đọc được của bàn cờ — chạm để xem chi tiết từng ô.'));
      const list = R.el('div', 'mb-list');
      for (const t of CTP_BOARD) {
        const it = R.el('button', 'mb-list-it');
        it.type = 'button';
        const sw = R.el('span', 'mb-list-sw');
        sw.style.setProperty('--grp', R.tileColor(t));
        it.appendChild(sw);
        it.appendChild(R.el('span', 'mb-list-nm', t.ten));
        it.appendChild(R.el('span', 'mb-list-meta',
          t.gia ? t.gia + ' tr' : t.tien ? '−' + t.tien + ' tr' : ''));
        it.addEventListener('click', () => sheetTile(t.i));
        list.appendChild(it);
      }
      body.appendChild(list);
    });
  }

  function sheetPlayer(i) {
    const p = state.players[i];
    openSheet((body) => {
      body.appendChild(R.el('p', 'mb-sheet-title', p.name + (p.kind === 'bot' ? ' · Bot' : '')));
      body.appendChild(R.el('p', 'mb-sheet-sub',
        'Tiền mặt: ' + R.fmtFull(p.cash) + ' · Tổng tài sản: ' + R.fmtFull(E.netWorth(state, p))
        + (p.bankrupt ? ' · Đã phá sản' : '')));
      const owned = CTP_BOARD.filter((t) => state.tiles[t.i] && state.tiles[t.i].owner === i);
      if (!owned.length) { body.appendChild(R.el('p', 'mb-sheet-sub', 'Chưa sở hữu ô nào.')); return; }
      const list = R.el('div', 'mb-list');
      owned.forEach((t) => {
        const st = state.tiles[t.i];
        const it = R.el('button', 'mb-list-it');
        it.type = 'button';
        const sw = R.el('span', 'mb-list-sw');
        sw.style.setProperty('--grp', R.tileColor(t));
        it.appendChild(sw);
        it.appendChild(R.el('span', 'mb-list-nm', t.ten));
        it.appendChild(R.el('span', 'mb-list-meta', st.level > 0 ? (st.level === 5 ? 'khách sạn' : st.level + ' nhà') : ''));
        it.addEventListener('click', () => sheetTile(t.i));
        list.appendChild(it);
      });
      body.appendChild(list);
    });
  }

  function sheetBuild() {
    openSheet((body) => {
      body.appendChild(R.el('p', 'mb-sheet-title', 'Xây nhà'));
      const ids = E.buildableTiles(state);
      if (!ids.length) { body.appendChild(R.el('p', 'mb-sheet-sub', 'Không có ô nào đủ điều kiện xây lúc này.')); return; }
      const list = R.el('div', 'mb-list');
      ids.forEach((idx) => {
        const t = CTP_BOARD[idx];
        const st = state.tiles[idx];
        const it = R.el('button', 'mb-list-it');
        it.type = 'button';
        const sw = R.el('span', 'mb-list-sw');
        sw.style.setProperty('--grp', R.tileColor(t));
        it.appendChild(sw);
        it.appendChild(R.el('span', 'mb-list-nm', t.ten));
        it.appendChild(R.el('span', 'mb-list-meta',
          R.fmtFull(t.xay) + ' · ' + (st.level + 1 === 5 ? 'khách sạn' : 'nhà ' + (st.level + 1))));
        it.addEventListener('click', () => {
          pushTicks(E.build(state, idx));
          closeSheet();
          R.paintAllTiles(boardEl, state);
          renderRail();
          renderActions();
        });
        list.appendChild(it);
      });
      body.appendChild(list);
    });
  }

  /* ---------- action bar: nút bấm theo state.phase/pending hiện tại ---------- */
  function updateDiceEnabled() {
    const p = state && !state.over ? state.players[state.turn] : null;
    const can = !!p && state.phase === 'idle' && p.kind === 'human' && !p.bankrupt;
    $('mb-die-1').disabled = !can;
    $('mb-die-2').disabled = !can;
  }

  function renderActions() {
    updateDiceEnabled();
    const box = $('mb-buttons');
    box.textContent = '';
    if (!state) return;
    if (state.over) {
      const btn = R.el('button', 'mb-btn mb-btn--go', 'Ván mới');
      btn.type = 'button';
      btn.addEventListener('click', () => showScreen('setup'));
      box.appendChild(btn);
      return;
    }
    const p = state.players[state.turn];
    if (p.kind !== 'human') return; // bot tự chạy — xem maybeBotTurn/botAct

    if (p.jail && state.phase === 'idle') {
      const payBtn = R.el('button', 'mb-btn', 'Đóng ' + CTP_DEFAULTS.jailFine + ' tr ra tù');
      payBtn.type = 'button';
      payBtn.disabled = p.cash < CTP_DEFAULTS.jailFine;
      payBtn.addEventListener('click', () => { pushTicks(E.payJailFine(state)); afterEngineChange(); });
      box.appendChild(payBtn);
      if (p.jailCards > 0) {
        const cardBtn = R.el('button', 'mb-btn', 'Dùng thẻ miễn tù');
        cardBtn.type = 'button';
        cardBtn.addEventListener('click', () => { pushTicks(E.useJailCard(state)); afterEngineChange(); });
        box.appendChild(cardBtn);
      }
    }

    if (state.phase === 'awaiting' && state.pending) {
      const pend = state.pending;
      if (pend.kind === 'buy') {
        const t = CTP_BOARD[pend.tile];
        const buyBtn = R.el('button', 'mb-btn mb-btn--ok', 'Mua · ' + t.gia + ' tr');
        buyBtn.type = 'button';
        buyBtn.disabled = p.cash < t.gia;
        buyBtn.addEventListener('click', () => { pushTicks(E.buy(state, true)); afterEngineChange(); });
        const skipBtn = R.el('button', 'mb-btn mb-btn--ghost', 'Bỏ qua');
        skipBtn.type = 'button';
        skipBtn.addEventListener('click', () => { pushTicks(E.buy(state, false)); afterEngineChange(); });
        box.appendChild(buyBtn);
        box.appendChild(skipBtn);
      } else if (pend.kind === 'pay') {
        const payBtn = R.el('button', 'mb-btn mb-btn--go', 'Đóng ' + pend.amount + ' tr');
        payBtn.type = 'button';
        payBtn.addEventListener('click', () => { pushTicks(E.settlePending(state)); afterEngineChange(); });
        box.appendChild(payBtn);
      }
    } else if (state.phase === 'idle') {
      const buildable = E.buildableTiles(state);
      if (buildable.length) {
        const buildBtn = R.el('button', 'mb-btn', 'Xây nhà (' + buildable.length + ')');
        buildBtn.type = 'button';
        buildBtn.addEventListener('click', sheetBuild);
        box.appendChild(buildBtn);
      }
    }
  }

  /* Refresh dùng chung sau MỌI thay đổi state không kèm animate quân
     (mua/trả/xây/tù) — có animate quân (roll) thì doRoll tự lo trong `finish`. */
  function afterEngineChange() {
    R.paintAllTiles(boardEl, state);
    R.layoutTokens(boardEl, state);
    setHere(state.players[state.turn].pos);
    renderRail();
    renderCentre();
    renderActions();
    maybeBotTurn();
  }

  /* ---------- tung xúc xắc + animate quân từng ô một ---------- */
  function updateDiceUI() {
    if (!state.lastRoll) return;
    $('mb-die-1').dataset.v = String(state.lastRoll.d1);
    $('mb-die-2').dataset.v = String(state.lastRoll.d2);
    const box = $('mb-total');
    box.textContent = 'Tổng: ' + state.lastRoll.sum;
    // .mb-dbl là badge đã tạo sẵn ở increment 1 nhưng chưa ai dùng — trước đây
    // "đôi" chỉ là chữ thường lẫn trong dòng, không ai nhận ra là biến cố
    if (state.lastRoll.isDouble) box.appendChild(R.el('span', 'mb-dbl', 'Đôi'));
  }

  /* Lắc xúc xắc rồi mới chốt số. Quay mặt NGẪU NHIÊN trong lúc lắc (không phải
     đứng ở số cũ) để cú tung có sức nặng — kết quả thật đã do Engine quyết,
     đây thuần trình diễn. */
  function shakeDice(fast, onDone) {
    const d1 = $('mb-die-1'), d2 = $('mb-die-2');
    if (fast) { onDone(); return; }
    d1.classList.add('is-rolling');
    d2.classList.add('is-rolling');
    const spin = setInterval(() => {
      d1.dataset.v = String(1 + Math.floor(Math.random() * 6));
      d2.dataset.v = String(1 + Math.floor(Math.random() * 6));
    }, 70);
    setTimeout(() => {
      clearInterval(spin);
      d1.classList.remove('is-rolling');
      d2.classList.remove('is-rolling');
      onDone();
    }, 380);
  }

  function stepAnimate(playerIdx, fromPos, steps, onDone) {
    let cur = fromPos;
    let left = steps;
    const stepMs = fastBots && state.players[playerIdx].kind === 'bot' ? 30 : 100;
    const tokEl = document.getElementById('mb-tok-' + playerIdx);
    (function tick() {
      if (left <= 0) { onDone(); return; }
      cur = (cur + 1) % 40;
      left--;
      R.moveTokenStep(boardEl, playerIdx, cur);
      // nảy 1 nhịp mỗi ô — luân phiên 2 class để animation replay được
      if (tokEl) {
        hopFlip = !hopFlip;
        tokEl.classList.remove('is-hop-a', 'is-hop-b');
        tokEl.classList.add(hopFlip ? 'is-hop-a' : 'is-hop-b');
      }
      setTimeout(tick, stepMs);
    })();
  }

  function doRoll() {
    if (rolling || !state || state.over || state.phase !== 'idle') return;
    const p = state.players[state.turn];
    if (p.bankrupt) return;
    rolling = true;
    const oldPos = p.pos;
    const wasJail = p.jail;
    const events = E.roll(state);
    if (!events.length) { rolling = false; return; }

    const finish = () => {
      R.paintAllTiles(boardEl, state);
      R.layoutTokens(boardEl, state);   // snap về p.pos thật (thẻ/tù có thể đã dịch)
      setHere(state.players[state.turn].pos);
      renderRail();
      renderCentre();
      renderActions();
      rolling = false;
      maybeBotTurn();
    };

    const fast = fastBots && p.kind === 'bot';
    shakeDice(fast, () => {
      updateDiceUI();
      pushTicks(events);
      if (wasJail && p.jail) { finish(); return; }   // còn trong tù, không di chuyển
      // Ô ĐÍCH CỦA XÚC XẮC, không phải p.pos: p.pos lúc này đã là vị trí CUỐI
      // (thẻ Cơ Hội/Vận Mệnh có thể đã dịch tiếp). Quân đi bộ tới đích xúc xắc
      // rồi finish() mới snap sang vị trí cuối — chỉ nước-đi-do-xúc-xắc mới
      // đáng "đi bộ".
      const diceDest = (oldPos + state.lastRoll.sum) % 40;
      flashTarget(diceDest);
      stepAnimate(p.idx, oldPos, state.lastRoll.sum, finish);
    });
  }

  /* ---------- bot: quyết định ĐƠN GIẢN (placeholder cho increment 3) ---------- */
  function maybeBotTurn() {
    if (!state || state.over) return;
    const p = state.players[state.turn];
    if (p.kind !== 'bot' || p.bankrupt) return;
    setTimeout(botAct, fastBots ? 150 : 700);
  }
  function botAct() {
    if (!state || state.over) return;
    const p = state.players[state.turn];
    if (p.kind !== 'bot' || p.bankrupt) return;

    if (state.phase === 'awaiting' && state.pending) {
      if (state.pending.kind === 'buy') {
        const t = CTP_BOARD[state.pending.tile];
        // đệm an toàn thô — increment 3 sẽ dùng CTP_LAND_FREQ để tính ROI thật
        const accept = p.cash - t.gia >= 150;
        pushTicks(E.buy(state, accept));
      } else {
        pushTicks(E.settlePending(state));
      }
      afterEngineChange();
      return;
    }
    if (p.jail) {
      if (p.jailCards > 0) { pushTicks(E.useJailCard(state)); afterEngineChange(); return; }
      if (p.cash >= CTP_DEFAULTS.jailFine * 3) { pushTicks(E.payJailFine(state)); afterEngineChange(); return; }
      // không đủ dư để trả phạt thoải mái — thử ăn may tung đôi thay vì đứng im
      doRoll();
      return;
    }
    doRoll();
  }

  /* ---------- khởi động ván ---------- */
  function startGame() {
    const seats = cfg.seats.filter(Boolean);
    if (seats.length < 2) return;
    seats.forEach((s, i) => { if (!String(s.name).trim()) s.name = 'Người ' + (i + 1); });
    state = E.newGame(cfg);
    prevCash = [];                  // ván mới: đừng flash tiền ở lần render đầu
    // đừng để dòng ticker của ván trước chạy tiếp sang ván mới
    if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
    tickQueue = [];
    showScreen('play');
    R.buildBoard(boardEl);
    R.buildTokens(boardEl, state);
    renderRail();
    // chờ 1 frame cho layout xong rồi mới đo toạ độ ô
    requestAnimationFrame(() => {
      R.fitBoard(boardEl);
      R.paintAllTiles(boardEl, state);
      R.layoutTokens(boardEl, state);
      setHere(state.players[state.turn].pos);
      renderCentre();
      renderActions();
    });
    pushTicks([{ msg: '🎲 Ván mới — ' + seats.map(s => s.name).join(' · ') }]);
    maybeBotTurn();
  }

  /* Đo lại khi bàn đổi kích thước: iOS co giãn URL bar, quay ngang máy… */
  new ResizeObserver(() => {
    if (!$('mb-screen-play').classList.contains('is-on')) return;
    R.fitBoard(boardEl);
    if (state) R.layoutTokens(boardEl, state);
  }).observe(boardEl);

  boardEl.addEventListener('click', (e) => {
    const t = e.target.closest('.mb-tile');
    if (!t) return;
    boardEl.querySelectorAll('.mb-tile.is-focus').forEach(x => x.classList.remove('is-focus'));
    t.classList.add('is-focus');
    sheetTile(Number(t.dataset.i));
  });

  $('mb-sheet-back').addEventListener('click', (e) => {
    if (e.target === $('mb-sheet-back')) closeSheet();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  $('mb-start').addEventListener('click', startGame);
  $('mb-menu').addEventListener('click', sheetList);
  $('mb-die-1').addEventListener('click', doRoll);
  $('mb-die-2').addEventListener('click', doRoll);
  $('mb-speed').addEventListener('click', () => {
    fastBots = !fastBots;
    $('mb-speed').classList.toggle('is-on', fastBots);
  });

  renderSeats();
  bindMode();

  /* API để kiểm thử ngoài UI (console) */
  CTP.startGame = startGame;
  CTP.cfg = cfg;
  CTP.getState = () => state;
})();
