import type { TicketRecord } from "@lottery/domain";

export interface TicketStore {
  listTickets(): Promise<readonly TicketRecord[]>;
  getTicketById(ticketId: string): Promise<TicketRecord | null>;
  getTicketByRequestId(requestId: string): Promise<TicketRecord | null>;
  saveTicket(ticket: TicketRecord): Promise<void>;
  clearAll(): Promise<void>;
}
