import { appendPurchaseRequestTransition, type PurchaseRequestRecord } from "@lottery/domain";
import type { CanonicalDrawStore } from "../ports/canonical-draw-store.js";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { DrawStore } from "../ports/draw-store.js";
import type { TimeSource } from "../ports/time-source.js";
import type { PurchaseAttemptStore } from "../ports/purchase-attempt-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { DrawClosureStore } from "../ports/draw-closure-store.js";
import type { CashDeskRequestStore } from "../ports/cash-desk-request-store.js";
import type { WinningsCreditJobStore } from "../ports/winnings-credit-job-store.js";
import type { SessionStore } from "../ports/session-store.js";
import type { TerminalExecutionLock } from "../ports/terminal-execution-lock.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";

export interface AdminTestResetServiceDependencies {
  readonly drawStore: DrawStore;
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  readonly canonicalDrawStore: CanonicalDrawStore;
  readonly purchaseAttemptStore: PurchaseAttemptStore;
  readonly ticketStore: TicketStore;
  readonly ledgerStore: LedgerStore;
  readonly notificationStore: NotificationStore;
  readonly drawClosureStore: DrawClosureStore;
  readonly cashDeskRequestStore: CashDeskRequestStore;
  readonly winningsCreditJobStore: WinningsCreditJobStore;
  readonly sessionStore: SessionStore;
  readonly executionLock: TerminalExecutionLock;
  readonly walletLedgerService: WalletLedgerService;
  readonly timeSource: TimeSource;
}

export interface ClearQueueResult {
  readonly removedQueueItems: number;
  readonly releasedReserves: number;
  readonly updatedRequests: number;
}

export interface ResetTestDataResult {
  readonly clearedDraws: boolean;
  readonly clearedRequests: boolean;
  readonly clearedQueue: boolean;
  readonly clearedCanonicalPurchases: boolean;
  readonly clearedCanonicalDraws: boolean;
  readonly clearedPurchaseAttempts: boolean;
  readonly clearedTickets: boolean;
  readonly clearedLedger: boolean;
  readonly clearedNotifications: boolean;
  readonly clearedDrawClosures: boolean;
  readonly clearedCashDeskRequests: boolean;
  readonly clearedCreditJobs: boolean;
  readonly clearedExecutionLocks: boolean;
  readonly revokedSessions: boolean;
}

export class AdminTestResetService {
  private readonly drawStore: DrawStore;
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore;
  private readonly canonicalDrawStore: CanonicalDrawStore;
  private readonly purchaseAttemptStore: PurchaseAttemptStore;
  private readonly ticketStore: TicketStore;
  private readonly ledgerStore: LedgerStore;
  private readonly notificationStore: NotificationStore;
  private readonly drawClosureStore: DrawClosureStore;
  private readonly cashDeskRequestStore: CashDeskRequestStore;
  private readonly winningsCreditJobStore: WinningsCreditJobStore;
  private readonly sessionStore: SessionStore;
  private readonly executionLock: TerminalExecutionLock;
  private readonly walletLedgerService: WalletLedgerService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: AdminTestResetServiceDependencies) {
    this.drawStore = dependencies.drawStore;
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore;
    this.canonicalDrawStore = dependencies.canonicalDrawStore;
    this.purchaseAttemptStore = dependencies.purchaseAttemptStore;
    this.ticketStore = dependencies.ticketStore;
    this.ledgerStore = dependencies.ledgerStore;
    this.notificationStore = dependencies.notificationStore;
    this.drawClosureStore = dependencies.drawClosureStore;
    this.cashDeskRequestStore = dependencies.cashDeskRequestStore;
    this.winningsCreditJobStore = dependencies.winningsCreditJobStore;
    this.sessionStore = dependencies.sessionStore;
    this.executionLock = dependencies.executionLock;
    this.walletLedgerService = dependencies.walletLedgerService;
    this.timeSource = dependencies.timeSource;
  }

  async clearQueue(): Promise<ClearQueueResult> {
    const queueItems = await this.queueStore.listQueueItems();
    let releasedReserves = 0;
    let updatedRequests = 0;

    for (const item of queueItems) {
      const request = await this.requestStore.getRequestById(item.requestId);
      if (request) {
        const nextRequest = await this.releaseRequestForTestReset(request);
        if (nextRequest) {
          updatedRequests++;
        }
      }

      if (request && request.state !== "success" && request.state !== "reserve_released") {
        try {
          await this.walletLedgerService.releaseReservedFunds({
            userId: request.snapshot.userId,
            requestId: request.snapshot.requestId,
            amountMinor: request.snapshot.costMinor,
            currency: request.snapshot.currency,
            idempotencyKey: `release:${request.snapshot.requestId}:clear-queue`
          });
          releasedReserves++;
        } catch {
          // reserve may already be released
        }
      }
      await this.queueStore.removeQueueItem(item.requestId);
    }

    await this.executionLock.clearAll();

    return {
      removedQueueItems: queueItems.length,
      releasedReserves,
      updatedRequests
    };
  }

  async resetTestData(): Promise<ResetTestDataResult> {
    await this.drawStore.clearAll();
    await this.requestStore.clearAll();
    await this.queueStore.clearAll();
    await this.canonicalPurchaseStore.clearAll();
    await this.canonicalDrawStore.clearAll();
    await this.purchaseAttemptStore.clearAll();
    await this.ticketStore.clearAll();
    await this.ledgerStore.clearAll();
    await this.notificationStore.clearAll();
    await this.drawClosureStore.clearAll();
    await this.cashDeskRequestStore.clearAll();
    await this.winningsCreditJobStore.clearAll();
    await this.executionLock.clearAll();
    await this.sessionStore.revokeAll(this.timeSource.nowIso());

    return {
      clearedDraws: true,
      clearedRequests: true,
      clearedQueue: true,
      clearedCanonicalPurchases: true,
      clearedCanonicalDraws: true,
      clearedPurchaseAttempts: true,
      clearedTickets: true,
      clearedLedger: true,
      clearedNotifications: true,
      clearedDrawClosures: true,
      clearedCashDeskRequests: true,
      clearedCreditJobs: true,
      clearedExecutionLocks: true,
      revokedSessions: true
    };
  }

  private async releaseRequestForTestReset(request: PurchaseRequestRecord): Promise<boolean> {
    const nowIso = this.timeSource.nowIso();
    let nextRequest = request;
    let changed = false;

    if (request.state === "queued" || request.state === "retrying") {
      nextRequest = appendPurchaseRequestTransition(nextRequest, "canceled", {
        eventId: `${request.snapshot.requestId}:test-reset:canceled`,
        occurredAt: nowIso,
        note: "request removed from queue by admin test reset"
      });
      changed = true;
    } else if (request.state === "executing") {
      nextRequest = appendPurchaseRequestTransition(nextRequest, "error", {
        eventId: `${request.snapshot.requestId}:test-reset:error`,
        occurredAt: nowIso,
        note: "request interrupted by admin test reset"
      });
      changed = true;
    }

    if (nextRequest.state === "canceled" || nextRequest.state === "error") {
      nextRequest = appendPurchaseRequestTransition(nextRequest, "reserve_released", {
        eventId: `${request.snapshot.requestId}:test-reset:reserve-released`,
        occurredAt: nowIso,
        note: "request reserve released by admin test reset"
      });
      changed = true;
    }

    if (!changed) {
      return false;
    }

    await this.requestStore.saveRequest(nextRequest);
    return true;
  }
}
