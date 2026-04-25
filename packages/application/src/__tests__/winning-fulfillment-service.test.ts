import {
  ADMIN_EMULATED_WIN_AMOUNT_MINOR,
  appendCanonicalPurchaseTransition,
  applyCanonicalPurchaseResult,
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
import { CashDeskService } from "../services/cash-desk-service.js";
import { TicketClaimService } from "../services/ticket-claim-service.js";
import type { WalletLedgerService } from "../services/wallet-ledger-service.js";
import { WinningFulfillmentService, WinningFulfillmentServiceError } from "../services/winning-fulfillment-service.js";
import { WinningsCreditService } from "../services/winnings-credit-service.js";

describe("WinningFulfillmentService", () => {
  it("enqueues credit for a visible canonical win even without a legacy ticket row", async () => {
    const stores = createStores({
      purchases: [
        createVisibleWinningPurchase({
          purchaseId: "purchase-920",
          requestId: "req-920",
          userId: "seed-user"
        })
      ]
    });
    const service = createService(stores);

    const job = await service.enqueueCreditForRequest({
      requestId: "req-920",
      userId: "seed-user"
    });

    expect(job).toMatchObject({
      requestId: "req-920",
      purchaseId: "purchase-920",
      ticketId: "canonical:purchase-920",
      winningAmountMinor: ADMIN_EMULATED_WIN_AMOUNT_MINOR
    });
  });

  it("keeps credit and cash desk mutually exclusive", async () => {
    const stores = createStores({
      purchases: [
        createVisibleWinningPurchase({
          purchaseId: "purchase-921",
          requestId: "req-921",
          userId: "seed-user"
        })
      ]
    });
    const service = createService(stores);

    await service.enqueueCreditForRequest({
      requestId: "req-921",
      userId: "seed-user"
    });

    const action = service.createCashDeskRequestForRequest({
      requestId: "req-921",
      userId: "seed-user"
    });

    await expect(action).rejects.toBeInstanceOf(WinningFulfillmentServiceError);
    await expect(action).rejects.toMatchObject({
      code: "cash_desk_conflict"
    });
  });
});

function createService(stores: {
  readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  readonly ticketStore: TicketStore;
  readonly cashDeskRequestStore: CashDeskRequestStore;
  readonly winningsCreditJobStore: WinningsCreditJobStore;
}): WinningFulfillmentService {
  const ticketClaimService = new TicketClaimService({ ticketStore: stores.ticketStore });
  return new WinningFulfillmentService({
    canonicalPurchaseStore: stores.canonicalPurchaseStore,
    ticketStore: stores.ticketStore,
    cashDeskRequestStore: stores.cashDeskRequestStore,
    winningsCreditJobStore: stores.winningsCreditJobStore,
    cashDeskService: new CashDeskService({
      cashDeskRequestStore: stores.cashDeskRequestStore,
      ticketClaimService
    }),
    winningsCreditService: new WinningsCreditService({
      winningsCreditJobStore: stores.winningsCreditJobStore,
      ticketStore: stores.ticketStore,
      ticketClaimService,
      walletLedgerService: createNoopWalletLedgerService(),
      timeSource: {
        nowIso: () => "2026-04-21T09:10:00.000Z"
      }
    })
  });
}

function createStores(input: {
  readonly purchases: readonly CanonicalPurchaseRecord[];
}): {
  readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  readonly ticketStore: TicketStore;
  readonly cashDeskRequestStore: CashDeskRequestStore;
  readonly winningsCreditJobStore: WinningsCreditJobStore;
} {
  return {
    canonicalPurchaseStore: new InMemoryCanonicalPurchaseStore(input.purchases),
    ticketStore: new InMemoryTicketStore([]),
    cashDeskRequestStore: new InMemoryCashDeskRequestStore(),
    winningsCreditJobStore: new InMemoryWinningsCreditJobStore()
  };
}

function createVisibleWinningPurchase(input: {
  readonly purchaseId: string;
  readonly requestId: string;
  readonly userId: string;
}): CanonicalPurchaseRecord {
  const purchased = appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId: input.purchaseId,
          legacyRequestId: input.requestId,
          userId: input.userId,
          lotteryCode: "demo-lottery",
          drawId: "draw-920",
          payload: { draw_count: 1 },
          costMinor: 100,
          currency: "RUB",
          submittedAt: "2026-04-21T08:50:00.000Z"
        }),
        "queued",
        {
          eventId: `${input.purchaseId}:queued`,
          occurredAt: "2026-04-21T08:51:00.000Z"
        }
      ),
      "processing",
      {
        eventId: `${input.purchaseId}:processing`,
        occurredAt: "2026-04-21T08:52:00.000Z"
      }
    ),
    "purchased",
    {
      eventId: `${input.purchaseId}:purchased`,
      occurredAt: "2026-04-21T08:53:00.000Z",
      externalTicketReference: `ext-${input.purchaseId}`
    }
  );
  const awaitingDrawClose = appendCanonicalPurchaseTransition(purchased, "awaiting_draw_close", {
    eventId: `${input.purchaseId}:awaiting-draw-close`,
    occurredAt: "2026-04-21T08:54:00.000Z"
  });
  const settled = appendCanonicalPurchaseTransition(awaitingDrawClose, "settled", {
    eventId: `${input.purchaseId}:settled`,
    occurredAt: "2026-04-21T08:55:00.000Z"
  });
  const resolved = applyCanonicalPurchaseResult(settled, {
    eventId: `${input.purchaseId}:result`,
    occurredAt: "2026-04-21T08:55:00.000Z",
    resultStatus: "win"
  });

  return setCanonicalPurchaseResultVisibility(resolved, {
    eventId: `${input.purchaseId}:visible`,
    occurredAt: "2026-04-21T08:55:00.000Z",
    resultVisibility: "visible"
  });
}

function createNoopWalletLedgerService(): Pick<WalletLedgerService, "creditWinnings"> {
  return {
    async creditWinnings() {
      return {
        replayed: false,
        entry: {
          entryId: "ledger-noop",
          userId: "seed-user",
          operation: "credit",
          amountMinor: ADMIN_EMULATED_WIN_AMOUNT_MINOR,
          currency: "RUB",
          idempotencyKey: "noop:winnings",
          reference: {
            purchaseId: "purchase-noop",
            requestId: "req-noop",
            ticketId: "canonical:purchase-noop"
          },
          createdAt: "2026-04-21T09:10:00.000Z"
        },
        snapshot: {
          userId: "seed-user",
          availableMinor: ADMIN_EMULATED_WIN_AMOUNT_MINOR,
          reservedMinor: 0,
          currency: "RUB"
        }
      };
    }
  };
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

class InMemoryTicketStore implements TicketStore {
  constructor(private readonly tickets: readonly TicketRecord[]) {}

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map((ticket) => ({ ...ticket }));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    return this.tickets.find((ticket) => ticket.ticketId === ticketId) ?? null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    return this.tickets.find((ticket) => ticket.requestId === requestId) ?? null;
  }

  async saveTicket(): Promise<void> {
    throw new Error("unexpected save in test");
  }

  async clearAll(): Promise<void> {}
}

class InMemoryCashDeskRequestStore implements CashDeskRequestStore {
  private requests: CashDeskRequest[] = [];

  async saveCashDeskRequest(request: CashDeskRequest): Promise<void> {
    this.requests = [...this.requests.filter((entry) => entry.cashDeskRequestId !== request.cashDeskRequestId), { ...request }];
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

  async clearAll(): Promise<void> {
    this.requests = [];
  }
}

class InMemoryWinningsCreditJobStore implements WinningsCreditJobStore {
  private jobs: WinningsCreditJob[] = [];

  async saveJob(job: WinningsCreditJob): Promise<void> {
    this.jobs = [...this.jobs.filter((entry) => entry.jobId !== job.jobId), { ...job }];
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

  async clearAll(): Promise<void> {
    this.jobs = [];
  }
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
