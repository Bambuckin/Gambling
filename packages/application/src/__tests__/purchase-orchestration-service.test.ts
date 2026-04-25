import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseRecord, LedgerEntry, PurchaseRequestRecord } from "@lottery/domain";
import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseQueueTransport } from "../ports/purchase-queue-transport.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import {
  PurchaseOrchestrationService,
  PurchaseOrchestrationServiceError
} from "../services/purchase-orchestration-service.js";
import {
  type WalletLedgerEntryFactory,
  WalletLedgerService
} from "../services/wallet-ledger-service.js";

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

  it("recovers interrupted awaiting and confirmed requests for the same user and lottery", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-301a",
        userId: "seed-user",
        amountMinor: 100
      }),
      appendPurchaseRequestTransition(
        createAwaitingRequest({
          requestId: "req-301b",
          userId: "seed-user",
          amountMinor: 120
        }),
        "confirmed",
        {
          eventId: "req-301b:confirmed",
          occurredAt: "2026-04-05T20:11:00.000Z"
        }
      ),
      createAwaitingRequest({
        requestId: "req-301c",
        userId: "other-user",
        amountMinor: 140
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

    const recovered = await service.recoverInterruptedRequests({
      userId: "seed-user",
      lotteryCode: "demo-lottery"
    });

    expect(recovered).toEqual([
      {
        requestId: "req-301a",
        recovered: true,
        replayed: false,
        state: "queued",
        message: null
      },
      {
        requestId: "req-301b",
        recovered: true,
        replayed: false,
        state: "queued",
        message: null
      }
    ]);
    await expect(requestStore.getRequestById("req-301a")).resolves.toMatchObject({
      state: "queued"
    });
    await expect(requestStore.getRequestById("req-301b")).resolves.toMatchObject({
      state: "queued"
    });
    await expect(requestStore.getRequestById("req-301c")).resolves.toMatchObject({
      state: "awaiting_confirmation"
    });
    await expect(queueStore.listQueueItems()).resolves.toHaveLength(2);
  });

  it("reports interrupted requests that still cannot be queued without crashing recovery", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-301d",
        userId: "seed-user",
        amountMinor: 500
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const walletLedgerService = createWalletLedgerService();

    const service = createService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    await expect(
      service.recoverInterruptedRequests({
        userId: "seed-user",
        requestId: "req-301d"
      })
    ).resolves.toEqual([
      {
        requestId: "req-301d",
        recovered: false,
        replayed: false,
        state: "awaiting_confirmation",
        message: expect.stringContaining("reserve")
      }
    ]);
    await expect(requestStore.getRequestById("req-301d")).resolves.toMatchObject({
      state: "awaiting_confirmation"
    });
    await expect(queueStore.listQueueItems()).resolves.toHaveLength(0);
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

  it("does not materialize canonical purchase when reserve fails before queueing", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-302-funds",
        userId: "seed-user",
        amountMinor: 500
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const canonicalPurchaseStore = new InMemoryCanonicalPurchaseStore();
    const walletLedgerService = createWalletLedgerService();

    const service = createService({
      requestStore,
      queueStore,
      canonicalPurchaseStore,
      walletLedgerService
    });

    const action = service.confirmAndQueueRequest({
      requestId: "req-302-funds",
      userId: "seed-user"
    });

    await expect(action).rejects.toThrow("reserve");
    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-302-funds")).resolves.toBeNull();
    await expect(requestStore.getRequestById("req-302-funds")).resolves.toMatchObject({
      state: "awaiting_confirmation"
    });
    await expect(queueStore.listQueueItems()).resolves.toHaveLength(0);
  });

  it("queues awaiting request as admin-priority through admin enqueue path", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-302a",
        userId: "seed-user",
        amountMinor: 120
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

    const result = await service.confirmAndQueueAsAdminPriority({
      requestId: "req-302a"
    });

    expect(result.replayed).toBe(false);
    expect(result.queueItem.priority).toBe("admin-priority");
    expect(result.request.state).toBe("queued");
  });

  it("reprioritizes queued request from regular to admin-priority", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-302b",
        userId: "seed-user",
        amountMinor: 140
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

    await service.confirmAndQueueRequest({
      requestId: "req-302b",
      userId: "seed-user"
    });
    const reprioritized = await service.reprioritizeQueuedRequest({
      requestId: "req-302b",
      priority: "admin-priority"
    });

    expect(reprioritized.priority).toBe("admin-priority");
    expect(reprioritized.status).toBe("queued");
  });

  it("rejects reprioritizing non-queued item", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-302c",
        userId: "seed-user",
        amountMinor: 160
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

    await service.confirmAndQueueRequest({
      requestId: "req-302c",
      userId: "seed-user"
    });
    await queueStore.saveQueueItem({
      requestId: "req-302c",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      attemptCount: 1,
      priority: "regular",
      enqueuedAt: "2026-04-05T20:10:00.000Z",
      status: "executing"
    });

    const action = service.reprioritizeQueuedRequest({
      requestId: "req-302c",
      priority: "admin-priority"
    });

    await expect(action).rejects.toBeInstanceOf(PurchaseOrchestrationServiceError);
    await expect(action).rejects.toMatchObject({
      code: "request_state_invalid"
    });
  });

  it("cancels queued request, releases reserve, and removes queue item", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-303",
        userId: "seed-user",
        amountMinor: 250
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

    await service.confirmAndQueueRequest({
      requestId: "req-303",
      userId: "seed-user"
    });
    const cancelResult = await service.cancelQueuedRequest({
      requestId: "req-303",
      userId: "seed-user"
    });

    expect(cancelResult.replayed).toBe(false);
    expect(cancelResult.request.state).toBe("reserve_released");
    expect(cancelResult.request.journal.map((entry) => entry.toState)).toEqual([
      "awaiting_confirmation",
      "confirmed",
      "queued",
      "canceled",
      "reserve_released"
    ]);

    const queueItems = await queueStore.listQueueItems();
    expect(queueItems).toHaveLength(0);

    const walletEntries = await walletLedgerService.listEntries("seed-user");
    expect(walletEntries.map((entry) => entry.operation)).toEqual(["credit", "reserve", "release"]);
    expect(walletEntries[2]?.idempotencyKey).toBe("req-303:cancel-release");
  });

  it("returns replayed when cancel is called after reserve is already released", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-304",
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

    await service.confirmAndQueueRequest({
      requestId: "req-304",
      userId: "seed-user"
    });
    await service.cancelQueuedRequest({
      requestId: "req-304",
      userId: "seed-user"
    });
    const replay = await service.cancelQueuedRequest({
      requestId: "req-304",
      userId: "seed-user"
    });

    expect(replay.replayed).toBe(true);
    expect(replay.request.state).toBe("reserve_released");

    const walletEntries = await walletLedgerService.listEntries("seed-user");
    expect(walletEntries.map((entry) => entry.idempotencyKey)).toEqual([
      "seed-user-credit",
      "req-304:reserve",
      "req-304:cancel-release"
    ]);
  });

  it("debits stale reserve when a purchased request is no longer in the queue", async () => {
    const purchasedRequest = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        appendPurchaseRequestTransition(
          appendPurchaseRequestTransition(
            createAwaitingRequest({
              requestId: "req-reconcile-debit",
              userId: "seed-user",
              amountMinor: 150
            }),
            "confirmed",
            {
              eventId: "req-reconcile-debit:confirmed",
              occurredAt: "2026-04-05T20:01:00.000Z"
            }
          ),
          "queued",
          {
            eventId: "req-reconcile-debit:queued",
            occurredAt: "2026-04-05T20:02:00.000Z"
          }
        ),
        "executing",
        {
          eventId: "req-reconcile-debit:executing",
          occurredAt: "2026-04-05T20:02:30.000Z"
        }
      ),
      "success",
      {
        eventId: "req-reconcile-debit:success",
        occurredAt: "2026-04-05T20:03:00.000Z"
      }
    );
    const requestStore = new InMemoryPurchaseRequestStore([purchasedRequest]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const walletLedgerService = createWalletLedgerService();
    await seedCredit(walletLedgerService, "seed-user", 1000);
    await walletLedgerService.reserveFunds({
      userId: "seed-user",
      requestId: "req-reconcile-debit",
      amountMinor: 150,
      currency: "RUB",
      drawId: "draw-100",
      idempotencyKey: "req-reconcile-debit:reserve"
    });
    const service = createService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    const result = await service.reconcileDetachedReserves({
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      currency: "RUB"
    });

    expect(result).toEqual({
      debitedRequests: 1,
      releasedRequests: 0,
      skippedActiveRequests: 0
    });
    await expect(walletLedgerService.getWalletSnapshot("seed-user", "RUB")).resolves.toEqual({
      userId: "seed-user",
      availableMinor: 850,
      reservedMinor: 0,
      currency: "RUB"
    });
    expect((await walletLedgerService.listEntries("seed-user")).map((entry) => entry.operation)).toEqual([
      "credit",
      "reserve",
      "debit"
    ]);
  });

  it("releases stale reserve when a non-purchased request is no longer in the queue", async () => {
    const detachedQueuedRequest = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        createAwaitingRequest({
          requestId: "req-reconcile-release",
          userId: "seed-user",
          amountMinor: 120
        }),
        "confirmed",
        {
          eventId: "req-reconcile-release:confirmed",
          occurredAt: "2026-04-05T20:01:00.000Z"
        }
      ),
      "queued",
      {
        eventId: "req-reconcile-release:queued",
        occurredAt: "2026-04-05T20:02:00.000Z"
      }
    );
    const requestStore = new InMemoryPurchaseRequestStore([detachedQueuedRequest]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const walletLedgerService = createWalletLedgerService();
    await seedCredit(walletLedgerService, "seed-user", 1000);
    await walletLedgerService.reserveFunds({
      userId: "seed-user",
      requestId: "req-reconcile-release",
      amountMinor: 120,
      currency: "RUB",
      drawId: "draw-100",
      idempotencyKey: "req-reconcile-release:reserve"
    });
    const service = createService({
      requestStore,
      queueStore,
      walletLedgerService
    });

    const result = await service.reconcileDetachedReserves({
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      currency: "RUB"
    });

    expect(result).toEqual({
      debitedRequests: 0,
      releasedRequests: 1,
      skippedActiveRequests: 0
    });
    await expect(walletLedgerService.getWalletSnapshot("seed-user", "RUB")).resolves.toEqual({
      userId: "seed-user",
      availableMinor: 1000,
      reservedMinor: 0,
      currency: "RUB"
    });
    expect((await walletLedgerService.listEntries("seed-user")).map((entry) => entry.operation)).toEqual([
      "credit",
      "reserve",
      "release"
    ]);
    await expect(requestStore.getRequestById("req-reconcile-release")).resolves.toMatchObject({
      state: "reserve_released"
    });
  });

  it("creates queued canonical purchase during confirm-and-queue", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-305",
        userId: "seed-user",
        amountMinor: 140
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const canonicalPurchaseStore = new InMemoryCanonicalPurchaseStore();
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
      canonicalPurchaseStore,
      walletLedgerService
    });

    await service.confirmAndQueueRequest({
      requestId: "req-305",
      userId: "seed-user"
    });

    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-305")).resolves.toMatchObject({
      snapshot: {
        purchaseId: "req-305",
        legacyRequestId: "req-305"
      },
      status: "queued"
    });
  });

  it("marks canonical purchase canceled when queued request is canceled", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createAwaitingRequest({
        requestId: "req-306",
        userId: "seed-user",
        amountMinor: 140
      })
    ]);
    const queueStore = new InMemoryPurchaseQueueStore();
    const canonicalPurchaseStore = new InMemoryCanonicalPurchaseStore();
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
      canonicalPurchaseStore,
      walletLedgerService
    });

    await service.confirmAndQueueRequest({
      requestId: "req-306",
      userId: "seed-user"
    });
    await service.cancelQueuedRequest({
      requestId: "req-306",
      userId: "seed-user"
    });

    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-306")).resolves.toMatchObject({
      status: "canceled"
    });
  });
});

function createService(input: {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueTransport;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly walletLedgerService: WalletLedgerService;
}): PurchaseOrchestrationService {
  return new PurchaseOrchestrationService({
    requestStore: input.requestStore,
    queueStore: input.queueStore,
    ...(input.canonicalPurchaseStore ? { canonicalPurchaseStore: input.canonicalPurchaseStore } : {}),
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

async function seedCredit(
  walletLedgerService: WalletLedgerService,
  userId: string,
  amountMinor: number
): Promise<void> {
  await walletLedgerService.recordEntry({
    userId,
    operation: "credit",
    amountMinor,
    currency: "RUB",
    idempotencyKey: `${userId}:seed-credit:${amountMinor}`,
    reference: {
      requestId: `${userId}:seed-credit`
    }
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

  async clearAll(): Promise<void> {}
}

class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private records: CanonicalPurchaseRecord[] = [];

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.records.map(cloneCanonicalPurchaseRecord);
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const record = this.records.find((entry) => entry.snapshot.purchaseId === purchaseId) ?? null;
    return record ? cloneCanonicalPurchaseRecord(record) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const record = this.records.find((entry) => entry.snapshot.legacyRequestId === legacyRequestId) ?? null;
    return record ? cloneCanonicalPurchaseRecord(record) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.purchaseId !== record.snapshot.purchaseId);
    this.records = [...filtered, cloneCanonicalPurchaseRecord(record)];
  }

  async clearAll(): Promise<void> {
    this.records = [];
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

  async listSnapshot(): Promise<readonly PurchaseQueueItem[]> {
    return this.listQueueItems();
  }

  async getByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    return this.getQueueItemByRequestId(requestId);
  }

  async enqueue(item: PurchaseQueueItem): Promise<void> {
    await this.saveQueueItem(item);
  }

  async reserve(requestId: string): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing || existing.status !== "queued") {
      return null;
    }

    const nextItem: PurchaseQueueItem = {
      ...existing,
      attemptCount: existing.attemptCount + 1,
      status: "executing"
    };
    await this.saveQueueItem(nextItem);
    return nextItem;
  }

  async requeue(requestId: string): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing) {
      return null;
    }

    const nextItem = existing.status === "queued" ? existing : { ...existing, status: "queued" as const };
    await this.saveQueueItem(nextItem);
    return nextItem;
  }

  async reprioritize(requestId: string, priority: PurchaseQueueItem["priority"]): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing) {
      return null;
    }

    const nextItem = existing.priority === priority ? existing : { ...existing, priority };
    await this.saveQueueItem(nextItem);
    return nextItem;
  }

  async complete(requestId: string): Promise<void> {
    await this.removeQueueItem(requestId);
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

function cloneCanonicalPurchaseRecord(record: CanonicalPurchaseRecord): CanonicalPurchaseRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    status: record.status,
    resultStatus: record.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}
