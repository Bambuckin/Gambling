import { describe, expect, it } from "vitest";
import type { LedgerEntry, PurchaseRequestRecord } from "@lottery/domain";
import { appendPurchaseRequestTransition, createAwaitingConfirmationRequest } from "@lottery/domain";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { AdminQueueService } from "../services/admin-queue-service.js";
import { PurchaseOrchestrationService } from "../services/purchase-orchestration-service.js";
import { type WalletLedgerEntryFactory, WalletLedgerService } from "../services/wallet-ledger-service.js";

describe("AdminQueueService", () => {
  it("returns queue snapshot with active execution and ranked queued rows", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createQueuedRequest({
        requestId: "req-401",
        userId: "seed-user",
        amountMinor: 100
      }),
      createQueuedRequest({
        requestId: "req-402",
        userId: "seed-user",
        amountMinor: 100
      }),
      createExecutingRequest({
        requestId: "req-403",
        userId: "seed-user",
        amountMinor: 100
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore([
      createQueueItem({
        requestId: "req-401",
        priority: "regular",
        status: "queued",
        enqueuedAt: "2026-04-05T20:05:00.000Z"
      }),
      createQueueItem({
        requestId: "req-402",
        priority: "admin-priority",
        status: "queued",
        enqueuedAt: "2026-04-05T20:06:00.000Z"
      }),
      createQueueItem({
        requestId: "req-403",
        priority: "regular",
        status: "executing",
        enqueuedAt: "2026-04-05T20:04:00.000Z"
      })
    ]);
    const service = createAdminQueueService({
      requestStore,
      queueStore
    });

    const snapshot = await service.getQueueSnapshot();

    expect(snapshot.activeExecutionRequestId).toBe("req-403");
    expect(snapshot.queueDepth).toBe(3);
    expect(snapshot.queuedCount).toBe(2);
    expect(snapshot.executingCount).toBe(1);
    expect(snapshot.adminPriorityQueuedCount).toBe(1);
    expect(snapshot.rows.map((row) => row.requestId)).toEqual(["req-403", "req-402", "req-401"]);
    expect(snapshot.rows.map((row) => row.executionOrder)).toEqual([null, 1, 2]);
  });

  it("sets queued request priority through orchestration boundary", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createQueuedRequest({
        requestId: "req-404",
        userId: "seed-user",
        amountMinor: 100
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore([
      createQueueItem({
        requestId: "req-404",
        priority: "regular",
        status: "queued",
        enqueuedAt: "2026-04-05T20:08:00.000Z"
      })
    ]);
    const service = createAdminQueueService({
      requestStore,
      queueStore
    });

    const updated = await service.setQueuePriority({
      requestId: "req-404",
      priority: "admin-priority"
    });

    expect(updated.priority).toBe("admin-priority");
    const stored = await queueStore.getQueueItemByRequestId("req-404");
    expect(stored?.priority).toBe("admin-priority");
  });

  it("enqueues awaiting request as admin-priority", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-405",
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
    const service = createAdminQueueService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    const result = await service.enqueueAsAdminPriority({
      requestId: "req-405"
    });

    expect(result.request.state).toBe("queued");
    expect(result.queueItem.priority).toBe("admin-priority");
  });
});

function createAdminQueueService(input: {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly walletLedgerService?: WalletLedgerService;
}): AdminQueueService {
  return new AdminQueueService({
    requestStore: input.requestStore,
    queueStore: input.queueStore,
    purchaseOrchestrationService: new PurchaseOrchestrationService({
      requestStore: input.requestStore,
      queueStore: input.queueStore,
      walletLedgerService: input.walletLedgerService ?? createWalletLedgerService(),
      timeSource: fixedTimeSource()
    })
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

function createQueuedRequest(input: {
  readonly requestId: string;
  readonly userId: string;
  readonly amountMinor: number;
}): PurchaseRequestRecord {
  return appendPurchaseRequestTransition(
    appendPurchaseRequestTransition(createAwaitingRequest(input), "confirmed", {
      eventId: `${input.requestId}:confirmed`,
      occurredAt: "2026-04-05T20:01:00.000Z"
    }),
    "queued",
    {
      eventId: `${input.requestId}:queued`,
      occurredAt: "2026-04-05T20:02:00.000Z"
    }
  );
}

function createExecutingRequest(input: {
  readonly requestId: string;
  readonly userId: string;
  readonly amountMinor: number;
}): PurchaseRequestRecord {
  return appendPurchaseRequestTransition(createQueuedRequest(input), "executing", {
    eventId: `${input.requestId}:executing:1`,
    occurredAt: "2026-04-05T20:03:00.000Z"
  });
}

function createQueueItem(input: {
  readonly requestId: string;
  readonly priority: "regular" | "admin-priority";
  readonly status: "queued" | "executing";
  readonly enqueuedAt: string;
}): PurchaseQueueItem {
  return {
    requestId: input.requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-100",
    attemptCount: input.status === "executing" ? 1 : 0,
    priority: input.priority,
    status: input.status,
    enqueuedAt: input.enqueuedAt
  };
}

function createWalletLedgerService(): WalletLedgerService {
  return new WalletLedgerService({
    ledgerStore: new InMemoryLedgerStore(),
    timeSource: fixedTimeSource(),
    entryFactory: new SequentialEntryFactory()
  });
}

function fixedTimeSource(): TimeSource {
  return {
    nowIso() {
      return "2026-04-05T20:10:00.000Z";
    }
  };
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

  async clearAll(): Promise<void> {}
}

class InMemoryPurchaseQueueStore implements PurchaseQueueStore {
  private items: PurchaseQueueItem[];

  constructor(initialItems: readonly PurchaseQueueItem[] = []) {
    this.items = initialItems.map((item) => ({ ...item }));
  }

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

  async removeQueueItem(requestId: string): Promise<void> {
    this.items = this.items.filter((entry) => entry.requestId !== requestId);
  }

  async clearAll(): Promise<void> {}
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

  async clearAll(): Promise<void> {}
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
