import { describe, expect, it } from "vitest";
import type { LedgerEntry, PurchaseRequestRecord } from "@lottery/domain";
import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import {
  PurchaseOrchestrationService,
  PurchaseOrchestrationServiceError
} from "../services/purchase-orchestration-service.js";
import { type WalletLedgerEntryFactory, WalletLedgerService } from "../services/wallet-ledger-service.js";

describe("PurchaseOrchestrationService", () => {
  it("confirms awaiting request, reserves funds, and enqueues request", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-300",
        userId: "seed-user",
        amountMinor: 200
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const walletLedgerService = createWalletLedgerService();
    await walletLedgerService.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 1000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    const service = createService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    const result = await service.confirmAndQueueRequest({
      requestId: "req-300",
      userId: "seed-user"
    });

    expect(result.replayed).toBe(false);
    expect(result.request.state).toBe("queued");
    expect(result.request.journal.map((entry) => entry.toState)).toEqual([
      "awaiting_confirmation",
      "confirmed",
      "queued"
    ]);
    expect(result.queueItem.status).toBe("queued");
    expect(result.queueItem.requestId).toBe("req-300");

    const queueItems = await queueStore.listQueueItems();
    expect(queueItems).toHaveLength(1);

    const walletEntries = await walletLedgerService.listEntries("seed-user");
    expect(walletEntries.map((entry) => entry.operation)).toEqual(["credit", "reserve"]);
    expect(walletEntries[1]?.idempotencyKey).toBe("req-300:reserve");
  });

  it("returns replayed for already queued request and does not duplicate reserve", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-301",
        userId: "seed-user",
        amountMinor: 100
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const walletLedgerService = createWalletLedgerService();
    await walletLedgerService.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 1000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    const service = createService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    const first = await service.confirmAndQueueRequest({
      requestId: "req-301",
      userId: "seed-user"
    });
    expect(first.replayed).toBe(false);

    const replay = await service.confirmAndQueueRequest({
      requestId: "req-301",
      userId: "seed-user"
    });
    expect(replay.replayed).toBe(true);
    expect(replay.request.state).toBe("queued");

    const walletEntries = await walletLedgerService.listEntries("seed-user");
    expect(walletEntries.map((entry) => entry.idempotencyKey)).toEqual([
      "seed-user-credit",
      "req-301:reserve"
    ]);
  });

  it("rejects queueing from invalid lifecycle state", async () => {
    const canceled = appendPurchaseRequestTransition(
      createAwaitingRequest({
        requestId: "req-302",
        userId: "seed-user",
        amountMinor: 100
      }),
      "canceled",
      {
        eventId: "req-302:canceled",
        occurredAt: "2026-04-05T20:11:00.000Z"
      }
    );
    const requestStore = new InMemoryPurchaseRequestStore([canceled]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const walletLedgerService = createWalletLedgerService();
    await walletLedgerService.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 1000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-credit"
      }
    });

    const service = createService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    const action = service.confirmAndQueueRequest({
      requestId: "req-302",
      userId: "seed-user"
    });

    await expect(action).rejects.toBeInstanceOf(PurchaseOrchestrationServiceError);
    await expect(action).rejects.toMatchObject({
      code: "request_state_invalid"
    });
  });
});

function createService(input: {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly walletLedgerService: WalletLedgerService;
}): PurchaseOrchestrationService {
  return new PurchaseOrchestrationService({
    requestStore: input.requestStore,
    queueStore: input.queueStore,
    walletLedgerService: input.walletLedgerService,
    timeSource: {
      nowIso() {
        return "2026-04-05T20:10:00.000Z";
      }
    } satisfies TimeSource
  });
}

function createWalletLedgerService(): WalletLedgerService {
  return new WalletLedgerService({
    ledgerStore: new InMemoryLedgerStore(),
    timeSource: {
      nowIso() {
        return "2026-04-05T20:10:00.000Z";
      }
    } satisfies TimeSource,
    entryFactory: new SequentialEntryFactory()
  });
}

function createAwaitingRequest(input: {
  readonly requestId: string;
  readonly userId: string;
  readonly amountMinor: number;
}): PurchaseRequestRecord {
  return createAwaitingConfirmationRequest({
    requestId: input.requestId,
    userId: input.userId,
    lotteryCode: "demo-lottery",
    drawId: "draw-100",
    payload: {
      draw_count: 1
    },
    costMinor: input.amountMinor,
    currency: "RUB",
    createdAt: "2026-04-05T20:00:00.000Z"
  });
}

class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  private records: PurchaseRequestRecord[];

  constructor(initialRecords: readonly PurchaseRequestRecord[]) {
    this.records = initialRecords.map(cloneRequestRecord);
  }

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return this.records.map(cloneRequestRecord);
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    const record = this.records.find((entry) => entry.snapshot.requestId === requestId) ?? null;
    return record ? cloneRequestRecord(record) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId);
    this.records = [...filtered, cloneRequestRecord(record)];
  }
}

class InMemoryPurchaseQueueStore implements PurchaseQueueStore {
  private items: PurchaseQueueItem[] = [];

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    return this.items.map((item) => ({ ...item }));
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    const item = this.items.find((entry) => entry.requestId === requestId) ?? null;
    return item ? { ...item } : null;
  }

  async saveQueueItem(item: PurchaseQueueItem): Promise<void> {
    const filtered = this.items.filter((entry) => entry.requestId !== item.requestId);
    this.items = [...filtered, { ...item }];
  }
}

class InMemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[] = [];

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return this.entries.map(cloneLedgerEntry);
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).map(cloneLedgerEntry);
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = [...this.entries, cloneLedgerEntry(entry)];
  }
}

class SequentialEntryFactory implements WalletLedgerEntryFactory {
  private index = 0;

  nextEntryId(): string {
    this.index += 1;
    return `ledger-${this.index}`;
  }
}

function cloneRequestRecord(record: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function cloneLedgerEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    reference: { ...entry.reference }
  };
}
