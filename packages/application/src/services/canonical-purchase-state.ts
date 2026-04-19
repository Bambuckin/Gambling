import {
  appendCanonicalPurchaseTransition,
  createSubmittedCanonicalPurchase,
  type CanonicalPurchaseRecord,
  type PurchaseRequestRecord,
  type TerminalAttemptOutcome
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";

export interface CanonicalTransitionInput {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly note?: string;
  readonly externalTicketReference?: string | null;
}

export async function loadCanonicalPurchaseForRequest(
  canonicalPurchaseStore: CanonicalPurchaseStore,
  requestId: string
): Promise<CanonicalPurchaseRecord | null> {
  const normalizedRequestId = requestId.trim();
  if (!normalizedRequestId) {
    return null;
  }

  return (
    (await canonicalPurchaseStore.getPurchaseByLegacyRequestId(normalizedRequestId)) ??
    (await canonicalPurchaseStore.getPurchaseById(normalizedRequestId))
  );
}

export async function ensureCanonicalPurchaseForRequest(
  canonicalPurchaseStore: CanonicalPurchaseStore,
  request: PurchaseRequestRecord
): Promise<CanonicalPurchaseRecord> {
  const existing = await loadCanonicalPurchaseForRequest(canonicalPurchaseStore, request.snapshot.requestId);
  if (existing) {
    return existing;
  }

  const purchase = createSubmittedCanonicalPurchase({
    purchaseId: request.snapshot.requestId,
    legacyRequestId: request.snapshot.requestId,
    userId: request.snapshot.userId,
    lotteryCode: request.snapshot.lotteryCode,
    drawId: request.snapshot.drawId,
    payload: request.snapshot.payload,
    costMinor: request.snapshot.costMinor,
    currency: request.snapshot.currency,
    submittedAt: request.snapshot.createdAt
  });
  await canonicalPurchaseStore.savePurchase(purchase);
  return purchase;
}

export function queueCanonicalPurchase(
  purchase: CanonicalPurchaseRecord,
  input: CanonicalTransitionInput
): CanonicalPurchaseRecord {
  if (purchase.status === "queued" || purchase.status !== "submitted") {
    return purchase;
  }

  return appendCanonicalPurchaseTransition(purchase, "queued", input);
}

export function beginCanonicalPurchaseProcessing(
  purchase: CanonicalPurchaseRecord,
  input: CanonicalTransitionInput
): CanonicalPurchaseRecord {
  if (purchase.status === "processing") {
    return purchase;
  }

  if (purchase.status !== "queued" && purchase.status !== "purchase_failed_retryable") {
    return purchase;
  }

  return appendCanonicalPurchaseTransition(purchase, "processing", input);
}

export function markCanonicalPurchaseCanceled(
  purchase: CanonicalPurchaseRecord,
  input: CanonicalTransitionInput
): CanonicalPurchaseRecord {
  if (purchase.status === "canceled") {
    return purchase;
  }

  if (
    purchase.status !== "submitted" &&
    purchase.status !== "queued" &&
    purchase.status !== "purchase_failed_retryable"
  ) {
    return purchase;
  }

  return appendCanonicalPurchaseTransition(purchase, "canceled", input);
}

export function applyCanonicalAttemptOutcome(
  purchase: CanonicalPurchaseRecord,
  outcome: TerminalAttemptOutcome,
  input: CanonicalTransitionInput
): CanonicalPurchaseRecord {
  if (outcome === "retrying") {
    if (purchase.status === "purchase_failed_retryable" || purchase.status !== "processing") {
      return purchase;
    }

    return appendCanonicalPurchaseTransition(purchase, "purchase_failed_retryable", input);
  }

  if (outcome === "error") {
    if (purchase.status === "purchase_failed_final" || purchase.status !== "processing") {
      return purchase;
    }

    return appendCanonicalPurchaseTransition(purchase, "purchase_failed_final", input);
  }

  if (
    purchase.status === "purchased" ||
    purchase.status === "awaiting_draw_close" ||
    purchase.status === "settled"
  ) {
    if (input.externalTicketReference && purchase.externalTicketReference !== input.externalTicketReference) {
      return {
        ...purchase,
        externalTicketReference: input.externalTicketReference
      };
    }

    return purchase;
  }

  if (purchase.status !== "processing") {
    return purchase;
  }

  return appendCanonicalPurchaseTransition(purchase, "purchased", input);
}

export function markCanonicalPurchaseAwaitingDrawClose(
  purchase: CanonicalPurchaseRecord,
  input: CanonicalTransitionInput
): CanonicalPurchaseRecord {
  if (purchase.status === "awaiting_draw_close" || purchase.status === "settled") {
    return purchase;
  }

  if (purchase.status !== "purchased") {
    return purchase;
  }

  return appendCanonicalPurchaseTransition(purchase, "awaiting_draw_close", input);
}
