import {
  getPostgresPool,
  readLotteryStorageBackendFromEnv,
  readPostgresConnectionStringFromEnv,
  type LotteryStorageBackend
} from "@lottery/infrastructure";

let cachedBackend: LotteryStorageBackend | null = null;
let cachedConnectionString: string | null = null;
let cachedPool: ReturnType<typeof getPostgresPool> | null = null;

export function getWebStorageBackend(): LotteryStorageBackend {
  if (!cachedBackend) {
    cachedBackend = readLotteryStorageBackendFromEnv();
  }

  return cachedBackend;
}

export function getWebPostgresPool(): ReturnType<typeof getPostgresPool> {
  if (cachedPool) {
    return cachedPool;
  }

  const connectionString = readPostgresConnectionStringFromEnv();
  if (!connectionString) {
    throw new Error(
      "LOTTERY_STORAGE_BACKEND=postgres requires LOTTERY_POSTGRES_URL (or DATABASE_URL)"
    );
  }

  cachedConnectionString = connectionString;
  cachedPool = getPostgresPool(connectionString);
  return cachedPool;
}

export function getWebPostgresConnectionString(): string {
  if (cachedConnectionString) {
    return cachedConnectionString;
  }

  const connectionString = readPostgresConnectionStringFromEnv();
  cachedConnectionString = connectionString;
  return connectionString;
}
