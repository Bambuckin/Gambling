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

export const DRAW_CLOSURE_STATUSES = ["open", "closed"] as const;
export type DrawClosureStatus = (typeof DRAW_CLOSURE_STATUSES)[number];

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
