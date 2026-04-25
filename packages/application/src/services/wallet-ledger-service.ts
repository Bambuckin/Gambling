import {
  LedgerValidationError,
  buildBalanceSnapshot,
  normalizeLedgerEntry,
  sortLedgerEntries,
  type BalanceSnapshot,
  type LedgerEntry,
  type LedgerOperationType,
  type LedgerReference
} from "@lottery/domain";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { TimeSource } from "../ports/time-source.js";

export interface WalletLedgerServiceDependencies {
  readonly ledgerStore: LedgerStore;
  readonly timeSource: TimeSource;
  readonly entryFactory?: WalletLedgerEntryFactory;
}

export interface WalletLedgerEntryFactory {
  nextEntryId(): string;
}

export interface WalletLedgerRecordInput {
  readonly userId: string;
  readonly operation: LedgerOperationType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly reference: LedgerReference;
  readonly entryId?: string;
  readonly createdAt?: string;
}

export interface WalletLedgerRequestCommandInput {
  readonly userId: string;
  readonly requestId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly ticketId?: string;
  readonly drawId?: string;
  readonly entryId?: string;
  readonly createdAt?: string;
}

export interface WalletLedgerWinningsCommandInput {
  readonly userId: string;
  readonly purchaseId?: string;
  readonly requestId: string;
  readonly ticketId: string;
  readonly sourceEventId?: string;
  readonly verificationEventId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly drawId?: string;
  readonly entryId?: string;
  readonly createdAt?: string;
}

export interface WalletLedgerRecordResult {
  readonly entry: LedgerEntry;
  readonly snapshot: BalanceSnapshot;
  readonly replayed: boolean;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class WalletLedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletLedgerValidationError";
  }
}

export class WalletLedgerService {
  private readonly ledgerStore: LedgerStore;
  private readonly timeSource: TimeSource;
  private readonly entryFactory: WalletLedgerEntryFactory;

  constructor(dependencies: WalletLedgerServiceDependencies) {
    this.ledgerStore = dependencies.ledgerStore;
    this.timeSource = dependencies.timeSource;
    this.entryFactory = dependencies.entryFactory ?? new RandomLedgerEntryFactory();
  }

  async listAllEntries(): Promise<LedgerEntry[]> {
    const entries = await this.ledgerStore.listEntries();
    return sortLedgerEntries(entries);
  }

  async listEntries(userId: string): Promise<LedgerEntry[]> {
    const normalizedUserId = normalizeUserId(userId);
    const entries = await this.ledgerStore.listEntriesByUser(normalizedUserId);
    return sortLedgerEntries(entries);
  }

  async getWalletSnapshot(userId: string, currency: string): Promise<BalanceSnapshot> {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedCurrency = normalizeCurrency(currency);
    const entries = await this.listEntries(normalizedUserId);

    return buildBalanceSnapshot({
      userId: normalizedUserId,
      currency: normalizedCurrency,
      entries
    });
  }

  async ensureEntries(entries: readonly LedgerEntry[]): Promise<number> {
    const existingEntries = await this.listAllEntries();
    const entriesByIdempotencyKey = new Map(existingEntries.map((entry) => [entry.idempotencyKey, entry] as const));
    let insertedCount = 0;

    for (const nextEntry of sortLedgerEntries(entries.map((entry) => normalizeLedgerEntry(entry)))) {
      const existingEntry = entriesByIdempotencyKey.get(nextEntry.idempotencyKey);
      if (existingEntry) {
        assertReplayMatches(existingEntry, nextEntry);
        continue;
      }

      await this.ledgerStore.appendEntry(nextEntry);
      entriesByIdempotencyKey.set(nextEntry.idempotencyKey, nextEntry);
      insertedCount += 1;
    }

    return insertedCount;
  }

  async reserveFunds(input: WalletLedgerRequestCommandInput): Promise<WalletLedgerRecordResult> {
    return this.recordEntry({
      userId: input.userId,
      operation: "reserve",
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      reference: buildRequestReference(input),
      ...(input.entryId ? { entryId: input.entryId } : {}),
      ...(input.createdAt ? { createdAt: input.createdAt } : {})
    });
  }

  async debitReservedFunds(input: WalletLedgerRequestCommandInput): Promise<WalletLedgerRecordResult> {
    return this.recordEntry({
      userId: input.userId,
      operation: "debit",
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      reference: buildRequestReference(input),
      ...(input.entryId ? { entryId: input.entryId } : {}),
      ...(input.createdAt ? { createdAt: input.createdAt } : {})
    });
  }

  async releaseReservedFunds(input: WalletLedgerRequestCommandInput): Promise<WalletLedgerRecordResult> {
    return this.recordEntry({
      userId: input.userId,
      operation: "release",
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      reference: buildRequestReference(input),
      ...(input.entryId ? { entryId: input.entryId } : {}),
      ...(input.createdAt ? { createdAt: input.createdAt } : {})
    });
  }

  async creditWinnings(input: WalletLedgerWinningsCommandInput): Promise<WalletLedgerRecordResult> {
    const ticketId = requireNonEmpty(input.ticketId, "ticketId");
    const sourceEventId = requireNonEmpty(input.sourceEventId ?? input.verificationEventId, "verificationEventId");
    const purchaseId = normalizeOptionalText(input.purchaseId);

    return this.recordEntry({
      userId: input.userId,
      operation: "credit",
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: `${purchaseId ?? ticketId}:winnings:${sourceEventId}`,
      reference: buildWinningsReference(input, ticketId, purchaseId),
      ...(input.entryId ? { entryId: input.entryId } : {}),
      ...(input.createdAt ? { createdAt: input.createdAt } : {})
    });
  }

  async recordEntry(input: WalletLedgerRecordInput): Promise<WalletLedgerRecordResult> {
    const normalizedUserId = normalizeUserId(input.userId);
    const nextEntry = this.buildEntry(input, normalizedUserId);
    const entries = await this.listEntries(normalizedUserId);

    const existingEntry = entries.find((entry) => entry.idempotencyKey === nextEntry.idempotencyKey);
    if (existingEntry) {
      assertReplayMatches(existingEntry, nextEntry);
      const replaySnapshot = buildBalanceSnapshot({
        userId: normalizedUserId,
        currency: existingEntry.currency,
        entries
      });

      return {
        entry: existingEntry,
        snapshot: replaySnapshot,
        replayed: true
      };
    }

    const snapshot = buildBalanceSnapshot({
      userId: normalizedUserId,
      currency: nextEntry.currency,
      entries: [...entries, nextEntry]
    });

    await this.ledgerStore.appendEntry(nextEntry);

    return {
      entry: nextEntry,
      snapshot,
      replayed: false
    };
  }

  private buildEntry(input: WalletLedgerRecordInput, userId: string): LedgerEntry {
    const nextEntryId = input.entryId?.trim() || this.entryFactory.nextEntryId();
    const nowIso = this.timeSource.nowIso();

    try {
      return normalizeLedgerEntry({
        entryId: nextEntryId,
        userId,
        operation: input.operation,
        amountMinor: input.amountMinor,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        createdAt: input.createdAt ?? nowIso
      });
    } catch (error) {
      if (error instanceof LedgerValidationError) {
        throw new WalletLedgerValidationError(error.message);
      }

      throw error;
    }
  }
}

function normalizeUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new WalletLedgerValidationError("userId is required");
  }

  return normalized;
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new WalletLedgerValidationError(`currency "${currency}" must be a 3-letter ISO code`);
  }

  return normalized;
}

function assertReplayMatches(existingEntry: LedgerEntry, nextEntry: LedgerEntry): void {
  const sameOperation = existingEntry.operation === nextEntry.operation;
  const sameAmount = existingEntry.amountMinor === nextEntry.amountMinor;
  const sameCurrency = existingEntry.currency === nextEntry.currency;
  const sameReference = isSameReference(existingEntry.reference, nextEntry.reference);

  if (sameOperation && sameAmount && sameCurrency && sameReference) {
    return;
  }

  throw new WalletLedgerValidationError(
    `idempotency key "${nextEntry.idempotencyKey}" already exists with different payload`
  );
}

function isSameReference(left: LedgerReference, right: LedgerReference): boolean {
  return (
    (left.purchaseId ?? null) === (right.purchaseId ?? null) &&
    (left.requestId ?? null) === (right.requestId ?? null) &&
    (left.ticketId ?? null) === (right.ticketId ?? null) &&
    (left.drawId ?? null) === (right.drawId ?? null)
  );
}

class RandomLedgerEntryFactory implements WalletLedgerEntryFactory {
  nextEntryId(): string {
    return `ledger_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function buildRequestReference(input: WalletLedgerRequestCommandInput): LedgerReference {
  const requestId = input.requestId.trim();
  if (!requestId) {
    throw new WalletLedgerValidationError("requestId is required for reserve/debit/release operations");
  }

  const ticketId = input.ticketId?.trim();
  const drawId = input.drawId?.trim();

  return {
    requestId,
    ...(ticketId ? { ticketId } : {}),
    ...(drawId ? { drawId } : {})
  };
}

function buildWinningsReference(
  input: WalletLedgerWinningsCommandInput,
  ticketId: string,
  purchaseId: string | null
): LedgerReference {
  const requestId = input.requestId.trim();
  if (!requestId) {
    throw new WalletLedgerValidationError("requestId is required for winnings credit operations");
  }

  const drawId = input.drawId?.trim();

  return {
    ...(purchaseId ? { purchaseId } : {}),
    requestId,
    ticketId,
    ...(drawId ? { drawId } : {})
  };
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new WalletLedgerValidationError(`${field} is required`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}
