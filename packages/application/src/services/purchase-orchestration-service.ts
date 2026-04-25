import {
  assertCancelableRequestState,
  appendPurchaseRequestTransition,
  type CanonicalPurchaseRecord,
  type LedgerEntry,
  type PurchaseRequestRecord
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { TimeSource } from "../ports/time-source.js";
import type { PurchaseQueueItem, PurchaseQueuePriority } from "../ports/purchase-queue-store.js";
import type { PurchaseQueueTransport } from "../ports/purchase-queue-transport.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import {
  ensureCanonicalPurchaseForRequest,
  loadCanonicalPurchaseForRequest,
  markCanonicalPurchaseCanceled,
  queueCanonicalPurchase
} from "./canonical-purchase-state.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";

export interface PurchaseOrchestrationServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueTransport;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly walletLedgerService: WalletLedgerService;
  readonly timeSource: TimeSource;
}

export interface ConfirmAndQueueInput {
  readonly requestId: string;
  readonly userId: string;
  readonly priority?: PurchaseQueuePriority;
}

export interface ConfirmAndQueueResult {
  readonly request: PurchaseRequestRecord;
  readonly queueItem: PurchaseQueueItem;
  readonly replayed: boolean;
}

export interface RecoverInterruptedRequestsInput {
  readonly userId: string;
  readonly lotteryCode?: string;
  readonly requestId?: string;
}

export interface RecoverInterruptedRequestResult {
  readonly requestId: string;
  readonly recovered: boolean;
  readonly replayed: boolean;
  readonly state: PurchaseRequestRecord["state"] | null;
  readonly message: string | null;
}

export interface ReconcileDetachedReservesInput {
  readonly userId: string;
  readonly lotteryCode?: string;
  readonly currency?: string;
}

export interface ReconcileDetachedReservesResult {
  readonly debitedRequests: number;
  readonly releasedRequests: number;
  readonly skippedActiveRequests: number;
}

export interface CancelQueuedRequestInput {
  readonly requestId: string;
  readonly userId: string;
}

export interface CancelQueuedRequestResult {
  readonly request: PurchaseRequestRecord;
  readonly replayed: boolean;
}

export interface ReprioritizeQueuedRequestInput {
  readonly requestId: string;
  readonly priority: PurchaseQueuePriority;
}

export interface ConfirmAndQueueAsAdminPriorityInput {
  readonly requestId: string;
}

export type PurchaseOrchestrationErrorCode =
  | "request_not_found"
  | "request_user_mismatch"
  | "request_state_invalid";

export class PurchaseOrchestrationServiceError extends Error {
  readonly code: PurchaseOrchestrationErrorCode;

  constructor(
    message: string,
    options: {
      readonly code: PurchaseOrchestrationErrorCode;
    }
  ) {
    super(message);
    this.name = "PurchaseOrchestrationServiceError";
    this.code = options.code;
  }
}

export class PurchaseOrchestrationService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueTransport;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly walletLedgerService: WalletLedgerService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: PurchaseOrchestrationServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.walletLedgerService = dependencies.walletLedgerService;
    this.timeSource = dependencies.timeSource;
  }

  async confirmAndQueueRequest(input: ConfirmAndQueueInput): Promise<ConfirmAndQueueResult> {
    const requestId = input.requestId.trim();
    const userId = input.userId.trim();
    if (!requestId) {
      throw new PurchaseOrchestrationServiceError("requestId is required", {
        code: "request_not_found"
      });
    }
    if (!userId) {
      throw new PurchaseOrchestrationServiceError("userId is required", {
        code: "request_user_mismatch"
      });
    }

    const existing = await this.requestStore.getRequestById(requestId);
    if (!existing) {
      throw new PurchaseOrchestrationServiceError(`request "${requestId}" not found`, {
        code: "request_not_found"
      });
    }

    if (existing.snapshot.userId !== userId) {
      throw new PurchaseOrchestrationServiceError(`request "${requestId}" does not belong to user "${userId}"`, {
        code: "request_user_mismatch"
      });
    }

    const queuedItem = await this.queueStore.getByRequestId(requestId);
    let canonicalPurchase = this.canonicalPurchaseStore
      ? await loadCanonicalPurchaseForRequest(this.canonicalPurchaseStore, existing.snapshot.requestId)
      : null;
    if (existing.state === "queued" && queuedItem) {
      if (this.canonicalPurchaseStore) {
        canonicalPurchase ??= await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, existing);
        const queuedCanonicalPurchase = queueCanonicalPurchase(canonicalPurchase, {
          eventId: `${canonicalPurchase.snapshot.purchaseId}:queued`,
          occurredAt: this.timeSource.nowIso(),
          note: "canonical purchase aligned with queued compatibility request"
        });
        if (queuedCanonicalPurchase !== canonicalPurchase) {
          await this.canonicalPurchaseStore!.savePurchase(queuedCanonicalPurchase);
        }
      }
      return {
        request: existing,
        queueItem: queuedItem,
        replayed: true
      };
    }

    if (existing.state !== "awaiting_confirmation" && existing.state !== "confirmed" && existing.state !== "queued") {
      throw new PurchaseOrchestrationServiceError(
        `request "${requestId}" cannot be queued from state "${existing.state}"`,
        {
          code: "request_state_invalid"
        }
      );
    }

    await this.walletLedgerService.reserveFunds({
      userId: existing.snapshot.userId,
      requestId: existing.snapshot.requestId,
      amountMinor: existing.snapshot.costMinor,
      currency: existing.snapshot.currency,
      drawId: existing.snapshot.drawId,
      idempotencyKey: `${existing.snapshot.requestId}:reserve`
    });

    const nowIso = this.timeSource.nowIso();
    let nextRecord = cloneRecord(existing);
    if (this.canonicalPurchaseStore) {
      canonicalPurchase ??= await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, existing);
      canonicalPurchase = queueCanonicalPurchase(canonicalPurchase, {
        eventId: `${canonicalPurchase.snapshot.purchaseId}:queued`,
        occurredAt: nowIso,
        note: "purchase inserted into compatibility queue"
      });
    }

    if (nextRecord.state === "awaiting_confirmation") {
      nextRecord = appendPurchaseRequestTransition(nextRecord, "confirmed", {
        eventId: `${requestId}:confirmed`,
        occurredAt: nowIso,
        note: "request confirmed for queueing"
      });
    }

    if (nextRecord.state === "confirmed") {
      nextRecord = appendPurchaseRequestTransition(nextRecord, "queued", {
        eventId: `${requestId}:queued`,
        occurredAt: nowIso,
        note: "request inserted into purchase queue"
      });
    }

    const queueItemToSave: PurchaseQueueItem =
      queuedItem ??
      {
        requestId: nextRecord.snapshot.requestId,
        lotteryCode: nextRecord.snapshot.lotteryCode,
        userId: nextRecord.snapshot.userId,
        drawId: nextRecord.snapshot.drawId,
        attemptCount: 0,
        priority: input.priority ?? "regular",
        enqueuedAt: nowIso,
        status: "queued"
      };

    await this.requestStore.saveRequest(nextRecord);
    if (canonicalPurchase) {
      await this.canonicalPurchaseStore!.savePurchase(canonicalPurchase);
    }
    await this.queueStore.enqueue(queueItemToSave);

    return {
      request: nextRecord,
      queueItem: queueItemToSave,
      replayed: existing.state === "queued" && queuedItem !== null
    };
  }

  async recoverInterruptedRequests(
    input: RecoverInterruptedRequestsInput
  ): Promise<readonly RecoverInterruptedRequestResult[]> {
    const userId = input.userId.trim();
    if (!userId) {
      throw new PurchaseOrchestrationServiceError("userId is required", {
        code: "request_user_mismatch"
      });
    }

    const requestId = input.requestId?.trim() ?? "";
    const lotteryCode = input.lotteryCode?.trim().toLowerCase() ?? "";
    const candidates = requestId
      ? await this.listRecoverableRequestsById(requestId, userId, lotteryCode)
      : await this.listRecoverableRequests(userId, lotteryCode);
    const results: RecoverInterruptedRequestResult[] = [];

    for (const candidate of candidates) {
      try {
        const recovered = await this.confirmAndQueueRequest({
          requestId: candidate.snapshot.requestId,
          userId
        });
        results.push({
          requestId: candidate.snapshot.requestId,
          recovered: true,
          replayed: recovered.replayed,
          state: recovered.request.state,
          message: null
        });
      } catch (error) {
        results.push({
          requestId: candidate.snapshot.requestId,
          recovered: false,
          replayed: false,
          state: candidate.state,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  async reconcileDetachedReserves(
    input: ReconcileDetachedReservesInput
  ): Promise<ReconcileDetachedReservesResult> {
    const userId = input.userId.trim();
    if (!userId) {
      throw new PurchaseOrchestrationServiceError("userId is required", {
        code: "request_user_mismatch"
      });
    }

    const lotteryCode = input.lotteryCode?.trim().toLowerCase() ?? "";
    const currency = input.currency?.trim().toUpperCase() ?? "";
    const [ledgerEntries, requests, queueItems, canonicalPurchases] = await Promise.all([
      this.walletLedgerService.listEntries(userId),
      this.requestStore.listRequests(),
      this.queueStore.listSnapshot(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);
    const pendingReserves = collectPendingReserveGroups(ledgerEntries, currency);
    const requestById = new Map(
      requests
        .filter((request) => request.snapshot.userId === userId)
        .map((request) => [request.snapshot.requestId, request] as const)
    );
    const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item] as const));
    const canonicalByRequestId = new Map(
      canonicalPurchases
        .filter((purchase) => purchase.snapshot.userId === userId)
        .map((purchase) => [purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId, purchase] as const)
    );
    let debitedRequests = 0;
    let releasedRequests = 0;
    let skippedActiveRequests = 0;

    for (const reserve of pendingReserves) {
      const request = requestById.get(reserve.requestId) ?? null;
      const canonicalPurchase = canonicalByRequestId.get(reserve.requestId) ?? null;
      const effectiveLotteryCode = canonicalPurchase?.snapshot.lotteryCode ?? request?.snapshot.lotteryCode ?? "";
      if (lotteryCode && effectiveLotteryCode !== lotteryCode) {
        continue;
      }

      const queueItem = queueByRequestId.get(reserve.requestId) ?? null;
      if (queueItem && (queueItem.status === "queued" || queueItem.status === "executing")) {
        skippedActiveRequests++;
        continue;
      }

      const drawId = canonicalPurchase?.snapshot.drawId ?? request?.snapshot.drawId ?? reserve.drawId ?? undefined;
      if (shouldDebitDetachedReserve(request, canonicalPurchase)) {
        await this.walletLedgerService.debitReservedFunds({
          userId,
          requestId: reserve.requestId,
          amountMinor: reserve.amountMinor,
          currency: reserve.currency,
          ...(drawId ? { drawId } : {}),
          idempotencyKey: `${reserve.requestId}:reserve-reconcile:debit`
        });
        debitedRequests++;
        continue;
      }

      await this.walletLedgerService.releaseReservedFunds({
        userId,
        requestId: reserve.requestId,
        amountMinor: reserve.amountMinor,
        currency: reserve.currency,
        ...(drawId ? { drawId } : {}),
        idempotencyKey: `${reserve.requestId}:reserve-reconcile:release`
      });
      if (request && isReserveReleaseTransitionAllowed(request.state)) {
        await this.requestStore.saveRequest(
          appendPurchaseRequestTransition(request, "reserve_released", {
            eventId: `${reserve.requestId}:reserve-reconcile:reserve-released`,
            occurredAt: this.timeSource.nowIso(),
            note: "stale reserve released because request is no longer in active queue"
          })
        );
      }
      releasedRequests++;
    }

    return {
      debitedRequests,
      releasedRequests,
      skippedActiveRequests
    };
  }

  async confirmAndQueueAsAdminPriority(input: ConfirmAndQueueAsAdminPriorityInput): Promise<ConfirmAndQueueResult> {
    const requestId = input.requestId.trim();
    if (!requestId) {
      throw new PurchaseOrchestrationServiceError("requestId is required", {
        code: "request_not_found"
      });
    }

    const existing = await this.requestStore.getRequestById(requestId);
    if (!existing) {
      throw new PurchaseOrchestrationServiceError(`request "${requestId}" not found`, {
        code: "request_not_found"
      });
    }

    const result = await this.confirmAndQueueRequest({
      requestId,
      userId: existing.snapshot.userId,
      priority: "admin-priority"
    });

    if (result.queueItem.priority === "admin-priority" || result.queueItem.status !== "queued") {
      return result;
    }

    const reprioritizedQueueItem = await this.reprioritizeQueuedRequest({
      requestId,
      priority: "admin-priority"
    });

    return {
      ...result,
      queueItem: reprioritizedQueueItem
    };
  }

  async reprioritizeQueuedRequest(input: ReprioritizeQueuedRequestInput): Promise<PurchaseQueueItem> {
    const requestId = input.requestId.trim();
    if (!requestId) {
      throw new PurchaseOrchestrationServiceError("requestId is required", {
        code: "request_not_found"
      });
    }

    const queueItem = await this.queueStore.getByRequestId(requestId);
    if (!queueItem) {
      throw new PurchaseOrchestrationServiceError(`queued request "${requestId}" not found`, {
        code: "request_not_found"
      });
    }

    if (queueItem.status !== "queued") {
      throw new PurchaseOrchestrationServiceError(
        `request "${requestId}" cannot be reprioritized from queue status "${queueItem.status}"`,
        {
          code: "request_state_invalid"
        }
      );
    }

    if (queueItem.priority === input.priority) {
      return queueItem;
    }

    const nextQueueItem = await this.queueStore.reprioritize(requestId, input.priority);
    if (!nextQueueItem) {
      throw new PurchaseOrchestrationServiceError(`queued request "${requestId}" not found`, {
        code: "request_not_found"
      });
    }
    return nextQueueItem;
  }

  async cancelQueuedRequest(input: CancelQueuedRequestInput): Promise<CancelQueuedRequestResult> {
    const requestId = input.requestId.trim();
    const userId = input.userId.trim();
    if (!requestId) {
      throw new PurchaseOrchestrationServiceError("requestId is required", {
        code: "request_not_found"
      });
    }
    if (!userId) {
      throw new PurchaseOrchestrationServiceError("userId is required", {
        code: "request_user_mismatch"
      });
    }

    const existing = await this.requestStore.getRequestById(requestId);
    if (!existing) {
      throw new PurchaseOrchestrationServiceError(`request "${requestId}" not found`, {
        code: "request_not_found"
      });
    }

    if (existing.snapshot.userId !== userId) {
      throw new PurchaseOrchestrationServiceError(`request "${requestId}" does not belong to user "${userId}"`, {
        code: "request_user_mismatch"
      });
    }

    if (existing.state === "reserve_released") {
      if (this.canonicalPurchaseStore) {
        const canonicalPurchase = await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, existing);
        const nextCanonicalPurchase = markCanonicalPurchaseCanceled(canonicalPurchase, {
          eventId: `${canonicalPurchase.snapshot.purchaseId}:canceled`,
          occurredAt: this.timeSource.nowIso(),
          note: "purchase canceled before execution"
        });
        if (nextCanonicalPurchase !== canonicalPurchase) {
          await this.canonicalPurchaseStore.savePurchase(nextCanonicalPurchase);
        }
      }
      await this.queueStore.complete(requestId);
      return {
        request: existing,
        replayed: true
      };
    }

    let nextRecord = cloneRecord(existing);
    const nowIso = this.timeSource.nowIso();
    let canonicalPurchase = this.canonicalPurchaseStore
      ? await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, existing)
      : null;

    if (nextRecord.state === "canceled") {
      if (canonicalPurchase) {
        canonicalPurchase = markCanonicalPurchaseCanceled(canonicalPurchase, {
          eventId: `${canonicalPurchase.snapshot.purchaseId}:canceled`,
          occurredAt: nowIso,
          note: "purchase canceled before execution"
        });
      }
      await this.walletLedgerService.releaseReservedFunds({
        userId: nextRecord.snapshot.userId,
        requestId: nextRecord.snapshot.requestId,
        amountMinor: nextRecord.snapshot.costMinor,
        currency: nextRecord.snapshot.currency,
        drawId: nextRecord.snapshot.drawId,
        idempotencyKey: `${nextRecord.snapshot.requestId}:cancel-release`
      });
      nextRecord = appendPurchaseRequestTransition(nextRecord, "reserve_released", {
        eventId: `${requestId}:reserve_released`,
        occurredAt: nowIso,
        note: "reserve released after cancellation"
      });
      await this.requestStore.saveRequest(nextRecord);
      if (canonicalPurchase) {
        await this.canonicalPurchaseStore!.savePurchase(canonicalPurchase);
      }
        await this.queueStore.complete(requestId);
      return {
        request: nextRecord,
        replayed: false
      };
    }

    try {
      assertCancelableRequestState(nextRecord.state);
    } catch (error) {
      throw new PurchaseOrchestrationServiceError(
        `request "${requestId}" cannot be canceled from state "${nextRecord.state}"`,
        {
          code: "request_state_invalid"
        }
      );
    }

    if (canonicalPurchase) {
      canonicalPurchase = markCanonicalPurchaseCanceled(canonicalPurchase, {
        eventId: `${canonicalPurchase.snapshot.purchaseId}:canceled`,
        occurredAt: nowIso,
        note: "purchase canceled before execution"
      });
    }
    nextRecord = appendPurchaseRequestTransition(nextRecord, "canceled", {
      eventId: `${requestId}:canceled`,
      occurredAt: nowIso,
      note: "request canceled before terminal execution"
    });

    await this.walletLedgerService.releaseReservedFunds({
      userId: nextRecord.snapshot.userId,
      requestId: nextRecord.snapshot.requestId,
      amountMinor: nextRecord.snapshot.costMinor,
      currency: nextRecord.snapshot.currency,
      drawId: nextRecord.snapshot.drawId,
      idempotencyKey: `${nextRecord.snapshot.requestId}:cancel-release`
    });

    nextRecord = appendPurchaseRequestTransition(nextRecord, "reserve_released", {
      eventId: `${requestId}:reserve_released`,
      occurredAt: nowIso,
      note: "reserve released after cancellation"
    });

    await this.requestStore.saveRequest(nextRecord);
    if (canonicalPurchase) {
      await this.canonicalPurchaseStore!.savePurchase(canonicalPurchase);
    }
    await this.queueStore.complete(requestId);

    return {
      request: nextRecord,
      replayed: false
    };
  }

  private async listRecoverableRequests(
    userId: string,
    lotteryCode: string
  ): Promise<readonly PurchaseRequestRecord[]> {
    const requests = await this.requestStore.listRequests();
    return requests.filter(
      (request) =>
        request.snapshot.userId === userId &&
        (!lotteryCode || request.snapshot.lotteryCode === lotteryCode) &&
        isRecoverableRequestState(request.state)
    );
  }

  private async listRecoverableRequestsById(
    requestId: string,
    userId: string,
    lotteryCode: string
  ): Promise<readonly PurchaseRequestRecord[]> {
    const request = await this.requestStore.getRequestById(requestId);
    if (!request) {
      return [];
    }

    if (request.snapshot.userId !== userId) {
      return [];
    }

    if (lotteryCode && request.snapshot.lotteryCode !== lotteryCode) {
      return [];
    }

    return isRecoverableRequestState(request.state) ? [request] : [];
  }
}

function cloneRecord(record: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function isRecoverableRequestState(
  state: PurchaseRequestRecord["state"]
): state is "awaiting_confirmation" | "confirmed" {
  return state === "awaiting_confirmation" || state === "confirmed";
}

interface PendingReserveGroup {
  readonly requestId: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly drawId: string | null;
}

function collectPendingReserveGroups(
  entries: readonly LedgerEntry[],
  currencyFilter: string
): PendingReserveGroup[] {
  const groups = new Map<string, {
    readonly requestId: string;
    readonly currency: string;
    amountMinor: number;
    drawId: string | null;
  }>();

  for (const entry of entries) {
    const requestId = entry.reference.requestId?.trim();
    if (!requestId || (currencyFilter && entry.currency !== currencyFilter)) {
      continue;
    }

    const key = `${entry.currency}:${requestId}`;
    const group = groups.get(key) ?? {
      requestId,
      currency: entry.currency,
      amountMinor: 0,
      drawId: entry.reference.drawId ?? null
    };

    if (entry.operation === "reserve") {
      group.amountMinor += entry.amountMinor;
    } else if (entry.operation === "debit" || entry.operation === "release") {
      group.amountMinor -= entry.amountMinor;
    }

    if (!group.drawId && entry.reference.drawId) {
      group.drawId = entry.reference.drawId;
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.amountMinor > 0)
    .map((group) => ({ ...group }));
}

function shouldDebitDetachedReserve(
  request: PurchaseRequestRecord | null,
  canonicalPurchase: CanonicalPurchaseRecord | null
): boolean {
  if (request?.state === "success") {
    return true;
  }

  return (
    canonicalPurchase?.status === "purchased" ||
    canonicalPurchase?.status === "awaiting_draw_close" ||
    canonicalPurchase?.status === "settled"
  );
}

function isReserveReleaseTransitionAllowed(state: PurchaseRequestRecord["state"]): boolean {
  return (
    state === "confirmed" ||
    state === "queued" ||
    state === "executing" ||
    state === "retrying" ||
    state === "canceled" ||
    state === "error"
  );
}
