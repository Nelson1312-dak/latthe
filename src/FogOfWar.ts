/**
 * Màn mây trên một lưới VÔ HẠN.
 *
 * Không còn 36 ô cố định. Ô sương trùng với khối bản đồ, nên số ô là vô hạn — nhưng chỉ
 * những ô đang nạp mới có mây thật trong cảnh, và bản lưu chỉ nhớ DANH SÁCH Ô ĐÃ VÉN.
 * Danh sách đó lớn dần theo đúng công sức người chơi bỏ ra, chứ không theo kích thước thế
 * giới — đó là lý do một bản đồ vô hạn vẫn lưu được vào localStorage.
 *
 * Vén một ô cần ĐỨNG LẠI khảo sát, không phải đi ngang qua. Đo ở bản cũ: chỉ cần lướt qua
 * thì cả bản đồ sạch bong trong chưa tới ba phút, và khám phá xong trước khi người chơi kịp
 * nhận ra có thứ để khám phá.
 */
import * as THREE from 'three';
import { PALETTE, REVEAL_RADIUS, SURVEY_SECONDS } from './config';
import type { Unit } from './types';
import { CHUNK, KEEP_RADIUS, chunkKey, chunkOf } from './world';

/** Số khối mây trên một ô. */
const PUFFS = 7;
const PUFF_SECONDS = 0.85;
/** Đủ cho (2·KEEP+1)² ô, dư một ít. */
const CAP = 1100;

interface Slot {
  key: string;
  cx: number;
  cz: number;
  from: number;
  /** Giây đã khảo sát. */
  survey: number;
  /** Giây đã trôi của hoạt cảnh tan; null nghĩa là chưa tan. */
  fading: number | null;
}

export class FogOfWar {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly revealed: Set<string>;
  private readonly slots = new Map<string, Slot>();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private lastCenter = '';

  onReveal: ((key: string) => void) | null = null;

  constructor(revealed: string[]) {
    this.revealed = new Set(revealed);
    this.mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({
        color: PALETTE.cloud, transparent: true, opacity: 0.95, flatShading: true,
      }), CAP);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < CAP; i += 1) this.mesh.setMatrixAt(i, this.hidden);
    this.group.add(this.mesh);
  }

  /** Ma trận gốc của khối mây thứ k trong một ô. Suy từ toạ độ nên không phải lưu. */
  private puff(cx: number, cz: number, k: number): THREE.Matrix4 {
    const a = (k / PUFFS) * Math.PI * 2 + cx * 0.7 + cz * 0.3;
    const d = k === 0 ? 0 : CHUNK * 0.28;
    const scale = k === 0 ? 5.2 : 3.0 + ((cx + cz + k) % 3) * 0.8;
    this.v.set(
      cx * CHUNK + CHUNK / 2 + Math.cos(a) * d,
      3.4 + ((cx + k) % 3) * 0.6,
      cz * CHUNK + CHUNK / 2 + Math.sin(a) * d);
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    this.s.set(scale, scale * 0.7, scale);
    return this.m.clone().compose(this.v, this.q, this.s);
  }

  /** Dựng lại tập ô có mây quanh tâm ngắm. Chỉ chạy khi bước sang khối mới. */
  private restream(center: THREE.Vector3): void {
    const cx = chunkOf(center.x);
    const cz = chunkOf(center.z);
    const key = chunkKey(cx, cz);
    if (key === this.lastCenter) return;
    this.lastCenter = key;

    const keep = new Map<string, Slot>();
    let index = 0;
    for (let dx = -KEEP_RADIUS; dx <= KEEP_RADIUS; dx += 1) {
      for (let dz = -KEEP_RADIUS; dz <= KEEP_RADIUS; dz += 1) {
        const k = chunkKey(cx + dx, cz + dz);
        if (this.revealed.has(k)) continue;
        if (index + PUFFS > CAP) continue;
        const old = this.slots.get(k);
        keep.set(k, {
          key: k, cx: cx + dx, cz: cz + dz, from: index,
          survey: old?.survey ?? 0, fading: old?.fading ?? null,
        });
        index += PUFFS;
      }
    }
    this.slots.clear();
    for (const [k, s] of keep) this.slots.set(k, s);

    for (let i = 0; i < CAP; i += 1) this.mesh.setMatrixAt(i, this.hidden);
    for (const slot of this.slots.values()) {
      for (let i = 0; i < PUFFS; i += 1) {
        this.mesh.setMatrixAt(slot.from + i, this.puff(slot.cx, slot.cz, i));
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Đặt lại danh sách ô đã vén. Dùng khi làm lại từ đầu. */
  resync(revealed: string[]): void {
    this.revealed.clear();
    for (const k of revealed) this.revealed.add(k);
    this.slots.clear();
    this.lastCenter = '';
    for (let i = 0; i < CAP; i += 1) this.mesh.setMatrixAt(i, this.hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  isRevealed(x: number, z: number): boolean {
    return this.revealed.has(chunkKey(chunkOf(x), chunkOf(z)));
  }

  revealedKeys(): string[] {
    return [...this.revealed];
  }

  get revealedCount(): number {
    return this.revealed.size;
  }

  /** Ô đang được khảo sát và tiến độ, để UI nói cho người chơi biết. */
  surveying(): { key: string; progress: number } | null {
    let best: Slot | null = null;
    for (const s of this.slots.values()) if (s.survey > 0 && (!best || s.survey > best.survey)) best = s;
    return best ? { key: best.key, progress: best.survey / SURVEY_SECONDS } : null;
  }

  /**
   * Ô chưa vén gần nhất trong vùng đang nạp, để cắt người đi thám hiểm.
   *
   * Chỉ xét những ô ĐANG CÓ MÂY THẬT trong cảnh. Trên một bản đồ vô hạn, "ô chưa vén gần
   * nhất" nếu tính cả vùng chưa nạp thì có vô số đáp án bằng nhau và người thám hiểm sẽ đi
   * mãi về một hướng.
   */
  nearestUnrevealed(from: [number, number, number]): [number, number, number] | null {
    let best: [number, number, number] | null = null;
    let bestDist = Infinity;
    for (const s of this.slots.values()) {
      const cx = s.cx * CHUNK + CHUNK / 2;
      const cz = s.cz * CHUNK + CHUNK / 2;
      const d = Math.hypot(cx - from[0], cz - from[2]);
      if (d < bestDist) { bestDist = d; best = [cx, 0, cz]; }
    }
    return best;
  }

  update(dt: number, units: Unit[], center: THREE.Vector3): void {
    this.restream(center);
    let dirty = false;

    for (const slot of [...this.slots.values()]) {
      const cx = slot.cx * CHUNK + CHUNK / 2;
      const cz = slot.cz * CHUNK + CHUNK / 2;

      if (slot.fading === null) {
        // Khoảng cách tới CẠNH ô, không phải tới tâm.
        const near = units.some((u) => {
          const dx = Math.max(0, Math.abs(u.position[0] - cx) - CHUNK / 2);
          const dz = Math.max(0, Math.abs(u.position[2] - cz) - CHUNK / 2);
          return Math.hypot(dx, dz) <= REVEAL_RADIUS;
        });
        if (!near) {
          if (slot.survey > 0) { slot.survey = Math.max(0, slot.survey - dt * 0.5); dirty = true; }
          continue;
        }
        slot.survey += dt;
        if (slot.survey < SURVEY_SECONDS) {
          const k = slot.survey / SURVEY_SECONDS;
          for (let i = 0; i < PUFFS; i += 1) {
            const base = this.puff(slot.cx, slot.cz, i);
            base.scale(new THREE.Vector3(1 - k * 0.35, 1 - k * 0.35, 1 - k * 0.35));
            this.mesh.setMatrixAt(slot.from + i, base);
          }
          dirty = true;
          continue;
        }
        slot.fading = 0;
        this.revealed.add(slot.key);
        this.onReveal?.(slot.key);
      }

      slot.fading += dt;
      const k = Math.min(1, slot.fading / PUFF_SECONDS);
      // Phồng lên một nhịp rồi xẹp hẳn: mây bung ra chứ không teo lại như bị hút.
      const scale = k < 0.3 ? 1 + k * 0.8 : Math.max(0, 1.24 * (1 - (k - 0.3) / 0.7));
      for (let i = 0; i < PUFFS; i += 1) {
        const idx = slot.from + i;
        if (scale <= 0.001) {
          this.mesh.setMatrixAt(idx, this.hidden);
        } else {
          const base = this.puff(slot.cx, slot.cz, i);
          base.scale(new THREE.Vector3(scale, scale, scale));
          base.elements[13] += k * 2.4;
          this.mesh.setMatrixAt(idx, base);
        }
      }
      dirty = true;
      if (k >= 1) this.slots.delete(slot.key);
    }

    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Tiếng chuông khi vén được vùng mới. Dựng bằng WebAudio chứ không tải tệp: một tiếng chuông
 * ngắn không đáng để thêm một yêu cầu mạng vào gói.
 */
let audio: AudioContext | null = null;

export function chime(muted: boolean): void {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;
    for (const [i, freq] of [660, 880, 1320].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.07, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.45);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.5);
    }
  } catch {
    /* trình duyệt chưa cho phát tiếng — không phải lý do để game dừng lại */
  }
}
