import { describe, expect, it } from "vitest";
import {
  createPurchaseAttemptRecord,
  formatTerminalAttemptJournalNote,
  normalizeTerminalAttempt,
  TerminalAttemptValidationError
} from "../terminal-attempt.js";

describe("normalizeTerminalAttempt", () => {
  it("normalizes attempt metadata and computes duration", () => {
    const normalized = normalizeTerminalAttempt({
      requestId: "req-700",
      attempt: 2,
      outcome: "retrying",
      startedAt: "2026-04-05T22:00:00.000Z",
      finishedAt: "2026-04-05T22:00:01.200Z",
      rawOutput: "[terminal] transient issue"
    });

    expect(normalized).toEqual({
      requestId: "req-700",
      attempt: 2,
      outcome: "retrying",
      startedAt: "2026-04-05T22:00:00.000Z",
      finishedAt: "2026-04-05T22:00:01.200Z",
      rawOutput: "[terminal] transient issue",
      durationMs: 1200
    });
  });

  it("accepts add-to-cart as a valid terminal completion outcome", () => {
    const normalized = normalizeTerminalAttempt({
      requestId: "req-700-cart",
      attempt: 1,
      outcome: "added_to_cart",
      startedAt: "2026-04-05T22:00:00.000Z",
      finishedAt: "2026-04-05T22:00:01.000Z",
      rawOutput: "[terminal] added_to_cart"
    });

    expect(normalized.outcome).toBe("added_to_cart");
  });

  it("rejects invalid attempt metadata", () => {
    expect(() =>
      normalizeTerminalAttempt({
        requestId: "req-701",
        attempt: 0,
        outcome: "success",
        startedAt: "2026-04-05T22:00:02.000Z",
        finishedAt: "2026-04-05T22:00:03.000Z",
        rawOutput: ""
      })
    ).toThrow(TerminalAttemptValidationError);

    expect(() =>
      normalizeTerminalAttempt({
        requestId: "req-701",
        attempt: 1,
        outcome: "error",
        startedAt: "2026-04-05T22:00:04.000Z",
        finishedAt: "2026-04-05T22:00:03.000Z",
        rawOutput: ""
      })
    ).toThrow(TerminalAttemptValidationError);
  });
});

describe("formatTerminalAttemptJournalNote", () => {
  it("includes expected attempt metadata fields in note", () => {
    const note = formatTerminalAttemptJournalNote(
      normalizeTerminalAttempt({
        requestId: "req-702",
        attempt: 1,
        outcome: "success",
        startedAt: "2026-04-05T22:00:00.000Z",
        finishedAt: "2026-04-05T22:00:00.500Z",
        rawOutput: "[terminal] ok"
      })
    );

    expect(note).toContain("attempt=1");
    expect(note).toContain("outcome=success");
    expect(note).toContain("rawOutput=[terminal] ok");
  });
});

describe("createPurchaseAttemptRecord", () => {
  it("creates a durable attempt record separate from legacy journal-note formatting", () => {
    const attempt = createPurchaseAttemptRecord({
      purchaseId: "purchase-500",
      legacyRequestId: "req-500",
      attemptNumber: 3,
      outcome: "success",
      startedAt: "2026-04-19T12:00:00.000Z",
      finishedAt: "2026-04-19T12:00:01.500Z",
      rawOutput: "[terminal] purchase success",
      externalTicketReference: "ext-500"
    });

    expect(attempt).toMatchObject({
      attemptId: "purchase-500:attempt:3",
      purchaseId: "purchase-500",
      legacyRequestId: "req-500",
      attemptNumber: 3,
      outcome: "success",
      durationMs: 1500,
      externalTicketReference: "ext-500"
    });
  });
});
