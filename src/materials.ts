/**
 * Chất liệu của cả thế giới, quy định ở đúng một chỗ.
 *
 * Trước đây mỗi tệp tự dựng `MeshLambertMaterial` của riêng nó. Lambert không có khái niệm
 * nhám hay kim loại, nên không thể nói "mọi bề mặt phải nhám ít nhất 0,6" — bề mặt chỉ nhận
 * ánh sáng khuếch tán, hết. Đổi sang `MeshStandardMaterial` thì hai con số ấy thành thật, và
 * cả game dùng chung một bộ nên không còn chỗ nào lệch đi.
 *
 * Ba loại, không hơn:
 *   mờ   — gần như mọi thứ: đất, cây, tường, mái, dân làng
 *   kim  — chỉ những phần thật sự là kim loại, tức quặng vàng
 *   ngọc — pha lê: nhám vừa phải và tự phát sáng, nên nó nổi trong vùng cao nguyên tối
 *
 * Nhám cao (0,82) là thứ giữ cho cảnh vật ở dạng low-poly phẳng: bề mặt bóng sẽ sinh ra
 * điểm loé chạy theo camera, và trên một bản đồ toàn khối sáu mặt thì những điểm loé ấy đọc
 * ra như lỗi dựng hình chứ không ra chất liệu.
 */
import * as THREE from 'three';

/** Nhám tối thiểu của mọi bề mặt không phải kim loại. */
export const ROUGHNESS = 0.82;
/** Kim loại tối đa của mọi bề mặt không phải kim loại. */
export const METALNESS = 0.04;

/**
 * Thời gian của gió, dùng chung cho mọi tán lá. MapManager tăng nó mỗi khung.
 */
export const WIND = { value: 0 };

/**
 * Cho một vật liệu đung đưa theo gió — chạy trong vertex shader, gần như không tốn gì.
 *
 * Kèm một luật màu cho hình CÓ MÀU ĐỈNH: đỉnh trắng nhận màu của bản như thường, đỉnh có màu
 * giữ nguyên màu của nó. Mặc định three NHÂN hai màu với nhau, mà nâu nhân xanh thì ra gần
 * như đen — nên trước đây thân cây phải mang luôn màu tán lá. Luật này cho thân nâu và tán
 * xanh nằm chung một hình, một lệnh vẽ.
 *
 * Độ lệch tỉ lệ với BÌNH PHƯƠNG độ cao cục bộ: gốc đứng yên, ngọn lắc nhiều — đó là cách một
 * thân cây uốn. Pha lấy từ vị trí của từng bản, nên cả khu rừng không lắc răm rắp cùng một
 * nhịp. Bóng đổ không lắc theo (bóng vẽ bằng vật liệu độ sâu riêng); với gió nhẹ thế này thì
 * mắt không nhận ra.
 *
 * Mọi vật liệu dùng chung một thân hàm onBeforeCompile, nên chung một chương trình shader;
 * chỉ có độ mạnh `uSway` là riêng của từng vật liệu.
 */
export function sway<T extends THREE.Material>(mat: T, amount: number): T {
  const u = { value: amount };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND;
    shader.uniforms.uSway = u;
    shader.vertexShader = 'uniform float uTime;\nuniform float uSway;\n' + shader.vertexShader
      .replace('#include <color_vertex>', `#include <color_vertex>
#if defined( USE_COLOR ) && defined( USE_INSTANCING_COLOR ) && ! defined( USE_COLOR_ALPHA )
      vColor = color.r + color.g + color.b > 2.99 ? instanceColor.xyz : color.xyz;
#endif`)
      .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
#ifdef USE_INSTANCING
      vec3 goc = instanceMatrix[3].xyz;
#else
      vec3 goc = vec3(0.0);
#endif
      float cao = max(transformed.y, 0.0);
      float gio = sin(uTime * 1.3 + goc.x * 0.35 + goc.z * 0.27) * 0.6
                + sin(uTime * 2.3 + goc.x * 0.9 - goc.z * 0.5) * 0.25;
      transformed.x += gio * cao * cao * uSway;
      transformed.z += gio * 0.55 * cao * cao * uSway;`);
  };
  return mat;
}

/** Bề mặt thường: đất, cây, tường, mái, người. */
export function matte(color?: number, flat = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    ...(color === undefined ? {} : { color }),
    roughness: ROUGHNESS,
    metalness: METALNESS,
    flatShading: flat,
  });
}

/** Phần thật sự bằng kim loại — ngoại lệ duy nhất của trần kim loại. */
export function metal(color: number, emissive?: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.38,
    metalness: 0.7,
    flatShading: true,
    ...(emissive === undefined ? {} : { emissive, emissiveIntensity: 0.3 }),
  });
}

/**
 * Quầng sáng tròn, mềm dần ra rìa — dùng cho vùng của một bãi và cho vòng chọn.
 *
 * Thay cho hai hình phẳng cũ: một đĩa đặc mờ 30% cộng một vành RingGeometry dày 0,07. Cả
 * hai đều có MÉP CỨNG, mà một mép cứng nằm bẹp trên mặt đất thì đọc ra là một miếng dán,
 * không ra một vùng ảnh hưởng. Chuyển thành một ảnh gradient: tâm gần như trong suốt, sáng
 * dần tới đỉnh ở khoảng 92% bán kính, rồi tắt hẳn ở rìa. Không còn mép nào để mắt bám vào.
 *
 * Vẽ MỘT LẦN ra canvas rồi dùng chung, nên nó không tốn gì thêm dù có ba trăm bãi. Màu
 * trắng hết: màu thật tới từ instanceColor của từng bãi nhân lên.
 */
export function haloTexture(): THREE.CanvasTexture {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = N;
  cv.height = N;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0.00, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.84, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.93, 'rgba(255,255,255,1.00)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pha lê: không phải kim loại, nhưng tự phát sáng để đọc được giữa vùng cao nguyên tối. */
export function gem(color: number, glow = color): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: METALNESS,
    flatShading: true,
    emissive: glow,
    emissiveIntensity: 0.45,
  });
}
