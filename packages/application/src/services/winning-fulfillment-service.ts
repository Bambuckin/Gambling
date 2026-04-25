import { ADMIN_EMULATED_WIN_AMOUNT_MINOR, type CashDeskRequest, type CanonicalPurchaseRecord, type TicketRecord, type WinningsCreditJob } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { CashDeskRequestStore } from "../ports/cash-desk-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { WinningsCreditJobStore } from "../ports/winnings-credit-job-store.js";
import { buildCanonicalTicketId } from "./canonical-compatibility.js";
import { loadCanonicalPurchaseForRequest } from "./canonical-purchase-state.js";
import type { CashDeskService } from "./cash-desk-service.js";
import type { WinningsCreditService } from "./winnings-credit-service.js";

export interface WinningFulfillmentServiceDependencies {
  readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  readonly ticketStore: TicketStore;
  readonly cashDeskRequestStore: CashDeskRequestStore;
  readonly winningsCreditJobStore: WinningsCreditJobStore;
  readonly cashDeskService: CashDeskService;
  readonly winningsCreditService: WinningsCreditService;
}

export type WinningFulfillmentServiceErrorCode =
  | "purchase_not_found"
  | "forbidden"
  | "result_not_visible"
  | "not_winner"
  | "credit_conflict"
  | "cash_desk_conflict";

export class WinningFulfillmentServiceError extends Error {
  readonly code: WinningFulfillmentServiceErrorCode;

  constructor(message: string, code: WinningFulfillmentServiceErrorCode) {
    super(message);
    this.name = "WinningFulfillmentServiceError";
    this.code = code;
  }
}

interface WinningFulfillmentTarget {
  readonly requestId: string;
  readonly purchaseId: string;
  readonly ticketId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly currency: string;
  readonly winningAmountMinor: number;
  readonly ticket: TicketRecord | null;
  readonly purchase: CanonicalPurchaseRecord;
}

export class WinningFulfillmentService {
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  private readonly ticketStore: TicketStore;
  private readonly cashDeskRequestStore: CashDeskRequestStore;
  private readonly winningsCreditJobStore: WinningsCreditJobStore;
  private readonly cashDeskService: CashDeskService;
  private readonly winningsCreditService: WinningsCreditService;

  constructor(dependencies: WinningFulfillmentServiceDependencies) {
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore;
    this.ticketStore = dependencies.ticketStore;
    this.cashDeskRequestStore = dependencies.cashDeskRequestStore;
    this.winningsCreditJobStore = dependencies.winningsCreditJobStore;
    this.cashDeskService = dependencies.cashDeskService;
    this.winningsCreditService = dependencies.winningsCreditService;
  }

  async enqueueCreditForRequest(input: {
    readonly requestId: string;
    readonly userId: string;
  }): Promise<WinningsCreditJob> {
    const target = await this.resolveTarget(input);
    const existingCreditJob = await this.winningsCreditJobStore.getJobByTicketId(target.ticketId);
    if (existingCreditJob) {
      return existingCreditJob;
    }

    const existingCashDeskRequest = await this.cashDeskRequestStore.getCashDeskRequestByTicketId(target.ticketId);
    if (existingCashDeskRequest || isLegacyCashDeskClaim(target.ticket)) {
      throw new WinningFulfillmentServiceError(
        `request "${target.requestId}" already uses the cash desk fulfillment path`,
        "credit_conflict"
      );
    }

    return this.winningsCreditService.enqueueCreditJob({
      requestId: target.requestId,
      purchaseId: target.purchaseId,
      ticketId: target.ticketId,
      userId: target.userId,
      drawId: target.drawId,
      winningAmountMinor: target.winningAmountMinor,
      currency: target.currency
    });
  }

  async createCashDeskRequestForRequest(input: {
    readonly requestId: string;
    readonly userId: string;
  }): Promise<CashDeskRequest> {
    const target = await this.resolveTarget(input);
    const existingCashDeskRequest = await this.cashDeskRequestStore.getCashDeskRequestByTicketId(target.ticketId);
    if (existingCashDeskRequest) {
      return existingCashDeskRequest;
    }

    const existingCreditJob = await this.winningsCreditJobStore.getJobByTicketId(target.ticketId);
    if (existingCreditJob || isLegacyCreditClaim(target.ticket)) {
      throw new WinningFulfillmentServiceError(
        `request "${target.requestId}" already uses the balance credit fulfillment path`,
        "cash_desk_conflict"
      );
    }

    return this.cashDeskService.createCashDeskRequest({
      requestId: target.requestId,
      purchaseId: target.purchaseId,
      ticketId: target.ticketId,
      userId: target.userId,
      lotteryCode: target.lotteryCode,
      drawId: target.drawId,
      winningAmountMinor: target.winningAmountMinor,
      currency: target.currency,
      createdAt: target.purchase.settledAt ?? target.purchase.snapshot.submittedAt
    });
  }

  private async resolveTarget(input: {
    readonly requestId: string;
    readonly userId: string;
  }): Promise<WinningFulfillmentTarget> {
    const normalizedRequestId = input.requestId.trim();
    if (!normalizedRequestId) {
      throw new WinningFulfillmentServiceError("requestId is required", "purchase_not_found");
    }

    const purchase = await loadCanonicalPurchaseForRequest(this.canonicalPurchaseStore, normalizedRequestId);
    if (!purchase) {
      throw new WinningFulfillmentServiceError(
        `canonical purchase for request "${normalizedRequestId}" not found`,
        "purchase_not_found"
      );
    }

    if (purchase.snapshot.userId !== input.userId.trim()) {
      throw new WinningFulfillmentServiceError(
        `request "${normalizedRequestId}" does not belong to user "${input.userId}"`,
        "forbidden"
      );
    }

    if (purchase.resultVisibility !== "visible") {
      throw new WinningFulfillmentServiceError(
        `request "${normalizedRequestId}" is not settled for fulfillment yet`,
        "result_not_visible"
      );
    }

    if (purchase.resultStatus !== "win") {
      throw new WinningFulfillmentServiceError(
        `request "${normalizedRequestId}" is not a winning purchase`,
        "not_winner"
      );
    }

    const requestId = purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId;
    const ticket = await this.ticketStore.getTicketByRequestId(requestId);
    const winningAmountMinor = resolveWinningAmountMinor(ticket, purchase);
    if (winningAmountMinor <= 0) {
      throw new WinningFulfillmentServiceError(
        `request "${normalizedRequestId}" has no payout amount`,
        "not_winner"
      );
    }

    return {
      requestId,
      purchaseId: purchase.snapshot.purchaseId,
      ticketId: ticket?.ticketId ?? buildCanonicalTicketId(purchase.snapshot.purchaseId),
      userId: purchase.snapshot.userId,
      lotteryCode: purchase.snapshot.lotteryCode,
      drawId: purchase.snapshot.drawId,
      currency: purchase.snapshot.currency,
      winningAmountMinor,
      ticket,
      purchase
    };
  }
}

function resolveWinningAmountMinor(ticket: TicketRecord | null, purchase: CanonicalPurchaseRecord): number {
  if (purchase.resultStatus !== "win" || purchase.resultVisibility !== "visible") {
    return 0;
  }

  return ticket?.winningAmountMinor && ticket.winningAmountMinor > 0
    ? ticket.winningAmountMinor
    : ADMIN_EMULATED_WIN_AMOUNT_MINOR;
}

function isLegacyCreditClaim(ticket: TicketRecord | null): boolean {
  return ticket?.claimState === "credit_pending" || ticket?.claimState === "credited";
}

function isLegacyCashDeskClaim(ticket: TicketRecord | null): boolean {
  return ticket?.claimState === "cash_desk_pending" || ticket?.claimState === "cash_desk_paid";
}
