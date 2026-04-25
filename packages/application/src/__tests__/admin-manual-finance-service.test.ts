import { describe, expect, it } from "vitest";
import { AdminManualFinanceService } from "../services/admin-manual-finance-service.js";
import type { LedgerEntry } from "@lottery/domain";

function createTestEnv() {
  const entries: LedgerEntry[] = [
    {
      entryId: "seed-credit",
      userId: "user-1",
      operation: "credit",
      amountMinor: 100_000,
      currency: "RUB",
      idempotencyKey: "seed-idem",
      reference: { requestId: "seed-req" },
      createdAt: "2026-04-01T10:00:00.000Z"
    }
  ];

  const service = new AdminManualFinanceService({
    ledgerStore: {
      listEntries: async () => entries,
      listEntriesByUser: async (userId: string) => entries.filter((e) => e.userId === userId),
      appendEntry: async (entry: LedgerEntry) => {
        entries.push(entry);
      },
      clearAll: async () => {}
    },
    timeSource: {
      nowIso: () => "2026-04-10T12:00:00.000Z"
    }
  });

  return { service, entries };
}

describe("AdminManualFinanceService", () => {
  it("performs manual credit", async () => {
    const { service } = createTestEnv();
    const result = await service.performAdjustment({
      adjustmentId: "adj-credit-1",
      userId: "user-1",
      operation: "manual_credit",
      amountMinor: 10_000,
      currency: "RUB",
      reason: "admin correction",
      performedBy: "admin-1"
    });

    expect(result.entry.operation).toBe("manual_credit");
    expect(result.entry.amountMinor).toBe(10_000);
    expect(result.entry.reference.adminAdjustmentId).toBe("adj-credit-1");
    expect(result.snapshot.availableMinor).toBe(110_000);
  });

  it("performs manual debit", async () => {
    const { service } = createTestEnv();
    const result = await service.performAdjustment({
      adjustmentId: "adj-debit-1",
      userId: "user-1",
      operation: "manual_debit",
      amountMinor: 30_000,
      currency: "RUB",
      reason: "correction",
      performedBy: "admin-1"
    });

    expect(result.entry.operation).toBe("manual_debit");
    expect(result.snapshot.availableMinor).toBe(70_000);
  });

  it("is idempotent by adjustmentId", async () => {
    const { service, entries } = createTestEnv();
    const first = await service.performAdjustment({
      adjustmentId: "adj-idem",
      userId: "user-1",
      operation: "manual_credit",
      amountMinor: 5_000,
      currency: "RUB",
      reason: "test",
      performedBy: "admin-1"
    });

    const second = await service.performAdjustment({
      adjustmentId: "adj-idem",
      userId: "user-1",
      operation: "manual_credit",
      amountMinor: 5_000,
      currency: "RUB",
      reason: "test",
      performedBy: "admin-1"
    });

    expect(entries.filter((e) => e.idempotencyKey === "adj-idem")).toHaveLength(1);
    expect(first.entry.entryId).toBe(second.entry.entryId);
  });

  it("requires reason", async () => {
    const { service } = createTestEnv();
    await expect(
      service.performAdjustment({
        adjustmentId: "adj-no-reason",
        userId: "user-1",
        operation: "manual_credit",
        amountMinor: 1_000,
        currency: "RUB",
        reason: "  ",
        performedBy: "admin-1"
      })
    ).rejects.toThrow("reason is required");
  });

  it("requires positive amount", async () => {
    const { service } = createTestEnv();
    await expect(
      service.performAdjustment({
        adjustmentId: "adj-zero",
        userId: "user-1",
        operation: "manual_credit",
        amountMinor: 0,
        currency: "RUB",
        reason: "test",
        performedBy: "admin-1"
      })
    ).rejects.toThrow("positive integer");
  });

  it("gets user balance", async () => {
    const { service } = createTestEnv();
    const balance = await service.getUserBalance("user-1", "RUB");
    expect(balance.availableMinor).toBe(100_000);
  });

  it("lists user balances with available and reserved amounts", async () => {
    const { service, entries } = createTestEnv();
    entries.push({
      entryId: "reserve-1",
      userId: "user-1",
      operation: "reserve",
      amountMinor: 20_000,
      currency: "RUB",
      idempotencyKey: "reserve-idem",
      reference: { requestId: "req-reserve" },
      createdAt: "2026-04-01T10:05:00.000Z"
    });

    const balances = await service.listUserBalances({
      userIds: ["user-2", "user-1", "user-1"],
      currency: "RUB"
    });

    expect(balances).toEqual([
      {
        userId: "user-1",
        availableMinor: 80_000,
        reservedMinor: 20_000,
        currency: "RUB",
        entryCount: 2,
        lastLedgerAt: "2026-04-01T10:05:00.000Z"
      },
      {
        userId: "user-2",
        availableMinor: 0,
        reservedMinor: 0,
        currency: "RUB",
        entryCount: 0,
        lastLedgerAt: null
      }
    ]);
  });
});
