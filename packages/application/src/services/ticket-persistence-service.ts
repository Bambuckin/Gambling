import { createNotification, createPurchasedTicketRecord, type PurchaseRequestRecord, type TicketRecord } from "@lottery/domain";
import type { NotificationStore } from "../ports/notification-store.js";
import type { TicketStore } from "../ports/ticket-store.js";

export interface TicketPersistenceServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly notificationStore: NotificationStore;
  readonly persistLegacyTicket?: boolean;
}

export interface PersistSuccessfulPurchaseTicketInput {
  readonly request: PurchaseRequestRecord;
  readonly purchasedAt: string;
  readonly ticketId?: string | null;
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
  private readonly notificationStore: NotificationStore;
  private readonly persistLegacyTicket: boolean;

  constructor(dependencies: TicketPersistenceServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.notificationStore = dependencies.notificationStore;
    this.persistLegacyTicket = dependencies.persistLegacyTicket ?? true;
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

    const ticketId = resolveTicketId(input);
    const existing = await this.ticketStore.getTicketByRequestId(request.snapshot.requestId);
    if (existing) {
      return {
        ticket: existing,
        replayed: true
      };
    }

    if (!this.persistLegacyTicket) {
      const existingNotification = await this.notificationStore.getNotificationById(`${ticketId}:purchase_success`);
      if (existingNotification) {
        return {
          ticket: createPurchasedTicketRecord({
            ticketId,
            requestId: request.snapshot.requestId,
            userId: request.snapshot.userId,
            lotteryCode: request.snapshot.lotteryCode,
            drawId: request.snapshot.drawId,
            purchasedAt: input.purchasedAt,
            externalReference: input.externalReference ?? null
          }),
          replayed: true
        };
      }
    }

    const ticket = createPurchasedTicketRecord({
      ticketId,
      requestId: request.snapshot.requestId,
      userId: request.snapshot.userId,
      lotteryCode: request.snapshot.lotteryCode,
      drawId: request.snapshot.drawId,
      purchasedAt: input.purchasedAt,
      externalReference: input.externalReference ?? null
    });

    if (this.persistLegacyTicket) {
      await this.ticketStore.saveTicket(ticket);
    }

    await this.notificationStore.saveNotification(
      createNotification({
        notificationId: `${ticket.ticketId}:purchase_success`,
        userId: ticket.userId,
        type: "purchase_success",
        title: "Билет куплен",
        body: `Ваш билет для тиража ${ticket.drawId} успешно оформлен.`,
        createdAt: input.purchasedAt,
        referenceTicketId: ticket.ticketId,
        referenceDrawId: ticket.drawId,
        referenceLotteryCode: ticket.lotteryCode
      })
    );

    return {
      ticket,
      replayed: false
    };
  }
}

function resolveTicketId(input: PersistSuccessfulPurchaseTicketInput): string {
  const normalizedTicketId = input.ticketId?.trim();
  if (normalizedTicketId) {
    return normalizedTicketId;
  }

  return `${input.request.snapshot.requestId}:ticket`;
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
