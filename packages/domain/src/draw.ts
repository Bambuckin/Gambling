export interface DrawSnapshot {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly fetchedAt: string;
  readonly freshnessTtlSeconds: number;
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
  nowIso: string
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
    isPurchaseBlocked: true,
    snapshot,
    freshness
  };
}
