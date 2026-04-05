import type { LedgerEntry } from "@lottery/domain";
import { SystemTimeSource, WalletLedgerService } from "@lottery/application";
import { InMemoryLedgerStore } from "@lottery/infrastructure";

export const LEDGER_DEFAULT_CURRENCY = "RUB";

let cachedService: WalletLedgerService | null = null;

export function getWalletLedgerService(): WalletLedgerService {
  if (!cachedService) {
    cachedService = new WalletLedgerService({
      ledgerStore: new InMemoryLedgerStore(readSeedEntries()),
      timeSource: new SystemTimeSource()
    });
  }

  return cachedService;
}

function readSeedEntries(): LedgerEntry[] {
  const raw = process.env.LOTTERY_LEDGER_ENTRIES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const entries = parsed
          .map((item) => sanitizeSeedEntry(item))
          .filter((item): item is LedgerEntry => item !== null);
        if (entries.length > 0) {
          return entries;
        }
      }
    } catch {
      // fall back to defaults
    }
  }

  return defaultSeedEntries();
}

function sanitizeSeedEntry(input: unknown): LedgerEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const entryId = typeof record.entryId === "string" ? record.entryId.trim() : "";
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const operation = record.operation;
  const amountMinor = typeof record.amountMinor === "number" ? Math.trunc(record.amountMinor) : NaN;
  const currency = typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
  const idempotencyKey = typeof record.idempotencyKey === "string" ? record.idempotencyKey.trim() : "";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  const reference = sanitizeReference(record.reference);

  if (!entryId || !userId || !idempotencyKey || !createdAt || !reference) {
    return null;
  }

  if (operation !== "reserve" && operation !== "debit" && operation !== "release" && operation !== "credit") {
    return null;
  }

  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return null;
  }

  if (!currency) {
    return null;
  }

  return {
    entryId,
    userId,
    operation,
    amountMinor,
    currency,
    idempotencyKey,
    reference,
    createdAt
  };
}

function sanitizeReference(input: unknown): LedgerEntry["reference"] | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const ticketId = typeof record.ticketId === "string" ? record.ticketId.trim() : "";
  const drawId = typeof record.drawId === "string" ? record.drawId.trim() : "";

  if (!requestId && !ticketId) {
    return null;
  }

  return {
    ...(requestId ? { requestId } : {}),
    ...(ticketId ? { ticketId } : {}),
    ...(drawId ? { drawId } : {})
  };
}

function defaultSeedEntries(): LedgerEntry[] {
  const now = Date.now();

  return [
    {
      entryId: "seed-user-credit",
      userId: "seed-user",
      operation: "credit",
      amountMinor: 220_000,
      currency: LEDGER_DEFAULT_CURRENCY,
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-user-credit"
      },
      createdAt: new Date(now - 4 * 60 * 1000).toISOString()
    },
    {
      entryId: "seed-admin-credit",
      userId: "seed-admin",
      operation: "credit",
      amountMinor: 500_000,
      currency: LEDGER_DEFAULT_CURRENCY,
      idempotencyKey: "seed-admin-credit",
      reference: {
        requestId: "seed-admin-credit"
      },
      createdAt: new Date(now - 3 * 60 * 1000).toISOString()
    },
    {
      entryId: "seed-tester-credit",
      userId: "seed-tester",
      operation: "credit",
      amountMinor: 180_000,
      currency: LEDGER_DEFAULT_CURRENCY,
      idempotencyKey: "seed-tester-credit",
      reference: {
        requestId: "seed-tester-credit"
      },
      createdAt: new Date(now - 2 * 60 * 1000).toISOString()
    },
    {
      entryId: "seed-tester-reserve",
      userId: "seed-tester",
      operation: "reserve",
      amountMinor: 20_000,
      currency: LEDGER_DEFAULT_CURRENCY,
      idempotencyKey: "seed-tester-reserve",
      reference: {
        requestId: "seed-tester-reserve"
      },
      createdAt: new Date(now - 60 * 1000).toISOString()
    }
  ];
}
