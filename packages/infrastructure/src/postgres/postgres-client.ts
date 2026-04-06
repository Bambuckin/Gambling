import { Pool } from "pg";

const poolByConnectionString = new Map<string, Pool>();

export interface PostgresPoolOptions {
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
}

export function getPostgresPool(connectionString: string, options: PostgresPoolOptions = {}): Pool {
  const normalized = connectionString.trim();
  if (!normalized) {
    throw new Error("Postgres connection string is required");
  }

  const existing = poolByConnectionString.get(normalized);
  if (existing) {
    return existing;
  }

  const pool = new Pool({
    connectionString: normalized,
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.idleTimeoutMillis !== undefined ? { idleTimeoutMillis: options.idleTimeoutMillis } : {})
  });

  poolByConnectionString.set(normalized, pool);
  return pool;
}

export function readPostgresConnectionStringFromEnv(): string {
  const fromDedicated = process.env.LOTTERY_POSTGRES_URL?.trim();
  if (fromDedicated) {
    return fromDedicated;
  }

  const fromFallback = process.env.DATABASE_URL?.trim();
  if (fromFallback) {
    return fromFallback;
  }

  return "";
}

export async function closeAllPostgresPools(): Promise<void> {
  const pools = [...poolByConnectionString.values()];
  poolByConnectionString.clear();
  await Promise.all(pools.map(async (pool) => pool.end()));
}
