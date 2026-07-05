/**
 * bao-cao/js/app.js — Báo Cáo Vận Mệnh Tổng Hợp.
 * Gộp Thần Số + Con Giáp + Ngũ Hành mệnh + Cung Hoàng Đạo + Năm cá nhân
 * từ Hồ Sơ Huyền Học (chỉ cần họ tên + ngày sinh). Thuần frontend.
 * Cần: profile.js (LatbaiProfile), report-data.js (RP_*, zodiacOf),
 *      thansohoc/js/numerology-data.js (NUM_MEANINGS, PERSONAL_YEAR_MEANINGS).
 */
(function () {
  'use strict';

  const P = window.LatbaiProfile;
  if (!P) return;

  // ---- Numerology tên (chủ đạo/năm đã có ở profile.js; tên thì tính ở đây) ----
  const PY = { A:1,J:1,S:1, B:2,K:2,T:2, C:3,L:3,U:3, D:4,M:4,V:4, E:5,N:5,W:5,
               F:6,O:6,X:6, G:7,P:7,Y:7, H:8,Q:8,Z:8, I:9,R:9 };
  const VOWELS = new Set(['A','E','I','O','U','Y']);
  function stripAccents(s) {
    return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase();
  }
  function reduceMaster(n) {
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
      n = n.toString().split('').reduce((s,d)=>s+parseInt(d),0);
    }
    return n;
  }
  function nameNumbers(name) {
    const clean = stripAccents(name).replace(/[^A-Z]/g,'');
    let dest=0, soul=0, per=0;
    for (const ch of clean) {
      const v = PY[ch]||0; dest+=v;
      if (VOWELS.has(ch)) soul+=v; else per+=v;
    }
    return { destiny: String(reduceMaster(dest)), soul: String(reduceMaster(soul)), personality: String(reduceMaster(per)) };
  }

  // ---- Mệnh nạp âm ----
  function menhNapAm(year) {
    const can = ((year-4)%10+10)%10, chi = ((year-4)%12+12)%12;
    let z = Math.floor(can/2)+1 + [0,0,1,1,2,2][chi%6];
    if (z>5) z-=5;
    return ['','Kim','Thủy','Hỏa','Thổ','Mộc'][z];
  }

  function meaning(type, val) {
    const M = (typeof NUM_MEANINGS !== 'undefined' && NUM_MEANINGS[type]) || {};
    return M[val] || M[String(P.reduceToSingle(parseInt(val)))] || '';
  }

  // ---- Tính toàn bộ báo cáo ----
  function compute(p) {
    const lp = P.lifePath(p.day, p.month, p.year);
    const nn = nameNumbers(p.name);
    const cc = P.canChi(p.year);
    const menh = menhNapAm(p.year);
    const zName = zodiacOf(p.day, p.month);
    const nowY = new Date().getFullYear();
    const py = P.personalYear(p.day, p.month, nowY);
    return { p, lp, nn, cc, menh, zName, zod: RP_ZODIAC[zName], el: RP_ELEMENT[menh], giap: RP_GIAP[cc.giap], py, nowY };
  }

  // ==================== RENDER ====================
  const root = document.getElementById('bc-root');

  function renderForm(prefill) {
    root.innerHTML = `
      <div class="bc-card bc-form-card">
        <h2 class="bc-form-title"><i class="ti ti-sparkles"></i> Lập báo cáo của bạn</h2>
        <p class="bc-form-sub">Chỉ cần họ tên và ngày sinh — báo cáo tính tại chỗ, lưu trên máy bạn.</p>
        <form id="bc-form">
          <input type="text" id="bc-name" class="bc-input" placeholder="Họ và tên đầy đủ" required aria-label="Họ và tên" value="${prefill?.name || ''}">
          <div class="bc-date-row">
            <select id="bc-day" class="bc-select" required aria-label="Ngày sinh"><option value="">Ngày</option></select>
            <select id="bc-month" class="bc-select" required aria-label="Tháng sinh"><option value="">Tháng</option></select>
            <select id="bc-year" class="bc-select" required aria-label="Năm sinh"><option value="">Năm</option></select>
          </div>
          <button type="submit" class="bc-btn"><i class="ti ti-wand"></i> Xem báo cáo vận mệnh</button>
        </form>
      </div>`;
    const d=document.getElementById('bc-day'), m=document.getElementById('bc-month'), y=document.getElementById('bc-year');
    for (let i=1;i<=31;i++) d.innerHTML+=`<option value="${i}">${i}</option>`;
    for (let i=1;i<=12;i++) m.innerHTML+=`<option value="${i}">${i}</option>`;
    const nowY=new Date().getFullYear();
    for (let i=nowY;i>=1930;i--) y.innerHTML+=`<option value="${i}">${i}</option>`;
    if (prefill) { d.value=String(prefill.day); m.value=String(prefill.month); y.value=String(prefill.year); }
    document.getElementById('bc-form').addEventListener('submit',(e)=>{
      e.preventDefault();
      const name=document.getElementById('bc-name').value.trim();
      const day=parseInt(d.value), month=parseInt(m.value), year=parseInt(y.value);
      if (!name||!day||!month||!year) return;
      P.save({ name, day, month, year });
      renderReport(compute(P.get()));
    });
  }

  function section(icon, label, big, title, bodyHtml, extraChips) {
    return `<div class="bc-card bc-section">
      <div class="bc-sec-head"><i class="ti ${icon}"></i> ${label}</div>
      <div class="bc-sec-top">
        <span class="bc-big">${big}</span>
        <div><h3 class="bc-sec-title">${title}</h3>${extraChips || ''}</div>
      </div>
      <div class="bc-sec-body">${bodyHtml}</div>
    </div>`;
  }

  function renderReport(R) {
    const p = R.p;
    const pyBody = (typeof PERSONAL_YEAR_MEANINGS !== 'undefined' && PERSONAL_YEAR_MEANINGS[R.py]) || `<p>Năm cá nhân số ${R.py}.</p>`;

    root.innerHTML = `
      <div class="bc-card bc-hero-card">
        <div class="bc-hero-head">
          <span class="bc-avatar">${p.name.trim().charAt(0).toUpperCase()}</span>
          <div>
            <h2 class="bc-name">${p.name}</h2>
            <p class="bc-dob">${p.day}/${p.month}/${p.year} · ${R.cc.text}</p>
          </div>
        </div>
        <div class="bc-chips">
          <span class="bc-chip"><b>${R.lp}</b> Số chủ đạo</span>
          <span class="bc-chip"><b>${R.cc.giap}</b> Con giáp</span>
          <span class="bc-chip"><b>${R.menh}</b> Mệnh</span>
          <span class="bc-chip"><b>${R.zod.sym}</b> ${R.zName}</span>
        </div>
      </div>

      ${section('ti-route','Con số cuộc đời', R.lp, 'Số Chủ Đạo ' + R.lp,
        meaning('lifepath', R.lp) || '<p>Bài học đường đời cốt lõi của bạn.</p>')}

      <div class="bc-card bc-section">
        <div class="bc-sec-head"><i class="ti ti-hash"></i> Các con số cốt lõi</div>
        <div class="bc-core-grid">
          ${coreItem('Số Sứ Mệnh', R.nn.destiny, 'Mục tiêu &amp; con đường đời')}
          ${coreItem('Số Linh Hồn', R.nn.soul, 'Khao khát sâu thẳm')}
          ${coreItem('Số Nhân Cách', R.nn.personality, 'Ấn tượng bạn tạo ra')}
        </div>
        <details class="bc-more"><summary>Xem luận giải chi tiết 3 con số</summary>
          <div class="bc-more-body">
            <div class="bc-more-block"><b>Sứ Mệnh ${R.nn.destiny}</b>${meaning('destiny', R.nn.destiny)}</div>
            <div class="bc-more-block"><b>Linh Hồn ${R.nn.soul}</b>${meaning('soul', R.nn.soul)}</div>
            <div class="bc-more-block"><b>Nhân Cách ${R.nn.personality}</b>${meaning('personality', R.nn.personality)}</div>
          </div>
        </details>
      </div>

      ${section('ti-flame','Ngũ hành bản mệnh', R.menh, 'Mệnh ' + R.menh, R.el.d,
        `<div class="bc-mini-chips">
           <span><i class="ti ti-palette"></i> Màu hợp: ${R.el.colors}</span>
           <span><i class="ti ti-compass"></i> Hướng tốt: ${R.el.dir}</span>
           <span><i class="ti ti-arrows-shuffle"></i> Tương sinh: ${R.el.sinh}</span>
         </div>`)}

      ${section('ti-paw','Con giáp', R.cc.giap, 'Tuổi ' + R.cc.text, R.giap.d,
        `<div class="bc-mini-chips"><span><i class="ti ti-heart-handshake"></i> Tam hợp (hợp nhất): ${R.giap.hop}</span></div>`)}

      ${section('ti-star', 'Cung hoàng đạo', R.zod.sym, R.zName + ' · ' + R.zod.el, R.zod.d)}

      ${section('ti-calendar-star','Năm ' + R.nowY + ' của bạn', R.py, 'Năm cá nhân ' + R.py, pyBody)}

      <div class="bc-actions">
        <button type="button" id="bc-share" class="bc-btn"><i class="ti ti-share"></i> Chia sẻ báo cáo</button>
        <button type="button" id="bc-download" class="bc-btn-sub"><i class="ti ti-download"></i> Tải ảnh</button>
      </div>
      <div class="bc-deep">
        <p class="bc-deep-title">Đào sâu từng phần:</p>
        <div class="bc-deep-links">
          <a href="/tuvi/"><i class="ti ti-stars"></i> Lá số Tử Vi (cần giờ sinh)</a>
          <a href="/thansohoc/"><i class="ti ti-hash"></i> Bản đồ Thần Số đầy đủ</a>
          <a href="/ngay-tot/"><i class="ti ti-calendar"></i> Ngày tốt hợp tuổi</a>
          <a href="/ghep-doi/"><i class="ti ti-hearts"></i> Ghép đôi với người ấy</a>
        </div>
      </div>
      <div class="bc-editrow"><button type="button" id="bc-edit" class="bc-edit-btn"><i class="ti ti-pencil"></i> Lập lại cho người khác</button></div>
      <p class="bc-disclaimer">Báo cáo tổng hợp theo Thần Số Học, Can Chi & chiêm tinh — mang tính tham khảo và định hướng, không phải định mệnh cứng nhắc.</p>
    `;

    document.getElementById('bc-share').addEventListener('click', () => shareCard(R, true));
    document.getElementById('bc-download').addEventListener('click', () => shareCard(R, false));
    document.getElementById('bc-edit').addEventListener('click', () => renderForm(P.get()));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function coreItem(label, num, sub) {
    return `<div class="bc-core"><span class="bc-core-num">${num}</span><span class="bc-core-label">${label}</span><span class="bc-core-sub">${sub}</span></div>`;
  }

  // ==================== SHARE CARD 1080×1350 ====================
  async function shareCard(R, wantShare) {
    await document.fonts.ready;
    const W=1080, H=1350, cv=document.createElement('canvas');
    cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#fbf3e4'; ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(W/2,0,100,W/2,0,900);
    g.addColorStop(0,'rgba(217,138,10,0.16)'); g.addColorStop(1,'rgba(217,138,10,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(217,138,10,0.75)'; ctx.lineWidth=6; ctx.strokeRect(28,28,W-56,H-56);
    ctx.lineWidth=2; ctx.strokeRect(44,44,W-88,H-88);
    const F=(s,w=800)=>`${w} ${s}px 'Be Vietnam Pro', sans-serif`;
    ctx.textAlign='center';

    ctx.fillStyle='#a7887a'; ctx.font=F(30,800);
    ctx.fillText('BÁO CÁO VẬN MỆNH · LATBAI.VN', W/2, 120);
    ctx.fillStyle='#2b1408'; ctx.font=F(56,900);
    ctx.fillText(trim(R.p.name,20), W/2, 205);
    ctx.fillStyle='#6b4030'; ctx.font=F(32,700);
    ctx.fillText(`${R.p.day}/${R.p.month}/${R.p.year} · ${R.cc.text}`, W/2, 260);

    // 4 ô tổng quan
    const boxes=[['Số chủ đạo',R.lp],['Con giáp',R.cc.giap],['Mệnh',R.menh],[R.zName,R.zod.sym]];
    const bw=470, bh=150, gap=40, x0=(W-bw*2-gap)/2;
    boxes.forEach((b,i)=>{
      const bx=x0+(i%2)*(bw+gap), by=320+Math.floor(i/2)*(bh+gap);
      ctx.fillStyle='#fff'; roundRect(ctx,bx,by,bw,bh,20); ctx.fill();
      ctx.strokeStyle='rgba(217,138,10,0.3)'; ctx.lineWidth=1.5; roundRect(ctx,bx,by,bw,bh,20); ctx.stroke();
      ctx.fillStyle='#d98a0a'; ctx.font=F(60,900); ctx.fillText(String(b[1]), bx+bw/2, by+82);
      ctx.fillStyle='#8a7258'; ctx.font=F(26,700); ctx.fillText(b[0], bx+bw/2, by+122);
    });

    // câu tóm tính cách (số chủ đạo) — lấy đoạn <p> mô tả, cắt theo từ
    const lpText = clampWords(paraText(meaning('lifepath', R.lp)), 200);
    ctx.fillStyle='#3f2d1e'; ctx.font=F(30,500);
    wrapText(ctx, lpText, W/2, 760, W-200, 46);

    ctx.fillStyle='#a7887a'; ctx.font=F(28,600);
    ctx.fillText('Xem báo cáo đầy đủ của bạn tại  latbai.vn/bao-cao', W/2, H-92);

    const blob = await new Promise(r=>cv.toBlob(r,'image/png'));
    const fname = `bao-cao-${stripAccents(R.p.name).replace(/[^A-Z]/g,'').slice(0,12)||'vanmenh'}.png`;
    if (wantShare && navigator.canShare && navigator.canShare({ files:[new File([blob],fname,{type:'image/png'})] })) {
      try {
        await navigator.share({ files:[new File([blob],fname,{type:'image/png'})], title:'Báo Cáo Vận Mệnh',
          text:`Báo cáo vận mệnh của ${R.p.name} — số chủ đạo ${R.lp}, tuổi ${R.cc.giap}, mệnh ${R.menh}. Lập của bạn tại latbai.vn/bao-cao` });
        return;
      } catch(_) {}
    }
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.download=fname; a.href=url; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }

  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function trim(s,n){s=(s||'').trim();return s.length<=n?s:s.slice(0,n-1)+'…';}
  function stripHtml(h){const d=document.createElement('div');d.innerHTML=h||'';return (d.textContent||'').replace(/\s+/g,' ').trim();}
  // ưu tiên nội dung trong <p> (bỏ tiêu đề <h4>); fallback strip toàn bộ
  function paraText(h){const m=(h||'').match(/<p[^>]*>([\s\S]*?)<\/p>/i);return stripHtml(m?m[1]:h);}
  function clampWords(s,n){s=(s||'').trim();if(s.length<=n)return s;const cut=s.slice(0,n);return cut.slice(0,cut.lastIndexOf(' ')).trimEnd()+'…';}
  function wrapText(ctx,text,x,y,maxW,lh){
    const words=text.split(' '); let line='', yy=y;
    for (const w of words){
      const test=line?line+' '+w:w;
      if (ctx.measureText(test).width>maxW && line){ ctx.fillText(line,x,yy); line=w; yy+=lh; }
      else line=test;
    }
    if (line) ctx.fillText(line,x,yy);
  }

  // ==================== BOOT ====================
  function boot() {
    const p = P.get();
    if (p) renderReport(compute(p));
    else renderForm();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
