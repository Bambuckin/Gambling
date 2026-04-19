import {
  appendCanonicalPurchaseTransition,
  createOpenCanonicalDraw,
  createPurchasedTicketRecord,
  createSubmittedCanonicalPurchase,
  type CanonicalDrawRecord,
  type CanonicalPurchaseRecord,
  type DrawClosureRecord,
  type NotificationRecord,
  type TicketRecord
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { CanonicalDrawStore } from "../ports/canonical-draw-store.js";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { DrawClosureStore } from "../ports/draw-closure-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { DrawClosureService } from "../services/draw-closure-service.js";

describe("DrawClosureService", () => {
  it("creates and closes canonical draw without publishing results", async () => {
    const service = createService();

    const created = await service.createDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-100",
      drawAt: "2026-04-20T10:00:00.000Z"
    });
    const closed = await service.closeDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-100",
      drawAt: "2026-04-20T10:00:00.000Z",
      closedBy: "admin-1"
    });

    expect(created.alreadyExists).toBe(false);
    expect(closed.alreadyClosed).toBe(false);
    expect(closed.draw).toMatchObject({
      status: "closed",
      resultVisibility: "hidden",
      closedBy: "admin-1",
      settledAt: null
    });
  });

  it("marks canonical result and settles draw into published compatibility outcome", async () => {
    const canonicalPurchaseStore = new StubCanonicalPurchaseStore([
      createAwaitingDrawClosePurchase({
        requestId: "req-200",
        drawId: "draw-200"
      })
    ]);
    const ticketStore = new StubTicketStore([
      createPurchasedTicketRecord({
        ticketId: "ticket-200",
        requestId: "req-200",
        userId: "seed-user",
        lotteryCode: "bolshaya-8",
        drawId: "draw-200",
        purchasedAt: "2026-04-18T10:00:00.000Z",
        externalReference: "ext-200"
      })
    ]);
    const notificationStore = new StubNotificationStore();
    const service = createService({
      canonicalPurchaseStore,
      ticketStore,
      notificationStore
    });

    await service.createDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-200",
      drawAt: "2026-04-20T10:00:00.000Z"
    });
    await service.closeDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-200",
      drawAt: "2026-04-20T10:00:00.000Z",
      closedBy: "admin-1"
    });
    await service.markTicketResult({
      requestId: "req-200",
      mark: "win",
      markedBy: "admin-1"
    });

    const settled = await service.settleDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-200",
      settledBy: "admin-1"
    });

    expect(settled.alreadySettled).toBe(false);
    expect(settled.draw).toMatchObject({
      status: "settled",
      resultVisibility: "visible",
      settledBy: "admin-1"
    });
    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-200")).resolves.toMatchObject({
      status: "settled",
      resultStatus: "win",
      resultVisibility: "visible"
    });
    await expect(ticketStore.getTicketByRequestId("req-200")).resolves.toMatchObject({
      verificationStatus: "verified",
      winningAmountMinor: 50_000,
      resultSource: "admin_emulated",
      adminResultMark: "win"
    });
    expect(settled.notifications).toHaveLength(2);
    expect((await notificationStore.listUserNotifications("seed-user")).length).toBe(2);
  });

  it("rejects settlement while canonical purchases are still unmarked", async () => {
    const service = createService({
      canonicalPurchaseStore: new StubCanonicalPurchaseStore([
        createAwaitingDrawClosePurchase({
          requestId: "req-300",
          drawId: "draw-300"
        })
      ])
    });

    await service.createDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-300",
      drawAt: "2026-04-20T10:00:00.000Z"
    });
    await service.closeDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-300",
      drawAt: "2026-04-20T10:00:00.000Z",
      closedBy: "admin-1"
    });

    await expect(
      service.settleDraw({
        lotteryCode: "bolshaya-8",
        drawId: "draw-300",
        settledBy: "admin-1"
      })
    ).rejects.toThrow(/must be marked win\/lose before settlement/i);
  });
});

function createService(input?: {
  readonly canonicalDrawStore?: CanonicalDrawStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly ticketStore?: TicketStore;
  readonly drawClosureStore?: DrawClosureStore;
  readonly notificationStore?: NotificationStore;
}): DrawClosureService {
  return new DrawClosureService({
    ticketStore: input?.ticketStore ?? new StubTicketStore(),
    canonicalDrawStore: input?.canonicalDrawStore ?? new StubCanonicalDrawStore(),
    canonicalPurchaseStore: input?.canonicalPurchaseStore ?? new StubCanonicalPurchaseStore(),
    drawClosureStore: input?.drawClosureStore ?? new StubDrawClosureStore(),
    notificationStore: input?.notificationStore ?? new StubNotificationStore(),
    timeSource: new StubTimeSource()
  });
}

function createAwaitingDrawClosePurchase(input: {
  readonly requestId: string;
  readonly drawId: string;
}): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        appendCanonicalPurchaseTransition(
          createSubmittedCanonicalPurchase({
            purchaseId: input.requestId,
            legacyRequestId: input.requestId,
            userId: "seed-user",
            lotteryCode: "bolshaya-8",
            drawId: input.drawId,
            payload: { draw_count: 1 },
            costMinor: 10_000,
            currency: "RUB",
            submittedAt: "2026-04-18T09:55:00.000Z"
          }),
          "queued",
          {
            eventId: `${input.requestId}:queued`,
            occurredAt: "2026-04-18T09:56:00.000Z"
          }
        ),
        "processing",
        {
          eventId: `${input.requestId}:processing`,
          occurredAt: "2026-04-18T09:57:00.000Z"
        }
      ),
      "purchased",
      {
        eventId: `${input.requestId}:purchased`,
        occurredAt: "2026-04-18T09:58:00.000Z",
        externalTicketReference: `ext-${input.requestId}`
      }
    ),
    "awaiting_draw_close",
    {
      eventId: `${input.requestId}:awaiting_draw_close`,
      occurredAt: "2026-04-18T10:00:00.000Z"
    }
  );
}

class StubTimeSource implements TimeSource {
  nowIso(): string {
    return "2026-04-20T12:00:00.000Z";
  }
}

class StubTicketStore implements TicketStore {
  private tickets: TicketRecord[];

  constructor(initialTickets: readonly TicketRecord[] = []) {
    this.tickets = initialTickets.map((ticket) => ({ ...ticket }));
  }

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

class StubCanonicalDrawStore implements CanonicalDrawStore {
  private draws: CanonicalDrawRecord[];

  constructor(initialDraws: readonly CanonicalDrawRecord[] = []) {
    this.draws = initialDraws.map((draw) => ({ ...draw }));
  }

  async listDraws(lotteryCode?: string): Promise<readonly CanonicalDrawRecord[]> {
    return this.draws
      .filter((draw) => !lotteryCode || draw.lotteryCode === lotteryCode)
      .map((draw) => ({ ...draw }));
  }

  async getDraw(lotteryCode: string, drawId: string): Promise<CanonicalDrawRecord | null> {
    const draw = this.draws.find((entry) => entry.lotteryCode === lotteryCode && entry.drawId === drawId) ?? null;
    return draw ? { ...draw } : null;
  }

  async saveDraw(record: CanonicalDrawRecord): Promise<void> {
    const filtered = this.draws.filter(
      (entry) => !(entry.lotteryCode === record.lotteryCode && entry.drawId === record.drawId)
    );
    this.draws = [...filtered, { ...record }];
  }

  async deleteDraw(lotteryCode: string, drawId: string): Promise<void> {
    this.draws = this.draws.filter((entry) => !(entry.lotteryCode === lotteryCode && entry.drawId === drawId));
  }

  async clearAll(): Promise<void> {
    this.draws = [];
  }
}

class StubCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private purchases: CanonicalPurchaseRecord[];

  constructor(initialPurchases: readonly CanonicalPurchaseRecord[] = []) {
    this.purchases = initialPurchases.map(cloneCanonicalPurchaseRecord);
  }

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.purchases.map(cloneCanonicalPurchaseRecord);
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const purchase = this.purchases.find((entry) => entry.snapshot.purchaseId === purchaseId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const purchase = this.purchases.find((entry) => entry.snapshot.legacyRequestId === legacyRequestId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    const filtered = this.purchases.filter((entry) => entry.snapshot.purchaseId !== record.snapshot.purchaseId);
    this.purchases = [...filtered, cloneCanonicalPurchaseRecord(record)];
  }

  async clearAll(): Promise<void> {
    this.purchases = [];
  }
}

class StubDrawClosureStore implements DrawClosureStore {
  private closures: DrawClosureRecord[] = [];

  async getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    const closure = this.closures.find((entry) => entry.lotteryCode === lotteryCode && entry.drawId === drawId) ?? null;
    return closure ? { ...closure } : null;
  }

  async saveClosure(record: DrawClosureRecord): Promise<void> {
    const filtered = this.closures.filter(
      (entry) => !(entry.lotteryCode === record.lotteryCode && entry.drawId === record.drawId)
    );
    this.closures = [...filtered, { ...record }];
  }

  async listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    return this.closures
      .filter((closure) => !lotteryCode || closure.lotteryCode === lotteryCode)
      .map((closure) => ({ ...closure }));
  }

  async deleteClosure(lotteryCode: string, drawId: string): Promise<void> {
    this.closures = this.closures.filter((entry) => !(entry.lotteryCode === lotteryCode && entry.drawId === drawId));
  }

  async clearAll(): Promise<void> {
    this.closures = [];
  }
}

class StubNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[] = [];

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
      this.notifications[index] = {
        ...this.notifications[index]!,
        read: true
      };
    }
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
  }
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
