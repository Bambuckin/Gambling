import {
  appendCanonicalPurchaseTransition,
  applyCanonicalPurchaseResult,
  applyTicketVerificationOutcome,
  createPurchasedTicketRecord,
  createSubmittedCanonicalPurchase,
  setCanonicalPurchaseResultVisibility,
  type CanonicalPurchaseRecord,
  type TicketRecord
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
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
