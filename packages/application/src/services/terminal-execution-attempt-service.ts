import {
  appendPurchaseRequestTransition,
  formatTerminalAttemptJournalNote,
  normalizeTerminalAttempt,
  type PurchaseRequestRecord,
  type TicketRecord
} from "@lottery/domain";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TerminalExecutionResult } from "../ports/terminal-executor.js";
import type { TicketPersistenceService } from "./ticket-persistence-service.js";

export interface TerminalExecutionAttemptServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly ticketPersistenceService?: TicketPersistenceService;
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
  private readonly queueStore: PurchaseQueueStore;
  private readonly ticketPersistenceService: TicketPersistenceService | null;

  constructor(dependencies: TerminalExecutionAttemptServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.ticketPersistenceService = dependencies.ticketPersistenceService ?? null;
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

    if (request.state !== "executing") {
      throw new TerminalExecutionAttemptServiceError(
        `request "${requestId}" cannot record terminal result from state "${request.state}"`,
        {
          code: "request_state_invalid"
        }
      );
    }

    const queueItem = await this.queueStore.getQueueItemByRequestId(requestId);
    if (!queueItem) {
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
    const journalNote = formatTerminalAttemptJournalNote(normalizedAttempt);
    const nextRequest = appendPurchaseRequestTransition(request, normalizedAttempt.outcome, {
      eventId: `${requestId}:attempt:${normalizedAttempt.attempt}:${normalizedAttempt.outcome}`,
      occurredAt: normalizedAttempt.finishedAt,
      note: journalNote
    });

    await this.requestStore.saveRequest(nextRequest);

    if (normalizedAttempt.outcome === "retrying") {
      const nextQueueItem: PurchaseQueueItem = {
        ...queueItem,
        status: "queued"
      };
      await this.queueStore.saveQueueItem(nextQueueItem);
      return {
        request: nextRequest,
        queueItem: nextQueueItem,
        ticket: null,
        journalNote
      };
    }

    await this.queueStore.removeQueueItem(requestId);
    let ticket: TicketRecord | null = null;
    if (normalizedAttempt.outcome === "success" && this.ticketPersistenceService) {
      const persisted = await this.ticketPersistenceService.persistSuccessfulPurchaseTicket({
        request: nextRequest,
        purchasedAt: normalizedAttempt.finishedAt,
        externalReference: input.result.externalTicketReference ?? null
      });
      ticket = persisted.ticket;
    }

    return {
      request: nextRequest,
      queueItem: null,
      ticket,
      journalNote
    };
  }
}
