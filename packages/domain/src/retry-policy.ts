export type RetryFailureClass = "transient" | "terminal";
export type RetryDecisionAction = "retry" | "final_error";

export interface RetryPolicyInput {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly failureClass: RetryFailureClass;
}

export interface RetryDecision {
  readonly action: RetryDecisionAction;
  readonly nextState: "retrying" | "error";
  readonly reason: "transient_with_attempts_left" | "attempts_exhausted" | "terminal_failure";
}

export class RetryPolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryPolicyValidationError";
  }
}

export function decideRetryOutcome(input: RetryPolicyInput): RetryDecision {
  const attempt = Math.trunc(input.attempt);
  const maxAttempts = Math.trunc(input.maxAttempts);

  if (!Number.isFinite(attempt) || attempt <= 0) {
    throw new RetryPolicyValidationError("attempt must be a positive integer");
  }
  if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) {
    throw new RetryPolicyValidationError("maxAttempts must be a positive integer");
  }

  if (input.failureClass === "terminal") {
    return {
      action: "final_error",
      nextState: "error",
      reason: "terminal_failure"
    };
  }

  if (attempt < maxAttempts) {
    return {
      action: "retry",
      nextState: "retrying",
      reason: "transient_with_attempts_left"
    };
  }

  return {
    action: "final_error",
    nextState: "error",
    reason: "attempts_exhausted"
  };
}
