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

export function evaluateDrawFreshness(snapshot: DrawSnapshot, nowIso: string): DrawFreshness {
  const now = Date.parse(nowIso);
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  const ageMs = now - fetchedAt;
  const isFresh = ageMs <= snapshot.freshnessTtlSeconds * 1000;

  return isFresh
    ? { isFresh: true }
    : { isFresh: false, staleSince: new Date(fetchedAt + snapshot.freshnessTtlSeconds * 1000).toISOString() };
}
