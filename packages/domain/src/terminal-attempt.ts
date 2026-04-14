import type { RequestState } from "./request-state.js";

export type TerminalAttemptOutcome = Extract<RequestState, "added_to_cart" | "success" | "retrying" | "error">;

export interface NormalizeTerminalAttemptInput {
  readonly requestId: string;
  readonly attempt: number;
  readonly outcome: TerminalAttemptOutcome;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly rawOutput: string;
}

export interface NormalizedTerminalAttempt {
  readonly requestId: string;
  readonly attempt: number;
  readonly outcome: TerminalAttemptOutcome;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly rawOutput: string;
  readonly durationMs: number;
}

export class TerminalAttemptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerminalAttemptValidationError";
  }
}

export function normalizeTerminalAttempt(input: NormalizeTerminalAttemptInput): NormalizedTerminalAttempt {
  const requestId = requireNonEmpty(input.requestId, "requestId");
  const attempt = Math.trunc(input.attempt);
  if (!Number.isFinite(attempt) || attempt <= 0) {
    throw new TerminalAttemptValidationError("attempt must be a positive integer");
  }

  const outcome = normalizeOutcome(input.outcome);
  const startedAt = requireValidIso(input.startedAt, "startedAt");
  const finishedAt = requireValidIso(input.finishedAt, "finishedAt");
  const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);
  if (durationMs < 0) {
    throw new TerminalAttemptValidationError("finishedAt must not be earlier than startedAt");
  }

  return {
    requestId,
    attempt,
    outcome,
    startedAt,
    finishedAt,
    rawOutput: input.rawOutput,
    durationMs
  };
}

export function formatTerminalAttemptJournalNote(attempt: NormalizedTerminalAttempt): string {
  return [
    `terminal_attempt`,
    `attempt=${attempt.attempt}`,
    `outcome=${attempt.outcome}`,
    `startedAt=${attempt.startedAt}`,
    `finishedAt=${attempt.finishedAt}`,
    `durationMs=${attempt.durationMs}`,
    `rawOutput=${attempt.rawOutput}`
  ].join(" ");
}

function normalizeOutcome(outcome: TerminalAttemptOutcome): TerminalAttemptOutcome {
  if (
    outcome !== "added_to_cart" &&
    outcome !== "success" &&
    outcome !== "retrying" &&
    outcome !== "error"
  ) {
    throw new TerminalAttemptValidationError(`unsupported terminal attempt outcome "${String(outcome)}"`);
  }

  return outcome;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TerminalAttemptValidationError(`${field} is required`);
  }
  return normalized;
}

function requireValidIso(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new TerminalAttemptValidationError(`${field} must be a valid ISO date string`);
  }
  return normalized;
}
