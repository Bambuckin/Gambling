import { describe, expect, it } from "vitest";
import { UserCabinetStatsService } from "../services/user-cabinet-stats-service.js";
import type { TicketRecord } from "@lottery/domain";
import type { LedgerEntry } from "@lottery/domain";

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
});
