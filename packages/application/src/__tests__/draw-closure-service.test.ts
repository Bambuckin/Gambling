import { createPurchasedTicketRecord, type DrawClosureRecord, type NotificationRecord, type TicketRecord } from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { DrawClosureStore } from "../ports/draw-closure-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { DrawClosureService } from "../services/draw-closure-service.js";

describe("DrawClosureService", () => {
  it("creates an explicit losing notification when the draw closes", async () => {
    const ticketStore = new StubTicketStore([
      createPurchasedTicketRecord({
        ticketId: "ticket-lose",
        requestId: "req-lose",
        userId: "seed-user",
        lotteryCode: "bolshaya-8",
        drawId: "draw-lose",
        purchasedAt: "2026-04-18T10:00:00.000Z",
        externalReference: "ext-lose"
      })
    ]);
    const notificationStore = new StubNotificationStore();
    const service = new DrawClosureService({
      ticketStore,
      drawClosureStore: new StubDrawClosureStore(),
      notificationStore,
      timeSource: new StubTimeSource()
    });

    const result = await service.closeDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-lose",
      closedBy: "admin-1"
    });

    expect(result.alreadyClosed).toBe(false);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      type: "draw_closed_result_ready",
      title: "Тираж закрыт: билет не выиграл",
      body: "Тираж draw-lose закрыт. Билет ticket-lose не выиграл."
    });
  });

  it("creates explicit win notification and winning actions notification for winners", async () => {
    const ticketStore = new StubTicketStore([
      {
        ...createPurchasedTicketRecord({
          ticketId: "ticket-win",
          requestId: "req-win",
          userId: "seed-user",
          lotteryCode: "bolshaya-8",
          drawId: "draw-win",
          purchasedAt: "2026-04-18T10:00:00.000Z",
          externalReference: "ext-win"
        }),
        adminResultMark: "win"
      }
    ]);
    const notificationStore = new StubNotificationStore();
    const service = new DrawClosureService({
      ticketStore,
      drawClosureStore: new StubDrawClosureStore(),
      notificationStore,
      timeSource: new StubTimeSource()
    });

    const result = await service.closeDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-win",
      closedBy: "admin-1"
    });

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0]).toMatchObject({
      type: "draw_closed_result_ready",
      title: "Тираж закрыт: билет выиграл",
      body: "Тираж draw-win закрыт. Билет ticket-win выиграл 500.00 RUB."
    });
    expect(result.notifications[1]).toMatchObject({
      type: "winning_actions_available",
      title: "Выигрыш доступен",
      body: "Ваш билет выиграл. Сумма: 500.00 RUB. Выберите способ получения."
    });
  });
});

class StubTimeSource implements TimeSource {
  nowIso(): string {
    return "2026-04-18T12:00:00.000Z";
  }
}

class StubTicketStore implements TicketStore {
  private readonly tickets = new Map<string, TicketRecord>();

  constructor(initialTickets: readonly TicketRecord[]) {
    for (const ticket of initialTickets) {
      this.tickets.set(ticket.ticketId, { ...ticket });
    }
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return [...this.tickets.values()].map((ticket) => ({ ...ticket }));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.get(ticketId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = [...this.tickets.values()].find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    this.tickets.set(ticket.ticketId, { ...ticket });
  }

  async clearAll(): Promise<void> {}
}

class StubDrawClosureStore implements DrawClosureStore {
  private readonly closures = new Map<string, DrawClosureRecord>();

  async getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    const closure = this.closures.get(`${lotteryCode}:${drawId}`) ?? null;
    return closure ? { ...closure } : null;
  }

  async saveClosure(record: DrawClosureRecord): Promise<void> {
    this.closures.set(`${record.lotteryCode}:${record.drawId}`, { ...record });
  }

  async listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    const closures = [...this.closures.values()].map((record) => ({ ...record }));
    return lotteryCode ? closures.filter((record) => record.lotteryCode === lotteryCode) : closures;
  }

  async deleteClosure(lotteryCode: string, drawId: string): Promise<void> {
    this.closures.delete(`${lotteryCode}:${drawId}`);
  }

  async clearAll(): Promise<void> {}
}

class StubNotificationStore implements NotificationStore {
  private readonly notifications: NotificationRecord[] = [];

  async saveNotification(notification: NotificationRecord): Promise<void> {
    this.notifications.push({ ...notification });
  }

  async listUserNotifications(userId: string): Promise<readonly NotificationRecord[]> {
    return this.notifications.filter((notification) => notification.userId === userId).map((notification) => ({ ...notification }));
  }

  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    const notification = this.notifications.find((entry) => entry.notificationId === notificationId) ?? null;
    return notification ? { ...notification } : null;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const index = this.notifications.findIndex((entry) => entry.notificationId === notificationId);
    if (index >= 0) {
      const current = this.notifications[index];
      if (!current) {
        return;
      }

      this.notifications[index] = {
        ...current,
        read: true
      };
    }
  }

  async clearAll(): Promise<void> {
    this.notifications.length = 0;
  }
}
