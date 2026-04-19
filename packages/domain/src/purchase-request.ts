import { clonePurchaseDraftPayload, type PurchaseDraftPayload } from "./purchase-draft.js";
import {
  applyCanonicalPurchaseStatusTransition,
  applyRequestStateTransition,
  type CanonicalPurchaseStatus,
  type PurchaseResultStatus,
  type PurchaseResultVisibility,
  type RequestState
} from "./request-state.js";

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

// Legacy request record stays as the active compatibility write model until the
// canonical purchase flow is cut over in later migration phases.
export interface PurchaseRequestRecord {
  readonly snapshot: PurchaseRequestSnapshot;
  readonly state: RequestState;
  readonly journal: readonly PurchaseRequestJournalEntry[];
}

export interface CanonicalPurchaseSnapshot {
  readonly purchaseId: string;
  readonly legacyRequestId: string | null;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly payload: PurchaseDraftPayload;
  readonly costMinor: number;
  readonly currency: string;
  readonly submittedAt: string;
}

export interface CanonicalPurchaseJournalEntry {
  readonly eventId: string;
  readonly kind: "status" | "result_status" | "result_visibility";
  readonly previousValue: string | null;
  readonly nextValue: string;
  readonly occurredAt: string;
  readonly note?: string;
}

export interface CanonicalPurchaseRecord {
  readonly snapshot: CanonicalPurchaseSnapshot;
  readonly status: CanonicalPurchaseStatus;
  readonly resultStatus: PurchaseResultStatus;
  readonly resultVisibility: PurchaseResultVisibility;
  readonly purchasedAt: string | null;
  readonly settledAt: string | null;
  readonly externalTicketReference: string | null;
  readonly journal: readonly CanonicalPurchaseJournalEntry[];
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

export interface CreateSubmittedCanonicalPurchaseInput {
  readonly purchaseId: string;
  readonly legacyRequestId?: string | null;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly payload: PurchaseDraftPayload;
  readonly costMinor: number;
  readonly currency: string;
  readonly submittedAt: string;
}

export class PurchaseRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseRequestValidationError";
  }
}

export class CanonicalPurchaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalPurchaseValidationError";
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

export function createSubmittedCanonicalPurchase(
  input: CreateSubmittedCanonicalPurchaseInput
): CanonicalPurchaseRecord {
  const purchaseId = requireNonEmpty(input.purchaseId, "purchaseId");
  const userId = requireNonEmpty(input.userId, "userId");
  const lotteryCode = requireNonEmpty(input.lotteryCode, "lotteryCode").toLowerCase();
  const drawId = requireNonEmpty(input.drawId, "drawId");
  const currency = requireNonEmpty(input.currency, "currency").toUpperCase();
  const submittedAt = requireValidIsoDate(input.submittedAt, "submittedAt");
  const costMinor = Math.trunc(input.costMinor);

  if (!Number.isFinite(costMinor) || costMinor <= 0) {
    throw new CanonicalPurchaseValidationError("costMinor must be a positive integer");
  }

  return {
    snapshot: {
      purchaseId,
      legacyRequestId: normalizeOptionalText(input.legacyRequestId ?? null),
      userId,
      lotteryCode,
      drawId,
      payload: clonePayload(input.payload),
      costMinor,
      currency,
      submittedAt
    },
    status: "submitted",
    resultStatus: "pending",
    resultVisibility: "hidden",
    purchasedAt: null,
    settledAt: null,
    externalTicketReference: null,
    journal: [
      {
        eventId: `${purchaseId}:submitted`,
        kind: "status",
        previousValue: null,
        nextValue: "submitted",
        occurredAt: submittedAt,
        note: "canonical purchase snapshot persisted"
      }
    ]
  };
}

export function appendCanonicalPurchaseTransition(
  record: CanonicalPurchaseRecord,
  nextStatus: CanonicalPurchaseStatus,
  input: {
    readonly eventId: string;
    readonly occurredAt: string;
    readonly note?: string;
    readonly externalTicketReference?: string | null;
  }
): CanonicalPurchaseRecord {
  const eventId = requireNonEmpty(input.eventId, "eventId");
  const occurredAt = requireValidIsoDate(input.occurredAt, "occurredAt");
  const currentStatus = record.status;
  const transitionedStatus = applyCanonicalPurchaseStatusTransition(currentStatus, nextStatus);
  const purchasedAt = shouldSetPurchasedAt(transitionedStatus)
    ? record.purchasedAt ?? occurredAt
    : record.purchasedAt;
  const settledAt = transitionedStatus === "settled" ? record.settledAt ?? occurredAt : record.settledAt;

  return {
    snapshot: cloneCanonicalSnapshot(record.snapshot),
    status: transitionedStatus,
    resultStatus: record.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt,
    settledAt,
    externalTicketReference: normalizeOptionalText(input.externalTicketReference ?? record.externalTicketReference),
    journal: [
      ...record.journal.map((entry) => ({ ...entry })),
      {
        eventId,
        kind: "status",
        previousValue: currentStatus,
        nextValue: transitionedStatus,
        occurredAt,
        ...(input.note ? { note: input.note } : {})
      }
    ]
  };
}

export function applyCanonicalPurchaseResult(
  record: CanonicalPurchaseRecord,
  input: {
    readonly eventId: string;
    readonly occurredAt: string;
    readonly resultStatus: PurchaseResultStatus;
    readonly note?: string;
  }
): CanonicalPurchaseRecord {
  const eventId = requireNonEmpty(input.eventId, "eventId");
  const occurredAt = requireValidIsoDate(input.occurredAt, "occurredAt");

  if (record.resultStatus === input.resultStatus) {
    return cloneCanonicalPurchaseRecord(record);
  }

  if (
    input.resultStatus !== "pending" &&
    record.status !== "awaiting_draw_close" &&
    record.status !== "settled"
  ) {
    throw new CanonicalPurchaseValidationError(
      `purchase "${record.snapshot.purchaseId}" cannot set result status from lifecycle "${record.status}"`
    );
  }

  return {
    snapshot: cloneCanonicalSnapshot(record.snapshot),
    status: record.status,
    resultStatus: input.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: [
      ...record.journal.map((entry) => ({ ...entry })),
      {
        eventId,
        kind: "result_status",
        previousValue: record.resultStatus,
        nextValue: input.resultStatus,
        occurredAt,
        ...(input.note ? { note: input.note } : {})
      }
    ]
  };
}

export function setCanonicalPurchaseResultVisibility(
  record: CanonicalPurchaseRecord,
  input: {
    readonly eventId: string;
    readonly occurredAt: string;
    readonly resultVisibility: PurchaseResultVisibility;
    readonly note?: string;
  }
): CanonicalPurchaseRecord {
  const eventId = requireNonEmpty(input.eventId, "eventId");
  const occurredAt = requireValidIsoDate(input.occurredAt, "occurredAt");

  if (record.resultVisibility === input.resultVisibility) {
    return cloneCanonicalPurchaseRecord(record);
  }

  if (record.resultVisibility === "visible" && input.resultVisibility === "hidden") {
    throw new CanonicalPurchaseValidationError("result visibility cannot move back to hidden once published");
  }

  if (input.resultVisibility === "visible" && record.status !== "settled") {
    throw new CanonicalPurchaseValidationError(
      `purchase "${record.snapshot.purchaseId}" cannot publish result before settlement`
    );
  }

  if (input.resultVisibility === "visible" && record.resultStatus === "pending") {
    throw new CanonicalPurchaseValidationError(
      `purchase "${record.snapshot.purchaseId}" cannot publish a pending result`
    );
  }

  return {
    snapshot: cloneCanonicalSnapshot(record.snapshot),
    status: record.status,
    resultStatus: record.resultStatus,
    resultVisibility: input.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: [
      ...record.journal.map((entry) => ({ ...entry })),
      {
        eventId,
        kind: "result_visibility",
        previousValue: record.resultVisibility,
        nextValue: input.resultVisibility,
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

function cloneCanonicalSnapshot(snapshot: CanonicalPurchaseSnapshot): CanonicalPurchaseSnapshot {
  return {
    ...snapshot,
    payload: clonePayload(snapshot.payload)
  };
}

function cloneCanonicalPurchaseRecord(record: CanonicalPurchaseRecord): CanonicalPurchaseRecord {
  return {
    snapshot: cloneCanonicalSnapshot(record.snapshot),
    status: record.status,
    resultStatus: record.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function clonePayload(input: PurchaseDraftPayload): PurchaseDraftPayload {
  return clonePurchaseDraftPayload(input);
}

function shouldSetPurchasedAt(status: CanonicalPurchaseStatus): boolean {
  return status === "purchased" || status === "awaiting_draw_close" || status === "settled";
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
