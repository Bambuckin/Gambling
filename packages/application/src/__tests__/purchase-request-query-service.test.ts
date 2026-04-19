import { describe, expect, it } from "vitest";
import type { PurchaseRequestRecord } from "@lottery/domain";
import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import { PurchaseRequestQueryService } from "../services/purchase-request-query-service.js";

describe("PurchaseRequestQueryService", () => {
  it("returns user-scoped request rows with attempt count from queue", async () => {
    const queuedRequest = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        createRequest({
          requestId: "req-401",
          userId: "seed-user",
          createdAt: "2026-04-05T20:00:00.000Z"
        }),
        "confirmed",
        {
          eventId: "req-401:confirmed",
          occurredAt: "2026-04-05T20:01:00.000Z"
        }
      ),
      "queued",
      {
        eventId: "req-401:queued",
        occurredAt: "2026-04-05T20:02:00.000Z"
      }
    );
    const otherUserRequest = createRequest({
      requestId: "req-402",
      userId: "seed-admin",
      createdAt: "2026-04-05T20:03:00.000Z"
    });

    const service = new PurchaseRequestQueryService({
      requestStore: new InMemoryPurchaseRequestStore([queuedRequest, otherUserRequest]),
      queueStore: new InMemoryPurchaseQueueStore([
        {
          requestId: "req-401",
          lotteryCode: "demo-lottery",
          userId: "seed-user",
          drawId: "draw-100",
          attemptCount: 2,
          priority: "regular",
          enqueuedAt: "2026-04-05T20:02:00.000Z",
          status: "queued"
        }
      ])
    });

    const rows = await service.listUserRequests("seed-user");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      requestId: "req-401",
      status: "queued",
      attemptCount: 2,
      finalResult: null
    });
  });

  it("exposes finalResult for terminal states and sorts by updatedAt desc", async () => {
    const completed = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        createRequest({
          requestId: "req-403",
          userId: "seed-user",
          createdAt: "2026-04-05T20:00:00.000Z"
        }),
        "confirmed",
        {
          eventId: "req-403:confirmed",
          occurredAt: "2026-04-05T20:01:00.000Z"
        }
      ),
      "reserve_released",
      {
        eventId: "req-403:reserve_released",
        occurredAt: "2026-04-05T20:04:00.000Z",
        note: "reserve released after cancellation"
      }
    );
    const active = createRequest({
      requestId: "req-404",
      userId: "seed-user",
      createdAt: "2026-04-05T20:02:00.000Z"
    });

    const service = new PurchaseRequestQueryService({
      requestStore: new InMemoryPurchaseRequestStore([active, completed]),
      queueStore: new InMemoryPurchaseQueueStore([])
    });

    const rows = await service.listUserRequests("seed-user");
    expect(rows.map((row) => row.requestId)).toEqual(["req-403", "req-404"]);
    expect(rows[0]?.finalResult).toBe("reserve released after cancellation");
    expect(rows[1]?.finalResult).toBeNull();
  });

  it("derives execution attempt count from persisted request journal after queue item removal", async () => {
    const executed = appendPurchaseRequestTransition(
      appendPurchaseRequestTransition(
        appendPurchaseRequestTransition(
          createRequest({
            requestId: "req-405",
            userId: "seed-user",
            createdAt: "2026-04-05T20:00:00.000Z"
          }),
          "confirmed",
          {
            eventId: "req-405:confirmed",
            occurredAt: "2026-04-05T20:01:00.000Z"
          }
        ),
        "queued",
        {
          eventId: "req-405:queued",
          occurredAt: "2026-04-05T20:02:00.000Z"
        }
      ),
      "executing",
      {
        eventId: "req-405:executing",
        occurredAt: "2026-04-05T20:03:00.000Z"
      }
    );
    const completed = appendPurchaseRequestTransition(executed, "success", {
      eventId: "req-405:success",
      occurredAt: "2026-04-05T20:04:00.000Z",
      note: "ticket purchased"
    });

    const service = new PurchaseRequestQueryService({
      requestStore: new InMemoryPurchaseRequestStore([completed]),
      queueStore: new InMemoryPurchaseQueueStore([])
    });

    const rows = await service.listUserRequests("seed-user");
    expect(rows[0]).toMatchObject({
      requestId: "req-405",
      status: "success",
      attemptCount: 1
    });
  });
});

function createRequest(input: {
  readonly requestId: string;
  readonly userId: string;
  readonly createdAt: string;
}): PurchaseRequestRecord {
  return createAwaitingConfirmationRequest({
    requestId: input.requestId,
    userId: input.userId,
    lotteryCode: "demo-lottery",
    drawId: "draw-100",
    payload: {
      draw_count: 1
    },
    costMinor: 100,
    currency: "RUB",
    createdAt: input.createdAt
  });
}

class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  private records: PurchaseRequestRecord[];

  constructor(records: readonly PurchaseRequestRecord[]) {
    this.records = records.map(cloneRequestRecord);
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

  constructor(items: readonly PurchaseQueueItem[]) {
    this.items = items.map((item) => ({ ...item }));
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
