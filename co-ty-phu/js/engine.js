/* ============================================================
   engine.js — Increment 2: luật chơi thuần state, KHÔNG chạm DOM.
   Chiều đi một hướng: action → Engine.apply → state → Render (xem render.js).

   Mọi hàm public nhận `state` (mutate tại chỗ) và trả về `events` — mảng
   {msg} theo thứ tự thời gian để app.js đẩy vào ticker. Quyết định cần
   người chơi (mua/trả/xây) dừng ở state.pending; app.js render nút bấm theo
   đó rồi gọi lại hàm tương ứng (buy/settlePending/build).

   CHƯA làm (để increment sau nếu cần): thế chấp (mortgage), đấu giá khi từ
   chối mua, giao dịch/trade giữa người chơi, giới hạn nhà trong "ngân hàng".
   ============================================================ */

(() => {
  'use strict';

  const W = window;
  const CTP = (W.CTP = W.CTP || {});

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- khởi tạo ván ---------- */
  function newGame(cfg) {
    const seats = cfg.seats.filter(Boolean);
    const players = seats.map((s, i) => ({
      idx: i, name: s.name, kind: s.kind, tier: s.tier,
      cash: CTP_DEFAULTS.startCash, pos: 0,
      jail: false, jailTurns: 0, jailCards: 0,
      bankrupt: false, doublesCount: 0,
    }));
    const tiles = CTP_BOARD.map((t) =>
      (t.kind === 'dat' || t.kind === 'sanbay' || t.kind === 'tienich')
        ? { owner: null, level: 0 } : null);
    return {
      players, tiles,
      turn: 0, round: 1,
      mode: cfg.mode, roundCap: CTP_DEFAULTS.roundCap,
      decks: {
        cohoi: shuffle(CTP_CARDS.cohoi.map((_, i) => i)),
        vanmenh: shuffle(CTP_CARDS.vanmenh.map((_, i) => i)),
      },
      deckPos: { cohoi: 0, vanmenh: 0 },
      phase: 'idle',       // 'idle' | 'awaiting' | 'over'
      pending: null,       // {kind:'buy', tile} | {kind:'pay', amount, to, reason}
      lastRoll: null,
      over: false, winner: null,
    };
  }

  /* ---------- tiện ích luật ---------- */
  function drawCard(state, deck, events) {
    if (state.deckPos[deck] >= state.decks[deck].length) {
      state.decks[deck] = shuffle(state.decks[deck]);
      state.deckPos[deck] = 0;
    }
    const idx = state.decks[deck][state.deckPos[deck]++];
    const card = CTP_CARDS[deck][idx];
    events.push({ msg: (deck === 'cohoi' ? '🃏 Cơ Hội — ' : '🔮 Vận Mệnh — ') + card.text });
    applyCard(state, card, events);
  }

  function applyCard(state, card, events) {
    const p = state.players[state.turn];
    switch (card.t) {
      case 'cash':
        if (card.amount >= 0) p.cash += card.amount;
        else { state.pending = { kind: 'pay', amount: -card.amount, to: null, reason: 'thẻ phạt' }; state.phase = 'awaiting'; }
        return;
      case 'move':
        p.pos = card.to;
        if (card.go) { p.cash += CTP_DEFAULTS.goSalary; events.push({ msg: p.name + ' nhận ' + CTP_DEFAULTS.goSalary + ' triệu lương.' }); }
        resolveLanding(state, events);
        return;
      case 'moverel':
        p.pos = (p.pos + card.delta + 40) % 40;
        resolveLanding(state, events);
        return;
      case 'jailfree':
        p.jailCards++;
        return;
      case 'gotojail':
        sendToJail(state, p, events);
        return;
      case 'perplayer': {
        const others = state.players.filter((x) => x.idx !== p.idx && !x.bankrupt);
        others.forEach((o) => { p.cash += card.amount; o.cash -= card.amount; });
        return;
      }
    }
  }

  function sendToJail(state, p, events) {
    p.pos = CTP_JAIL; p.jail = true; p.jailTurns = 0; p.doublesCount = 0;
    events.push({ msg: p.name + ' bị bắt vào Trạm Giam!' });
  }

  function computeRent(state, tileIdx, diceSum) {
    const t = CTP_BOARD[tileIdx];
    const st = state.tiles[tileIdx];
    if (t.kind === 'dat') {
      if (st.level > 0) return t.rent[st.level];
      const group = CTP_GROUP_TILES[t.nhom];
      const ownsAll = group.every((i) => state.tiles[i].owner === st.owner);
      return ownsAll ? t.rent[0] * 2 : t.rent[0];
    }
    if (t.kind === 'sanbay') {
      const n = CTP_SANBAY_TILES.filter((i) => state.tiles[i].owner === st.owner).length;
      return 25 * Math.pow(2, n - 1);
    }
    if (t.kind === 'tienich') {
      const n = CTP_TIENICH_TILES.filter((i) => state.tiles[i].owner === st.owner).length;
      return diceSum * (n >= 2 ? 10 : 4);
    }
    return 0;
  }

  function resolveLanding(state, events) {
    const p = state.players[state.turn];
    const t = CTP_BOARD[p.pos];
    if (t.i === CTP_GOTO_JAIL) { sendToJail(state, p, events); return; }
    if (t.kind === 'dat' || t.kind === 'sanbay' || t.kind === 'tienich') {
      const st = state.tiles[p.pos];
      if (st.owner == null) {
        state.pending = { kind: 'buy', tile: p.pos };
        state.phase = 'awaiting';
        events.push({ msg: p.name + ' tới ' + t.ten + ' — chưa ai sở hữu.' });
      } else if (st.owner === p.idx) {
        events.push({ msg: p.name + ' về đất của mình: ' + t.ten + '.' });
      } else {
        const sum = state.lastRoll ? state.lastRoll.sum : 7;
        const amt = computeRent(state, p.pos, sum);
        state.pending = { kind: 'pay', amount: amt, to: st.owner, reason: 'thuê ' + t.ten };
        state.phase = 'awaiting';
        events.push({ msg: p.name + ' phải trả ' + amt + ' triệu thuê cho ' + state.players[st.owner].name + '.' });
      }
    } else if (t.kind === 'thue') {
      state.pending = { kind: 'pay', amount: t.tien, to: null, reason: t.ten };
      state.phase = 'awaiting';
      events.push({ msg: p.name + ' phải nộp ' + t.tien + ' triệu ' + t.ten + '.' });
    } else if (t.kind === 'cohoi' || t.kind === 'vanmenh') {
      drawCard(state, t.kind, events);
    } else {
      events.push({ msg: p.name + ' dừng ở ' + t.ten + '.' });
    }
  }

  /* ---------- xử lý bội chi / phá sản ---------- */
  function settlePending(state) {
    const events = [];
    const p = state.players[state.turn];
    const pend = state.pending;
    if (!pend || pend.kind !== 'pay') return events;
    if (p.cash < pend.amount) {
      p.bankrupt = true;
      state.tiles.forEach((ts) => {
        if (ts && ts.owner === p.idx) { ts.owner = pend.to != null ? pend.to : null; ts.level = 0; }
      });
      if (pend.to != null) state.players[pend.to].cash += p.cash;
      p.cash = 0;
      events.push({
        msg: p.name + ' phá sản!' + (pend.to != null
          ? ' Toàn bộ tài sản chuyển cho ' + state.players[pend.to].name + '.'
          : ' Toàn bộ tài sản trả lại ngân hàng.'),
      });
    } else {
      p.cash -= pend.amount;
      if (pend.to != null) state.players[pend.to].cash += pend.amount;
      events.push({ msg: p.name + ' đã trả ' + pend.amount + ' triệu (' + pend.reason + ').' });
    }
    state.pending = null;
    afterAction(state, events);
    return events;
  }

  function buy(state, accept) {
    const events = [];
    const p = state.players[state.turn];
    const pend = state.pending;
    if (!pend || pend.kind !== 'buy') return events;
    const t = CTP_BOARD[pend.tile];
    if (accept && p.cash >= t.gia) {
      p.cash -= t.gia;
      state.tiles[pend.tile].owner = p.idx;
      events.push({ msg: p.name + ' mua ' + t.ten + ' với giá ' + t.gia + ' triệu.' });
    } else {
      events.push({ msg: p.name + ' bỏ qua ' + t.ten + '.' });
    }
    state.pending = null;
    afterAction(state, events);
    return events;
  }

  /* ---------- xây nhà ---------- */
  function canBuild(state, tileIdx) {
    const t = CTP_BOARD[tileIdx];
    if (!t || t.kind !== 'dat') return false;
    const st = state.tiles[tileIdx];
    const p = state.players[state.turn];
    if (state.phase !== 'idle' || !st || st.owner !== p.idx || st.level >= 5) return false;
    const group = CTP_GROUP_TILES[t.nhom];
    if (!group.every((i) => state.tiles[i].owner === p.idx)) return false;
    const minLevel = Math.min(...group.map((i) => state.tiles[i].level));
    if (st.level > minLevel) return false;
    return p.cash >= t.xay;
  }

  function build(state, tileIdx) {
    const events = [];
    if (!canBuild(state, tileIdx)) return events;
    const t = CTP_BOARD[tileIdx];
    const st = state.tiles[tileIdx];
    const p = state.players[state.turn];
    p.cash -= t.xay;
    st.level++;
    events.push({ msg: p.name + ' xây ' + (st.level === 5 ? 'khách sạn' : 'nhà thứ ' + st.level) + ' ở ' + t.ten + '.' });
    return events;
  }

  function buildableTiles(state) {
    if (state.phase !== 'idle') return [];
    return CTP_BOARD.filter((t) => t.kind === 'dat' && canBuild(state, t.i)).map((t) => t.i);
  }

  /* ---------- tù ---------- */
  function payJailFine(state) {
    const events = [];
    const p = state.players[state.turn];
    if (!p.jail || state.phase !== 'idle' || p.cash < CTP_DEFAULTS.jailFine) return events;
    p.cash -= CTP_DEFAULTS.jailFine; p.jail = false; p.jailTurns = 0;
    events.push({ msg: p.name + ' nộp ' + CTP_DEFAULTS.jailFine + ' triệu để ra tù.' });
    return events;
  }

  function useJailCard(state) {
    const events = [];
    const p = state.players[state.turn];
    if (!p.jail || state.phase !== 'idle' || p.jailCards <= 0) return events;
    p.jailCards--; p.jail = false; p.jailTurns = 0;
    events.push({ msg: p.name + ' dùng thẻ Miễn Vào Tù.' });
    return events;
  }

  /* ---------- tung xúc xắc ---------- */
  function roll(state) {
    const events = [];
    const p = state.players[state.turn];
    if (state.over || state.phase !== 'idle' || p.bankrupt) return events;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const sum = d1 + d2;
    const isDouble = d1 === d2;
    state.lastRoll = { d1, d2, sum, isDouble };

    if (p.jail) {
      if (isDouble) {
        p.jail = false; p.jailTurns = 0;
        events.push({ msg: p.name + ' tung đôi ' + d1 + '-' + d2 + ', ra tù!' });
        movePlayer(state, p, sum, events);
      } else {
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          if (p.cash < CTP_DEFAULTS.jailFine) {
            p.bankrupt = true;
            state.tiles.forEach((ts) => { if (ts && ts.owner === p.idx) { ts.owner = null; ts.level = 0; } });
            p.cash = 0;
            events.push({ msg: p.name + ' không đủ tiền nộp phạt ra tù — phá sản! Tài sản trả lại ngân hàng.' });
            afterAction(state, events, true);
            return events;
          }
          p.cash -= CTP_DEFAULTS.jailFine; p.jail = false; p.jailTurns = 0;
          events.push({ msg: p.name + ' hết hạn tù, nộp phạt ' + CTP_DEFAULTS.jailFine + ' triệu và ra tù.' });
          movePlayer(state, p, sum, events);
        } else {
          events.push({ msg: p.name + ' tung ' + d1 + '-' + d2 + ', chưa ra tù (lượt ' + p.jailTurns + '/3).' });
          afterAction(state, events, true);
        }
      }
    } else {
      p.doublesCount = isDouble ? p.doublesCount + 1 : 0;
      if (p.doublesCount === 3) {
        p.doublesCount = 0;
        events.push({ msg: p.name + ' tung đôi 3 lần liên tiếp — vào tù!' });
        sendToJail(state, p, events);
        afterAction(state, events, true);
      } else {
        events.push({ msg: p.name + ' tung ' + d1 + '-' + d2 + (isDouble ? ' (đôi!)' : '') + '.' });
        movePlayer(state, p, sum, events);
      }
    }
    return events;
  }

  function movePlayer(state, p, steps, events) {
    const passedGo = p.pos + steps >= 40;
    p.pos = (p.pos + steps) % 40;
    if (passedGo) {
      p.cash += CTP_DEFAULTS.goSalary;
      events.push({ msg: p.name + ' qua Xuất Phát, nhận ' + CTP_DEFAULTS.goSalary + ' triệu.' });
    }
    resolveLanding(state, events);
    if (state.phase !== 'awaiting') afterAction(state, events);
  }

  /* forceEnd: dùng khi lượt phải kết thúc dù không có pending (giữ tù, vào tù
     vì đôi 3 lần) — bỏ qua kiểm tra doublesCount vì nó không áp dụng nữa. */
  function afterAction(state, events, forceEnd) {
    const p = state.players[state.turn];
    if (!forceEnd && !p.bankrupt && !p.jail && p.doublesCount > 0) {
      state.phase = 'idle'; // cùng người chơi được tung tiếp
      return;
    }
    advanceTurn(state, events);
  }

  function advanceTurn(state, events) {
    const n = state.players.length;
    const activeIdx = state.players.map((p, i) => i).filter((i) => !state.players[i].bankrupt);
    if (activeIdx.length <= 1) { finishGame(state, events); return; }
    let next = state.turn;
    do { next = (next + 1) % n; } while (state.players[next].bankrupt);
    if (next === activeIdx[0]) state.round++;
    state.turn = next;
    state.phase = 'idle';
    state.pending = null;
    state.players[next].doublesCount = 0;
    if (state.mode === 'nhanh' && state.round > state.roundCap) { finishGame(state, events); return; }
  }

  function netWorth(state, p) {
    let v = p.cash;
    state.tiles.forEach((st, i) => {
      if (st && st.owner === p.idx) {
        const t = CTP_BOARD[i];
        v += t.gia || 0;
        if (st.level > 0) v += st.level * (t.xay || 0);
      }
    });
    return v;
  }

  function finishGame(state, events) {
    state.over = true;
    state.phase = 'over';
    const active = state.players.filter((p) => !p.bankrupt);
    const winner = active.reduce((best, p) => (netWorth(state, p) > netWorth(state, best) ? p : best), active[0]);
    state.winner = winner.idx;
    events.push({ msg: '🏆 Ván kết thúc — ' + winner.name + ' chiến thắng!' });
  }

  CTP.Engine = {
    newGame, roll, buy, settlePending, build, canBuild, buildableTiles,
    payJailFine, useJailCard, computeRent, netWorth,
  };
})();
