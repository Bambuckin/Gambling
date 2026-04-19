import {
  appendCanonicalPurchaseTransition,
  appendPurchaseRequestTransition,
  type CanonicalPurchaseRecord,
  type LotteryPurchaseCompletionMode,
  type PurchaseRequestRecord,
  type TicketRecord
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketPersistenceService } from "./ticket-persistence-service.js";
import type { TimeSource } from "../ports/time-source.js";
import {
  loadCanonicalPurchaseForRequest,
  markCanonicalPurchaseAwaitingDrawClose
} from "./canonical-purchase-state.js";

export interface PurchaseCompletionServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
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
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly ticketPersistenceService: TicketPersistenceService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: PurchaseCompletionServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
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

    const canonicalPurchase = this.canonicalPurchaseStore
      ? await loadCanonicalPurchaseForRequest(this.canonicalPurchaseStore, input.request.snapshot.requestId)
      : null;
    if (!shouldCompleteCompatibility(input.request, canonicalPurchase)) {
      return {
        request: input.request,
        ticket: null,
        journalNote: "",
        completed: false
      };
    }

    const nowIso = this.timeSource.nowIso();
    const externalReference = resolveCompletionExternalReference(input, canonicalPurchase);
    const purchasedAt = canonicalPurchase?.purchasedAt ?? nowIso;
    const journalNote = buildCompletionJournalNote(externalReference, nowIso);
    const requestWasCompleted = input.request.state === "success";
    const completedRequest =
      requestWasCompleted
        ? input.request
        : appendPurchaseRequestTransition(input.request, "success", {
            eventId: `${input.request.snapshot.requestId}:completion:emulate_after_cart`,
            occurredAt: nowIso,
            note: journalNote
          });

    const persisted = await this.ticketPersistenceService.persistSuccessfulPurchaseTicket({
      request: completedRequest,
      purchasedAt,
      externalReference
    });
    const canonicalChanged = await this.saveCanonicalCompatibilityProgress(canonicalPurchase, nowIso);
    if (!requestWasCompleted || !persisted.replayed) {
      await this.requestStore.saveRequest(completedRequest);
    }

    return {
      request: completedRequest,
      ticket: persisted.ticket,
      journalNote,
      completed: !requestWasCompleted || !persisted.replayed || canonicalChanged
    };
  }

  private async saveCanonicalCompatibilityProgress(
    canonicalPurchase: CanonicalPurchaseRecord | null,
    nowIso: string
  ): Promise<boolean> {
    if (!canonicalPurchase || !this.canonicalPurchaseStore) {
      return false;
    }

    let nextCanonicalPurchase = canonicalPurchase;
    if (nextCanonicalPurchase.status === "processing") {
      nextCanonicalPurchase = appendCanonicalPurchaseTransition(nextCanonicalPurchase, "purchased", {
        eventId: `${nextCanonicalPurchase.snapshot.purchaseId}:purchased:repair`,
        occurredAt: nextCanonicalPurchase.purchasedAt ?? nowIso,
        note: "compatibility completion repaired purchased state",
        externalTicketReference: nextCanonicalPurchase.externalTicketReference
      });
    }

    nextCanonicalPurchase = markCanonicalPurchaseAwaitingDrawClose(nextCanonicalPurchase, {
      eventId: `${nextCanonicalPurchase.snapshot.purchaseId}:awaiting_draw_close`,
      occurredAt: nowIso,
      note: "compatibility ticket persisted after cart-stage completion"
    });

    if (nextCanonicalPurchase !== canonicalPurchase) {
      await this.canonicalPurchaseStore.savePurchase(nextCanonicalPurchase);
      return true;
    }

    return false;
  }
}

function resolveCompletionExternalReference(
  input: PurchaseCompletionInput,
  canonicalPurchase: CanonicalPurchaseRecord | null
): string {
  const normalizedExternalReference = input.cartExternalReference?.trim();
  if (normalizedExternalReference) {
    return normalizedExternalReference;
  }

  const canonicalExternalReference = canonicalPurchase?.externalTicketReference?.trim();
  if (canonicalExternalReference) {
    return canonicalExternalReference;
  }

  return `${input.request.snapshot.requestId}:cart-emulated`;
}

function buildCompletionJournalNote(externalReference: string, completedAt: string): string {
  return [
    "purchase_completion",
    `mode=emulate_after_cart`,
    `externalReference=${externalReference}`,
    `completedAt=${completedAt}`
  ].join(" ");
}

function shouldCompleteCompatibility(
  request: PurchaseRequestRecord,
  canonicalPurchase: CanonicalPurchaseRecord | null
): boolean {
  if (request.state === "added_to_cart") {
    return true;
  }

  if (request.state !== "success" || !canonicalPurchase) {
    return false;
  }

  return (
    canonicalPurchase.status === "purchased" ||
    canonicalPurchase.status === "awaiting_draw_close" ||
    canonicalPurchase.status === "settled"
  );
}
