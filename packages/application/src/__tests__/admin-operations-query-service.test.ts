import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseRecord, PurchaseAttemptRecord, PurchaseRequestRecord, RequestState } from "@lottery/domain";
import {
  appendCanonicalPurchaseTransition,
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest,
  createPurchaseAttemptRecord,
  createSubmittedCanonicalPurchase
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseAttemptStore } from "../ports/purchase-attempt-store.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { AdminOperationsQueryService } from "../services/admin-operations-query-service.js";

describe("AdminOperationsQueryService", () => {
  it("returns terminal and queue snapshot without problem requests when runtime is healthy", async () => {
    const service = createService({
      nowIso: "2026-04-05T21:10:00.000Z",
      requests: [
        createSuccessRequest("req-501", "2026-04-05T21:03:00.000Z"),
        createQueuedRequest("req-502", "2026-04-05T21:07:00.000Z"),
        createExecutingRequest("req-503", "2026-04-05T21:09:00.000Z")
      ],
      queueItems: [
        createQueueItem({
          requestId: "req-502",
          status: "queued",
          priority: "admin-priority",
          attemptCount: 0,
          enqueuedAt: "2026-04-05T21:07:00.000Z"
        }),
        createQueueItem({
          requestId: "req-503",
          status: "executing",
          priority: "regular",
          attemptCount: 1,
          enqueuedAt: "2026-04-05T21:08:00.000Z"
        })
      ]
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.terminal.state).toBe("busy");
    expect(snapshot.terminal.activeRequestId).toBe("req-503");
    expect(snapshot.queue).toEqual({
      queueDepth: 2,
      queuedCount: 1,
      executingCount: 1,
      adminPriorityQueuedCount: 1,
      regularQueuedCount: 0
    });
    expect(snapshot.problemRequests).toEqual([]);
  });

  it("projects retrying, error, and stale executing requests with anomaly hints", async () => {
    const service = createService({
      nowIso: "2026-04-05T21:10:00.000Z",
      requests: [
        createErrorRequest("req-601", "2026-04-05T21:09:00.000Z"),
        createRetryingRequest("req-602", "2026-04-05T21:08:00.000Z"),
        createExecutingRequest("req-603", "2026-04-05T20:58:00.000Z")
      ],
      queueItems: [
        createQueueItem({
          requestId: "req-602",
          status: "queued",
          priority: "admin-priority",
          attemptCount: 2,
          enqueuedAt: "2026-04-05T21:08:05.000Z"
        }),
        createQueueItem({
          requestId: "req-603",
          status: "executing",
          priority: "regular",
          attemptCount: 3,
          enqueuedAt: "2026-04-05T20:58:10.000Z"
        })
      ]
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.problemRequests.map((item) => item.requestId)).toEqual(["req-601", "req-602", "req-603"]);
    expect(snapshot.problemRequests.map((item) => item.anomalyHint)).toEqual(["error", "retrying", "stale-executing"]);
    expect(snapshot.problemRequests[0]?.queueStatus).toBe("missing");
    expect(snapshot.problemRequests[1]?.queuePriority).toBe("admin-priority");
    expect(snapshot.problemRequests[2]?.attemptCount).toBe(3);
    expect(snapshot.problemRequests[0]?.lastError).toContain("outcome=error");
  });

  it("uses canonical projections for overlayed and canonical-only problem requests", async () => {
    const service = createService({
      nowIso: "2026-04-05T21:10:00.000Z",
      requests: [createQueuedRequest("req-604", "2026-04-05T21:01:00.000Z")],
      queueItems: [
        createQueueItem({
          requestId: "req-604",
          status: "queued",
          priority: "regular",
          attemptCount: 1,
          enqueuedAt: "2026-04-05T21:01:00.000Z"
        })
      ],
      canonicalPurchases: [
        createCanonicalRetryingPurchase("purchase-604", "req-604", "2026-04-05T21:05:00.000Z"),
        createCanonicalProcessingPurchase("purchase-605", "req-605", "2026-04-05T21:02:00.000Z")
      ],
      attempts: [
        createPurchaseAttemptRecord({
          purchaseId: "purchase-604",
          legacyRequestId: "req-604",
          attemptNumber: 1,
          outcome: "retrying",
          startedAt: "2026-04-05T21:03:00.000Z",
          finishedAt: "2026-04-05T21:03:01.000Z",
          rawOutput: "retry one"
        }),
        createPurchaseAttemptRecord({
          purchaseId: "purchase-604",
          legacyRequestId: "req-604",
          attemptNumber: 2,
          outcome: "retrying",
          startedAt: "2026-04-05T21:05:00.000Z",
          finishedAt: "2026-04-05T21:05:01.000Z",
          rawOutput: "retry two"
        }),
        createPurchaseAttemptRecord({
          purchaseId: "purchase-605",
          legacyRequestId: "req-605",
          attemptNumber: 1,
          outcome: "retrying",
          startedAt: "2026-04-05T21:02:00.000Z",
          finishedAt: "2026-04-05T21:02:01.000Z",
          rawOutput: "processing"
        })
      ]
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.problemRequests.map((item) => item.requestId)).toEqual(["req-604", "req-605"]);
    expect(snapshot.problemRequests.map((item) => item.anomalyHint)).toEqual(["retrying", "stale-executing"]);
    expect(snapshot.problemRequests[0]).toMatchObject({
      requestId: "req-604",
      status: "retrying",
      attemptCount: 2,
      queueStatus: "queued"
    });
    expect(snapshot.problemRequests[1]).toMatchObject({
      requestId: "req-605",
      status: "executing",
      attemptCount: 1,
      queueStatus: "missing"
    });
  });

  it("keeps executing attempt count from queue while canonical purchase has no persisted attempts yet", async () => {
    const service = createService({
      nowIso: "2026-04-05T21:15:00.000Z",
      requests: [createExecutingRequest("req-606", "2026-04-05T21:08:00.000Z")],
      queueItems: [
        createQueueItem({
          requestId: "req-606",
          status: "executing",
          priority: "regular",
          attemptCount: 1,
          enqueuedAt: "2026-04-05T21:08:00.000Z"
        })
      ],
      canonicalPurchases: [createCanonicalProcessingPurchase("purchase-606", "req-606", "2026-04-05T21:08:00.000Z")],
      attempts: []
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.problemRequests[0]).toMatchObject({
      requestId: "req-606",
      attemptCount: 1,
      status: "executing"
    });
  });
});

function createService(input: {
  readonly nowIso: string;
  readonly requests: readonly PurchaseRequestRecord[];
  readonly queueItems: readonly PurchaseQueueItem[];
  readonly canonicalPurchases?: readonly CanonicalPurchaseRecord[];
  readonly attempts?: readonly PurchaseAttemptRecord[];
}): AdminOperationsQueryService {
  return new AdminOperationsQueryService({
    requestStore: new InMemoryPurchaseRequestStore(input.requests),
    queueStore: new InMemoryPurchaseQueueStore(input.queueItems),
    canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore(input.canonicalPurchases ?? []),
    purchaseAttemptStore: new InMemoryPurchaseAttemptStore(input.attempts ?? []),
    timeSource: {
      nowIso() {
        return input.nowIso;
      }
    } satisfies TimeSource
  });
}

function createQueuedRequest(requestId: string, queuedAt: string): PurchaseRequestRecord {
  return createRequestRecord({
    requestId,
    transitions: [
      { toState: "confirmed", occurredAt: "2026-04-05T21:00:20.000Z" },
      { toState: "queued", occurredAt: queuedAt }
    ]
  });
}

function createExecutingRequest(requestId: string, executingAt: string): PurchaseRequestRecord {
  return createRequestRecord({
    requestId,
    transitions: [
      { toState: "confirmed", occurredAt: "2026-04-05T21:00:20.000Z" },
      { toState: "queued", occurredAt: "2026-04-05T21:00:40.000Z" },
      { toState: "executing", occurredAt: executingAt, note: "terminal_attempt started" }
    ]
  });
}

function createRetryingRequest(requestId: string, retryingAt: string): PurchaseRequestRecord {
  return createRequestRecord({
    requestId,
    transitions: [
      { toState: "confirmed", occurredAt: "2026-04-05T21:00:20.000Z" },
      { toState: "queued", occurredAt: "2026-04-05T21:00:40.000Z" },
      { toState: "executing", occurredAt: "2026-04-05T21:07:40.000Z", note: "terminal_attempt started" },
      { toState: "retrying", occurredAt: retryingAt, note: "terminal_attempt outcome=retrying transient=true" }
    ]
  });
}

function createErrorRequest(requestId: string, errorAt: string): PurchaseRequestRecord {
  return createRequestRecord({
    requestId,
    transitions: [
      { toState: "confirmed", occurredAt: "2026-04-05T21:00:20.000Z" },
      { toState: "queued", occurredAt: "2026-04-05T21:00:40.000Z" },
      { toState: "executing", occurredAt: "2026-04-05T21:08:40.000Z", note: "terminal_attempt started" },
      { toState: "error", occurredAt: errorAt, note: "terminal_attempt outcome=error code=E_TIMEOUT" }
    ]
  });
}

function createSuccessRequest(requestId: string, successAt: string): PurchaseRequestRecord {
  return createRequestRecord({
    requestId,
    transitions: [
      { toState: "confirmed", occurredAt: "2026-04-05T21:00:20.000Z" },
      { toState: "queued", occurredAt: "2026-04-05T21:00:40.000Z" },
      { toState: "executing", occurredAt: "2026-04-05T21:02:20.000Z" },
      { toState: "success", occurredAt: successAt, note: "terminal_attempt outcome=success" }
    ]
  });
}

function createRequestRecord(input: {
  readonly requestId: string;
  readonly transitions: readonly {
    readonly toState: RequestState;
    readonly occurredAt: string;
    readonly note?: string;
  }[];
}): PurchaseRequestRecord {
  let record = createAwaitingConfirmationRequest({
    requestId: input.requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-800",
    payload: {
      draw_count: 1
    },
    costMinor: 100,
    currency: "RUB",
    createdAt: "2026-04-05T21:00:00.000Z"
  });

  for (const [index, transition] of input.transitions.entries()) {
    record = appendPurchaseRequestTransition(record, transition.toState, {
      eventId: `${input.requestId}:${transition.toState}:${index + 1}`,
      occurredAt: transition.occurredAt,
      ...(transition.note ? { note: transition.note } : {})
    });
  }

  return record;
}

function createQueueItem(input: {
  readonly requestId: string;
  readonly status: "queued" | "executing";
  readonly priority: "regular" | "admin-priority";
  readonly attemptCount: number;
  readonly enqueuedAt: string;
}): PurchaseQueueItem {
  return {
    requestId: input.requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-800",
    status: input.status,
    priority: input.priority,
    attemptCount: input.attemptCount,
    enqueuedAt: input.enqueuedAt
  };
}

function createCanonicalRetryingPurchase(
  purchaseId: string,
  legacyRequestId: string,
  retryingAt: string
): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId,
          legacyRequestId,
          userId: "seed-user",
          lotteryCode: "demo-lottery",
          drawId: "draw-800",
          payload: {
            draw_count: 1
          },
          costMinor: 100,
          currency: "RUB",
          submittedAt: "2026-04-05T21:00:00.000Z"
        }),
        "queued",
        {
          eventId: `${purchaseId}:queued`,
          occurredAt: "2026-04-05T21:00:40.000Z"
        }
      ),
      "processing",
      {
        eventId: `${purchaseId}:processing`,
        occurredAt: "2026-04-05T21:03:00.000Z"
      }
    ),
    "purchase_failed_retryable",
    {
      eventId: `${purchaseId}:retryable`,
      occurredAt: retryingAt
    }
  );
}

function createCanonicalProcessingPurchase(
  purchaseId: string,
  legacyRequestId: string,
  processingAt: string
): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      createSubmittedCanonicalPurchase({
        purchaseId,
        legacyRequestId,
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-800",
        payload: {
          draw_count: 1
        },
        costMinor: 100,
        currency: "RUB",
        submittedAt: "2026-04-05T21:00:00.000Z"
      }),
      "queued",
      {
        eventId: `${purchaseId}:queued`,
        occurredAt: "2026-04-05T21:01:00.000Z"
      }
    ),
    "processing",
    {
      eventId: `${purchaseId}:processing`,
      occurredAt: processingAt
    }
  );
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
    const found = this.records.find((record) => record.snapshot.requestId === requestId) ?? null;
    return found ? cloneRequestRecord(found) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId);
    this.records = [...filtered, cloneRequestRecord(record)];
  }

  async clearAll(): Promise<void> {}
}

class InMemoryPurchaseQueueStore implements PurchaseQueueStore {
  private items: PurchaseQueueItem[];

  constructor(initialItems: readonly PurchaseQueueItem[]) {
    this.items = initialItems.map((item) => ({ ...item }));
  }

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    return this.items.map((item) => ({ ...item }));
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    const found = this.items.find((item) => item.requestId === requestId) ?? null;
    return found ? { ...found } : null;
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

class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private readonly records: CanonicalPurchaseRecord[];

  constructor(initialRecords: readonly CanonicalPurchaseRecord[]) {
    this.records = initialRecords.map(cloneCanonicalPurchaseRecord);
  }

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.records.map(cloneCanonicalPurchaseRecord);
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const found = this.records.find((record) => record.snapshot.purchaseId === purchaseId) ?? null;
    return found ? cloneCanonicalPurchaseRecord(found) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const found = this.records.find((record) => record.snapshot.legacyRequestId === legacyRequestId) ?? null;
    return found ? cloneCanonicalPurchaseRecord(found) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    void record;
    throw new Error("read-only test double");
  }

  async clearAll(): Promise<void> {}
}

class InMemoryPurchaseAttemptStore implements PurchaseAttemptStore {
  private readonly records: PurchaseAttemptRecord[];

  constructor(initialRecords: readonly PurchaseAttemptRecord[]) {
    this.records = initialRecords.map((record) => ({ ...record }));
  }

  async listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.records.filter((record) => record.purchaseId === purchaseId).map((record) => ({ ...record }));
  }

  async listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.records.filter((record) => record.legacyRequestId === legacyRequestId).map((record) => ({ ...record }));
  }

  async getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null> {
    const found = this.records.find((record) => record.attemptId === attemptId) ?? null;
    return found ? { ...found } : null;
  }

  async saveAttempt(record: PurchaseAttemptRecord): Promise<void> {
    void record;
    throw new Error("read-only test double");
  }

  async clearAll(): Promise<void> {}
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
