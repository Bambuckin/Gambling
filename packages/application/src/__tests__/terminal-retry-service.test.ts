import { describe, expect, it } from "vitest";
import { TerminalRetryService } from "../services/terminal-retry-service.js";

describe("TerminalRetryService", () => {
  it("keeps success state untouched", () => {
    const service = new TerminalRetryService({
      maxAttempts: 3
    });

    expect(
      service.resolveNextState({
        attempt: 1,
        candidateState: "success",
        rawOutput: "[terminal] success"
      })
    ).toBe("success");
  });

  it("returns retrying for transient retryable failure when attempts remain", () => {
    const service = new TerminalRetryService({
      maxAttempts: 3
    });

    expect(
      service.resolveNextState({
        attempt: 1,
        candidateState: "retrying",
        rawOutput: "[terminal] timeout retryable"
      })
    ).toBe("retrying");
  });

  it("returns error when retry attempts are exhausted", () => {
    const service = new TerminalRetryService({
      maxAttempts: 2
    });

    expect(
      service.resolveNextState({
        attempt: 2,
        candidateState: "retrying",
        rawOutput: "[terminal] timeout retryable"
      })
    ).toBe("error");
  });

  it("returns error for terminal/permanent failure", () => {
    const service = new TerminalRetryService({
      maxAttempts: 5
    });

    expect(
      service.resolveNextState({
        attempt: 1,
        candidateState: "retrying",
        rawOutput: "[terminal] permanent terminal fault"
      })
    ).toBe("error");
  });
});
