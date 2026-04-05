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

  it("toggles lottery visibility without mutating handler bindings", async () => {
    const original = createEntry({
      lotteryCode: "visibility-demo",
      enabled: true,
      handlers: {
        purchaseHandler: "handlers.visibility.purchase.v1",
        resultHandler: "handlers.visibility.result.v1"
      }
    });
    const service = new LotteryRegistryService({
      registryStore: new InMemoryLotteryRegistryStore([original])
    });

    const disabled = await service.setLotteryEnabled("visibility-demo", false);
    expect(disabled.enabled).toBe(false);
    expect(disabled.handlers).toEqual(original.handlers);

    const enabledAgain = await service.setLotteryEnabled("visibility-demo", true);
    expect(enabledAgain.enabled).toBe(true);
    expect(enabledAgain.handlers).toEqual(original.handlers);
  });

  it("moves lotteries up and down while rebalancing display order", async () => {
    const service = new LotteryRegistryService({
      registryStore: new InMemoryLotteryRegistryStore([
        createEntry({ lotteryCode: "lottery-a", displayOrder: 10 }),
        createEntry({ lotteryCode: "lottery-b", displayOrder: 20 }),
        createEntry({ lotteryCode: "lottery-c", displayOrder: 30 })
      ])
    });

    const movedUp = await service.moveLottery("lottery-c", "up");
    expect(movedUp.map((entry) => entry.lotteryCode)).toEqual(["lottery-a", "lottery-c", "lottery-b"]);
    expect(movedUp.map((entry) => entry.displayOrder)).toEqual([10, 20, 30]);

    const movedDown = await service.moveLottery("lottery-a", "down");
    expect(movedDown.map((entry) => entry.lotteryCode)).toEqual(["lottery-c", "lottery-a", "lottery-b"]);
    expect(movedDown.map((entry) => entry.displayOrder)).toEqual([10, 20, 30]);

    const boundary = await service.moveLottery("lottery-b", "down");
    expect(boundary.map((entry) => entry.lotteryCode)).toEqual(["lottery-c", "lottery-a", "lottery-b"]);
    expect(boundary.map((entry) => entry.displayOrder)).toEqual([10, 20, 30]);
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
