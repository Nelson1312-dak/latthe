/**
 * js/advisory.js — tư vấn đầu tư.
 *   Môi giới (màn "Tư vấn"): hiệu suất + rủi ro danh mục từng khách, khẩu vị rủi ro, gán danh mục mẫu,
 *     đề xuất tái phân bổ (tạo phiếu lệnh cho khách xác nhận), AI local nhận xét; quản lý danh mục mẫu.
 *   Khách (mục trong "Tài khoản của tôi"): hiệu suất, cơ cấu, độ lệch so với danh mục mẫu, bảng câu hỏi khẩu vị rủi ro.
 * Chạy trong IIFE để không đụng biến của các file khác.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m) => (typeof toast === 'function' ? toast(m) : console.log(m));
  const num = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
  const f1 = (v) => (num(v) == null ? '–' : (+v).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const pct = (v, sign = true) => (num(v) == null ? '–' : Math.abs(v) < 0.05 ? '0,0%' : (sign && v > 0 ? '+' : '') + f1(v) + '%');
  const cls = (v) => (num(v) == null || Math.abs(v) < 0.05 ? '' : v > 0 ? 'up' : 'down');
  const vnd = (v) => (num(v) == null ? '–' : Math.round(+v).toLocaleString('vi-VN'));
  const big = (v) => { const n = num(v); if (n == null) return '–'; const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ' : a >= 1e6 ? (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr' : vnd(n); };
  const k2 = (v) => (num(v) == null ? '–' : (v / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const day = (s) => (s ? s.split('-').reverse().join('/') : '');
  const RISK = { conservative: 'Thận trọng', balanced: 'Cân bằng', growth: 'Tăng trưởng', aggressive: 'Mạo hiểm' };
  const WIN = ['1M', '3M', '6M', 'YTD', '1Y'];
  const WIN_LABEL = { '1M': '1 tháng', '3M': '3 tháng', '6M': '6 tháng', YTD: 'Từ đầu năm', '1Y': '1 năm' };

  async function api(url, opts = {}) {
    const r = await fetch(url, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let j = null; try { j = await r.json(); } catch { /* rỗng */ }
    if (!r.ok) throw Object.assign(new Error(j?.error || `Lỗi ${r.status}`), { status: r.status, code: j?.code });
    return j;
  }

  /* ================= Dùng chung: biểu đồ, bảng ================= */
  /** Biểu đồ đường SVG: danh mục (đậm) so với VN-Index (mảnh, nét đứt). points = [[ngày, danh mục, vnindex], ...] chuẩn hóa 100. */
  function chartSvg(points, label = 'Danh mục') {
    if (!points?.length) return '<div class="empty">Chưa đủ dữ liệu để vẽ.</div>';
    const W = 640, H = 190, P = { l: 40, r: 10, t: 12, b: 22 };
    const vals = points.flatMap((p) => [p[1], p[2]]);
    let lo = Math.min(...vals, 100), hi = Math.max(...vals, 100);
    const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const x = (i) => P.l + (i / Math.max(1, points.length - 1)) * (W - P.l - P.r);
    const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const line = (k) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
    const ticks = [lo + pad, 100, hi - pad].filter((v, i, a) => a.findIndex((u) => Math.abs(u - v) < (hi - lo) * 0.12) === i);
    const last = points[points.length - 1];
    return `<figure class="av-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} so với VN-Index, từ ${day(points[0][0])} đến ${day(last[0])}">
      ${ticks.map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="g${Math.abs(v - 100) < 1e-9 ? ' base' : ''}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${(v - 100 >= 0 ? '+' : '') + f1(v - 100)}%</text>`).join('')}
      <path d="${line(2)}" class="bench"/><path d="${line(1)}" class="port"/>
      <text x="${P.l}" y="${H - 5}">${day(points[0][0])}</text><text x="${W - P.r}" y="${H - 5}" text-anchor="end">${day(last[0])}</text>
    </svg><figcaption><span class="lg port"></span>${esc(label)} <b class="${cls(last[1] - 100)}">${pct(last[1] - 100)}</b><span class="lg bench"></span>VN-Index <b class="${cls(last[2] - 100)}">${pct(last[2] - 100)}</b></figcaption></figure>`;
  }

  function winTable(stats) {
    if (!stats) return '';
    const ks = WIN.filter((k) => stats.windows?.[k]);
    if (!ks.length) return '';
    return `<table class="av-win"><thead><tr><th></th>${ks.map((k) => `<th class="r">${WIN_LABEL[k]}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Danh mục</td>${ks.map((k) => `<td class="r ${cls(stats.windows[k].ret)}">${pct(stats.windows[k].ret)}</td>`).join('')}</tr>
      <tr><td>VN-Index</td>${ks.map((k) => `<td class="r ${cls(stats.windows[k].bench)}">${pct(stats.windows[k].bench)}</td>`).join('')}</tr>
      <tr><td>Chênh lệch</td>${ks.map((k) => { const d = stats.windows[k].ret - stats.windows[k].bench; return `<td class="r ${cls(d)}">${pct(d)}</td>`; }).join('')}</tr></tbody></table>`;
  }

  function riskStats(stats) {
    if (!stats) return '';
    return `<div class="av-kv"><div><span>Biến động (năm hóa)</span><b>${pct(stats.volatility, false)}</b></div>
      <div><span>Sụt giảm tối đa</span><b class="${cls(stats.maxDrawdown)}">${pct(stats.maxDrawdown)}</b></div>
      <div><span>Beta so với VN-Index</span><b>${stats.beta == null ? '–' : stats.beta.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</b></div>
      <div><span>Số phiên</span><b>${stats.sessions}</b></div></div>`;
  }

  /** Chọn chuỗi hiệu suất để hiện: thực tế (nếu có) > giữ nguyên danh mục hiện tại > danh mục mẫu. */
  function perfBlock(perf, which, scope) {
    const opts = [['realized', 'Thực tế', perf.realized], ['holding', 'Giữ nguyên danh mục hiện tại', perf.holding], ['model', 'Danh mục mẫu', perf.model]].filter((o) => o[2]);
    if (!opts.length) return '<div class="empty"><b>Chưa có dữ liệu hiệu suất</b>Tài khoản chưa có cổ phiếu và chưa có ảnh chụp danh mục.</div>';
    const cur = opts.find((o) => o[0] === which) || opts[0];
    const p = cur[2];
    return `<div class="av-tabs" role="tablist">${opts.map((o) => `<button role="tab" aria-selected="${o[0] === cur[0]}" data-perf="${o[0]}" data-scope="${scope}">${o[1]}</button>`).join('')}</div>
      ${chartSvg(p.chart, cur[1])}
      <p class="av-note">${esc(p.note || '')}${cur[0] === 'realized' ? ` Đã có ${p.snapshots} ảnh chụp, từ ${day(p.stats.from)}.` : ''}${perf.snapshots < 2 && cur[0] !== 'realized' ? ' Hiệu suất thực tế sẽ có sau khi hệ thống chụp danh mục cuối ngày được 2 phiên.' : ''}</p>
      ${winTable(p.stats)}${riskStats(p.stats)}
      ${Object.keys(perf.adjustments || {}).length ? `<p class="av-note">Đã điều chỉnh giá lịch sử cho sự kiện quyền của: ${Object.keys(perf.adjustments).map(esc).join(', ')}.</p>` : ''}`;
  }

  function flagsHtml(flags) {
    if (!flags?.length) return '<div class="av-ok">Không có cảnh báo rủi ro nào nổi bật.</div>';
    return `<ul class="av-flags">${flags.map((f) => `<li class="${f.level}">${esc(f.text)}</li>`).join('')}</ul>`;
  }

  /** Bảng cơ cấu, kèm tỷ trọng mục tiêu nếu đã gán danh mục mẫu. */
  function compTable(a) {
    const target = a.model?.weights || {};
    const rb = new Map((a.rebalance?.rows || []).map((r) => [r.symbol, r]));
    const rows = [...a.composition.rows];
    for (const s of Object.keys(target)) if (!rows.some((r) => r.symbol === s)) rows.push({ symbol: s, qty: 0, value: 0, weight: 0 });
    if (!rows.length) return '<div class="empty">Tài khoản chưa có cổ phiếu.</div>';
    const hasT = !!a.model;
    return `<div class="av-scroll"><table><thead><tr><th>Mã</th><th class="r">KL</th><th class="r">Giá vốn</th><th class="r">Giá</th><th class="r">Giá trị</th><th class="r">Lãi/lỗ</th><th class="r">Tỷ trọng</th>${hasT ? '<th class="r">Mục tiêu</th><th class="r">Lệch</th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => {
        const t = target[r.symbol] ?? 0, d = (r.weight || 0) - t, drift = a.model?.driftPct ?? 5;
        return `<tr><td><b>${esc(r.symbol)}</b>${r.sector && r.sector !== 'Khác' ? `<small class="av-sec">${esc(r.sector)}</small>` : ''}</td><td class="r">${r.qty ? vnd(r.qty) : '–'}</td><td class="r">${k2(r.cost)}</td><td class="r">${k2(r.price ?? rb.get(r.symbol)?.price)}</td>
          <td class="r">${big(r.value)}</td><td class="r ${cls(r.pnlPct)}">${pct(r.pnlPct)}</td><td class="r"><span class="av-bar"><i style="width:${Math.min(100, r.weight || 0)}%"></i></span>${f1(r.weight || 0)}%</td>
          ${hasT ? `<td class="r">${t ? f1(t) + '%' : '–'}</td><td class="r ${Math.abs(d) >= drift ? 'warn' : ''}">${pct(d)}</td>` : ''}</tr>`;
      }).join('')}
      <tr class="av-cash"><td>Tiền mặt</td><td></td><td></td><td></td><td class="r">${big(a.account.cash)}</td><td></td><td class="r">${f1(a.composition.cashWeight)}%</td>${hasT ? `<td class="r">${f1(a.model.cashPct)}%</td><td class="r">${pct((a.composition.cashWeight || 0) - a.model.cashPct)}</td>` : ''}</tr>
      ${a.account.debt ? `<tr class="av-cash"><td>Dư nợ ký quỹ</td><td></td><td></td><td></td><td class="r down">-${big(a.account.debt)}</td><td></td><td class="r">${f1(a.composition.debtWeight)}%</td>${hasT ? '<td></td><td></td>' : ''}</tr>` : ''}
    </tbody></table></div>
    ${a.composition.sectors.length ? `<div class="av-sectors">${a.composition.sectors.slice(0, 8).map((s) => `<div><span>${esc(s.sector)}</span><span class="av-bar"><i style="width:${Math.min(100, s.weight)}%"></i></span><b>${f1(s.weight)}%</b></div>`).join('')}</div>` : ''}`;
  }

  /* ================= Môi giới: màn Tư vấn ================= */
  const A = { broker: false, tab: 'clients', clients: [], q: '', sel: null, data: null, loading: false, perf: 'realized', models: [], edit: null, modelPerf: {}, ai: {}, worker: null, creating: false };

  function shell() {
    $('adv-body').innerHTML = `
      <div class="av-top"><nav class="subnav" aria-label="Khách hàng">
        <button type="button" data-subnav="desk">Lệnh &amp; tài sản</button>
        <button type="button" data-subnav="clients" ${A.tab === 'clients' ? 'aria-current="page"' : ''}>Tư vấn &amp; danh mục</button>
        <button type="button" data-subnav="models" ${A.tab === 'models' ? 'aria-current="page"' : ''}>Danh mục mẫu</button></nav>
        <span class="av-ai-status" id="av-ai-status"></span></div>
      <div class="av-grid" id="av-grid"></div>`;
    renderAiStatus();
    renderTab();
  }
  function renderAiStatus() {
    const el = $('av-ai-status'); if (!el) return;
    const w = A.worker;
    el.innerHTML = !w ? '' : w.alive && w.ready ? `<span class="dot"></span>AI local sẵn sàng (${esc(w.model)})`
      : w.alive ? `<span class="dot off"></span>AI local: chưa có model ${esc(w.model || '')}` : '<span class="dot off"></span>AI local đang tắt (máy chủ nhà)';
  }
  function renderTab() {
    const g = $('av-grid'); if (!g) return;
    if (A.tab === 'models') { g.className = 'av-grid models'; g.innerHTML = '<section class="av-models" id="av-models"></section><section class="av-editor" id="av-editor"></section>'; renderModels(); renderEditor(); return; }
    g.className = 'av-grid';
    g.innerHTML = `<section class="av-list"><div class="desk-search"><input class="inp" id="av-q" placeholder="Tìm khách" aria-label="Tìm khách hàng" autocomplete="off" value="${esc(A.q)}"></div><div class="desk-clients" id="av-clients"></div></section>
      <section class="av-main" id="av-main" aria-live="polite"></section>`;
    renderClients(); renderMain();
  }
  function renderClients() {
    const box = $('av-clients'); if (!box) return;
    const q = A.q.trim().toLowerCase();
    const list = A.clients.filter((c) => !q || [c.name, c.accountNo, c.custodyCode].some((x) => String(x || '').toLowerCase().includes(q)));
    box.innerHTML = list.length ? list.map((c) => `<button class="cl" data-aclient="${esc(c.accountNo)}" aria-current="${A.sel === c.accountNo}">
        <span class="cl-name">${esc(c.name || c.accountNo)}</span><span class="cl-nav">${big(c.nav.total)}</span>
        <span class="cl-sub">${esc(c.accountNo)}</span><span>${c.canTrade ? '<span class="role trade">Giao dịch</span>' : '<span class="role view">Theo dõi</span>'}</span></button>`).join('')
      : `<div class="empty">${A.clients.length ? 'Không có khách khớp tìm kiếm.' : 'Chưa có khách care-by nào.'}</div>`;
  }

  function renderMain() {
    const box = $('av-main'); if (!box) return;
    if (!A.sel) { box.innerHTML = '<div class="empty"><b>Chọn một khách hàng</b>Hiệu suất, rủi ro, độ lệch so với danh mục mẫu và đề xuất tái phân bổ sẽ hiện ở đây.</div>'; return; }
    if (A.loading) { box.innerHTML = '<div class="empty">Đang tính hiệu suất và rủi ro…</div>'; return; }
    const a = A.data;
    if (!a || a.error) { box.innerHTML = `<div class="empty"><b>Không tải được dữ liệu</b>${esc(a?.error || '')}</div>`; return; }
    const c = a.client, s = a.performance.realized?.stats || a.performance.holding?.stats;
    const models = A.models.filter((m) => !m.archived || m.id === a.model?.id);
    box.innerHTML = `
      <div class="dt-head"><div><h1>${esc(c.name || c.accountNo)}</h1><p>${esc(c.accountNo)} · ${c.canTrade ? 'Ủy quyền giao dịch' : 'Chỉ theo dõi'}</p></div>
        <button class="ghost" data-areload>Tính lại</button></div>
      <div class="av-kv wide"><div><span>Tài sản ròng</span><b>${big(a.account.nav)}</b></div><div><span>Tiền mặt</span><b>${f1(a.composition.cashWeight)}%</b></div>
        <div><span>Dư nợ</span><b>${f1(a.composition.debtWeight)}%</b></div><div><span>Số mã hiệu dụng</span><b>${f1(a.composition.effectiveN)}</b></div>
        ${['1M', '3M', 'YTD'].map((k) => s?.windows?.[k] ? `<div><span>${WIN_LABEL[k]} / VN-Index</span><b class="${cls(s.windows[k].ret)}">${pct(s.windows[k].ret)}</b> <small class="${cls(s.windows[k].bench)}">${pct(s.windows[k].bench)}</small></div>` : '').join('')}</div>
      ${(a.account.warnings || []).map((w) => `<div class="msg warn av-m">${esc(w)}</div>`).join('')}

      <div class="dt-sec">Khẩu vị rủi ro và danh mục mẫu</div>
      <form class="av-profile" id="av-profile">
        <label>Khẩu vị rủi ro<select class="inp" name="risk"><option value="">Chưa đánh giá</option>${Object.entries(RISK).map(([k, v]) => `<option value="${k}" ${a.profile?.riskLevel === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <small>${a.profile?.answeredBy === 'client' ? `Khách tự trả lời ngày ${new Date(a.profile.answeredAt).toLocaleDateString('vi-VN')} (${a.profile.riskScore} điểm)` : a.profile?.answeredBy === 'broker' ? 'Môi giới đánh giá' : 'Khách có thể tự trả lời bảng câu hỏi trong cổng khách hàng.'}</small></label>
        <label>Danh mục mẫu<select class="inp" name="model"><option value="">Chưa gán</option>${models.map((m) => `<option value="${m.id}" ${a.model?.id === m.id ? 'selected' : ''}>${esc(m.name)} (${esc(RISK[m.riskLevel])})</option>`).join('')}</select>
          <small>${models.length ? '' : 'Chưa có danh mục mẫu nào: tạo ở tab "Danh mục mẫu".'}</small></label>
        <label class="full">Ghi chú về khách (chỉ môi giới thấy)<textarea class="inp" name="note" rows="2" maxlength="2000">${esc(a.profile?.note || '')}</textarea></label>
        <div class="full row-end"><button class="ghost" type="submit">Lưu</button></div>
      </form>
      ${a.suitability ? `<div class="msg ${a.suitability.ok ? 'ok' : 'warn'} av-m">${esc(a.suitability.text)}</div>` : ''}

      <div class="dt-sec">Cảnh báo rủi ro</div>${flagsHtml(a.composition.flags)}
      <div class="dt-sec">Hiệu suất</div><div class="av-pad">${perfBlock(a.performance, A.perf, 'broker')}</div>
      <div class="dt-sec">Cơ cấu danh mục${a.model ? ` so với "${esc(a.model.name)}" (ngưỡng lệch ${f1(a.model.driftPct)} điểm %)` : ''}</div>${compTable(a)}
      <div class="dt-sec">Đề xuất tái phân bổ</div>${rebalanceHtml(a)}
      <div class="dt-sec">AI nhận xét (Qwen chạy trên máy chủ nhà, chỉ dùng số liệu ở trên)</div>${aiHtml()}`;
  }

  function rebalanceHtml(a) {
    const r = a.rebalance;
    if (!a.model) return '<div class="empty">Gán danh mục mẫu cho khách để có đề xuất tái phân bổ.</div>';
    if (!r?.ok) return `<div class="msg err av-m">${esc(r?.error || 'Không tính được đề xuất.')}</div>`;
    const warn = r.warnings.map((w) => `<div class="msg warn av-m">${esc(w)}</div>`).join('');
    const made = A.made?.acc === a.client.accountNo ? `<div class="msg ${A.made.errs.length ? 'warn' : 'ok'} av-m av-made"><span>Đã tạo ${A.made.ok} phiếu lệnh${A.made.errs.length ? `, ${A.made.errs.length} phiếu lỗi: ${esc(A.made.errs.join('; '))}` : ''}. Khách xác nhận trong cổng khách hàng, sau đó bạn gửi lệnh ở màn Lệnh &amp; tài sản.</span><button class="link" data-subnav="desk">Mở Lệnh &amp; tài sản</button></div>` : '';
    if (!r.trades.length) return `${made}${warn}<div class="av-ok">Danh mục đang nằm trong ngưỡng lệch ${f1(r.drift)} điểm %. Không cần mua bán.</div>`;
    const canTrade = a.client.canTrade;
    const nOrders = r.trades.reduce((x, t) => x + t.orders.length, 0);
    return `${made}${warn}<div class="av-scroll"><table><thead><tr><th>Lệnh</th><th>Mã</th><th class="r">Khối lượng</th><th class="r">Giá (nghìn)</th><th class="r">Giá trị</th><th>Chia lệnh</th><th>Lý do</th></tr></thead><tbody>
      ${r.trades.map((t) => `<tr><td class="${t.side === 'B' ? 'up' : 'down'}"><b>${t.side === 'B' ? 'Mua' : 'Bán'}</b></td><td><b>${esc(t.symbol)}</b></td><td class="r">${vnd(t.qty)}</td><td class="r">${k2(t.price)}</td><td class="r">${big(t.value)}</td>
        <td>${t.orders.length > 1 ? t.orders.map(vnd).join(' + ') : '–'}</td><td><small>${esc(t.reason)}</small></td></tr>`).join('')}</tbody></table></div>
      <div class="av-kv"><div><span>Lệch lớn nhất</span><b>${f1(r.maxDeviationBefore)} → ${f1(r.maxDeviationAfter)} điểm %</b></div><div><span>Vòng quay</span><b>${f1(r.turnoverPct)}%</b></div>
        <div><span>Phí + thuế ước tính</span><b>${big(r.fees)}</b></div><div><span>Tiền mặt sau</span><b>${big(r.cash.after)} (${f1(r.cash.afterWeight)}%)</b></div></div>
      <div class="av-actions">${canTrade
        ? `<button class="cta buy" data-mktickets ${A.creating ? 'disabled' : ''}>${A.creating ? 'Đang tạo phiếu…' : `Tạo ${nOrders} phiếu lệnh để khách xác nhận`}</button><small>Phiếu dùng lệnh LO tại giá trên, khách xác nhận trong cổng khách hàng, bạn gửi lệnh ở màn Khách hàng. Kiểm tra lại giá trước khi gửi.</small>`
        : '<small>Khách chỉ ủy quyền theo dõi: gửi đề xuất cho khách tự đặt lệnh, hoặc nhờ khách cấp quyền giao dịch trên Entrade X.</small>'}</div>`;
  }

  function aiHtml() {
    const job = A.ai[A.sel];
    const busy = job && (job.status === 'queued' || job.status === 'running');
    const btns = `<div class="av-actions"><button class="ghost" data-ai="portfolio_review" ${busy ? 'disabled' : ''}>AI nhận xét danh mục</button>
      <button class="ghost" data-ai="rebalance_note" ${busy || !A.data?.rebalance?.trades?.length ? 'disabled' : ''}>AI viết ghi chú tái phân bổ</button></div>`;
    if (!job) return btns;
    if (job.error && !job.status) return btns + `<div class="msg err av-m">${esc(job.error)}</div>`;
    if (busy) return btns + `<div class="av-ai"><span class="typing"><i></i><i></i><i></i></span> ${job.status === 'queued' ? 'Đang chờ máy chủ AI nhận việc…' : 'AI đang viết (thường 20 đến 60 giây)…'}</div>`;
    if (job.status === 'failed') return btns + `<div class="msg err av-m">AI không trả lời được: ${esc(job.error)}</div>`;
    const bad = job.flags?.unknownPercents || [];
    return btns + `<div class="av-ai">${bad.length ? `<div class="msg warn">Có số liệu không khớp dữ liệu hệ thống: ${bad.map(esc).join(', ')}. Kiểm tra và sửa trước khi dùng.</div>` : ''}
      <div class="av-ai-text">${esc(job.output).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</div>
      <div class="av-ai-foot"><small>${esc(job.model || '')}${job.flags?.ms ? ` · ${f1(job.flags.ms / 1000)} giây` : ''} · Bản nháp cho môi giới, không gửi thẳng cho khách.</small><button class="link" data-aicopy>Sao chép</button></div></div>`;
  }

  async function loadClients() {
    try {
      const [c, m, j] = await Promise.all([api('/api/broker/clients'), api('/api/broker/models'), api('/api/ai/jobs').catch(() => null)]);
      A.clients = c.clients; A.models = m.models; A.worker = j?.worker || null;
    } catch (e) { A.clients = []; say(e.message); }
    renderClients(); renderAiStatus();
    if (A.tab === 'models') { renderModels(); renderEditor(); }
  }
  async function selectClient(acc) {
    A.sel = acc; A.loading = true; A.data = null; A.made = null; renderClients(); renderMain();
    document.dispatchEvent(new CustomEvent('lb:pick-client', { detail: { account: acc, from: 'adv' } }));
    try {
      const d = await api('/api/broker/analytics?account=' + encodeURIComponent(acc));
      if (A.sel !== acc) return;
      A.data = d;
    } catch (e) { if (A.sel === acc) A.data = { error: e.message }; }
    A.loading = false;
    if (A.sel === acc) renderMain();
  }

  async function saveProfile(form) {
    const fd = new FormData(form);
    const body = { account: A.sel, riskLevel: fd.get('risk') || null, modelId: fd.get('model') ? Number(fd.get('model')) : null, note: fd.get('note') };
    try {
      const r = await api('/api/broker/profile', { method: 'POST', body });
      say(r.suitability && !r.suitability.ok ? r.suitability.text : 'Đã lưu hồ sơ khách.');
      selectClient(A.sel);
    } catch (e) { say(e.message); }
  }

  async function createTickets() {
    const a = A.data; if (!a?.rebalance?.trades?.length || A.creating) return;
    const list = a.rebalance.trades.flatMap((t) => t.orders.map((q) => ({ ...t, qty: q })));
    const sum = list.map((t) => `${t.side === 'B' ? 'MUA' : 'BÁN'} ${t.qty.toLocaleString('vi-VN')} ${t.symbol} giá ${k2(t.price)}`).join('\n');
    if (!confirm(`Tạo ${list.length} phiếu lệnh cho ${a.client.name || a.client.accountNo} để khách xác nhận trong app?\n\n${sum}`)) return;
    A.creating = true; renderMain();
    let ok = 0; const errs = [];
    for (const t of list) {   // tuần tự: bán trước, mua sau, dễ theo dõi lỗi
      try {
        await api('/api/broker/tickets', { method: 'POST', body: { action: 'create', account: a.client.accountNo, symbol: t.symbol, side: t.side, type: 'LO', price: +(t.price / 1000).toFixed(2), qty: t.qty, source: 'app' } });
        ok++;
      } catch (e) { errs.push(`${t.symbol}: ${e.message}`); }
    }
    A.creating = false; A.made = { acc: a.client.accountNo, ok, errs };
    renderMain();
    say(errs.length ? `Đã tạo ${ok}/${list.length} phiếu. Lỗi: ${errs.join('; ')}` : `Đã tạo ${ok} phiếu. Khách sẽ thấy trong cổng khách hàng để xác nhận.`);
  }

  async function runAi(kind) {
    const acc = A.sel;
    A.ai[acc] = { status: 'queued' }; renderMain();
    try {
      const r = await api('/api/ai/jobs', { method: 'POST', body: { kind, account: acc } });
      A.worker = r.worker; renderAiStatus();
      A.ai[acc] = r.job; if (A.sel === acc) renderMain();
      if (!r.worker?.alive) say('Máy chủ AI ở nhà đang tắt: việc được giữ lại và chạy khi máy bật.');
      pollJob(acc, r.job.id);
    } catch (e) { A.ai[acc] = { error: e.message }; if (A.sel === acc) renderMain(); }
  }
  async function pollJob(acc, id, n = 0) {
    await new Promise((r) => setTimeout(r, n < 10 ? 2000 : 5000));
    let j; try { j = (await api('/api/ai/jobs?id=' + id)).job; } catch { j = null; }
    if (j) { A.ai[acc] = j; if (A.sel === acc && A.tab === 'clients') renderMain(); }
    if ((!j || j.status === 'queued' || j.status === 'running') && n < 120) pollJob(acc, id, n + 1);
  }

  /* ---------- Danh mục mẫu ---------- */
  function renderModels() {
    const box = $('av-models'); if (!box) return;
    box.innerHTML = `<div class="pane-title"><span>Danh mục mẫu</span><button class="link" data-mnew>+ Tạo mới</button></div>
      ${A.models.length ? A.models.map((m) => {
        const w = Object.entries(m.weights).sort((x, y) => y[1] - x[1]);
        const p = A.modelPerf[m.id];
        return `<div class="av-model${m.archived ? ' arch' : ''}${A.edit?.id === m.id ? ' on' : ''}"><div class="tk-top"><b>${esc(m.name)}</b><span class="pill">${esc(RISK[m.riskLevel])}</span></div>
          <small>${w.map(([s, v]) => `${esc(s)} ${f1(v)}%`).join(' · ')}${m.cashPct ? ` · Tiền ${f1(m.cashPct)}%` : ''}</small>
          ${m.description ? `<small class="av-desc">${esc(m.description)}</small>` : ''}
          ${p?.stats ? (() => { const y = p.stats.windows?.['1Y'] || { ret: p.stats.total, bench: p.stats.benchTotal };
            return `<small>${p.stats.windows?.['1Y'] ? '1 năm qua' : `Từ ${day(p.stats.from)}`} (giữ nguyên tỷ trọng ban đầu): <b class="${cls(y.ret)}">${pct(y.ret)}</b>, VN-Index <b class="${cls(y.bench)}">${pct(y.bench)}</b>, sụt giảm tối đa ${pct(p.stats.maxDrawdown)}</small>`; })() : ''}
          <div class="tk-actions"><button data-medit="${m.id}">Sửa</button><button data-mperf="${m.id}">${p?.loading ? 'Đang tính…' : 'Hiệu suất'}</button><button data-march="${m.id}">${m.archived ? 'Dùng lại' : 'Lưu trữ'}</button></div></div>`;
      }).join('') : '<div class="empty"><b>Chưa có danh mục mẫu</b>Tạo danh mục mẫu theo từng mức rủi ro, rồi gán cho khách để theo dõi độ lệch và tái phân bổ.</div>'}`;
  }
  function renderEditor() {
    const box = $('av-editor'); if (!box) return;
    const e = A.edit;
    if (!e) {
      const p = A.modelPerf.view && A.modelPerf[A.modelPerf.view];
      box.innerHTML = p?.chart ? `<div class="dt-head"><div><h1>${esc(p.model.name)}</h1><p>Hiệu suất 1 năm, mua theo tỷ trọng ở đầu kỳ rồi giữ nguyên</p></div></div><div class="av-pad">${chartSvg(p.chart, p.model.name)}<p class="av-note">${esc(p.note)}</p>${winTable(p.stats)}${riskStats(p.stats)}</div>`
        : '<div class="empty"><b>Chọn "Sửa" hoặc "Tạo mới"</b>Tổng tỷ trọng cổ phiếu và tiền mặt phải bằng 100%. Ngưỡng lệch: cổ phiếu lệch khỏi mục tiêu ít hơn ngưỡng này thì không đề xuất mua bán.</div>';
      return;
    }
    const total = e.rows.reduce((x, r) => x + (num(r.weight) || 0), 0) + (num(e.cashPct) || 0);
    const okTotal = Math.abs(total - 100) < 0.01;
    box.innerHTML = `<form class="av-edit" id="av-edit" novalidate>
      <div class="dt-head"><div><h1>${e.id ? 'Sửa danh mục mẫu' : 'Danh mục mẫu mới'}</h1></div><button class="link" type="button" data-mclose>Đóng</button></div>
      <div class="av-form">
        <label class="full">Tên<input class="inp" name="name" maxlength="80" value="${esc(e.name)}" required></label>
        <label>Mức rủi ro<select class="inp" name="riskLevel">${Object.entries(RISK).map(([k, v]) => `<option value="${k}" ${e.riskLevel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Ngưỡng lệch (điểm %)<input class="inp" name="driftPct" type="number" min="0.5" max="50" step="0.5" value="${esc(e.driftPct)}"></label>
        <label class="full">Mô tả, luận điểm<textarea class="inp" name="description" rows="2" maxlength="1000">${esc(e.description)}</textarea></label>
      </div>
      <table class="av-wtable"><thead><tr><th>Mã</th><th class="r">Tỷ trọng %</th><th></th></tr></thead><tbody>
        ${e.rows.map((r, i) => `<tr><td><input class="inp" data-wsym="${i}" value="${esc(r.symbol)}" maxlength="10" placeholder="VD: FPT" aria-label="Mã thứ ${i + 1}"></td>
          <td class="r"><input class="inp r" data-wval="${i}" type="number" min="0" max="100" step="0.5" value="${esc(r.weight)}" aria-label="Tỷ trọng mã thứ ${i + 1}"></td><td><button class="link" type="button" data-wdel="${i}" aria-label="Xóa dòng">Xóa</button></td></tr>`).join('')}
        <tr><td>Tiền mặt</td><td class="r"><input class="inp r" name="cashPct" data-wcash type="number" min="0" max="100" step="0.5" value="${esc(e.cashPct)}" aria-label="Tỷ trọng tiền mặt"></td><td></td></tr>
      </tbody></table>
      <div class="av-total ${okTotal ? 'ok' : 'bad'}">Tổng: <b>${f1(total)}%</b>${okTotal ? '' : ' (phải bằng 100%)'}</div>
      <div class="row-end"><button class="link" type="button" data-wadd ${e.rows.length >= 30 ? 'disabled' : ''}>+ Thêm mã</button><button class="cta buy" type="submit" ${okTotal && !e.saving ? '' : 'disabled'}>${e.saving ? 'Đang lưu…' : 'Lưu danh mục mẫu'}</button></div>
      <div id="av-edit-msg"></div></form>`;
  }
  function editModel(id) {
    const m = A.models.find((x) => x.id === id);
    A.edit = m ? { id: m.id, name: m.name, riskLevel: m.riskLevel, description: m.description || '', cashPct: m.cashPct, driftPct: m.driftPct, rows: Object.entries(m.weights).map(([symbol, weight]) => ({ symbol, weight })) }
      : { id: null, name: '', riskLevel: 'balanced', description: '', cashPct: 10, driftPct: 5, rows: [{ symbol: '', weight: '' }, { symbol: '', weight: '' }, { symbol: '', weight: '' }] };
    renderModels(); renderEditor();
  }
  function syncEdit(form) {
    const e = A.edit; if (!e || !form) return;
    const fd = new FormData(form);
    e.name = fd.get('name'); e.riskLevel = fd.get('riskLevel'); e.driftPct = fd.get('driftPct'); e.description = fd.get('description'); e.cashPct = fd.get('cashPct');
    form.querySelectorAll('[data-wsym]').forEach((el) => { e.rows[+el.dataset.wsym].symbol = el.value.trim().toUpperCase(); });
    form.querySelectorAll('[data-wval]').forEach((el) => { e.rows[+el.dataset.wval].weight = el.value; });
  }
  async function saveModel(form) {
    syncEdit(form);
    const e = A.edit;
    const weights = e.rows.filter((r) => r.symbol || num(r.weight)).map((r) => ({ symbol: r.symbol, weight: Number(r.weight) }));
    e.saving = true; renderEditor();
    try {
      const r = await api('/api/broker/models', { method: 'POST', body: { action: 'save', id: e.id, name: e.name, riskLevel: e.riskLevel, description: e.description, cashPct: Number(e.cashPct), driftPct: Number(e.driftPct), weights } });
      say('Đã lưu danh mục mẫu.');
      A.edit = null; delete A.modelPerf[r.model.id];
      A.models = (await api('/api/broker/models')).models;
      renderModels(); renderEditor();
    } catch (err) {
      e.saving = false; renderEditor();
      const m = $('av-edit-msg'); if (m) m.innerHTML = `<div class="msg err">${esc(err.message)}</div>`;
    }
  }
  async function modelPerf(id) {
    A.modelPerf[id] = { loading: true }; renderModels();
    try { A.modelPerf[id] = await api('/api/broker/models?perf=' + id); A.modelPerf.view = id; A.edit = null; }
    catch (e) { A.modelPerf[id] = null; say(e.message); }
    renderModels(); renderEditor();
  }

  /* ---------- Sự kiện (môi giới) ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !t.closest('#view-advisory')) return;
    if (t.dataset.aclient) return selectClient(t.dataset.aclient);
    if (t.hasAttribute('data-areload')) return selectClient(A.sel);
    if (t.dataset.perf && t.dataset.scope === 'broker') { A.perf = t.dataset.perf; return renderMain(); }
    if (t.hasAttribute('data-mktickets')) return createTickets();
    if (t.dataset.ai) return runAi(t.dataset.ai);
    if (t.hasAttribute('data-aicopy')) { const j = A.ai[A.sel]; return navigator.clipboard?.writeText(j?.output || '').then(() => say('Đã sao chép.'), () => say('Không sao chép được.')); }
    if (t.hasAttribute('data-mnew')) return editModel(null);
    if (t.dataset.medit) return editModel(Number(t.dataset.medit));
    if (t.dataset.mperf) return modelPerf(Number(t.dataset.mperf));
    if (t.dataset.march) {
      const m = A.models.find((x) => x.id === Number(t.dataset.march));
      return api('/api/broker/models', { method: 'POST', body: { action: 'archive', id: m.id, archived: !m.archived } })
        .then(async () => { A.models = (await api('/api/broker/models')).models; renderModels(); }, (err) => say(err.message));
    }
    if (t.hasAttribute('data-mclose')) { A.edit = null; renderModels(); return renderEditor(); }
    const form = $('av-edit');
    if (t.hasAttribute('data-wadd')) { syncEdit(form); A.edit.rows.push({ symbol: '', weight: '' }); return renderEditor(); }
    if (t.dataset.wdel) { syncEdit(form); A.edit.rows.splice(Number(t.dataset.wdel), 1); return renderEditor(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'av-q') { A.q = e.target.value; return renderClients(); }
    const form = e.target.closest('#av-edit');
    if (form && (e.target.dataset.wval != null || e.target.hasAttribute('data-wcash'))) {
      syncEdit(form);
      const total = A.edit.rows.reduce((x, r) => x + (num(r.weight) || 0), 0) + (num(A.edit.cashPct) || 0);
      const ok = Math.abs(total - 100) < 0.01;
      const el = form.querySelector('.av-total'); el.className = 'av-total ' + (ok ? 'ok' : 'bad'); el.innerHTML = `Tổng: <b>${f1(total)}%</b>${ok ? '' : ' (phải bằng 100%)'}`;
      form.querySelector('[type=submit]').disabled = !ok;
    }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'av-profile') { e.preventDefault(); return saveProfile(e.target); }
    if (e.target.id === 'av-edit') { e.preventDefault(); return saveModel(e.target); }
  });

  // Thanh chuyển trong mục "Khách hàng" (dùng chung cho màn Lệnh & tài sản và màn Tư vấn) + nút "Tư vấn & danh mục" ở bàn lệnh
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-subnav],[data-to-adv]'); if (!t) return;
    e.preventDefault();
    const to = t.dataset.subnav || 'clients';
    if (to === 'desk') return setView('desk');
    A.tab = to;
    if ($('view-advisory').hidden) return setView('advisory');
    shell();
  });
  document.addEventListener('lb:pick-client', (e) => { if (e.detail?.from !== 'adv') A.pending = e.detail.account; });
  document.addEventListener('lb:view', async (e) => {
    if (e.detail !== 'advisory') return;
    if (!A.broker) { if (typeof setView === 'function') setView('trade'); return; }
    shell();
    await loadClients();
    // Khách vừa chọn ở màn Lệnh & tài sản: mở luôn khách đó
    if (A.tab === 'clients' && A.pending && A.pending !== A.sel && A.clients.some((c) => c.accountNo === A.pending)) selectClient(A.pending);
    else if (A.tab === 'clients' && A.sel) renderMain();
    A.pending = null;
  });
  document.addEventListener('lb:user', async (e) => {
    A.broker = false;
    if (e.detail) { try { A.broker = !!(await api('/api/brokers')).owner; } catch { A.broker = false; } }
    if (!A.broker && !$('view-advisory').hidden && typeof setView === 'function') setView('trade');
    if (A.broker && location.hash === '#tu-van') {
      let n = 0; const tryOpen = () => { if (typeof UNIVERSE !== 'undefined' && UNIVERSE.length) setView('advisory'); else if (++n < 40) setTimeout(tryOpen, 250); };
      tryOpen();
    }
  });
  // Trạng thái AI local cập nhật mỗi phút khi đang mở màn Tư vấn
  setInterval(async () => {
    if (!A.broker || $('view-advisory').hidden) return;
    try { A.worker = (await api('/api/ai/jobs')).worker; renderAiStatus(); } catch { /* bỏ qua */ }
  }, 60000);

  /* ================= Khách: mục trong "Tài khoản của tôi" ================= */
  const C = { user: null, links: [], acc: null, data: {}, perf: 'realized', quiz: null, answers: {}, saving: false };

  function renderClient() {
    const box = $('portal-adv'); if (!box) return;
    if (!C.user || !C.links.length) { box.innerHTML = ''; return; }
    const pick = C.links.length > 1 ? `<select class="inp av-acc" id="av-acc" aria-label="Chọn tiểu khoản">${C.links.map((l) => `<option value="${esc(l.account_no)}" ${l.account_no === C.acc ? 'selected' : ''}>${esc(l.account_no)}</option>`).join('')}</select>` : '';
    const d = C.data[C.acc];
    let body;
    if (C.quiz) body = quizHtml();
    else if (!d || d.loading) body = '<div class="pcard"><div class="pcard-body">Đang tính hiệu suất danh mục…</div></div>';
    else if (d.error) body = `<div class="pcard"><div class="pcard-body"><div class="msg err">${esc(d.error)}</div></div></div>`;
    else {
      const p = d.profile;
      body = `<div class="pcard"><div class="pcard-body">
          <div class="av-row"><div><div class="pmeta">Khẩu vị rủi ro</div><div class="ticket-big">${p?.riskLabel ? esc(p.riskLabel) : 'Chưa đánh giá'}</div>
            <div class="pmeta">${p?.answeredBy === 'client' ? `Bạn trả lời ngày ${new Date(p.answeredAt).toLocaleDateString('vi-VN')}` : p?.answeredBy === 'broker' ? 'Do môi giới đánh giá sau khi trao đổi với bạn' : 'Trả lời 7 câu hỏi để môi giới tư vấn phù hợp hơn.'}</div></div>
            <button class="ghost" data-quiz>${p?.riskLevel ? 'Làm lại bảng câu hỏi' : 'Trả lời bảng câu hỏi'}</button></div>
          ${d.model ? `<div class="pnote">Danh mục mẫu môi giới đề xuất cho bạn: <b>${esc(d.model.name)}</b> (${esc(d.model.riskLabel)}). ${d.model.description ? esc(d.model.description) : ''}</div>` : ''}
          ${d.suitability && !d.suitability.ok ? `<div class="msg warn" style="margin-top:10px">${esc(d.suitability.text)} Hãy trao đổi lại với môi giới.</div>` : ''}
        </div></div>
        <div class="pcard"><div class="pcard-body"><div class="av-kv wide flat"><div><span>Tài sản ròng</span><b>${big(d.account.nav)}</b></div><div><span>Tiền mặt</span><b>${f1(d.composition.cashWeight)}%</b></div><div><span>Số mã hiệu dụng</span><b>${f1(d.composition.effectiveN)}</b></div></div>
          ${perfBlock(d.performance, C.perf, 'client')}</div></div>
        <div class="pcard"><div class="pcard-body"><h2>Rủi ro cần lưu ý</h2>${flagsHtml(d.composition.flags)}</div></div>
        <div class="pcard">${compTable(d)}<div class="pcard-body"><p class="av-note">${d.model ? 'Cột "Lệch" so sánh với danh mục mẫu. Khi cần cân bằng lại, môi giới sẽ gửi phiếu lệnh để bạn xác nhận ở mục trên.' : 'Giá theo nghìn đồng.'}</p></div></div>`;
    }
    box.innerHTML = `<section><div class="av-row"><h2>Danh mục và hiệu suất</h2>${pick}</div>${body}
      <p class="av-note">Số liệu chỉ để tham khảo, không phải cam kết lợi nhuận. Kết quả quá khứ không bảo đảm kết quả tương lai.</p></section>`;
  }

  function quizHtml() {
    const q = C.quiz;
    if (q.loading) return '<div class="pcard"><div class="pcard-body">Đang tải câu hỏi…</div></div>';
    const done = q.questions.every((x) => C.answers[x.id]);
    return `<form class="pcard" id="av-quiz"><div class="pcard-body"><div class="ticket-big">Bảng câu hỏi khẩu vị rủi ro</div>
      <p class="pmeta">7 câu, khoảng 1 phút. Kết quả giúp môi giới đề xuất danh mục phù hợp với bạn.</p>
      ${q.questions.map((x, i) => `<fieldset class="av-q"><legend>${i + 1}. ${esc(x.text)}</legend>${x.options.map((o) => `<label><input type="radio" name="${esc(x.id)}" value="${esc(o.id)}" ${C.answers[x.id] === o.id ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}</fieldset>`).join('')}
      ${q.error ? `<div class="msg err">${esc(q.error)}</div>` : ''}
      <div class="pactions"><button type="submit" class="yes" ${done && !C.saving ? '' : 'disabled'}>${C.saving ? 'Đang lưu…' : 'Gửi câu trả lời'}</button><button type="button" class="no" data-quizclose>Để sau</button></div></div></form>`;
  }

  async function loadClientData(force = false) {
    if (!C.acc || (C.data[C.acc] && !C.data[C.acc].error && !force)) return renderClient();
    C.data[C.acc] = { loading: true }; renderClient();
    const acc = C.acc;
    try { C.data[acc] = await api('/api/portal/analytics?account=' + encodeURIComponent(acc)); }
    catch (e) { C.data[acc] = { error: e.message }; }
    if (acc === C.acc) renderClient();
  }
  async function loadLinks() {
    try { C.links = (await api('/api/portal/summary')).links || []; } catch { C.links = []; }
    if (!C.links.some((l) => l.account_no === C.acc)) C.acc = C.links[0]?.account_no || null;
    loadClientData();
  }
  async function openQuiz() {
    C.quiz = { loading: true }; renderClient();
    try {
      const r = await api('/api/portal/profile?account=' + encodeURIComponent(C.acc));
      C.quiz = { questions: r.questions };
      C.answers = { ...(r.profile?.answered_by === 'client' ? r.profile.answers : {}) };
    } catch (e) { C.quiz = null; say(e.message); }
    renderClient();
  }
  async function submitQuiz() {
    C.saving = true; renderClient();
    try {
      const r = await api('/api/portal/profile', { method: 'POST', body: { account: C.acc, answers: C.answers } });
      C.quiz = null; C.saving = false;
      say(`Khẩu vị rủi ro của bạn: ${r.profile.risk_label}.${r.notes?.length ? ' ' + r.notes.join(' ') : ''}`);
      loadClientData(true);
    } catch (e) { C.saving = false; C.quiz.error = e.message; renderClient(); }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !t.closest('#portal-adv')) return;
    if (t.dataset.perf && t.dataset.scope === 'client') { C.perf = t.dataset.perf; return renderClient(); }
    if (t.hasAttribute('data-quiz')) return openQuiz();
    if (t.hasAttribute('data-quizclose')) { C.quiz = null; return renderClient(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'av-acc') { C.acc = e.target.value; return loadClientData(); }
    if (e.target.closest('#av-quiz') && e.target.type === 'radio') {
      C.answers[e.target.name] = e.target.value;
      const btn = $('av-quiz').querySelector('[type=submit]');
      btn.disabled = !C.quiz.questions.every((x) => C.answers[x.id]);
    }
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'av-quiz') { e.preventDefault(); submitQuiz(); } });
  document.addEventListener('lb:view', (e) => { if (e.detail === 'portal' && C.user) loadLinks(); });
  document.addEventListener('lb:user', (e) => { C.user = e.detail || null; C.links = []; C.data = {}; C.quiz = null; renderClient(); });

  /* ================= Giới thiệu cho người mới (chưa đăng nhập) ================= */
  const INTRO_KEY = 'lb_intro_closed';
  const introClosed = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } };
  function renderIntro(user) {
    let box = $('lb-intro');
    if (user || introClosed()) { if (box) box.remove(); return; }
    if (box) return;
    box = document.createElement('aside');
    box.id = 'lb-intro'; box.className = 'intro'; box.setAttribute('aria-label', 'Giới thiệu Lật Bài');
    box.innerHTML = `<button class="intro-x" data-intro-close aria-label="Đóng giới thiệu">×</button>
      <b>Lật Bài: đầu tư cùng môi giới của bạn</b>
      <ul><li>Bảng giá và biểu đồ realtime từ DNSE</li><li>Giao dịch thử bằng tiền ảo, không mất tiền thật</li>
        <li>Khách của môi giới: nhận khuyến nghị, xác nhận lệnh trong app, theo dõi hiệu suất danh mục</li></ul>
      <div class="intro-act"><button class="btn-primary" data-intro-login>Đăng nhập hoặc tạo tài khoản</button><button class="link" data-intro-board>Xem bảng giá</button></div>`;
    document.body.appendChild(box);
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-intro-close],[data-intro-login],[data-intro-board]'); if (!t) return;
    if (t.hasAttribute('data-intro-login')) { $('btn-login')?.click(); return; }
    if (t.hasAttribute('data-intro-board') && typeof setView === 'function') setView('board');
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* chế độ ẩn danh: chỉ đóng lần này */ }
    $('lb-intro')?.remove();
  });
  document.addEventListener('lb:user', (e) => renderIntro(e.detail));
})();
