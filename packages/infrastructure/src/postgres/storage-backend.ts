export type LotteryStorageBackend = "in-memory" | "postgres";

export function readLotteryStorageBackendFromEnv(): LotteryStorageBackend {
  const raw = process.env.LOTTERY_STORAGE_BACKEND?.trim().toLowerCase();
  if (raw === "postgres") {
    return "postgres";
  }

  return "in-memory";
}

export function isPostgresStorageBackend(): boolean {
  return readLotteryStorageBackendFromEnv() === "postgres";
}
