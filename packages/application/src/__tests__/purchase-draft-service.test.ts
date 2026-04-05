import { describe, expect, it } from "vitest";
import type { LotteryRegistryEntry } from "@lottery/domain";
import type { LotteryRegistryStore } from "../ports/lottery-registry-store.js";
import { LotteryRegistryService } from "../services/lottery-registry-service.js";
import { PurchaseDraftService, PurchaseDraftServiceError } from "../services/purchase-draft-service.js";

describe("PurchaseDraftService", () => {
  it("prepares priced draft quote for valid payload", async () => {
    const service = createPurchaseDraftService([
      createEntry({
        lotteryCode: "demo-lottery",
        pricing: {
          strategy: "fixed",
          baseAmountMinor: 150
        }
      })
    ]);

    const result = await service.prepareDraft({
      lotteryCode: "DEMO-LOTTERY",
      rawFieldValues: {
        draw_count: "3",
        ticket_note: "night draw"
      }
    });

    expect(result).toMatchObject({
      lotteryCode: "demo-lottery",
      pricingStrategy: "fixed",
      baseAmountMinor: 150,
      multiplier: 3,
      costMinor: 450,
      currency: "RUB",
      validatedFieldCount: 2,
      totalFieldCount: 2
    });
    expect(result.validatedPayload).toEqual({
      draw_count: 3,
      ticket_note: "night draw"
    });
  });

  it("returns validation_failed with field details for invalid payload", async () => {
    const service = createPurchaseDraftService([createEntry()]);

    const action = service.prepareDraft({
      lotteryCode: "demo-lottery",
      rawFieldValues: {
        draw_count: "",
        ticket_note: ""
      }
    });

    await expect(action).rejects.toBeInstanceOf(PurchaseDraftServiceError);
    await expect(action).rejects.toMatchObject({
      code: "validation_failed"
    });
    await expect(action).rejects.toMatchObject({
      fieldErrors: [
        {
          fieldKey: "draw_count",
          reason: "required"
        }
      ]
    });
  });

  it("rejects disabled lotteries", async () => {
    const service = createPurchaseDraftService([
      createEntry({
        lotteryCode: "archive-lottery",
        enabled: false
      })
    ]);

    const action = service.prepareDraft({
      lotteryCode: "archive-lottery",
      rawFieldValues: {
        draw_count: "1"
      }
    });

    await expect(action).rejects.toMatchObject({
      code: "lottery_disabled"
    });
  });

  it("returns pricing_failed when strategy is not yet supported", async () => {
    const service = createPurchaseDraftService([
      createEntry({
        lotteryCode: "matrix-lottery",
        pricing: {
          strategy: "matrix",
          baseAmountMinor: 100
        }
      })
    ]);

    const action = service.prepareDraft({
      lotteryCode: "matrix-lottery",
      rawFieldValues: {
        draw_count: "2"
      }
    });

    await expect(action).rejects.toMatchObject({
      code: "pricing_failed"
    });
  });
});

function createPurchaseDraftService(entries: readonly LotteryRegistryEntry[]): PurchaseDraftService {
  const registryService = new LotteryRegistryService({
    registryStore: new InMemoryLotteryRegistryStore(entries)
  });

  return new PurchaseDraftService({
    registryService
  });
}

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

function createEntry(overrides: Partial<LotteryRegistryEntry> = {}): LotteryRegistryEntry {
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
      },
      {
        fieldKey: "ticket_note",
        label: "Ticket Note",
        type: "text",
        required: false
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
