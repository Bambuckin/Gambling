import type { PurchaseDraftPayload, PurchaseDraftPayloadValue } from "./purchase-draft.js";
import { applyRequestStateTransition, type RequestState } from "./request-state.js";

export interface PurchaseRequestSnapshot {
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly payload: PurchaseDraftPayload;
  readonly costMinor: number;
  readonly currency: string;
  readonly createdAt: string;
}

export interface PurchaseRequestJournalEntry {
  readonly eventId: string;
  readonly fromState: RequestState;
  readonly toState: RequestState;
  readonly occurredAt: string;
  readonly note?: string;
}

export interface PurchaseRequestRecord {
  readonly snapshot: PurchaseRequestSnapshot;
  readonly state: RequestState;
  readonly journal: readonly PurchaseRequestJournalEntry[];
}

export interface CreateAwaitingConfirmationRequestInput {
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly payload: PurchaseDraftPayload;
  readonly costMinor: number;
  readonly currency: string;
  readonly createdAt: string;
}

export class PurchaseRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestValidationError";
  }
}

export function createAwaitingConfirmationRequest(
  input: CreateAwaitingConfirmationRequestInput
): PurchaseRequestRecord {
  const requestId = requireNonEmpty(input.requestId, "requestId");
  const userId = requireNonEmpty(input.userId, "userId");
  const lotteryCode = requireNonEmpty(input.lotteryCode, "lotteryCode").toLowerCase();
  const drawId = requireNonEmpty(input.drawId, "drawId");
  const currency = requireNonEmpty(input.currency, "currency").toUpperCase();
  const createdAt = requireValidIsoDate(input.createdAt, "createdAt");
  const costMinor = Math.trunc(input.costMinor);

  if (!Number.isFinite(costMinor) || costMinor <= 0) {
    throw new PurchaseRequestValidationError("costMinor must be a positive integer");
  }

  const payload = clonePayload(input.payload);
  const startedState = applyRequestStateTransition("created", "awaiting_confirmation");

  return {
    snapshot: {
      requestId,
      userId,
      lotteryCode,
      drawId,
      payload,
      costMinor,
      currency,
      createdAt
    },
    state: startedState,
    journal: [
      {
        eventId: `${requestId}:awaiting_confirmation`,
        fromState: "created",
        toState: startedState,
        occurredAt: createdAt,
        note: "request snapshot persisted"
      }
    ]
  };
}

export function appendPurchaseRequestTransition(
  record: PurchaseRequestRecord,
  nextState: RequestState,
  input: {
    readonly eventId: string;
    readonly occurredAt: string;
    readonly note?: string;
  }
): PurchaseRequestRecord {
  const eventId = requireNonEmpty(input.eventId, "eventId");
  const occurredAt = requireValidIsoDate(input.occurredAt, "occurredAt");
  const currentState = record.state;
  const transitionedState = applyRequestStateTransition(currentState, nextState);

  return {
    snapshot: cloneSnapshot(record.snapshot),
    state: transitionedState,
    journal: [
      ...record.journal.map((entry) => ({ ...entry })),
      {
        eventId,
        fromState: currentState,
        toState: transitionedState,
        occurredAt,
        ...(input.note ? { note: input.note } : {})
      }
    ]
  };
}

function cloneSnapshot(snapshot: PurchaseRequestSnapshot): PurchaseRequestSnapshot {
  return {
    ...snapshot,
    payload: clonePayload(snapshot.payload)
  };
}

function clonePayload(input: PurchaseDraftPayload): PurchaseDraftPayload {
  const output: Record<string, PurchaseDraftPayloadValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new PurchaseRequestValidationError(`payload field "${key}" has unsupported type`);
    }
    output[key] = value;
  }
  return output;
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PurchaseRequestValidationError(`${field} is required`);
  }
  return trimmed;
}

function requireValidIsoDate(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) {
    throw new PurchaseRequestValidationError(`${field} must be a valid ISO date string`);
  }
  return trimmed;
}
