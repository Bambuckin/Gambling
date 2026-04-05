import { describe, expect, it } from "vitest";
import {
  PurchaseRequestValidationError,
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest
} from "../purchase-request.js";

describe("purchase request snapshot", () => {
  it("creates awaiting_confirmation snapshot with immutable payload clone and initial journal", () => {
    const payload = {
      draw_count: 2,
      bet_system: "standard"
    } as const;

    const record = createAwaitingConfirmationRequest({
      requestId: "req-100",
      userId: "seed-user",
      lotteryCode: "DEMO-LOTTERY",
      drawId: "draw-777",
      payload,
      costMinor: 300,
      currency: "rub",
      createdAt: "2026-04-05T19:40:00.000Z"
    });

    expect(record.state).toBe("awaiting_confirmation");
    expect(record.snapshot).toMatchObject({
      requestId: "req-100",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-777",
      costMinor: 300,
      currency: "RUB"
    });
    expect(record.journal).toEqual([
      {
        eventId: "req-100:awaiting_confirmation",
        fromState: "created",
        toState: "awaiting_confirmation",
        occurredAt: "2026-04-05T19:40:00.000Z",
        note: "request snapshot persisted"
      }
    ]);

    expect(record.snapshot.payload).not.toBe(payload);
    expect(record.snapshot.payload).toEqual(payload);
  });

  it("appends valid transition and rejects invalid transition", () => {
    const record = createAwaitingConfirmationRequest({
      requestId: "req-101",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-888",
      payload: {
        draw_count: 1
      },
      costMinor: 100,
      currency: "RUB",
      createdAt: "2026-04-05T19:41:00.000Z"
    });

    const confirmed = appendPurchaseRequestTransition(record, "confirmed", {
      eventId: "req-101:confirmed",
      occurredAt: "2026-04-05T19:41:30.000Z"
    });
    expect(confirmed.state).toBe("confirmed");
    expect(confirmed.journal).toHaveLength(2);
    expect(confirmed.journal[1]).toMatchObject({
      fromState: "awaiting_confirmation",
      toState: "confirmed"
    });

    expect(() =>
      appendPurchaseRequestTransition(record, "executing", {
        eventId: "req-101:executing",
        occurredAt: "2026-04-05T19:42:00.000Z"
      })
    ).toThrow("transition from awaiting_confirmation to executing is not allowed");
  });

  it("rejects invalid snapshot fields", () => {
    expect(() =>
      createAwaitingConfirmationRequest({
        requestId: " ",
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-777",
        payload: {},
        costMinor: 200,
        currency: "RUB",
        createdAt: "2026-04-05T19:40:00.000Z"
      })
    ).toThrow(PurchaseRequestValidationError);
  });
});
