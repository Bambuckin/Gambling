import {
  appendPurchaseRequestTransition,
  createPurchaseAttemptRecord,
  formatTerminalAttemptJournalNote,
  normalizeTerminalAttempt,
  type PurchaseRequestRecord,
  type PurchaseAttemptRecord,
  type TicketRecord
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseAttemptStore } from "../ports/purchase-attempt-store.js";
import type { PurchaseQueueItem } from "../ports/purchase-queue-store.js";
import type { PurchaseQueueTransport } from "../ports/purchase-queue-transport.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TerminalExecutionResult } from "../ports/terminal-executor.js";
import { buildCanonicalTicketId } from "./canonical-compatibility.js";
import {
  applyCanonicalAttemptOutcome,
  ensureCanonicalPurchaseForRequest,
  markCanonicalPurchaseAwaitingDrawClose
} from "./canonical-purchase-state.js";
import type { TicketPersistenceService } from "./ticket-persistence-service.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";

export interface TerminalExecutionAttemptServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueTransport;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly purchaseAttemptStore?: PurchaseAttemptStore;
  readonly ticketPersistenceService?: TicketPersistenceService;
  readonly walletLedgerService?: WalletLedgerService;
}

export interface RecordTerminalAttemptInput {
  readonly requestId: string;
  readonly attempt: number;
  readonly startedAt: string;
  readonly result: TerminalExecutionResult;
}

export interface RecordTerminalAttemptResult {
  readonly request: PurchaseRequestRecord;
  readonly queueItem: PurchaseQueueItem | null;
  readonly ticket: TicketRecord | null;
  readonly journalNote: string;
}

export type TerminalExecutionAttemptServiceErrorCode =
  | "request_not_found"
  | "queue_item_not_found"
  | "request_state_invalid";

export class TerminalExecutionAttemptServiceError extends Error {
  readonly code: TerminalExecutionAttemptServiceErrorCode;

  constructor(
    message: string,
    options: {
      readonly code: TerminalExecutionAttemptServiceErrorCode;
    }
  ) {
    super(message);
    this.name = "TerminalExecutionAttemptServiceError";
    this.code = options.code;
  }
}

export class TerminalExecutionAttemptService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueTransport;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly purchaseAttemptStore: PurchaseAttemptStore | null;
  private readonly ticketPersistenceService: TicketPersistenceService | null;
  private readonly walletLedgerService: WalletLedgerService | null;

  constructor(dependencies: TerminalExecutionAttemptServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.purchaseAttemptStore = dependencies.purchaseAttemptStore ?? null;
    this.ticketPersistenceService = dependencies.ticketPersistenceService ?? null;
    this.walletLedgerService = dependencies.walletLedgerService ?? null;
  }

  async recordAttemptResult(input: RecordTerminalAttemptInput): Promise<RecordTerminalAttemptResult> {
    const requestId = input.requestId.trim();
    if (!requestId) {
      throw new TerminalExecutionAttemptServiceError("requestId is required", {
        code: "request_not_found"
      });
    }

    const request = await this.requestStore.getRequestById(requestId);
    if (!request) {
      throw new TerminalExecutionAttemptServiceError(`request "${requestId}" not found`, {
        code: "request_not_found"
      });
    }

    let canonicalPurchase = this.canonicalPurchaseStore
      ? await ensureCanonicalPurchaseForRequest(this.canonicalPurchaseStore, request)
      : null;
    const existingAttempt =
      this.purchaseAttemptStore && canonicalPurchase
        ? await this.purchaseAttemptStore.getAttemptById(
            `${canonicalPurchase.snapshot.purchaseId}:attempt:${Math.trunc(input.attempt)}`
          )
        : null;
    if (request.state !== "executing" && !existingAttempt) {
      throw new TerminalExecutionAttemptServiceError(
        `request "${requestId}" cannot record terminal result from state "${request.state}"`,
        {
          code: "request_state_invalid"
        }
      );
    }

    let queueItem = await this.queueStore.getByRequestId(requestId);
    if (!queueItem && !existingAttempt) {
      throw new TerminalExecutionAttemptServiceError(`queue item for request "${requestId}" not found`, {
        code: "queue_item_not_found"
      });
    }

    const normalizedAttempt = normalizeTerminalAttempt({
      requestId,
      attempt: input.attempt,
      outcome: input.result.nextState,
      startedAt: input.startedAt,
      finishedAt: input.result.finishedAt,
      rawOutput: input.result.rawOutput
    });
    const attemptRecord =
      existingAttempt ??
      createPurchaseAttemptRecord({
        purchaseId: canonicalPurchase?.snapshot.purchaseId ?? request.snapshot.requestId,
        legacyRequestId: request.snapshot.requestId,
        attemptNumber: normalizedAttempt.attempt,
        outcome: normalizedAttempt.outcome,
        startedAt: normalizedAttempt.startedAt,
        finishedAt: normalizedAttempt.finishedAt,
        rawOutput: normalizedAttempt.rawOutput,
        externalTicketReference: input.result.externalTicketReference ?? null,
        errorMessage: normalizedAttempt.outcome === "error" ? normalizedAttempt.rawOutput : null
      });
    assertAttemptReplayMatches(attemptRecord, normalizedAttempt, input.result.externalTicketReference ?? null);
    const journalNote = formatTerminalAttemptJournalNote(normalizedAttempt);
    if (!existingAttempt && this.purchaseAttemptStore) {
      await this.purchaseAttemptStore.saveAttempt(attemptRecord);
    }
    if (canonicalPurchase) {
      const nextCanonicalPurchase = applyCanonicalAttemptOutcome(canonicalPurchase, normalizedAttempt.outcome, {
        eventId: `${canonicalPurchase.snapshot.purchaseId}:attempt:${normalizedAttempt.attempt}:${normalizedAttempt.outcome}`,
        occurredAt: normalizedAttempt.finishedAt,
        note: journalNote,
        externalTicketReference: input.result.externalTicketReference ?? null
      });
      if (nextCanonicalPurchase !== canonicalPurchase) {
        await this.canonicalPurchaseStore!.savePurchase(nextCanonicalPurchase);
        canonicalPurchase = nextCanonicalPurchase;
      }
    }

    const nextRequest = transitionRequestForAttempt(request, normalizedAttempt, journalNote);
    if (nextRequest !== request) {
      await this.requestStore.saveRequest(nextRequest);
    }

    if (normalizedAttempt.outcome === "retrying") {
      const nextQueueItem = queueItem ? await this.queueStore.requeue(requestId) : null;
      return {
        request: nextRequest,
        queueItem: nextQueueItem ?? null,
        ticket: null,
        journalNote
      };
    }

    if (queueItem) {
      await this.queueStore.complete(requestId);
      queueItem = null;
    }
    let ticket: TicketRecord | null = null;
    if (normalizedAttempt.outcome === "success" && this.ticketPersistenceService) {
      const persisted = await this.ticketPersistenceService.persistSuccessfulPurchaseTicket({
        request: nextRequest,
        purchasedAt: normalizedAttempt.finishedAt,
        ...(canonicalPurchase
          ? {
              ticketId: buildCanonicalTicketId(canonicalPurchase.snapshot.purchaseId)
            }
          : {}),
        externalReference: input.result.externalTicketReference ?? null
      });
      ticket = persisted.ticket;
      if (canonicalPurchase) {
        const nextCanonicalPurchase = markCanonicalPurchaseAwaitingDrawClose(canonicalPurchase, {
          eventId: `${canonicalPurchase.snapshot.purchaseId}:awaiting_draw_close`,
          occurredAt: normalizedAttempt.finishedAt,
          note: "compatibility ticket persisted after successful purchase"
        });
        if (nextCanonicalPurchase !== canonicalPurchase) {
          await this.canonicalPurchaseStore!.savePurchase(nextCanonicalPurchase);
        }
      }
    }
    await this.reconcileLedgerForAttempt(nextRequest, normalizedAttempt, ticket);

    return {
      request: nextRequest,
      queueItem: null,
      ticket,
      journalNote
    };
  }

  private async reconcileLedgerForAttempt(
    request: PurchaseRequestRecord,
    normalizedAttempt: ReturnType<typeof normalizeTerminalAttempt>,
    ticket: TicketRecord | null
  ): Promise<void> {
    if (!this.walletLedgerService) {
      return;
    }

    if (normalizedAttempt.outcome === "success") {
      await this.walletLedgerService.debitReservedFunds({
        userId: request.snapshot.userId,
        requestId: request.snapshot.requestId,
        amountMinor: request.snapshot.costMinor,
        currency: request.snapshot.currency,
        ...(ticket ? { ticketId: ticket.ticketId } : {}),
        drawId: request.snapshot.drawId,
        idempotencyKey: `${request.snapshot.requestId}:purchase-debit`,
        createdAt: normalizedAttempt.finishedAt
      });
      return;
    }

    if (normalizedAttempt.outcome === "error") {
      await this.walletLedgerService.releaseReservedFunds({
        userId: request.snapshot.userId,
        requestId: request.snapshot.requestId,
        amountMinor: request.snapshot.costMinor,
        currency: request.snapshot.currency,
        drawId: request.snapshot.drawId,
        idempotencyKey: `${request.snapshot.requestId}:error-release`,
        createdAt: normalizedAttempt.finishedAt
      });
    }
  }
}

function transitionRequestForAttempt(
  request: PurchaseRequestRecord,
  normalizedAttempt: ReturnType<typeof normalizeTerminalAttempt>,
  journalNote: string
): PurchaseRequestRecord {
  if (request.state === normalizedAttempt.outcome) {
    return request;
  }

  if (normalizedAttempt.outcome === "added_to_cart" && request.state === "success") {
    return request;
  }

  if (request.state !== "executing") {
    return request;
  }

  return appendPurchaseRequestTransition(request, normalizedAttempt.outcome, {
    eventId: `${request.snapshot.requestId}:attempt:${normalizedAttempt.attempt}:${normalizedAttempt.outcome}`,
    occurredAt: normalizedAttempt.finishedAt,
    note: journalNote
  });
}

function assertAttemptReplayMatches(
  attemptRecord: PurchaseAttemptRecord,
  normalizedAttempt: ReturnType<typeof normalizeTerminalAttempt>,
  externalTicketReference: string | null
): void {
  if (
    attemptRecord.attemptNumber === normalizedAttempt.attempt &&
    attemptRecord.outcome === normalizedAttempt.outcome &&
    attemptRecord.startedAt === normalizedAttempt.startedAt &&
    attemptRecord.finishedAt === normalizedAttempt.finishedAt &&
    attemptRecord.rawOutput === normalizedAttempt.rawOutput &&
    (attemptRecord.externalTicketReference ?? null) === (externalTicketReference ?? null)
  ) {
    return;
  }

  throw new TerminalExecutionAttemptServiceError(
    `attempt "${attemptRecord.attemptId}" already exists with different payload`,
    {
      code: "request_state_invalid"
    }
  );
}
