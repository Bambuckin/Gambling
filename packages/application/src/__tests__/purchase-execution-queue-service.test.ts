import { describe, expect, it } from "vitest";
import type { PurchaseRequestRecord } from "@lottery/domain";
import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TerminalExecutionLock } from "../ports/terminal-execution-lock.js";
import type { TimeSource } from "../ports/time-source.js";
import { PurchaseExecutionQueueService } from "../services/purchase-execution-queue-service.js";

describe("PurchaseExecutionQueueService", () => {
  it("reserves admin-priority queued item first and transitions request to executing", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createQueuedRequest("req-regular", "seed-user"),
      createQueuedRequest("req-priority", "seed-admin")
    ]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-regular",
        userId: "seed-user",
        priority: "regular",
        enqueuedAt: "2026-04-05T21:00:00.000Z"
      }),
      queueItem({
        requestId: "req-priority",
        userId: "seed-admin",
        priority: "admin-priority",
        enqueuedAt: "2026-04-05T21:01:00.000Z"
      })
    ]);
    const lock = new InMemoryTerminalExecutionLock();
    const service = createService({
      requestStore,
      queueStore,
      lock
    });

    const reserved = await service.reserveNextQueuedRequest({
      workerId: "terminal-worker"
    });

    expect(reserved).not.toBeNull();
    expect(reserved?.queueItem.requestId).toBe("req-priority");
    expect(reserved?.queueItem.status).toBe("executing");
    expect(reserved?.queueItem.attemptCount).toBe(1);
    expect(reserved?.request.state).toBe("executing");
    expect(lock.currentOwner()).toBe("terminal-worker");
  });

  it("returns null when lock is held by another worker", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createQueuedRequest("req-501", "seed-user")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-501",
        userId: "seed-user",
        priority: "regular",
        enqueuedAt: "2026-04-05T21:10:00.000Z"
      })
    ]);
    const lock = new InMemoryTerminalExecutionLock();
    await lock.acquire("another-worker");

    const service = createService({
      requestStore,
      queueStore,
      lock
    });

    const reserved = await service.reserveNextQueuedRequest({
      workerId: "terminal-worker"
    });

    expect(reserved).toBeNull();
    expect(lock.currentOwner()).toBe("another-worker");
  });

  it("releases lock when queue has no reservable items", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([]);
    const queueStore = new InMemoryPurchaseQueueStore([]);
    const lock = new InMemoryTerminalExecutionLock();
    const service = createService({
      requestStore,
      queueStore,
      lock
    });

    const reserved = await service.reserveNextQueuedRequest({
      workerId: "terminal-worker"
    });

    expect(reserved).toBeNull();
    expect(lock.currentOwner()).toBeNull();
  });

  it("does not reserve another request while one queue item is already executing", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([
      createExecutingRequest("req-executing", "seed-user"),
      createQueuedRequest("req-queued", "seed-user")
    ]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-executing",
        userId: "seed-user",
        priority: "regular",
        enqueuedAt: "2026-04-05T21:00:00.000Z",
        status: "executing",
        attemptCount: 1
      }),
      queueItem({
        requestId: "req-queued",
        userId: "seed-user",
        priority: "admin-priority",
        enqueuedAt: "2026-04-05T21:02:00.000Z"
      })
    ]);
    const lock = new InMemoryTerminalExecutionLock();
    const service = createService({
      requestStore,
      queueStore,
      lock
    });

    const reserved = await service.reserveNextQueuedRequest({
      workerId: "terminal-worker"
    });

    expect(reserved).toBeNull();
    expect(lock.currentOwner()).toBeNull();
  });
});

function createService(input: {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly lock: TerminalExecutionLock;
}): PurchaseExecutionQueueService {
  return new PurchaseExecutionQueueService({
    requestStore: input.requestStore,
    queueStore: input.queueStore,
    executionLock: input.lock,
    timeSource: {
      nowIso() {
        return "2026-04-05T21:30:00.000Z";
      }
    } satisfies TimeSource
  });
}

function createQueuedRequest(requestId: string, userId: string): PurchaseRequestRecord {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId,
    lotteryCode: "demo-lottery",
    drawId: "draw-200",
    payload: {
      draw_count: 1
    },
    costMinor: 120,
    currency: "RUB",
    createdAt: "2026-04-05T21:00:00.000Z"
  });

  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-05T21:01:00.000Z"
  });

  return appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-05T21:02:00.000Z"
  });
}

function createExecutingRequest(requestId: string, userId: string): PurchaseRequestRecord {
  return appendPurchaseRequestTransition(createQueuedRequest(requestId, userId), "executing", {
    eventId: `${requestId}:executing:1`,
    occurredAt: "2026-04-05T21:05:00.000Z"
  });
}

function queueItem(input: {
  readonly requestId: string;
  readonly userId: string;
  readonly priority: "regular" | "admin-priority";
  readonly enqueuedAt: string;
  readonly attemptCount?: number;
  readonly status?: "queued" | "executing";
}): PurchaseQueueItem {
  return {
    requestId: input.requestId,
    lotteryCode: "demo-lottery",
    userId: input.userId,
    drawId: "draw-200",
    attemptCount: input.attemptCount ?? 0,
    priority: input.priority,
    enqueuedAt: input.enqueuedAt,
    status: input.status ?? "queued"
  };
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

class InMemoryTerminalExecutionLock implements TerminalExecutionLock {
  private ownerId: string | null = null;

  async acquire(ownerId: string): Promise<boolean> {
    const normalized = ownerId.trim();
    if (!normalized) {
      return false;
    }

    if (this.ownerId === null) {
      this.ownerId = normalized;
      return true;
    }

    return this.ownerId === normalized;
  }

  async release(ownerId: string): Promise<void> {
    const normalized = ownerId.trim();
    if (this.ownerId === normalized) {
      this.ownerId = null;
    }
  }

  async clearAll(): Promise<void> {
    this.ownerId = null;
  }

  currentOwner(): string | null {
    return this.ownerId;
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
