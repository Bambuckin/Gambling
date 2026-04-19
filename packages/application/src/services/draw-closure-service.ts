import {
  ADMIN_EMULATED_WIN_AMOUNT_MINOR,
  closeDrawClosure,
  createNotification,
  createOpenDrawClosure,
  isDrawClosed,
  resolveTicketFromAdminMark,
  setTicketAdminResultMark,
  type DrawClosureRecord,
  type NotificationRecord,
  type NotificationType,
  type TicketAdminResultMark,
  type TicketRecord
} from "@lottery/domain";
import type { DrawClosureStore } from "../ports/draw-closure-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";

export interface DrawClosureServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly drawClosureStore: DrawClosureStore;
  readonly notificationStore: NotificationStore;
  readonly timeSource: TimeSource;
}

export interface MarkTicketResultInput {
  readonly ticketId: string;
  readonly mark: TicketAdminResultMark;
  readonly markedBy: string;
}

export interface CloseDrawInput {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly closedBy: string;
}

export interface CloseDrawResult {
  readonly alreadyClosed: boolean;
  readonly closure: DrawClosureRecord;
  readonly resolvedTickets: readonly TicketRecord[];
  readonly notifications: readonly NotificationRecord[];
}

export class DrawClosureService {
  private readonly ticketStore: TicketStore;
  private readonly drawClosureStore: DrawClosureStore;
  private readonly notificationStore: NotificationStore;
  private readonly timeSource: TimeSource;

  constructor(dependencies: DrawClosureServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.drawClosureStore = dependencies.drawClosureStore;
    this.notificationStore = dependencies.notificationStore;
    this.timeSource = dependencies.timeSource;
  }

  async markTicketResult(input: MarkTicketResultInput): Promise<TicketRecord> {
    const ticket = await this.ticketStore.getTicketById(input.ticketId);
    if (!ticket) {
      throw new Error(`ticket "${input.ticketId}" not found`);
    }

    if (ticket.verificationStatus !== "pending") {
      throw new Error(`ticket "${input.ticketId}" is already resolved with status "${ticket.verificationStatus}"`);
    }

    const closure = await this.drawClosureStore.getClosure(ticket.lotteryCode, ticket.drawId);
    if (isDrawClosed(closure)) {
      throw new Error(`draw "${ticket.drawId}" for "${ticket.lotteryCode}" is already closed`);
    }

    const nowIso = this.timeSource.nowIso();
    const marked = setTicketAdminResultMark(ticket, input.mark, input.markedBy, nowIso);
    await this.ticketStore.saveTicket(marked);
    return marked;
  }

  async closeDraw(input: CloseDrawInput): Promise<CloseDrawResult> {
    let closure = await this.drawClosureStore.getClosure(input.lotteryCode, input.drawId);

    if (!closure) {
      closure = createOpenDrawClosure(input.lotteryCode, input.drawId);
    }

    if (isDrawClosed(closure)) {
      return {
        alreadyClosed: true,
        closure,
        resolvedTickets: [],
        notifications: []
      };
    }

    const nowIso = this.timeSource.nowIso();
    const closed = closeDrawClosure(closure, input.closedBy, nowIso);
    await this.drawClosureStore.saveClosure(closed);

    const allTickets = await this.ticketStore.listTickets();
    const drawTickets = allTickets.filter(
      (ticket) =>
        ticket.lotteryCode === input.lotteryCode &&
        ticket.drawId === input.drawId &&
        ticket.verificationStatus === "pending"
    );

    const resolvedTickets: TicketRecord[] = [];
    const notifications: NotificationRecord[] = [];

    for (const ticket of drawTickets) {
      const resolved = resolveTicketFromAdminMark(ticket, ADMIN_EMULATED_WIN_AMOUNT_MINOR, nowIso, input.closedBy);
      await this.ticketStore.saveTicket(resolved);
      resolvedTickets.push(resolved);

      const ticketNotifications = buildTicketNotifications(resolved, input.lotteryCode, input.drawId, nowIso);
      for (const notification of ticketNotifications) {
        await this.notificationStore.saveNotification(notification);
        notifications.push(notification);
      }
    }

    return {
      alreadyClosed: false,
      closure: closed,
      resolvedTickets,
      notifications
    };
  }

  async listDrawClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    return this.drawClosureStore.listClosures(lotteryCode);
  }

  async getDrawClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    return this.drawClosureStore.getClosure(lotteryCode, drawId);
  }

  async deleteDraw(lotteryCode: string, drawId: string): Promise<void> {
    await this.drawClosureStore.deleteClosure(lotteryCode, drawId);
  }
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
