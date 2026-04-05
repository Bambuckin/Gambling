import { describe, expect, it } from "vitest";
import { createPurchasedTicketRecord, TicketValidationError } from "../ticket.js";

describe("createPurchasedTicketRecord", () => {
  it("creates purchased ticket with pending verification defaults", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-900:ticket",
      requestId: "req-900",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-900",
      purchasedAt: "2026-04-05T23:00:00.000Z",
      externalReference: "demo-ext-900"
    });

    expect(ticket).toEqual({
      ticketId: "req-900:ticket",
      requestId: "req-900",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-900",
      purchasedAt: "2026-04-05T23:00:00.000Z",
      externalReference: "demo-ext-900",
      purchaseStatus: "purchased",
      verificationStatus: "pending",
      verificationRawOutput: null,
      winningAmountMinor: null,
      verifiedAt: null
    });
  });

  it("falls back to deterministic external reference when not provided", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-901:ticket",
      requestId: "req-901",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-901",
      purchasedAt: "2026-04-05T23:00:01.000Z",
      externalReference: "   "
    });

    expect(ticket.externalReference).toBe("demo-lottery-req-901");
  });

  it("rejects invalid ticket input", () => {
    expect(() =>
      createPurchasedTicketRecord({
        ticketId: "req-902:ticket",
        requestId: "req-902",
        userId: " ",
        lotteryCode: "demo-lottery",
        drawId: "draw-902",
        purchasedAt: "2026-04-05T23:00:02.000Z"
      })
    ).toThrow(TicketValidationError);

    expect(() =>
      createPurchasedTicketRecord({
        ticketId: "req-903:ticket",
        requestId: "req-903",
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-903",
        purchasedAt: "not-iso"
      })
    ).toThrow(TicketValidationError);
  });
});
