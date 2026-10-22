/**
 * Màn mây che vùng chưa khám phá, và cơ chế vén mây khi có người tới gần.
 *
 * Thế giới chia thành lưới 6×6 ô sương, mỗi ô 10×10 đơn vị. Ô nào chưa vén thì phủ một cụm
 * mây đa giác thấp lơ lửng ở cao độ 3.
 *
 * Toàn bộ mây của CẢ bản đồ là MỘT InstancedMesh. Mỗi ô giữ một dải chỉ số trong đó, nên vén
 * một ô chỉ là ghi lại mấy ma trận chứ không phải thêm bớt đối tượng khỏi cảnh — thêm bớt
 * giữa chừng buộc three dựng lại danh sách vẽ, và đó đúng là thứ gây khựng ngay lúc người
 * chơi đang nhìn hoạt cảnh vén mây.
 *
 * Bản lưu chỉ cần nhớ DANH SÁCH MÃ ô đã vén. Hình dạng thế giới sinh lại được từ hạt giống,
 * nên không có gì khác đáng lưu.
 */
import * as THREE from 'three';
import { FOG_CHUNK, HALF, PALETTE, REVEAL_RADIUS, SURVEY_SECONDS } from './config';
import type { FogChunk, Unit } from './types';

/** Số khối mây trên một ô. Nhiều thì dày đẹp, nhưng đây là thứ nhân với 36 ô. */
const PUFFS = 7;
/** Giây cho hoạt cảnh mây tan. */
const PUFF_SECONDS = 0.85;

interface Slot {
  chunk: FogChunk;
  from: number;
  count: number;
  /** Giây đã trôi của hoạt cảnh tan; null nghĩa là chưa bắt đầu. */
  fading: number | null;
  /** Giây đã khảo sát. Đủ SURVEY_SECONDS thì mây mới bắt đầu tan. */
  survey: number;
}

export class FogOfWar {
  readonly group = new THREE.Group();
  readonly chunks: FogChunk[] = [];
  private readonly slots: Slot[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly base: THREE.Matrix4[] = [];
  private readonly tmp = new THREE.Matrix4();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  /** Gọi khi một ô vừa được vén — để phát tiếng và báo UI. */
  onReveal: ((chunk: FogChunk) => void) | null = null;

  constructor(revealed: string[]) {
    const n = Math.ceil(HALF * 2 / FOG_CHUNK);
    const start = -HALF + FOG_CHUNK / 2;
    let index = 0;

    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: PALETTE.cloud, transparent: true, opacity: 0.95, flatShading: true,
    });
    const total = n * n * PUFFS;
    this.mesh = new THREE.InstancedMesh(geo, mat, total);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const cx = start + i * FOG_CHUNK;
        const cz = start + j * FOG_CHUNK;
        const id = `c${i}_${j}`;
        const chunk: FogChunk = { id, center: [cx, cz], revealed: revealed.includes(id) };
        this.chunks.push(chunk);
        const slot: Slot = { chunk, from: index, count: PUFFS, fading: null, survey: 0 };

        for (let k = 0; k < PUFFS; k += 1) {
          const a = (k / PUFFS) * Math.PI * 2 + i * 0.7 + j * 0.3;
          const d = k === 0 ? 0 : FOG_CHUNK * 0.3;
          const s = k === 0 ? 3.4 : 2.0 + ((i + j + k) % 3) * 0.5;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(cx + Math.cos(a) * d, 3 + ((i + k) % 3) * 0.5, cz + Math.sin(a) * d),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a),
            new THREE.Vector3(s, s * 0.72, s));
          this.base.push(m);
          this.mesh.setMatrixAt(index, chunk.revealed ? this.hidden : m);
          index += 1;
        }
        this.slots.push(slot);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  /** Ô sương tại một điểm, hoặc undefined nếu ngoài bản đồ. */
  chunkAt(x: number, z: number): FogChunk | undefined {
    return this.chunks.find((c) =>
      Math.abs(c.center[0] - x) <= FOG_CHUNK / 2 && Math.abs(c.center[1] - z) <= FOG_CHUNK / 2);
  }

  isRevealed(x: number, z: number): boolean {
    return this.chunkAt(x, z)?.revealed ?? true;
  }

  /**
   * Phủ mây lại đúng theo một danh sách. Gọi khi làm lại từ đầu: đối tượng màn mây sống lâu
   * hơn trạng thái game, nên reset mà không đồng bộ lại thì cả bản đồ vẫn hiện nguyên như
   * ván trước — đúng lỗi đã đo được.
   */
  resync(revealed: string[]): void {
    for (const slot of this.slots) {
      const want = revealed.includes(slot.chunk.id);
      slot.chunk.revealed = want;
      slot.fading = null;
      slot.survey = 0;
      for (let i = 0; i < slot.count; i += 1) {
        this.mesh.setMatrixAt(slot.from + i, want ? this.hidden : this.base[slot.from + i]);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Vén ngay, không hoạt cảnh. Dùng lúc dựng lại từ bản lưu. */
  revealNow(id: string): void {
    const slot = this.slots.find((s) => s.chunk.id === id);
    if (!slot || slot.chunk.revealed) return;
    slot.chunk.revealed = true;
    for (let i = 0; i < slot.count; i += 1) this.mesh.setMatrixAt(slot.from + i, this.hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Ai đó tới đủ gần thì mây tan. Kiểm theo TÂM ô chứ không theo từng khối mây: người chơi
   * cảm nhận theo vùng, và kiểm 36 tâm rẻ hơn hẳn kiểm 252 khối mỗi khung hình.
   */
  update(dt: number, units: Unit[]): void {
    let dirty = false;

    for (const slot of this.slots) {
      if (slot.chunk.revealed && slot.fading === null) continue;

      if (slot.fading === null) {
        const [cx, cz] = slot.chunk.center;
        // Khoang cach toi CANH o, khong phai toi tam.
        //
        // Ban dau lay tam roi cong ca nua o lan ban kinh, tuc 5+5=10 - ma cac tam o cung
        // cach nhau dung 10. Hau qua do duoc: dung o tam mot o la ven luon moi o ke, va mot
        // nguoi di bo ngang ban do ven sach 36 vung trong 120 giay. Ca co che kham pha bien
        // mat. Do toi canh thi dung nhu dac ta: phai toi trong vong 5 don vi cua o.
        const near = units.some((u) => {
          const dx = Math.max(0, Math.abs(u.position[0] - cx) - FOG_CHUNK / 2);
          const dz = Math.max(0, Math.abs(u.position[2] - cz) - FOG_CHUNK / 2);
          return Math.hypot(dx, dz) <= REVEAL_RADIUS;
        });
        if (!near) {
          // Rời đi giữa chừng thì công khảo sát nguội dần, nhưng không mất sạch.
          if (slot.survey > 0) { slot.survey = Math.max(0, slot.survey - dt * 0.5); dirty = true; }
          continue;
        }
        slot.survey += dt;
        if (slot.survey < SURVEY_SECONDS) {
          // Mây mỏng dần trong lúc khảo sát: người chơi thấy việc đang tiến triển.
          const k = slot.survey / SURVEY_SECONDS;
          for (let i = 0; i < slot.count; i += 1) {
            const idx = slot.from + i;
            this.tmp.copy(this.base[idx]);
            const s = 1 - k * 0.35;
            this.tmp.scale(new THREE.Vector3(s, s, s));
            this.mesh.setMatrixAt(idx, this.tmp);
          }
          dirty = true;
          continue;
        }
        slot.fading = 0;
        slot.chunk.revealed = true;
        this.onReveal?.(slot.chunk);
      }

      slot.fading += dt;
      const k = Math.min(1, slot.fading / PUFF_SECONDS);
      // Phồng lên một nhịp rồi xẹp hẳn: mây bung ra chứ không teo lại như bị hút.
      const scale = k < 0.3 ? 1 + k * 0.8 : Math.max(0, 1.24 * (1 - (k - 0.3) / 0.7));
      for (let i = 0; i < slot.count; i += 1) {
        const idx = slot.from + i;
        if (scale <= 0.001) {
          this.mesh.setMatrixAt(idx, this.hidden);
        } else {
          this.tmp.copy(this.base[idx]);
          this.tmp.scale(new THREE.Vector3(scale, scale, scale));
          // Mây bốc lên trong lúc tan.
          this.tmp.elements[13] += k * 2.2;
          this.mesh.setMatrixAt(idx, this.tmp);
        }
      }
      dirty = true;
      if (k >= 1) slot.fading = null;
    }

    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  revealedIds(): string[] {
    return this.chunks.filter((c) => c.revealed).map((c) => c.id);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Tiếng chuông khi vén được vùng mới.
 *
 * Dựng bằng WebAudio chứ không tải tệp: một tiếng chuông ngắn không đáng để thêm một yêu cầu
 * mạng và một tệp nhị phân vào gói. Bối cảnh âm thanh chỉ được tạo sau cử chỉ đầu tiên của
 * người dùng, nên hàm này tự chịu lỗi im lặng khi trình duyệt chưa cho phát.
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
