import { appendPurchaseRequestTransition, createAwaitingConfirmationRequest, type NotificationRecord, type TicketRecord } from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { NotificationStore } from "../ports/notification-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import {
  TicketPersistenceService,
  TicketPersistenceServiceError
} from "../services/ticket-persistence-service.js";

describe("TicketPersistenceService", () => {
  it("persists a ticket for successful request", async () => {
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new InMemoryNotificationStore();
    const service = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });

    const result = await service.persistSuccessfulPurchaseTicket({
      request: createSuccessRequest("req-950"),
      purchasedAt: "2026-04-05T23:30:00.000Z",
      externalReference: "demo-ext-950"
    });

    expect(result.replayed).toBe(false);
    expect(result.ticket.requestId).toBe("req-950");
    expect(result.ticket.drawId).toBe("draw-950");
    expect(result.ticket.userId).toBe("seed-user");
    expect(result.ticket.externalReference).toBe("demo-ext-950");
    expect(result.ticket.verificationStatus).toBe("pending");
  });

  it("returns replayed when ticket for request already exists", async () => {
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new InMemoryNotificationStore();
    const service = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });

    const first = await service.persistSuccessfulPurchaseTicket({
      request: createSuccessRequest("req-951"),
      purchasedAt: "2026-04-05T23:31:00.000Z",
      externalReference: "demo-ext-951"
    });
    const replay = await service.persistSuccessfulPurchaseTicket({
      request: createSuccessRequest("req-951"),
      purchasedAt: "2026-04-05T23:31:10.000Z",
      externalReference: "demo-ext-951-changed"
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.ticket.externalReference).toBe("demo-ext-951");
    expect((await ticketStore.listTickets()).length).toBe(1);
  });

  it("can publish purchase success without writing a legacy ticket row", async () => {
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new InMemoryNotificationStore();
    const service = new TicketPersistenceService({
      ticketStore,
      notificationStore,
      persistLegacyTicket: false
    });

    const result = await service.persistSuccessfulPurchaseTicket({
      request: createSuccessRequest("req-953"),
      purchasedAt: "2026-04-05T23:33:00.000Z",
      ticketId: "canonical:purchase-953",
      externalReference: "demo-ext-953"
    });

    expect(result.replayed).toBe(false);
    expect(result.ticket.ticketId).toBe("canonical:purchase-953");
    expect((await ticketStore.listTickets()).length).toBe(0);
    await expect(notificationStore.getNotificationById("canonical:purchase-953:purchase_success")).resolves.toMatchObject({
      referenceTicketId: "canonical:purchase-953"
    });
  });

  it("rejects non-success request state", async () => {
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new InMemoryNotificationStore();
    const service = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });

    const action = service.persistSuccessfulPurchaseTicket({
      request: createQueuedRequest("req-952"),
      purchasedAt: "2026-04-05T23:32:00.000Z"
    });

    await expect(action).rejects.toBeInstanceOf(TicketPersistenceServiceError);
    await expect(action).rejects.toMatchObject({
      code: "request_state_invalid"
    });
  });
});

function createQueuedRequest(requestId: string) {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: `draw-${requestId.split("-").at(-1)}`,
    payload: {
      draw_count: 1
    },
    costMinor: 90,
    currency: "RUB",
    createdAt: "2026-04-05T23:20:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-05T23:20:30.000Z"
  });
  return appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-05T23:21:00.000Z"
  });
}

function createSuccessRequest(requestId: string) {
  const queued = createQueuedRequest(requestId);
  const executing = appendPurchaseRequestTransition(queued, "executing", {
    eventId: `${requestId}:executing`,
    occurredAt: "2026-04-05T23:22:00.000Z"
  });
  return appendPurchaseRequestTransition(executing, "success", {
    eventId: `${requestId}:success`,
    occurredAt: "2026-04-05T23:23:00.000Z"
  });
}

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[] = [];

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map((ticket) => cloneTicket(ticket));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, cloneTicket(ticket)];
  }

  async clearAll(): Promise<void> {}
}

function cloneTicket(ticket: TicketRecord): TicketRecord {
  return {
    ...ticket
  };
}

class InMemoryNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[] = [];

  async saveNotification(notification: NotificationRecord): Promise<void> {
    const filtered = this.notifications.filter((n) => n.notificationId !== notification.notificationId);
    this.notifications = [...filtered, { ...notification }];
  }

  async listUserNotifications(userId: string): Promise<readonly NotificationRecord[]> {
    return this.notifications.filter((n) => n.userId === userId);
  }

  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    return this.notifications.find((n) => n.notificationId === notificationId) ?? null;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    this.notifications = this.notifications.map((n) =>
      n.notificationId === notificationId ? { ...n, read: true } : n
    );
  }

  async clearAll(): Promise<void> {}
}
