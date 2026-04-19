import { createCashDeskRequest, payCashDeskRequest, type CashDeskRequest } from "@lottery/domain";
import type { CashDeskRequestStore } from "../ports/cash-desk-request-store.js";
import type { TicketClaimService } from "./ticket-claim-service.js";

export interface CashDeskServiceDependencies {
  readonly cashDeskRequestStore: CashDeskRequestStore;
  readonly ticketClaimService: TicketClaimService;
}

export class CashDeskService {
  private readonly cashDeskRequestStore: CashDeskRequestStore;
  private readonly ticketClaimService: TicketClaimService;

  constructor(dependencies: CashDeskServiceDependencies) {
    this.cashDeskRequestStore = dependencies.cashDeskRequestStore;
    this.ticketClaimService = dependencies.ticketClaimService;
  }

  async createCashDeskRequest(input: {
    readonly ticketId: string;
    readonly userId: string;
    readonly lotteryCode: string;
    readonly drawId: string;
    readonly winningAmountMinor: number;
    readonly currency: string;
    readonly createdAt: string;
  }): Promise<CashDeskRequest> {
    const existing = await this.cashDeskRequestStore.getCashDeskRequestByTicketId(input.ticketId);
    if (existing) {
      return existing;
    }

    await this.ticketClaimService.startCashDeskClaim(input.ticketId);

    const request = createCashDeskRequest({
      cashDeskRequestId: `${input.ticketId}:cash-desk`,
      ...input
    });

    await this.cashDeskRequestStore.saveCashDeskRequest(request);
    return request;
  }

  async payCashDeskRequest(cashDeskRequestId: string, paidBy: string, paidAt: string): Promise<CashDeskRequest> {
    const request = await this.cashDeskRequestStore.getCashDeskRequestById(cashDeskRequestId);
    if (!request) {
      throw new Error(`cash desk request "${cashDeskRequestId}" not found`);
    }

    if (request.status === "paid") {
      return request;
    }

    const paid = payCashDeskRequest(request, paidBy, paidAt);
    await this.cashDeskRequestStore.saveCashDeskRequest(paid);
    await this.ticketClaimService.markTicketCashDeskPaid(request.ticketId);
    return paid;
  }

  async listCashDeskRequests(): Promise<readonly CashDeskRequest[]> {
    return this.cashDeskRequestStore.listCashDeskRequests();
  }
}
