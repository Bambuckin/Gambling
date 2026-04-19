import type { DrawClosureRecord } from "@lottery/domain";

export interface DrawClosureStore {
  getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null>;
  saveClosure(record: DrawClosureRecord): Promise<void>;
  listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]>;
  deleteClosure(lotteryCode: string, drawId: string): Promise<void>;
  clearAll(): Promise<void>;
}
