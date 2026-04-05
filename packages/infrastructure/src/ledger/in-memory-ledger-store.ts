import { normalizeLedgerEntry, sortLedgerEntries, type LedgerEntry } from "@lottery/domain";
import type { LedgerStore } from "@lottery/application";

export class InMemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[];

  constructor(initialEntries: readonly LedgerEntry[] = []) {
    this.entries = normalizeEntries(initialEntries);
  }

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return this.entries.map(cloneEntry);
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).map(cloneEntry);
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = normalizeEntries([...this.entries, entry]);
  }
}

function normalizeEntries(entries: readonly LedgerEntry[]): LedgerEntry[] {
  const normalized = entries.map((entry) => normalizeLedgerEntry(entry));
  return sortLedgerEntries(normalized);
}

function cloneEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    reference: { ...entry.reference }
  };
}
