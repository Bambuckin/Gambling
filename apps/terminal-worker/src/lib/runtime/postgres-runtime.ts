import {
  getPostgresPool,
  readLotteryStorageBackendFromEnv,
  readPostgresConnectionStringFromEnv,
  type LotteryStorageBackend
} from "@lottery/infrastructure";

let cachedBackend: LotteryStorageBackend | null = null;
let cachedPool: ReturnType<typeof getPostgresPool> | null = null;

export function getWorkerStorageBackend(): LotteryStorageBackend {
  if (!cachedBackend) {
    cachedBackend = readLotteryStorageBackendFromEnv();
  }

  return cachedBackend;
}

export function getWorkerPostgresPool(): ReturnType<typeof getPostgresPool> {
  if (cachedPool) {
    return cachedPool;
  }

  const connectionString = readPostgresConnectionStringFromEnv();
  if (!connectionString) {
    throw new Error(
      "LOTTERY_STORAGE_BACKEND=postgres requires LOTTERY_POSTGRES_URL (or DATABASE_URL)"
    );
  }

  cachedPool = getPostgresPool(connectionString);
  return cachedPool;
}
