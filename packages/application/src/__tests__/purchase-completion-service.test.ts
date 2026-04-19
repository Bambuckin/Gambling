import { appendPurchaseRequestTransition, createAwaitingConfirmationRequest, type NotificationRecord } from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { NotificationStore } from "../ports/notification-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { PurchaseCompletionService } from "../services/purchase-completion-service.js";
import { TicketPersistenceService } from "../services/ticket-persistence-service.js";

describe("PurchaseCompletionService", () => {
  it("completes added_to_cart request with emulate_after_cart mode", async () => {
    const ticketStore = new StubTicketStore();
    const requestStore = new StubPurchaseRequestStore();
    const service = createService(ticketStore, requestStore);
    const request = createAddedToCartRequest("req-800");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: "cart-ref-800"
    });

    expect(result.completed).toBe(true);
    expect(result.request.state).toBe("success");
    expect(result.ticket).not.toBeNull();
    expect(result.ticket!.requestId).toBe("req-800");
    expect(result.ticket!.externalReference).toBe("cart-ref-800");
    expect(await requestStore.getRequestById("req-800")).toMatchObject({
      state: "success"
    });
  });

  it("skips when completion mode is direct", async () => {
    const ticketStore = new StubTicketStore();
    const service = createService(ticketStore);
    const request = createAddedToCartRequest("req-801");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "direct",
      cartExternalReference: null
    });

    expect(result.completed).toBe(false);
    expect(result.request.state).toBe("added_to_cart");
    expect(result.ticket).toBeNull();
  });

  it("skips when request is not in added_to_cart state", async () => {
    const ticketStore = new StubTicketStore();
    const service = createService(ticketStore);
    const request = createExecutingRequest("req-802");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: null
    });

    expect(result.completed).toBe(false);
    expect(result.request.state).toBe("executing");
  });

  it("preserves provided cart external reference", async () => {
    const ticketStore = new StubTicketStore();
    const service = createService(ticketStore);
    const request = createAddedToCartRequest("req-803");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: "original-cart-ref"
    });

    expect(result.completed).toBe(true);
    expect(result.ticket!.externalReference).toBe("original-cart-ref");
  });
});

function createService(
  ticketStore: StubTicketStore,
  requestStore: PurchaseRequestStore = new StubPurchaseRequestStore()
): PurchaseCompletionService {
  return new PurchaseCompletionService({
    requestStore,
    ticketPersistenceService: new TicketPersistenceService({
      ticketStore,
      notificationStore: new StubNotificationStore()
    }),
    timeSource: new StubTimeSource()
  });
}

class StubNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[] = [];

  async saveNotification(notification: NotificationRecord): Promise<void> {
    this.notifications.push({ ...notification });
  }

  async listUserNotifications(): Promise<readonly NotificationRecord[]> {
    return this.notifications;
  }

  async getNotificationById(): Promise<NotificationRecord | null> {
    return null;
  }

  async markNotificationRead(): Promise<void> {}
  async clearAll(): Promise<void> {}
}

class StubTimeSource implements TimeSource {
  nowIso(): string {
    return "2026-04-16T12:00:00.000Z";
  }
}

class StubTicketStore implements TicketStore {
  private tickets: Map<string, import("@lottery/domain").TicketRecord> = new Map();

  async listTickets() {
    return [...this.tickets.values()];
  }

  async getTicketById(ticketId: string) {
    return this.tickets.get(ticketId) ?? null;
  }

  async getTicketByRequestId(requestId: string) {
    for (const ticket of this.tickets.values()) {
      if (ticket.requestId === requestId) return ticket;
    }
    return null;
  }

  async saveTicket(ticket: import("@lottery/domain").TicketRecord) {
    this.tickets.set(ticket.ticketId, { ...ticket });
  }

  async clearAll(): Promise<void> {}
}

class StubPurchaseRequestStore implements PurchaseRequestStore {
  private requests: Map<string, import("@lottery/domain").PurchaseRequestRecord> = new Map();

  async listRequests() {
    return [...this.requests.values()].map(cloneRequestRecord);
  }

  async getRequestById(requestId: string) {
    const request = this.requests.get(requestId) ?? null;
    return request ? cloneRequestRecord(request) : null;
  }

  async saveRequest(record: import("@lottery/domain").PurchaseRequestRecord) {
    this.requests.set(record.snapshot.requestId, cloneRequestRecord(record));
  }

  async clearAll(): Promise<void> {}
}

function createAddedToCartRequest(requestId: string) {
  const executing = createExecutingRequest(requestId);
  return appendPurchaseRequestTransition(executing, "added_to_cart", {
    eventId: `${requestId}:added_to_cart`,
    occurredAt: "2026-04-16T11:59:00.000Z",
    note: "terminal_attempt attempt=1 outcome=added_to_cart"
  });
}

function createExecutingRequest(requestId: string) {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "bolshaya-8",
    drawId: "draw-800",
    payload: { draw_count: 1 },
    costMinor: 25_000,
    currency: "RUB",
    createdAt: "2026-04-16T11:55:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-16T11:55:30.000Z"
  });
  const queued = appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-16T11:56:00.000Z"
  });
  return appendPurchaseRequestTransition(queued, "executing", {
    eventId: `${requestId}:executing`,
    occurredAt: "2026-04-16T11:57:00.000Z"
  });
}

function cloneRequestRecord(record: import("@lottery/domain").PurchaseRequestRecord) {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}
