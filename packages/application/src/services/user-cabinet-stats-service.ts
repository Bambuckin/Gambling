import type { LedgerEntry } from "@lottery/domain";
import type { TicketStore } from "../ports/ticket-store.js";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import { buildBalanceSnapshot, sortLedgerEntries } from "@lottery/domain";

export interface UserCabinetStatsServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly ledgerStore: LedgerStore;
  readonly requestStore: PurchaseRequestStore;
}

export interface UserCabinetSummary {
  readonly userId: string;
  readonly availableMinor: number;
  readonly reservedMinor: number;
  readonly currency: string;
  readonly totalStakesMinor: number;
  readonly totalWinningsMinor: number;
  readonly netResultMinor: number;
  readonly totalTickets: number;
  readonly winningTickets: number;
}

export interface CabinetTicketView {
  readonly ticketId: string;
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly winningAmountMinor: number | null;
  readonly claimState: string;
  readonly resultSource: string;
  readonly purchasedAt: string;
}

export interface CabinetFilter {
  readonly lottery?: string;
  readonly status?: string;
  readonly periodFrom?: string;
  readonly periodTo?: string;
}

export class UserCabinetStatsService {
  private readonly ticketStore: TicketStore;
  private readonly ledgerStore: LedgerStore;
  private readonly requestStore: PurchaseRequestStore;

  constructor(dependencies: UserCabinetStatsServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.ledgerStore = dependencies.ledgerStore;
    this.requestStore = dependencies.requestStore;
  }

  async getCabinetSummary(userId: string, currency: string): Promise<UserCabinetSummary> {
    const [tickets, entries] = await Promise.all([
      this.ticketStore.listTickets(),
      this.ledgerStore.listEntriesByUser(userId)
    ]);

    const userTickets = tickets.filter((t) => t.userId === userId);
    const sortedEntries = sortLedgerEntries(entries);
    const snapshot = buildBalanceSnapshot({ userId, currency, entries: sortedEntries });

    const totalStakesMinor = entries
      .filter((e) => e.operation === "debit")
      .reduce((sum, e) => sum + e.amountMinor, 0);

    const winningTickets = userTickets.filter((t) => (t.winningAmountMinor ?? 0) > 0);
    const totalWinningsMinor = winningTickets.reduce((sum, t) => sum + (t.winningAmountMinor ?? 0), 0);

    return {
      userId,
      availableMinor: snapshot.availableMinor,
      reservedMinor: snapshot.reservedMinor,
      currency,
      totalStakesMinor,
      totalWinningsMinor,
      netResultMinor: totalWinningsMinor - totalStakesMinor,
      totalTickets: userTickets.length,
      winningTickets: winningTickets.length
    };
  }

  async getCabinetTickets(userId: string, filter?: CabinetFilter): Promise<CabinetTicketView[]> {
    const tickets = await this.ticketStore.listTickets();
    let userTickets = tickets.filter((t) => t.userId === userId);

    if (filter?.lottery) {
      userTickets = userTickets.filter((t) => t.lotteryCode === filter.lottery);
    }
    if (filter?.status) {
      userTickets = userTickets.filter((t) => {
        if (filter.status === "winning") return (t.winningAmountMinor ?? 0) > 0;
        if (filter.status === "losing") return (t.winningAmountMinor ?? 0) === 0;
        if (filter.status === "claimed") return t.claimState !== "unclaimed";
        return true;
      });
    }
    if (filter?.periodFrom) {
      const from = Date.parse(filter.periodFrom);
      userTickets = userTickets.filter((t) => Date.parse(t.purchasedAt) >= from);
    }
    if (filter?.periodTo) {
      const to = Date.parse(filter.periodTo);
      userTickets = userTickets.filter((t) => Date.parse(t.purchasedAt) <= to);
    }

    return userTickets
      .map((t) => ({
        ticketId: t.ticketId,
        requestId: t.requestId,
        lotteryCode: t.lotteryCode,
        drawId: t.drawId,
        winningAmountMinor: t.winningAmountMinor,
        claimState: t.claimState,
        resultSource: t.resultSource ?? "none",
        purchasedAt: t.purchasedAt
      }))
      .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  }
}
