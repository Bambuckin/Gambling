import type { RequestState } from "./request-state.js";

export type TerminalAttemptOutcome = Extract<RequestState, "added_to_cart" | "success" | "retrying" | "error">;

export interface PurchaseAttemptRecord {
  readonly attemptId: string;
  readonly purchaseId: string;
  readonly legacyRequestId: string | null;
  readonly attemptNumber: number;
  readonly outcome: TerminalAttemptOutcome;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly rawOutput: string;
  readonly durationMs: number;
  readonly externalTicketReference: string | null;
  readonly errorMessage: string | null;
}

export interface NormalizeTerminalAttemptInput {
  readonly requestId: string;
  readonly attempt: number;
  readonly outcome: TerminalAttemptOutcome;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly rawOutput: string;
}

export interface CreatePurchaseAttemptRecordInput {
  readonly purchaseId: string;
  readonly legacyRequestId?: string | null;
  readonly attemptNumber: number;
  readonly outcome: TerminalAttemptOutcome;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly rawOutput: string;
  readonly externalTicketReference?: string | null;
  readonly errorMessage?: string | null;
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

export function createPurchaseAttemptRecord(input: CreatePurchaseAttemptRecordInput): PurchaseAttemptRecord {
  const purchaseId = requireNonEmpty(input.purchaseId, "purchaseId");
  const normalizedAttempt = normalizeTerminalAttempt({
    requestId: purchaseId,
    attempt: input.attemptNumber,
    outcome: input.outcome,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    rawOutput: input.rawOutput
  });

  return {
    attemptId: `${purchaseId}:attempt:${normalizedAttempt.attempt}`,
    purchaseId,
    legacyRequestId: normalizeOptionalText(input.legacyRequestId ?? null),
    attemptNumber: normalizedAttempt.attempt,
    outcome: normalizedAttempt.outcome,
    startedAt: normalizedAttempt.startedAt,
    finishedAt: normalizedAttempt.finishedAt,
    rawOutput: normalizedAttempt.rawOutput,
    durationMs: normalizedAttempt.durationMs,
    externalTicketReference: normalizeOptionalText(input.externalTicketReference ?? null),
    errorMessage: normalizeOptionalText(input.errorMessage ?? null)
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
