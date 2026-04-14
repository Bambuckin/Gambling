import { decideRetryOutcome, type RetryFailureClass } from "@lottery/domain";
import type { TerminalExecutionResult } from "../ports/terminal-executor.js";

export interface TerminalRetryServiceConfig {
  readonly maxAttempts?: number;
}

export interface ResolveTerminalRetryInput {
  readonly attempt: number;
  readonly candidateState: TerminalExecutionResult["nextState"];
  readonly rawOutput: string;
}

export class TerminalRetryService {
  private readonly maxAttempts: number;

  constructor(config: TerminalRetryServiceConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? 3;
  }

  resolveNextState(input: ResolveTerminalRetryInput): TerminalExecutionResult["nextState"] {
    if (input.candidateState === "added_to_cart") {
      return "added_to_cart";
    }

    if (input.candidateState === "success") {
      return "success";
    }

    if (input.candidateState === "error") {
      return "error";
    }

    const decision = decideRetryOutcome({
      attempt: input.attempt,
      maxAttempts: this.maxAttempts,
      failureClass: classifyFailureClass(input.rawOutput)
    });

    return decision.nextState;
  }
}

function classifyFailureClass(rawOutput: string): RetryFailureClass {
  const normalized = rawOutput.toLowerCase();
  if (
    normalized.includes("permanent") ||
    normalized.includes("non-retryable") ||
    normalized.includes("fatal")
  ) {
    return "terminal";
  }

  return "transient";
}
