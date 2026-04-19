import type { PurchaseResultVisibility } from "./request-state.js";

export interface DrawOption {
  readonly drawId: string;
  readonly drawAt: string;
  readonly label: string;
  readonly priceMinor?: number;
}

export interface DrawSnapshot {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly fetchedAt: string;
  readonly freshnessTtlSeconds: number;
  readonly availableDraws?: readonly DrawOption[];
}

export interface DrawFreshness {
  readonly isFresh: boolean;
  readonly staleSince?: string;
}

export type DrawAvailabilityStatus = "fresh" | "stale" | "missing";

export interface DrawAvailabilityState {
  readonly lotteryCode: string;
  readonly status: DrawAvailabilityStatus;
  readonly isPurchaseBlocked: boolean;
  readonly snapshot?: DrawSnapshot;
  readonly freshness?: DrawFreshness;
}

export const CANONICAL_DRAW_STATUSES = ["open", "closed", "settled"] as const;
export type CanonicalDrawStatus = (typeof CANONICAL_DRAW_STATUSES)[number];
export type CanonicalDrawTransitionMap = Record<CanonicalDrawStatus, readonly CanonicalDrawStatus[]>;

export interface CanonicalDrawRecord {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly status: CanonicalDrawStatus;
  readonly resultVisibility: PurchaseResultVisibility;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly settledAt: string | null;
  readonly closedBy: string | null;
  readonly settledBy: string | null;
}

export interface CreateOpenCanonicalDrawInput {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly openedAt: string;
}

export const CANONICAL_DRAW_TRANSITIONS: CanonicalDrawTransitionMap = {
  open: ["closed"],
  closed: ["settled"],
  settled: []
};

export class CanonicalDrawValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalDrawValidationError";
  }
}

export function evaluateDrawFreshness(snapshot: DrawSnapshot, nowIso: string): DrawFreshness {
  const now = Date.parse(nowIso);
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  const ageMs = now - fetchedAt;
  const isFresh = ageMs <= snapshot.freshnessTtlSeconds * 1000;

  return isFresh
    ? { isFresh: true }
    : { isFresh: false, staleSince: new Date(fetchedAt + snapshot.freshnessTtlSeconds * 1000).toISOString() };
}

export function resolveDrawAvailabilityState(
  lotteryCode: string,
  snapshot: DrawSnapshot | null,
  nowIso: string,
  freshnessMode?: "block" | "warn_only"
): DrawAvailabilityState {
  if (!snapshot) {
    return {
      lotteryCode,
      status: "missing",
      isPurchaseBlocked: true
    };
  }

  const freshness = evaluateDrawFreshness(snapshot, nowIso);
  if (freshness.isFresh) {
    return {
      lotteryCode,
      status: "fresh",
      isPurchaseBlocked: false,
      snapshot,
      freshness
    };
  }

  return {
    lotteryCode,
    status: "stale",
    isPurchaseBlocked: freshnessMode !== "warn_only",
    snapshot,
    freshness
  };
}

export function createOpenCanonicalDraw(input: CreateOpenCanonicalDrawInput): CanonicalDrawRecord {
  return {
    lotteryCode: requireNonEmpty(input.lotteryCode, "lotteryCode").toLowerCase(),
    drawId: requireNonEmpty(input.drawId, "drawId"),
    drawAt: requireValidIso(input.drawAt, "drawAt"),
    status: "open",
    resultVisibility: "hidden",
    openedAt: requireValidIso(input.openedAt, "openedAt"),
    closedAt: null,
    settledAt: null,
    closedBy: null,
    settledBy: null
  };
}

export function canTransitionCanonicalDrawStatus(
  from: CanonicalDrawStatus,
  to: CanonicalDrawStatus
): { readonly allowed: boolean; readonly reason?: string } {
  if (from === to) {
    return {
      allowed: false,
      reason: "canonical draw status cannot transition to itself"
    };
  }

  const allowedTargets = CANONICAL_DRAW_TRANSITIONS[from];
  if (allowedTargets.includes(to)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `transition from ${from} to ${to} is not allowed`
  };
}

export function closeCanonicalDraw(
  record: CanonicalDrawRecord,
  input: {
    readonly closedAt: string;
    readonly closedBy: string;
  }
): CanonicalDrawRecord {
  const nextStatus = applyCanonicalDrawStatusTransition(record.status, "closed");

  return {
    ...record,
    status: nextStatus,
    closedAt: requireValidIso(input.closedAt, "closedAt"),
    closedBy: requireNonEmpty(input.closedBy, "closedBy")
  };
}

export function settleCanonicalDraw(
  record: CanonicalDrawRecord,
  input: {
    readonly settledAt: string;
    readonly settledBy: string;
  }
): CanonicalDrawRecord {
  const nextStatus = applyCanonicalDrawStatusTransition(record.status, "settled");

  return {
    ...record,
    status: nextStatus,
    resultVisibility: "visible",
    settledAt: requireValidIso(input.settledAt, "settledAt"),
    settledBy: requireNonEmpty(input.settledBy, "settledBy")
  };
}

export function isCanonicalDrawResultVisible(record: CanonicalDrawRecord): boolean {
  return record.resultVisibility === "visible";
}

export const DRAW_CLOSURE_STATUSES = ["open", "closed"] as const;
export type DrawClosureStatus = (typeof DRAW_CLOSURE_STATUSES)[number];

// Legacy draw closure remains a compatibility control surface until canonical draw
// settlement becomes the active runtime truth in later phases.
export interface DrawClosureRecord {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly status: DrawClosureStatus;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
}

export const ADMIN_EMULATED_WIN_AMOUNT_MINOR = 50_000;

export function createOpenDrawClosure(lotteryCode: string, drawId: string): DrawClosureRecord {
  return {
    lotteryCode: lotteryCode.trim().toLowerCase(),
    drawId: drawId.trim(),
    status: "open",
    closedAt: null,
    closedBy: null
  };
}

export function closeDrawClosure(record: DrawClosureRecord, closedBy: string, closedAt: string): DrawClosureRecord {
  if (record.status === "closed") {
    return { ...record };
  }

  return {
    lotteryCode: record.lotteryCode,
    drawId: record.drawId,
    status: "closed",
    closedAt,
    closedBy
  };
}

export function isDrawClosed(record: DrawClosureRecord | null): boolean {
  return record?.status === "closed";
}

export function listSnapshotDrawOptions(snapshot: DrawSnapshot | null): readonly DrawOption[] {
  if (!snapshot) {
    return [];
  }

  if (snapshot.availableDraws && snapshot.availableDraws.length > 0) {
    return snapshot.availableDraws
      .map((draw) => ({ ...draw }))
      .sort((left, right) => Date.parse(left.drawAt) - Date.parse(right.drawAt));
  }

  return [
    {
      drawId: snapshot.drawId,
      drawAt: snapshot.drawAt,
      label: snapshot.drawId
    }
  ];
}

function applyCanonicalDrawStatusTransition(from: CanonicalDrawStatus, to: CanonicalDrawStatus): CanonicalDrawStatus {
  const check = canTransitionCanonicalDrawStatus(from, to);
  if (!check.allowed) {
    throw new CanonicalDrawValidationError(check.reason ?? "invalid canonical draw status transition");
  }

  return to;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CanonicalDrawValidationError(`${field} is required`);
  }
  return normalized;
}

function requireValidIso(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new CanonicalDrawValidationError(`${field} must be a valid ISO date string`);
  }
  return normalized;
}
