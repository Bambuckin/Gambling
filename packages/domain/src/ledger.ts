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

export interface LedgerMovementDelta {
  readonly availableMinorDelta: number;
  readonly reservedMinorDelta: number;
}

export interface BalanceAggregationInput {
  readonly userId: string;
  readonly currency: string;
  readonly entries: readonly LedgerEntry[];
  readonly openingAvailableMinor?: number;
  readonly openingReservedMinor?: number;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

export function normalizeLedgerEntry(entry: LedgerEntry): LedgerEntry {
  const entryId = entry.entryId.trim();
  if (!entryId) {
    throw new LedgerValidationError("entryId is required");
  }

  const userId = entry.userId.trim();
  if (!userId) {
    throw new LedgerValidationError("userId is required");
  }

  if (!LEDGER_OPERATIONS.includes(entry.operation)) {
    throw new LedgerValidationError(`operation "${entry.operation}" is not supported`);
  }

  const amountMinor = normalizeAmountMinor(entry.amountMinor);
  const currency = normalizeCurrency(entry.currency);
  const idempotencyKey = entry.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new LedgerValidationError("idempotencyKey is required");
  }

  const reference = normalizeLedgerReference(entry.reference);
  if (!hasLedgerReference(reference)) {
    throw new LedgerValidationError(`entry "${entryId}" must include at least one request/ticket reference`);
  }

  if (requiresRequestReference(entry.operation) && !reference.requestId) {
    throw new LedgerValidationError(`entry "${entryId}" operation "${entry.operation}" requires requestId reference`);
  }

  const createdAt = normalizeIsoTimestamp(entry.createdAt, `entry "${entryId}" createdAt`);

  return {
    entryId,
    userId,
    operation: entry.operation,
    amountMinor,
    currency,
    idempotencyKey,
    reference,
    createdAt
  };
}

export function normalizeLedgerReference(reference: LedgerReference): LedgerReference {
  const requestId = reference.requestId?.trim();
  const ticketId = reference.ticketId?.trim();
  const drawId = reference.drawId?.trim();

  return {
    ...(requestId ? { requestId } : {}),
    ...(ticketId ? { ticketId } : {}),
    ...(drawId ? { drawId } : {})
  };
}

export function hasLedgerReference(reference: LedgerReference): boolean {
  return Boolean(reference.requestId || reference.ticketId);
}

export function requiresRequestReference(operation: LedgerOperationType): boolean {
  return operation === "reserve" || operation === "debit" || operation === "release";
}

export function resolveLedgerMovementDelta(operation: LedgerOperationType, amountMinor: number): LedgerMovementDelta {
  const normalizedAmount = normalizeAmountMinor(amountMinor);

  switch (operation) {
    case "reserve":
      return {
        availableMinorDelta: -normalizedAmount,
        reservedMinorDelta: normalizedAmount
      };
    case "debit":
      return {
        availableMinorDelta: 0,
        reservedMinorDelta: -normalizedAmount
      };
    case "release":
      return {
        availableMinorDelta: normalizedAmount,
        reservedMinorDelta: -normalizedAmount
      };
    case "credit":
      return {
        availableMinorDelta: normalizedAmount,
        reservedMinorDelta: 0
      };
    default:
      throw new LedgerValidationError(`unsupported operation "${operation}"`);
  }
}

export function createBalanceSnapshot(input: {
  readonly userId: string;
  readonly currency: string;
  readonly availableMinor?: number;
  readonly reservedMinor?: number;
}): BalanceSnapshot {
  const userId = input.userId.trim();
  if (!userId) {
    throw new LedgerValidationError("snapshot userId is required");
  }

  const currency = normalizeCurrency(input.currency);
  const availableMinor = normalizeNonNegativeMinor(input.availableMinor ?? 0, "snapshot availableMinor");
  const reservedMinor = normalizeNonNegativeMinor(input.reservedMinor ?? 0, "snapshot reservedMinor");

  return {
    userId,
    availableMinor,
    reservedMinor,
    currency
  };
}

export function applyLedgerEntry(snapshot: BalanceSnapshot, entry: LedgerEntry): BalanceSnapshot {
  const normalizedEntry = normalizeLedgerEntry(entry);
  if (normalizedEntry.userId !== snapshot.userId) {
    throw new LedgerValidationError(
      `entry user "${normalizedEntry.userId}" does not match wallet user "${snapshot.userId}"`
    );
  }

  if (normalizedEntry.currency !== snapshot.currency) {
    throw new LedgerValidationError(
      `entry currency "${normalizedEntry.currency}" does not match wallet currency "${snapshot.currency}"`
    );
  }

  const delta = resolveLedgerMovementDelta(normalizedEntry.operation, normalizedEntry.amountMinor);
  const nextAvailableMinor = snapshot.availableMinor + delta.availableMinorDelta;
  const nextReservedMinor = snapshot.reservedMinor + delta.reservedMinorDelta;

  if (nextAvailableMinor < 0) {
    throw new LedgerValidationError(
      `operation "${normalizedEntry.operation}" would result in negative available balance for user "${snapshot.userId}"`
    );
  }

  if (nextReservedMinor < 0) {
    throw new LedgerValidationError(
      `operation "${normalizedEntry.operation}" would result in negative reserved balance for user "${snapshot.userId}"`
    );
  }

  return {
    ...snapshot,
    availableMinor: nextAvailableMinor,
    reservedMinor: nextReservedMinor
  };
}

export function buildBalanceSnapshot(input: BalanceAggregationInput): BalanceSnapshot {
  const baseSnapshot = createBalanceSnapshot({
    userId: input.userId,
    currency: input.currency,
    availableMinor: input.openingAvailableMinor ?? 0,
    reservedMinor: input.openingReservedMinor ?? 0
  });

  const sorted = sortLedgerEntries(input.entries);
  let snapshot = baseSnapshot;

  for (const entry of sorted) {
    if (entry.userId !== baseSnapshot.userId) {
      throw new LedgerValidationError(
        `entry "${entry.entryId}" belongs to user "${entry.userId}" but aggregate expects "${baseSnapshot.userId}"`
      );
    }

    snapshot = applyLedgerEntry(snapshot, entry);
  }

  return snapshot;
}

export function sortLedgerEntries(entries: readonly LedgerEntry[]): LedgerEntry[] {
  return entries
    .map((entry) => normalizeLedgerEntry(entry))
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.entryId.localeCompare(right.entryId);
    });
}

function normalizeAmountMinor(amountMinor: number): number {
  const normalized = Math.trunc(amountMinor);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new LedgerValidationError("amountMinor must be a positive integer");
  }

  return normalized;
}

function normalizeNonNegativeMinor(amountMinor: number, label: string): number {
  const normalized = Math.trunc(amountMinor);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new LedgerValidationError(`${label} must be a non-negative integer`);
  }

  return normalized;
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new LedgerValidationError(`currency "${currency}" must be a 3-letter ISO code`);
  }

  return normalized;
}

function normalizeIsoTimestamp(value: string, label: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new LedgerValidationError(`${label} must be a valid ISO timestamp`);
  }

  return new Date(timestamp).toISOString();
}
