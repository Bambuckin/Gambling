import type { CashDeskRequest } from "@lottery/domain";

export interface CashDeskRequestStore {
  saveCashDeskRequest(request: CashDeskRequest): Promise<void>;
  getCashDeskRequestById(cashDeskRequestId: string): Promise<CashDeskRequest | null>;
  getCashDeskRequestByTicketId(ticketId: string): Promise<CashDeskRequest | null>;
  listCashDeskRequests(): Promise<readonly CashDeskRequest[]>;
  clearAll(): Promise<void>;
}
