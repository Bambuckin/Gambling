import type { DrawStore, LotteryRegistryStore } from "@lottery/application";
import { normalizeLotteryCode, type DrawSnapshot, type LotteryRegistryEntry } from "@lottery/domain";
import type { Pool } from "pg";
import { deepClone } from "./utils.js";

export class PostgresLotteryRegistryStore implements LotteryRegistryStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listEntries(): Promise<readonly LotteryRegistryEntry[]> {
    const result = await this.pool.query(
      `
        select entry
        from lottery_registry_entries
        order by display_order asc, lottery_code asc
      `
    );

    return result.rows.map((row: { entry: LotteryRegistryEntry }) => deepClone(row.entry));
  }

  async saveEntries(entries: readonly LotteryRegistryEntry[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from lottery_registry_entries");

      for (const entry of entries) {
        const normalizedEntry = normalizeRegistryEntry(entry);
        await client.query(
          `
            insert into lottery_registry_entries (
              lottery_code,
              display_order,
              enabled,
              entry
            ) values ($1, $2, $3, $4::jsonb)
          `,
          [
            normalizedEntry.lotteryCode,
            normalizedEntry.displayOrder,
            normalizedEntry.enabled,
            JSON.stringify(normalizedEntry)
          ]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

export class PostgresDrawStore implements DrawStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listSnapshots(): Promise<readonly DrawSnapshot[]> {
    const result = await this.pool.query(
      `
        select snapshot
        from lottery_draw_snapshots
        order by fetched_at desc, lottery_code asc
      `
    );

    return result.rows.map((row: { snapshot: DrawSnapshot }) => deepClone(row.snapshot));
  }

  async getSnapshot(lotteryCode: string): Promise<DrawSnapshot | null> {
    const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
    const result = await this.pool.query(
      `
        select snapshot
        from lottery_draw_snapshots
        where lottery_code = $1
        limit 1
      `,
      [normalizedLotteryCode]
    );

    const row = result.rows[0];
    return row ? deepClone(row.snapshot as DrawSnapshot) : null;
  }

  async upsertSnapshot(snapshot: DrawSnapshot): Promise<void> {
    const normalizedSnapshot = normalizeDrawSnapshot(snapshot);

    await this.pool.query(
      `
        insert into lottery_draw_snapshots (
          lottery_code,
          fetched_at,
          snapshot
        ) values ($1, $2, $3::jsonb)
        on conflict (lottery_code)
        do update
          set fetched_at = excluded.fetched_at,
              snapshot = excluded.snapshot
      `,
      [
        normalizedSnapshot.lotteryCode,
        normalizedSnapshot.fetchedAt,
        JSON.stringify(normalizedSnapshot)
      ]
    );
  }
}

function normalizeRegistryEntry(entry: LotteryRegistryEntry): LotteryRegistryEntry {
  return {
    ...deepClone(entry),
    lotteryCode: normalizeLotteryCode(entry.lotteryCode)
  };
}

function normalizeDrawSnapshot(snapshot: DrawSnapshot): DrawSnapshot {
  return {
    ...deepClone(snapshot),
    lotteryCode: normalizeLotteryCode(snapshot.lotteryCode),
    drawId: snapshot.drawId.trim(),
    drawAt: toIsoString(snapshot.drawAt),
    fetchedAt: toIsoString(snapshot.fetchedAt),
    freshnessTtlSeconds: Math.trunc(snapshot.freshnessTtlSeconds)
  };
}

function toIsoString(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString();
}
