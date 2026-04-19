import type {
  CanonicalPurchaseRecord,
  PurchaseAttemptRecord,
  RequestState
} from "@lottery/domain";

export interface CanonicalRequestProjection {
  readonly requestId: string;
  readonly status: RequestState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly finalResult: string | null;
  readonly attemptCount: number;
}

export function buildCanonicalAttemptMap(
  attempts: readonly PurchaseAttemptRecord[]
): Map<string, readonly PurchaseAttemptRecord[]> {
  const map = new Map<string, PurchaseAttemptRecord[]>();

  for (const attempt of attempts) {
    const existing = map.get(attempt.purchaseId);
    if (existing) {
      existing.push({ ...attempt });
      continue;
    }

    map.set(attempt.purchaseId, [{ ...attempt }]);
  }

  for (const [purchaseId, purchaseAttempts] of map.entries()) {
    purchaseAttempts.sort((left, right) => left.attemptNumber - right.attemptNumber);
    map.set(purchaseId, purchaseAttempts);
  }

  return map;
}

export function projectCanonicalRequest(
  purchase: CanonicalPurchaseRecord,
  attempts: readonly PurchaseAttemptRecord[] = []
): CanonicalRequestProjection {
  const requestId = purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId;
  const updatedAt = purchase.journal.at(-1)?.occurredAt ?? purchase.snapshot.submittedAt;

  return {
    requestId,
    status: mapCanonicalPurchaseStatusToRequestState(purchase),
    createdAt: purchase.snapshot.submittedAt,
    updatedAt,
    finalResult: resolveCanonicalFinalResult(purchase),
    attemptCount: attempts.length
  };
}

export function mapCanonicalPurchaseStatusToRequestState(purchase: CanonicalPurchaseRecord): RequestState {
  switch (purchase.status) {
    case "submitted":
      return "confirmed";
    case "queued":
      return "queued";
    case "processing":
      return "executing";
    case "purchase_failed_retryable":
      return "retrying";
    case "purchase_failed_final":
      return "error";
    case "purchased":
    case "awaiting_draw_close":
    case "settled":
      return "success";
    case "canceled":
      return "canceled";
  }
}

export function resolveCanonicalFinalResult(purchase: CanonicalPurchaseRecord): string | null {
  if (purchase.status === "purchase_failed_final") {
    return "canonical purchase failed";
  }

  if (purchase.status === "canceled") {
    return "canonical purchase canceled";
  }

  if (purchase.resultVisibility === "visible") {
    if (purchase.resultStatus === "win") {
      return "canonical result: win";
    }

    if (purchase.resultStatus === "lose") {
      return "canonical result: lose";
    }
  }

  return null;
}

export function isCanonicalPurchaseProblem(
  purchase: CanonicalPurchaseRecord,
  nowIso: string,
  staleExecutingThresholdMs: number
): boolean {
  const projectedStatus = mapCanonicalPurchaseStatusToRequestState(purchase);

  if (projectedStatus === "retrying" || projectedStatus === "error") {
    return true;
  }

  if (projectedStatus !== "executing") {
    return false;
  }

  const updatedAt = purchase.journal.at(-1)?.occurredAt ?? purchase.snapshot.submittedAt;
  const updatedTimestamp = Date.parse(updatedAt);
  const nowTimestamp = Date.parse(nowIso);

  if (!Number.isFinite(updatedTimestamp) || !Number.isFinite(nowTimestamp)) {
    return false;
  }

  return nowTimestamp - updatedTimestamp >= staleExecutingThresholdMs;
}
