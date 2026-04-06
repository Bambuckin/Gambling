import { DrawRefreshService, SystemTimeSource } from "@lottery/application";
import { InMemoryDrawStore, PostgresDrawStore } from "@lottery/infrastructure";
import type { DrawSnapshot } from "@lottery/domain";
import { getWebPostgresPool, getWebStorageBackend } from "../runtime/postgres-runtime";

let cachedService: DrawRefreshService | null = null;

export function getDrawRefreshService(): DrawRefreshService {
  if (!cachedService) {
    const backend = getWebStorageBackend();

    cachedService = new DrawRefreshService({
      drawStore:
        backend === "postgres"
          ? new PostgresDrawStore(getWebPostgresPool())
          : new InMemoryDrawStore(readSeedSnapshots()),
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

  if (!lotteryCode || !drawId || !drawAt || !fetchedAt || !Number.isFinite(freshnessTtlSeconds) || freshnessTtlSeconds <= 0) {
    return null;
  }

  return {
    lotteryCode,
    drawId,
    drawAt,
    fetchedAt,
    freshnessTtlSeconds
  };
}

function defaultSeedSnapshots(): DrawSnapshot[] {
  const now = Date.now();

  return [
    {
      lotteryCode: "demo-lottery",
      drawId: "demo-draw-001",
      drawAt: new Date(now + 60 * 60 * 1000).toISOString(),
      fetchedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      freshnessTtlSeconds: 60 * 60
    },
    {
      lotteryCode: "gosloto-6x45",
      drawId: "gosloto-draw-044",
      drawAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      fetchedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      freshnessTtlSeconds: 30 * 60
    }
  ];
}
