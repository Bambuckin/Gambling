import type { CanonicalPurchaseRecord, RequestState } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseAttemptStore } from "../ports/purchase-attempt-store.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import { buildCanonicalAttemptMap, projectCanonicalRequest } from "./canonical-compatibility.js";

export interface PurchaseRequestQueryServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly purchaseAttemptStore?: PurchaseAttemptStore;
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
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly purchaseAttemptStore: PurchaseAttemptStore | null;

  constructor(dependencies: PurchaseRequestQueryServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.purchaseAttemptStore = dependencies.purchaseAttemptStore ?? null;
  }

  async listUserRequests(userId: string): Promise<PurchaseRequestStatusView[]> {
    return this.listRequestViews({ userId });
  }

  async listRequestsByDraw(lotteryCode: string, drawId: string): Promise<PurchaseRequestStatusView[]> {
    return this.listRequestViews({ lotteryCode, drawId });
  }

  async listQueueItems(): Promise<PurchaseQueueItem[]> {
    const queueItems = await this.queueStore.listQueueItems();
    return queueItems.map((item) => ({ ...item }));
  }

  private async listRequestViews(filter: {
    readonly userId?: string;
    readonly lotteryCode?: string;
    readonly drawId?: string;
  }): Promise<PurchaseRequestStatusView[]> {
    const normalizedUserId = filter.userId?.trim() ?? null;
    const normalizedLotteryCode = filter.lotteryCode?.trim().toLowerCase() ?? null;
    const normalizedDrawId = filter.drawId?.trim() ?? null;

    if (filter.userId !== undefined && !normalizedUserId) {
      return [];
    }

    const [records, queueItems, canonicalPurchases] = await Promise.all([
      this.requestStore.listRequests(),
      this.queueStore.listQueueItems(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);
    const filteredRecords = records.filter((record) => matchesRequestFilter(record, normalizedUserId, normalizedLotteryCode, normalizedDrawId));
    const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item]));
    const filteredCanonicalPurchases = canonicalPurchases.filter((purchase) =>
      matchesCanonicalPurchaseFilter(purchase, normalizedUserId, normalizedLotteryCode, normalizedDrawId)
    );
    const attemptsByPurchaseId = buildCanonicalAttemptMap(await this.listCanonicalAttempts(filteredCanonicalPurchases));
    const canonicalByRequestId = new Map(
      filteredCanonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase])
    );
    const coveredRequestIds = new Set<string>();

    const statusViews = filteredRecords
      .map((record) => {
        const requestId = record.snapshot.requestId;
        coveredRequestIds.add(requestId);
        return toStatusView(
          record,
          queueByRequestId.get(requestId),
          canonicalByRequestId.get(requestId),
          attemptsByPurchaseId.get(canonicalByRequestId.get(requestId)?.snapshot.purchaseId ?? "")
        );
      })
      .concat(
        filteredCanonicalPurchases
          .filter((purchase) => !coveredRequestIds.has(purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId))
          .map((purchase) => toProjectedStatusView(purchase, attemptsByPurchaseId.get(purchase.snapshot.purchaseId)))
      )
      .sort((left, right) => compareStatusViews(left, right));

    return statusViews;
  }

  private async listCanonicalAttempts(
    purchases: readonly CanonicalPurchaseRecord[]
  ): Promise<readonly import("@lottery/domain").PurchaseAttemptRecord[]> {
    if (!this.purchaseAttemptStore || purchases.length === 0) {
      return [];
    }

    const attempts = await Promise.all(
      purchases.map((purchase) => this.purchaseAttemptStore!.listAttemptsByPurchaseId(purchase.snapshot.purchaseId))
    );

    return attempts.flat();
  }
}

function toStatusView(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  queueItem: PurchaseQueueItem | undefined,
  canonicalPurchase?: CanonicalPurchaseRecord,
  canonicalAttempts: readonly import("@lottery/domain").PurchaseAttemptRecord[] = []
): PurchaseRequestStatusView {
  const latestEntry = record.journal.at(-1);
  const projected = canonicalPurchase ? projectCanonicalRequest(canonicalPurchase, canonicalAttempts) : null;
  const updatedAt = projected?.updatedAt ?? latestEntry?.occurredAt ?? record.snapshot.createdAt;
  const attemptCount = Math.max(
    projected?.attemptCount ?? 0,
    queueItem?.attemptCount ?? 0,
    deriveAttemptCount(record.journal)
  );
  const status = resolveRequestStatus(record, projected?.status, queueItem, canonicalAttempts);
  const finalResult = projected?.finalResult ?? resolveFinalResult(status, latestEntry?.note);

  return {
    requestId: record.snapshot.requestId,
    lotteryCode: canonicalPurchase?.snapshot.lotteryCode ?? record.snapshot.lotteryCode,
    drawId: canonicalPurchase?.snapshot.drawId ?? record.snapshot.drawId,
    status,
    attemptCount,
    costMinor: canonicalPurchase?.snapshot.costMinor ?? record.snapshot.costMinor,
    currency: canonicalPurchase?.snapshot.currency ?? record.snapshot.currency,
    createdAt: canonicalPurchase?.snapshot.submittedAt ?? record.snapshot.createdAt,
    updatedAt,
    finalResult
  };
}

function toProjectedStatusView(
  purchase: CanonicalPurchaseRecord,
  canonicalAttempts: readonly import("@lottery/domain").PurchaseAttemptRecord[] = []
): PurchaseRequestStatusView {
  const projected = projectCanonicalRequest(purchase, canonicalAttempts);

  return {
    requestId: projected.requestId,
    lotteryCode: purchase.snapshot.lotteryCode,
    drawId: purchase.snapshot.drawId,
    status: projected.status,
    attemptCount: projected.attemptCount,
    costMinor: purchase.snapshot.costMinor,
    currency: purchase.snapshot.currency,
    createdAt: projected.createdAt,
    updatedAt: projected.updatedAt,
    finalResult: projected.finalResult
  };
}

function deriveAttemptCount(
  journal: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]["journal"]
): number {
  const executionEvents = journal.filter((entry) => entry.toState === "executing").length;
  return executionEvents;
}

function resolveRequestStatus(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  projectedStatus: RequestState | undefined,
  queueItem: PurchaseQueueItem | undefined,
  canonicalAttempts: readonly import("@lottery/domain").PurchaseAttemptRecord[]
): RequestState {
  if (!projectedStatus) {
    return record.state;
  }

  if (
    record.state === "awaiting_confirmation" &&
    projectedStatus === "confirmed" &&
    !queueItem &&
    canonicalAttempts.length === 0
  ) {
    return record.state;
  }

  return projectedStatus;
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

function matchesRequestFilter(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  userId: string | null,
  lotteryCode: string | null,
  drawId: string | null
): boolean {
  if (userId && record.snapshot.userId !== userId) {
    return false;
  }

  if (lotteryCode && record.snapshot.lotteryCode !== lotteryCode) {
    return false;
  }

  if (drawId && record.snapshot.drawId !== drawId) {
    return false;
  }

  return true;
}

function matchesCanonicalPurchaseFilter(
  purchase: CanonicalPurchaseRecord,
  userId: string | null,
  lotteryCode: string | null,
  drawId: string | null
): boolean {
  if (userId && purchase.snapshot.userId !== userId) {
    return false;
  }

  if (lotteryCode && purchase.snapshot.lotteryCode !== lotteryCode) {
    return false;
  }

  if (drawId && purchase.snapshot.drawId !== drawId) {
    return false;
  }

  return true;
}
