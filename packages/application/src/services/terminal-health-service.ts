import type { CanonicalPurchaseRecord } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { mapCanonicalPurchaseStatusToRequestState } from "./canonical-compatibility.js";

export type TerminalHealthState = "idle" | "busy" | "degraded" | "offline";

export interface TerminalHealthSnapshot {
  readonly state: TerminalHealthState;
  readonly activeRequestId: string | null;
  readonly queueDepth: number;
  readonly consecutiveFailures: number;
  readonly lastErrorAt: string | null;
  readonly checkedAt: string;
}

export interface TerminalHealthServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly timeSource: TimeSource;
}

export class TerminalHealthService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly timeSource: TimeSource;

  constructor(dependencies: TerminalHealthServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.timeSource = dependencies.timeSource;
  }

  async getStateSnapshot(): Promise<TerminalHealthSnapshot> {
    const [queueItems, requests, canonicalPurchases] = await Promise.all([
      this.queueStore.listQueueItems(),
      this.requestStore.listRequests(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);

    const activeQueueItem = queueItems.find((item) => item.status === "executing") ?? null;
    const sortedRuntimeEntries = buildRuntimeEntries(requests, canonicalPurchases);

    const consecutiveFailures = countConsecutiveFailures(sortedRuntimeEntries);
    const lastErrorEntry = sortedRuntimeEntries.find((entry) => entry.state === "error") ?? null;
    const lastErrorAt = lastErrorEntry?.updatedAt ?? null;

    const state = resolveState({
      activeQueueItemExists: activeQueueItem !== null,
      consecutiveFailures
    });

    return {
      state,
      activeRequestId: activeQueueItem?.requestId ?? null,
      queueDepth: queueItems.length,
      consecutiveFailures,
      lastErrorAt,
      checkedAt: this.timeSource.nowIso()
    };
  }
}

interface TerminalHealthRuntimeEntry {
  readonly requestId: string;
  readonly state: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]["state"];
  readonly updatedAt: string;
}

function buildRuntimeEntries(
  requests: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>,
  canonicalPurchases: readonly CanonicalPurchaseRecord[]
): TerminalHealthRuntimeEntry[] {
  const canonicalByRequestId = new Map(
    canonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase] as const)
  );
  const coveredRequestIds = new Set<string>();

  return requests
    .map((record) => {
      coveredRequestIds.add(record.snapshot.requestId);
      const canonicalPurchase = canonicalByRequestId.get(record.snapshot.requestId);
      return canonicalPurchase ? toCanonicalRuntimeEntry(canonicalPurchase) : toLegacyRuntimeEntry(record);
    })
    .concat(
      canonicalPurchases
        .filter((purchase) => !coveredRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
        .map((purchase) => toCanonicalRuntimeEntry(purchase))
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function toLegacyRuntimeEntry(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]
): TerminalHealthRuntimeEntry {
  return {
    requestId: record.snapshot.requestId,
    state: record.state,
    updatedAt: resolveRequestUpdatedAt(record)
  };
}

function toCanonicalRuntimeEntry(purchase: CanonicalPurchaseRecord): TerminalHealthRuntimeEntry {
  return {
    requestId: purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId,
    state: mapCanonicalPurchaseStatusToRequestState(purchase),
    updatedAt: resolveCanonicalPurchaseUpdatedAt(purchase)
  };
}

function resolveState(input: {
  readonly activeQueueItemExists: boolean;
  readonly consecutiveFailures: number;
}): TerminalHealthState {
  if (input.activeQueueItemExists) {
    return "busy";
  }

  if (input.consecutiveFailures >= 3) {
    return "offline";
  }

  if (input.consecutiveFailures >= 1) {
    return "degraded";
  }

  return "idle";
}

function countConsecutiveFailures(
  entries: readonly TerminalHealthRuntimeEntry[]
): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.state !== "error") {
      break;
    }

    count += 1;
  }
  return count;
}

function resolveRequestUpdatedAt(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]
): string {
  return record.journal.at(-1)?.occurredAt ?? record.snapshot.createdAt;
}

function resolveCanonicalPurchaseUpdatedAt(purchase: CanonicalPurchaseRecord): string {
  return purchase.journal.at(-1)?.occurredAt ?? purchase.snapshot.submittedAt;
}
