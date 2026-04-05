import type { TicketRecord } from "@lottery/domain";
import type { TicketStore } from "../ports/ticket-store.js";

export interface TicketQueryServiceDependencies {
  readonly ticketStore: TicketStore;
}

export interface TicketView {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly verificationStatus: TicketRecord["verificationStatus"];
  readonly winningAmountMinor: number | null;
  readonly verifiedAt: string | null;
  readonly externalReference: string;
  readonly purchasedAt: string;
}

export class TicketQueryService {
  private readonly ticketStore: TicketStore;

  constructor(dependencies: TicketQueryServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
  }

  async listUserTickets(userId: string): Promise<TicketView[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const tickets = await this.ticketStore.listTickets();
    return tickets
      .filter((ticket) => ticket.userId === normalizedUserId)
      .map((ticket) => toTicketView(ticket))
      .sort((left, right) => compareTicketViews(left, right));
  }

  async listAllTickets(): Promise<TicketView[]> {
    const tickets = await this.ticketStore.listTickets();
    return tickets.map((ticket) => toTicketView(ticket)).sort((left, right) => compareTicketViews(left, right));
  }
}

function toTicketView(ticket: TicketRecord): TicketView {
  return {
    ticketId: ticket.ticketId,
    requestId: ticket.requestId,
    userId: ticket.userId,
    lotteryCode: ticket.lotteryCode,
    drawId: ticket.drawId,
    verificationStatus: ticket.verificationStatus,
    winningAmountMinor: ticket.winningAmountMinor,
    verifiedAt: ticket.verifiedAt,
    externalReference: ticket.externalReference,
    purchasedAt: ticket.purchasedAt
  };
}

function compareTicketViews(left: TicketView, right: TicketView): number {
  const leftUpdatedAt = left.verifiedAt ?? left.purchasedAt;
  const rightUpdatedAt = right.verifiedAt ?? right.purchasedAt;
  const byUpdatedAt = rightUpdatedAt.localeCompare(leftUpdatedAt);
  if (byUpdatedAt !== 0) {
    return byUpdatedAt;
  }

  return right.ticketId.localeCompare(left.ticketId);
}
