export const REQUEST_STATES = [
  "created",
  "awaiting_confirmation",
  "confirmed",
  "queued",
  "executing",
  "retrying",
  "added_to_cart",
  "success",
  "canceled",
  "error",
  "reserve_released"
] as const;

export type RequestState = (typeof REQUEST_STATES)[number];
export const CANCELABLE_REQUEST_STATES = ["queued", "retrying"] as const;

export const CANONICAL_PURCHASE_STATUSES = [
  "submitted",
  "queued",
  "processing",
  "purchase_failed_retryable",
  "purchase_failed_final",
  "purchased",
  "awaiting_draw_close",
  "settled",
  "canceled"
] as const;

export const PURCHASE_RESULT_STATUSES = ["pending", "lose", "win"] as const;
export const PURCHASE_RESULT_VISIBILITIES = ["hidden", "visible"] as const;

export type RequestTransitionMap = Record<RequestState, readonly RequestState[]>;
export type CanonicalPurchaseStatus = (typeof CANONICAL_PURCHASE_STATUSES)[number];
export type PurchaseResultStatus = (typeof PURCHASE_RESULT_STATUSES)[number];
export type PurchaseResultVisibility = (typeof PURCHASE_RESULT_VISIBILITIES)[number];
export type CanonicalPurchaseTransitionMap = Record<CanonicalPurchaseStatus, readonly CanonicalPurchaseStatus[]>;

export const REQUEST_TRANSITIONS: RequestTransitionMap = {
  created: ["awaiting_confirmation", "canceled"],
  awaiting_confirmation: ["confirmed", "canceled"],
  confirmed: ["queued", "canceled", "reserve_released"],
  queued: ["executing", "canceled", "error", "reserve_released"],
  executing: ["retrying", "added_to_cart", "success", "error", "reserve_released"],
  retrying: ["queued", "executing", "error", "reserve_released"],
  added_to_cart: ["success"],
  success: [],
  canceled: ["reserve_released"],
  error: ["reserve_released"],
  reserve_released: []
};

export const CANONICAL_PURCHASE_TRANSITIONS: CanonicalPurchaseTransitionMap = {
  submitted: ["queued", "canceled"],
  queued: ["processing", "canceled"],
  processing: ["purchase_failed_retryable", "purchase_failed_final", "purchased"],
  purchase_failed_retryable: ["queued", "processing", "purchase_failed_final", "canceled"],
  purchase_failed_final: [],
  purchased: ["awaiting_draw_close"],
  awaiting_draw_close: ["settled"],
  settled: [],
  canceled: []
};

export interface TransitionCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

export function canTransitionRequestState(from: RequestState, to: RequestState): TransitionCheckResult {
  if (from === to) {
    return {
      allowed: false,
      reason: "state cannot transition to itself"
    };
  }

  const allowedTargets = REQUEST_TRANSITIONS[from];
  if (allowedTargets.includes(to)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `transition from ${from} to ${to} is not allowed`
  };
}

export function applyRequestStateTransition(from: RequestState, to: RequestState): RequestState {
  const check = canTransitionRequestState(from, to);
  if (!check.allowed) {
    throw new Error(check.reason ?? "invalid request state transition");
  }

  return to;
}

export function canTransitionCanonicalPurchaseStatus(
  from: CanonicalPurchaseStatus,
  to: CanonicalPurchaseStatus
): TransitionCheckResult {
  if (from === to) {
    return {
      allowed: false,
      reason: "canonical purchase status cannot transition to itself"
    };
  }

  const allowedTargets = CANONICAL_PURCHASE_TRANSITIONS[from];
  if (allowedTargets.includes(to)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `transition from ${from} to ${to} is not allowed`
  };
}

export function applyCanonicalPurchaseStatusTransition(
  from: CanonicalPurchaseStatus,
  to: CanonicalPurchaseStatus
): CanonicalPurchaseStatus {
  const check = canTransitionCanonicalPurchaseStatus(from, to);
  if (!check.allowed) {
    throw new Error(check.reason ?? "invalid canonical purchase status transition");
  }

  return to;
}

export function canCancelRequestState(state: RequestState): TransitionCheckResult {
  if (CANCELABLE_REQUEST_STATES.includes(state as (typeof CANCELABLE_REQUEST_STATES)[number])) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `request in state ${state} cannot be canceled`
  };
}

export function assertCancelableRequestState(state: RequestState): void {
  const check = canCancelRequestState(state);
  if (!check.allowed) {
    throw new Error(check.reason ?? "request cannot be canceled");
  }
}
