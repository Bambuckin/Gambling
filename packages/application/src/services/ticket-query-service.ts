import {
  ADMIN_EMULATED_WIN_AMOUNT_MINOR,
  type CanonicalPurchaseRecord,
  type TicketRecord
} from "@lottery/domain";
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
    const canonicalByRequestId = new Map(
      canonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase] as const)
    );
    return tickets
      .filter((ticket) => ticket.userId === normalizedUserId)
      .map((ticket) => toTicketView(ticket, canonicalByRequestId.get(ticket.requestId)))
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
    const canonicalByRequestId = new Map(
      canonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase] as const)
    );
    return tickets
      .map((ticket) => toTicketView(ticket, canonicalByRequestId.get(ticket.requestId)))
      .concat(
        canonicalPurchases
          .filter((purchase) => shouldProjectCanonicalTicket(purchase))
          .filter((purchase) => !ticketRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
          .map((purchase) => toCanonicalTicketView(purchase))
      )
      .sort((left, right) => compareTicketViews(left, right));
  }
}

function toTicketView(ticket: TicketRecord, canonicalPurchase?: CanonicalPurchaseRecord): TicketView {
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
    userId: ticket.userId,
    lotteryCode: ticket.lotteryCode,
    drawId: ticket.drawId,
    verificationStatus: canonicalVisible ? "verified" : canonicalResultHidden ? "pending" : ticket.verificationStatus,
    adminResultMark: canonicalAdminResultMark,
    winningAmountMinor: canonicalVisible
      ? resolveCanonicalWinningAmountMinor(ticket, canonicalPurchase)
      : canonicalResultHidden
        ? null
        : ticket.winningAmountMinor,
    verifiedAt: canonicalVisible ? canonicalPurchase?.settledAt ?? ticket.verifiedAt : canonicalResultHidden ? null : ticket.verifiedAt,
    externalReference: ticket.externalReference,
    purchasedAt: ticket.purchasedAt,
    resultSource: canonicalVisible ? ticket.resultSource ?? "admin_emulated" : canonicalResultHidden ? null : ticket.resultSource,
    claimState: ticket.claimState
  };
}

function toCanonicalTicketView(purchase: CanonicalPurchaseRecord): TicketView {
  const requestId = purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId;
  const verifiedAt = purchase.resultVisibility === "visible" ? purchase.settledAt : null;
  const adminResultMark =
    purchase.resultStatus === "win" ? "win" : purchase.resultStatus === "lose" ? "lose" : null;

  return {
    ticketId: `canonical:${purchase.snapshot.purchaseId}`,
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
    externalReference: purchase.externalTicketReference ?? `canonical:${purchase.snapshot.purchaseId}`,
    purchasedAt: purchase.purchasedAt ?? purchase.snapshot.submittedAt,
    resultSource: purchase.resultVisibility === "visible" ? "admin_emulated" : null,
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
