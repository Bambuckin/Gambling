import { describe, expect, it } from "vitest";
import {
  CanonicalDrawValidationError,
  closeCanonicalDraw,
  createOpenCanonicalDraw,
  isCanonicalDrawResultVisible,
  settleCanonicalDraw
} from "../draw.js";

describe("canonical draw lifecycle", () => {
  it("moves from open to closed to settled and only becomes visible on settlement", () => {
    let record = createOpenCanonicalDraw({
      lotteryCode: "BOLSHAYA-8",
      drawId: "draw-200",
      drawAt: "2026-04-20T08:00:00.000Z",
      openedAt: "2026-04-19T08:00:00.000Z"
    });

    expect(record.status).toBe("open");
    expect(isCanonicalDrawResultVisible(record)).toBe(false);

    record = closeCanonicalDraw(record, {
      closedAt: "2026-04-20T08:01:00.000Z",
      closedBy: "admin-1"
    });
    expect(record.status).toBe("closed");
    expect(isCanonicalDrawResultVisible(record)).toBe(false);

    record = settleCanonicalDraw(record, {
      settledAt: "2026-04-20T08:05:00.000Z",
      settledBy: "admin-1"
    });
    expect(record.status).toBe("settled");
    expect(isCanonicalDrawResultVisible(record)).toBe(true);
  });

  it("rejects settling an open draw without explicit closure first", () => {
    const record = createOpenCanonicalDraw({
      lotteryCode: "bolshaya-8",
      drawId: "draw-201",
      drawAt: "2026-04-20T08:00:00.000Z",
      openedAt: "2026-04-19T08:00:00.000Z"
    });

    expect(() =>
      settleCanonicalDraw(record, {
        settledAt: "2026-04-20T08:05:00.000Z",
        settledBy: "admin-1"
      })
    ).toThrow(CanonicalDrawValidationError);
  });
});
