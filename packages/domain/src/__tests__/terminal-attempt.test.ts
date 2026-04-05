import { describe, expect, it } from "vitest";
import {
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
