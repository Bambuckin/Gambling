import type { LotteryRegistryEntry } from "@lottery/domain";

export interface LotteryRegistryStore {
  listEntries(): Promise<readonly LotteryRegistryEntry[]>;
  saveEntries(entries: readonly LotteryRegistryEntry[]): Promise<void>;
}
