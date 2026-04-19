import type { CanonicalPurchaseRecord, TicketRecord } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import { mapCanonicalPurchaseStatusToRequestState } from "./canonical-compatibility.js";

export interface TicketQueryServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
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

export class TicketQueryService {
  private readonly ticketStore: TicketStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;

  constructor(dependencies: TicketQueryServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
  }

  async listUserTickets(userId: string): Promise<TicketView[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const [tickets, canonicalPurchases] = await Promise.all([
      this.ticketStore.listTickets(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);
    const ticketRequestIds = new Set(tickets.map((ticket) => ticket.requestId));
    return tickets
      .filter((ticket) => ticket.userId === normalizedUserId)
      .map((ticket) => toTicketView(ticket))
      .concat(
        canonicalPurchases
          .filter((purchase) => purchase.snapshot.userId === normalizedUserId)
          .filter((purchase) => shouldProjectCanonicalTicket(purchase))
          .filter((purchase) => !ticketRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
          .map((purchase) => toCanonicalTicketView(purchase))
      )
      .sort((left, right) => compareTicketViews(left, right));
  }

  async listAllTickets(): Promise<TicketView[]> {
    const [tickets, canonicalPurchases] = await Promise.all([
      this.ticketStore.listTickets(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);
    const ticketRequestIds = new Set(tickets.map((ticket) => ticket.requestId));
    return tickets
      .map((ticket) => toTicketView(ticket))
      .concat(
        canonicalPurchases
          .filter((purchase) => shouldProjectCanonicalTicket(purchase))
          .filter((purchase) => !ticketRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
          .map((purchase) => toCanonicalTicketView(purchase))
      )
      .sort((left, right) => compareTicketViews(left, right));
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
    adminResultMark: ticket.adminResultMark,
    winningAmountMinor: ticket.winningAmountMinor,
    verifiedAt: ticket.verifiedAt,
    externalReference: ticket.externalReference,
    purchasedAt: ticket.purchasedAt,
    resultSource: ticket.resultSource,
    claimState: ticket.claimState
  };
}

function toCanonicalTicketView(purchase: CanonicalPurchaseRecord): TicketView {
  const requestId = purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId;
  const verifiedAt = purchase.resultVisibility === "visible" ? purchase.settledAt : null;

  return {
    ticketId: `canonical:${purchase.snapshot.purchaseId}`,
    requestId,
    userId: purchase.snapshot.userId,
    lotteryCode: purchase.snapshot.lotteryCode,
    drawId: purchase.snapshot.drawId,
    verificationStatus: purchase.resultVisibility === "visible" ? "verified" : "pending",
    adminResultMark: null,
    winningAmountMinor: null,
    verifiedAt,
    externalReference: purchase.externalTicketReference ?? `canonical:${purchase.snapshot.purchaseId}`,
    purchasedAt: purchase.purchasedAt ?? purchase.snapshot.submittedAt,
    resultSource: null,
    claimState: "unclaimed"
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
