import { describe, expect, it } from "vitest";
import {
  ADMIN_EMULATED_WIN_AMOUNT_MINOR,
  appendCanonicalPurchaseTransition,
  applyCanonicalPurchaseResult,
  createSubmittedCanonicalPurchase,
  setCanonicalPurchaseResultVisibility,
  type CanonicalPurchaseRecord,
  type LedgerEntry,
  type TicketRecord
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import { TicketQueryService } from "../services/ticket-query-service.js";
import { UserCabinetStatsService } from "../services/user-cabinet-stats-service.js";

function createTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    ticketId: overrides.ticketId ?? "t-1",
    requestId: overrides.requestId ?? "r-1",
    userId: overrides.userId ?? "user-1",
    lotteryCode: overrides.lotteryCode ?? "bolshaya-8",
    drawId: overrides.drawId ?? "d-1",
    purchasedAt: overrides.purchasedAt ?? "2026-04-10T10:00:00.000Z",
    externalReference: overrides.externalReference ?? "ext-1",
    purchaseStatus: overrides.purchaseStatus ?? "purchased",
    verificationStatus: overrides.verificationStatus ?? "pending",
    verificationRawOutput: overrides.verificationRawOutput ?? null,
    winningAmountMinor: overrides.winningAmountMinor ?? null,
    verifiedAt: overrides.verifiedAt ?? null,
    lastVerificationEventId: overrides.lastVerificationEventId ?? null,
    adminResultMark: overrides.adminResultMark ?? null,
    adminResultMarkedBy: overrides.adminResultMarkedBy ?? null,
    adminResultMarkedAt: overrides.adminResultMarkedAt ?? null,
    resultSource: overrides.resultSource ?? null,
    claimState: overrides.claimState ?? "unclaimed"
  };
}

function createEnv() {
  const tickets: TicketRecord[] = [
    createTicket({ ticketId: "t-1", userId: "user-1", winningAmountMinor: 50_000, claimState: "credited", resultSource: "admin_emulated" }),
    createTicket({ ticketId: "t-2", userId: "user-1", winningAmountMinor: null, claimState: "unclaimed" }),
    createTicket({ ticketId: "t-3", userId: "user-1", winningAmountMinor: 10_000, claimState: "cash_desk_paid", resultSource: "admin_emulated", purchasedAt: "2026-04-15T10:00:00.000Z" }),
    createTicket({ ticketId: "t-4", userId: "user-2", winningAmountMinor: 100_000 })
  ];

  const entries: LedgerEntry[] = [
    { entryId: "e-credit", userId: "user-1", operation: "credit", amountMinor: 100_000, currency: "RUB", idempotencyKey: "idem-1", reference: { requestId: "seed" }, createdAt: "2026-04-01T10:00:00.000Z" },
    { entryId: "e-reserve", userId: "user-1", operation: "reserve", amountMinor: 30_000, currency: "RUB", idempotencyKey: "idem-2", reference: { requestId: "r-1" }, createdAt: "2026-04-05T10:00:00.000Z" },
    { entryId: "e-debit", userId: "user-1", operation: "debit", amountMinor: 20_000, currency: "RUB", idempotencyKey: "idem-3", reference: { requestId: "r-1" }, createdAt: "2026-04-05T10:01:00.000Z" },
    { entryId: "e-debit2", userId: "user-1", operation: "debit", amountMinor: 10_000, currency: "RUB", idempotencyKey: "idem-4", reference: { requestId: "r-2" }, createdAt: "2026-04-06T10:01:00.000Z" }
  ];

  const service = new UserCabinetStatsService({
    ticketStore: {
      listTickets: async () => [...tickets],
      getTicketById: async () => null,
      getTicketByRequestId: async () => null,
      saveTicket: async () => {},
      clearAll: async () => { tickets.length = 0; }
    },
    ledgerStore: {
      listEntries: async () => [...entries],
      listEntriesByUser: async (userId: string) => entries.filter((e) => e.userId === userId),
      appendEntry: async () => {},
      clearAll: async () => { entries.length = 0; }
    },
    requestStore: {
      listRequests: async () => [],
      getRequestById: async () => null,
      saveRequest: async () => {},
      clearAll: async () => {}
    }
  });

  return { service, tickets, entries };
}

describe("UserCabinetStatsService", () => {
  it("computes cabinet summary with correct aggregates", async () => {
    const { service } = createEnv();
    const summary = await service.getCabinetSummary("user-1", "RUB");

    expect(summary.userId).toBe("user-1");
    expect(summary.totalTickets).toBe(3);
    expect(summary.winningTickets).toBe(2);
    expect(summary.totalWinningsMinor).toBe(60_000);
    expect(summary.totalStakesMinor).toBe(30_000);
    expect(summary.netResultMinor).toBe(30_000);
  });

  it("lists user tickets with lottery filter", async () => {
    const { service } = createEnv();
    const views = await service.getCabinetTickets("user-1", { lottery: "bolshaya-8" });
    expect(views).toHaveLength(3);
  });

  it("filters winning tickets by status", async () => {
    const { service } = createEnv();
    const views = await service.getCabinetTickets("user-1", { status: "winning" });
    expect(views).toHaveLength(2);
  });

  it("filters by period", async () => {
    const { service } = createEnv();
    const views = await service.getCabinetTickets("user-1", { periodFrom: "2026-04-12T00:00:00.000Z" });
    expect(views).toHaveLength(1);
    expect(views[0]?.ticketId).toBe("t-3");
  });

  it("returns empty for unknown user", async () => {
    const { service } = createEnv();
    const summary = await service.getCabinetSummary("unknown", "RUB");
    expect(summary.totalTickets).toBe(0);
    expect(summary.availableMinor).toBe(0);
  });

  it("uses ticket query service so canonical-only tickets appear in cabinet summary", async () => {
    const canonicalTicketQueryService = new TicketQueryService({
      ticketStore: {
        listTickets: async () => [],
        getTicketById: async () => null,
        getTicketByRequestId: async () => null,
        saveTicket: async () => {},
        clearAll: async () => {}
      },
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([
        createVisibleWinningCanonicalPurchase({
          purchaseId: "purchase-2001",
          legacyRequestId: "req-2001",
          userId: "user-1",
          drawId: "draw-2001",
          settledAt: "2026-04-20T10:00:00.000Z"
        })
      ])
    });
    const { entries } = createEnv();
    const service = new UserCabinetStatsService({
      ticketStore: {
        listTickets: async () => [],
        getTicketById: async () => null,
        getTicketByRequestId: async () => null,
        saveTicket: async () => {},
        clearAll: async () => {}
      },
      ledgerStore: {
        listEntries: async () => [...entries],
        listEntriesByUser: async (userId: string) => entries.filter((entry) => entry.userId === userId),
        appendEntry: async () => {},
        clearAll: async () => {}
      },
      requestStore: {
        listRequests: async () => [],
        getRequestById: async () => null,
        saveRequest: async () => {},
        clearAll: async () => {}
      },
      ticketQueryService: canonicalTicketQueryService
    });

    const [summary, tickets] = await Promise.all([
      service.getCabinetSummary("user-1", "RUB"),
      service.getCabinetTickets("user-1", { status: "winning" })
    ]);

    expect(summary.totalTickets).toBe(1);
    expect(summary.winningTickets).toBe(1);
    expect(summary.totalWinningsMinor).toBe(ADMIN_EMULATED_WIN_AMOUNT_MINOR);
    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "canonical:purchase-2001",
        requestId: "req-2001",
        winningAmountMinor: ADMIN_EMULATED_WIN_AMOUNT_MINOR
      })
    ]);
  });
});

function createVisibleWinningCanonicalPurchase(input: {
  readonly purchaseId: string;
  readonly legacyRequestId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly settledAt: string;
}): CanonicalPurchaseRecord {
  const purchased = appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId: input.purchaseId,
          legacyRequestId: input.legacyRequestId,
          userId: input.userId,
          lotteryCode: "bolshaya-8",
          drawId: input.drawId,
          payload: { draw_count: 1 },
          costMinor: 100,
          currency: "RUB",
          submittedAt: "2026-04-20T09:50:00.000Z"
        }),
        "queued",
        {
          eventId: `${input.purchaseId}:queued`,
          occurredAt: "2026-04-20T09:51:00.000Z"
        }
      ),
      "processing",
      {
        eventId: `${input.purchaseId}:processing`,
        occurredAt: "2026-04-20T09:52:00.000Z"
      }
    ),
    "purchased",
    {
      eventId: `${input.purchaseId}:purchased`,
      occurredAt: "2026-04-20T09:53:00.000Z",
      externalTicketReference: `ext-${input.purchaseId}`
    }
  );
  const awaitingDrawClose = appendCanonicalPurchaseTransition(purchased, "awaiting_draw_close", {
    eventId: `${input.purchaseId}:awaiting-draw-close`,
    occurredAt: "2026-04-20T09:54:00.000Z"
  });
  const settled = appendCanonicalPurchaseTransition(
    applyCanonicalPurchaseResult(awaitingDrawClose, {
      eventId: `${input.purchaseId}:result`,
      occurredAt: input.settledAt,
      resultStatus: "win"
    }),
    "settled",
    {
      eventId: `${input.purchaseId}:settled`,
      occurredAt: input.settledAt
    }
  );

  return setCanonicalPurchaseResultVisibility(settled, {
    eventId: `${input.purchaseId}:visible`,
    occurredAt: input.settledAt,
    resultVisibility: "visible"
  });
}

class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  constructor(private readonly purchases: readonly CanonicalPurchaseRecord[]) {}

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.purchases.map(cloneCanonicalPurchaseRecord);
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const purchase = this.purchases.find((entry) => entry.snapshot.purchaseId === purchaseId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const purchase = this.purchases.find((entry) => entry.snapshot.legacyRequestId === legacyRequestId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async savePurchase(): Promise<void> {
    throw new Error("read-only test double");
  }

  async clearAll(): Promise<void> {}
}

function cloneCanonicalPurchaseRecord(record: CanonicalPurchaseRecord): CanonicalPurchaseRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    status: record.status,
    resultStatus: record.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}
