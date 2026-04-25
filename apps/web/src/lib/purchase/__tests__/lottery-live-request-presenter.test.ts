import { describe, expect, it } from "vitest";
import { presentLotteryLiveRequest } from "../lottery-live-request-presenter";

describe("presentLotteryLiveRequest", () => {
  it("collapses canonical and terminal final results into cashier-facing labels", () => {
    expect(
      presentLotteryLiveRequest({
        requestId: "req-win",
        drawId: "1234",
        attemptCount: 1,
        updatedAt: "2026-04-23T07:16:01.694Z",
        status: "success",
        finalResult: "canonical result: win"
      })
    ).toMatchObject({
      statusLabel: "Результат готов",
      resultLabel: "Выигрыш",
      canCancel: false,
      affectsReserve: false
    });

    expect(
      presentLotteryLiveRequest({
        requestId: "req-terminal",
        drawId: "213",
        attemptCount: 1,
        updatedAt: "2026-04-23T07:37:31.403Z",
        status: "success",
        finalResult:
          "terminal_attempt attempt=1 outcome=success finishedAt=2026-04-23T07:37:31.403Z status=ticket_purchased"
      })
    ).toMatchObject({
      statusLabel: "Билет куплен",
      resultLabel: "Билет куплен"
    });
  });

  it("marks active queue states without leaking raw state strings into the view contract", () => {
    expect(
      presentLotteryLiveRequest({
        requestId: "req-queued",
        drawId: "123",
        attemptCount: 2,
        updatedAt: "2026-04-23T07:10:33.468Z",
        status: "retrying",
        finalResult: null
      })
    ).toMatchObject({
      statusLabel: "Повтор покупки",
      resultLabel: "Покупка в процессе",
      canCancel: true,
      affectsReserve: true
    });
  });

  it("shows a bought ticket as waiting for draw close when no result is published yet", () => {
    expect(
      presentLotteryLiveRequest({
        requestId: "req-bought",
        drawId: "draw-1",
        attemptCount: 1,
        updatedAt: "2026-04-23T07:10:33.468Z",
        status: "success",
        finalResult: null
      })
    ).toMatchObject({
      statusLabel: "Билет куплен",
      resultLabel: "Ждёт закрытия тиража"
    });
  });

  it("uses safe fallback text for unknown terminal output instead of exposing raw result strings", () => {
    expect(
      presentLotteryLiveRequest({
        requestId: "req-unknown",
        drawId: "draw-1",
        attemptCount: 1,
        updatedAt: "2026-04-23T07:10:33.468Z",
        status: "error",
        finalResult: "terminal_attempt attempt=1 outcome=unexpected raw tail"
      })
    ).toMatchObject({
      statusLabel: "Покупка не прошла",
      resultLabel: "Итог уточняется"
    });
  });
});
