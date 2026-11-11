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
 * Nhám cao (0,94) là thứ giữ cho cảnh vật ở dạng low-poly phẳng: bề mặt bóng sẽ sinh ra
 * điểm loé chạy theo camera, và trên một bản đồ toàn khối sáu mặt thì những điểm loé ấy đọc
 * ra như lỗi dựng hình chứ không ra chất liệu.
 */
import * as THREE from 'three';

/**
 * Nhám tối thiểu của mọi bề mặt không phải kim loại.
 *
 * Lên từ 0,82. Ở 0,82 thì bầu trời vẫn còn in một lớp bóng mờ lên mái ngói và tường vôi —
 * không đủ thành điểm loé, nhưng đủ để mọi thứ trông như cùng đúc từ một mẻ nhựa. Ngói nung,
 * vôi, gỗ, đất đều là chất liệu lì; 0,94 thì lớp bóng ấy tắt hẳn và màu trở về đúng màu sơn.
 */
export const ROUGHNESS = 0.94;
/** Kim loại tối đa của mọi bề mặt không phải kim loại. */
export const METALNESS = 0.04;

/**
 * Thời gian của gió, dùng chung cho mọi tán lá. MapManager tăng nó mỗi khung.
 */
export const WIND = { value: 0 };

/** Công tắc gió chung cho mọi tán lá: bậc đồ hoạ Thấp đặt về 0. */
export const SWAY_ON = { value: 1 };

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
    shader.uniforms.uSwayOn = SWAY_ON;
    shader.vertexShader = 'uniform float uTime;\nuniform float uSway;\nuniform float uSwayOn;\n' + shader.vertexShader
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
      transformed.x += gio * cao * cao * uSway * uSwayOn;
      transformed.z += gio * 0.55 * cao * cao * uSway * uSwayOn;`);
  };
  return mat;
}

/**
 * Chỉ luật màu của sway(), không lắc: cho hình có màu đỉnh mà vẫn cần màu riêng từng bản —
 * dân làng (áo theo việc, mặt và nón giữ màu), xe thồ (hàng theo loại, bò và gỗ giữ màu).
 */
export const tinted = <T extends THREE.Material>(mat: T): T => sway(mat, 0);

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

/**
 * Đốm sáng tròn mềm cho quầng quanh pha lê và quặng vàng: đặc ở tâm, tắt dần ra rìa. Khác
 * haloTexture (rỗng ở giữa, sáng ở vành) vì đây là ánh sáng toả ra từ một vật, không phải
 * đường biên của một vùng.
 */
export function glowTexture(): THREE.CanvasTexture {
  const N = 64;
  const cv = document.createElement('canvas');
  cv.width = N;
  cv.height = N;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Bầu trời dưới dạng ảnh cầu, để làm NGUỒN SÁNG chứ không phải để nhìn.
 *
 * Một HemisphereLight chỉ biết hai màu, trời và đất, pha theo pháp tuyến hướng lên hay xuống.
 * Nên mọi mặt đứng — tường nhà, vách đá, thân cây — đều nhận đúng một màu xám ở giữa, bất kể
 * nó quay về phía mặt trời hay quay đi. Đó là lý do cảnh cũ phẳng: không có thông tin nào về
 * ánh sáng ĐẾN TỪ ĐÂU ngoài một cái bóng đổ.
 *
 * Ảnh này đi qua PMREM thành bản đồ môi trường, nên mỗi hướng có màu riêng: xanh lam nhạt ở
 * đỉnh trời, một vầng ấm nơi mặt trời đứng, kem ở chân trời, và nâu ấm hắt lên từ đất. Mặt
 * quay về phía mặt trời tự ấm lên, mặt quay đi tự xanh đi — thứ mà trước đây không đèn nào
 * tả được. Nó cũng cho bề mặt một lớp phản chiếu mờ rất nhẹ, đủ để đất nặn không ra nhựa.
 *
 * Vẽ ra ảnh cầu 256×128: PMREM sẽ làm mờ nó đi rất nhiều, nên thêm điểm ảnh chỉ tốn công.
 * Toạ độ ngang là phương vị, dọc là độ cao; hàng trên cùng là thẳng đứng trên đầu.
 */
export function skyEnvTexture(sun: THREE.Vector3): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;

  const doc = g.createLinearGradient(0, 0, 0, H);
  doc.addColorStop(0.0, '#9fc3dd');   // đỉnh trời
  doc.addColorStop(0.42, '#cfe2ee');
  doc.addColorStop(0.5, '#f1e7d6');   // chân trời, ấm
  doc.addColorStop(0.62, '#c3a888');  // đất gần
  doc.addColorStop(1.0, '#8e7558');   // đất hắt lên
  g.fillStyle = doc;
  g.fillRect(0, 0, W, H);

  // Vầng mặt trời: toạ độ lấy từ chính hướng nắng, nên đổi hướng nắng là vầng sáng đi theo.
  const u = (Math.atan2(sun.x, sun.z) / (Math.PI * 2) + 0.5) * W;
  const v = (0.5 - Math.asin(Math.min(1, Math.max(-1, sun.y))) / Math.PI) * H;
  // Vẽ ba lần, lệch một vòng sang hai bên, để vầng sáng không bị cắt đôi ở mép ảnh.
  for (const dx of [-W, 0, W]) {
    const vang = g.createRadialGradient(u + dx, v, 0, u + dx, v, W * 0.3);
    vang.addColorStop(0.0, 'rgba(255,244,214,0.95)');
    vang.addColorStop(0.25, 'rgba(255,233,190,0.45)');
    vang.addColorStop(1.0, 'rgba(255,226,170,0)');
    g.fillStyle = vang;
    g.fillRect(0, 0, W, H);
  }

  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Vân bề mặt: nhiễu trơn xám, lát lại được, dùng làm hệ số nhân cho màu mặt.
 *
 * Hai tầng nhiễu, tầng sau nhỏ gấp bốn và nhạt một nửa, nên nhìn gần thấy lấm tấm mà nhìn xa
 * thấy mảng loang — chỉ một lần tra ảnh cho cả hai.
 */
export function grainTexture(): THREE.CanvasTexture {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = N;
  cv.height = N;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(N, N);
  // Băm hai chiều có LÁT LẠI: lấy dư theo cỡ lưới nên mép trái khớp mép phải.
  const bam = (x: number, y: number, n: number, salt: number): number => {
    const h = Math.sin(((x % n) + n) % n * 127.1 + (((y % n) + n) % n) * 311.7 + salt) * 43758.5453;
    return h - Math.floor(h);
  };
  const muot = (x: number, y: number, n: number, salt: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = bam(ix, iy, n, salt);
    const b = bam(ix + 1, iy, n, salt);
    const c = bam(ix, iy + 1, n, salt);
    const d = bam(ix + 1, iy + 1, n, salt);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const v = muot(x / 16, y / 16, 8, 1.3) * 0.68 + muot(x / 4, y / 4, 32, 7.7) * 0.32;
      const k = Math.round(v * 255);
      const i = (y * N + x) * 4;
      img.data[i] = k;
      img.data[i + 1] = k;
      img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  // Ảnh hệ số, KHÔNG phải màu: để ở không gian tuyến tính, không thì nó bị bẻ cong hai lần.
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Vân dùng chung cho cả thế giới — dựng một lần, mọi vật liệu trỏ vào đây. */
let vanChung: THREE.CanvasTexture | null = null;
/** Công tắc vân: bậc Thấp đặt về 0. */
export const GRAIN_ON = { value: 1 };

/**
 * Rắc vân lên một vật liệu, lấy toạ độ theo THẾ GIỚI chứ không theo UV.
 *
 * Phải theo thế giới vì ô đất và cây cối đều là InstancedMesh dùng chung một hình, mà hình ấy
 * còn chẳng có UV. Theo thế giới thì vân liền mạch qua ranh giới các ô, và hai ô cạnh nhau
 * không bị lặp y hệt — đúng thứ cần cho một mặt đất lát bằng hàng nghìn viên giống nhau.
 *
 * `co` là số đơn vị thế giới cho một lần lát, `manh` là biên độ sáng tối.
 */
export function grain<T extends THREE.Material>(mat: T, co: number, manh: number): T {
  if (!vanChung) vanChung = grainTexture();
  const u = { value: new THREE.Vector2(1 / co, manh) };
  // Để ngoài cho chỉnh được: `mat.userData.van.value` là (1/cỡ, mạnh).
  mat.userData.van = u;
  const tex = { value: vanChung };
  // Khoá chương trình phải lấy TRƯỚC khi thay onBeforeCompile: mặc định three sinh khoá từ
  // nguồn của chính hàm ấy, mà nguồn hàm dưới đây y hệt nhau dù phía trước có sway hay không
  // — không nối khoá cũ vào thì cây có gió và ô đất dùng chung nhầm một chương trình.
  const khoaTruoc = mat.customProgramCacheKey();
  const truoc = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    truoc?.call(mat, shader, renderer);
    shader.uniforms.uVan = tex;
    shader.uniforms.uVanCo = u;
    shader.uniforms.uVanOn = GRAIN_ON;
    shader.vertexShader = 'varying vec2 vVanXZ;\n' + shader.vertexShader.replace(
      '#include <fog_vertex>',
      `#include <fog_vertex>
      vec4 vanWP = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
      vanWP = instanceMatrix * vanWP;
#endif
      vVanXZ = (modelMatrix * vanWP).xz;`);
    shader.fragmentShader = 'uniform sampler2D uVan;\nuniform vec2 uVanCo;\nuniform float uVanOn;\nvarying vec2 vVanXZ;\n'
      + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float van = texture2D(uVan, vVanXZ * uVanCo.x).r;
      diffuseColor.rgb *= 1.0 + (van - 0.5) * 2.0 * uVanCo.y * uVanOn;`);
  };
  mat.customProgramCacheKey = () => `${khoaTruoc}|van`;
  return mat;
}



/**
 * Pha màu sương theo một tấm texture một texel một khối.
 *
 * Bản cũ pha sương vào màu từng ô đất trên CPU, nên vén một khối là ghi lại màu của bảy
 * trăm ô, mỗi khung, suốt một giây sáu. Ở đây vén một khối là đổi một byte. Và nó xoá hẳn
 * bài toán một khối sương nằm vắt qua hai mảnh đất — sương ở trong toạ độ thế giới, mảnh
 * đất không cần biết gì về nó.
 */
export function fogPaint<T extends THREE.Material>(
  mat: T, tex: THREE.Texture, goc: { value: THREE.Vector2 }, span: number, mauSuong: number,
): T {
  const t = { value: tex };
  const s = { value: 1 / span };
  const c = { value: new THREE.Color(mauSuong) };
  const khoaTruoc = mat.customProgramCacheKey();
  const truoc = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    truoc?.call(mat, shader, renderer);
    shader.uniforms.uSuong = t;
    shader.uniforms.uSuongGoc = goc;
    shader.uniforms.uSuongTi = s;
    shader.uniforms.uSuongMau = c;
    shader.fragmentShader =
      'uniform sampler2D uSuong;\nuniform vec2 uSuongGoc;\nuniform float uSuongTi;\n'
      + 'uniform vec3 uSuongMau;\n'
      + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float kvSuong = texture2D(uSuong, (vVanXZ - uSuongGoc) * uSuongTi).r;
      diffuseColor.rgb = mix(uSuongMau, diffuseColor.rgb, kvSuong);`)
        /*
         * Đất chưa vén còn phải thôi ĂN NẮNG nữa. Chỉ pha màu trước khi chiếu sáng thì nắng
         * xiên vẫn tô từng mặt tam giác lên lớp sương, và "giấy bản đồ chưa vẽ" hiện ra là
         * một bãi đất xám nâu lổn nhổn. Kéo kết quả SAU chiếu sáng về một màu phẳng, đúng
         * theo phần sương còn phủ, thì chỗ chưa vén đọc ra là sương chứ không phải là đất.
         */
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uSuongMau * 0.6, (1.0 - kvSuong) * 0.8);`);
  };
  mat.customProgramCacheKey = () => `${khoaTruoc}|suong`;
  return mat;
}

/**
 * Biển tên treo trên thủ phủ: chữ trắng trên một viên kính tối, bo tròn, viền theo màu cờ.
 *
 * Vẽ ra ảnh rồi dán lên một Sprite, nên nó luôn quay mặt về phía người chơi mà không tốn một
 * phép xoay nào. Cùng ngôn ngữ với lớp HUD kính mờ bên trên, để cái tên đọc ra là của người
 * chơi chứ không phải một thứ mọc lên từ cảnh vật.
 */
export function labelTexture(text: string, vien: number): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const R = 34;
  const m = 10;
  g.beginPath();
  g.roundRect(m, m, W - m * 2, H - m * 2, R);
  g.fillStyle = 'rgba(15,23,42,0.82)';
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = `#${vien.toString(16).padStart(6, '0')}`;
  g.stroke();
  g.font = '600 52px "Plus Jakarta Sans", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f3f4f6';
  // Chữ dài thì BÓP NGANG chứ không cắt bớt: cái tên là của người chơi, cắt mất đuôi thì thà
  // đừng hiện. 512 điểm ảnh chứa vừa chừng mười hai chữ cái ở cỡ này.
  const rong = g.measureText(text).width;
  const toi = W - m * 2 - 36;
  if (rong > toi) {
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(toi / rong, 1);
    g.fillText(text, 0, 2);
    g.restore();
  } else {
    g.fillText(text, W / 2, H / 2 + 2);
  }
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
