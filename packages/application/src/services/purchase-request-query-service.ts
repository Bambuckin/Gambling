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
    const normalizedUserId = userId.trim();
    const [records, queueItems, canonicalPurchases] = await Promise.all([
      this.requestStore.listRequests(),
      this.queueStore.listQueueItems(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);
    const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item]));
    const filteredCanonicalPurchases = canonicalPurchases.filter(
      (purchase) => purchase.snapshot.userId === normalizedUserId
    );
    const attemptsByPurchaseId = buildCanonicalAttemptMap(await this.listCanonicalAttempts(filteredCanonicalPurchases));
    const canonicalByRequestId = new Map(
      filteredCanonicalPurchases.map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase])
    );
    const coveredRequestIds = new Set<string>();

    const statusViews = records
      .filter((record) => record.snapshot.userId === normalizedUserId)
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

  async listQueueItems(): Promise<PurchaseQueueItem[]> {
    const queueItems = await this.queueStore.listQueueItems();
    return queueItems.map((item) => ({ ...item }));
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
  const attemptCount = projected?.attemptCount ?? queueItem?.attemptCount ?? deriveAttemptCount(record.journal);
  const status = projected?.status ?? record.state;
  const finalResult = projected?.finalResult ?? resolveFinalResult(status, latestEntry?.note);

  return {
    requestId: record.snapshot.requestId,
    lotteryCode: record.snapshot.lotteryCode,
    drawId: record.snapshot.drawId,
    status,
    attemptCount,
    costMinor: record.snapshot.costMinor,
    currency: record.snapshot.currency,
    createdAt: record.snapshot.createdAt,
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
