import type { LedgerEntry, LedgerOperationType, LedgerReference } from "@lottery/domain";

const DEFAULT_MOVEMENT_LIMIT = 10;

export interface WalletMovementRow {
  readonly entryId: string;
  readonly operation: LedgerOperationType;
  readonly amountMinor: number;
  readonly amountLabel: string;
  readonly referenceLabel: string;
  readonly createdAt: string;
}

export function buildWalletMovementRows(
  entries: readonly LedgerEntry[],
  options: { readonly limit?: number } = {}
): WalletMovementRow[] {
  const limit = normalizeLimit(options.limit);
  const latestEntries = [...entries].reverse().slice(0, limit);

  return latestEntries.map((entry) => ({
    entryId: entry.entryId,
    operation: entry.operation,
    amountMinor: entry.amountMinor,
    amountLabel: formatMovementAmount(entry.operation, entry.amountMinor),
    referenceLabel: formatLedgerReference(entry.reference),
    createdAt: entry.createdAt
  }));
}

export function listLedgerUserIds(entries: readonly LedgerEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.userId))].sort((left, right) => left.localeCompare(right));
}

function formatMovementAmount(operation: LedgerOperationType, amountMinor: number): string {
  return `${isPositiveMovement(operation) ? "+" : "-"}${amountMinor}`;
}

function isPositiveMovement(operation: LedgerOperationType): boolean {
  return operation === "credit" || operation === "release";
}

function formatLedgerReference(reference: LedgerReference): string {
  const parts: string[] = [];
  if (reference.requestId) {
    parts.push(`request:${reference.requestId}`);
  }
  if (reference.ticketId) {
    parts.push(`ticket:${reference.ticketId}`);
  }
  if (reference.drawId) {
    parts.push(`draw:${reference.drawId}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "n/a";
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_MOVEMENT_LIMIT;
  }

  const normalized = Math.trunc(limit);
  return normalized > 0 ? normalized : DEFAULT_MOVEMENT_LIMIT;
}
