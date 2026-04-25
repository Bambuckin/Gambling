import {
  appendCanonicalPurchaseTransition,
  applyCanonicalPurchaseResult,
  createCashDeskRequest,
  createWinningsCreditJob,
  completeWinningsCreditJob,
  startWinningsCreditJob,
  applyTicketVerificationOutcome,
  createPurchasedTicketRecord,
  createSubmittedCanonicalPurchase,
  setCanonicalPurchaseResultVisibility,
  type CashDeskRequest,
  type CanonicalPurchaseRecord,
  type TicketRecord,
  type WinningsCreditJob
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { CashDeskRequestStore } from "../ports/cash-desk-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { WinningsCreditJobStore } from "../ports/winnings-credit-job-store.js";
import { TicketQueryService } from "../services/ticket-query-service.js";

describe("TicketQueryService", () => {
  it("returns empty array when user has no tickets", async () => {
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([])
    });

    const tickets = await service.listUserTickets("seed-user");
    expect(tickets).toEqual([]);
  });

  it("lists user tickets ordered by latest verification/purchase timestamp", async () => {
    const pending = createPurchasedTicketRecord({
      ticketId: "req-991:ticket",
      requestId: "req-991",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-991",
      purchasedAt: "2026-04-06T02:00:00.000Z",
      externalReference: "ext-991"
    });
    const verified = applyTicketVerificationOutcome(
      createPurchasedTicketRecord({
        ticketId: "req-992:ticket",
        requestId: "req-992",
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-992",
        purchasedAt: "2026-04-06T02:01:00.000Z",
        externalReference: "ext-992"
      }),
      {
        verificationStatus: "verified",
        verificationEventId: "req-992:verify:1",
        verifiedAt: "2026-04-06T02:10:00.000Z",
        rawTerminalOutput: "[result] win",
        winningAmountMinor: 500
      }
    );

    const otherUserTicket = createPurchasedTicketRecord({
      ticketId: "req-993:ticket",
      requestId: "req-993",
      userId: "seed-other",
      lotteryCode: "demo-lottery",
      drawId: "draw-993",
      purchasedAt: "2026-04-06T02:02:00.000Z",
      externalReference: "ext-993"
    });

    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([pending, verified, otherUserTicket])
    });

    const tickets = await service.listUserTickets("seed-user");

    expect(tickets).toHaveLength(2);
    expect(tickets.map((ticket) => ticket.ticketId)).toEqual(["req-992:ticket", "req-991:ticket"]);
    expect(tickets[0]).toMatchObject({
      drawId: "draw-992",
      verificationStatus: "verified",
      winningAmountMinor: 500,
      verifiedAt: "2026-04-06T02:10:00.000Z",
      externalReference: "ext-992"
    });
  });

  it("projects synthetic ticket rows for canonical purchases without legacy tickets", async () => {
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([]),
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([
        createCanonicalPurchasedRecord({
          purchaseId: "purchase-994",
          legacyRequestId: "req-994",
          userId: "seed-user",
          purchasedAt: "2026-04-06T02:12:00.000Z"
        })
      ])
    });

    const tickets = await service.listUserTickets("seed-user");

    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "canonical:purchase-994",
        requestId: "req-994",
        verificationStatus: "pending",
        verifiedAt: null,
        externalReference: "ext-purchase-994"
      })
    ]);
  });

  it("uses settled canonical purchases as verified compatibility tickets", async () => {
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([]),
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([
        createCanonicalSettledRecord({
          purchaseId: "purchase-995",
          legacyRequestId: "req-995",
          userId: "seed-user",
          settledAt: "2026-04-06T02:20:00.000Z"
        })
      ])
    });

    const tickets = await service.listAllTickets();

    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "canonical:purchase-995",
        requestId: "req-995",
        verificationStatus: "verified",
        verifiedAt: "2026-04-06T02:20:00.000Z"
      })
    ]);
  });

  it("hides legacy verified result until canonical settlement is published", async () => {
    const legacyVerified = applyTicketVerificationOutcome(
      createPurchasedTicketRecord({
        ticketId: "req-996:ticket",
        requestId: "req-996",
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-996",
        purchasedAt: "2026-04-06T02:00:00.000Z",
        externalReference: "ext-996"
      }),
      {
        verificationStatus: "verified",
        verificationEventId: "req-996:verify:1",
        verifiedAt: "2026-04-06T02:10:00.000Z",
        rawTerminalOutput: "[result] win",
        winningAmountMinor: 500
      }
    );
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([legacyVerified]),
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([
        createCanonicalHiddenResultRecord({
          purchaseId: "purchase-996",
          legacyRequestId: "req-996",
          userId: "seed-user",
          drawId: "draw-996",
          resultStatus: "win"
        })
      ])
    });

    const tickets = await service.listAllTickets();

    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "req-996:ticket",
        verificationStatus: "pending",
        adminResultMark: "win",
        winningAmountMinor: null,
        verifiedAt: null,
        resultSource: null
      })
    ]);
  });

  it("overlays canonical published result on top of legacy pending ticket", async () => {
    const legacyPending = createPurchasedTicketRecord({
      ticketId: "req-997:ticket",
      requestId: "req-997",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-997",
      purchasedAt: "2026-04-06T02:00:00.000Z",
      externalReference: "ext-997"
    });
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([legacyPending]),
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([
        createCanonicalVisibleResultRecord({
          purchaseId: "purchase-997",
          legacyRequestId: "req-997",
          userId: "seed-user",
          drawId: "draw-997",
          resultStatus: "lose",
          settledAt: "2026-04-06T02:20:00.000Z"
        })
      ])
    });

    const tickets = await service.listAllTickets();

    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "req-997:ticket",
        verificationStatus: "verified",
        adminResultMark: "lose",
        winningAmountMinor: 0,
        verifiedAt: "2026-04-06T02:20:00.000Z",
        resultSource: "admin_emulated"
      })
    ]);
  });

  it("projects fulfillment claim state from cash desk requests for canonical-only tickets", async () => {
    const purchase = createCanonicalVisibleResultRecord({
      purchaseId: "purchase-998",
      legacyRequestId: "req-998",
      userId: "seed-user",
      drawId: "draw-998",
      resultStatus: "win",
      settledAt: "2026-04-06T02:20:00.000Z"
    });
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([]),
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([purchase]),
      cashDeskRequestStore: new InMemoryCashDeskRequestStore([
        createCashDeskRequest({
          cashDeskRequestId: "canonical:purchase-998:cash-desk",
          requestId: "req-998",
          purchaseId: "purchase-998",
          ticketId: "canonical:purchase-998",
          userId: "seed-user",
          lotteryCode: "demo-lottery",
          drawId: "draw-998",
          winningAmountMinor: 50_000,
          currency: "RUB",
          createdAt: "2026-04-06T02:21:00.000Z"
        })
      ])
    });

    const tickets = await service.listUserTickets("seed-user");

    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "canonical:purchase-998",
        claimState: "cash_desk_pending"
      })
    ]);
  });

  it("projects credited state from winnings credit jobs onto legacy compatibility tickets", async () => {
    const legacyPending = createPurchasedTicketRecord({
      ticketId: "req-999:ticket",
      requestId: "req-999",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-999",
      purchasedAt: "2026-04-06T02:00:00.000Z",
      externalReference: "ext-999"
    });
    const creditedJob = completeWinningsCreditJob(
      startWinningsCreditJob(
        createWinningsCreditJob({
          jobId: "purchase-999:credit",
          requestId: "req-999",
          purchaseId: "purchase-999",
          ticketId: "req-999:ticket",
          userId: "seed-user",
          drawId: "draw-999",
          winningAmountMinor: 50_000,
          currency: "RUB",
          createdAt: "2026-04-06T02:21:00.000Z"
        })
      ),
      "2026-04-06T02:22:00.000Z"
    );
    const service = new TicketQueryService({
      ticketStore: new InMemoryTicketStore([legacyPending]),
      canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore([
        createCanonicalVisibleResultRecord({
          purchaseId: "purchase-999",
          legacyRequestId: "req-999",
          userId: "seed-user",
          drawId: "draw-999",
          resultStatus: "win",
          settledAt: "2026-04-06T02:20:00.000Z"
        })
      ]),
      winningsCreditJobStore: new InMemoryWinningsCreditJobStore([creditedJob])
    });

    const tickets = await service.listAllTickets();

    expect(tickets).toEqual([
      expect.objectContaining({
        ticketId: "req-999:ticket",
        claimState: "credited"
      })
    ]);
  });
});

function createCanonicalPurchasedRecord(input: {
  readonly purchaseId: string;
  readonly legacyRequestId: string;
  readonly userId: string;
  readonly purchasedAt: string;
}): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId: input.purchaseId,
          legacyRequestId: input.legacyRequestId,
          userId: input.userId,
          lotteryCode: "demo-lottery",
          drawId: "draw-994",
          payload: { draw_count: 1 },
          costMinor: 100,
          currency: "RUB",
          submittedAt: "2026-04-06T02:10:00.000Z"
        }),
        "queued",
        {
          eventId: `${input.purchaseId}:queued`,
          occurredAt: "2026-04-06T02:10:30.000Z"
        }
      ),
      "processing",
      {
        eventId: `${input.purchaseId}:processing`,
        occurredAt: "2026-04-06T02:11:00.000Z"
      }
    ),
    "purchased",
    {
      eventId: `${input.purchaseId}:purchased`,
      occurredAt: input.purchasedAt,
      externalTicketReference: `ext-${input.purchaseId}`
    }
  );
}

function createCanonicalSettledRecord(input: {
  readonly purchaseId: string;
  readonly legacyRequestId: string;
  readonly userId: string;
  readonly settledAt: string;
}): CanonicalPurchaseRecord {
  const purchased = createCanonicalPurchasedRecord({
    purchaseId: input.purchaseId,
    legacyRequestId: input.legacyRequestId,
    userId: input.userId,
    purchasedAt: "2026-04-06T02:15:00.000Z"
  });
  const awaitingDrawClose = appendCanonicalPurchaseTransition(purchased, "awaiting_draw_close", {
    eventId: `${input.purchaseId}:awaiting-draw-close`,
    occurredAt: "2026-04-06T02:16:00.000Z"
  });
  const settled = appendCanonicalPurchaseTransition(awaitingDrawClose, "settled", {
    eventId: `${input.purchaseId}:settled`,
    occurredAt: input.settledAt
  });
  const resolved = applyCanonicalPurchaseResult(settled, {
    eventId: `${input.purchaseId}:result`,
    occurredAt: input.settledAt,
    resultStatus: "lose"
  });

  return setCanonicalPurchaseResultVisibility(resolved, {
    eventId: `${input.purchaseId}:visible`,
    occurredAt: input.settledAt,
    resultVisibility: "visible"
  });
}

function createCanonicalHiddenResultRecord(input: {
  readonly purchaseId: string;
  readonly legacyRequestId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly resultStatus: "win" | "lose";
}): CanonicalPurchaseRecord {
  const purchased = createCanonicalPurchasedRecord({
    purchaseId: input.purchaseId,
    legacyRequestId: input.legacyRequestId,
    userId: input.userId,
    purchasedAt: "2026-04-06T02:15:00.000Z"
  });
  const awaitingDrawClose = appendCanonicalPurchaseTransition(
    {
      ...purchased,
      snapshot: {
        ...purchased.snapshot,
        drawId: input.drawId
      }
    },
    "awaiting_draw_close",
    {
      eventId: `${input.purchaseId}:awaiting-draw-close`,
      occurredAt: "2026-04-06T02:16:00.000Z"
    }
  );

  return applyCanonicalPurchaseResult(awaitingDrawClose, {
    eventId: `${input.purchaseId}:result`,
    occurredAt: "2026-04-06T02:17:00.000Z",
    resultStatus: input.resultStatus
  });
}

function createCanonicalVisibleResultRecord(input: {
  readonly purchaseId: string;
  readonly legacyRequestId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly resultStatus: "win" | "lose";
  readonly settledAt: string;
}): CanonicalPurchaseRecord {
  const hidden = createCanonicalHiddenResultRecord(input);
  const settled = appendCanonicalPurchaseTransition(hidden, "settled", {
    eventId: `${input.purchaseId}:settled`,
    occurredAt: input.settledAt
  });

  return setCanonicalPurchaseResultVisibility(settled, {
    eventId: `${input.purchaseId}:visible`,
    occurredAt: input.settledAt,
    resultVisibility: "visible"
  });
}

class InMemoryTicketStore implements TicketStore {
  private readonly tickets: TicketRecord[];

  constructor(tickets: readonly TicketRecord[]) {
    this.tickets = tickets.map((ticket) => ({ ...ticket }));
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map((ticket) => ({ ...ticket }));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async saveTicket(): Promise<void> {
    throw new Error("read-only test double");
  }

  async clearAll(): Promise<void> {}
}

class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private readonly purchases: CanonicalPurchaseRecord[];

  constructor(purchases: readonly CanonicalPurchaseRecord[]) {
    this.purchases = purchases.map(cloneCanonicalPurchaseRecord);
  }

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

class InMemoryCashDeskRequestStore implements CashDeskRequestStore {
  constructor(private readonly requests: readonly CashDeskRequest[]) {}

  async saveCashDeskRequest(): Promise<void> {
    throw new Error("read-only test double");
  }

  async getCashDeskRequestById(cashDeskRequestId: string): Promise<CashDeskRequest | null> {
    return this.requests.find((entry) => entry.cashDeskRequestId === cashDeskRequestId) ?? null;
  }

  async getCashDeskRequestByTicketId(ticketId: string): Promise<CashDeskRequest | null> {
    return this.requests.find((entry) => entry.ticketId === ticketId) ?? null;
  }

  async listCashDeskRequests(): Promise<readonly CashDeskRequest[]> {
    return this.requests.map((request) => ({ ...request }));
  }

  async clearAll(): Promise<void> {}
}

class InMemoryWinningsCreditJobStore implements WinningsCreditJobStore {
  constructor(private readonly jobs: readonly WinningsCreditJob[]) {}

  async saveJob(): Promise<void> {
    throw new Error("read-only test double");
  }

  async getJobByTicketId(ticketId: string): Promise<WinningsCreditJob | null> {
    return this.jobs.find((entry) => entry.ticketId === ticketId) ?? null;
  }

  async listJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.jobs.map((job) => ({ ...job }));
  }

  async listQueuedJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.jobs.filter((job) => job.status === "queued").map((job) => ({ ...job }));
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
