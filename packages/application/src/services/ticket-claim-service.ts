import type { TicketRecord } from "@lottery/domain";
import type { TicketStore } from "../ports/ticket-store.js";

export interface TicketClaimServiceDependencies {
  readonly ticketStore: TicketStore;
}

export class TicketClaimService {
  private readonly ticketStore: TicketStore;

  constructor(dependencies: TicketClaimServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
  }

  async startCreditClaim(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketStore.getTicketById(ticketId);
    if (!ticket) {
      throw new Error(`ticket "${ticketId}" not found`);
    }

    assertWinningTicket(ticket);
    assertUnclaimed(ticket);

    const updated: TicketRecord = { ...ticket, claimState: "credit_pending" };
    await this.ticketStore.saveTicket(updated);
    return updated;
  }

  async startCashDeskClaim(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketStore.getTicketById(ticketId);
    if (!ticket) {
      throw new Error(`ticket "${ticketId}" not found`);
    }

    assertWinningTicket(ticket);
    assertUnclaimed(ticket);

    const updated: TicketRecord = { ...ticket, claimState: "cash_desk_pending" };
    await this.ticketStore.saveTicket(updated);
    return updated;
  }

  async markTicketCredited(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketStore.getTicketById(ticketId);
    if (!ticket) {
      throw new Error(`ticket "${ticketId}" not found`);
    }

    const updated: TicketRecord = { ...ticket, claimState: "credited" };
    await this.ticketStore.saveTicket(updated);
    return updated;
  }

  async markTicketCashDeskPaid(ticketId: string): Promise<TicketRecord> {
    const ticket = await this.ticketStore.getTicketById(ticketId);
    if (!ticket) {
      throw new Error(`ticket "${ticketId}" not found`);
    }

    const updated: TicketRecord = { ...ticket, claimState: "cash_desk_paid" };
    await this.ticketStore.saveTicket(updated);
    return updated;
  }
}

function assertWinningTicket(ticket: TicketRecord): void {
  if (ticket.verificationStatus !== "verified") {
    throw new Error(`ticket "${ticket.ticketId}" is not verified`);
  }
  if (!ticket.winningAmountMinor || ticket.winningAmountMinor <= 0) {
    throw new Error(`ticket "${ticket.ticketId}" has no winnings`);
  }
}

function assertUnclaimed(ticket: TicketRecord): void {
  if (ticket.claimState !== "unclaimed") {
    throw new Error(`ticket "${ticket.ticketId}" already has claim state "${ticket.claimState}"`);
  }
}
