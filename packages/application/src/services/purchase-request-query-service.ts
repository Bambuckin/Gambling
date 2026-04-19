import type { RequestState } from "@lottery/domain";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";

export interface PurchaseRequestQueryServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
}

export interface PurchaseRequestStatusView {
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly status: RequestState;
  readonly attemptCount: number;
  readonly costMinor: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly finalResult: string | null;
}

export class PurchaseRequestQueryService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;

  constructor(dependencies: PurchaseRequestQueryServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
  }

  async listUserRequests(userId: string): Promise<PurchaseRequestStatusView[]> {
    const normalizedUserId = userId.trim();
    const records = await this.requestStore.listRequests();
    const queueItems = await this.queueStore.listQueueItems();
    const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item]));

    const statusViews = records
      .filter((record) => record.snapshot.userId === normalizedUserId)
      .map((record) => toStatusView(record, queueByRequestId.get(record.snapshot.requestId)))
      .sort((left, right) => compareStatusViews(left, right));

    return statusViews;
  }

  async listQueueItems(): Promise<PurchaseQueueItem[]> {
    const queueItems = await this.queueStore.listQueueItems();
    return queueItems.map((item) => ({ ...item }));
  }
}

function toStatusView(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  queueItem: PurchaseQueueItem | undefined
): PurchaseRequestStatusView {
  const latestEntry = record.journal.at(-1);
  const updatedAt = latestEntry?.occurredAt ?? record.snapshot.createdAt;
  const attemptCount = queueItem?.attemptCount ?? deriveAttemptCount(record.journal);
  const finalResult = resolveFinalResult(record.state, latestEntry?.note);

  return {
    requestId: record.snapshot.requestId,
    lotteryCode: record.snapshot.lotteryCode,
    drawId: record.snapshot.drawId,
    status: record.state,
    attemptCount,
    costMinor: record.snapshot.costMinor,
    currency: record.snapshot.currency,
    createdAt: record.snapshot.createdAt,
    updatedAt,
    finalResult
  };
}

function deriveAttemptCount(
  journal: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]["journal"]
): number {
  const executionEvents = journal.filter((entry) => entry.toState === "executing").length;
  return executionEvents;
}

function resolveFinalResult(status: RequestState, note: string | undefined): string | null {
  if (
    status !== "added_to_cart" &&
    status !== "success" &&
    status !== "error" &&
    status !== "reserve_released"
  ) {
    return null;
  }

  return note ?? status;
}

function compareStatusViews(left: PurchaseRequestStatusView, right: PurchaseRequestStatusView): number {
  const updatedDiff = right.updatedAt.localeCompare(left.updatedAt);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return right.requestId.localeCompare(left.requestId);
}
