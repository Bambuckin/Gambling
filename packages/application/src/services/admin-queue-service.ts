import { rankQueueForExecution, type RequestState } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseQueuePriority, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { ConfirmAndQueueResult } from "./purchase-orchestration-service.js";
import { PurchaseOrchestrationService } from "./purchase-orchestration-service.js";
import { mapCanonicalPurchaseStatusToRequestState } from "./canonical-compatibility.js";

export interface AdminQueueServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly purchaseOrchestrationService: PurchaseOrchestrationService;
}

export interface AdminQueueRow {
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly status: "queued" | "executing";
  readonly priority: PurchaseQueuePriority;
  readonly attemptCount: number;
  readonly enqueuedAt: string;
  readonly requestState: RequestState | "missing";
  readonly executionOrder: number | null;
}

export interface AdminQueueSnapshot {
  readonly activeExecutionRequestId: string | null;
  readonly queueDepth: number;
  readonly queuedCount: number;
  readonly executingCount: number;
  readonly adminPriorityQueuedCount: number;
  readonly regularQueuedCount: number;
  readonly rows: readonly AdminQueueRow[];
}

export interface SetQueuePriorityInput {
  readonly requestId: string;
  readonly priority: PurchaseQueuePriority;
}

export interface EnqueueAsAdminPriorityInput {
  readonly requestId: string;
}

export class AdminQueueService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly purchaseOrchestrationService: PurchaseOrchestrationService;

  constructor(dependencies: AdminQueueServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.purchaseOrchestrationService = dependencies.purchaseOrchestrationService;
  }

  async getQueueSnapshot(): Promise<AdminQueueSnapshot> {
    const [queueItems, requests, canonicalPurchases] = await Promise.all([
      this.queueStore.listQueueItems(),
      this.requestStore.listRequests(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);

    const canonicalStateByRequestId = new Map(
      canonicalPurchases.map((purchase) => [
        purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId,
        mapCanonicalPurchaseStatusToRequestState(purchase)
      ] as const)
    );
    const requestStateById = new Map(canonicalStateByRequestId);
    for (const record of requests) {
      requestStateById.set(
        record.snapshot.requestId,
        canonicalStateByRequestId.get(record.snapshot.requestId) ?? record.state
      );
    }

    const queuedItems = queueItems.filter((item) => item.status === "queued");
    const executingItems = queueItems.filter((item) => item.status === "executing");
    const rankedQueuedItems = rankQueueForExecution(queuedItems);
    const executionOrderByRequestId = new Map(
      rankedQueuedItems.map((item, index) => [item.requestId, index + 1] as const)
    );

    const rows: AdminQueueRow[] = [
      ...executingItems
        .sort((left, right) => left.enqueuedAt.localeCompare(right.enqueuedAt))
        .map((item) => toRow(item, requestStateById, null)),
      ...rankedQueuedItems.map((item) =>
        toRow(item, requestStateById, executionOrderByRequestId.get(item.requestId) ?? null)
      )
    ];

    return {
      activeExecutionRequestId: executingItems[0]?.requestId ?? null,
      queueDepth: queueItems.length,
      queuedCount: queuedItems.length,
      executingCount: executingItems.length,
      adminPriorityQueuedCount: queuedItems.filter((item) => item.priority === "admin-priority").length,
      regularQueuedCount: queuedItems.filter((item) => item.priority === "regular").length,
      rows
    };
  }

  async setQueuePriority(input: SetQueuePriorityInput) {
    return this.purchaseOrchestrationService.reprioritizeQueuedRequest(input);
  }

  async enqueueAsAdminPriority(input: EnqueueAsAdminPriorityInput): Promise<ConfirmAndQueueResult> {
    return this.purchaseOrchestrationService.confirmAndQueueAsAdminPriority(input);
  }
}

function toRow(
  item: Awaited<ReturnType<PurchaseQueueStore["listQueueItems"]>>[number],
  requestStateById: ReadonlyMap<string, RequestState>,
  executionOrder: number | null
): AdminQueueRow {
  return {
    requestId: item.requestId,
    userId: item.userId,
    lotteryCode: item.lotteryCode,
    drawId: item.drawId,
    status: item.status,
    priority: item.priority,
    attemptCount: item.attemptCount,
    enqueuedAt: item.enqueuedAt,
    requestState: requestStateById.get(item.requestId) ?? "missing",
    executionOrder
  };
}
