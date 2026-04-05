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
