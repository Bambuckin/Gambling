import { DrawRefreshService, SystemTimeSource } from "@lottery/application";
import { createDefaultDrawSnapshots, InMemoryDrawStore, PostgresDrawStore } from "@lottery/infrastructure";
import type { DrawOption, DrawSnapshot } from "@lottery/domain";
import { getWebPostgresPool, getWebStorageBackend } from "../runtime/postgres-runtime";

let cachedService: DrawRefreshService | null = null;
let cachedDrawStore: InMemoryDrawStore | PostgresDrawStore | null = null;

export function getDrawStoreInstance(): InMemoryDrawStore | PostgresDrawStore {
  if (!cachedDrawStore) {
    const backend = getWebStorageBackend();
    cachedDrawStore =
      backend === "postgres" ? new PostgresDrawStore(getWebPostgresPool()) : new InMemoryDrawStore(readSeedSnapshots());
  }

  return cachedDrawStore;
}

export function getDrawRefreshService(): DrawRefreshService {
  if (!cachedService) {
    cachedService = new DrawRefreshService({
      drawStore: getDrawStoreInstance(),
      timeSource: new SystemTimeSource()
    });
  }

  return cachedService;
}

function readSeedSnapshots(): DrawSnapshot[] {
  const raw = process.env.LOTTERY_DRAW_SNAPSHOTS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const snapshots = parsed
          .map((item) => sanitizeSeedSnapshot(item))
          .filter((item): item is DrawSnapshot => item !== null);
        if (snapshots.length > 0) {
          return snapshots;
        }
      }
    } catch {
      // fall back to defaults
    }
  }

  return defaultSeedSnapshots();
}

function sanitizeSeedSnapshot(input: unknown): DrawSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const lotteryCode = typeof record.lotteryCode === "string" ? record.lotteryCode.trim().toLowerCase() : "";
  const drawId = typeof record.drawId === "string" ? record.drawId.trim() : "";
  const drawAt = typeof record.drawAt === "string" ? record.drawAt : "";
  const fetchedAt = typeof record.fetchedAt === "string" ? record.fetchedAt : "";
  const freshnessTtlSeconds =
    typeof record.freshnessTtlSeconds === "number" ? Math.trunc(record.freshnessTtlSeconds) : NaN;
  const availableDraws = sanitizeDrawOptions(record.availableDraws);

  if (!lotteryCode || !drawId || !drawAt || !fetchedAt || !Number.isFinite(freshnessTtlSeconds) || freshnessTtlSeconds <= 0) {
    return null;
  }

  return {
    lotteryCode,
    drawId,
    drawAt,
    fetchedAt,
    freshnessTtlSeconds,
    ...(availableDraws.length > 0 ? { availableDraws } : {})
  };
}

function defaultSeedSnapshots(): DrawSnapshot[] {
  return createDefaultDrawSnapshots(new Date());
}

function sanitizeDrawOptions(input: unknown): DrawOption[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => sanitizeDrawOption(item))
    .filter((item): item is DrawOption => item !== null);
}

function sanitizeDrawOption(input: unknown): DrawOption | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const drawId = typeof record.drawId === "string" ? record.drawId.trim() : "";
  const drawAt = typeof record.drawAt === "string" ? record.drawAt : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const priceMinor = typeof record.priceMinor === "number" ? Math.trunc(record.priceMinor) : undefined;

  if (!drawId || !drawAt || !label) {
    return null;
  }

  return {
    drawId,
    drawAt,
    label,
    ...(typeof priceMinor === "number" && Number.isFinite(priceMinor) ? { priceMinor } : {})
  };
}
