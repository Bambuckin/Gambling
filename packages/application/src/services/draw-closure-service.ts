import {
  ADMIN_EMULATED_WIN_AMOUNT_MINOR,
  appendCanonicalPurchaseTransition,
  applyCanonicalPurchaseResult,
  closeCanonicalDraw,
  closeDrawClosure,
  createNotification,
  createOpenCanonicalDraw,
  createOpenDrawClosure,
  resolveTicketFromAdminMark,
  settleCanonicalDraw,
  setCanonicalPurchaseResultVisibility,
  setTicketAdminResultMark,
  type CanonicalDrawRecord,
  type CanonicalPurchaseRecord,
  type NotificationRecord,
  type NotificationType,
  type PurchaseResultStatus,
  type TicketAdminResultMark,
  type TicketRecord
} from "@lottery/domain";
import type { CanonicalDrawStore } from "../ports/canonical-draw-store.js";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { DrawClosureStore } from "../ports/draw-closure-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { markCanonicalPurchaseAwaitingDrawClose } from "./canonical-purchase-state.js";

export interface DrawClosureServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly canonicalDrawStore: CanonicalDrawStore;
  readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  readonly drawClosureStore: DrawClosureStore;
  readonly notificationStore: NotificationStore;
  readonly timeSource: TimeSource;
}

export interface CreateDrawInput {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
}

export interface CreateDrawResult {
  readonly alreadyExists: boolean;
  readonly draw: CanonicalDrawRecord;
}

export interface MarkTicketResultInput {
  readonly requestId: string;
  readonly mark: TicketAdminResultMark;
  readonly markedBy: string;
}

export interface MarkTicketResultResult {
  readonly purchase: CanonicalPurchaseRecord;
}

export interface CloseDrawInput {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly closedBy: string;
}

export interface CloseDrawResult {
  readonly alreadyClosed: boolean;
  readonly draw: CanonicalDrawRecord;
}

export interface SettleDrawInput {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly settledBy: string;
}

export interface SettleDrawResult {
  readonly alreadySettled: boolean;
  readonly draw: CanonicalDrawRecord;
  readonly publishedPurchases: readonly CanonicalPurchaseRecord[];
  readonly resolvedTickets: readonly TicketRecord[];
  readonly notifications: readonly NotificationRecord[];
}

export class DrawClosureService {
  private readonly ticketStore: TicketStore;
  private readonly canonicalDrawStore: CanonicalDrawStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  private readonly drawClosureStore: DrawClosureStore;
  private readonly notificationStore: NotificationStore;
  private readonly timeSource: TimeSource;

  constructor(dependencies: DrawClosureServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.canonicalDrawStore = dependencies.canonicalDrawStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore;
    this.drawClosureStore = dependencies.drawClosureStore;
    this.notificationStore = dependencies.notificationStore;
    this.timeSource = dependencies.timeSource;
  }

  async createDraw(input: CreateDrawInput): Promise<CreateDrawResult> {
    const draw = await this.canonicalDrawStore.getDraw(input.lotteryCode, input.drawId);
    if (draw) {
      return {
        alreadyExists: true,
        draw
      };
    }

    const created = createOpenCanonicalDraw({
      lotteryCode: input.lotteryCode,
      drawId: input.drawId,
      drawAt: input.drawAt,
      openedAt: this.timeSource.nowIso()
    });
    await this.canonicalDrawStore.saveDraw(created);

    return {
      alreadyExists: false,
      draw: created
    };
  }

  async markTicketResult(input: MarkTicketResultInput): Promise<MarkTicketResultResult> {
    const requestId = requireNonEmpty(input.requestId, "requestId");
    const mark = input.mark;
    const purchase = await this.canonicalPurchaseStore.getPurchaseByLegacyRequestId(requestId);
    if (!purchase) {
      throw new Error(`canonical purchase for request "${requestId}" not found`);
    }

    const draw = await this.canonicalDrawStore.getDraw(purchase.snapshot.lotteryCode, purchase.snapshot.drawId);
    if (!draw) {
      throw new Error(`draw "${purchase.snapshot.drawId}" for "${purchase.snapshot.lotteryCode}" is not created`);
    }

    if (draw.status === "open") {
      throw new Error(`draw "${draw.drawId}" must be closed before results can be marked`);
    }

    if (draw.status === "settled") {
      const expectedStatus = mapMarkToResultStatus(mark);
      if (purchase.resultStatus === expectedStatus) {
        return {
          purchase
        };
      }

      throw new Error(`draw "${draw.drawId}" is already settled`);
    }

    const nowIso = this.timeSource.nowIso();
    const markablePurchase =
      purchase.status === "purchased"
        ? markCanonicalPurchaseAwaitingDrawClose(purchase, {
            eventId: `${purchase.snapshot.purchaseId}:awaiting_draw_close:repair`,
            occurredAt: nowIso,
            note: "draw result marking repaired awaiting_draw_close state"
          })
        : purchase;

    if (markablePurchase !== purchase) {
      await this.canonicalPurchaseStore.savePurchase(markablePurchase);
    }

    if (markablePurchase.status !== "awaiting_draw_close" && markablePurchase.status !== "settled") {
      throw new Error(
        `purchase "${markablePurchase.snapshot.purchaseId}" cannot be marked from lifecycle "${markablePurchase.status}"`
      );
    }

    const resultStatus = mapMarkToResultStatus(mark);
    const nextPurchase = applyCanonicalPurchaseResult(markablePurchase, {
      eventId: `${markablePurchase.snapshot.purchaseId}:result:${resultStatus}`,
      occurredAt: nowIso,
      resultStatus,
      note: `draw result marked by ${requireNonEmpty(input.markedBy, "markedBy")}`
    });

    if (!sameCanonicalPurchase(nextPurchase, markablePurchase)) {
      await this.canonicalPurchaseStore.savePurchase(nextPurchase);
    }

    return {
      purchase: nextPurchase
    };
  }

  async closeDraw(input: CloseDrawInput): Promise<CloseDrawResult> {
    const draw = await this.ensureDrawExists({
      lotteryCode: input.lotteryCode,
      drawId: input.drawId,
      drawAt: input.drawAt
    });
    if (draw.status !== "open") {
      return {
        alreadyClosed: true,
        draw
      };
    }

    const nowIso = this.timeSource.nowIso();
    const closed = closeCanonicalDraw(draw, {
      closedAt: nowIso,
      closedBy: requireNonEmpty(input.closedBy, "closedBy")
    });
    await this.canonicalDrawStore.saveDraw(closed);
    await this.drawClosureStore.saveClosure(
      closeDrawClosure(createOpenDrawClosure(input.lotteryCode, input.drawId), input.closedBy, nowIso)
    );

    return {
      alreadyClosed: false,
      draw: closed
    };
  }

  async settleDraw(input: SettleDrawInput): Promise<SettleDrawResult> {
    const draw = await this.canonicalDrawStore.getDraw(input.lotteryCode, input.drawId);
    if (!draw) {
      throw new Error(`draw "${input.drawId}" for "${input.lotteryCode}" not found`);
    }

    if (draw.status === "open") {
      throw new Error(`draw "${draw.drawId}" must be closed before settlement`);
    }

    if (draw.status === "settled") {
      return {
        alreadySettled: true,
        draw,
        publishedPurchases: [],
        resolvedTickets: [],
        notifications: []
      };
    }

    const nowIso = this.timeSource.nowIso();
    const purchases = (await this.canonicalPurchaseStore.listPurchases())
      .filter((purchase) => purchase.snapshot.lotteryCode === draw.lotteryCode && purchase.snapshot.drawId === draw.drawId)
      .filter((purchase) => purchase.status === "purchased" || purchase.status === "awaiting_draw_close" || purchase.status === "settled");

    const normalizedPurchases = await Promise.all(
      purchases.map(async (purchase) => {
        if (purchase.status !== "purchased") {
          return purchase;
        }

        const repaired = markCanonicalPurchaseAwaitingDrawClose(purchase, {
          eventId: `${purchase.snapshot.purchaseId}:awaiting_draw_close:settlement-repair`,
          occurredAt: nowIso,
          note: "settlement repaired awaiting_draw_close state"
        });
        await this.canonicalPurchaseStore.savePurchase(repaired);
        return repaired;
      })
    );

    const unresolvedPurchase = normalizedPurchases.find(
      (purchase) => purchase.status === "awaiting_draw_close" && purchase.resultStatus === "pending"
    );
    if (unresolvedPurchase) {
      throw new Error(
        `purchase "${unresolvedPurchase.snapshot.purchaseId}" must be marked win/lose before settlement`
      );
    }

    const settledDraw = settleCanonicalDraw(draw, {
      settledAt: nowIso,
      settledBy: input.settledBy
    });
    await this.canonicalDrawStore.saveDraw(settledDraw);

    const publishedPurchases: CanonicalPurchaseRecord[] = [];
    const resolvedTickets: TicketRecord[] = [];
    const notifications: NotificationRecord[] = [];

    for (const purchase of normalizedPurchases) {
      const publishedPurchase = await this.publishPurchaseResult(purchase, nowIso, draw.drawId, input.settledBy);
      publishedPurchases.push(publishedPurchase);

      const ticket = await this.ticketStore.getTicketByRequestId(publishedPurchase.snapshot.legacyRequestId ?? publishedPurchase.snapshot.purchaseId);
      if (!ticket || ticket.verificationStatus !== "pending") {
        continue;
      }

      const resolved = resolveCompatibilityTicket(ticket, publishedPurchase.resultStatus, nowIso, input.settledBy);
      await this.ticketStore.saveTicket(resolved);
      resolvedTickets.push(resolved);

      const ticketNotifications = buildTicketNotifications(resolved, draw.lotteryCode, draw.drawId, nowIso);
      for (const notification of ticketNotifications) {
        await this.notificationStore.saveNotification(notification);
        notifications.push(notification);
      }
    }

    return {
      alreadySettled: false,
      draw: settledDraw,
      publishedPurchases,
      resolvedTickets,
      notifications
    };
  }

  async listDraws(lotteryCode?: string): Promise<readonly CanonicalDrawRecord[]> {
    return this.canonicalDrawStore.listDraws(lotteryCode);
  }

  async getDraw(lotteryCode: string, drawId: string): Promise<CanonicalDrawRecord | null> {
    return this.canonicalDrawStore.getDraw(lotteryCode, drawId);
  }

  async listDrawClosures(lotteryCode?: string) {
    return this.drawClosureStore.listClosures(lotteryCode);
  }

  async getDrawClosure(lotteryCode: string, drawId: string) {
    return this.drawClosureStore.getClosure(lotteryCode, drawId);
  }

  async deleteDraw(lotteryCode: string, drawId: string): Promise<void> {
    await this.canonicalDrawStore.deleteDraw(lotteryCode, drawId);
    await this.drawClosureStore.deleteClosure(lotteryCode, drawId);
  }

  private async ensureDrawExists(input: CreateDrawInput): Promise<CanonicalDrawRecord> {
    const existing = await this.canonicalDrawStore.getDraw(input.lotteryCode, input.drawId);
    if (existing) {
      return existing;
    }

    const created = createOpenCanonicalDraw({
      lotteryCode: input.lotteryCode,
      drawId: input.drawId,
      drawAt: input.drawAt,
      openedAt: this.timeSource.nowIso()
    });
    await this.canonicalDrawStore.saveDraw(created);
    return created;
  }

  private async publishPurchaseResult(
    purchase: CanonicalPurchaseRecord,
    settledAt: string,
    drawId: string,
    settledBy: string
  ): Promise<CanonicalPurchaseRecord> {
    let nextPurchase = purchase;
    if (nextPurchase.status === "awaiting_draw_close") {
      nextPurchase = appendCanonicalPurchaseTransition(nextPurchase, "settled", {
        eventId: `${nextPurchase.snapshot.purchaseId}:settled`,
        occurredAt: settledAt,
        note: `draw ${drawId} settled by ${settledBy}`
      });
    }

    nextPurchase = setCanonicalPurchaseResultVisibility(nextPurchase, {
      eventId: `${nextPurchase.snapshot.purchaseId}:result-visible`,
      occurredAt: settledAt,
      resultVisibility: "visible",
      note: `draw ${drawId} settled by ${settledBy}`
    });

    if (!sameCanonicalPurchase(nextPurchase, purchase)) {
      await this.canonicalPurchaseStore.savePurchase(nextPurchase);
    }

    return nextPurchase;
  }
}

function resolveCompatibilityTicket(
  ticket: TicketRecord,
  resultStatus: PurchaseResultStatus,
  settledAt: string,
  settledBy: string
): TicketRecord {
  const mark = resultStatus === "win" ? "win" : "lose";
  const marked = setTicketAdminResultMark(ticket, mark, settledBy, settledAt);
  return resolveTicketFromAdminMark(marked, ADMIN_EMULATED_WIN_AMOUNT_MINOR, settledAt, settledBy);
}

function mapMarkToResultStatus(mark: TicketAdminResultMark): Extract<PurchaseResultStatus, "win" | "lose"> {
  return mark === "win" ? "win" : "lose";
}

function sameCanonicalPurchase(left: CanonicalPurchaseRecord, right: CanonicalPurchaseRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildTicketNotifications(
  ticket: TicketRecord,
  lotteryCode: string,
  drawId: string,
  nowIso: string
): NotificationRecord[] {
  const notifications: NotificationRecord[] = [];
  const winningAmountMinor = ticket.winningAmountMinor ?? 0;
  const isWinningTicket = winningAmountMinor > 0;

  notifications.push(
    createNotification({
      notificationId: `${ticket.ticketId}:draw_closed_result_ready`,
      userId: ticket.userId,
      type: "draw_closed_result_ready" as NotificationType,
      title: isWinningTicket ? "Тираж закрыт: билет выиграл" : "Тираж закрыт: билет не выиграл",
      body: isWinningTicket
        ? `Тираж ${drawId} закрыт. Билет ${ticket.ticketId} выиграл ${formatMinorAsRub(winningAmountMinor)}.`
        : `Тираж ${drawId} закрыт. Билет ${ticket.ticketId} не выиграл.`,
      createdAt: nowIso,
      referenceTicketId: ticket.ticketId,
      referenceDrawId: drawId,
      referenceLotteryCode: lotteryCode
    })
  );

  if (isWinningTicket) {
    notifications.push(
      createNotification({
        notificationId: `${ticket.ticketId}:winning_actions_available`,
        userId: ticket.userId,
        type: "winning_actions_available" as NotificationType,
        title: "Выигрыш доступен",
        body: `Ваш билет выиграл. Сумма: ${formatMinorAsRub(winningAmountMinor)}. Выберите способ получения.`,
        createdAt: nowIso,
        referenceTicketId: ticket.ticketId,
        referenceDrawId: drawId,
        referenceLotteryCode: lotteryCode
      })
    );
  }

  return notifications;
}

function formatMinorAsRub(amountMinor: number): string {
  return `${(amountMinor / 100).toFixed(2)} RUB`;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }

  return normalized;
}
