import { normalizeLotteryCode, type DrawSnapshot } from "@lottery/domain";
import type { DrawStore } from "@lottery/application";

export class InMemoryDrawStore implements DrawStore {
  private snapshotsByLotteryCode = new Map<string, DrawSnapshot>();

  constructor(initialSnapshots: readonly DrawSnapshot[] = []) {
    for (const snapshot of initialSnapshots) {
      this.snapshotsByLotteryCode.set(normalizeLotteryCode(snapshot.lotteryCode), cloneSnapshot(snapshot));
    }
  }

  async listSnapshots(): Promise<readonly DrawSnapshot[]> {
    return [...this.snapshotsByLotteryCode.values()].map(cloneSnapshot);
  }

  async getSnapshot(lotteryCode: string): Promise<DrawSnapshot | null> {
    return this.snapshotsByLotteryCode.get(normalizeLotteryCode(lotteryCode)) ?? null;
  }

  async upsertSnapshot(snapshot: DrawSnapshot): Promise<void> {
    this.snapshotsByLotteryCode.set(normalizeLotteryCode(snapshot.lotteryCode), cloneSnapshot(snapshot));
  }
}

function cloneSnapshot(snapshot: DrawSnapshot): DrawSnapshot {
  return {
    ...snapshot,
    ...(snapshot.availableDraws
      ? {
          availableDraws: snapshot.availableDraws.map((draw) => ({ ...draw }))
        }
      : {})
  };
}
