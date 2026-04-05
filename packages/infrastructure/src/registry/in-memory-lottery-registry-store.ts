import { sortRegistryEntries, type LotteryRegistryEntry } from "@lottery/domain";
import type { LotteryRegistryStore } from "@lottery/application";

export class InMemoryLotteryRegistryStore implements LotteryRegistryStore {
  private entries: LotteryRegistryEntry[];

  constructor(initialEntries: readonly LotteryRegistryEntry[] = []) {
    this.entries = normalizeEntries(initialEntries);
  }

  async listEntries(): Promise<readonly LotteryRegistryEntry[]> {
    return this.entries.map(cloneEntry);
  }

  async saveEntries(entries: readonly LotteryRegistryEntry[]): Promise<void> {
    this.entries = normalizeEntries(entries);
  }
}

function normalizeEntries(entries: readonly LotteryRegistryEntry[]): LotteryRegistryEntry[] {
  return sortRegistryEntries(entries.map(cloneEntry));
}

function cloneEntry(entry: LotteryRegistryEntry): LotteryRegistryEntry {
  return {
    ...entry,
    pricing: { ...entry.pricing },
    handlers: { ...entry.handlers }
  };
}
