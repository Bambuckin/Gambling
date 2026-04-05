import {
  assertCancelableRequestState,
  appendPurchaseRequestTransition,
  type PurchaseRequestRecord
} from "@lottery/domain";
import type { TimeSource } from "../ports/time-source.js";
import type { PurchaseQueueItem, PurchaseQueuePriority, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";

export interface PurchaseOrchestrationServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
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
  private readonly walletLedgerService: WalletLedgerService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: PurchaseOrchestrationServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
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
    if (existing.state === "queued" && queuedItem) {
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
    await this.queueStore.saveQueueItem(queueItemToSave);

    return {
      request: nextRecord,
      queueItem: queueItemToSave,
      replayed: existing.state === "queued" && queuedItem !== null
    };
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
      await this.queueStore.removeQueueItem(requestId);
      return {
        request: existing,
        replayed: true
      };
    }

    let nextRecord = cloneRecord(existing);
    const nowIso = this.timeSource.nowIso();

    if (nextRecord.state === "canceled") {
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
