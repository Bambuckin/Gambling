import type { CashDeskRequest } from "@lottery/domain";
import type { CashDeskRequestStore } from "@lottery/application";

export class InMemoryCashDeskRequestStore implements CashDeskRequestStore {
  private requests: CashDeskRequest[] = [];

  async saveCashDeskRequest(request: CashDeskRequest): Promise<void> {
    const filtered = this.requests.filter((r) => r.cashDeskRequestId !== request.cashDeskRequestId);
    this.requests = [...filtered, { ...request }];
  }

  async getCashDeskRequestById(cashDeskRequestId: string): Promise<CashDeskRequest | null> {
    return this.requests.find((r) => r.cashDeskRequestId === cashDeskRequestId) ?? null;
  }

  async getCashDeskRequestByTicketId(ticketId: string): Promise<CashDeskRequest | null> {
    return this.requests.find((r) => r.ticketId === ticketId) ?? null;
  }

  async listCashDeskRequests(): Promise<readonly CashDeskRequest[]> {
    return [...this.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async clearAll(): Promise<void> {
    this.requests = [];
  }
}
