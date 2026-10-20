/* ---------------- Market model: giá thật từ /api/market và /api/history (nguồn DNSE) ---------------- */
// giá tính theo đơn vị 10 đồng (số nguyên) để không lệch số thực
const U = p => Math.round(p*100), P = u => u/100;
function tickU(u,ex){ if(ex!=="HOSE") return 10; return u<1000?1:u<5000?5:10; }
const roundTo=(u,t)=>Math.round(u/t)*t;

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const vnDay = t => new Date((t+7*3600)*1000).toISOString().slice(0,10);
const toBar = b => ({time:b.t,open:b.o,high:b.h,low:b.l,close:b.c,value:b.v});

const UNIVERSE = [];                 // nạp từ API
const M = {};
const MKT = {session:"closed", asof:null, indices:[], polledOnce:false, source:"poll"};

async function getJSON(url){
  const r = await fetch(url, {headers:{Accept:"application/json"}});
  if(!r.ok) throw new Error(url+" HTTP "+r.status);
  return r.json();
}
function setQuote(m,q){ m.refU=U(q.ref); m.ceilU=U(q.ceil); m.floorU=U(q.floor); m.lastU=U(q.last); }

/* Nến cuối cùng của lịch sử là phiên hiện tại (đang chạy) hoặc phiên gần nhất (ngoài giờ): tách ra làm `today`. */
function buildSymbol(q,hist){
  const bars = hist.map(toBar), today = bars.pop();
  const m = {s:q.s, ex:q.ex, name:q.name, sector:q.sector, vn30:q.vn30, watch:q.watch, bars, today:{...today}, session:vnDay(hist[hist.length-1].t), rnd:rng(q.s.charCodeAt(0)*131+q.s.charCodeAt(2)), tape:[]};
  setQuote(m,q); setDepth(m,q);
  m.hiU=U(today.high); m.loU=U(today.low); m.vol=today.value;
  return m;
}
async function loadMarket(){
  const [mk,hs] = await Promise.all([getJSON("/api/market"), getJSON("/api/history?days=260")]);
  MKT.session = mk.session; MKT.asof = mk.asof; MKT.indices = mk.indices||[]; MKT.source = mk.source||"poll";
  UNIVERSE.length = 0;
  Object.values(mk.quotes).forEach(q=>{
    if(!hs.bars[q.s]) return;
    UNIVERSE.push({s:q.s,ex:q.ex,name:q.name,sector:q.sector,vn30:q.vn30,watch:q.watch}); M[q.s] = buildSymbol(q,hs.bars[q.s]);
  });
  if(!UNIVERSE.length) throw new Error("Không có mã nào đủ dữ liệu");
  // Bảng giá dùng CẢ rổ worker đang ghi (~150 mã), còn UNIVERSE/M giữ nguyên là các mã có đủ 260
  // nến để vẽ biểu đồ ở màn Giao dịch. Tách hai thứ ra để mở rộng bảng giá không kéo theo 150 lượt
  // gọi /api/history.
  MKT.all = mk.quotes;
  MKT.polledOnce = false;
}
/* Áp báo giá mới. Trả false nếu đã sang phiên mới (cần nạp lại lịch sử). */
/* Độ sâu thị trường thật (có khi worker WebSocket đang chạy): mua/bán, giá theo nghìn đồng */
function setDepth(m,q){
  const d=q.depth, lv=a=>(a||[]).filter(x=>x&&x.p>0).map(x=>({u:U(x.p),q:Math.round(x.q||0)}));
  m.depth = d ? {bid:lv(d.bid).sort((a,b)=>b.u-a.u), offer:lv(d.offer).sort((a,b)=>a.u-b.u)} : null;
}
function applyQuote(m,q){
  if(q.lastSession!==m.session) return false;
  const prevLast=m.lastU, prevVol=m.vol;
  setQuote(m,q); setDepth(m,q);
  if(q.vol>0){ // phiên đang chạy
    m.hiU=U(q.high); m.loU=U(q.low); m.vol=q.vol;
    Object.assign(m.today,{open:q.open,high:q.high,low:q.low,close:q.last,value:q.vol});
    // prevVol>0: lần quan sát đầu tiên của mã chưa biết khối lượng trước đó, nếu ghi thì sẽ thành một lệnh khổng lồ bằng cả phiên
    if(MKT.polledOnce && prevVol>0 && q.vol>prevVol){
      m.tape.unshift({t:new Date().toTimeString().slice(0,8),u:m.lastU,q:q.vol-prevVol,side:m.lastU>=prevLast?"M":"B"});
      m.tape.length=Math.min(m.tape.length,40);
    }
  }
  return true;
}
/* Độ sâu thị trường (khối lượng chờ mua/bán) không có trong nguồn dữ liệu công khai, nên chỉ hiển thị các bước giá liền kề giá khớp. */
function book(m){
  if(m.depth && (m.depth.bid.length||m.depth.offer.length)){
    const n=m.ex==="HOSE"?3:5;   // HOSE có 3 mức giá; HNX/UPCoM có 10 nhưng bảng này chỉ hiện 5
    return {asks:m.depth.offer.slice(0,n), bids:m.depth.bid.slice(0,n), real:true};
  }
  const t=tickU(m.lastU,m.ex), asks=[], bids=[];
  for(let i=1;i<=3;i++){
    const a=m.lastU+i*t, b=m.lastU-i*t;
    if(a<=m.ceilU) asks.push({u:a});
    if(b>=m.floorU) bids.push({u:b});
  }
  return {asks,bids};
}

/* ---------------- Account (demo) ---------------- */
/* Tài khoản giao dịch thử (tiền ảo) nằm trên server, gắn với người dùng đã đăng nhập. */
/* mode: 'that' = tài khoản DNSE thật, 'ao' = giao dịch thử bằng tiền ảo.
   Mọi chỗ hiển thị đọc chung ACC, nên đổi tài khoản chỉ là đổi NGUỒN đổ vào đây - không phải
   viết lại phiếu lệnh, sổ lệnh hay danh mục. Chỉ đặt/hủy lệnh mới phải rẽ nhánh. */
const ACC = {user:null, cash:0, hold:{}, orders:[], mode:'ao', coThat:false, coShs:false, daDo:false, tuChon:false, accountNo:null, dsTieuKhoan:[], otp:false, maxOrderVnd:0};
const FEE=.0015, TAX=.001;

/* ---------------- Formatting ---------------- */
const fP = u => P(u).toFixed(2);
const fN = n => Math.round(n).toLocaleString("vi-VN");
const fVND = n => fN(n)+" đ";
const fVol = n => n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n);
function cls(m,u){ if(u>=m.ceilU) return "ceil"; if(u<=m.floorU) return "floor"; if(u===m.refU) return "ref"; return u>m.refU?"up":"down"; }
const $ = id => document.getElementById(id);

/* ---------------- State ---------------- */
const S = {sym:"HPG", tf:"D", style:"candle", ind:{ma20:true,ma50:true,vol:true}, side:"B", type:"LO", pxU:null, qty:100, tab:"orders"};

/* ---------------- Chart ---------------- */
const LWC = window.LightweightCharts;
const chart = LWC.createChart($("chart"),{
  autoSize:true,
  localization:{locale:"en-US",priceFormatter:p=>p.toFixed(2)},
  layout:{background:{type:"solid",color:"#000000"},textColor:"#8f8786",fontFamily:"Be Vietnam Pro, system-ui, sans-serif",fontSize:11},
  grid:{vertLines:{color:"#141212"},horzLines:{color:"#141212"}},
  crosshair:{mode:LWC.CrosshairMode.Normal,vertLine:{color:"#5e5756",labelBackgroundColor:"#b3122b"},horzLine:{color:"#5e5756",labelBackgroundColor:"#b3122b"}},
  rightPriceScale:{borderColor:"#262222"},
  timeScale:{borderColor:"#262222",rightOffset:6,barSpacing:7},
  // Trên điện thoại, vuốt dọc trong vùng biểu đồ trước đây bị biểu đồ nuốt: trang đứng im còn
  // biểu đồ chạy. Mà vuốt ngay giữa màn hình là thói quen, nên người dùng tưởng trang bị treo.
  // Tắt kéo DỌC bằng ngón tay; kéo ngang để xem lịch sử giá vẫn giữ nguyên.
  handleScroll:{vertTouchDrag:false},
});
const candle = chart.addCandlestickSeries({upColor:"#2ebd85",downColor:"#f6465d",borderVisible:false,wickUpColor:"#2ebd85",wickDownColor:"#f6465d",priceFormat:{type:"price",precision:2,minMove:.01}});
const line = chart.addLineSeries({color:"#ece7e6",lineWidth:2,visible:false,priceLineVisible:true});
const vol = chart.addHistogramSeries({priceScaleId:"vol",priceFormat:{type:"volume"},lastValueVisible:false,priceLineVisible:false});
chart.priceScale("vol").applyOptions({scaleMargins:{top:.82,bottom:0}});
const ma20 = chart.addLineSeries({color:"#d4a017",lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
const ma50 = chart.addLineSeries({color:"#7aa2f7",lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});

function resample(bars,tf){
  if(tf==="D") return bars;
  const out=[], key=t=>{const d=new Date(t*1000); if(tf==="M") return d.getUTCFullYear()*12+d.getUTCMonth();
    const day=(d.getUTCDay()+6)%7; return Math.floor((t-day*86400)/604800);};
  bars.forEach(b=>{const k=key(b.time), last=out[out.length-1];
    if(last&&last._k===k){last.high=Math.max(last.high,b.high);last.low=Math.min(last.low,b.low);last.close=b.close;last.value+=b.value;}
    else out.push({...b,_k:k});});
  return out.map(({_k,...b})=>b);
}
function sma(bars,n){const out=[];let s=0;bars.forEach((b,i)=>{s+=b.close;if(i>=n)s-=bars[i-n].close;if(i>=n-1)out.push({time:b.time,value:+(s/n).toFixed(3)})});return out;}
let shown=[];
function drawChart(fit){
  const m=M[S.sym]; shown=resample([...m.bars,{...m.today}],S.tf);
  candle.setData(shown); line.setData(shown.map(b=>({time:b.time,value:b.close})));
  vol.setData(shown.map(b=>({time:b.time,value:b.value,color:b.close>=b.open?"rgba(46,189,133,.35)":"rgba(246,70,93,.35)"})));
  ma20.setData(sma(shown,20)); ma50.setData(sma(shown,50));
  applyChartToggles(); if(fit) chart.timeScale().fitContent();
  legend(shown[shown.length-1]);
}
function applyChartToggles(){
  candle.applyOptions({visible:S.style==="candle"}); line.applyOptions({visible:S.style==="line"});
  ma20.applyOptions({visible:S.ind.ma20}); ma50.applyOptions({visible:S.ind.ma50}); vol.applyOptions({visible:S.ind.vol});
}
function legend(b,p){
  if(!b) return;
  const c=b.close>=b.open?"up":"down", v=k=>(p&&p.get(k))?p.get(k).value:null;
  const m20=v(ma20)??(sma(shown,20).at(-1)||{}).value, m50=v(ma50)??(sma(shown,50).at(-1)||{}).value;
  $("legend").innerHTML=`<span>O<b class="${c}">${b.open.toFixed(2)}</b></span><span>H<b class="${c}">${b.high.toFixed(2)}</b></span><span>L<b class="${c}">${b.low.toFixed(2)}</b></span><span>C<b class="${c}">${b.close.toFixed(2)}</b></span>`+
    (S.ind.ma20&&m20?`<span class="ma20">MA20<b>${m20.toFixed(2)}</b></span>`:"")+(S.ind.ma50&&m50?`<span class="ma50">MA50<b>${m50.toFixed(2)}</b></span>`:"");
}
chart.subscribeCrosshairMove(p=>{ if(!p.time||!p.seriesData.size){legend(shown[shown.length-1]);return;}
  legend(p.seriesData.get(candle)||shown.find(b=>b.time===p.time), p.seriesData); });

/* ---------------- Renderers ---------------- */
function renderWL(){
  const WL=UNIVERSE.filter(x=>x.watch);
  $("wl-count").textContent=WL.length+" mã";
  $("wl").innerHTML=WL.map(x=>{const m=M[x.s],ch=(m.lastU-m.refU)/m.refU*100,c=cls(m,m.lastU);
    return `<button class="wl-row" data-sym="${x.s}" aria-pressed="${x.s===S.sym}">
      <span class="wl-sym">${x.s}</span><span class="wl-px ${c}" data-px="${x.s}">${fP(m.lastU)}</span>
      <span class="wl-name">${x.name}</span><span class="wl-ch ${c}" data-ch="${x.s}">${(ch>=0?"+":"")+ch.toFixed(2)}%</span></button>`;}).join("");
}
function updateWLPrices(){
  UNIVERSE.forEach(x=>{const m=M[x.s],c=cls(m,m.lastU),ch=(m.lastU-m.refU)/m.refU*100,px=document.querySelector(`[data-px="${x.s}"]`),cc=document.querySelector(`[data-ch="${x.s}"]`);
    if(!px) return; if(px.textContent!==fP(m.lastU)){px.textContent=fP(m.lastU);px.parentElement.classList.remove("flash");void px.offsetWidth;px.parentElement.classList.add("flash");}
    px.className="wl-px "+c; cc.className="wl-ch "+c; cc.textContent=(ch>=0?"+":"")+ch.toFixed(2)+"%";});
}
function renderHead(){
  const m=M[S.sym], ch=m.lastU-m.refU, c=cls(m,m.lastU);
  $("h-sym").textContent=m.s; $("h-name").textContent=`${m.name}, sàn ${m.ex}`;
  $("h-px").textContent=fP(m.lastU); $("h-px").className=c;
  $("h-ch").className=c; $("h-ch").textContent=`${ch>=0?"+":""}${(ch/100).toFixed(2)}  ${(ch>=0?"+":"")+(ch/m.refU*100).toFixed(2)}%`;
  $("h-ceil").textContent=fP(m.ceilU); $("h-ref").textContent=fP(m.refU); $("h-floor").textContent=fP(m.floorU);
  $("h-hl").innerHTML=`<span class="${cls(m,m.hiU)}">${fP(m.hiU)}</span> / <span class="${cls(m,m.loU)}">${fP(m.loU)}</span>`;
  $("h-vol").textContent=fN(m.vol);
}
function renderBook(){
  const m=M[S.sym], {asks,bids,real}=book(m);
  const mx=Math.max(1,...asks.map(a=>a.q||0),...bids.map(b=>b.q||0));
  $("ob-head-q").textContent = real ? "KL" : "So với giá khớp";
  const row=(o,k)=>`<button class="ob-row ${k}" data-fill="${o.u}" aria-label="Chọn giá ${fP(o.u)}"><span class="${cls(m,o.u)}">${fP(o.u)}</span>${o.q!=null?`<span class="bar" style="width:${o.q/mx*100}%"></span>`:""}<span class="q">${o.q!=null?fN(o.q):(P(o.u)-P(m.lastU)>=0?"+":"")+((o.u-m.lastU)/m.lastU*100).toFixed(2)+"%"}</span></button>`;
  const ch=(m.lastU-m.refU)/m.refU*100;
  $("ob").innerHTML=asks.slice().reverse().map(a=>row(a,"ask")).join("")+
    `<div class="ob-mid"><span class="${cls(m,m.lastU)}">${fP(m.lastU)}</span><small>${(ch>=0?"+":"")+ch.toFixed(2)}%</small></div>`+
    bids.map(b=>row(b,"bid")).join("");
  $("tape").innerHTML=m.tape.map(t=>`<div class="tape-row"><span>${t.t}</span><span class="${cls(m,t.u)}">${fP(t.u)}</span><span class="${t.side==="M"?"up":"down"}">${fN(t.q)}</span></div>`).join("");
}

/* ---------------- Lô chẵn / lô lẻ ----------------
   Bản sao của api/_lot.js cho phía trình duyệt (app.js là script thường, không import được file
   của máy chủ). Sửa ở đây thì sửa cả bên kia — máy chủ mới là nơi chặn thật, phần này chỉ để
   người dùng biết trước khi bấm.
   Lô chẵn là bội số 100; lô lẻ 1-99 và chỉ đi được bằng lệnh LO; giữa hai mức đó không có gì. */
const LO_CHAN=100;
const loHopLe=(q,t)=>Number.isInteger(q)&&q>0&&(q%LO_CHAN===0||(q<LO_CHAN&&t==="LO"));
function tachLo(q){
  if(!Number.isInteger(q)||q<=0) return [];
  const chan=Math.floor(q/LO_CHAN)*LO_CHAN, le=q-chan, ra=[];
  if(chan) ra.push({qty:chan,le:false});
  if(le) ra.push({qty:le,le:true});
  return ra;
}
const moTaTachLo=q=>{const p=tachLo(q);return p.length<2?null:
  `Tách thành ${p.length} lệnh: ${p.map(x=>`${fN(x.qty)} ${x.le?"(lô lẻ)":"(lô chẵn)"}`).join(" + ")}`;};

/* ---------------- Order ticket ---------------- */
const ticketPxU = () => S.type==="LO" ? S.pxU : M[S.sym].lastU; // MTL/ATO/ATC ước tính theo giá khớp gần nhất
/* Tài khoản thật: lấy đúng số DNSE báo là bán được. Cổ phiếu chưa về tài khoản vẫn nằm trong
   danh mục nhưng chưa bán được, và DNSE đã trừ sẵn phần đang treo lệnh bán. */
const banDuoc = s => (ACC.mode==="that"||ACC.mode==="shs") ? (ACC.hold[s]?.ban ?? 0) : (ACC.hold[s]?.qty||0) - pendingSellQty(s);
function maxQty(){
  const m=M[S.sym];
  if(S.side==="S") return banDuoc(S.sym);
  // KHÔNG làm tròn xuống bội số 100 nữa: tròn xuống thì 213 cổ hiện thành 200 và 13 cổ lẻ biến
  // mất khỏi màn hình, đúng chỗ người dùng muốn bán cho hết.
  const pu=P(ticketPxU()||m.lastU)*1000*(1+FEE); return Math.floor(ACC.cash/pu);
}
const pendingSellQty = s => ACC.orders.filter(o=>o.sym===s&&o.side==="S"&&o.status==="wait").reduce((a,o)=>a+o.qty,0);
function validate(){
  const m=M[S.sym], u=ticketPxU(), errs=[], warns=[];
  if(S.type==="LO"){
    if(!u) errs.push("Nhập giá đặt.");
    else{
      if(u>m.ceilU||u<m.floorU) errs.push(`Giá phải trong khoảng ${fP(m.floorU)} – ${fP(m.ceilU)}.`);
      else if(u%tickU(u,m.ex)) errs.push(`Giá chưa đúng bước giá ${tickU(u,m.ex)*10} đ.`);
    }
  }
  if(!S.qty||S.qty<=0) errs.push("Nhập khối lượng.");
  else if(!loHopLe(S.qty,S.type)){
    // Số lẻ ở giữa (vd 213) KHÔNG phải lỗi: hệ thống tự tách khi gửi. Chỉ lô lẻ đi kèm lệnh thị
    // trường mới là lỗi thật, vì sàn không nhận.
    if(S.qty<LO_CHAN) errs.push(`Lô lẻ (1–99 cổ phiếu) chỉ đặt được bằng lệnh LO, không dùng ${S.type}.`);
    else if(S.type!=="LO") errs.push(`${fN(S.qty)} không phải bội số của 100. Lệnh ${S.type} chỉ nhận lô chẵn.`);
    else warns.push(moTaTachLo(S.qty)+". Lô lẻ khớp ở sổ riêng nên có thể lâu hơn và giá kém hơn lô chẵn.");
  }
  else if(S.qty<LO_CHAN) warns.push("Lệnh lô lẻ khớp ở sổ riêng, không khớp với lô chẵn, nên có thể lâu hơn và giá kém hơn.");
  const mx=maxQty();
  if(S.qty>0 && S.qty>mx) errs.push(S.side==="B"?`Không đủ sức mua. Tối đa ${fN(Math.max(mx,0))} cổ phiếu.`:`Không đủ cổ phiếu để bán. Khả dụng ${fN(Math.max(mx,0))}.`);
  if(!errs.length && u){
    if(S.type==="LO"&&S.side==="B"&&u===m.ceilU) warns.push("Bạn đang mua đúng giá trần.");
    if(S.type==="LO"&&S.side==="S"&&u===m.floorU) warns.push("Bạn đang bán đúng giá sàn.");
    if(S.type==="LO"&&Math.abs(u-m.lastU)/m.lastU>.04) warns.push(`Giá đặt lệch ${(Math.abs(u-m.lastU)/m.lastU*100).toFixed(1)}% so với giá khớp gần nhất.`);
    if(P(u)*1000*S.qty>200_000_000) warns.push("Giá trị lệnh trên 200 triệu đồng.");
  }
  return {errs,warns};
}
function renderTicket(){
  const m=M[S.sym]; if(!m) return;
  if(S.pxU==null) S.pxU=m.lastU;
  document.querySelectorAll(".side-btn[data-side]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.side===S.side));
  document.querySelectorAll("[data-type]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.type===S.type));
  const pxIn=$("f-px"); pxIn.disabled=S.type!=="LO";
  if(document.activeElement!==pxIn) pxIn.value = S.type==="LO" ? (S.pxU?fP(S.pxU):"") : S.type;
  if(document.activeElement!==$("f-qty")) $("f-qty").value = S.qty?fN(S.qty):"";
  $("tick-note").textContent = S.type==="LO" ? `Bước giá ${tickU(S.pxU||m.lastU,m.ex)*10} đ` : "Khớp theo thị trường";
  // Sàn / TC / Trần bấm được để đặt luôn giá đó: ba mức này là thứ hay dùng nhất, mà trước đây
  // chỉ là chữ để đọc nên vẫn phải gõ tay hoặc bấm nút cộng trừ hàng chục lần.
  for(const [id,nhan,gia] of [["b-floor","Sàn",m.floorU],["b-ref","TC",m.refU],["b-ceil","Trần",m.ceilU]]){
    const b=$(id); b.textContent=`${nhan} ${fP(gia)}`; b.dataset.fill=gia;
    b.setAttribute("aria-label",`Đặt giá ${nhan.toLowerCase()} ${fP(gia)}`);
    // Cố ý KHÔNG khoá khi đang ở lệnh thị trường: bấm vào là chuyển về LO với đúng giá đó,
    // giống hệt khi bấm một mức trong sổ lệnh.
    b.setAttribute("aria-pressed",String(S.type==="LO"&&S.pxU===gia));
  }
  const mx=Math.max(maxQty(),0);
  // Chưa đăng nhập thì "Tối đa 0" là con số vô nghĩa, dễ hiểu nhầm là hết sức mua.
  $("max-note").textContent=ACC.user?`Tối đa ${fN(mx)}`:"";
  const u=ticketPxU(), val=u?P(u)*1000*S.qty:0;
  $("s-val").textContent=fVND(val); $("s-fee").textContent=fVND(val*FEE);
  $("s-tax-l").style.display=$("s-tax").style.display=S.side==="S"?"":"none"; $("s-tax").textContent=fVND(val*TAX);
  // Còn lại SAU lệnh này. Đây mới là con số chặn người ta đặt quá tay: nhìn sức mua hiện tại thì
  // vẫn phải tự trừ nhẩm, mà trừ nhẩm lúc thị trường đang chạy là lúc dễ sai nhất.
  const nhanConLai=$("s-left-l"), oConLai=$("s-left"), hienConLai=ACC.user&&S.qty>0;
  nhanConLai.style.display=oConLai.style.display=hienConLai?"":"none";
  if(hienConLai){
    if(S.side==="B"){ const sau=ACC.cash-val-val*FEE;
      nhanConLai.textContent="Sức mua còn lại"; oConLai.textContent=fVND(sau);
      oConLai.className=sau<0?"down":"";
    } else { const sau=Math.max(banDuoc(S.sym),0)-S.qty;
      nhanConLai.textContent=`Còn lại ${m.s}`; oConLai.textContent=fN(sau)+" CP";
      oConLai.className=sau<0?"down":"";
    }
  }
  $("a-pp").textContent=ACC.user?fVND(ACC.cash):"Đăng nhập để xem"; $("a-sell").textContent=ACC.user?fN(Math.max(banDuoc(S.sym),0))+" CP":"–";
  const {errs,warns}=validate();
  $("msgs").innerHTML=errs.map(e=>`<div class="msg err">${e}</div>`).join("")+warns.map(w=>`<div class="msg warn">${w}</div>`).join("");
  const cta=$("cta"); cta.className="cta "+(S.side==="B"?"buy":"sell");
  if(!ACC.user){ cta.disabled=false; cta.textContent="Đăng nhập để đặt lệnh"; $("msgs").innerHTML=""; return; }
  cta.disabled=!!errs.length; cta.textContent=`${S.side==="B"?"Mua":"Bán"} ${m.s}`;
}
function flip(open){
  const card=$("card"), was=card.classList.contains("flipped"); card.classList.toggle("flipped",open);
  card.querySelector(".front").setAttribute("aria-hidden",open); card.querySelector(".back").setAttribute("aria-hidden",!open);
  if(open){
    const m=M[S.sym], u=ticketPxU(), val=P(u)*1000*S.qty, {warns}=validate(), sideT=S.side==="B"?"Mua":"Bán";
    const phan=tachLo(S.qty), tach2=phan.length>1;
    $("c-title").innerHTML=`${sideT} <span class="${S.side==="B"?"up":"down"}">${fN(S.qty)}</span> ${m.s}<br>${S.type==="LO"?"giá "+fP(u):"lệnh "+S.type}`;
    // Tách lệnh phải hiện Ở ĐÂY, trước khi bấm gửi: gửi hai lệnh mà người dùng tưởng một là
    // chuyện phải biết trước, không phải chuyện đọc lại trong sổ lệnh.
    $("c-grid").innerHTML=(tach2?`<span>Số lệnh gửi đi</span><b>${phan.length} lệnh · ${phan.map(x=>fN(x.qty)+(x.le?" lẻ":"")).join(" + ")}</b>`:"")
      +`<span>Loại lệnh</span><b>${S.type}</b><span>Giá trị ${S.type==="LO"?"":"(ước tính)"}</span><b>${fVND(val)}</b><span>Phí</span><b>${fVND(val*FEE)}</b>`+
      (S.side==="S"?`<span>Thuế</span><b>${fVND(val*TAX)}</b>`:"")+`<span>Tài khoản</span><b>${ACC.mode==="that"?`DNSE thật · ${ACC.accountNo||""}`:ACC.mode==="shs"?`SHS thật · ${ACC.accountNo||""}`:"Giao dịch thử (tiền ảo)"}</b>`;
    $("c-msgs").innerHTML=warns.map(w=>`<div class="msg warn">${w}</div>`).join("");
    const ok=$("c-ok"); ok.className="cta "+(S.side==="B"?"buy":"sell");
    ok.textContent=tach2?`Gửi ${phan.length} lệnh ${sideT.toLowerCase()}`:`Gửi lệnh ${sideT.toLowerCase()}`;
    setTimeout(()=>ok.focus({preventScroll:true}),300);
  } else if(was) setTimeout(()=>$("cta").focus({preventScroll:true}),300);
}
/* ---------------- Tài khoản trên server ---------------- */
const needLogin = () => { toast("Đăng nhập để đặt lệnh và lưu danh mục."); document.getElementById("btn-login")?.click(); };
function applyAccount(d){
  const old=new Map(ACC.orders.map(o=>[o.id,o.status]));
  ACC.cash=Number(d.cash)||0;
  ACC.hold=Object.fromEntries((d.holdings||[]).map(h=>[h.symbol,{qty:h.qty,avg:Number(h.avg)}]));
  ACC.orders=(d.orders||[]).map(o=>({id:o.id,time:new Date(o.created_at).toTimeString().slice(0,8),sym:o.symbol,side:o.side,type:o.type,
    u:o.price!=null?U(Number(o.price)):null,qty:o.qty,filled:o.filled,status:o.status,avgU:o.avg_price!=null?U(Number(o.avg_price)):null}));
  ACC.orders.forEach(o=>{ if(old.get(o.id)==="wait"&&o.status==="ok") toast(`Lệnh ${o.side==="B"?"mua":"bán"} ${fN(o.qty)} ${o.sym} đã khớp giá ${fP(o.avgU)}.`); });
}
/* ---- Tài khoản DNSE THẬT ----
   Đổ về đúng khuôn của ACC để toàn bộ phiếu lệnh, sổ lệnh và danh mục dùng lại được y nguyên.
   DNSE trả giá khi theo đồng khi theo nghìn đồng, nên quy về nghìn đồng như bảng giá. */
const kGia = v => { const n=Number(v); return Number.isFinite(n) ? (n>1000?n/1000:n) : null; };
const TRANG_THAI_DNSE = {Filled:"ok", PartiallyFilled:"wait", Pending:"wait", PendingNew:"wait", New:"wait",
  Queued:"wait", Cancelled:"cx", Canceled:"cx", Expired:"cx", Rejected:"rej"};

function applyReal(d){
  const old=new Map(ACC.orders.map(o=>[o.id,o.status]));
  ACC.accountNo=d.account||null;
  ACC.dsTieuKhoan=(d.accounts||[]).map(a=>a.id).filter(Boolean);
  ACC.otp=!!d.trading?.active;
  ACC.maxOrderVnd=Number(d.maxOrderVnd)||0;
  ACC.cash=Number(d.balance?.stock?.availableCash ?? d.balance?.stock?.totalCash) || 0;

  const dsVT=(Array.isArray(d.positions)?d.positions:d.positions?.deals||d.positions?.positions||[])||[];
  const gom=new Map();
  for(const p of dsVT){
    const q=Number(p.openQuantity ?? p.accumulateQuantity ?? p.quantity)||0; if(!q) continue;
    const ban=Number(p.availableSellQuantity ?? p.tradeQuantity ?? q)||0;
    const g=gom.get(p.symbol)||{qty:0,ban:0,von:0,vonQty:0};
    g.qty+=q; g.ban+=ban;
    const gv=kGia(p.costPrice); if(gv!=null){ g.von+=gv*q; g.vonQty+=q; }
    gom.set(p.symbol,g);
  }
  // `ban` giữ riêng: cổ phiếu chưa về tài khoản thì có trong danh mục nhưng chưa bán được.
  ACC.hold=Object.fromEntries([...gom].map(([s,g])=>[s,{qty:g.qty,ban:g.ban,avg:g.vonQty?g.von/g.vonQty:0}]));

  const dsL=(Array.isArray(d.orders)?d.orders:d.orders?.orders||d.orders?.data||[])||[];
  ACC.orders=dsL.map(o=>{
    const gia=kGia(o.price), khop=kGia(o.averagePrice ?? o.avgPrice ?? o.matchPrice);
    return {id:String(o.id), time:new Date(o.createdDate||o.transTime||Date.now()).toTimeString().slice(0,8),
      sym:o.symbol, side:String(o.side)==="NS"?"S":"B", type:o.orderType||"LO",
      u:gia!=null?U(gia):null, qty:Number(o.quantity)||0, filled:Number(o.fillQuantity)||0,
      status:TRANG_THAI_DNSE[o.orderStatus]||"wait", avgU:khop!=null?U(khop):null};
  });
  ACC.orders.forEach(o=>{ if(old.get(o.id)==="wait"&&o.status==="ok") toast(`Lệnh ${o.side==="B"?"mua":"bán"} ${fN(o.qty)} ${o.sym} đã khớp giá ${fP(o.avgU)}.`); });
}

/* ---- Tai khoan SHS THAT ----
   SHS tra so lieu bang DONG va ten truong khac han DNSE, nen quy ve dung khuon ACC o day mot lan;
   doi lai phieu lenh, so lenh va danh muc khong phai biet minh dang o cong ty chung khoan nao. */
const TRANG_THAI_SHS={"2":"ok","1":"wait","4":"cx","5":"cx","6":"rej","7":"rej"};
function applyShs(d){
  const old=new Map(ACC.orders.map(o=>[o.id,o.status]));
  ACC.accountNo=d.sub||null;
  ACC.dsTieuKhoan=(d.accounts||[]).filter(a=>a.type==="EQUITY").map(a=>a.sub).filter(Boolean);
  ACC.otp=true;                                   // phien SHS da qua the ma tran moi ton tai
  ACC.maxOrderVnd=Number(d.maxOrderVnd)||0;
  ACC.cash=Number(d.cash?.buyingPower ?? d.cash?.depositAmount)||0;

  const dsVT=Array.isArray(d.positions)?d.positions:(d.positions?.data||[]);
  ACC.hold=Object.fromEntries(dsVT.map(p=>{
    const qty=Number(p.balanceQuantity ?? p.quantity)||0;
    // Co phieu chua ve tai khoan van nam trong danh muc nhung chua ban duoc: giu rieng `ban`.
    const ban=Number(p.sellableQuantity ?? qty)||0;
    const von=Number(p.avgPrice ?? p.costPrice)||0;
    return [p.stockCode||p.symbol,{qty,ban,avg:von>1000?von/1000:von}];
  }).filter(([k,v])=>k&&v.qty));

  const dsL=Array.isArray(d.orders)?d.orders:(d.orders?.data||[]);
  ACC.orders=dsL.map(o=>{
    const gia=Number(o.orderPrice ?? o.ordPrice)||0, khop=Number(o.matchedPrice ?? o.mthPri)||0;
    return {id:String(o.orderNumber ?? o.ordNo ?? ""),
      time:String(o.orderTime ?? o.ordTime ?? "").slice(0,8),
      sym:o.stockCode ?? o.symbol, side:String(o.sellBuyType ?? "").toUpperCase().startsWith("S")?"S":"B",
      type:o.orderType ?? o.ordType ?? "LO",
      u:gia?U(gia/1000):null, qty:Number(o.orderQuantity ?? o.ordQty)||0,
      filled:Number(o.matchedQuantity ?? o.mthQty)||0,
      status:TRANG_THAI_SHS[String(o.orderStatus ?? o.ordStatus)]||"wait",
      avgU:khop?U(khop/1000):null};
  }).filter(o=>o.id);
  ACC.orders.forEach(o=>{ if(old.get(o.id)==="wait"&&o.status==="ok") toast(`Lệnh ${o.side==="B"?"mua":"bán"} ${fN(o.qty)} ${o.sym} đã khớp giá ${fP(o.avgU)}.`); });
}

let accTimer=null, accBusy=false;
async function refreshAccount(){
  if(!ACC.user||accBusy) return; accBusy=true;
  try{
    if(!ACC.daDo) await doTaiKhoanThat();   // lần dò trước chưa có câu trả lời thì hỏi lại
    if(ACC.mode==="that"){
      // Giữ đúng tiểu khoản đang chọn: tiền nằm ở tiểu khoản nào thì chỉ đặt lệnh được ở đó
      const q=ACC.accountNo?"?account="+encodeURIComponent(ACC.accountNo):"";
      const r=await fetch("/api/dnse/account"+q); const d=await r.json();
      if(r.ok){ applyReal(d); }
      else if(r.status===403||r.status===401){ ACC.coThat=false; ACC.mode="ao"; }   // mất quyền thì lui về tiền ảo
      else { ACC.cash=0; ACC.hold={}; ACC.orders=[]; }
    } else if(ACC.mode==="shs"){
      const q=ACC.accountNo?"?sub="+encodeURIComponent(ACC.accountNo):"";
      const r=await fetch("/api/shs/account"+q); const d=await r.json();
      if(r.ok){ applyShs(d); }
      // 401 o day la phien SHS het han chu khong phai mat quyen: lui ve tien ao va bao ro o thanh
      // trang thai, de nguoi dung biet phai ket noi lai chu khong ngoi doi.
      else if(r.status===403||r.status===401){ ACC.coShs=false; ACC.mode=ACC.coThat?"that":"ao"; }
      else { ACC.cash=0; ACC.hold={}; ACC.orders=[]; }
    } else {
      const r=await fetch("/api/me"); const d=await r.json();
      if(!d.user){ ACC.user=null; return resetAccount(); }
      applyAccount(d);
    }
    renderAcctSwitch(); renderTicket(); renderPanel();
  }catch(e){ /* lỗi mạng tạm thời: giữ số liệu cũ */ } finally{ accBusy=false; }
}

/* Ai đã nối DNSE thì mặc định vào tài khoản thật - đó là thứ người ta vào đây để xem.
   Chỉ coi là đã dò xong khi NHẬN ĐƯỢC câu trả lời. Trước đây một lỗi thoáng qua lúc đăng nhập
   (tunnel chớp một nhịp, /api/brokers trả 503) là ghim luôn phiên đó vào tiền ảo cho tới khi tải
   lại trang, vì hàm này chỉ chạy đúng một lần. Giờ chưa có câu trả lời thì lần làm mới sau hỏi lại. */
async function doTaiKhoanThat(){
  try{
    const r=await fetch("/api/brokers");
    if(!r.ok && r.status!==403 && r.status!==401) return;   // lỗi tạm thời: chưa kết luận, để hỏi lại
    const d=await r.json();
    ACC.coThat=!!d.owner; ACC.daDo=true;
    // SHS chi dat duoc lenh khi DA KET NOI phien (qua the ma tran OTP). Chua noi thi giau han nut,
    // vi bam vao chi de nhan loi 401 thi khong giup duoc gi.
    const shs=(d.brokers||[]).find(b=>b.id==="shs");
    ACC.coShs=!!(shs&&shs.connected&&shs.can&&shs.can.trade);
    if(ACC.mode==="shs"&&!ACC.coShs) ACC.mode=ACC.coThat?"that":"ao";
  }catch(e){ return; }
  if(ACC.coThat && !ACC.tuChon) ACC.mode="that";            // người dùng đã tự chọn thì tôn trọng
  renderAcctSwitch();
}
function renderTieuKhoan(){
  const sel=$("acct-sub"); if(!sel) return;
  const hien=ACC.user&&(ACC.mode==="that"||ACC.mode==="shs")&&ACC.dsTieuKhoan.length>1;
  sel.hidden=!hien;
  if(!hien) return;
  const can=ACC.dsTieuKhoan.map(id=>`<option value="${id}"${id===ACC.accountNo?" selected":""}>Tiểu khoản ${id}</option>`).join("");
  if(sel.innerHTML!==can) sel.innerHTML=can;
  sel.value=ACC.accountNo||"";
}

const LA_THAT=()=>ACC.mode==="that"||ACC.mode==="shs";
function renderAcctSwitch(){
  renderTieuKhoan();
  const f=$("foot-acct");
  if(f) f.textContent="Giá và biểu đồ lấy từ DNSE."+(!ACC.user?"" : LA_THAT()
    ? ` Màn Giao dịch đang dùng TÀI KHOẢN ${ACC.mode==="shs"?"SHS":"DNSE"} THẬT — lệnh gửi thẳng lên sàn.`
    : " Màn Giao dịch dùng tiền ảo để thử, không gửi lệnh tới công ty chứng khoán.");
  const box=$("acct-switch"); if(!box) return;
  box.hidden=!(ACC.user&&(ACC.coThat||ACC.coShs));
  // Nút SHS chỉ hiện khi đã kết nối được phiên SHS; chưa nối thì bấm vào chỉ nhận lỗi.
  const bShs=box.querySelector('[data-acct="shs"]'); if(bShs) bShs.hidden=!ACC.coShs;
  const bDnse=box.querySelector('[data-acct="that"]'); if(bDnse) bDnse.hidden=!ACC.coThat;
  box.querySelectorAll("[data-acct]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.acct===ACC.mode)));
  const w=$("a-which"); if(!w) return;
  w.className="acct-which"+(LA_THAT()?" that":"");
  // Nói rõ VÌ SAO đang ở tiền ảo. Để trống thì người dùng thấy sức mua 500 triệu không có thật mà
  // không biết tại sao mình không vào được tài khoản thật.
  w.textContent=!ACC.user?"":ACC.mode==="shs"
    ? (ACC.accountNo?`Tài khoản SHS thật · tiểu khoản ${ACC.accountNo}`:"Tài khoản SHS thật")
    : ACC.mode==="that"
    ? (ACC.accountNo?`Tài khoản DNSE thật · ${ACC.accountNo}`+(ACC.otp?"":" · chưa xác thực OTP"):"Tài khoản DNSE thật")
    : !ACC.daDo ? "Tiền ảo · đang kiểm tra kết nối công ty chứng khoán…"
    : !ACC.coThat&&!ACC.coShs ? "Tiền ảo · tài khoản này chưa nối công ty chứng khoán nào"
    : "Tiền ảo, không gửi lệnh tới công ty chứng khoán";
}
function resetAccount(){ ACC.cash=0; ACC.hold={}; ACC.orders=[]; renderTicket(); renderPanel(); }
document.addEventListener("lb:user",async e=>{
  ACC.user=e.detail||null; clearInterval(accTimer);
  if(!ACC.user){ ACC.coThat=false; ACC.daDo=false; ACC.tuChon=false; ACC.mode="ao"; renderAcctSwitch(); return resetAccount(); }
  await doTaiKhoanThat();
  refreshAccount(); accTimer=setInterval(refreshAccount,10000);
});

/* Lệnh THẬT đi hai bước, không có đường tắt: xem trước để máy chủ kiểm trần/sàn, sức mua và hạn
   mức rồi cấp một mã xác nhận ký sẵn (90 giây); bước gửi dùng ĐÚNG lệnh trong mã đó, không lấy lại
   từ trình duyệt. Nhờ vậy nội dung không đổi được giữa hai bước. */
async function guiDnse(qty){
  const m=M[S.sym], u=ticketPxU();
  const than={account:ACC.accountNo,symbol:m.s,side:S.side,type:S.type,qty,...(S.type==="LO"?{price:P(u)}:{})};
  const rx=await fetch("/api/dnse/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({step:"preview",...than})});
  const dx=await rx.json();
  if(!rx.ok) return {ok:false,loi:dx.error||"Không xem trước được lệnh.",dung:true};
  const rp=await fetch("/api/dnse/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({step:"place",confirm:dx.confirm})});
  const dp=await rp.json();
  if(!rp.ok){
    const them=dp.code==="need_otp"?' Mở tab <b>Khách hàng</b> để xác thực OTP DNSE (phiên sống 8 giờ).':"";
    return {ok:false,loi:(dp.error||"Không gửi được lệnh.")+them,dung:true,chuaRo:dp.code==="unknown"};
  }
  return {ok:true,nhan:dp.order?.id?"#"+dp.order.id:"",canhBao:dx.canhBao};
}

/* Lệnh SHS đi đúng hai bước như DNSE. Khác một chỗ đáng nhớ: SHS KHÔNG có bước OTP riêng —
   chính phiên đã qua thẻ ma trận lúc kết nối mới cho đặt lệnh, hết hạn thì phải kết nối lại. */
async function guiShs(qty){
  const m=M[S.sym], u=ticketPxU();
  const than={sub:ACC.accountNo,symbol:m.s,side:S.side,type:S.type,qty,...(S.type==="LO"?{price:P(u)}:{})};
  const rx=await fetch("/api/shs/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({step:"preview",...than})});
  const dx=await rx.json();
  if(!rx.ok) return {ok:false,loi:dx.error||"Không xem trước được lệnh.",dung:true};
  const rp=await fetch("/api/shs/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({step:"place",confirm:dx.confirm})});
  const dp=await rp.json();
  if(!rp.ok){
    const them=dp.code==="shs_expired"?' Mở tab <b>Khách hàng</b> &gt; Tài khoản chứng khoán để kết nối lại SHS.':"";
    return {ok:false,loi:(dp.error||"Không gửi được lệnh.")+them,dung:true,chuaRo:dp.code==="unknown"};
  }
  return {ok:true,nhan:dp.order?.orderNumber?"#"+dp.order.orderNumber:"",canhBao:dx.canhBao};
}

async function guiAo(qty){
  const m=M[S.sym], u=ticketPxU();
  const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({symbol:m.s,side:S.side,type:S.type,qty,...(S.type==="LO"?{price:P(u)}:{})})});
  const d=await r.json();
  if(!r.ok) return {ok:false,loi:d.error||"Không đặt được lệnh.",dung:true};
  return {ok:true,nhan:"",khop:d.order.status==="ok"};
}

/* Gửi lệnh. Khối lượng lẻ (vd 213) được TÁCH thành lô chẵn 200 rồi lô lẻ 13, gửi lần lượt — sàn
   không nhận một lệnh 213. Lô chẵn đi trước vì đó là phần lớn tiền và là phần khớp nhanh.

   Quy tắc dừng: lệnh nào hỏng là DỪNG, không gửi tiếp phần còn lại. Nhất là khi phần đầu trả về
   "không rõ đã vào sàn chưa" — lúc đó gửi tiếp phần hai là có thể thành đặt gấp đôi. Thà để người
   dùng mở sổ lệnh kiểm tra rồi tự đặt nốt phần còn thiếu. */
async function placeOrder(){
  if(!ACC.user) return needLogin();
  const m=M[S.sym], ok=$("c-ok");
  ok.disabled=true; $("c-msgs").innerHTML="";
  const gui=ACC.mode==="that"?guiDnse:ACC.mode==="shs"?guiShs:guiAo;
  const noi=ACC.mode==="that"?" lên DNSE":ACC.mode==="shs"?" lên SHS":"";
  const phan=tachLo(S.qty), xong=[];
  try{
    for(let k=0;k<phan.length;k++){
      const p=phan[k];
      if(phan.length>1) $("c-msgs").innerHTML=`<div class="msg warn">Đang gửi lệnh ${k+1}/${phan.length}: ${fN(p.qty)} ${p.le?"lô lẻ":"lô chẵn"}…</div>`;
      const r=await gui(p.qty);
      if(r.ok){ xong.push({...p,nhan:r.nhan,khop:r.khop}); if(r.canhBao&&phan.length===1) $("c-msgs").innerHTML=`<div class="msg warn">${r.canhBao}</div>`; continue; }
      // Hỏng: báo rõ phần nào đã đi, phần nào chưa, rồi dừng hẳn.
      const daGui=xong.length?`Đã gửi ${xong.map(x=>fN(x.qty)+(x.nhan?" "+x.nhan:"")).join(" và ")}. `:"";
      const conLai=phan.slice(k).reduce((a,x)=>a+x.qty,0);
      $("c-msgs").innerHTML=`<div class="msg err">${daGui}${r.loi}`
        +(phan.length>1&&!r.chuaRo?` Còn ${fN(conLai)} ${m.s} CHƯA gửi.`:"")
        +(r.chuaRo?" Mở sổ lệnh kiểm tra trước khi làm gì tiếp.":"")+"</div>";
      await refreshAccount();
      return;
    }
    const tong=xong.reduce((a,x)=>a+x.qty,0), khop=xong.every(x=>x.khop);
    toast(xong.length>1
      ? `Đã gửi ${xong.length} lệnh ${S.side==="B"?"mua":"bán"} ${m.s}${noi}: ${xong.map(x=>fN(x.qty)+(x.le?" lẻ":"")).join(" + ")}.`
      : `Đã gửi lệnh ${S.side==="B"?"mua":"bán"} ${fN(tong)} ${m.s}${noi}${xong[0]?.nhan?" ("+xong[0].nhan+")":""}${ACC.mode==="ao"&&khop?" và khớp ngay":""}.`
        +(ACC.mode==="ao"&&!khop&&MKT.session==="closed"?" Thị trường đang đóng cửa, lệnh chờ đến phiên sau.":""));
    flip(false); await refreshAccount();
  }catch(e){ $("c-msgs").innerHTML='<div class="msg err">Mất kết nối, thử lại. Mở sổ lệnh kiểm tra xem lệnh đã đi chưa.</div>'; }
  finally{ ok.disabled=false; }
}
async function cancelOrder(id){
  try{
    let url="/api/orders?id="+id;
    if(ACC.mode==="that") url=`/api/dnse/orders?account=${encodeURIComponent(ACC.accountNo||"")}&id=${encodeURIComponent(id)}`;
    else if(ACC.mode==="shs"){
      // SHS doi gui lai ca noi dung lenh khi huy, khong chi so hieu: lay tu so lenh dang hien.
      const o=ACC.orders.find(x=>x.id===String(id));
      if(!o) return toast("Không tìm thấy lệnh trong sổ, tải lại trang rồi thử lại.");
      url="/api/shs/orders?"+new URLSearchParams({sub:ACC.accountNo||"",orderNumber:String(id),
        symbol:o.sym,side:o.side==="S"?"SELL":"BUY",type:o.type,price:String(o.u!=null?Math.round(P(o.u)*1000):0),qty:String(o.qty)});
    }
    const r=await fetch(url,{method:"DELETE"}), d=await r.json();
    if(!r.ok) return toast(d.error||"Không hủy được lệnh.");
    toast("Đã hủy lệnh."); await refreshAccount();
  }catch(e){ toast("Mất kết nối, thử lại."); }
}

/* ---------------- Bottom panel ---------------- */
function renderPanel(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===S.tab));
  const body=$("tab-body");
  if(S.tab==="orders"){
    if(!ACC.orders.length){ body.innerHTML=`<div class="empty"><b>${ACC.user?"Chưa có lệnh nào":"Đăng nhập để xem sổ lệnh"}</b>${ACC.user?"Đặt lệnh ở khung bên phải, lệnh sẽ hiện ở đây kèm trạng thái khớp.":"Sổ lệnh và danh mục được lưu theo tài khoản của bạn."}</div>`; return; }
    const st={wait:'<span class="pill wait">Chờ khớp</span>',ok:'<span class="pill ok">Đã khớp</span>',cx:'<span class="pill cx">Đã hủy</span>',rej:'<span class="pill cx">Bị từ chối</span>'};
    body.innerHTML=`<table><thead><tr><th>Giờ</th><th>Mã</th><th>Lệnh</th><th>Loại</th><th class="r">Giá đặt</th><th class="r">KL</th><th class="r">Đã khớp</th><th class="r">Giá khớp</th><th>Trạng thái</th><th></th></tr></thead><tbody>`+
      ACC.orders.map(o=>`<tr><td>${o.time}</td><td><b>${o.sym}</b></td><td class="${o.side==="B"?"up":"down"}">${o.side==="B"?"Mua":"Bán"}</td><td>${o.type}</td>
        <td class="r">${o.type==="LO"?fP(o.u):o.type}</td><td class="r">${fN(o.qty)}</td><td class="r">${fN(o.filled)}</td><td class="r">${o.avgU?fP(o.avgU):"–"}</td>
        <td>${st[o.status]}</td><td>${o.status==="wait"?`<button class="link" data-cancel="${o.id}">Hủy</button>`:""}</td></tr>`).join("")+`</tbody></table>`;
  } else if(S.tab==="pos"){
    const rows=Object.entries(ACC.hold);
    if(!rows.length){ body.innerHTML=`<div class="empty"><b>${ACC.user?"Danh mục đang trống":"Đăng nhập để xem danh mục"}</b>Cổ phiếu bạn mua sẽ hiện ở đây cùng lãi lỗ theo giá thị trường.</div>`; return; }
    body.innerHTML=`<table><thead><tr><th>Mã</th><th class="r">KL</th><th class="r">Giá vốn</th><th class="r">Giá TT</th><th class="r">Giá trị</th><th class="r">Lãi/lỗ</th><th class="r">%</th></tr></thead><tbody>`+
      rows.map(([s,h])=>{const m=M[s],px=P(m.lastU),pl=(px-h.avg)*1000*h.qty,pct=(px-h.avg)/h.avg*100,c=pl>=0?"up":"down";
        return `<tr><td><button class="link" data-sym="${s}">${s}</button></td><td class="r">${fN(h.qty)}</td><td class="r">${h.avg.toFixed(2)}</td><td class="r ${cls(m,m.lastU)}">${fP(m.lastU)}</td><td class="r">${fVND(px*1000*h.qty)}</td><td class="r ${c}">${(pl>=0?"+":"")+fN(pl)}</td><td class="r ${c}">${(pct>=0?"+":"")+pct.toFixed(2)}%</td></tr>`}).join("")+`</tbody></table>`;
  } else {
    body.innerHTML=`<div id="sym-brief"></div>`;
    document.dispatchEvent(new CustomEvent("lb:brief",{detail:S.sym}));
  }
}

/* ---------------- Interactions ---------------- */
function selectSym(s){
  if(!M[s]) return; S.sym=s; S.pxU=M[s].lastU;
  document.querySelectorAll(".wl-row").forEach(r=>r.setAttribute("aria-pressed",r.dataset.sym===s));
  flip(false); renderHead(); renderBook(); renderTicket(); drawChart(true);
  if(S.tab==="brief") document.dispatchEvent(new CustomEvent("lb:brief",{detail:S.sym}));
}
document.addEventListener("click",e=>{
  const t=e.target.closest("button,a"); if(!t) return;
  if(t.matches(".nav a")){ e.preventDefault(); if(t.getAttribute("aria-disabled")==="true") toast(`${t.textContent} đang được xây, sẽ có ở bản sau.`); return; }
  if(t.dataset.sym) return selectSym(t.dataset.sym);
  if(t.dataset.tf){ S.tf=t.dataset.tf; document.querySelectorAll("[data-tf]").forEach(b=>b.setAttribute("aria-pressed",b===t)); return drawChart(true); }
  if(t.dataset.style){ S.style=t.dataset.style; document.querySelectorAll("[data-style]").forEach(b=>b.setAttribute("aria-pressed",b===t)); return applyChartToggles(); }
  if(t.dataset.ind){ S.ind[t.dataset.ind]=!S.ind[t.dataset.ind]; t.setAttribute("aria-pressed",S.ind[t.dataset.ind]); applyChartToggles(); return legend(shown[shown.length-1]); }
  if(t.dataset.acct){
    if(t.dataset.acct===ACC.mode) return;
    ACC.mode=t.dataset.acct; ACC.tuChon=true;
    // Xoá số của tài khoản cũ ngay, đừng để số dư tài khoản này nằm dưới nhãn tài khoản kia.
    // Tiểu khoản cũng phải xoá: số tiểu khoản DNSE đem sang SHS là vô nghĩa, và nếu giữ lại thì
    // lần nạp đầu tiên sẽ hỏi SHS về một tiểu khoản không tồn tại.
    ACC.cash=0; ACC.hold={}; ACC.orders=[]; ACC.accountNo=null; ACC.dsTieuKhoan=[];
    renderAcctSwitch(); renderTicket(); renderPanel();
    return refreshAccount();
  }
  if(t.dataset.side){ S.side=t.dataset.side; return renderTicket(); }
  if(t.dataset.type){ S.type=t.dataset.type; return renderTicket(); }
  if(t.dataset.fill){ S.type="LO"; S.pxU=+t.dataset.fill; return renderTicket(); }
  if(t.dataset.step){ const m=M[S.sym], d=+t.dataset.d;
    if(t.dataset.step==="px"&&S.type==="LO"){ const base=S.pxU||m.lastU; S.pxU=Math.min(m.ceilU,Math.max(m.floorU,roundTo(base,tickU(base,m.ex))+d*tickU(base+(d<0?-1:0),m.ex))); }
    // Cộng trừ 100 nhưng GIỮ phần lẻ: 213 -> 313, không nhảy về 300. Người có cổ phiếu lẻ muốn
    // thêm bớt một lô chứ không muốn bị làm tròn mất phần lẻ của mình.
    if(t.dataset.step==="qty") S.qty=Math.max(0,(S.qty||0)+d*100);
    return renderTicket(); }
  if(t.dataset.pct){
    const mx=Math.max(maxQty(),0), pc=+t.dataset.pct;
    // "Tối đa" lấy ĐÚNG số tối đa kể cả lẻ (để bán hết được); các mức dưới làm tròn về lô chẵn.
    S.qty=pc===100?mx:Math.floor(mx*pc/100/100)*100;
    return renderTicket();
  }
  if(t.id==="cta") return ACC.user?flip(true):needLogin();
  if(t.id==="c-back") return flip(false);
  if(t.id==="c-ok"){ const {errs}=validate(); if(errs.length){flip(false);renderTicket();return;} return placeOrder(); }
  if(t.dataset.tab){ S.tab=t.dataset.tab; return renderPanel(); }
  if(t.dataset.cancel) return cancelOrder(+t.dataset.cancel);
});
$("f-px").addEventListener("input",e=>{const v=parseFloat(e.target.value.replace(",","."));S.pxU=isNaN(v)?null:U(v);renderTicket();});
$("f-px").addEventListener("blur",renderTicket);
$("f-qty").addEventListener("input",e=>{const v=parseInt(e.target.value.replace(/[^\d]/g,""),10);S.qty=isNaN(v)?0:v;renderTicket();});
$("f-qty").addEventListener("blur",renderTicket);
$("search").addEventListener("keydown",e=>{ if(e.key!=="Enter") return; const s=e.target.value.trim().toUpperCase();
  if(M[s]){selectSym(s);e.target.value="";} else toast(`Chưa có mã ${s} trong bản demo.`); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&$("card").classList.contains("flipped")) flip(false); });
let toastT; function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),2600);}



const NAV_OF={advisory:"desk"};
const VIEWS={trade:["view-trade","#giao-dich"],desk:["view-desk","#khach-hang"],portal:["view-portal","#tai-khoan"],board:["view-board","#bang-gia"],advisory:["view-advisory","#tu-van"]};
let manDangMo="trade";
/* Trước đây hàm này mở đầu bằng `if(!UNIVERSE.length) return;` nên nguồn giá hỏng là CẢ THANH TAB
   chết: bấm tab nào cũng không có gì xảy ra, không một thông báo. Đúng chuyện đã xảy ra suốt 4 tiếng
   ngày 19/10/2026 khi /api/market trả 502. Vô lý ở chỗ Khách hàng, Tư vấn và Tài khoản của tôi không
   đọc giá, còn màn Giao dịch không có giá thì hiện khung rỗng kèm dòng trạng thái báo lỗi — vẫn tốt
   hơn là bấm không ăn. */
function setView(v, ghiLichSu=true){
  if(!VIEWS[v]) v="trade";
  manDangMo=v; Object.entries(VIEWS).forEach(([k,[id]])=>$(id).hidden=k!==v);
  const navV=NAV_OF[v]||v; // màn Tư vấn nằm trong mục "Khách hàng"
  document.querySelectorAll(".nav a[data-view]").forEach(a=>{if(a.dataset.view===navV)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  // Đổi màn là MỘT BƯỚC trong lịch sử trình duyệt. Trước đây chỗ này luôn replaceState, nên bấm
  // Quay lại không trả về màn trước mà nhảy thẳng ra khỏi trang — và vì không ai nghe popstate,
  // địa chỉ trên thanh đổi còn màn hình đứng im, hai bên nói hai đằng.
  const hash=VIEWS[v][1];
  if(location.hash!==hash){
    if(ghiLichSu&&history.pushState) history.pushState(null,"",hash);
    else if(history.replaceState) history.replaceState(null,"",hash);
  }
  document.dispatchEvent(new CustomEvent("lb:view",{detail:v}));
  window.scrollTo(0,0);
}

/* Quay lại / Tiến tới, và dán thẳng một địa chỉ có #… vào tab đang mở. Màn nào chưa mở cho người
   dùng này thì mục điều hướng của nó đang ẩn — bỏ qua, nếu không sẽ hiện ra một khung trắng. */
const VIEW_THEO_HASH=Object.fromEntries(Object.entries(VIEWS).map(([k,[,h]])=>[h,k]));
function dongBoTheoHash(){
  const v=VIEW_THEO_HASH[location.hash||"#giao-dich"];
  if(!v||v===manDangMo) return;
  const muc=document.querySelector(`.nav a[data-view="${NAV_OF[v]||v}"]`);
  if(muc&&muc.hidden) return;
  setView(v,false);
}
window.addEventListener("popstate",dongBoTheoHash);
window.addEventListener("hashchange",dongBoTheoHash);
/**
 * Mở một màn theo deep link, chờ app.js nạp xong nếu cần.
 * Dùng chung cho board/desk/portal/advisory: trước đây mỗi file tự viết một vòng chờ
 * `UNIVERSE.length` giống hệt nhau, và cả bốn đều kẹt vĩnh viễn khi nguồn giá hỏng.
 */
function openView(v, conLai=20){
  if(typeof setView==="function") return setView(v);
  if(conLai>0) setTimeout(()=>openView(v,conLai-1),250);
}

document.addEventListener("change", e=>{
  if(e.target.id==="acct-sub"){
    ACC.accountNo=e.target.value;
    ACC.cash=0; ACC.hold={}; ACC.orders=[];   // xoá số của tiểu khoản cũ ngay
    renderTicket(); renderPanel();
    refreshAccount();
  }
});

document.addEventListener("click",e=>{
  const t=e.target.closest("button,a"); if(!t) return;
  if(t.dataset.view){ e.preventDefault(); return setView(t.dataset.view); }
},true);

/* ---------------- Live loop ---------------- */
const SESSION_LABEL = {open:"Đang khớp lệnh liên tục", ato:"Khớp lệnh định kỳ mở cửa", atc:"Khớp lệnh định kỳ đóng cửa", closed:"Ngoài giờ giao dịch"};
const dmyFull = ymd => ymd.split("-").reverse().join("/");
function setStatus(err){
  const dot=document.querySelector(".statusbar .dot"), live=!err&&MKT.session!=="closed";
  dot.style.background = err?"var(--down)":live?"var(--up)":"var(--faint)";
  const ses = UNIVERSE.length ? M[UNIVERSE[0].s].session : null;
  $("session").textContent = err ? "Mất kết nối nguồn giá, đang thử lại"
    : `${SESSION_LABEL[MKT.session]}${ses?`, số liệu phiên ${dmyFull(ses)}`:""}, cập nhật ${new Date(MKT.asof).toTimeString().slice(0,8)}${MKT.session!=="closed"?(MKT.source==="ws"?" · DNSE realtime":MKT.source==="mixed"?" · realtime một phần":" · giá trễ khoảng 1 phút"):""}`;
}
function renderIndices(){
  $("indices").innerHTML=MKT.indices.map(i=>`<span class="idx"><b>${i.s}</b><span class="${i.pct>=0?"up":"down"}">${i.last.toFixed(2)} ${(i.pct>=0?"+":"")+i.pct.toFixed(2)}%</span></span>`).join("");
}
function tick(){
  const m=M[S.sym], last=shown[shown.length-1];
  if(S.tf==="D"){ candle.update({...m.today}); line.update({time:m.today.time,value:m.today.close});
    vol.update({time:m.today.time,value:m.today.value,color:m.today.close>=m.today.open?"rgba(46,189,133,.35)":"rgba(246,70,93,.35)"}); shown[shown.length-1]={...m.today}; legend(shown[shown.length-1]); }
  else if(last){ drawChart(false); }
  renderHead(); renderBook(); updateWLPrices(); renderTicket(); if(S.tab==="orders"||S.tab==="pos") renderPanel();
  document.dispatchEvent(new CustomEvent("lb:tick"));
}
async function poll(){
  try{
    const mk=await getJSON("/api/market");
    MKT.session=mk.session; MKT.asof=mk.asof; MKT.indices=mk.indices||MKT.indices; MKT.source=mk.source||"poll";
    MKT.all=mk.quotes;
    const stale=Object.values(mk.quotes).some(q=>M[q.s]&&!applyQuote(M[q.s],q));
    MKT.polledOnce=true;
    // Sang phiên mới thì nạp lại lịch sử, nhưng không quá 1 lần mỗi 20 giây (lịch sử được cache ở CDN)
    if(stale && Date.now()-(MKT.reloadedAt||0)>20000){ MKT.reloadedAt=Date.now(); await loadMarket(); renderWL(); selectSym(S.sym); }
    renderIndices(); setStatus(false); tick();
  }catch(e){ setStatus(true); }
}
function schedulePoll(){ setTimeout(async()=>{ await poll(); schedulePoll(); }, MKT.session==="closed"?30000:MKT.source==="ws"?2500:5000); }

async function boot(){
  try{ await loadMarket(); }
  catch(e){ $("session").textContent="Không kết nối được nguồn giá, đang thử lại"; setTimeout(boot,8000); return; }
  MKT.polledOnce=true;
  renderIndices(); renderWL(); selectSym(UNIVERSE.some(x=>x.s===S.sym)?S.sym:UNIVERSE[0].s); renderPanel(); setStatus(false);
  setInterval(tick, 2000); schedulePoll();
  // Hai địa chỉ của bản demo cũ: đưa về màn Giao dịch thay vì để trống.
  if(location.hash==="#cong-dong"||location.hash==="#tin-nhan") history.replaceState?.(null,"","#giao-dich");
}
boot();
