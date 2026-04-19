import type { DrawClosureStore, DrawStore, LotteryRegistryStore } from "@lottery/application";
import { normalizeLotteryCode, type DrawClosureRecord, type DrawSnapshot, type LotteryRegistryEntry } from "@lottery/domain";
import type { Pool } from "pg";
import { deepClone, optionalNormalizedText } from "./utils.js";

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

  async deleteSnapshot(lotteryCode: string): Promise<void> {
    const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
    await this.pool.query(
      `
        delete from lottery_draw_snapshots
        where lottery_code = $1
      `,
      [normalizedLotteryCode]
    );
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_draw_snapshots");
  }
}

export class PostgresDrawClosureStore implements DrawClosureStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
    const normalizedDrawId = drawId.trim();
    const result = await this.pool.query(
      `
        select record
        from lottery_draw_closures
        where lottery_code = $1 and draw_id = $2
        limit 1
      `,
      [normalizedLotteryCode, normalizedDrawId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.record as DrawClosureRecord) : null;
  }

  async saveClosure(record: DrawClosureRecord): Promise<void> {
    const normalizedRecord = normalizeDrawClosureRecord(record);

    await this.pool.query(
      `
        insert into lottery_draw_closures (
          lottery_code,
          draw_id,
          status,
          closed_at,
          record
        ) values ($1, $2, $3, $4, $5::jsonb)
        on conflict (lottery_code, draw_id)
        do update
          set status = excluded.status,
              closed_at = excluded.closed_at,
              record = excluded.record
      `,
      [
        normalizedRecord.lotteryCode,
        normalizedRecord.drawId,
        normalizedRecord.status,
        normalizedRecord.closedAt,
        JSON.stringify(normalizedRecord)
      ]
    );
  }

  async listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    const normalizedLotteryCode = optionalNormalizedText(lotteryCode);
    const result = normalizedLotteryCode
      ? await this.pool.query(
          `
            select record
            from lottery_draw_closures
            where lottery_code = $1
            order by coalesce(closed_at, to_timestamp(0)) desc, draw_id asc
          `,
          [normalizeLotteryCode(normalizedLotteryCode)]
        )
      : await this.pool.query(
          `
            select record
            from lottery_draw_closures
            order by coalesce(closed_at, to_timestamp(0)) desc, lottery_code asc, draw_id asc
          `
        );

    return result.rows.map((row: { record: DrawClosureRecord }) => deepClone(row.record));
  }

  async deleteClosure(lotteryCode: string, drawId: string): Promise<void> {
    const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
    const normalizedDrawId = drawId.trim();
    await this.pool.query(
      `
        delete from lottery_draw_closures
        where lottery_code = $1 and draw_id = $2
      `,
      [normalizedLotteryCode, normalizedDrawId]
    );
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_draw_closures");
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
    freshnessTtlSeconds: Math.trunc(snapshot.freshnessTtlSeconds),
    ...(snapshot.availableDraws
      ? {
          availableDraws: snapshot.availableDraws.map((draw) => ({
            drawId: draw.drawId.trim(),
            drawAt: toIsoString(draw.drawAt),
            label: draw.label.trim(),
            ...(typeof draw.priceMinor === "number" ? { priceMinor: Math.max(0, Math.trunc(draw.priceMinor)) } : {})
          }))
        }
      : {})
  };
}

function normalizeDrawClosureRecord(record: DrawClosureRecord): DrawClosureRecord {
  const normalizedClosedAt = optionalNormalizedText(record.closedAt);
  const normalizedClosedBy = optionalNormalizedText(record.closedBy);

  return {
    ...deepClone(record),
    lotteryCode: normalizeLotteryCode(record.lotteryCode),
    drawId: record.drawId.trim(),
    status: record.status,
    closedAt: normalizedClosedAt ? toIsoString(normalizedClosedAt) : null,
    closedBy: normalizedClosedBy ?? null
  };
}

function toIsoString(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString();
}
