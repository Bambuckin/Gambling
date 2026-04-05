export const LEDGER_OPERATIONS = ["reserve", "debit", "release", "credit"] as const;

export type LedgerOperationType = (typeof LEDGER_OPERATIONS)[number];

export interface LedgerReference {
  readonly requestId?: string;
  readonly ticketId?: string;
  readonly drawId?: string;
}

export interface LedgerEntry {
  readonly entryId: string;
  readonly userId: string;
  readonly operation: LedgerOperationType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly reference: LedgerReference;
  readonly createdAt: string;
}

export interface BalanceSnapshot {
  readonly userId: string;
  readonly availableMinor: number;
  readonly reservedMinor: number;
  readonly currency: string;
}
