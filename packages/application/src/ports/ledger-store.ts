import type { LedgerEntry } from "@lottery/domain";

export interface LedgerStore {
  listEntries(): Promise<readonly LedgerEntry[]>;
  listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]>;
  appendEntry(entry: LedgerEntry): Promise<void>;
  clearAll(): Promise<void>;
}
