/**
 * Công thức cân bằng. Thuần tuý là hàm số: không đọc trạng thái, không chạm DOM, không lưu gì.
 *
 * Tách hẳn ra một file vì đây là chỗ sẽ bị sửa nhiều nhất và cũng là chỗ sai thì khó thấy nhất.
 * Chỉnh nhịp game là chỉnh mấy con số trong `ECONOMY`, không phải lần mò trong mã xử lý.
 */

export interface CostCurve {
  baseCost: number;
  costMultiplier: number;
}

export const ECONOMY = {
  /** Nâng cấp công trình: tăng 15% mỗi cấp. */
  building: { baseCost: 50, costMultiplier: 1.15 } as CostCurve,
  /** Mở ô đất: mỗi khu mới là một khoản đầu tư đáng kể. */
  slot: { baseCost: 200, costMultiplier: 2.2 } as CostCurve,
  /** Thuê thợ, và cũng dùng cho luyện tốc độ thợ. */
  worker: { baseCost: 100, costMultiplier: 1.25 } as CostCurve,

  /** Sản lượng mỗi chuyến ở cấp 1, và phần cộng thêm mỗi cấp (tính theo sản lượng gốc). */
  baseOutput: 10,
  outputGrowthRate: 0.25,

  /** Tốc độ đi bộ gốc, đơn vị mỗi giây. Mỗi cấp luyện cộng 10%. */
  baseSpeed: 3.0,
  workerSpeedGrowth: 0.1,
  /** Giây đứng đào mỗi chuyến. */
  gatheringDuration: 2.0,

  /** Trần tích luỹ khi vắng mặt: 2 giờ. */
  maxAfkSeconds: 7200,
  /** Dưới ngưỡng này coi như không đi đâu cả, khỏi hiện bảng cho mỗi lần đổi tab. */
  minimumAfkThreshold: 30,
  /**
   * Hiệu suất lúc vắng mặt. Bản đặc tả ghi 0,8 ở phần chữ nhưng 0,85 trong đoạn mã mẫu;
   * lấy theo đoạn mã. Đổi một chỗ này là đổi cả game: 1.0 nếu muốn hoàn toàn nhàn.
   */
  afkEfficiency: 0.85,
} as const;

export class EconomyMath {
  /**
   * Giá nâng từ cấp hiện tại lên cấp sau: baseCost * multiplier^(level-1).
   * Cấp 0 (tức là xây mới) dùng chung số mũ với cấp 1, nên nhà đầu tiên đúng bằng baseCost.
   */
  static getUpgradeCost(baseCost: number, multiplier: number, currentLevel: number): number {
    return Math.floor(baseCost * Math.pow(multiplier, Math.max(0, currentLevel - 1)));
  }

  static cost(curve: CostCurve, currentLevel: number): number {
    return EconomyMath.getUpgradeCost(curve.baseCost, curve.costMultiplier, currentLevel);
  }

  /**
   * Sản lượng mỗi chuyến ở một cấp. Tăng TUYẾN TÍNH trong khi giá tăng theo cấp số nhân —
   * chính khoảng cách giữa hai đường đó tạo ra cảm giác "phải cân nhắc" khi lên cấp cao.
   */
  static getBuildingOutput(baseOutput: number, growthRate: number, currentLevel: number): number {
    return Math.floor(baseOutput * (1 + Math.max(0, currentLevel - 1) * growthRate));
  }

  /** Tốc độ đi bộ thật của thợ sau khi tính cấp luyện. */
  static getWorkerSpeed(speedLevel: number): number {
    return ECONOMY.baseSpeed * (1 + Math.max(0, speedLevel - 1) * ECONOMY.workerSpeedGrowth);
  }

  /** Giây cho trọn một chuyến: đi, đào, rồi về. `distance` là quãng MỘT CHIỀU. */
  static getTripTime(distance: number, speedLevel: number): number {
    return (2 * distance) / EconomyMath.getWorkerSpeed(speedLevel) + ECONOMY.gatheringDuration;
  }

  /**
   * Xu kiếm được cho quãng thời gian không nhìn màn hình.
   * Chặn trần trước, rồi mới nhân hiệu suất — thứ tự ngược lại sẽ trả dư.
   */
  static calculateAfkYield(
    totalRatePerSecond: number,
    elapsedSeconds: number,
    maxSeconds: number = ECONOMY.maxAfkSeconds,
  ): { coins: number; actualTime: number } {
    const effectiveTime = Math.min(Math.max(0, elapsedSeconds), maxSeconds);
    const coins = Math.floor(totalRatePerSecond * effectiveTime * ECONOMY.afkEfficiency);
    return { coins, actualTime: effectiveTime };
  }
}
