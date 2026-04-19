import { describe, expect, it } from "vitest";
import type { NotificationRecord, PurchaseRequestRecord, TicketRecord } from "@lottery/domain";
import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { NotificationStore } from "../ports/notification-store.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TerminalExecutionResult } from "../ports/terminal-executor.js";
import { TicketPersistenceService } from "../services/ticket-persistence-service.js";
import {
  TerminalExecutionAttemptService,
  TerminalExecutionAttemptServiceError
} from "../services/terminal-execution-attempt-service.js";

describe("TerminalExecutionAttemptService", () => {
  it("records successful attempt, moves request to success, and removes queue item", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-801")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-801",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-801",
      attempt: 1,
      startedAt: "2026-04-05T22:10:00.000Z",
      result: terminalResult({
        requestId: "req-801",
        nextState: "success",
        rawOutput: "[terminal] success",
        externalTicketReference: "demo-ext-801"
      })
    });

    expect(result.request.state).toBe("success");
    expect(result.queueItem).toBeNull();
    expect(result.ticket).not.toBeNull();
    expect(result.ticket?.requestId).toBe("req-801");
    expect(result.ticket?.externalReference).toBe("demo-ext-801");
    expect(result.journalNote).toContain("outcome=success");
    expect(await queueStore.getQueueItemByRequestId("req-801")).toBeNull();
    expect((await ticketStore.listTickets()).length).toBe(1);
  });

  it("records retrying attempt and re-queues item with queued status", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-802")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-802",
        status: "executing",
        attemptCount: 2
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-802",
      attempt: 2,
      startedAt: "2026-04-05T22:11:00.000Z",
      result: terminalResult({
        requestId: "req-802",
        nextState: "retrying",
        rawOutput: "[terminal] transient failure"
      })
    });

    expect(result.request.state).toBe("retrying");
    expect(result.queueItem).not.toBeNull();
    expect(result.ticket).toBeNull();
    expect(result.queueItem?.status).toBe("queued");
    expect(result.journalNote).toContain("outcome=retrying");
    expect((await ticketStore.listTickets()).length).toBe(0);
  });

  it("records add-to-cart attempt and does not create a purchased ticket", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-802-cart")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-802-cart",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-802-cart",
      attempt: 1,
      startedAt: "2026-04-05T22:11:00.000Z",
      result: terminalResult({
        requestId: "req-802-cart",
        nextState: "added_to_cart",
        rawOutput: "[terminal] added_to_cart"
      })
    });

    expect(result.request.state).toBe("added_to_cart");
    expect(result.queueItem).toBeNull();
    expect(result.ticket).toBeNull();
    expect(result.journalNote).toContain("outcome=added_to_cart");
    expect(await queueStore.getQueueItemByRequestId("req-802-cart")).toBeNull();
    expect((await ticketStore.listTickets()).length).toBe(0);
  });

  it("rejects non-executing request state", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createQueuedRequest("req-803")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-803",
        status: "queued",
        attemptCount: 1
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const action = service.recordAttemptResult({
      requestId: "req-803",
      attempt: 1,
      startedAt: "2026-04-05T22:12:00.000Z",
      result: terminalResult({
        requestId: "req-803",
        nextState: "error",
        rawOutput: "[terminal] hard failure"
      })
    });

    await expect(action).rejects.toBeInstanceOf(TerminalExecutionAttemptServiceError);
    await expect(action).rejects.toMatchObject({
      code: "request_state_invalid"
    });
  });
});

function createQueuedRequest(requestId: string): PurchaseRequestRecord {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-300",
    payload: {
      draw_count: 1
    },
    costMinor: 90,
    currency: "RUB",
    createdAt: "2026-04-05T22:00:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-05T22:01:00.000Z"
  });
  return appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-05T22:02:00.000Z"
  });
}

function createExecutingRequest(requestId: string): PurchaseRequestRecord {
  return appendPurchaseRequestTransition(createQueuedRequest(requestId), "executing", {
    eventId: `${requestId}:executing:1`,
    occurredAt: "2026-04-05T22:03:00.000Z"
  });
}

function queueItem(input: {
  readonly requestId: string;
  readonly status: "queued" | "executing";
  readonly attemptCount: number;
}): PurchaseQueueItem {
  return {
    requestId: input.requestId,
    lotteryCode: "demo-lottery",
    userId: "seed-user",
    drawId: "draw-300",
    priority: "regular",
    enqueuedAt: "2026-04-05T22:02:00.000Z",
    attemptCount: input.attemptCount,
    status: input.status
  };
}

function terminalResult(input: {
  readonly requestId: string;
  readonly nextState: TerminalExecutionResult["nextState"];
  readonly rawOutput: string;
  readonly externalTicketReference?: string | null;
}): TerminalExecutionResult {
  return {
    requestId: input.requestId,
    nextState: input.nextState,
    rawOutput: input.rawOutput,
    externalTicketReference: input.externalTicketReference ?? null,
    finishedAt: "2026-04-05T22:12:30.000Z"
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

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[] = [];

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map((ticket) => ({ ...ticket }));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, { ...ticket }];
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

class StubNotificationStore implements NotificationStore {
  async saveNotification(): Promise<void> {}
  async listUserNotifications(): Promise<readonly NotificationRecord[]> { return []; }
  async getNotificationById(): Promise<NotificationRecord | null> { return null; }
  async markNotificationRead(): Promise<void> {}
  async clearAll(): Promise<void> {}
}
