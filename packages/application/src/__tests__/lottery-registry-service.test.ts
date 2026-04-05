import { describe, expect, it } from "vitest";
import type { LotteryRegistryEntry } from "@lottery/domain";
import {
  LotteryRegistryService,
  LotteryRegistryValidationError,
  type LotteryRegistryUpsertInput
} from "../services/lottery-registry-service.js";
import type { LotteryRegistryStore } from "../ports/lottery-registry-store.js";

describe("lottery registry service", () => {
  it("returns enabled lotteries in display order", async () => {
    const service = new LotteryRegistryService({
      registryStore: new InMemoryLotteryRegistryStore([
        createEntry({ lotteryCode: "lottery-b", enabled: true, displayOrder: 20 }),
        createEntry({ lotteryCode: "lottery-a", enabled: true, displayOrder: 10 }),
        createEntry({ lotteryCode: "lottery-c", enabled: false, displayOrder: 1 })
      ])
    });

    const visible = await service.getVisibleLotteries();
    expect(visible.map((entry) => entry.lotteryCode)).toEqual(["lottery-a", "lottery-b"]);
  });

  it("upserts existing lottery while preserving handler references", async () => {
    const store = new InMemoryLotteryRegistryStore([createEntry({ lotteryCode: "demo-lottery", title: "Demo" })]);
    const service = new LotteryRegistryService({ registryStore: store });

    await service.upsertLottery(
      createEntry({
        lotteryCode: "demo-lottery",
        title: "Demo Updated",
        enabled: false,
        displayOrder: 7,
        handlers: {
          purchaseHandler: "handlers.demo.purchase.v2",
          resultHandler: "handlers.demo.result.v2"
        }
      })
    );

    const updated = await service.getLotteryByCode("DEMO-LOTTERY");
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Demo Updated");
    expect(updated?.enabled).toBe(false);
    expect(updated?.handlers.purchaseHandler).toBe("handlers.demo.purchase.v2");
    expect(updated?.handlers.resultHandler).toBe("handlers.demo.result.v2");
  });

  it("throws on duplicate lottery codes during replaceAll", async () => {
    const service = new LotteryRegistryService({
      registryStore: new InMemoryLotteryRegistryStore([])
    });

    const execute = service.replaceAll([
      createEntry({ lotteryCode: "demo-lottery", title: "Demo One" }),
      createEntry({ lotteryCode: "DEMO-LOTTERY", title: "Demo Two" })
    ]);

    await expect(execute).rejects.toBeInstanceOf(LotteryRegistryValidationError);
  });
});

class InMemoryLotteryRegistryStore implements LotteryRegistryStore {
  private entries: LotteryRegistryEntry[];

  constructor(entries: readonly LotteryRegistryEntry[]) {
    this.entries = entries.map(cloneEntry);
  }

  async listEntries(): Promise<readonly LotteryRegistryEntry[]> {
    return this.entries.map(cloneEntry);
  }

  async saveEntries(entries: readonly LotteryRegistryEntry[]): Promise<void> {
    this.entries = entries.map(cloneEntry);
  }
}

function createEntry(overrides: Partial<LotteryRegistryUpsertInput>): LotteryRegistryUpsertInput {
  return {
    lotteryCode: overrides.lotteryCode ?? "demo-lottery",
    title: overrides.title ?? "Demo Lottery",
    enabled: overrides.enabled ?? true,
    displayOrder: overrides.displayOrder ?? 1,
    formSchemaVersion: overrides.formSchemaVersion ?? "v1",
    formFields: overrides.formFields ?? [
      {
        fieldKey: "bet_count",
        label: "Bet Count",
        type: "number",
        required: true,
        min: 1,
        max: 20,
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

function cloneEntry(entry: LotteryRegistryEntry): LotteryRegistryEntry {
  return {
    ...entry,
    pricing: { ...entry.pricing },
    handlers: { ...entry.handlers }
  };
}
