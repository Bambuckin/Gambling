import type { DrawClosureRecord } from "@lottery/domain";
import type { DrawClosureStore } from "@lottery/application";

export class InMemoryDrawClosureStore implements DrawClosureStore {
  private closures: DrawClosureRecord[] = [];

  async getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    return this.closures.find((c) => c.lotteryCode === lotteryCode && c.drawId === drawId) ?? null;
  }

  async saveClosure(record: DrawClosureRecord): Promise<void> {
    const filtered = this.closures.filter(
      (c) => !(c.lotteryCode === record.lotteryCode && c.drawId === record.drawId)
    );
    this.closures = [...filtered, { ...record }];
  }

  async listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    if (lotteryCode) {
      return this.closures.filter((c) => c.lotteryCode === lotteryCode);
    }
    return [...this.closures];
  }

  async deleteClosure(lotteryCode: string, drawId: string): Promise<void> {
    this.closures = this.closures.filter((c) => !(c.lotteryCode === lotteryCode && c.drawId === drawId));
  }

  async clearAll(): Promise<void> {
    this.closures = [];
  }
}
