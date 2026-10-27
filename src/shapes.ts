/**
 * Hình khối bo tròn.
 *
 * Townscaper không dựng bằng hộp vuông góc: mọi khối đều bo góc và vát cạnh, nên ánh sáng
 * chạy một vệt mảnh dọc theo mỗi mép thay vì đổi đột ngột. Đó là thứ khiến cả cảnh đọc ra
 * như đất nặn hay gốm chứ không như một đống hộp các-tông — và nó quan trọng gấp đôi khi đi
 * cùng ambient occlusion, vì AO bám vào chính mấy cái vát ấy.
 *
 * Dựng bằng ExtrudeGeometry từ một hình chữ nhật bo góc, có vát. Tốn khoảng mười lần số
 * tam giác của một BoxGeometry, nhưng công trình thì ít — vài chục cái — nên không đáng kể;
 * TUYỆT ĐỐI không dùng cho ô cỏ hay props, những thứ có hàng nghìn bản.
 */
import * as THREE from 'three';

/**
 * Hộp bo góc, tâm ở gốc, cao theo trục Y.
 *
 * `bo` là bán kính bo góc nhìn từ trên xuống, `vat` là độ vát mép trên và dưới. Cả hai đều
 * bị kẹp lại để không vượt quá nửa cạnh ngắn nhất — quá tay thì ExtrudeGeometry sinh ra mặt
 * lộn trong ra ngoài, và lỗi ấy chỉ lộ ra ở một vài tỉ lệ nhất định nên rất dễ lọt.
 */
export function roundedBox(w: number, h: number, d: number, bo = 0.22, vat = 0.08): THREE.BufferGeometry {
  const r = Math.min(bo, w / 2 - 0.01, d / 2 - 0.01);
  const b = Math.min(vat, h / 2 - 0.01, r * 0.9);
  const hw = w / 2 - r - b;
  const hd = d / 2 - r - b;

  const s = new THREE.Shape();
  s.moveTo(-hw, -hd - r);
  s.lineTo(hw, -hd - r);
  s.quadraticCurveTo(hw + r, -hd - r, hw + r, -hd);
  s.lineTo(hw + r, hd);
  s.quadraticCurveTo(hw + r, hd + r, hw, hd + r);
  s.lineTo(-hw, hd + r);
  s.quadraticCurveTo(-hw - r, hd + r, -hw - r, hd);
  s.lineTo(-hw - r, -hd);
  s.quadraticCurveTo(-hw - r, -hd - r, -hw, -hd - r);

  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - b * 2,
    bevelEnabled: true,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments: 3,
  });
  /*
   * ExtrudeGeometry đùn theo +Z từ 0 tới depth, và phần vát thò ra thêm b ở hai đầu. Xoay
   * -90° quanh X thì +Z thành +Y, nên khối nằm từ -b tới depth+b: tâm của nó ở +depth/2,
   * và để đưa về gốc thì phải dịch XUỐNG chừng ấy. Dịch nhầm dấu thì khối đội lên gấp
   * đôi và trùm mất mái nhà — nhìn ra ngay, nhưng không một lỗi nào được báo.
   */
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h / 2 - b), 0);
  g.computeVertexNormals();
  return g;
}
