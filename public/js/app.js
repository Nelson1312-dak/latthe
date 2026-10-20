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
const ACC = {user:null, cash:0, hold:{}, orders:[], mode:'ao', coThat:false, daDo:false, tuChon:false, accountNo:null, otp:false, maxOrderVnd:0};
const FEE=.0015, TAX=.001;

/* ---------------- Formatting ---------------- */
const fP = u => P(u).toFixed(2);
const fN = n => Math.round(n).toLocaleString("vi-VN");
const fVND = n => fN(n)+" đ";
const fVol = n => n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n);
function cls(m,u){ if(u>=m.ceilU) return "ceil"; if(u<=m.floorU) return "floor"; if(u===m.refU) return "ref"; return u>m.refU?"up":"down"; }
const $ = id => document.getElementById(id);

/* ---------------- State ---------------- */
const S = {sym:"HPG", tf:"D", style:"candle", ind:{ma20:true,ma50:true,vol:true}, side:"B", type:"LO", pxU:null, qty:1000, tab:"orders"};

/* ---------------- Chart ---------------- */
const LWC = window.LightweightCharts;
const chart = LWC.createChart($("chart"),{
  autoSize:true,
  localization:{locale:"en-US",priceFormatter:p=>p.toFixed(2)},
  layout:{background:{type:"solid",color:"#000000"},textColor:"#8f8786",fontFamily:"Be Vietnam Pro, system-ui, sans-serif",fontSize:11},
  grid:{vertLines:{color:"#141212"},horzLines:{color:"#141212"}},
  crosshair:{mode:LWC.CrosshairMode.Normal,vertLine:{color:"#5e5756",labelBackgroundColor:"#b3122b"},horzLine:{color:"#5e5756",labelBackgroundColor:"#b3122b"}},
  rightPriceScale:{borderColor:"#262222"},
  timeScale:{borderColor:"#262222",rightOffset:6,barSpacing:7}
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

/* ---------------- Order ticket ---------------- */
const ticketPxU = () => S.type==="LO" ? S.pxU : M[S.sym].lastU; // MTL/ATO/ATC ước tính theo giá khớp gần nhất
/* Tài khoản thật: lấy đúng số DNSE báo là bán được. Cổ phiếu chưa về tài khoản vẫn nằm trong
   danh mục nhưng chưa bán được, và DNSE đã trừ sẵn phần đang treo lệnh bán. */
const banDuoc = s => ACC.mode==="that" ? (ACC.hold[s]?.ban ?? 0) : (ACC.hold[s]?.qty||0) - pendingSellQty(s);
function maxQty(){
  const m=M[S.sym];
  if(S.side==="S") return banDuoc(S.sym);
  const pu=P(ticketPxU()||m.lastU)*1000*(1+FEE); return Math.floor(ACC.cash/pu/100)*100;
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
  else if(S.qty%100) errs.push("Khối lượng phải là bội số của 100.");
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
  $("b-floor").textContent="Sàn "+fP(m.floorU); $("b-ref").textContent="TC "+fP(m.refU); $("b-ceil").textContent="Trần "+fP(m.ceilU);
  const mx=Math.max(maxQty(),0); $("max-note").textContent=`Tối đa ${fN(mx)}`;
  const u=ticketPxU(), val=u?P(u)*1000*S.qty:0;
  $("s-val").textContent=fVND(val); $("s-fee").textContent=fVND(val*FEE);
  $("s-tax-l").style.display=$("s-tax").style.display=S.side==="S"?"":"none"; $("s-tax").textContent=fVND(val*TAX);
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
    $("c-title").innerHTML=`${sideT} <span class="${S.side==="B"?"up":"down"}">${fN(S.qty)}</span> ${m.s}<br>${S.type==="LO"?"giá "+fP(u):"lệnh "+S.type}`;
    $("c-grid").innerHTML=`<span>Loại lệnh</span><b>${S.type}</b><span>Giá trị ${S.type==="LO"?"":"(ước tính)"}</span><b>${fVND(val)}</b><span>Phí</span><b>${fVND(val*FEE)}</b>`+
      (S.side==="S"?`<span>Thuế</span><b>${fVND(val*TAX)}</b>`:"")+`<span>Tài khoản</span><b>${ACC.mode==="that"?`DNSE thật · ${ACC.accountNo||""}`:"Giao dịch thử (tiền ảo)"}</b>`;
    $("c-msgs").innerHTML=warns.map(w=>`<div class="msg warn">${w}</div>`).join("");
    const ok=$("c-ok"); ok.className="cta "+(S.side==="B"?"buy":"sell"); ok.textContent=`Gửi lệnh ${sideT.toLowerCase()}`;
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

let accTimer=null, accBusy=false;
async function refreshAccount(){
  if(!ACC.user||accBusy) return; accBusy=true;
  try{
    if(!ACC.daDo) await doTaiKhoanThat();   // lần dò trước chưa có câu trả lời thì hỏi lại
    if(ACC.mode==="that"){
      const r=await fetch("/api/dnse/account"); const d=await r.json();
      if(r.ok){ applyReal(d); }
      else if(r.status===403||r.status===401){ ACC.coThat=false; ACC.mode="ao"; }   // mất quyền thì lui về tiền ảo
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
  }catch(e){ return; }
  if(ACC.coThat && !ACC.tuChon) ACC.mode="that";            // người dùng đã tự chọn thì tôn trọng
  renderAcctSwitch();
}
function renderAcctSwitch(){
  const f=$("foot-acct");
  if(f) f.textContent="Giá và biểu đồ lấy từ DNSE."+(!ACC.user?"" : ACC.mode==="that"
    ? " Màn Giao dịch đang dùng TÀI KHOẢN DNSE THẬT — lệnh gửi thẳng lên sàn."
    : " Màn Giao dịch dùng tiền ảo để thử, không gửi lệnh tới công ty chứng khoán.");
  const box=$("acct-switch"); if(!box) return;
  box.hidden=!(ACC.user&&ACC.coThat);
  box.querySelectorAll("[data-acct]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.acct===ACC.mode)));
  const w=$("a-which"); if(!w) return;
  w.className="acct-which"+(ACC.mode==="that"?" that":"");
  w.textContent=!ACC.user?"":ACC.mode==="that"
    ? (ACC.accountNo?`Tài khoản DNSE thật · ${ACC.accountNo}`+(ACC.otp?"":" · chưa xác thực OTP"):"Tài khoản DNSE thật")
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
async function datLenhThat(ok){
  const m=M[S.sym], u=ticketPxU();
  const than={account:ACC.accountNo,symbol:m.s,side:S.side,type:S.type,qty:S.qty,...(S.type==="LO"?{price:P(u)}:{})};
  const rx=await fetch("/api/dnse/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({step:"preview",...than})});
  const dx=await rx.json();
  if(!rx.ok){ $("c-msgs").innerHTML=`<div class="msg err">${dx.error||"Không xem trước được lệnh."}</div>`; return; }
  if(dx.canhBao) $("c-msgs").innerHTML=`<div class="msg warn">${dx.canhBao}</div>`;

  const rp=await fetch("/api/dnse/orders",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({step:"place",confirm:dx.confirm})});
  const dp=await rp.json();
  if(!rp.ok){
    const them=dp.code==="need_otp"?' Mở tab <b>Khách hàng</b> để xác thực OTP DNSE (phiên sống 8 giờ).':"";
    // 'unknown' = không rõ DNSE đã nhận chưa. Tuyệt đối không được mời người dùng bấm lại.
    $("c-msgs").innerHTML=`<div class="msg ${dp.code==="unknown"?"err":"err"}">${dp.error||"Không gửi được lệnh."}${them}</div>`;
    return;
  }
  toast(`Đã gửi lệnh ${S.side==="B"?"mua":"bán"} ${fN(S.qty)} ${m.s} lên DNSE${dp.order?.id?" (#"+dp.order.id+")":""}.`);
  flip(false); await refreshAccount();
}

async function placeOrder(){
  if(!ACC.user) return needLogin();
  const m=M[S.sym], u=ticketPxU(), ok=$("c-ok");
  ok.disabled=true; $("c-msgs").innerHTML="";
  try{
    if(ACC.mode==="that") return await datLenhThat(ok);
    const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({symbol:m.s,side:S.side,type:S.type,qty:S.qty,...(S.type==="LO"?{price:P(u)}:{})})});
    const d=await r.json();
    if(!r.ok){ $("c-msgs").innerHTML=`<div class="msg err">${d.error||"Không đặt được lệnh."}</div>`; return; }
    const filled=d.order.status==="ok";
    toast(`Đã gửi lệnh ${S.side==="B"?"mua":"bán"} ${fN(S.qty)} ${m.s}${filled?" và khớp ngay":""}.${!filled&&MKT.session==="closed"?" Thị trường đang đóng cửa, lệnh chờ đến phiên sau.":""}`);
    flip(false); await refreshAccount();
  }catch(e){ $("c-msgs").innerHTML='<div class="msg err">Mất kết nối, thử lại.</div>'; }
  finally{ ok.disabled=false; }
}
async function cancelOrder(id){
  try{
    const url=ACC.mode==="that"
      ? `/api/dnse/orders?account=${encodeURIComponent(ACC.accountNo||"")}&id=${encodeURIComponent(id)}`
      : "/api/orders?id="+id;
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
  } else if(S.tab==="brief"){
    body.innerHTML=`<div id="sym-brief"></div>`;
    document.dispatchEvent(new CustomEvent("lb:brief",{detail:S.sym}));
  } else {
    body.innerHTML=`<div class="empty"><b>Chưa có lệnh điều kiện</b>Lệnh dừng lỗ, chốt lời và lệnh xu hướng sẽ có ở bản tiếp theo, chạy trên engine lệnh điều kiện của DNSE.</div>`;
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
    // Xoá số của tài khoản cũ ngay, đừng để số dư tài khoản này nằm dưới nhãn tài khoản kia
    ACC.cash=0; ACC.hold={}; ACC.orders=[];
    renderAcctSwitch(); renderTicket(); renderPanel();
    return refreshAccount();
  }
  if(t.dataset.side){ S.side=t.dataset.side; return renderTicket(); }
  if(t.dataset.type){ S.type=t.dataset.type; return renderTicket(); }
  if(t.dataset.fill){ S.type="LO"; S.pxU=+t.dataset.fill; return renderTicket(); }
  if(t.dataset.step){ const m=M[S.sym], d=+t.dataset.d;
    if(t.dataset.step==="px"&&S.type==="LO"){ const base=S.pxU||m.lastU; S.pxU=Math.min(m.ceilU,Math.max(m.floorU,roundTo(base,tickU(base,m.ex))+d*tickU(base+(d<0?-1:0),m.ex))); }
    if(t.dataset.step==="qty") S.qty=Math.max(0,(Math.round((S.qty||0)/100)*100)+d*100);
    return renderTicket(); }
  if(t.dataset.pct){ S.qty=Math.floor(Math.max(maxQty(),0)*(+t.dataset.pct)/100/100)*100; return renderTicket(); }
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


/* ================= Cộng đồng ================= */
const ADMIN="admin_latbai", ME={h:"hien_latbai",role:"ctv"};
const CATS=[{id:"all",name:"Tất cả bài viết",desc:"Bài mới từ mọi chuyên mục và mã."},
  {id:"chung",name:"Thảo luận chung",desc:"Chuyện thị trường, kinh nghiệm, góc nhìn."},
  {id:"pttk",name:"Phân tích kỹ thuật",desc:"Chia sẻ phương pháp, chỉ báo và cách đọc biểu đồ."},
  {id:"vimo",name:"Vĩ mô và dòng tiền",desc:"Lãi suất, tỷ giá, khối ngoại và dòng tiền."},
  {id:"hoidap",name:"Hỏi đáp người mới",desc:"Hỏi gì cũng được, không có câu hỏi ngu."}];
const CSYMS=["HPG","FPT","SSI","VCB","MWG","DGC"];
let CID=100;
const P_=(a,role,ago,text,likes=0,extra={})=>({id:CID++,a,role,ago,text,likes,liked:false,...extra});
const THREADS=[
 {id:1,cat:"chung",pinned:true,tag:"Nội quy",title:"Nội quy cộng đồng: đọc trước khi đăng bài",replies:12,views:3400,
  posts:[P_(ADMIN,"admin",4320,"Chào mọi người. Vài quy tắc để cộng đồng sạch sẽ:\n1. Thảo luận dựa trên số liệu và lập luận, không hô hào mua bán.\n2. Ghi rõ nếu bạn đang nắm giữ mã mình viết (tick ô \"Tôi đang nắm giữ\" khi đăng bài).\n3. Không tung tin chưa kiểm chứng, không rủ góp vốn hay nhận ủy thác.\nBài vi phạm sẽ bị gỡ, tái phạm sẽ khóa tài khoản. Nội dung trên diễn đàn là ý kiến cá nhân, không phải khuyến nghị đầu tư.",64),
   P_("sonla_value",null,4100,"Rõ ràng, ủng hộ ad. Mong giữ được chất lượng như vậy.",11)]},
 {id:2,cat:"sym",sym:"HPG",tag:"Phân tích",title:"$HPG về quanh 20: điều gì đang kéo giá?",replies:46,views:1240,
  posts:[P_("thepdenhat",null,12,"Từ vùng 24-25 hồi tháng 4, $HPG lùi dần về quanh 20. MA20 nằm dưới MA50 từ khoảng tháng 7 và chưa lấy lại được. Thanh khoản mấy phiên gần đây cũng thấp hơn hẳn đợt tháng 3-4.\nCâu hỏi cho ae: lực bán hiện tại đến từ câu chuyện ngành thép, hay do dòng tiền rút khỏi nhóm vốn hóa lớn nói chung? Ai có số liệu tiêu thụ thép gần nhất thì chia sẻ kèm nguồn nhé.",37,{hold:true}),
   P_("sonla_value",null,9,"Mình nghiêng về dòng tiền. Mấy tuần nay cả rổ VN30 đều yếu chứ không riêng $HPG. Còn câu chuyện ngành thì phải chờ số liệu tiêu thụ quý 3 mới nói chắc được.",18),
   P_(ADMIN,"admin",7,"Topic tốt, giữ đúng tinh thần chia sẻ số liệu nhé. Nhắc nhẹ: bình luận kiểu \"múc đi ae\" sẽ bị ẩn.",9),
   P_("traderF0_2024",null,5,"Em mới vào, thấy giá rẻ hơn hồi tháng 4 nhiều thì có nên mua dần không ạ?",2),
   P_("thepdenhat",null,3,"@traderF0_2024 rẻ hơn giá cũ chưa chắc là rẻ. Bạn tự đặt trước mức chịu lỗ tối đa rồi hẵng tính, mình không khuyên mua hay bán đâu.",21,{hold:true})]},
 {id:3,cat:"sym",sym:"HPG",tag:"Hỏi đáp",title:"Ae nào theo dõi tiến độ Dung Quất 2 không?",replies:8,views:312,
  posts:[P_("minhquan_hp",null,95,"Muốn tìm nguồn cập nhật tiến độ dự án cho chuẩn, đọc trên group thấy mỗi người nói một kiểu. Ae hay theo dõi ở đâu?",4),
   P_("thepdenhat",null,80,"Nguồn chắc nhất vẫn là công bố thông tin và tài liệu họp nhà đầu tư của doanh nghiệp. Tin trên group thì nên đối chiếu lại.",7)]},
 {id:4,cat:"sym",sym:"FPT",tag:"Tin tức",title:"$FPT: gom tin mảng phần mềm nước ngoài 9 tháng",replies:22,views:870,
  posts:[P_("fpt_watch",null,180,"Mình gom lại các tin doanh nghiệp đã công bố liên quan mảng xuất khẩu phần mềm của $FPT để ae tiện theo dõi. Ai thấy thiếu thì bổ sung, nhớ kèm link nguồn.",15)]},
 {id:5,cat:"pttk",tag:"Chia sẻ",title:"Cách mình dùng MA20, MA50 cho cổ phiếu thanh khoản cao",replies:31,views:1580,
  posts:[P_("kythuat_9x",null,420,"Mình chỉ dùng hai đường: MA20 để xem xu hướng ngắn, MA50 làm nền. Giá nằm dưới cả hai và MA20 dưới MA50 thì mình đứng ngoài, không bắt đáy. Ví dụ đang thấy rõ trên chart $HPG mấy tháng nay.\nLưu ý: MA là chỉ báo trễ, chỉ hợp với mã thanh khoản tốt. Ae có cách lọc tín hiệu nhiễu nào hay thì chia sẻ.",42)]},
 {id:6,cat:"hoidap",tag:"Hỏi đáp",title:"Lệnh ATC khác lệnh LO thế nào? Hỏi hơi gà",replies:14,views:402,
  posts:[P_("nguoimoi_hn",null,55,"Mới mở tài khoản, thấy màn đặt lệnh có LO, MTL, ATO, ATC mà chưa hiểu khác nhau thế nào.",3),
   P_(ME.h,"ctv",40,"LO là lệnh giới hạn: bạn nhập giá cụ thể, khớp trong phiên liên tục nếu có đối ứng.\nATC chỉ đặt được trong đợt khớp lệnh định kỳ đóng cửa (14h30 đến 14h45 trên HOSE), không nhập giá, khớp tại giá đóng cửa. Trên màn Giao dịch bạn chọn ATC thì ô giá sẽ tự khóa lại.",12)]},
 {id:7,cat:"vimo",tag:"Thảo luận",title:"Khối ngoại bán ròng kéo dài, ae theo dõi chỉ số nào?",replies:19,views:760,
  posts:[P_("vimo_daily",null,240,"Mình đang theo dõi tỷ giá, lãi suất liên ngân hàng và giá trị bán ròng theo tuần. Ae có thêm chỉ số nào hữu ích không?",8)]},
 {id:8,cat:"sym",sym:"SSI",tag:"Thảo luận",title:"$SSI và nhóm chứng khoán khi thanh khoản thị trường giảm",replies:27,views:990,
  posts:[P_("ck_lover",null,600,"Nhóm chứng khoán nhạy với thanh khoản nhất. Thanh khoản đi xuống thì doanh thu môi giới và margin đều bị ảnh hưởng. Ae nhìn câu chuyện $SSI thế nào?",10)]},
 {id:9,cat:"sym",sym:"DGC",tag:"Hỏi đáp",title:"$DGC có ai đọc kỹ báo cáo thường niên chưa?",replies:5,views:150,
  posts:[P_("hoachat_fan",null,1500,"Đang đọc phần rủi ro trong báo cáo thường niên của $DGC, ai đọc rồi thì cùng trao đổi.",2)]}
];
const CHAT=[
 {a:ADMIN,role:"admin",ago:45,t:"Chào cả nhà, phòng chung mở đến 22h. Câu hỏi về tài khoản DNSE cứ nhắn, admin trả lời trong giờ hành chính."},
 {a:"sonla_value",ago:31,t:"Hôm nay thanh khoản thấp thật"},
 {a:"traderF0_2024",ago:24,t:"Ad ơi mở tài khoản DNSE qua web mình thì có được hỗ trợ gì không ạ?"},
 {a:ADMIN,role:"admin",ago:22,t:"@traderF0_2024 có nhé, mình hướng dẫn thủ tục từ A đến Z. Lưu ý mình hỗ trợ thủ tục, không tư vấn mua bán mã cụ thể."},
 {a:"kythuat_9x",ago:9,t:"$HPG đang loanh quanh vùng 20, xem chiều nay thế nào"},
 {a:"fpt_watch",ago:4,t:"$FPT hôm nay khỏe hơn thị trường"}
];
const CHAT_POOL=[["sonla_value","Có ai xem bài $HPG mới chưa, thảo luận khá hay"],["nguoimoi_hn","Cảm ơn bác giải thích lệnh ATC nhé"],["ck_lover","$SSI thanh khoản vẫn thấp"],
 ["vimo_daily","Tỷ giá hôm nay đi ngang"],["kythuat_9x","Ae nhớ đặt mức cắt lỗ trước khi vào lệnh"],["hoachat_fan","$DGC im ắng quá"],["minhquan_hp","Có ai theo dõi $VCB không"],["traderF0_2024","Em vừa thử đặt lệnh trên màn Giao dịch, giao diện dễ dùng ghê"]];
const CS={cat:"all",sort:"new",open:null,view:"trade",chatT:null,poolI:0,online:128};

const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function cashChip(s){const m=M[s];return `<button class="cash" data-goto="${s}" aria-label="Xem ${s} trên màn giao dịch">$${s} <span class="${cls(m,m.lastU)}" data-live="${s}">${fP(m.lastU)}</span></button>`;}
const rich=t=>esc(t).replace(/\$([A-Z]{3})\b/g,(x,s)=>M[s]?cashChip(s):x).replace(/@([a-z0-9_]+)/gi,'<b>@$1</b>').replace(/\n/g,"<br>");
const richTitle=t=>esc(t).replace(/\$([A-Z]{3})\b/g,(x,s)=>M[s]?`<span class="${cls(M[s],M[s].lastU)}">$${s}</span>`:x);
const ago=m=>m<1?"vừa xong":m<60?`${m} phút trước`:m<1440?`${Math.floor(m/60)} giờ trước`:`${Math.floor(m/1440)} ngày trước`;
const fK=n=>n>=1000?(n/1000).toFixed(1).replace(".0","")+"k":String(n);
const badge=(role,hold,sym)=>(role==="admin"?' <span class="badge admin">Admin</span>':role==="ctv"?' <span class="badge ctv">CTV DNSE</span>':"")+(hold?` <span class="badge hold">Đang nắm giữ${sym?" "+sym:""}</span>`:"");
const lastAgo=t=>Math.min(...t.posts.map(p=>p.ago));
const symsIn=t=>[...new Set([...(t.sym?[t.sym]:[]),...(t.title+t.posts.map(p=>p.text).join(" ")).match(/\$([A-Z]{3})\b/g)?.map(x=>x.slice(1))||[]])].filter(s=>M[s]);

function renderCNav(){
  const cnt=id=>id==="all"?THREADS.length:THREADS.filter(t=>t.cat===id).length;
  const item=(key,label,extra)=>`<button class="cnav-item ${extra?"cnav-sym":""}" data-cat="${key}" aria-current="${CS.cat===key}">${label}${extra||""}</button>`;
  $("cnav").innerHTML=`<h2>Chuyên mục</h2>`+CATS.map(c=>item(c.id,`<span>${c.name}</span>`,"").replace("</button>",`<small>${cnt(c.id)}</small></button>`)).join("")+
    `<h2>Theo mã</h2>`+CSYMS.map(s=>{const m=M[s];return item("sym:"+s,`<b>${s}</b>`,` <small class="${cls(m,m.lastU)}" data-live="${s}">${fP(m.lastU)}</small>`);}).join("");
}
function currentList(){
  let l=THREADS.filter(t=>CS.cat==="all"||(CS.cat.startsWith("sym:")?symsIn(t).includes(CS.cat.slice(4)):t.cat===CS.cat));
  l=l.slice().sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(CS.sort==="hot"?(b.replies*3+b.views/40)-(a.replies*3+a.views/40):lastAgo(a)-lastAgo(b)));
  return l;
}
function renderFeed(){
  const f=$("feed");
  if(CS.open){ return renderThread(f, THREADS.find(t=>t.id===CS.open)); }
  const isSym=CS.cat.startsWith("sym:"), s=isSym?CS.cat.slice(4):null, c=CATS.find(x=>x.id===CS.cat);
  const title=isSym?`Thảo luận ${s}`:c.name, desc=isSym?`Mọi bài viết nhắc đến ${s}. Giá hiện tại ${cashChip(s)}`:c.desc;
  const list=currentList();
  f.innerHTML=`<div class="feed-head"><div><h1>${title}</h1><p>${desc}</p></div><button class="btn-primary" id="new-post">Viết bài</button></div>
   <div class="feed-tools"><div class="seg" role="group" aria-label="Sắp xếp" style="border:0">
     <button class="tool" data-sort="new" aria-pressed="${CS.sort==="new"}">Mới nhất</button><button class="tool" data-sort="hot" aria-pressed="${CS.sort==="hot"}">Sôi nổi</button></div>
     <span class="feed-note">Bài viết là ý kiến cá nhân, không phải khuyến nghị đầu tư.</span></div>
   <div class="feed-body">${list.length?list.map(t=>{const op=t.posts[0];return `<button class="thread" data-open="${t.id}">
     <span class="thread-title">${t.pinned?'<span class="pin">Ghim</span>':""}${richTitle(t.title)}</span>
     <span class="thread-meta"><span class="tagp">${t.tag}</span><span><span class="handle">${op.a}</span>${badge(op.role,op.hold,t.sym)}</span><span>${ago(lastAgo(t))}</span></span>
     <span class="thread-stats"><div><b>${fK(t.replies)}</b><small>trả lời</small></div><div><b>${fK(t.views)}</b><small>lượt xem</small></div></span></button>`;}).join("")
     :`<div class="empty"><b>Chưa có bài viết nào ở đây</b>Mở đầu thảo luận bằng nút Viết bài, nhớ kèm số liệu và nguồn.</div>`}</div>`;
}
function renderThread(f,t){
  f.innerHTML=`<div class="detail-top"><button class="backlink" data-back>‹ Quay lại danh sách</button><h1>${richTitle(t.title)}</h1>
     <div class="thread-meta"><span class="tagp">${t.tag}</span><span>${fK(t.replies)} trả lời</span><span>${fK(t.views)} lượt xem</span></div></div>
   <div class="feed-body">${t.posts.map((p,i)=>`<article class="post ${i===0?"op":""}">
       <div class="ava ${p.role==="admin"?"admin":""}" aria-hidden="true">${p.a.slice(0,2).toUpperCase()}</div>
       <div><div class="post-head"><span class="handle">${p.a}</span>${badge(p.role,p.hold,t.sym)}<time>${ago(p.ago)}</time></div>
       <div class="post-text">${rich(p.text)}</div>
       <div class="post-actions"><button class="act" data-like="${p.id}" aria-pressed="${p.liked}">Thích ${p.likes||""}</button><button class="act" data-reply="${p.a}">Trả lời</button><button class="act" data-report="${p.id}">Báo cáo</button></div></div>
     </article>`).join("")}
     <form class="reply-box" id="reply-form"><textarea id="reply-in" rows="3" placeholder="Viết trả lời. Gõ $MÃ để gắn giá, @tên để nhắc ai đó." aria-label="Trả lời"></textarea>
       <div class="row-end"><span>Đăng với tên ${ME.h}</span><button class="btn-primary" type="submit">Gửi trả lời</button></div></form></div>`;
}
function renderTrend(){
  const cnt={}; THREADS.forEach(t=>t.posts.forEach(p=>(p.text.match(/\$([A-Z]{3})\b/g)||[]).forEach(x=>{const s=x.slice(1);if(M[s])cnt[s]=(cnt[s]||0)+1;})));
  CHAT.forEach(c=>(c.t.match(/\$([A-Z]{3})\b/g)||[]).forEach(x=>{const s=x.slice(1);if(M[s])cnt[s]=(cnt[s]||0)+1;}));
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5), mx=top[0]?.[1]||1;
  $("trend").innerHTML=top.map(([s,n])=>{const m=M[s],ch=(m.lastU-m.refU)/m.refU*100;return `<button class="trend-row" data-goto="${s}"><b>${s}</b><span class="bar"><i style="width:${n/mx*100}%"></i></span>
    <span class="${cls(m,m.lastU)}" data-live="${s}">${fP(m.lastU)}</span><small class="${cls(m,m.lastU)}">${(ch>=0?"+":"")+ch.toFixed(2)}%</small></button>`;}).join("");
}
const hhmm=agoMin=>{const d=new Date(Date.now()-agoMin*60000);return d.toTimeString().slice(0,5);};
function renderChat(){
  const box=$("chat"), atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
  box.innerHTML=`<div class="msg-c sys">Phòng chung chỉ để trao đổi. Không đăng số tài khoản, không rủ ủy thác.</div>`+
    CHAT.map(c=>`<div class="msg-c ${c.a===ME.h?"mine":""}"><time>${c.at||hhmm(c.ago)}</time><span class="who">${c.a}</span>${badge(c.role)}${c.role?" ":""}${rich(c.t)}</div>`).join("");
  if(atBottom||CS.forceScroll){box.scrollTop=box.scrollHeight;CS.forceScroll=false;}
  $("online").textContent=`${CS.online} đang online`;
}
function chatPush(a,t,role){CHAT.push({a,t,role,at:new Date().toTimeString().slice(0,5)}); if(CHAT.length>80)CHAT.shift(); renderChat(); renderTrend();}
function livePrices(){ document.querySelectorAll("[data-live]").forEach(el=>{const m=M[el.dataset.live];el.textContent=fP(m.lastU);el.className=cls(m,m.lastU);}); }

/* Cộng đồng và Tin nhắn hiện chỉ có dữ liệu mẫu (người dùng, bài viết, tin nhắn tự sinh), nên ẩn khỏi menu cho tới khi làm thật.
   Bật lại để xem bản demo: SOCIAL_DEMO = true. */
const SOCIAL_DEMO=false;
const NAV_OF={advisory:"desk"};
const VIEWS={trade:["view-trade","#giao-dich"],community:["view-community","#cong-dong"],chat:["view-chat","#tin-nhan"],desk:["view-desk","#khach-hang"],portal:["view-portal","#tai-khoan"],board:["view-board","#bang-gia"],advisory:["view-advisory","#tu-van"]};
/* Trước đây hàm này mở đầu bằng `if(!UNIVERSE.length) return;` nên nguồn giá hỏng là CẢ THANH TAB
   chết: bấm tab nào cũng không có gì xảy ra, không một thông báo. Đúng chuyện đã xảy ra suốt 4 tiếng
   ngày 19/10/2026 khi /api/market trả 502. Vô lý ở chỗ Khách hàng, Tư vấn và Tài khoản của tôi không
   đọc giá, còn màn Giao dịch không có giá thì hiện khung rỗng kèm dòng trạng thái báo lỗi — vẫn tốt
   hơn là bấm không ăn. */
function setView(v){
  if(!SOCIAL_DEMO&&(v==="community"||v==="chat")) v="trade";
  CS.view=v; Object.entries(VIEWS).forEach(([k,[id]])=>$(id).hidden=k!==v);
  const navV=NAV_OF[v]||v; // màn Tư vấn nằm trong mục "Khách hàng"
  document.querySelectorAll(".nav a[data-view]").forEach(a=>{if(a.dataset.view===navV)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  if(v==="community"){renderCNav();renderFeed();renderTrend();CS.forceScroll=true;renderChat();}
  if(v==="chat"){renderInbox();renderThreadV();}
  if(history.replaceState) history.replaceState(null,"",VIEWS[v][1]);
  document.dispatchEvent(new CustomEvent("lb:view",{detail:v}));
  window.scrollTo(0,0);
}
/**
 * Mở một màn theo deep link, chờ app.js nạp xong nếu cần.
 * Dùng chung cho board/desk/portal/advisory: trước đây mỗi file tự viết một vòng chờ
 * `UNIVERSE.length` giống hệt nhau, và cả bốn đều kẹt vĩnh viễn khi nguồn giá hỏng.
 */
function openView(v, conLai=20){
  if(typeof setView==="function") return setView(v);
  if(conLai>0) setTimeout(()=>openView(v,conLai-1),250);
}

function openComposer(){
  const sel=$("d-where"); const def=CS.cat.startsWith("sym:")?CS.cat:(CS.cat==="all"?"chung":CS.cat);
  sel.innerHTML=CATS.filter(c=>c.id!=="all").map(c=>`<option value="${c.id}">${c.name}</option>`).join("")+CSYMS.map(s=>`<option value="sym:${s}">Mã ${s}</option>`).join("");
  sel.value=def; $("d-title").value=""; $("d-body").value=""; $("d-hold").checked=false; $("d-err").innerHTML="";
  $("dlg").showModal(); setTimeout(()=>$("d-title").focus(),50);
}
$("dlg-form").addEventListener("submit",e=>{
  e.preventDefault(); const title=$("d-title").value.trim(), body=$("d-body").value.trim(), errs=[];
  if(title.length<10) errs.push("Tiêu đề cần ít nhất 10 ký tự.");
  if(body.length<20) errs.push("Nội dung cần ít nhất 20 ký tự để người đọc hiểu bạn muốn bàn gì.");
  if(errs.length){$("d-err").innerHTML=errs.map(x=>`<div class="msg err">${x}</div>`).join("");return;}
  const w=$("d-where").value, isSym=w.startsWith("sym:");
  const t={id:Date.now(),cat:isSym?"sym":w,sym:isSym?w.slice(4):null,tag:"Thảo luận",title,replies:0,views:1,posts:[P_(ME.h,ME.role,0,body,0,{hold:$("d-hold").checked})]};
  THREADS.unshift(t); $("dlg").close(); CS.cat=isSym?w:w; CS.open=t.id; renderCNav(); renderFeed(); renderTrend(); toast("Đã đăng bài.");
});
$("d-cancel").addEventListener("click",()=>$("dlg").close());
$("chat-form").addEventListener("submit",e=>{e.preventDefault();const v=$("chat-in").value.trim();if(!v)return;$("chat-in").value="";CS.forceScroll=true;chatPush(ME.h,v,ME.role);});

document.addEventListener("click",e=>{
  const t=e.target.closest("button,a"); if(!t) return;
  if(t.dataset.view){ e.preventDefault(); return setView(t.dataset.view); }
  if(t.dataset.goto){ e.preventDefault(); setView("trade"); return selectSym(t.dataset.goto); }
  if(t.dataset.cat){ CS.cat=t.dataset.cat; CS.open=null; renderCNav(); return renderFeed(); }
  if(t.dataset.sort){ CS.sort=t.dataset.sort; return renderFeed(); }
  if(t.dataset.open){ const th=THREADS.find(x=>x.id===+t.dataset.open); th.views++; CS.open=th.id; renderFeed(); $("feed").querySelector(".feed-body").scrollTop=0; return; }
  if(t.hasAttribute("data-back")){ CS.open=null; return renderFeed(); }
  if(t.id==="new-post") return openComposer();
  if(t.dataset.like){ for(const th of THREADS){const p=th.posts.find(x=>x.id===+t.dataset.like); if(p){p.liked=!p.liked;p.likes+=p.liked?1:-1;t.setAttribute("aria-pressed",p.liked);t.textContent="Thích "+(p.likes||"");}} return; }
  if(t.dataset.reply){ const ta=$("reply-in"); ta.value=`@${t.dataset.reply} `+ta.value.replace(/^@\S+\s/,""); ta.focus(); return; }
  if(t.dataset.report){ return toast("Đã gửi báo cáo cho admin. Cảm ơn bạn."); }
},true);
document.addEventListener("submit",e=>{
  if(e.target.id!=="reply-form") return; e.preventDefault();
  const v=$("reply-in").value.trim(); if(v.length<2) return;
  const th=THREADS.find(x=>x.id===CS.open); th.posts.push(P_(ME.h,ME.role,0,v)); th.replies++;
  renderFeed(); const fb=$("feed").querySelector(".feed-body"); fb.scrollTop=fb.scrollHeight; renderTrend(); toast("Đã gửi trả lời.");
});
function communityTick(){
  if(CS.view!=="community") return;
  livePrices();
  if(Math.random()<.3){ const [a,txt]=CHAT_POOL[CS.poolI++%CHAT_POOL.length]; chatPush(a,txt); }
  CS.online=Math.max(90,CS.online+Math.round((Math.random()-.5)*4)); $("online").textContent=`${CS.online} đang online`;
}


/* ================= Tin nhắn: AI + người thật ================= */
// Khi deploy thật: trỏ tới API chat của server (ví dụ Qwen chạy qua Ollama/vLLM, chuẩn OpenAI /v1/chat/completions).
// Để null thì AI trả lời bằng kịch bản demo + số liệu tính ngay trong trang.
const AI_ENDPOINT = null;
const AI_MODEL = "qwen2.5";
const nowHM=()=>new Date().toTimeString().slice(0,5);
const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
const CONVS=[
 {id:"ai",kind:"ai",name:"Trợ lý Lật Bài",sub:"AI, trả lời ngay",unread:0,msgs:[
   {from:"ai",html:`<p>Chào bạn, mình là trợ lý AI của Lật Bài. Mình có thể tóm tắt dữ liệu một mã, chạy backtest chiến thuật, xem nhanh danh mục, hoặc giải thích các loại lệnh.</p><p>Mình <b>không</b> đưa ra khuyến nghị mua hay bán. Cần người thật hỗ trợ thì bấm "Chuyển sang người thật" bất cứ lúc nào.</p>`,at:"09:00"}]},
 {id:"admin",kind:"human",name:"Hỗ trợ Lật Bài",handle:ADMIN,role:"admin",online:true,sub:"Admin, thường trả lời trong 5 phút",unread:1,msgs:[
   {from:"sys",t:"Bạn đang chat với nhân viên hỗ trợ (người thật)."},
   {from:"them",t:"Chào bạn, cần hỗ trợ mở tài khoản DNSE, nạp tiền hay lỗi khi đặt lệnh thì cứ nhắn nhé.",at:"08:45"}],
   pool:["Bạn chờ mình kiểm tra một chút nhé.","Mình đã ghi nhận, sẽ phản hồi lại bạn trong hôm nay.","Phần này bạn làm theo hướng dẫn mình gửi là được. Vướng chỗ nào cứ nhắn.","Lưu ý giúp mình: admin hỗ trợ thủ tục, không tư vấn mua bán mã cụ thể nhé."]},
 {id:"f0",kind:"human",name:"traderF0_2024",handle:"traderF0_2024",online:true,sub:"Đang online",unread:2,msgs:[
   {from:"them",t:"Anh ơi em đọc bài anh giải thích lệnh ATC rồi, dễ hiểu lắm ạ",at:"10:12"},
   {from:"them",t:"Cho em hỏi mở tài khoản DNSE qua Lật Bài thì làm những bước nào ạ?",at:"10:13"}],
   pool:["Dạ em cảm ơn anh nhiều ạ","Em làm thử rồi báo anh nhé","Vậy có mất phí mở tài khoản không anh?","Ok anh, em hiểu rồi ạ"]},
 {id:"grp",kind:"group",name:"Nhóm theo dõi HPG",handle:"Nhóm",sub:"5 thành viên",unread:0,members:["thepdenhat","sonla_value","kythuat_9x","minhquan_hp"],msgs:[
   {from:"sys",t:"Nhóm thảo luận do thành viên tạo. Nội dung là ý kiến cá nhân."},
   {from:"them",a:"thepdenhat",t:"Hôm nay $HPG thanh khoản vẫn thấp ae nhỉ",at:"09:31"},
   {from:"them",a:"sonla_value",t:"Ừ, cả thị trường đều thấp. Chờ thêm số liệu quý 3",at:"09:34"}],
   pool:[["kythuat_9x","MA20 vẫn nằm dưới MA50, mình chưa thấy tín hiệu gì mới"],["minhquan_hp","Có ai đọc tin ngành thép sáng nay chưa"],["thepdenhat","Ae nhớ đặt cắt lỗ nhé"],["sonla_value","$HPG đang giữ được vùng 20"]]},
 {id:"sonla",kind:"human",name:"sonla_value",handle:"sonla_value",online:false,sub:"Hoạt động 2 giờ trước",unread:0,msgs:[
   {from:"me",t:"Cảm ơn bác đã chia sẻ bài về dòng tiền VN30 nhé",at:"Hôm qua"},
   {from:"them",t:"Không có gì bạn ơi, có số liệu mới mình sẽ cập nhật thêm",at:"Hôm qua"}],
   pool:["Ok bạn","Để mình xem lại số liệu rồi trả lời nhé","Chuẩn đấy"]}
];
const MS={open:"ai",busy:false};
const convOf=id=>CONVS.find(c=>c.id===id);
const avaHTML=(c,extra="")=>c.kind==="ai"?`<div class="ava ai ${extra}" aria-hidden="true">AI</div>`:c.kind==="group"?`<div class="ava grp ${extra}" aria-hidden="true">H</div>`:`<div class="ava ${c.role==="admin"?"admin":""} ${c.online?"on":""} ${extra}" aria-hidden="true">${c.handle.slice(0,2).toUpperCase()}</div>`;
function lastPreview(c){const m=[...c.msgs].reverse().find(x=>x.from!=="sys");if(!m)return"";const txt=m.t||m.html.replace(/<[^>]+>/g," ");return (m.from==="me"?"Bạn: ":m.a?m.a+": ":"")+txt.replace(/\s+/g," ").trim();}
function totalUnread(){return CONVS.reduce((a,c)=>a+c.unread,0);}
function renderNavBadge(){const n=totalUnread();$("nav-unread").textContent=n||"";}
function renderInbox(){
  const row=c=>`<button class="conv ${c.unread?"unread":""}" data-conv="${c.id}" aria-current="${MS.open===c.id}">${avaHTML(c)}
    <span class="conv-name">${c.name}${c.role==="admin"?' <span class="badge admin">Admin</span>':""}</span><span class="conv-time">${(([...c.msgs].reverse().find(x=>x.at)||{}).at)||""}</span>
    <span class="conv-last">${esc(lastPreview(c))}</span>${c.unread?`<span class="nbadge">${c.unread}</span>`:""}</button>`;
  $("inbox").innerHTML=`<h2>Trợ lý AI</h2>`+CONVS.filter(c=>c.kind==="ai").map(row).join("")+`<h2>Người thật</h2>`+CONVS.filter(c=>c.kind!=="ai").map(row).join("");
  renderNavBadge();
}
function msgHTML(m,c){
  if(m.from==="sys") return `<div class="sysline">${esc(m.t)}</div>`;
  if(m.from==="ai") return `<div class="ai-block"><div class="ai-label">Trợ lý AI${AI_ENDPOINT?"":" (bản demo)"}</div><div class="ai-text">${m.html}</div></div>`;
  if(m.from==="typing") return c.kind==="ai"?`<div class="ai-block"><div class="ai-label">Trợ lý AI đang phân tích</div><span class="typing"><i></i><i></i><i></i></span></div>`
    :`<div class="bub them">${m.a?`<span class="who">${m.a}</span>`:""}<span class="typing"><i></i><i></i><i></i></span></div>`;
  return `<div class="bub ${m.from}">${m.a&&c.kind==="group"?`<span class="who">${m.a}</span>`:""}${rich(m.t)}<div class="bub-meta">${m.at||""}${m.from==="me"&&m.seen?"  Đã xem":""}</div></div>`;
}
function renderThreadV(){
  const c=convOf(MS.open);
  $("th-head").innerHTML=`<button class="th-back" data-mback aria-label="Quay lại hộp thư">‹</button>${avaHTML(c)}<div class="grow"><b>${c.name}</b><small>${c.sub}</small></div>`+
    (c.kind==="ai"?`<button class="tool" data-handover>Chuyển sang người thật</button>`:"");
  const body=$("th-body"); body.innerHTML=`<div class="day">Hôm nay</div>`+c.msgs.map(m=>msgHTML(m,c)).join(""); body.scrollTop=body.scrollHeight;
  $("prompts").innerHTML=c.kind==="ai"?["Phân tích HPG","Backtest MA20/MA50 cho HPG","Danh mục của tôi thế nào?","Lệnh ATC là gì?","Có nên mua HPG không?"].map(p=>`<button data-prompt="${p}">${p}</button>`).join(""):"";
  $("prompts").hidden=c.kind!=="ai";
  $("m-in").placeholder=c.kind==="ai"?"Hỏi trợ lý, ví dụ: phân tích FPT":`Nhắn cho ${c.name}`;
  $("m-note").textContent=c.kind==="ai"?"AI có thể sai. Thông tin chỉ để tham khảo, không phải khuyến nghị đầu tư.":"Không gửi mật khẩu, mã OTP hay số tài khoản ngân hàng qua chat.";
  renderCtx(c);
}
function renderCtx(c){
  const ctx=$("ctx");
  if(c.kind==="ai"){
    ctx.innerHTML=`<h3>Trợ lý đang dùng dữ liệu</h3><ul>
      <li class="on"><span><b>Giá và lịch sử giao dịch</b><br>Giá thật từ DNSE (trễ vài giây)</span></li>
      <li class="on"><span><b>Tài khoản giao dịch thử của bạn</b><br>Danh mục, sức mua, sổ lệnh (tiền ảo)</span></li>
      <li class="on"><span><b>Bộ máy backtest</b><br>Chạy trên nến ngày, đã trừ phí và thuế</span></li>
      <li><span><b>Tin tức, BCTC</b><br>Bản sau, qua MCP của DNSE</span></li></ul>
      <h3>Mô hình</h3><p style="margin:0;color:var(--muted)">${AI_ENDPOINT?`${AI_MODEL} trên máy chủ Lật Bài`:"Bản demo trả lời theo kịch bản, số liệu được tính thật trong trang. Bản chạy thật dùng Qwen trên máy chủ Lật Bài."}</p>
      <h3>Cần người thật?</h3><p style="margin:0 0 4px;color:var(--muted)">Thủ tục tài khoản, nạp rút, lỗi lệnh nên hỏi nhân viên hỗ trợ.</p><button class="ghost" data-handover>Chuyển sang người thật</button>`;
  } else if(c.kind==="group"){
    ctx.innerHTML=`<div class="ctx-who">${avaHTML(c)}<b>${c.name}</b><p>${c.sub}</p></div><h3>Thành viên</h3><ul>${["hien_latbai (bạn)",...c.members].map(m=>`<li class="on"><span>${m}</span></li>`).join("")}</ul>`;
  } else {
    ctx.innerHTML=`<div class="ctx-who">${avaHTML(c)}<b>${c.name}</b>${c.role==="admin"?'<span class="badge admin">Admin</span>':""}<p>${c.sub}</p></div>
      <h3>An toàn khi chat</h3><ul><li><span>Lật Bài không bao giờ hỏi mật khẩu hay mã OTP của bạn.</span></li><li><span>Không chuyển tiền cho người lạ hay nhận ủy thác qua chat.</span></li></ul>
      <button class="ghost" data-report-user>Báo cáo người dùng</button>`;
  }
}
function openConv(id){
  const c=convOf(id); MS.open=id; c.unread=0;
  if(c.kind!=="ai") c.msgs.forEach(m=>{if(m.from==="me")m.seen=true;});
  $("view-chat").classList.add("open"); renderInbox(); renderThreadV();
}
function pushMsg(id,m){
  const c=convOf(id); c.msgs=c.msgs.filter(x=>x.from!=="typing"); if(m) c.msgs.push(m);
  if(m&&id!==MS.open&&m.from!=="me") c.unread++;
  if(CS.view==="chat"){ renderInbox(); if(id===MS.open) renderThreadV(); } else renderNavBadge();
}
function showTyping(id,a){convOf(id).msgs.push({from:"typing",a}); if(CS.view==="chat"&&id===MS.open) renderThreadV();}

/* ---------- Bộ não demo của AI: số liệu tính thật, lời văn theo kịch bản ---------- */
function findSym(text){const n=" "+norm(text)+" ";return Object.keys(M).find(s=>new RegExp("[^a-z]"+s.toLowerCase()+"[^a-z]").test(n));}
function seriesOf(s){const m=M[s];return [...m.bars,{...m.today}];}
function smaAt(arr,i,n){if(i<n-1)return null;let t=0;for(let k=i-n+1;k<=i;k++)t+=arr[k];return t/n;}
const pct=(a,b)=>(a/b-1)*100, sg=x=>(x>=0?"+":"")+x.toFixed(2)+"%";
const dmy=t=>{const d=new Date(t*1000);return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${String(d.getUTCFullYear()).slice(2)}`;};
const srcNote=s=>`Dữ liệu: giá thật từ DNSE, phiên ${dmyFull(M[s].session)}.`;
const actBtns=s=>`<div class="ai-actions"><button data-goto="${s}">Mở biểu đồ ${s}</button><button data-prompt="Backtest MA20/MA50 cho ${s}">Backtest ${s}</button></div>`;
function aiAnalyze(s){
  const m=M[s], b=seriesOf(s), cl=b.map(x=>x.close), i=cl.length-1, px=P(m.lastU);
  const ma20=smaAt(cl,i,20), ma50=smaAt(cl,i,50), hi=Math.max(...b.map(x=>x.high)), lo=Math.min(...b.map(x=>x.low));
  const v=m.bars.map(x=>x.value), vLast=v[v.length-1], vAvg=v.slice(-20).reduce((a,x)=>a+x,0)/20;
  const trend = px>ma20&&ma20>ma50 ? "Giá nằm trên cả MA20 và MA50, MA20 trên MA50: xu hướng ngắn hạn đang tăng."
    : px<ma20&&ma20<ma50 ? "Giá nằm dưới cả MA20 và MA50, MA20 dưới MA50: xu hướng ngắn hạn đang giảm."
    : "Giá và hai đường MA đan xen nhau: thị trường đang giằng co, chưa rõ xu hướng.";
  return `<p><b>${s}</b> đang ở <b class="${cls(m,m.lastU)}">${px.toFixed(2)}</b> (${sg(pct(m.lastU,m.refU))} so với tham chiếu ${fP(m.refU)}). Biên độ hôm nay ${fP(m.floorU)} đến ${fP(m.ceilU)}.</p>
   <div class="ai-card"><div class="ai-card-h"><b>${s}</b><span class="online">${m.name}</span></div><div class="kv">
     <div><span>MA20</span><b>${ma20.toFixed(2)}</b></div><div><span>MA50</span><b>${ma50.toFixed(2)}</b></div>
     <div><span>Cao nhất 1 năm</span><b>${hi.toFixed(2)}</b></div><div><span>Thấp nhất 1 năm</span><b>${lo.toFixed(2)}</b></div>
     <div><span>KL phiên gần nhất</span><b>${fVol(vLast)}</b></div><div><span>KL TB 20 phiên</span><b>${fVol(vAvg)}</b></div></div></div>
   <p>${trend} Giá hiện cách đỉnh 1 năm ${Math.abs(pct(px,hi)).toFixed(1)}% và cao hơn đáy 1 năm ${pct(px,lo).toFixed(1)}%. Khối lượng phiên gần nhất bằng ${(vLast/vAvg*100).toFixed(0)}% mức trung bình 20 phiên.</p>
   <p class="ai-note">${srcNote(s)} Đây là tóm tắt dữ liệu, không phải khuyến nghị mua bán.</p>${actBtns(s)}`;
}
function aiBacktest(s){
  const b=seriesOf(s).slice(0,-1), cl=b.map(x=>x.close), trades=[]; let pos=null, eq=1, peak=1, mdd=0;
  for(let i=50;i<cl.length;i++){
    const f0=smaAt(cl,i-1,20), s0=smaAt(cl,i-1,50), f1=smaAt(cl,i,20), s1=smaAt(cl,i,50);
    if(!pos&&f0<=s0&&f1>s1) pos={i,px:cl[i]};
    else if(pos&&f0>=s0&&f1<s1){ const r=(cl[i]*(1-FEE-TAX))/(pos.px*(1+FEE))-1; eq*=1+r; trades.push({in:b[pos.i].time,out:b[i].time,pin:pos.px,pout:cl[i],r}); pos=null; }
    const mtm=pos?eq*(cl[i]*(1-FEE-TAX))/(pos.px*(1+FEE)):eq; peak=Math.max(peak,mtm); mdd=Math.min(mdd,mtm/peak-1);
  }
  let open="";
  if(pos){ const r=(cl[cl.length-1]*(1-FEE-TAX))/(pos.px*(1+FEE))-1; open=`Đang có vị thế mở từ ${dmy(b[pos.i].time)}, tạm tính ${sg(r*100)}.`; eq*=1+r; }
  const bh=(cl[cl.length-1]*(1-FEE-TAX))/(cl[49]*(1+FEE))-1, wins=trades.filter(t=>t.r>0).length;
  const rows=trades.map(t=>`<tr><td>${dmy(t.in)}</td><td class="r">${t.pin.toFixed(2)}</td><td>${dmy(t.out)}</td><td class="r">${t.pout.toFixed(2)}</td><td class="r ${t.r>=0?"up":"down"}">${sg(t.r*100)}</td></tr>`).join("");
  return `<p>Mình đã chạy chiến thuật <b>giao cắt MA20/MA50</b> cho <b>${s}</b>: mua khi MA20 cắt lên MA50, bán khi MA20 cắt xuống. Khớp tại giá đóng cửa phiên có tín hiệu, đã trừ phí ${(FEE*100).toFixed(2)}% mỗi chiều và thuế bán 0.1%.</p>
   <div class="ai-card"><div class="ai-card-h"><b>Kết quả backtest ${s}</b><span class="online">${dmy(b[49].time)} đến ${dmy(b[b.length-1].time)}</span></div><div class="kv">
     <div><span>Lợi nhuận chiến thuật</span><b class="${eq-1>=0?"up":"down"}">${sg((eq-1)*100)}</b></div><div><span>Mua và giữ</span><b class="${bh>=0?"up":"down"}">${sg(bh*100)}</b></div>
     <div><span>Số lệnh đã đóng</span><b>${trades.length}</b></div><div><span>Tỷ lệ thắng</span><b>${trades.length?Math.round(wins/trades.length*100)+"%":"–"}</b></div>
     <div><span>Sụt giảm tối đa</span><b class="down">${(mdd*100).toFixed(2)}%</b></div></div>
     ${trades.length?`<div style="overflow-x:auto"><table><thead><tr><th>Mua</th><th class="r">Giá</th><th>Bán</th><th class="r">Giá</th><th class="r">Lãi/lỗ</th></tr></thead><tbody>${rows}</tbody></table></div>`:""}</div>
   <p>${trades.length?(eq-1>bh?(eq-1<0?"Chiến thuật vẫn lỗ nhưng lỗ ít hơn mua và giữ, chủ yếu nhờ đứng ngoài trong các nhịp giảm.":"Chiến thuật tốt hơn mua và giữ trong giai đoạn này."):"Chiến thuật kém hơn mua và giữ trong giai đoạn này."):"Không có lệnh nào được đóng trong giai đoạn này."} ${open}</p>
   <p class="ai-note">Dữ liệu: giá thật từ DNSE đến ${dmyFull(M[s].session)}. Kết quả quá khứ không đảm bảo cho tương lai. Màn Backtest đầy đủ (nhiều chiến thuật, tối ưu tham số) sẽ có ở bản sau.</p>
   <div class="ai-actions"><button data-goto="${s}">Mở biểu đồ ${s}</button></div>`;
}
function aiPortfolio(){
  if(!ACC.user) return `<p>Bạn cần đăng nhập để mình xem danh mục giao dịch thử của bạn.</p>`;
  const tenTK=ACC.mode==="that"?"Danh mục DNSE":"Danh mục demo";
  const rows=Object.entries(ACC.hold); if(!rows.length) return `<p>${tenTK} của bạn đang trống. Sức mua hiện có ${fVND(ACC.cash)}.</p>`;
  let tv=0,tc=0; const tr=rows.map(([s,h])=>{const px=P(M[s].lastU),v=px*1000*h.qty,c=h.avg*1000*h.qty;tv+=v;tc+=c;
    return `<tr><td><b>${s}</b></td><td class="r">${fN(h.qty)}</td><td class="r">${h.avg.toFixed(2)}</td><td class="r">${px.toFixed(2)}</td><td class="r ${v>=c?"up":"down"}">${sg(pct(v,c))}</td></tr>`;}).join("");
  const big=rows.map(([s,h])=>[s,P(M[s].lastU)*1000*h.qty]).sort((a,b)=>b[1]-a[1])[0];
  return `<p>Tổng giá trị cổ phiếu của bạn là <b>${fVND(tv)}</b>, lãi lỗ tạm tính <b class="${tv>=tc?"up":"down"}">${(tv-tc>=0?"+":"")+fN(tv-tc)} đ</b> (${sg(pct(tv,tc))}). Tiền mặt còn ${fVND(ACC.cash)}.</p>
   <div class="ai-card"><div style="overflow-x:auto"><table><thead><tr><th>Mã</th><th class="r">KL</th><th class="r">Giá vốn</th><th class="r">Giá TT</th><th class="r">Lãi/lỗ</th></tr></thead><tbody>${tr}</tbody></table></div></div>
   <p>${big[0]} chiếm ${(big[1]/(tv+ACC.cash)*100).toFixed(0)}% tổng tài sản, là vị thế lớn nhất của bạn.</p><p class="ai-note">Số liệu từ ${ACC.mode==="that"?"tài khoản DNSE thật":"tài khoản demo"}, cập nhật theo giá đang chạy.</p>`;
}
const ORDER_TYPES={lo:"<b>LO (lệnh giới hạn)</b>: bạn nhập giá cụ thể, lệnh chỉ khớp ở giá đó hoặc tốt hơn.",mtl:"<b>MTL (thị trường giới hạn)</b>: khớp ngay ở giá tốt nhất đang có, phần chưa khớp chuyển thành lệnh LO. Chỉ dùng trong phiên liên tục.",
  ato:"<b>ATO</b>: chỉ đặt trong đợt khớp lệnh định kỳ mở cửa (9h00 đến 9h15 trên HOSE), không nhập giá, khớp tại giá mở cửa.",atc:"<b>ATC</b>: chỉ đặt trong đợt khớp lệnh định kỳ đóng cửa (14h30 đến 14h45 trên HOSE), không nhập giá, khớp tại giá đóng cửa."};
function aiRespond(text){
  const n=norm(text), s=findSym(text);
  if(/(nen|co nen|khuyen nghi|mua khong|ban khong|muc|vao lenh|tu van mua|tu van ban)/.test(n)&&/(mua|ban|khuyen nghi|muc|vao lenh)/.test(n))
    return `<p>Mình không đưa ra khuyến nghị mua hay bán mã cụ thể. Quyết định là của bạn, và tùy vào vốn, khẩu vị rủi ro, thời gian nắm giữ của bạn.</p><p>Mình có thể giúp bạn có thêm dữ liệu để tự quyết:</p>
      <ul><li>Tóm tắt giá, xu hướng, khối lượng${s?` của ${s}`:""}</li><li>Backtest thử một chiến thuật trên dữ liệu quá khứ</li><li>Xem danh mục hiện tại của bạn đang tập trung vào đâu</li></ul>
      <div class="ai-actions">${s?`<button data-prompt="Phân tích ${s}">Tóm tắt ${s}</button><button data-prompt="Backtest MA20/MA50 cho ${s}">Backtest ${s}</button>`:""}<button data-handover>Chuyển sang người thật</button></div>`;
  if(/backtest|giao cat|ma20|ma50|chien thuat/.test(n)) return aiBacktest(s||"HPG");
  if(/danh muc|tai khoan|lai lo|tai san|cua toi/.test(n)) return aiPortfolio();
  const ot=Object.keys(ORDER_TYPES).find(k=>new RegExp("(^|[^a-z])"+k+"([^a-z]|$)").test(n));
  if(ot) return `<p>${ORDER_TYPES[ot]}</p><p>Trên màn Giao dịch, khi chọn ATO, ATC hoặc MTL thì ô giá sẽ tự khóa vì loại lệnh này không cần nhập giá.</p>`;
  if(/tran|san|bien do/.test(n)){ const x=s||"HPG", m=M[x]; return `<p>Biên độ dao động trong ngày: HOSE ±7%, HNX ±10%, UPCoM ±15% so với giá tham chiếu.</p><p>${x} (${m.ex}) hôm nay: trần <b class="ceil">${fP(m.ceilU)}</b>, tham chiếu <b class="ref">${fP(m.refU)}</b>, sàn <b class="floor">${fP(m.floorU)}</b>.</p>`; }
  if(s) return aiAnalyze(s);
  return `<p>Mình chưa hiểu ý bạn lắm. Bạn có thể thử:</p><ul><li>"Phân tích FPT"</li><li>"Backtest MA20/MA50 cho HPG"</li><li>"Danh mục của tôi thế nào?"</li><li>"Lệnh MTL là gì?"</li></ul><p>Hoặc bấm "Chuyển sang người thật" để chat với nhân viên hỗ trợ.</p>`;
}
async function askAI(text){
  if(!AI_ENDPOINT) return aiRespond(text);
  const c=convOf("ai"), history=c.msgs.filter(m=>m.from==="me"||m.from==="ai").slice(-10).map(m=>({role:m.from==="me"?"user":"assistant",content:m.t||m.html.replace(/<[^>]+>/g," ")}));
  try{
    const r=await fetch(AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:AI_MODEL,messages:[
      {role:"system",content:"Bạn là trợ lý của Lật Bài. Trả lời tiếng Việt, ngắn gọn, dựa trên dữ liệu được cung cấp. Không khuyến nghị mua bán mã cụ thể."},...history]})});
    const j=await r.json(); return `<p>${esc(j.choices?.[0]?.message?.content||"Không nhận được trả lời.").replace(/\n/g,"<br>")}</p>`;
  }catch(e){ return `<p>Không kết nối được máy chủ AI. Thử lại sau ít phút.</p>`; }
}
async function sendMsg(text){
  const c=convOf(MS.open); text=text.trim(); if(!text||MS.busy&&c.kind==="ai") return;
  pushMsg(c.id,{from:"me",t:text,at:nowHM(),seen:false});
  if(c.kind==="ai"){
    MS.busy=true; showTyping("ai"); const html=await askAI(text);
    setTimeout(()=>{pushMsg("ai",{from:"ai",html,at:nowHM()});MS.busy=false;},AI_ENDPOINT?0:700+Math.random()*600);
  } else {
    const id=c.id; setTimeout(()=>{c.msgs.forEach(m=>{if(m.from==="me")m.seen=true;}); if(CS.view==="chat"&&MS.open===id)renderThreadV();},900);
    setTimeout(()=>{ const p=c.pool[(c.pi=(c.pi||0)+1)%c.pool.length]; const [a,t]=Array.isArray(p)?p:[null,p]; showTyping(id,a);
      setTimeout(()=>pushMsg(id,{from:"them",a,t,at:nowHM()}),1400+Math.random()*900); },1300);
  }
}
function handover(){
  const ai=convOf("ai"), last=[...ai.msgs].reverse().find(m=>m.from==="me");
  pushMsg("admin",{from:"sys",t:`Đã chuyển từ Trợ lý AI${last?`. Câu hỏi gần nhất: "${last.t}"`:""}`});
  openConv("admin"); showTyping("admin");
  setTimeout(()=>pushMsg("admin",{from:"them",t:"Chào bạn, mình là nhân viên hỗ trợ của Lật Bài. Mình đã xem câu hỏi bạn hỏi trợ lý AI, bạn cần mình hỗ trợ thêm phần nào?",at:nowHM()}),1800);
}
$("composer").addEventListener("submit",e=>{e.preventDefault();const v=$("m-in").value;$("m-in").value="";$("m-in").style.height="";sendMsg(v);});
$("m-in").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();$("composer").requestSubmit();}});
$("m-in").addEventListener("input",e=>{e.target.style.height="";e.target.style.height=Math.min(e.target.scrollHeight,140)+"px";});
document.addEventListener("click",e=>{
  const t=e.target.closest("button"); if(!t) return;
  if(t.dataset.conv) return openConv(t.dataset.conv);
  if(t.hasAttribute("data-mback")){ $("view-chat").classList.remove("open"); return; }
  if(t.dataset.prompt){ if(MS.open!=="ai") openConv("ai"); return sendMsg(t.dataset.prompt); }
  if(t.hasAttribute("data-handover")) return handover();
  if(t.hasAttribute("data-report-user")) return toast("Đã gửi báo cáo cho admin.");
},true);
let chatTicks=0;
function chatTick(){
  chatTicks++;
  if(chatTicks%11===0){ const g=convOf("grp"), [a,t]=g.pool[(g.pi=(g.pi||0)+1)%g.pool.length]; pushMsg("grp",{from:"them",a,t,at:nowHM()}); }
}

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
  if(SOCIAL_DEMO){ communityTick(); chatTick(); }
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
  if(SOCIAL_DEMO){ if(location.hash==="#cong-dong") setView("community"); if(location.hash==="#tin-nhan") setView("chat"); }
  else if(location.hash==="#cong-dong"||location.hash==="#tin-nhan") history.replaceState?.(null,"","#giao-dich");
}
if(SOCIAL_DEMO) document.querySelectorAll("[data-social]").forEach(a=>a.hidden=false);
renderNavBadge();
boot();
