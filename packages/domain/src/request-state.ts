export const REQUEST_STATES = [
  "created",
  "awaiting_confirmation",
  "confirmed",
  "queued",
  "executing",
  "retrying",
  "success",
  "canceled",
  "error",
  "reserve_released"
] as const;

export type RequestState = (typeof REQUEST_STATES)[number];

export type RequestTransitionMap = Record<RequestState, readonly RequestState[]>;

export const REQUEST_TRANSITIONS: RequestTransitionMap = {
  created: ["awaiting_confirmation", "canceled"],
  awaiting_confirmation: ["confirmed", "canceled"],
  confirmed: ["queued", "canceled", "reserve_released"],
  queued: ["executing", "canceled", "error", "reserve_released"],
  executing: ["retrying", "success", "error", "reserve_released"],
  retrying: ["queued", "executing", "error", "reserve_released"],
  success: [],
  canceled: ["reserve_released"],
  error: ["reserve_released"],
  reserve_released: []
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
