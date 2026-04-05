import { applyTicketVerificationOutcome, createPurchasedTicketRecord, type TicketRecord } from "@lottery/domain";
import { describe, expect, it } from "vitest";
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
});

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
}
