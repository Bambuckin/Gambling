export const TICKET_VERIFICATION_STATES = ["pending", "verified", "failed"] as const;

export type TicketVerificationState = (typeof TICKET_VERIFICATION_STATES)[number];

export interface TicketRecord {
  readonly ticketId: string;
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly purchasedAt: string;
  readonly externalReference: string;
}

export interface TicketResult {
  readonly ticketId: string;
  readonly verificationState: TicketVerificationState;
  readonly rawTerminalOutput: string;
  readonly winningAmountMinor: number;
  readonly verifiedAt?: string;
}
