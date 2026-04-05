import { describe, expect, it } from "vitest";
import type { PurchaseRequestRecord } from "@lottery/domain";
import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { TerminalHealthService } from "../services/terminal-health-service.js";

describe("TerminalHealthService", () => {
  it("returns busy when executing queue item exists", async () => {
    const service = createService({
      requests: [createQueuedRequest("req-901", "2026-04-05T22:00:00.000Z")],
      queueItems: [
        queueItem({
          requestId: "req-901",
          status: "executing",
          enqueuedAt: "2026-04-05T22:01:00.000Z",
          attemptCount: 1
        })
      ]
    });

    const snapshot = await service.getStateSnapshot();
    expect(snapshot.state).toBe("busy");
    expect(snapshot.activeRequestId).toBe("req-901");
  });

  it("returns degraded when latest request ended with one error", async () => {
    const service = createService({
      requests: [
        createErrorRequest("req-902", "2026-04-05T22:10:00.000Z"),
        createSuccessRequest("req-903", "2026-04-05T22:05:00.000Z")
      ],
      queueItems: []
    });

    const snapshot = await service.getStateSnapshot();
    expect(snapshot.state).toBe("degraded");
    expect(snapshot.consecutiveFailures).toBe(1);
    expect(snapshot.lastErrorAt).toBe("2026-04-05T22:10:00.000Z");
  });

  it("returns offline for three consecutive failures", async () => {
    const service = createService({
      requests: [
        createErrorRequest("req-904", "2026-04-05T22:12:00.000Z"),
        createErrorRequest("req-905", "2026-04-05T22:11:00.000Z"),
        createErrorRequest("req-906", "2026-04-05T22:10:00.000Z")
      ],
      queueItems: []
    });

    const snapshot = await service.getStateSnapshot();
    expect(snapshot.state).toBe("offline");
    expect(snapshot.consecutiveFailures).toBe(3);
  });

  it("returns idle when there is no executing queue item and no recent errors", async () => {
    const service = createService({
      requests: [createSuccessRequest("req-907", "2026-04-05T22:15:00.000Z")],
      queueItems: []
    });

    const snapshot = await service.getStateSnapshot();
    expect(snapshot.state).toBe("idle");
    expect(snapshot.consecutiveFailures).toBe(0);
    expect(snapshot.lastErrorAt).toBeNull();
  });
});

function createService(input: {
  readonly requests: readonly PurchaseRequestRecord[];
  readonly queueItems: readonly PurchaseQueueItem[];
}): TerminalHealthService {
  return new TerminalHealthService({
    requestStore: new InMemoryPurchaseRequestStore(input.requests),
    queueStore: new InMemoryPurchaseQueueStore(input.queueItems),
    timeSource: {
      nowIso() {
        return "2026-04-05T22:30:00.000Z";
      }
    } satisfies TimeSource
  });
}

function createQueuedRequest(requestId: string, queuedAt: string): PurchaseRequestRecord {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-400",
    payload: {
      draw_count: 1
    },
    costMinor: 100,
    currency: "RUB",
    createdAt: "2026-04-05T22:00:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-05T22:00:30.000Z"
  });
  return appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: queuedAt
  });
}

function createSuccessRequest(requestId: string, finishedAt: string): PurchaseRequestRecord {
  const executing = appendPurchaseRequestTransition(createQueuedRequest(requestId, "2026-04-05T22:05:00.000Z"), "executing", {
    eventId: `${requestId}:executing:1`,
    occurredAt: "2026-04-05T22:05:30.000Z"
  });
  return appendPurchaseRequestTransition(executing, "success", {
    eventId: `${requestId}:attempt:1:success`,
    occurredAt: finishedAt,
    note: "terminal_attempt outcome=success"
  });
}

function createErrorRequest(requestId: string, finishedAt: string): PurchaseRequestRecord {
  const executing = appendPurchaseRequestTransition(createQueuedRequest(requestId, "2026-04-05T22:05:00.000Z"), "executing", {
    eventId: `${requestId}:executing:1`,
    occurredAt: "2026-04-05T22:05:30.000Z"
  });
  return appendPurchaseRequestTransition(executing, "error", {
    eventId: `${requestId}:attempt:1:error`,
    occurredAt: finishedAt,
    note: "terminal_attempt outcome=error"
  });
}

function queueItem(input: {
  readonly requestId: string;
  readonly status: "queued" | "executing";
  readonly enqueuedAt: string;
  readonly attemptCount: number;
}): PurchaseQueueItem {
  return {
    requestId: input.requestId,
    lotteryCode: "demo-lottery",
    userId: "seed-user",
    drawId: "draw-400",
    priority: "regular",
    enqueuedAt: input.enqueuedAt,
    attemptCount: input.attemptCount,
    status: input.status
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
