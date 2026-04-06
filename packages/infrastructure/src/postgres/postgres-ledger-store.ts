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

    await this.pool.query(
      `
        insert into lottery_ledger_entries (
          entry_id,
          user_id,
          created_at,
          idempotency_key,
          entry
        ) values ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        normalizedEntry.entryId,
        normalizedEntry.userId,
        normalizedEntry.createdAt,
        normalizedEntry.idempotencyKey,
        JSON.stringify(normalizedEntry)
      ]
    );
  }
}
