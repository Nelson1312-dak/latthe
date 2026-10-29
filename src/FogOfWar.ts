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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, REVEAL_RADIUS, SURVEY_SECONDS } from './config';
import type { Unit } from './types';
import { CHUNK, KEEP_RADIUS, chunkKey, chunkOf, chunkRng } from './world';

/**
 * Số đám mây trên một ô. Bốn đám to thay cho bảy khối nhỏ: đất chưa vén giờ đã nhạt màu
 * và trống trơn (xem MapManager), nên mây không còn phải che kín — chỉ cần nói "chỗ này
 * chưa ai tới".
 */
const PUFFS = 4;
const PUFF_SECONDS = 1.0;
/** Đủ cho (2·KEEP+1)² ô, dư một ít. */
const CAP = 720;

/** Một đám mây: vị trí gốc suy từ toạ độ ô, nên không phải lưu. */
interface Cloud { x: number; z: number; s: number; rot: number; phase: number }

interface Slot {
  key: string;
  cx: number;
  cz: number;
  from: number;
  clouds: Cloud[];
  /** Mặt đất dưới tâm ô — mây bay cao hơn chừng ấy. */
  ground: number;
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
  private readonly up = new THREE.Vector3(0, 1, 0);
  private lastCenter = '';
  private elapsed = 0;
  /** Cao độ mặt đất — Game nối vào MapManager. Mặc định 0 cho môi trường không có bản đồ. */
  private ground: (x: number, z: number) => number = () => 0;

  onReveal: ((key: string) => void) | null = null;
  /** Báo khi danh sách ô đã vén bị đặt lại, để bản đồ tô lại đất. */
  onResync: (() => void) | null = null;

  constructor(revealed: string[]) {
    this.revealed = new Set(revealed);
    /*
     * Mây MỀM thay cho khối 12 mặt phẳng cạnh.
     *
     * Khối cũ đổ bóng phẳng từng mặt, nên trên nền đất sáng nó đọc ra như một đống đá trắng
     * chứ không như mây. Giờ mỗi đám là bốn quả cầu chồng lên nhau, đổ bóng TRƠN, hàn thành
     * một hình — chỗ các quả cầu giao nhau tạo ra nếp gấp, và AO bám vào đó cho ra dáng bông.
     * Đục chứ không trong: mây trong suốt thì AO vẫn tính nó như vật đặc, ra quầng tối lạ.
     */
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, y, z, r] of [
      [0, 0.62, 0, 0.66], [0.6, 0.42, 0.12, 0.46], [-0.56, 0.4, -0.06, 0.44], [0.06, 0.38, 0.5, 0.4],
    ] as const) {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate(x, y, z);
      parts.push(g);
    }
    const geo = mergeGeometries(parts, false) ?? parts[0];
    geo.scale(1, 0.82, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color: PALETTE.cloud, roughness: 1, metalness: 0,
      // Tự sáng một chút để mây vẫn trắng ở phía khuất nắng: mây xám thì đọc ra là khói.
      emissive: 0xffffff, emissiveIntensity: 0.16,
    }), CAP);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.group.add(this.mesh);
  }

  /** Nối cao độ mặt đất. */
  setGround(fn: (x: number, z: number) => number): void {
    this.ground = fn;
  }

  /** Các đám mây của một ô. Suy từ toạ độ nên không phải lưu. */
  private cloudsOf(cx: number, cz: number): Cloud[] {
    const r = chunkRng(cx, cz, 9);
    const out: Cloud[] = [];
    for (let k = 0; k < PUFFS; k += 1) {
      const a = (k / PUFFS) * Math.PI * 2 + r() * 1.2;
      const d = k === 0 ? r() * 3 : 7 + r() * 5;
      out.push({
        x: cx * CHUNK + CHUNK / 2 + Math.cos(a) * d,
        z: cz * CHUNK + CHUNK / 2 + Math.sin(a) * d,
        s: k === 0 ? 7.5 + r() * 1.5 : 4.6 + r() * 2.2,
        rot: r() * Math.PI * 2,
        phase: r() * Math.PI * 2,
      });
    }
    return out;
  }

  /**
   * Ma trận của đám mây thứ i trong một ô, ở thời điểm hiện tại.
   *
   * `co` là hệ số cỡ (khảo sát thì co lại, vén thì phồng rồi xẹp), `toa` là độ trôi ra xa
   * tâm ô và `bay` là độ bay lên — hai thứ chỉ khác 0 lúc đang vén. Mọi đám đều nhấp nhô
   * chậm theo pha riêng, nên cả biển mây không thở cùng một nhịp.
   */
  private cloudMatrix(slot: Slot, i: number, co: number, toa: number, bay: number): THREE.Matrix4 {
    const c = slot.clouds[i];
    const tx = slot.cx * CHUNK + CHUNK / 2;
    const tz = slot.cz * CHUNK + CHUNK / 2;
    const dx = c.x - tx;
    const dz = c.z - tz;
    const len = Math.hypot(dx, dz) || 1;
    const nhap = Math.sin(this.elapsed * 0.55 + c.phase) * 0.22;
    this.v.set(
      c.x + (dx / len) * toa + Math.cos(this.elapsed * 0.13 + c.phase) * 0.35,
      slot.ground + 3.1 + nhap + bay,
      c.z + (dz / len) * toa + Math.sin(this.elapsed * 0.11 + c.phase) * 0.35);
    this.q.setFromAxisAngle(this.up, c.rot);
    const s = c.s * co;
    this.s.set(s, s, s);
    return this.m.compose(this.v, this.q, this.s);
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
        const ox = (cx + dx) * CHUNK + CHUNK / 2;
        const oz = (cz + dz) * CHUNK + CHUNK / 2;
        keep.set(k, {
          key: k, cx: cx + dx, cz: cz + dz, from: index,
          clouds: old?.clouds ?? this.cloudsOf(cx + dx, cz + dz),
          ground: Math.max(0, this.ground(ox, oz)),
          survey: old?.survey ?? 0, fading: old?.fading ?? null,
        });
        index += PUFFS;
      }
    }
    this.slots.clear();
    for (const [k, s] of keep) this.slots.set(k, s);
    this.mesh.count = index;
    // Vẽ ngay: không có khung hình nào được phép thấy mây ở ma trận cũ của ô khác.
    this.draw();
  }

  /** Đặt lại danh sách ô đã vén. Dùng khi làm lại từ đầu. */
  resync(revealed: string[]): void {
    this.revealed.clear();
    for (const k of revealed) this.revealed.add(k);
    this.slots.clear();
    this.lastCenter = '';
    this.mesh.count = 0;
    this.onResync?.();
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
  /**
   * Ô chưa vén gần nhất, nhưng chỉ trong tầm `banKinh` TÍNH TỪ THỦ PHỦ.
   *
   * Thiếu cái tầm ấy thì người đi thám hiểm không bao giờ quay về: ô chưa vén gần nhất luôn
   * nằm ngay cạnh chỗ họ vừa tới, nên họ cứ thế đi thẳng ra mép thế giới. Đo được: sau một
   * giờ, người thám hiểm đứng cách nhà 330 đơn vị và không còn đóng góp gì cho làng nữa.
   * Buộc tầm theo thủ phủ thì chân trời nở ra cùng với làng, chứ không chạy trước nó.
   */
  nearestUnrevealed(
    from: [number, number, number], banKinh = Infinity,
  ): [number, number, number] | null {
    let best: [number, number, number] | null = null;
    let bestDist = Infinity;
    for (const s of this.slots.values()) {
      const cx = s.cx * CHUNK + CHUNK / 2;
      const cz = s.cz * CHUNK + CHUNK / 2;
      if (Math.hypot(cx, cz) > banKinh) continue;
      const d = Math.hypot(cx - from[0], cz - from[2]);
      if (d < bestDist) { bestDist = d; best = [cx, 0, cz]; }
    }
    return best;
  }

  /**
   * `ve = false` khi tua nhanh lúc người chơi quay lại: khảo sát và vén vẫn chạy đủ (đó là
   * gameplay), nhưng không dựng ma trận cho hàng trăm đám mây ở mỗi bước không ai nhìn thấy.
   */
  update(dt: number, units: Unit[], center: THREE.Vector3, surveySpeed = 1, ve = true): void {
    this.restream(center);
    this.elapsed += dt;

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
          if (slot.survey > 0) slot.survey = Math.max(0, slot.survey - dt * 0.5);
          continue;
        }
        slot.survey += dt * surveySpeed;
        if (slot.survey < SURVEY_SECONDS) continue;
        slot.fading = 0;
        this.revealed.add(slot.key);
        this.onReveal?.(slot.key);
      }

      slot.fading += dt;
      if (slot.fading >= PUFF_SECONDS) {
        // Hết hoạt cảnh: thu mây về 0 nhưng GIỮ chỗ trong bộ đệm tới lần restream sau, để
        // chỉ số của các ô khác không bị xô lệch giữa chừng.
        for (let i = 0; i < PUFFS; i += 1) this.mesh.setMatrixAt(slot.from + i, this.hidden);
        this.slots.delete(slot.key);
      }
    }

    if (ve) this.draw();
  }

  /**
   * Vẽ lại mọi đám mây đang sống.
   *
   * Khảo sát dở thì mây co lại tới 30% và run nhẹ — người chơi thấy việc đứng đó có tác dụng.
   * Vén thì mây phồng lên một nhịp, trôi ra xa tâm ô và bay lên rồi xẹp hẳn: mây TÁCH RA
   * nhường chỗ, chứ không teo lại như bị hút đi.
   */
  private draw(): void {
    for (const slot of this.slots.values()) {
      let co = 1;
      let toa = 0;
      let bay = 0;
      if (slot.fading !== null) {
        const k = Math.min(1, slot.fading / PUFF_SECONDS);
        co = k < 0.25 ? 1 + k * 0.6 : Math.max(0, 1.15 * (1 - (k - 0.25) / 0.75));
        toa = k * k * 9;
        bay = k * 3;
      } else if (slot.survey > 0) {
        const k = slot.survey / SURVEY_SECONDS;
        co = 1 - k * 0.3 + Math.sin(this.elapsed * 9) * 0.015 * k;
      }
      for (let i = 0; i < PUFFS; i += 1) {
        this.mesh.setMatrixAt(slot.from + i,
          co <= 0.001 ? this.hidden : this.cloudMatrix(slot, i, co, toa, bay));
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
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
