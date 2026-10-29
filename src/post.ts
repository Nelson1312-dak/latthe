/**
 * Hậu kỳ: AO chỉ tính trên vật đục, và lớp hoàn thiện cuối cùng.
 */
import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * GTAO chỉ tính trên vật ĐỤC.
 *
 * Bản gốc chỉ gạt điểm và đường ra khỏi lượt vẽ pháp tuyến; mọi lưới khác, kể cả trong suốt,
 * đều được vẽ vào bộ đệm độ sâu như một tấm đặc. Quầng bãi nằm sát đất nên chưa lộ ra gì,
 * nhưng quầng sáng của pha lê là những tấm đứng giữa không trung — AO sẽ coi chúng là vách và
 * tô một vệt tối lên mặt đất phía sau.
 */
export class OpaqueGTAOPass extends GTAOPass {
  override overrideVisibility(): void {
    super.overrideVisibility();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).transparent) m.visible = false;
    });
  }
}

/*
 * Lớp hoàn thiện, chạy SAU OutputPass, tức trên ảnh đã ánh xạ tông và đã về sRGB — nên các
 * con số dưới đây là con số mắt nhìn thấy, chỉnh trực tiếp được.
 *
 * Ba việc trong một lượt vẽ:
 *
 * 1. Lọc màu ẤM. ACES kéo vùng tối về xám lạnh; cảnh đất nặn cần bóng râm màu nâu ấm, không
 *    phải màu xi măng. Ấm nhiều nhất ở vùng tối và vùng giữa, nhạt dần ở vùng sáng để mây và
 *    tường kem không ngả vàng.
 * 2. Tối GÓC rất nhẹ. Bốn góc là chỗ HUD đứng; tối đi một chút thì kính mờ tách khỏi nền rõ
 *    hơn, và mắt tự dồn về giữa.
 * 3. MÔ HÌNH THU NHỎ (chỉ bậc Cao, tắt được): giữ nét một dải ngang quanh tâm ngắm, mờ dần ra
 *    trên và dưới. Camera nhìn chéo xuống nên mép trên là xa, mép dưới là gần — mờ theo trục
 *    dọc màn hình chính là độ sâu trường ảnh của một ống kính macro, và đó là thứ khiến cả
 *    quần đảo đọc ra như một sa bàn đặt trên bàn. 16 mẫu xếp theo xoắn ốc góc vàng: phủ đều
 *    một đĩa mà không thành vân.
 */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTilt: { value: 0 },
    uFocus: { value: 0.5 },
    uBand: { value: 0.2 },
    uBlur: { value: 4 },
    uVignette: { value: 0.16 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTilt;
    uniform float uFocus;
    uniform float uBand;
    uniform float uBlur;
    uniform float uVignette;
    varying vec2 vUv;

    vec3 grade(vec3 c) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = 1.0 - smoothstep(0.55, 1.0, l) * 0.75;
      c *= mix(vec3(1.0), vec3(1.028, 1.006, 0.962), k);
      return clamp(mix(vec3(l), c, 1.04), 0.0, 1.0);
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (uTilt > 0.0) {
        float d = max(0.0, abs(vUv.y - uFocus) - uBand) / max(0.001, 0.5 - uBand);
        float r = uBlur * uTilt * smoothstep(0.0, 1.0, d);
        if (r > 0.35) {
          vec3 acc = col;
          for (int i = 1; i <= 16; i++) {
            float f = float(i);
            float a = f * 2.39996323;
            acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * (r * sqrt(f / 16.0)) / uRes).rgb;
          }
          col = acc / 17.0;
        }
      }
      col = grade(col);
      vec2 q = (vUv - 0.5) * 2.0;
      float v = smoothstep(0.55, 1.45, length(q * vec2(1.0, 0.82)));
      col *= 1.0 - v * uVignette;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function finishPass(): ShaderPass {
  return new ShaderPass(FinishShader);
}
