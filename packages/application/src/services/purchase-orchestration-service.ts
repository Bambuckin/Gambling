import {
  assertCancelableRequestState,
  appendPurchaseRequestTransition,
  type PurchaseRequestRecord
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { TimeSource } from "../ports/time-source.js";
import type { PurchaseQueueItem, PurchaseQueuePriority, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import {
  ensureCanonicalPurchaseForRequest,
  markCanonicalPurchaseCanceled,
  queueCanonicalPurchase
} from "./canonical-purchase-state.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";

export interface PurchaseOrchestrationServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
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
  private readonly queueStore: PurchaseQueueStore;
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

    const queuedItem = await this.queueStore.getQueueItemByRequestId(requestId);
    let canonicalPurchase = this.canonicalPurchaseStore
      ? await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, existing)
      : null;
    if (existing.state === "queued" && queuedItem) {
      if (canonicalPurchase) {
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
    if (canonicalPurchase) {
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
    await this.queueStore.saveQueueItem(queueItemToSave);

    return {
      request: nextRecord,
      queueItem: queueItemToSave,
      replayed: existing.state === "queued" && queuedItem !== null
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

    const queueItem = await this.queueStore.getQueueItemByRequestId(requestId);
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

    const nextQueueItem: PurchaseQueueItem = {
      ...queueItem,
      priority: input.priority
    };

    await this.queueStore.saveQueueItem(nextQueueItem);
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
      await this.queueStore.removeQueueItem(requestId);
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
      await this.queueStore.removeQueueItem(requestId);
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
    await this.queueStore.removeQueueItem(requestId);

    return {
      request: nextRecord,
      replayed: false
    };
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
