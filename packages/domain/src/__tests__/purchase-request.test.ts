import { describe, expect, it } from "vitest";
import {
  CanonicalPurchaseValidationError,
  PurchaseRequestValidationError,
  appendCanonicalPurchaseTransition,
  appendPurchaseRequestTransition,
  applyCanonicalPurchaseResult,
  createAwaitingConfirmationRequest,
  createSubmittedCanonicalPurchase,
  setCanonicalPurchaseResultVisibility
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

describe("canonical purchase contract", () => {
  it("keeps result state and visibility separate from purchase execution state", () => {
    let record = createSubmittedCanonicalPurchase({
      purchaseId: "purchase-100",
      legacyRequestId: "req-legacy-100",
      userId: "seed-user",
      lotteryCode: "DEMO-LOTTERY",
      drawId: "draw-999",
      payload: {
        draw_count: 1
      },
      costMinor: 400,
      currency: "rub",
      submittedAt: "2026-04-19T10:00:00.000Z"
    });

    record = appendCanonicalPurchaseTransition(record, "queued", {
      eventId: "purchase-100:queued",
      occurredAt: "2026-04-19T10:01:00.000Z"
    });
    record = appendCanonicalPurchaseTransition(record, "processing", {
      eventId: "purchase-100:processing",
      occurredAt: "2026-04-19T10:02:00.000Z"
    });
    record = appendCanonicalPurchaseTransition(record, "purchased", {
      eventId: "purchase-100:purchased",
      occurredAt: "2026-04-19T10:03:00.000Z",
      externalTicketReference: "ticket-ext-100"
    });
    record = appendCanonicalPurchaseTransition(record, "awaiting_draw_close", {
      eventId: "purchase-100:awaiting-draw-close",
      occurredAt: "2026-04-19T10:04:00.000Z"
    });
    record = applyCanonicalPurchaseResult(record, {
      eventId: "purchase-100:result",
      occurredAt: "2026-04-19T10:05:00.000Z",
      resultStatus: "win"
    });
    record = appendCanonicalPurchaseTransition(record, "settled", {
      eventId: "purchase-100:settled",
      occurredAt: "2026-04-19T10:06:00.000Z"
    });
    record = setCanonicalPurchaseResultVisibility(record, {
      eventId: "purchase-100:visible",
      occurredAt: "2026-04-19T10:07:00.000Z",
      resultVisibility: "visible"
    });

    expect(record.status).toBe("settled");
    expect(record.resultStatus).toBe("win");
    expect(record.resultVisibility).toBe("visible");
    expect(record.snapshot.legacyRequestId).toBe("req-legacy-100");
    expect(record.purchasedAt).toBe("2026-04-19T10:03:00.000Z");
    expect(record.settledAt).toBe("2026-04-19T10:06:00.000Z");
    expect(record.externalTicketReference).toBe("ticket-ext-100");
  });

  it("rejects publishing result visibility before settlement", () => {
    const record = createSubmittedCanonicalPurchase({
      purchaseId: "purchase-101",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-1000",
      payload: {
        draw_count: 1
      },
      costMinor: 400,
      currency: "RUB",
      submittedAt: "2026-04-19T10:00:00.000Z"
    });

    expect(() =>
      setCanonicalPurchaseResultVisibility(record, {
        eventId: "purchase-101:visible",
        occurredAt: "2026-04-19T10:01:00.000Z",
        resultVisibility: "visible"
      })
    ).toThrow(CanonicalPurchaseValidationError);
  });
});
