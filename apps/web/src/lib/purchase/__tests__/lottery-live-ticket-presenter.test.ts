import { describe, expect, it } from "vitest";
import { presentLotteryLiveTicket } from "../lottery-live-ticket-presenter";

describe("presentLotteryLiveTicket", () => {
  it("shows a purchased pending ticket without exposing raw pending state", () => {
    expect(
      presentLotteryLiveTicket({
        ticketId: "ticket-1",
        requestId: "req-1",
        drawId: "draw-1",
        verificationStatus: "pending",
        winningAmountMinor: null,
        claimState: "unclaimed"
      })
    ).toMatchObject({
      statusLabel: "Билет куплен",
      outcomeLabel: "Ждёт закрытия тиража",
      claimStateLabel: "Нет выплаты",
      canFulfill: false
    });
  });

  it("maps verified winning tickets to payout actions", () => {
    const ticket = presentLotteryLiveTicket({
      ticketId: "ticket-2",
      requestId: "req-2",
      drawId: "draw-1",
      verificationStatus: "verified",
      winningAmountMinor: 50_000,
      claimState: "unclaimed"
    });

    expect(ticket).toMatchObject({
      statusLabel: "Проверен",
      claimStateLabel: "Доступно зачисление",
      canFulfill: true
    });
    expect(ticket.outcomeLabel).toContain("500,00");
  });

  it("uses safe fallback labels for unknown ticket states", () => {
    expect(
      presentLotteryLiveTicket({
        ticketId: "ticket-3",
        requestId: "req-3",
        drawId: "draw-1",
        verificationStatus: "raw_backend_state",
        winningAmountMinor: 100,
        claimState: "raw_claim_state"
      })
    ).toMatchObject({
      statusLabel: "Статус уточняется",
      outcomeLabel: "Итог уточняется",
      claimStateLabel: "Нет выплаты",
      canFulfill: false
    });
  });

  it("uses safe fallback labels for unknown payout states on winning tickets", () => {
    expect(
      presentLotteryLiveTicket({
        ticketId: "ticket-4",
        requestId: "req-4",
        drawId: "draw-1",
        verificationStatus: "verified",
        winningAmountMinor: 100,
        claimState: "raw_claim_state"
      })
    ).toMatchObject({
      statusLabel: "Проверен",
      claimStateLabel: "Статус выплаты уточняется",
      canFulfill: false
    });
  });
});
