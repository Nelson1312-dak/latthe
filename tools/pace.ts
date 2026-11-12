/**
 * Thước đo nhịp độ, chạy không cần trình duyệt.
 *
 *     npm run pace
 *
 * Nó dựng đúng Economy + MapManager + FogOfWar + WorkerManager mà người chơi chạy, rồi tua
 * bốn giờ trong vài giây và in ra các mốc. Không phải một mô hình riêng — mô hình riêng sẽ
 * lệch khỏi game ngay lần sửa luật đầu tiên; đây là chính ván game, chỉ không có hình.
 *
 * Nó đã tìm ra những lỗi không nhìn code mà thấy được: dân đứng cách nhà 280 đơn vị vẫn
 * cõng bộ từng chuyến về, thủ phủ ngừng bán vì kho đứng lì ngay dưới ngưỡng, cả làng bị kéo
 * đi hai trăm đơn vị lấy pha lê vì kho pha lê luôn vơi nhất. Nên trước khi đổi một con số
 * cân bằng nào, chạy cái này trước và sau.
 *
 * Người chơi giả lập ở đây chơi máy móc: cứ hai giây thì thuê người nếu đủ tiền, không thì
 * xây thứ rẻ nhất với tới, không nữa thì nâng cấp. Nó không khôn bằng người thật, nên các
 * con số là SÀN chứ không phải kỳ vọng — và quan trọng hơn cả là so sánh trước/sau.
 */
import * as THREE from 'three';

import { CHUNK } from '../src/world';
import { denOf, denPower } from '../src/dens';
import { SHIP_COST, SORTIE_SECONDS } from '../src/naval';

(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
};

/*
 * MapManager ve mot anh gradient ra canvas de lam quang cho bai. Node khong co DOM, nen
 * can mot ban gia. Noi dung anh khong anh huong gi toi mo phong - no thuan tuy la hinh
 * anh - nen mot canvas rong la du; cai can la dung vo cho ba loi goi do.
 */
(globalThis as { document?: unknown }).document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      // Van be mat ve tung diem anh. Noi dung khong anh huong mo phong, nhung grainTexture
      // CO doc lai mang data de ghi vao, nen ban gia phai tra ve mot mang that.
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => undefined,
      set fillStyle(_v: unknown) { /* khong dung toi */ },
    }),
  }),
};

const { Economy } = await import('../src/Economy');
const { MapManager } = await import('../src/MapManager');
const { FogOfWar } = await import('../src/FogOfWar');
const { WorkerManager } = await import('../src/WorkerManager');
const { RESOURCES, WAVE_WARN_SECONDS, VOYAGES, GUARD_PER_VILLAGER, TROOPS, BUILD_LIMIT,
  BUILD_MIN_AGE, BUILD_MIN_LEVEL, BUILDINGS } =
  await import('../src/config');
const { TROOP_KINDS } = await import('../src/types');
const { RESOURCE_KINDS } = await import('../src/types');
type BuildingType = import('../src/types').BuildingType;
type Cost = import('../src/types').Cost;
type ResourceKind = import('../src/types').ResourceKind;

const economy = Economy.load();
const map = new MapManager();
const fog = new FogOfWar(economy.state.revealed);
const target = new THREE.Vector3(0, 0, 0);
map.update(target);
economy.recompute();
const workers = new WorkerManager(economy, map, fog);

// Moc thanh tuu theo khoang cach: Game.ts noi cai nay, nen thieu no la thuoc do bo qua het
// phan thuong vinh vien va bao thap hon that.
fog.onReveal = (key) => {
  economy.state.revealed = fog.revealedKeys();
  const [cx, cz] = key.split(",").map(Number);
  economy.noteReach(Math.round(Math.hypot(cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2)));
};

/*
 * Nhòm vào chợ: bọc sellSurplus() để biết mỗi giây thủ phủ bán được gì, và dùng hết bao
 * nhiêu phần sức bán của nó. Bọc từ ngoài chứ không thêm biến đếm vào Economy — đo đạc
 * không nên để lại dấu vết trong luật chơi.
 */
const daBan: Record<string, number> = {};
let nhipCo = 0;
let nhipDay = 0;
{
  const tu = economy as unknown as {
    sellSurplus: (dt: number) => void;
    state: { inv: Record<string, number> };
  };
  const goc = tu.sellSurplus.bind(tu);
  tu.sellSurplus = (dt: number) => {
    const truoc = { ...tu.state.inv };
    goc(dt);
    let ban = 0;
    for (const k of RESOURCE_KINDS) {
      if (k === 'gold') continue;
      const d = truoc[k] - tu.state.inv[k];
      if (d > 0) { daBan[k] = (daBan[k] ?? 0) + d; ban += d; }
    }
    const tran = economy.marketRate() * dt;
    if (tran > 0) {
      nhipCo += 1;
      if (ban >= tran * 0.98) nhipDay += 1;
    }
  };
}

// Choi canh dung NGAY SAU kho lam: mot nguoi choi biet luat se dung no truoc dot dau tien,
// va ban mo phong phai la nguoi choi biet luat, khong thi con so doc ra la "neu khong ai thu".

/*
 * Chuyen di bien: ban mo phong phai dong vai nguoi choi BIET LUAT, nen no chon tam xa nhat
 * ma van giu duoc lang - de lai it nhat mot nguoi, va khong rut nguoi ngay truoc dot bao
 * neu rut xong thi thu khong con du. Choi bua thi con so doc ra la "neu di lung tung", chu
 * khong phai "di bien dang gia bao nhieu".
 */
/*
 * Ham doi: nguoi choi biet luat dong thuyen ngay khi duoc (canh giac bien la phan CONG
 * THEM vao dot cuop, khong co thuyen la ganh ca), nhung khong dong bang khoan dang de danh
 * len thoi dai. Danh hang khi du thuyen va dot toi con xa hon mot chuyen di - thuyen di vang
 * thi bo bien bo ngo.
 */
const hai = { dong: 0, hang: 0, thuaHang: 0, chim: 0, chan: 0, lot: 0, cuop: 0 };
function hamDoi(): void {
  const danh = deDanh();
  const du = !danh || RESOURCE_KINDS.every(
    (k) => economy.state.inv[k] - (SHIP_COST[k] ?? 0) >= (danh[k] ?? 0));
  if (du && economy.buildShip()) hai.dong += 1;
  if (!economy.lairBlock() && economy.state.threat.next > SORTIE_SECONDS + 5) economy.raidLair();
}

function diBien(): void {
  if (economy.state.voyage) return;
  const nha = economy.atHome();
  const gap = economy.state.threat.next;
  /*
   * NGAM MOT TAM, KHONG BOC TAM NAO MUA DUOC.
   *
   * Luong thuc la dong tien duy nhat cua di bien, ma chuyen ven bo thi luc nao cung mua
   * noi — ban mo phong tham an se tieu sach kho vao chuyen re nhat va khong bao gio cham
   * toi bien sau. Do ra la "mat nguoi 0" suot bon tieng, tuc cai tam gay can nhat chua
   * tung duoc do lan nao. Nguoi choi that thi chon mot tam roi de danh cho no.
   */
  const muc = [...VOYAGES].reverse().find((s) => s.crew <= nha - 1);
  if (!muc) return;
  if (economy.voyageBlock(muc.id)) return;
  // Rut nguoi la rut suc thu. Sat gio thi chi di khi di xong van du suc.
  if (gap < 60 && economy.guard() - muc.crew * GUARD_PER_VILLAGER < economy.wavePower()) return;
  economy.startVoyage(muc.id);
}

/*
 * O trong gan thu phu nhat ma dat duoc loai nay, quet theo vong vuong lon dan.
 *
 * Tram trung chuyen la ngoai le: viec cua no la dung XA de gom hang o nhung bai o ria, nen
 * dat no sat lang thi chinh no thanh vo dung. Bat no ra ngoai 34 don vi, gan dung quang ma
 * ban cu vo tinh dat no vao.
 */
function oTrong(t: BuildingType): [number, number] | null {
  // Dai quan sat cung dung xa: dat no canh thu phu thi no chi ven lai vung da ven.
  const xa = t === 'outpost' ? 34 : t === 'lookout' ? 26 : 0;
  // Quet theo vong vuong lon dan, buoc 2 don vi. Khong con o luoi nao de duyet nua, nen
  // buoc quet la mot con so CHON TAY: nho hon thi cham, lon hon thi bo sot khe hep.
  const B = 2;
  for (let r = 1; r <= 40; r += 1) {
    for (let i = -r; i <= r; i += 1) {
      for (let j = -r; j <= r; j += 1) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const cx = i * B;
        const cz = j * B;
        if (Math.hypot(cx, cz) < xa) continue;
        if (!economy.placeBlock(cx, cz, t, fog.isRevealed(cx, cz))) return [cx, cz];
      }
    }
  }
  return null;
}

/*
 * Thu tu xay. Doanh trai va lo ren dung NGAY SAU kho lam: mot nguoi choi biet luat se dung
 * quan ngay khi len Thoi Mo Dat, va ban mo phong phai la nguoi choi biet luat.
 */
const XAY: BuildingType[] = ['house', 'granary', 'watchtower', 'farm', 'well', 'barracks',
  'smithy', 'market', 'archery', 'stable', 'magetower', 'workshop', 'outpost', 'dock', 'lookout'];

/*
 * Len thoi dai va nuoi quan.
 *
 * Len thoi dai NGAY khi du: no mo cong trinh moi, va cai gia (giac manh len) thi dang
 * tra vi khong len thi vinh vien khong co quan. Quan thi nuoi toi tran, nhung chua lai
 * mot nua luong thuc cho chuyen di bien - het luong la linh bo di.
 */
/**
 * Khoan cua dang de danh cho thoi dai sau, hoac null neu chua phai luc de danh.
 *
 * Chi de danh khi thoi dai sau CHI con thieu cua — con thieu cap hay thieu cong trinh thi
 * cu xay tiep da. Khong co cai nay thi con bot tieu sach moi dong vao nang cap va dung mai
 * o thoi dai hai du can cu len toi cap 54: do duoc, khong phai doan.
 */
function deDanh(): Cost | null {
  const sau = economy.nextAge();
  if (sau && economy.ageBlock() === 'Not enough resources') return sau.cost;
  // Con mot loai nha da mo ma chua co cai nao: de danh cho no. Khong co dong nay thi moi
  // vien da vua ve kho la bi mot lan nang cap re tien an mat, va con bot dung o thoi dai
  // bon suot hai tieng vi khong bao gio gom noi 320 da cho thap phep - do duoc.
  const moi = nhaMoi();
  return moi ? economy.buildCostFor(moi) : null;
}

/** Loai nha dau tien trong thu tu xay ma thoi dai va cap da cho phep nhung chua co cai nao. */
function nhaMoi(): BuildingType | null {
  for (const t of XAY) {
    if (t === 'watchtower' || economy.countOf(t) > 0) continue;
    if ((BUILD_MIN_AGE[t] ?? 0) > economy.state.age) continue;
    if (economy.state.level < (BUILD_MIN_LEVEL[t] ?? 0)) continue;
    return t;
  }
  return null;
}

function quanDoi(): void {
  if (!economy.ageBlock()) economy.advanceAge();
  /*
   * Thoi dai di truoc quan so.
   *
   * Nguoi choi tham linh thi tu khoa duong len cua chinh minh: moi thoi dai deu doi luong
   * thuc, ma nuoi quan cung an luong thuc, nen con bot tham an se dung mai o thoi dai hai
   * du can cu da len cap 54 — do duoc, khong phai doan. Nen khi thoi dai sau chi con thieu
   * cua, dung tieu phan luong danh cho no.
   */
  const giuLuong = deDanh()?.food ?? 0;
  for (const k of TROOP_KINDS) {
    if (economy.trainBlock(k)) continue;
    // Giu lai mot khoan luong that: nuoi quan ma de kho can thi linh bo di ngay sau do.
    if (economy.state.inv.food < (TROOPS[k].cost.food ?? 0) * 3 + giuLuong) continue;
    if (economy.train(k)) quan.nuoi += 1;
  }
  for (const w of ['attack', 'armour'] as const) {
    if (!economy.smithBlock(w)) economy.buySmith(w);
  }
  /*
   * San thu: chi khi dot giac con xa va quan dong gap doi suc thu. Nguoi choi can than cung
   * lam the — di luc vua du suc la nga gan nua doi quan ngay truoc mot dot giac.
   */
  if (economy.state.threat.next > 120 && economy.huntPower() > 0) {
    for (const key of economy.state.revealed) {
      const [cx, cz] = key.split(',').map(Number);
      const d = denOf(cx, cz);
      if (!d || economy.isHunted(d.id)) continue;
      if (economy.huntPower() < denPower(d) * 2) continue;
      const r = economy.hunt(d);
      if (r) { quan.san += 1; quan.nga += TROOP_KINDS.reduce((n, k) => n + r.lost[k], 0); }
    }
  }
}
const MOC = [300, 600, 1800, 3600, 7200, 14400];
const DT = 0.25;
let moc = 0;
let sim = 0;

/** Phút nào loại này lần đầu vào kho. Chỗ trống nghĩa là cả ván không thấy. */
const lanDau: Partial<Record<ResourceKind, number>> = {};
/** Phút nào bãi loại này lần đầu lộ khỏi màn mây. */
const thayBai: Partial<Record<ResourceKind, number>> = {};

const hang = (n: number, w: number) => String(Math.floor(n)).padStart(w);

/** Mùa bão: đếm thắng thua và tổng thiệt hại, để biết luật có cân hay không. */
const dot = { thang: 0, thua: 0, cap: 0, mat: 0, thuong: 0, den: 0, ha: 0, thoat: 0 };
const bien = { chuyen: 0, trung: 0, khong: 0, mat: 0, vang: 0, manh: 0 };
const theoTam: Record<string, number> = {};
/** Quan: ra lo bao nhieu, bo di bao nhieu. Quan cuoi van bang 0 co the la chua nuoi noi
 *  mot nguoi, cung co the la nuoi roi chet doi het — hai chuyen khac han nhau. */
const quan = { nuoi: 0, bo: 0, san: 0, nga: 0 };
economy.onDesert = () => { quan.bo += 1; };
economy.onVoyage = (r) => {
  bien.chuyen += 1;
  theoTam[r.band] = (theoTam[r.band] ?? 0) + 1;
  if (r.outcome === 'lost') bien.mat += 1;
  else if (r.outcome === 'empty') bien.khong += 1;
  else { bien.trung += 1; bien.vang += r.gold; bien.manh += r.relics; }
};
economy.onLair = (r) => {
  hai.chim += r.sunk;
  if (r.won) hai.hang += 1; else hai.thuaHang += 1;
};
economy.onWave = (r) => {
  if (r.sea) {
    hai.cuop += 1;
    hai.chan += r.sea.stopped;
    hai.lot += r.sea.landed;
    hai.chim += r.sea.sunk;
  }
  dot.den += r.count;
  dot.ha += r.killed;
  dot.thoat += r.escaped;
  if (r.won) {
    dot.thang += 1;
    for (const k of RESOURCE_KINDS) dot.thuong += r.reward[k] ?? 0;
  } else {
    dot.thua += 1;
    dot.cap += r.levels;
    for (const k of RESOURCE_KINDS) dot.mat += r.lost[k] ?? 0;
  }
};

for (; sim <= MOC[MOC.length - 1]; sim += DT) {
  // Nguoi choi biet luat se thue linh bu cho du, ngay khi dong ho chuyen do.
  if (economy.state.threat.next <= WAVE_WARN_SECONDS) economy.hireGuards();
  workers.update(DT, false);
  fog.update(DT, economy.state.units, target, 1 / (1 - economy.bonus.survey), false,
    economy.lookouts());
  economy.tick(DT);

  for (const k of RESOURCE_KINDS) {
    if (lanDau[k] === undefined && economy.state.inv[k] > (k === 'gold' ? 200 : 20)) {
      lanDau[k] = sim / 60;
    }
  }

  if (sim % 2 < DT / 2) {
    // Quan doi TRUOC di bien: ca hai an luong thuc, ma len thoi dai thi mo ra ca mot nhanh
    // choi con chuyen di bien chi la mot mon lai. Ban dau de di bien truoc va do ra ban mo
    // phong ket o Thoi Dung Lang suot bon tieng - khong bao gio gom noi 400 luong.
    quanDoi();
    hamDoi();
    diBien();
    if (economy.canHire() && economy.canAfford(economy.hireCost())) {
      economy.hire((h) => workers.spawnVillager(h));
    } else {
      let xong = false;
      // Dang de danh len thoi dai thi khong dong them cai gi tieu vao dung khoan ay.
      const danh = deDanh();
      const tieuDuoc = (c: Cost) => !danh || RESOURCE_KINDS.every(
        (k) => economy.state.inv[k] - (c[k] ?? 0) >= (danh[k] ?? 0));
      // Nguoi choi that bam vao can nha chua du tien la ca lang quay sang gom dung thu con
      // thieu (nut GATHER). Con bot cung bam, mot lan cho moi loai nha moi.
      const muon = nhaMoi();
      if (muon && !economy.state.demand && !economy.canAfford(economy.buildCostFor(muon))) {
        economy.setDemand(economy.buildCostFor(muon), BUILDINGS[muon].label);
      }
      for (const t of XAY) {
        // Choi canh xay THEO NHU CAU, khong xay cho vui: nguoi choi that nhin hai con so
        // thu/giac roi moi quyet. Xay bua thi con so nhip choi doc ra la "neu tieu tien
        // nham", chu khong phai "mua bao ton bao nhieu".
        if (t === 'watchtower' && economy.guard() >= economy.wavePower()) continue;
        // Da du so thi khoi quet: placeBlock se tu choi o MOI o, tuc 6.400 lan goi vo ich.
        if (economy.countOf(t) >= (BUILD_LIMIT[t] ?? Infinity)) continue;
        if (!economy.canAfford(economy.buildCostFor(t))) continue;
        if (t !== muon && !tieuDuoc(economy.buildCostFor(t))) continue;
        /*
         * Tu ban "dat tu do", cong trinh dung tren O LUC GIAC chu khong con tren nen dat
         * sinh san. Ban mo phong khong thiet ke duoc bo cuc, nhung no phai dong vai mot
         * nguoi choi biet dieu toi thieu: xay tu trong ra ngoai, va khong ai dung choi
         * canh cach lang sau chuc don vi.
         */
        const o = oTrong(t);
        if (o && economy.build(o[0], o[1], t)) { xong = true; break; }
      }
      if (!xong) {
        for (const b of [...economy.state.buildings].sort((a, z) => a.level - z.level)) {
          if (!tieuDuoc(economy.costFor(b.type, b.level))) continue;
          if (economy.upgrade(b)) break;
        }
      }
    }
  }

  if (sim % 5 < DT / 2) {
    const us = economy.state.units;
    if (us.length) {
      target.set(us.reduce((s, u) => s + u.position[0], 0) / us.length, 0,
        us.reduce((s, u) => s + u.position[2], 0) / us.length);
    }
    map.update(target);
    for (const b of map.patches) {
      if (thayBai[b.kind] === undefined && fog.isRevealed(b.center[0], b.center[2])) {
        thayBai[b.kind] = sim / 60;
      }
    }
  }

  if (moc < MOC.length && sim >= MOC[moc]) {
    const s = economy.state;
    const nha: Record<string, number> = {};
    for (const b of s.buildings) nha[b.type] = (nha[b.type] ?? 0) + 1;
    console.log([
      `${String(MOC[moc] / 60).padStart(3)} phút`,
      `cấp ${hang(s.level, 2)}`,
      `${hang(economy.villagers().length, 2)} dân`,
      `vàng ${hang(s.totalGold, 6)}`,
      // RESOURCES[k].icon gio la TEN icon ('food', 'wood'...) chu khong con la emoji, nen
      // lay ba chu dau cua nhan de bang van doc duoc.
      ...RESOURCE_KINDS.filter((k) => k !== 'gold')
        .map((k) => `${RESOURCES[k].label.slice(0, 3)}${hang(s.inv[k], 5)}`),
      `xa ${hang(s.maxReach, 4)}`,
      `vén ${hang(fog.revealedCount, 3)}`,
      Object.entries(nha).map(([k, v]) => `${k}×${v}`).join(' '),
    ].join(' · '));
    moc += 1;
  }
}

const phut = (v?: number) => (v === undefined ? 'KHÔNG BAO GIỜ' : `phút ${v.toFixed(0)}`);
console.log('\n--- lần đầu nhìn thấy / lần đầu vào kho ---');
for (const k of RESOURCE_KINDS) {
  if (k === 'gold') continue;
  console.log(`  ${RESOURCES[k].label.padEnd(14)} bãi: ${phut(thayBai[k]).padEnd(14)}`
    + ` kho: ${phut(lanDau[k])}`);
}

// Bãi xa có đáng đi không: so bãi tốt nhất của từng loại, theo thu nhập mỗi giây.
console.log('\n--- bãi tốt nhất mỗi loại, nhìn từ thủ phủ ---');
const ke = economy.villagers()[0];
for (const k of RESOURCE_KINDS) {
  if (k === 'gold') continue;
  const cua = map.patches.filter((b) => b.kind === k);
  if (!cua.length) { console.log(`  ${RESOURCES[k].label.padEnd(14)} không có bãi nào`); continue; }
  let best = cua[0];
  let bestRate = 0;
  for (const b of cua) {
    const d = Math.hypot(b.center[0], b.center[2]);
    const giay = (d * 2) / Math.max(0.5, ke?.speed ?? 2.5) + 2;
    const rate = (ke?.capacity ?? 10) * b.richness * RESOURCES[k].value / giay;
    if (rate > bestRate) { bestRate = rate; best = b; }
  }
  const gan = Math.min(...cua.map((b) => Math.hypot(b.center[0], b.center[2])));
  console.log(`  ${RESOURCES[k].label.padEnd(14)} ${String(cua.length).padStart(3)} bãi`
    + ` · gần nhất ${hang(gan, 4)}`
    + ` · tốt nhất ở ${hang(Math.hypot(best.center[0], best.center[2]), 4)}`
    + ` (giàu ×${best.richness.toFixed(2)}) → ${bestRate.toFixed(3)}/giây`);
}

console.log('\n--- chợ của thủ phủ ---');
const hall = economy.state.buildings.find((b) => b.type === 'townhall');
console.log(`  thủ phủ cấp ${hall?.level ?? 0} → bán tối đa ${economy.marketRate().toFixed(1)} món/giây`);
console.log(`  chạy hết công suất ${Math.round((nhipDay / Math.max(1, nhipCo)) * 100)}% thời gian`);
for (const k of RESOURCE_KINDS) {
  if (k === 'gold') continue;
  const b = daBan[k] ?? 0;
  console.log(`  ${RESOURCES[k].label.padEnd(14)} bán ${hang(b, 7)} món`
    + ` = ${hang(b * RESOURCES[k].value, 7)} vàng`
    + ` · còn tồn ${hang(economy.state.inv[k], 6)}`);
}

console.log('\n--- thế giới ---');
console.log(`  bãi đang nạp ${map.patches.length}`);
console.log(`  bản lưu ${(JSON.stringify(economy.state).length / 1024).toFixed(1)} KB`);

console.log('');
console.log('--- mùa bão ---');
console.log(`  ${dot.thang + dot.thua} đợt · đẩy lui ${dot.thang} · thua ${dot.thua}`);
console.log(`  mất ${Math.round(dot.mat)} món hàng và ${dot.cap} cấp công trình`
  + ` · nhặt được ${Math.round(dot.thuong)} từ xác tàu`);
console.log(`  giặc tới ${dot.den} tên · hạ ${dot.ha}`
  + ` (${(dot.ha / Math.max(1, dot.den) * 100).toFixed(0)}%) · ôm hàng chạy thoát ${dot.thoat}`);
const q = economy.state.army;
console.log(`  thời đại ${economy.state.age} · quân cuối ván:`
  + ` ${q.spear} giáo, ${q.archer} cung, ${q.horse} ngựa, ${q.mage} pháp sư, ${q.siege} xe pháo`
  + ` · rèn ${economy.state.smith.attack}/${economy.state.smith.armour}`);
console.log(`  còn kẹt thời đại vì: ${economy.ageBlock() ?? 'không gì cả'}`
  + ` · cần ${JSON.stringify(economy.nextAge()?.cost ?? {})}`);
console.log(`  săn thú: dẹp ${quan.san} hang · ngã ${quan.nga} lính`);
console.log(`  nuôi ra lò ${quan.nuoi} lính · bỏ đi vì đói ${quan.bo}`
  + ` · lương quân ăn ${(economy.upkeep() * 60).toFixed(0)}/phút`);
const choi = economy.state.buildings.filter((b) => b.type === 'watchtower');
console.log(`  cuối ván: ${choi.length} chòi canh (${choi.map((b) => b.level).join('+') || '0'})`
  + ` · sức thủ ${economy.guard()} · đợt tới mạnh ${economy.wavePower()}`);
console.log('');
console.log('--- hải chiến ---');
console.log(`  đóng ${hai.dong} chiến thuyền · còn ${economy.state.fleet} · chìm ${hai.chim}`);
console.log(`  ${hai.cuop} đợt có giặc biển · chặn ${hai.chan} sức · lọt ${hai.lot} sức`);
console.log(`  hang hải tặc: dẹp ${hai.hang} · bị đánh bật ${hai.thuaHang}`);
console.log('');
console.log('--- đi biển ---');
console.log(`  ${bien.chuyen} chuyến · trúng ${bien.trung} · tay không ${bien.khong} · mất người ${bien.mat}`);
console.log(`  mang về ${bien.vang} vàng và ${bien.manh} mảnh cổ vật`);
console.log(`  theo tầm: ${VOYAGES.map((v) => `${v.label} ${theoTam[v.id] ?? 0}`).join(' · ')}`);
