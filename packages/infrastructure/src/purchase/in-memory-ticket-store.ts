import type { TicketRecord } from "@lottery/domain";
import type { TicketStore } from "@lottery/application";

export class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[];

  constructor(initialTickets: readonly TicketRecord[] = []) {
    this.tickets = initialTickets.map(cloneTicket);
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets
      .map(cloneTicket)
      .sort((left, right) => compareTickets(left, right));
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const normalized = requestId.trim();
    const ticket = this.tickets.find((entry) => entry.requestId === normalized) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    const filtered = this.tickets.filter((entry) => entry.requestId !== ticket.requestId);
    this.tickets = [...filtered, cloneTicket(ticket)];
  }
}

function compareTickets(left: TicketRecord, right: TicketRecord): number {
  const byPurchase = left.purchasedAt.localeCompare(right.purchasedAt);
  if (byPurchase !== 0) {
    return byPurchase;
  }
  return left.ticketId.localeCompare(right.ticketId);
}

function cloneTicket(ticket: TicketRecord): TicketRecord {
  return {
    ...ticket
  };
}
