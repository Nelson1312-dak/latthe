/**
 * Thế giới vô hạn: mọi thứ ở một toạ độ đều SINH RA ĐƯỢC từ chính toạ độ đó.
 *
 * Không có bản đồ nào được lưu. Biến sinh thái, địa hình, mỏ, nền đất — tất cả đều là hàm
 * thuần của (x, z) qua một hàm băm có hạt giống. Hệ quả: hai người mở cùng một hạt giống
 * thấy đúng một thế giới, đi xa bao nhiêu cũng được, và bản lưu chỉ cần nhớ những gì người
 * chơi ĐÃ LÀM (công trình đã xây, ô sương đã vén) chứ không phải thế giới trông ra sao.
 *
 * Đây là điều kiện để bản đồ vô hạn khả thi. Nếu địa hình phải lưu thì chơi càng lâu bản lưu
 * càng phình, và sớm muộn cũng vượt giới hạn localStorage.
 */
import type { BiomeId } from './types';

export const SEED = 0x1a7ba1;

/** Cạnh một khối. Khối là đơn vị nạp, huỷ, và vén mây. */
export const CHUNK = 20;
/** Bán kính nạp quanh tâm ngắm, tính bằng khối. 4 nghĩa là lưới 9×9 khối = 180×180 đơn vị. */
export const LOAD_RADIUS = 4;
/** Ngoài bán kính này thì huỷ. Rộng hơn bán kính nạp để đi qua đi lại không giật liên tục. */
export const KEEP_RADIUS = 5;

/** Băm hai số nguyên thành một số thực trong [0,1). Tất định, rẻ, đủ tản. */
export function hash2(x: number, z: number, salt = 0): number {
  let h = (x | 0) * 374761393 + (z | 0) * 668265263 + salt * 1442695040888963407 + SEED;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bộ sinh số tuần tự cho một khối, để mỗi khối có một chuỗi riêng mà vẫn tất định. */
export function chunkRng(cx: number, cz: number, salt = 0): () => number {
  let a = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(salt + 1, 83492791) ^ SEED) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;
export const chunkOf = (v: number): number => Math.floor(v / CHUNK);

/**
 * Biến sinh thái tại một điểm.
 *
 * Quanh thủ phủ luôn là đồng cỏ để người chơi có chỗ đứng chân. Ra ngoài thì chia thành các
 * vùng 60×60 đơn vị, mỗi vùng bốc thăm một biến — nên bản đồ lặp lại mà không đều đặn, và
 * đi theo hướng nào cũng gặp đủ bốn loại.
 */
export function biomeAt(x: number, z: number): BiomeId {
  if (Math.hypot(x, z) < 19) return 'meadow';
  const rx = Math.floor(x / 60);
  const rz = Math.floor(z / 60);
  const pick = hash2(rx, rz, 7);
  if (pick < 0.34) return 'meadow';
  if (pick < 0.56) return 'crags';
  if (pick < 0.78) return 'desert';
  return 'highlands';
}

/**
 * Hệ số giàu của mỏ theo khoảng cách tới thủ phủ.
 *
 * Đây là thứ làm cho "vô hạn" có nghĩa. Không có nó, đi xa chỉ tốn thời gian đi lại và người
 * chơi sẽ bám quanh nhà mãi mãi — bản đồ rộng thành ra vô dụng. Tăng theo log nên không bao
 * giờ chạm trần, mà cũng không bùng: xa 60 đơn vị gấp đôi, xa 420 gấp bốn, xa 3.800 gấp bảy.
 */
export function richnessAt(x: number, z: number): number {
  return 1 + Math.log2(1 + Math.hypot(x, z) / 60);
}

/** Độ cao mặt đất. Vách đá gồ ghề, sa mạc lượn sóng dài, đồng cỏ thoai thoải. */
export function heightAt(x: number, z: number, biome: BiomeId): number {
  let h = (Math.sin(x * 0.11) + Math.cos(z * 0.09)) * 0.3;
  if (biome === 'crags') h += Math.abs(Math.sin(x * 0.22 + z * 0.17)) * 1.8;
  else if (biome === 'desert') h += Math.sin(x * 0.07 + z * 0.055) * 0.9;
  else if (biome === 'highlands') h += Math.cos(x * 0.15) * 0.5 + 0.3;
  return h;
}

/**
 * Điểm này có nằm trên đường không.
 *
 * Đường là một lưới thưa: cứ 20 đơn vị một trục. Nhờ vậy đường cũng vô hạn mà không phải lưu
 * gì, và xe thồ luôn tìm được trục gần nhất để bám về thủ phủ.
 */
export function onRoad(x: number, z: number): boolean {
  const near = (v: number) => Math.abs(v - Math.round(v / CHUNK) * CHUNK) < 1.4;
  return near(x) || near(z);
}
