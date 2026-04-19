import type { CanonicalDrawRecord } from "@lottery/domain";

export interface CanonicalDrawStore {
  listDraws(lotteryCode?: string): Promise<readonly CanonicalDrawRecord[]>;
  getDraw(lotteryCode: string, drawId: string): Promise<CanonicalDrawRecord | null>;
  saveDraw(record: CanonicalDrawRecord): Promise<void>;
  deleteDraw(lotteryCode: string, drawId: string): Promise<void>;
  clearAll(): Promise<void>;
}
