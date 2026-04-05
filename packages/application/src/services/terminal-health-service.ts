import type { PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";

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
  readonly timeSource: TimeSource;
}

export class TerminalHealthService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;
  private readonly timeSource: TimeSource;

  constructor(dependencies: TerminalHealthServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.timeSource = dependencies.timeSource;
  }

  async getStateSnapshot(): Promise<TerminalHealthSnapshot> {
    const [queueItems, requests] = await Promise.all([
      this.queueStore.listQueueItems(),
      this.requestStore.listRequests()
    ]);

    const activeQueueItem = queueItems.find((item) => item.status === "executing") ?? null;
    const sortedRequests = [...requests].sort((left, right) =>
      resolveRequestUpdatedAt(right).localeCompare(resolveRequestUpdatedAt(left))
    );

    const consecutiveFailures = countConsecutiveFailures(sortedRequests);
    const lastErrorRequest = sortedRequests.find((record) => record.state === "error") ?? null;
    const lastErrorAt = lastErrorRequest ? resolveRequestUpdatedAt(lastErrorRequest) : null;

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
  requests: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>
): number {
  let count = 0;
  for (const request of requests) {
    if (request.state !== "error") {
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
