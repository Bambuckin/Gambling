import { describe, expect, it } from "vitest";
import { decideRetryOutcome, RetryPolicyValidationError } from "../retry-policy.js";

describe("decideRetryOutcome", () => {
  it("returns retry for transient failure when attempts remain", () => {
    const decision = decideRetryOutcome({
      attempt: 1,
      maxAttempts: 3,
      failureClass: "transient"
    });

    expect(decision).toEqual({
      action: "retry",
      nextState: "retrying",
      reason: "transient_with_attempts_left"
    });
  });

  it("returns final error when transient failure exhausts attempts", () => {
    const decision = decideRetryOutcome({
      attempt: 3,
      maxAttempts: 3,
      failureClass: "transient"
    });

    expect(decision).toEqual({
      action: "final_error",
      nextState: "error",
      reason: "attempts_exhausted"
    });
  });

  it("returns final error for terminal failure regardless of attempts", () => {
    const decision = decideRetryOutcome({
      attempt: 1,
      maxAttempts: 3,
      failureClass: "terminal"
    });

    expect(decision).toEqual({
      action: "final_error",
      nextState: "error",
      reason: "terminal_failure"
    });
  });

  it("validates positive integer attempt values", () => {
    expect(() =>
      decideRetryOutcome({
        attempt: 0,
        maxAttempts: 3,
        failureClass: "transient"
      })
    ).toThrow(RetryPolicyValidationError);
  });
});
