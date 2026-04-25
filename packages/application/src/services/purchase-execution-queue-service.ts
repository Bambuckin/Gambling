import { appendPurchaseRequestTransition, rankQueueForExecution, type PurchaseRequestRecord } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseQueueItem } from "../ports/purchase-queue-store.js";
import type { PurchaseQueueTransport } from "../ports/purchase-queue-transport.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TerminalExecutionLock } from "../ports/terminal-execution-lock.js";
import type { TimeSource } from "../ports/time-source.js";
import {
  beginCanonicalPurchaseProcessing,
  ensureCanonicalPurchaseForRequest,
  queueCanonicalPurchase
} from "./canonical-purchase-state.js";

export interface PurchaseExecutionQueueServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueTransport;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly executionLock: TerminalExecutionLock;
  readonly timeSource: TimeSource;
}

export interface ReserveNextQueuedRequestInput {
  readonly workerId: string;
}

export interface ReserveNextQueuedRequestResult {
  readonly workerId: string;
  readonly request: PurchaseRequestRecord;
  readonly queueItem: PurchaseQueueItem;
}

export class PurchaseExecutionQueueService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueTransport;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly executionLock: TerminalExecutionLock;
  private readonly timeSource: TimeSource;

  constructor(dependencies: PurchaseExecutionQueueServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.executionLock = dependencies.executionLock;
    this.timeSource = dependencies.timeSource;
  }

  async reserveNextQueuedRequest(input: ReserveNextQueuedRequestInput): Promise<ReserveNextQueuedRequestResult | null> {
    const workerId = normalizeWorkerId(input.workerId);
    const acquired = await this.executionLock.acquire(workerId);
    if (!acquired) {
      return null;
    }

    let keepLock = false;
    try {
      let queueItems = await this.queueStore.listSnapshot();
      if (queueItems.some((item) => item.status === "executing")) {
        const repairedQueueItems = await this.repairRecoveredExecutingItems(queueItems);
        if (repairedQueueItems === null) {
          return null;
        }

        queueItems = repairedQueueItems;
      }
      if (queueItems.some((item) => item.status === "executing")) {
        return null;
      }

      const rankedCandidates = rankQueueForExecution(
        queueItems.filter((item) => item.status === "queued").map((item) => ({
          requestId: item.requestId,
          priority: item.priority,
          enqueuedAt: item.enqueuedAt
        }))
      );
      if (rankedCandidates.length === 0) {
        return null;
      }

      const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item]));
      const nowIso = this.timeSource.nowIso();

      for (const candidate of rankedCandidates) {
        const queueItem = queueByRequestId.get(candidate.requestId);
        if (!queueItem || queueItem.status !== "queued") {
          continue;
        }

        const request = await this.requestStore.getRequestById(queueItem.requestId);
        if (!request) {
          await this.queueStore.complete(queueItem.requestId);
          continue;
        }

        if (request.state !== "queued" && request.state !== "retrying") {
          continue;
        }

        let canonicalPurchase = this.canonicalPurchaseStore
          ? await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, request)
          : null;
        if (canonicalPurchase) {
          canonicalPurchase = queueCanonicalPurchase(canonicalPurchase, {
            eventId: `${canonicalPurchase.snapshot.purchaseId}:queued:backfill`,
            occurredAt: nowIso,
            note: "canonical purchase backfilled from queued compatibility request"
          });
          canonicalPurchase = beginCanonicalPurchaseProcessing(canonicalPurchase, {
            eventId: `${canonicalPurchase.snapshot.purchaseId}:processing:${queueItem.attemptCount + 1}`,
            occurredAt: nowIso,
            note: `purchase execution reserved by ${workerId}`
          });
          await this.canonicalPurchaseStore!.savePurchase(canonicalPurchase);
        }
        const nextRequest = appendPurchaseRequestTransition(request, "executing", {
          eventId: `${request.snapshot.requestId}:executing:${queueItem.attemptCount + 1}`,
          occurredAt: nowIso,
          note: `terminal execution reserved by ${workerId}`
        });
        const nextQueueItem = await this.queueStore.reserve(queueItem.requestId);
        if (!nextQueueItem) {
          continue;
        }
        try {
          await this.requestStore.saveRequest(nextRequest);
        } catch (error) {
          await this.queueStore.requeue(queueItem.requestId).catch(() => undefined);
          throw error;
        }

        keepLock = true;
        return {
          workerId,
          request: nextRequest,
          queueItem: nextQueueItem
        };
      }

      return null;
    } finally {
      if (!keepLock) {
        await this.executionLock.release(workerId);
      }
    }
  }

  async releaseExecutionLock(input: ReserveNextQueuedRequestInput): Promise<void> {
    const workerId = normalizeWorkerId(input.workerId);
    await this.executionLock.release(workerId);
  }

  private async repairRecoveredExecutingItems(
    queueItems: readonly PurchaseQueueItem[]
  ): Promise<readonly PurchaseQueueItem[] | null> {
    if (!this.canonicalPurchaseStore) {
      return null;
    }

    let changed = false;
    for (const queueItem of queueItems.filter((item) => item.status === "executing")) {
      const request = await this.requestStore.getRequestById(queueItem.requestId);
      if (!request) {
          await this.queueStore.complete(queueItem.requestId);
          changed = true;
          continue;
        }

      const canonicalPurchase = await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, request);
      if (canonicalPurchase.status === "purchase_failed_retryable") {
        await this.queueStore.requeue(queueItem.requestId);
        changed = true;
        continue;
      }

      if (
        canonicalPurchase.status === "purchase_failed_final" ||
        canonicalPurchase.status === "purchased" ||
        canonicalPurchase.status === "awaiting_draw_close" ||
        canonicalPurchase.status === "settled" ||
        canonicalPurchase.status === "canceled"
      ) {
        await this.queueStore.complete(queueItem.requestId);
        changed = true;
        continue;
      }

      return null;
    }

    return changed ? this.queueStore.listSnapshot() : queueItems;
  }
}

function normalizeWorkerId(workerId: string): string {
  const normalized = workerId.trim();
  if (!normalized) {
    throw new Error("workerId is required");
  }
  return normalized;
}
