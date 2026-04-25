import type { LedgerStore } from "@lottery/application";
import { normalizeLedgerEntry, type LedgerEntry } from "@lottery/domain";
import type { Pool } from "pg";
import { deepClone } from "./utils.js";

export class PostgresLedgerStore implements LedgerStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listEntries(): Promise<readonly LedgerEntry[]> {
    const result = await this.pool.query(
      `
        select entry
        from lottery_ledger_entries
        order by created_at asc, entry_id asc
      `
    );

    return result.rows.map((row: { entry: LedgerEntry }) => deepClone(row.entry));
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    const normalizedUserId = userId.trim();
    const result = await this.pool.query(
      `
        select entry
        from lottery_ledger_entries
        where user_id = $1
        order by created_at asc, entry_id asc
      `,
      [normalizedUserId]
    );

    return result.rows.map((row: { entry: LedgerEntry }) => deepClone(row.entry));
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    const normalizedEntry = normalizeLedgerEntry(entry);

    const result = await this.pool.query(
      `
        insert into lottery_ledger_entries (
          entry_id,
          user_id,
          created_at,
          idempotency_key,
          entry
        ) values ($1, $2, $3, $4, $5::jsonb)
        on conflict (idempotency_key) do nothing
        returning entry
      `,
      [
        normalizedEntry.entryId,
        normalizedEntry.userId,
        normalizedEntry.createdAt,
        normalizedEntry.idempotencyKey,
        JSON.stringify(normalizedEntry)
      ]
    );
    if (result.rowCount === 1) {
      return;
    }

    const existing = await this.pool.query(
      `
        select entry
        from lottery_ledger_entries
        where idempotency_key = $1
        limit 1
      `,
      [normalizedEntry.idempotencyKey]
    );
    const existingEntry = existing.rows[0]?.entry ? normalizeLedgerEntry(existing.rows[0].entry as LedgerEntry) : null;
    if (!existingEntry || !isReplayCompatible(existingEntry, normalizedEntry)) {
      throw new Error(`idempotency key "${normalizedEntry.idempotencyKey}" already exists with different payload`);
    }
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_ledger_entries");
  }
}

function isReplayCompatible(existingEntry: LedgerEntry, nextEntry: LedgerEntry): boolean {
  return (
    existingEntry.userId === nextEntry.userId &&
    existingEntry.operation === nextEntry.operation &&
    existingEntry.amountMinor === nextEntry.amountMinor &&
    existingEntry.currency === nextEntry.currency &&
    (existingEntry.reference.purchaseId ?? null) === (nextEntry.reference.purchaseId ?? null) &&
    (existingEntry.reference.requestId ?? null) === (nextEntry.reference.requestId ?? null) &&
    (existingEntry.reference.ticketId ?? null) === (nextEntry.reference.ticketId ?? null) &&
    (existingEntry.reference.drawId ?? null) === (nextEntry.reference.drawId ?? null) &&
    (existingEntry.reference.adminAdjustmentId ?? null) === (nextEntry.reference.adminAdjustmentId ?? null)
  );
}
