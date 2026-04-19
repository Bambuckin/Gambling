import {
  appendPurchaseRequestTransition,
  type LotteryPurchaseCompletionMode,
  type PurchaseRequestRecord,
  type TicketRecord
} from "@lottery/domain";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketPersistenceService } from "./ticket-persistence-service.js";
import type { TimeSource } from "../ports/time-source.js";

export interface PurchaseCompletionServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly ticketPersistenceService: TicketPersistenceService;
  readonly timeSource: TimeSource;
}

export interface PurchaseCompletionInput {
  readonly request: PurchaseRequestRecord;
  readonly completionMode: LotteryPurchaseCompletionMode;
  readonly cartExternalReference: string | null;
}

export interface PurchaseCompletionResult {
  readonly request: PurchaseRequestRecord;
  readonly ticket: TicketRecord | null;
  readonly journalNote: string;
  readonly completed: boolean;
}

export class PurchaseCompletionService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly ticketPersistenceService: TicketPersistenceService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: PurchaseCompletionServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.ticketPersistenceService = dependencies.ticketPersistenceService;
    this.timeSource = dependencies.timeSource;
  }

  async completeAfterCartStage(input: PurchaseCompletionInput): Promise<PurchaseCompletionResult> {
    if (input.completionMode !== "emulate_after_cart") {
      return {
        request: input.request,
        ticket: null,
        journalNote: "",
        completed: false
      };
    }

    if (input.request.state !== "added_to_cart") {
      return {
        request: input.request,
        ticket: null,
        journalNote: "",
        completed: false
      };
    }

    const nowIso = this.timeSource.nowIso();
    const externalReference = resolveCompletionExternalReference(input);
    const journalNote = [
      "purchase_completion",
      `mode=emulate_after_cart`,
      `externalReference=${externalReference}`,
      `completedAt=${nowIso}`
    ].join(" ");

    const completedRequest = appendPurchaseRequestTransition(input.request, "success", {
      eventId: `${input.request.snapshot.requestId}:completion:emulate_after_cart`,
      occurredAt: nowIso,
      note: journalNote
    });

    const persisted = await this.ticketPersistenceService.persistSuccessfulPurchaseTicket({
      request: completedRequest,
      purchasedAt: nowIso,
      externalReference
    });
    await this.requestStore.saveRequest(completedRequest);

    return {
      request: completedRequest,
      ticket: persisted.ticket,
      journalNote,
      completed: true
    };
  }
}

function resolveCompletionExternalReference(input: PurchaseCompletionInput): string {
  const normalizedExternalReference = input.cartExternalReference?.trim();
  if (normalizedExternalReference) {
    return normalizedExternalReference;
  }

  return `${input.request.snapshot.requestId}:cart-emulated`;
}
