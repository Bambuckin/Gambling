import { createPurchasedTicketRecord, type PurchaseRequestRecord, type TicketRecord } from "@lottery/domain";
import type { TicketStore } from "../ports/ticket-store.js";

export interface TicketPersistenceServiceDependencies {
  readonly ticketStore: TicketStore;
}

export interface PersistSuccessfulPurchaseTicketInput {
  readonly request: PurchaseRequestRecord;
  readonly purchasedAt: string;
  readonly externalReference?: string | null;
}

export interface PersistSuccessfulPurchaseTicketResult {
  readonly ticket: TicketRecord;
  readonly replayed: boolean;
}

export type TicketPersistenceServiceErrorCode = "request_state_invalid";

export class TicketPersistenceServiceError extends Error {
  readonly code: TicketPersistenceServiceErrorCode;

  constructor(
    message: string,
    options: {
      readonly code: TicketPersistenceServiceErrorCode;
    }
  ) {
    super(message);
    this.name = "TicketPersistenceServiceError";
    this.code = options.code;
  }
}

export class TicketPersistenceService {
  private readonly ticketStore: TicketStore;

  constructor(dependencies: TicketPersistenceServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
  }

  async persistSuccessfulPurchaseTicket(
    input: PersistSuccessfulPurchaseTicketInput
  ): Promise<PersistSuccessfulPurchaseTicketResult> {
    const request = cloneRequest(input.request);
    if (request.state !== "success") {
      throw new TicketPersistenceServiceError(
        `request "${request.snapshot.requestId}" must be in "success" state to persist ticket`,
        {
          code: "request_state_invalid"
        }
      );
    }

    const existing = await this.ticketStore.getTicketByRequestId(request.snapshot.requestId);
    if (existing) {
      return {
        ticket: existing,
        replayed: true
      };
    }

    const ticket = createPurchasedTicketRecord({
      ticketId: `${request.snapshot.requestId}:ticket`,
      requestId: request.snapshot.requestId,
      userId: request.snapshot.userId,
      lotteryCode: request.snapshot.lotteryCode,
      drawId: request.snapshot.drawId,
      purchasedAt: input.purchasedAt,
      externalReference: input.externalReference ?? null
    });

    await this.ticketStore.saveTicket(ticket);
    return {
      ticket,
      replayed: false
    };
  }
}

function cloneRequest(request: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...request.snapshot,
      payload: { ...request.snapshot.payload }
    },
    state: request.state,
    journal: request.journal.map((entry) => ({ ...entry }))
  };
}
