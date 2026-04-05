import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@lottery/domain";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { WalletLedgerService, WalletLedgerValidationError, type WalletLedgerEntryFactory } from "../services/wallet-ledger-service.js";

describe("WalletLedgerService", () => {
  it("records immutable entries and returns wallet aggregates", async () => {
    const store = new InMemoryLedgerStore();
    const service = createService({
      store
    });

    const credit = await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 100_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });
    const reserve = await service.recordEntry({
      userId: "seed-user",
      operation: "reserve",
      amountMinor: 30_000,
      currency: "RUB",
      idempotencyKey: "seed-user-reserve-1",
      reference: {
        requestId: "req-1"
      }
    });

    expect(credit.replayed).toBe(false);
    expect(reserve.replayed).toBe(false);
    expect(reserve.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 70_000,
      reservedMinor: 30_000,
      currency: "RUB"
    });

    const entries = await service.listEntries("seed-user");
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.operation)).toEqual(["credit", "reserve"]);
  });

  it("returns existing result for idempotent replay", async () => {
    const service = createService();

    await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 50_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    const first = await service.recordEntry({
      userId: "seed-user",
      operation: "reserve",
      amountMinor: 10_000,
      currency: "RUB",
      idempotencyKey: "req-2-reserve",
      reference: {
        requestId: "req-2"
      }
    });
    const replay = await service.recordEntry({
      userId: "seed-user",
      operation: "reserve",
      amountMinor: 10_000,
      currency: "RUB",
      idempotencyKey: "req-2-reserve",
      reference: {
        requestId: "req-2"
      }
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.entry.entryId).toBe(first.entry.entryId);

    const entries = await service.listEntries("seed-user");
    expect(entries).toHaveLength(2);
  });

  it("exposes reserve/debit/release commands with expected balance transitions", async () => {
    const service = createService();

    await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 100_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    const reserve = await service.reserveFunds({
      userId: "seed-user",
      requestId: "req-10",
      amountMinor: 30_000,
      currency: "RUB",
      idempotencyKey: "req-10-reserve"
    });
    expect(reserve.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 70_000,
      reservedMinor: 30_000,
      currency: "RUB"
    });

    const debit = await service.debitReservedFunds({
      userId: "seed-user",
      requestId: "req-10",
      amountMinor: 20_000,
      currency: "RUB",
      idempotencyKey: "req-10-debit"
    });
    expect(debit.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 70_000,
      reservedMinor: 10_000,
      currency: "RUB"
    });

    const release = await service.releaseReservedFunds({
      userId: "seed-user",
      requestId: "req-10",
      amountMinor: 10_000,
      currency: "RUB",
      idempotencyKey: "req-10-release"
    });
    expect(release.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 80_000,
      reservedMinor: 0,
      currency: "RUB"
    });
  });

  it("keeps reserve/debit/release retries idempotent by key", async () => {
    const service = createService();

    await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 100_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    const reserveFirst = await service.reserveFunds({
      userId: "seed-user",
      requestId: "req-20",
      amountMinor: 25_000,
      currency: "RUB",
      idempotencyKey: "req-20-reserve"
    });
    const reserveReplay = await service.reserveFunds({
      userId: "seed-user",
      requestId: "req-20",
      amountMinor: 25_000,
      currency: "RUB",
      idempotencyKey: "req-20-reserve"
    });
    expect(reserveFirst.replayed).toBe(false);
    expect(reserveReplay.replayed).toBe(true);

    const debitFirst = await service.debitReservedFunds({
      userId: "seed-user",
      requestId: "req-20",
      amountMinor: 15_000,
      currency: "RUB",
      idempotencyKey: "req-20-debit"
    });
    const debitReplay = await service.debitReservedFunds({
      userId: "seed-user",
      requestId: "req-20",
      amountMinor: 15_000,
      currency: "RUB",
      idempotencyKey: "req-20-debit"
    });
    expect(debitFirst.replayed).toBe(false);
    expect(debitReplay.replayed).toBe(true);

    const releaseFirst = await service.releaseReservedFunds({
      userId: "seed-user",
      requestId: "req-20",
      amountMinor: 10_000,
      currency: "RUB",
      idempotencyKey: "req-20-release"
    });
    const releaseReplay = await service.releaseReservedFunds({
      userId: "seed-user",
      requestId: "req-20",
      amountMinor: 10_000,
      currency: "RUB",
      idempotencyKey: "req-20-release"
    });
    expect(releaseFirst.replayed).toBe(false);
    expect(releaseReplay.replayed).toBe(true);

    const entries = await service.listEntries("seed-user");
    expect(entries.map((entry) => entry.idempotencyKey)).toEqual([
      "seed-user-credit",
      "req-20-reserve",
      "req-20-debit",
      "req-20-release"
    ]);
  });

  it("requires requestId for reserve/debit/release commands", async () => {
    const service = createService();

    const reserveAction = service.reserveFunds({
      userId: "seed-user",
      requestId: " ",
      amountMinor: 1000,
      currency: "RUB",
      idempotencyKey: "bad-reserve"
    });

    await expect(reserveAction).rejects.toBeInstanceOf(WalletLedgerValidationError);
    await expect(reserveAction).rejects.toThrow("requestId is required");
  });

  it("rejects idempotency conflicts with different payload", async () => {
    const service = createService();

    await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 50_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    await service.recordEntry({
      userId: "seed-user",
      operation: "reserve",
      amountMinor: 5000,
      currency: "RUB",
      idempotencyKey: "req-3-reserve",
      reference: {
        requestId: "req-3"
      }
    });

    const action = service.recordEntry({
      userId: "seed-user",
      operation: "reserve",
      amountMinor: 7000,
      currency: "RUB",
      idempotencyKey: "req-3-reserve",
      reference: {
        requestId: "req-3"
      }
    });

    await expect(action).rejects.toBeInstanceOf(WalletLedgerValidationError);
    await expect(action).rejects.toThrow("different payload");
  });

  it("returns empty snapshot for user without entries", async () => {
    const service = createService();
    const snapshot = await service.getWalletSnapshot("unknown-user", "rub");

    expect(snapshot).toEqual({
      userId: "unknown-user",
      availableMinor: 0,
      reservedMinor: 0,
      currency: "RUB"
    });
  });

  it("sorts history by createdAt then entryId", async () => {
    const store = new InMemoryLedgerStore([
      createEntry({
        entryId: "entry-b",
        createdAt: "2026-04-05T10:01:00.000Z"
      }),
      createEntry({
        entryId: "entry-a",
        createdAt: "2026-04-05T10:01:00.000Z"
      }),
      createEntry({
        entryId: "entry-c",
        createdAt: "2026-04-05T10:00:00.000Z"
      })
    ]);
    const service = createService({ store });

    const entries = await service.listEntries("seed-user");
    expect(entries.map((entry) => entry.entryId)).toEqual(["entry-c", "entry-a", "entry-b"]);
  });

  it("keeps successful reserve/debit lifecycle append-only with expected final wallet snapshot", async () => {
    const service = createService();

    await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 120_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit-success-flow",
      reference: {
        requestId: "seed-credit-success-flow"
      }
    });

    const afterCredit = await service.listEntries("seed-user");
    expect(afterCredit).toHaveLength(1);

    await service.reserveFunds({
      userId: "seed-user",
      requestId: "req-success",
      amountMinor: 45_000,
      currency: "RUB",
      idempotencyKey: "req-success-reserve",
      createdAt: "2026-04-05T10:01:00.000Z"
    });

    const afterReserve = await service.listEntries("seed-user");
    expect(afterReserve).toHaveLength(2);
    expect(afterReserve[0]?.entryId).toBe(afterCredit[0]?.entryId);

    const debit = await service.debitReservedFunds({
      userId: "seed-user",
      requestId: "req-success",
      amountMinor: 45_000,
      currency: "RUB",
      idempotencyKey: "req-success-debit",
      createdAt: "2026-04-05T10:02:00.000Z"
    });

    const finalTimeline = await service.listEntries("seed-user");
    expect(finalTimeline).toHaveLength(3);
    expect(finalTimeline.map((entry) => entry.operation)).toEqual(["credit", "reserve", "debit"]);
    expect(finalTimeline.map((entry) => entry.reference.requestId)).toEqual([
      "seed-credit-success-flow",
      "req-success",
      "req-success"
    ]);
    expect(debit.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 75_000,
      reservedMinor: 0,
      currency: "RUB"
    });
  });

  it("keeps cancelled reserve/release lifecycle append-only and restores available funds", async () => {
    const service = createService();

    await service.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 90_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit-cancel-flow",
      reference: {
        requestId: "seed-credit-cancel-flow"
      }
    });

    const reserve = await service.reserveFunds({
      userId: "seed-user",
      requestId: "req-cancel",
      amountMinor: 30_000,
      currency: "RUB",
      idempotencyKey: "req-cancel-reserve",
      createdAt: "2026-04-05T10:01:00.000Z"
    });
    expect(reserve.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 60_000,
      reservedMinor: 30_000,
      currency: "RUB"
    });

    const release = await service.releaseReservedFunds({
      userId: "seed-user",
      requestId: "req-cancel",
      amountMinor: 30_000,
      currency: "RUB",
      idempotencyKey: "req-cancel-release",
      createdAt: "2026-04-05T10:02:00.000Z"
    });
    expect(release.snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 90_000,
      reservedMinor: 0,
      currency: "RUB"
    });

    const timeline = await service.listEntries("seed-user");
    expect(timeline).toHaveLength(3);
    expect(timeline.map((entry) => entry.operation)).toEqual(["credit", "reserve", "release"]);
    expect(timeline.map((entry) => entry.idempotencyKey)).toEqual([
      "seed-user-credit-cancel-flow",
      "req-cancel-reserve",
      "req-cancel-release"
    ]);
  });
});

function createService(input?: {
  readonly store?: InMemoryLedgerStore;
}): WalletLedgerService {
  const store = input?.store ?? new InMemoryLedgerStore();
  const timeSource = new FixedTimeSource("2026-04-05T10:00:00.000Z");
  const entryFactory = new SequentialEntryFactory();

  return new WalletLedgerService({
    ledgerStore: store,
    timeSource,
    entryFactory
  });
}

function createEntry(overrides?: Partial<LedgerEntry>): LedgerEntry {
  return {
    entryId: overrides?.entryId ?? "entry-default",
    userId: overrides?.userId ?? "seed-user",
    operation: overrides?.operation ?? "credit",
    amountMinor: overrides?.amountMinor ?? 1000,
    currency: overrides?.currency ?? "RUB",
    idempotencyKey: overrides?.idempotencyKey ?? `idem-${overrides?.entryId ?? "default"}`,
    reference: overrides?.reference ?? {
      requestId: "req-default"
    },
    createdAt: overrides?.createdAt ?? "2026-04-05T10:00:00.000Z"
  };
}

class InMemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[];

  constructor(initialEntries: readonly LedgerEntry[] = []) {
    this.entries = initialEntries.map(cloneEntry);
  }

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return this.entries.map(cloneEntry);
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).map(cloneEntry);
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = [...this.entries, cloneEntry(entry)];
  }
}

class FixedTimeSource implements TimeSource {
  constructor(private readonly now: string) {}

  nowIso(): string {
    return this.now;
  }
}

class SequentialEntryFactory implements WalletLedgerEntryFactory {
  private index = 0;

  nextEntryId(): string {
    this.index += 1;
    return `ledger-${this.index}`;
  }
}

function cloneEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    reference: { ...entry.reference }
  };
}
