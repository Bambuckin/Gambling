import { describe, expect, it } from "vitest";
import type { DrawSnapshot, LotteryRegistryEntry } from "@lottery/domain";
import { DrawRefreshService } from "../services/draw-refresh-service.js";
import {
  LotteryRegistryService,
  type LotteryRegistryUpsertInput
} from "../services/lottery-registry-service.js";
import type { DrawStore } from "../ports/draw-store.js";
import type { LotteryRegistryStore } from "../ports/lottery-registry-store.js";
import type { TimeSource } from "../ports/time-source.js";

describe("registry + draw lifecycle integration", () => {
  it("applies admin visibility/order mutations and keeps draw gating deterministic", async () => {
    const registryService = new LotteryRegistryService({
      registryStore: new InMemoryLotteryRegistryStore([
        createRegistryEntry({ lotteryCode: "alpha", title: "Alpha", enabled: true, displayOrder: 20 }),
        createRegistryEntry({ lotteryCode: "beta", title: "Beta", enabled: false, displayOrder: 10 }),
        createRegistryEntry({ lotteryCode: "gamma", title: "Gamma", enabled: true, displayOrder: 30 })
      ])
    });
    const drawService = new DrawRefreshService({
      drawStore: new InMemoryDrawStore([
        {
          lotteryCode: "alpha",
          drawId: "draw-alpha",
          drawAt: "2026-04-05T14:00:00.000Z",
          fetchedAt: "2026-04-05T11:55:00.000Z",
          freshnessTtlSeconds: 1800
        },
        {
          lotteryCode: "gamma",
          drawId: "draw-gamma",
          drawAt: "2026-04-05T14:00:00.000Z",
          fetchedAt: "2026-04-05T08:00:00.000Z",
          freshnessTtlSeconds: 900
        }
      ]),
      timeSource: fixedTime("2026-04-05T12:00:00.000Z")
    });

    const initialVisible = await registryService.getVisibleLotteries();
    expect(initialVisible.map((entry) => entry.lotteryCode)).toEqual(["alpha", "gamma"]);

    await registryService.setLotteryEnabled("beta", true);
    await registryService.moveLottery("gamma", "up");

    const visibleAfterAdminActions = await registryService.getVisibleLotteries();
    expect(visibleAfterAdminActions.map((entry) => entry.lotteryCode)).toEqual(["beta", "gamma", "alpha"]);
    expect(visibleAfterAdminActions.map((entry) => entry.displayOrder)).toEqual([10, 20, 30]);

    const betaDrawState = await drawService.getDrawState("beta");
    expect(betaDrawState.status).toBe("missing");
    expect(betaDrawState.isPurchaseBlocked).toBe(true);

    const gammaDrawState = await drawService.getDrawState("gamma");
    expect(gammaDrawState.status).toBe("stale");
    expect(gammaDrawState.isPurchaseBlocked).toBe(true);

    const alphaDrawState = await drawService.getDrawState("alpha");
    expect(alphaDrawState.status).toBe("fresh");
    expect(alphaDrawState.isPurchaseBlocked).toBe(false);
  });
});

class InMemoryLotteryRegistryStore implements LotteryRegistryStore {
  private entries: LotteryRegistryEntry[];

  constructor(entries: readonly LotteryRegistryEntry[]) {
    this.entries = entries.map((entry) => cloneRegistryEntry(entry));
  }

  async listEntries(): Promise<readonly LotteryRegistryEntry[]> {
    return this.entries.map((entry) => cloneRegistryEntry(entry));
  }

  async saveEntries(entries: readonly LotteryRegistryEntry[]): Promise<void> {
    this.entries = entries.map((entry) => cloneRegistryEntry(entry));
  }
}

class InMemoryDrawStore implements DrawStore {
  private snapshots: DrawSnapshot[];

  constructor(initialSnapshots: readonly DrawSnapshot[]) {
    this.snapshots = initialSnapshots.map((snapshot) => cloneSnapshot(snapshot));
  }

  async listSnapshots(): Promise<readonly DrawSnapshot[]> {
    return this.snapshots.map((snapshot) => cloneSnapshot(snapshot));
  }

  async getSnapshot(lotteryCode: string): Promise<DrawSnapshot | null> {
    return this.snapshots.find((snapshot) => snapshot.lotteryCode === lotteryCode) ?? null;
  }

  async upsertSnapshot(snapshot: DrawSnapshot): Promise<void> {
    const filtered = this.snapshots.filter((entry) => entry.lotteryCode !== snapshot.lotteryCode);
    this.snapshots = [...filtered, cloneSnapshot(snapshot)];
  }

  async deleteSnapshot(lotteryCode: string): Promise<void> {
    this.snapshots = this.snapshots.filter((entry) => entry.lotteryCode !== lotteryCode);
  }

  async clearAll(): Promise<void> {
    this.snapshots = [];
  }
}

function createRegistryEntry(overrides: Partial<LotteryRegistryUpsertInput>): LotteryRegistryUpsertInput {
  return {
    lotteryCode: overrides.lotteryCode ?? "demo-lottery",
    title: overrides.title ?? "Demo Lottery",
    enabled: overrides.enabled ?? true,
    displayOrder: overrides.displayOrder ?? 10,
    formSchemaVersion: overrides.formSchemaVersion ?? "v1",
    formFields: overrides.formFields ?? [
      {
        fieldKey: "draw_count",
        label: "Draw Count",
        type: "number",
        required: true,
        min: 1,
        max: 10,
        step: 1,
        defaultValue: 1
      }
    ],
    pricing: overrides.pricing ?? {
      strategy: "fixed",
      baseAmountMinor: 100
    },
    handlers: overrides.handlers ?? {
      purchaseHandler: "handlers.demo.purchase.v1",
      resultHandler: "handlers.demo.result.v1"
    }
  };
}

function cloneRegistryEntry(entry: LotteryRegistryEntry): LotteryRegistryEntry {
  return {
    ...entry,
    pricing: { ...entry.pricing },
    handlers: { ...entry.handlers }
  };
}

function cloneSnapshot(snapshot: DrawSnapshot): DrawSnapshot {
  return { ...snapshot };
}

function fixedTime(nowIso: string): TimeSource {
  return {
    nowIso() {
      return nowIso;
    }
  };
}
