import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseRecord, PurchaseAttemptRecord, PurchaseRequestRecord } from "@lottery/domain";
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
import { TerminalReceiverQueryService } from "../services/terminal-receiver-query-service.js";

describe("TerminalReceiverQueryService", () => {
  it("builds receiver rows from canonical purchases and attempts even without legacy request rows", async () => {
    const purchase = appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId: "purchase-930",
          legacyRequestId: "req-930",
          userId: "seed-user",
          lotteryCode: "bolshaya-8",
          drawId: "draw-930",
          payload: { draw_count: 1 },
          costMinor: 100,
          currency: "RUB",
          submittedAt: "2026-04-21T10:00:00.000Z"
        }),
        "queued",
        {
          eventId: "purchase-930:queued",
          occurredAt: "2026-04-21T10:00:30.000Z"
        }
      ),
      "processing",
      {
        eventId: "purchase-930:processing",
        occurredAt: "2026-04-21T10:01:00.000Z"
      }
    );

    const service = createService({
      requests: [],
      queueItems: [],
      canonicalPurchases: [purchase],
      attempts: [
        createPurchaseAttemptRecord({
          purchaseId: "purchase-930",
          legacyRequestId: "req-930",
          attemptNumber: 1,
          outcome: "retrying",
          startedAt: "2026-04-21T10:01:00.000Z",
          finishedAt: "2026-04-21T10:01:10.000Z",
          rawOutput: "receiver=test payload_base64=eyJ0aWNrZXRzIjpbXX0"
        })
      ]
    });

    const rows = await service.listRows({ lotteryCode: "bolshaya-8" });

    expect(rows).toEqual([
      expect.objectContaining({
        requestId: "req-930",
        purchaseId: "purchase-930",
        state: "executing",
        attemptCount: 1,
        reservedAt: "2026-04-21T10:01:00.000Z",
        workerRawOutput: "receiver=test payload_base64=eyJ0aWNrZXRzIjpbXX0"
      })
    ]);
  });

  it("keeps in-flight attempt count from queue when canonical attempts are not persisted yet", async () => {
    const purchase = appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId: "purchase-931",
          legacyRequestId: "req-931",
          userId: "seed-user",
          lotteryCode: "bolshaya-8",
          drawId: "draw-931",
          payload: { draw_count: 1 },
          costMinor: 100,
          currency: "RUB",
          submittedAt: "2026-04-21T10:00:00.000Z"
        }),
        "queued",
        {
          eventId: "purchase-931:queued",
          occurredAt: "2026-04-21T10:00:30.000Z"
        }
      ),
      "processing",
      {
        eventId: "purchase-931:processing",
        occurredAt: "2026-04-21T10:01:00.000Z"
      }
    );

    const service = createService({
      requests: [],
      queueItems: [
        {
          requestId: "req-931",
          userId: "seed-user",
          lotteryCode: "bolshaya-8",
          drawId: "draw-931",
          attemptCount: 1,
          priority: "regular",
          enqueuedAt: "2026-04-21T10:00:30.000Z",
          status: "executing"
        }
      ],
      canonicalPurchases: [purchase],
      attempts: []
    });

    const rows = await service.listRows({ lotteryCode: "bolshaya-8" });

    expect(rows[0]).toMatchObject({
      requestId: "req-931",
      attemptCount: 1,
      state: "executing"
    });
  });

  it("falls back to legacy request rows when canonical purchase truth is absent", async () => {
    const queued = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        createAwaitingConfirmationRequest({
          requestId: "req-932",
          userId: "seed-user",
          lotteryCode: "bolshaya-8",
          drawId: "draw-932",
          payload: { draw_count: 1 },
          costMinor: 100,
          currency: "RUB",
          createdAt: "2026-04-21T10:00:00.000Z"
        }),
        "confirmed",
        {
          eventId: "req-932:confirmed",
          occurredAt: "2026-04-21T10:00:10.000Z"
        }
      ),
      "queued",
      {
        eventId: "req-932:queued",
        occurredAt: "2026-04-21T10:00:20.000Z"
      }
    );
    const request = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        queued,
        "executing",
        {
          eventId: "req-932:executing",
          occurredAt: "2026-04-21T10:01:00.000Z"
        }
      ),
      "error",
      {
        eventId: "req-932:error",
        occurredAt: "2026-04-21T10:02:00.000Z",
        note: "terminal_attempt outcome=error rawOutput=legacy failure"
      }
    );

    const service = createService({
      requests: [request],
      queueItems: [],
      canonicalPurchases: [],
      attempts: []
    });

    const rows = await service.listRows({ lotteryCode: "bolshaya-8" });

    expect(rows).toEqual([
      expect.objectContaining({
        requestId: "req-932",
        purchaseId: null,
        state: "error",
        workerRawOutput: "legacy failure"
      })
    ]);
  });
});

function createService(input: {
  readonly requests: readonly PurchaseRequestRecord[];
  readonly queueItems: readonly PurchaseQueueItem[];
  readonly canonicalPurchases: readonly CanonicalPurchaseRecord[];
  readonly attempts: readonly PurchaseAttemptRecord[];
}): TerminalReceiverQueryService {
  return new TerminalReceiverQueryService({
    requestStore: new InMemoryPurchaseRequestStore(input.requests),
    queueStore: new InMemoryPurchaseQueueStore(input.queueItems),
    canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore(input.canonicalPurchases),
    purchaseAttemptStore: new InMemoryPurchaseAttemptStore(input.attempts)
  });
}

class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  constructor(private readonly requests: readonly PurchaseRequestRecord[]) {}

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return this.requests.map((record) => ({
      snapshot: {
        ...record.snapshot,
        payload: { ...record.snapshot.payload }
      },
      state: record.state,
      journal: record.journal.map((entry) => ({ ...entry }))
    }));
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    return (await this.listRequests()).find((record) => record.snapshot.requestId === requestId) ?? null;
  }

  async saveRequest(): Promise<void> {
    throw new Error("not needed in test");
  }

  async clearAll(): Promise<void> {}
}

class InMemoryPurchaseQueueStore implements PurchaseQueueStore {
  constructor(private readonly queueItems: readonly PurchaseQueueItem[]) {}

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    return this.queueItems.map((item) => ({ ...item }));
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    return this.queueItems.find((item) => item.requestId === requestId) ?? null;
  }

  async saveQueueItem(): Promise<void> {
    throw new Error("not needed in test");
  }

  async removeQueueItem(): Promise<void> {
    throw new Error("not needed in test");
  }

  async clearAll(): Promise<void> {}
}

class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  constructor(private readonly purchases: readonly CanonicalPurchaseRecord[]) {}

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.purchases.map((purchase) => ({
      snapshot: {
        ...purchase.snapshot,
        payload: { ...purchase.snapshot.payload }
      },
      status: purchase.status,
      resultStatus: purchase.resultStatus,
      resultVisibility: purchase.resultVisibility,
      purchasedAt: purchase.purchasedAt,
      settledAt: purchase.settledAt,
      externalTicketReference: purchase.externalTicketReference,
      journal: purchase.journal.map((entry) => ({ ...entry }))
    }));
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    return (await this.listPurchases()).find((purchase) => purchase.snapshot.purchaseId === purchaseId) ?? null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    return (await this.listPurchases()).find((purchase) => purchase.snapshot.legacyRequestId === legacyRequestId) ?? null;
  }

  async savePurchase(): Promise<void> {
    throw new Error("not needed in test");
  }

  async clearAll(): Promise<void> {}
}

class InMemoryPurchaseAttemptStore implements PurchaseAttemptStore {
  constructor(private readonly attempts: readonly PurchaseAttemptRecord[]) {}

  async listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.attempts.filter((attempt) => attempt.purchaseId === purchaseId).map((attempt) => ({ ...attempt }));
  }

  async listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.attempts
      .filter((attempt) => attempt.legacyRequestId === legacyRequestId)
      .map((attempt) => ({ ...attempt }));
  }

  async getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null> {
    return this.attempts.find((attempt) => attempt.attemptId === attemptId) ?? null;
  }

  async saveAttempt(): Promise<void> {
    throw new Error("not needed in test");
  }

  async clearAll(): Promise<void> {}
}
