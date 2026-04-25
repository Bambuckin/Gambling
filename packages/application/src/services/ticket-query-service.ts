import {
  ADMIN_EMULATED_WIN_AMOUNT_MINOR,
  type CashDeskRequest,
  type CanonicalPurchaseRecord,
  type TicketClaimState,
  type TicketRecord,
  type WinningsCreditJob
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { CashDeskRequestStore } from "../ports/cash-desk-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { WinningsCreditJobStore } from "../ports/winnings-credit-job-store.js";
import { buildCanonicalTicketId, mapCanonicalPurchaseStatusToRequestState } from "./canonical-compatibility.js";

export interface TicketQueryServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly cashDeskRequestStore?: CashDeskRequestStore;
  readonly winningsCreditJobStore?: WinningsCreditJobStore;
}

export interface TicketView {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly verificationStatus: TicketRecord["verificationStatus"];
  readonly adminResultMark: TicketRecord["adminResultMark"];
  readonly winningAmountMinor: number | null;
  readonly verifiedAt: string | null;
  readonly externalReference: string;
  readonly purchasedAt: string;
  readonly resultSource: TicketRecord["resultSource"];
  readonly claimState: TicketRecord["claimState"];
}

interface FulfillmentLookup {
  readonly cashDeskByTicketId: Map<string, CashDeskRequest>;
  readonly cashDeskByRequestId: Map<string, CashDeskRequest>;
  readonly creditByTicketId: Map<string, WinningsCreditJob>;
  readonly creditByRequestId: Map<string, WinningsCreditJob>;
}

export class TicketQueryService {
  private readonly ticketStore: TicketStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly cashDeskRequestStore: CashDeskRequestStore | null;
  private readonly winningsCreditJobStore: WinningsCreditJobStore | null;

  constructor(dependencies: TicketQueryServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.cashDeskRequestStore = dependencies.cashDeskRequestStore ?? null;
    this.winningsCreditJobStore = dependencies.winningsCreditJobStore ?? null;
  }

  async listUserTickets(userId: string): Promise<TicketView[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const [tickets, canonicalPurchases, fulfillmentLookup] = await this.loadData();
    const ticketRequestIds = new Set(tickets.map((ticket) => ticket.requestId));
    const canonicalByRequestId = new Map(
      canonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase] as const)
    );

    return tickets
      .filter((ticket) => ticket.userId === normalizedUserId)
      .map((ticket) => toTicketView(ticket, canonicalByRequestId.get(ticket.requestId), fulfillmentLookup))
      .concat(
        canonicalPurchases
          .filter((purchase) => purchase.snapshot.userId === normalizedUserId)
          .filter((purchase) => shouldProjectCanonicalTicket(purchase))
          .filter((purchase) => !ticketRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
          .map((purchase) => toCanonicalTicketView(purchase, fulfillmentLookup))
      )
      .sort((left, right) => compareTicketViews(left, right));
  }

  async listAllTickets(): Promise<TicketView[]> {
    const [tickets, canonicalPurchases, fulfillmentLookup] = await this.loadData();
    const ticketRequestIds = new Set(tickets.map((ticket) => ticket.requestId));
    const canonicalByRequestId = new Map(
      canonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase] as const)
    );

    return tickets
      .map((ticket) => toTicketView(ticket, canonicalByRequestId.get(ticket.requestId), fulfillmentLookup))
      .concat(
        canonicalPurchases
          .filter((purchase) => shouldProjectCanonicalTicket(purchase))
          .filter((purchase) => !ticketRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
          .map((purchase) => toCanonicalTicketView(purchase, fulfillmentLookup))
      )
      .sort((left, right) => compareTicketViews(left, right));
  }

  private async loadData(): Promise<
    readonly [readonly TicketRecord[], readonly CanonicalPurchaseRecord[], FulfillmentLookup]
  > {
    const [tickets, canonicalPurchases, cashDeskRequests, winningsCreditJobs] = await Promise.all([
      this.ticketStore.listTickets(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([]),
      this.cashDeskRequestStore?.listCashDeskRequests() ?? Promise.resolve([]),
      this.winningsCreditJobStore?.listJobs() ?? Promise.resolve([])
    ]);

    return [tickets, canonicalPurchases, buildFulfillmentLookup(cashDeskRequests, winningsCreditJobs)];
  }
}

function toTicketView(
  ticket: TicketRecord,
  canonicalPurchase: CanonicalPurchaseRecord | undefined,
  fulfillmentLookup: FulfillmentLookup
): TicketView {
  const canonicalAdminResultMark =
    canonicalPurchase?.resultStatus === "win"
      ? "win"
      : canonicalPurchase?.resultStatus === "lose"
        ? "lose"
        : ticket.adminResultMark;
  const canonicalVisible = canonicalPurchase?.resultVisibility === "visible";
  const canonicalResultHidden = canonicalPurchase && canonicalPurchase.resultVisibility !== "visible";

  return {
    ticketId: ticket.ticketId,
    requestId: ticket.requestId,
    userId: canonicalPurchase?.snapshot.userId ?? ticket.userId,
    lotteryCode: canonicalPurchase?.snapshot.lotteryCode ?? ticket.lotteryCode,
    drawId: canonicalPurchase?.snapshot.drawId ?? ticket.drawId,
    verificationStatus: canonicalVisible ? "verified" : canonicalResultHidden ? "pending" : ticket.verificationStatus,
    adminResultMark: canonicalAdminResultMark,
    winningAmountMinor: canonicalVisible
      ? resolveCanonicalWinningAmountMinor(ticket, canonicalPurchase)
      : canonicalResultHidden
        ? null
        : ticket.winningAmountMinor,
    verifiedAt: canonicalVisible ? canonicalPurchase?.settledAt ?? ticket.verifiedAt : canonicalResultHidden ? null : ticket.verifiedAt,
    externalReference: canonicalPurchase?.externalTicketReference ?? ticket.externalReference,
    purchasedAt: canonicalPurchase?.purchasedAt ?? canonicalPurchase?.snapshot.submittedAt ?? ticket.purchasedAt,
    resultSource: canonicalVisible ? ticket.resultSource ?? "admin_emulated" : canonicalResultHidden ? null : ticket.resultSource,
    claimState: resolveClaimState({
      requestId: ticket.requestId,
      ticketId: ticket.ticketId,
      fallback: ticket.claimState,
      fulfillmentLookup
    })
  };
}

function toCanonicalTicketView(purchase: CanonicalPurchaseRecord, fulfillmentLookup: FulfillmentLookup): TicketView {
  const requestId = purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId;
  const ticketId = buildCanonicalTicketId(purchase.snapshot.purchaseId);
  const verifiedAt = purchase.resultVisibility === "visible" ? purchase.settledAt : null;
  const adminResultMark =
    purchase.resultStatus === "win" ? "win" : purchase.resultStatus === "lose" ? "lose" : null;

  return {
    ticketId,
    requestId,
    userId: purchase.snapshot.userId,
    lotteryCode: purchase.snapshot.lotteryCode,
    drawId: purchase.snapshot.drawId,
    verificationStatus: purchase.resultVisibility === "visible" ? "verified" : "pending",
    adminResultMark,
    winningAmountMinor:
      purchase.resultVisibility === "visible"
        ? purchase.resultStatus === "win"
          ? ADMIN_EMULATED_WIN_AMOUNT_MINOR
          : purchase.resultStatus === "lose"
            ? 0
            : null
        : null,
    verifiedAt,
    externalReference: purchase.externalTicketReference ?? buildCanonicalTicketId(purchase.snapshot.purchaseId),
    purchasedAt: purchase.purchasedAt ?? purchase.snapshot.submittedAt,
    resultSource: purchase.resultVisibility === "visible" ? "admin_emulated" : null,
    claimState: resolveClaimState({
      requestId,
      ticketId,
      fallback: "unclaimed",
      fulfillmentLookup
    })
  };
}

function shouldProjectCanonicalTicket(purchase: CanonicalPurchaseRecord): boolean {
  const projectedStatus = mapCanonicalPurchaseStatusToRequestState(purchase);
  return projectedStatus === "success";
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

function resolveCanonicalWinningAmountMinor(
  ticket: TicketRecord,
  purchase: CanonicalPurchaseRecord | undefined
): number | null {
  if (!purchase || purchase.resultVisibility !== "visible") {
    return ticket.winningAmountMinor;
  }

  if (purchase.resultStatus === "win") {
    return ticket.winningAmountMinor ?? ADMIN_EMULATED_WIN_AMOUNT_MINOR;
  }

  if (purchase.resultStatus === "lose") {
    return 0;
  }

  return ticket.winningAmountMinor;
}

function buildFulfillmentLookup(
  cashDeskRequests: readonly CashDeskRequest[],
  winningsCreditJobs: readonly WinningsCreditJob[]
): FulfillmentLookup {
  return {
    cashDeskByTicketId: new Map(cashDeskRequests.map((request) => [request.ticketId, request] as const)),
    cashDeskByRequestId: new Map(
      cashDeskRequests
        .filter((request) => request.requestId.trim().length > 0)
        .map((request) => [request.requestId, request] as const)
    ),
    creditByTicketId: new Map(winningsCreditJobs.map((job) => [job.ticketId, job] as const)),
    creditByRequestId: new Map(
      winningsCreditJobs
        .filter((job) => job.requestId.trim().length > 0)
        .map((job) => [job.requestId, job] as const)
    )
  };
}

function resolveClaimState(input: {
  readonly requestId: string;
  readonly ticketId: string;
  readonly fallback: TicketClaimState;
  readonly fulfillmentLookup: FulfillmentLookup;
}): TicketClaimState {
  const cashDeskRequest =
    input.fulfillmentLookup.cashDeskByTicketId.get(input.ticketId) ??
    input.fulfillmentLookup.cashDeskByRequestId.get(input.requestId);
  if (cashDeskRequest) {
    return cashDeskRequest.status === "paid" ? "cash_desk_paid" : "cash_desk_pending";
  }

  const winningsCreditJob =
    input.fulfillmentLookup.creditByTicketId.get(input.ticketId) ??
    input.fulfillmentLookup.creditByRequestId.get(input.requestId);
  if (winningsCreditJob) {
    return winningsCreditJob.status === "done" ? "credited" : "credit_pending";
  }

  return input.fallback;
}
