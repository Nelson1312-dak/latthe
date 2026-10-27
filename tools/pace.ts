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

(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
};

const { Economy } = await import('../src/Economy');
const { MapManager } = await import('../src/MapManager');
const { FogOfWar } = await import('../src/FogOfWar');
const { WorkerManager } = await import('../src/WorkerManager');
const { RESOURCES } = await import('../src/config');
const { RESOURCE_KINDS } = await import('../src/types');
type BuildingType = import('../src/types').BuildingType;
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

const XAY: BuildingType[] = ['house', 'granary', 'outpost'];
const MOC = [300, 600, 1800, 3600, 7200, 14400];
const DT = 0.25;
let moc = 0;
let sim = 0;

/** Phút nào loại này lần đầu vào kho. Chỗ trống nghĩa là cả ván không thấy. */
const lanDau: Partial<Record<ResourceKind, number>> = {};
/** Phút nào bãi loại này lần đầu lộ khỏi màn mây. */
const thayBai: Partial<Record<ResourceKind, number>> = {};

const hang = (n: number, w: number) => String(Math.floor(n)).padStart(w);

for (; sim <= MOC[MOC.length - 1]; sim += DT) {
  workers.update(DT);
  fog.update(DT, economy.state.units, target, 1 / (1 - economy.bonus.survey));
  economy.tick(DT);

  for (const k of RESOURCE_KINDS) {
    if (lanDau[k] === undefined && economy.state.inv[k] > (k === 'gold' ? 200 : 20)) {
      lanDau[k] = sim / 60;
    }
  }

  if (sim % 2 < DT / 2) {
    if (economy.canHire() && economy.canAfford(economy.hireCost())) {
      economy.hire((h) => workers.spawnVillager(h));
    } else {
      let xong = false;
      for (const t of XAY) {
        if (!economy.canAfford(economy.buildCostFor(t))) continue;
        const o = map.plots.find((p) => !economy.buildingAt(p.id)
          && Math.hypot(p.position[0], p.position[2]) < 80);
        if (o && economy.build(o, t)) { xong = true; break; }
      }
      if (!xong) {
        for (const b of [...economy.state.buildings].sort((a, z) => a.level - z.level)) {
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
console.log(`  bãi đang nạp ${map.patches.length} · nền đất ${map.plots.length}`);
console.log(`  bản lưu ${(JSON.stringify(economy.state).length / 1024).toFixed(1)} KB`);
