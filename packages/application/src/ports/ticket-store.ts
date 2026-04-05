import type { TicketRecord } from "@lottery/domain";

export interface TicketStore {
  listTickets(): Promise<readonly TicketRecord[]>;
  getTicketByRequestId(requestId: string): Promise<TicketRecord | null>;
  saveTicket(ticket: TicketRecord): Promise<void>;
}
