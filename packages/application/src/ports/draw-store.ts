import type { DrawSnapshot } from "@lottery/domain";

export interface DrawStore {
  listSnapshots(): Promise<readonly DrawSnapshot[]>;
  getSnapshot(lotteryCode: string): Promise<DrawSnapshot | null>;
  upsertSnapshot(snapshot: DrawSnapshot): Promise<void>;
}
