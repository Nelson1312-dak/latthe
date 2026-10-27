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
