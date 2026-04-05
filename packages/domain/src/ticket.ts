export const TICKET_PURCHASE_STATES = ["purchased"] as const;
export const TICKET_VERIFICATION_STATES = ["pending", "verified", "failed"] as const;

export type TicketPurchaseState = (typeof TICKET_PURCHASE_STATES)[number];
export type TicketVerificationState = (typeof TICKET_VERIFICATION_STATES)[number];

export interface TicketRecord {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly purchasedAt: string;
  readonly externalReference: string;
  readonly purchaseStatus: TicketPurchaseState;
  readonly verificationStatus: TicketVerificationState;
  readonly verificationRawOutput: string | null;
  readonly winningAmountMinor: number | null;
  readonly verifiedAt: string | null;
}

export interface CreatePurchasedTicketRecordInput {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly purchasedAt: string;
  readonly externalReference?: string | null;
}

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}

export function createPurchasedTicketRecord(input: CreatePurchasedTicketRecordInput): TicketRecord {
  const ticketId = requireNonEmpty(input.ticketId, "ticketId");
  const requestId = requireNonEmpty(input.requestId, "requestId");
  const userId = requireNonEmpty(input.userId, "userId");
  const lotteryCode = requireNonEmpty(input.lotteryCode, "lotteryCode").toLowerCase();
  const drawId = requireNonEmpty(input.drawId, "drawId");
  const purchasedAt = requireValidIso(input.purchasedAt, "purchasedAt");
  const externalReference =
    (typeof input.externalReference === "string" ? input.externalReference.trim() : "") ||
    `${lotteryCode}-${requestId}`;

  return {
    ticketId,
    requestId,
    userId,
    lotteryCode,
    drawId,
    purchasedAt,
    externalReference,
    purchaseStatus: "purchased",
    verificationStatus: "pending",
    verificationRawOutput: null,
    winningAmountMinor: null,
    verifiedAt: null
  };
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TicketValidationError(`${field} is required`);
  }
  return normalized;
}

function requireValidIso(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new TicketValidationError(`${field} must be a valid ISO date string`);
  }
  return normalized;
}
