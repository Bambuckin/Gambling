import { describe, expect, it } from "vitest";
import type { DrawOption, DrawSnapshot } from "@lottery/domain";
import { DrawRefreshService, type DrawDataProvider } from "../services/draw-refresh-service.js";
import type { DrawStore } from "../ports/draw-store.js";
import type { TimeSource } from "../ports/time-source.js";

describe("draw refresh service", () => {
  it("returns missing state when snapshot is absent", async () => {
    const service = buildService([], "2026-04-05T12:00:00.000Z");
    const state = await service.getDrawState("demo-lottery");
    expect(state.status).toBe("missing");
    expect(state.isPurchaseBlocked).toBe(true);
  });

  it("returns fresh state when snapshot is within ttl", async () => {
    const service = buildService(
      [
        {
          lotteryCode: "demo-lottery",
          drawId: "draw-100",
          drawAt: "2026-04-05T13:00:00.000Z",
          fetchedAt: "2026-04-05T11:50:00.000Z",
          freshnessTtlSeconds: 1800
        }
      ],
      "2026-04-05T12:00:00.000Z"
    );

    const state = await service.getDrawState("demo-lottery");
    expect(state.status).toBe("fresh");
    expect(state.isPurchaseBlocked).toBe(false);
  });

  it("returns stale state and blocks purchase when snapshot is old", async () => {
    const service = buildService(
      [
        {
          lotteryCode: "demo-lottery",
          drawId: "draw-101",
          drawAt: "2026-04-05T13:00:00.000Z",
          fetchedAt: "2026-04-05T09:00:00.000Z",
          freshnessTtlSeconds: 900
        }
      ],
      "2026-04-05T12:00:00.000Z"
    );

    const state = await service.getDrawState("demo-lottery");
    expect(state.status).toBe("stale");
    expect(state.isPurchaseBlocked).toBe(true);
    expect(state.freshness?.isFresh).toBe(false);
  });

  it("refreshes snapshot using provider data", async () => {
    const service = buildService([], "2026-04-05T12:00:00.000Z");
    const provider: DrawDataProvider = {
      async fetchCurrentDraw() {
        return {
          drawId: "draw-202",
          drawAt: "2026-04-05T18:00:00.000Z",
          fetchedAt: "2026-04-05T12:00:00.000Z",
          freshnessTtlSeconds: 3600,
          availableDraws: [
            drawOption("draw-202", "2026-04-05T18:00:00.000Z", "draw-202"),
            drawOption("draw-203", "2026-04-05T18:20:00.000Z", "draw-203")
          ]
        };
      }
    };

    const refreshed = await service.refreshLottery("demo-lottery", provider);
    expect(refreshed.status).toBe("fresh");
    expect(refreshed.snapshot?.drawId).toBe("draw-202");
    expect(refreshed.snapshot?.availableDraws).toHaveLength(2);
  });

  it("lists snapshot draw options in chronological order", async () => {
    const service = buildService(
      [
        {
          lotteryCode: "demo-lottery",
          drawId: "draw-301",
          drawAt: "2026-04-05T17:00:00.000Z",
          fetchedAt: "2026-04-05T12:00:00.000Z",
          freshnessTtlSeconds: 1800,
          availableDraws: [
            drawOption("draw-302", "2026-04-05T18:00:00.000Z", "later"),
            drawOption("draw-301", "2026-04-05T17:00:00.000Z", "earlier")
          ]
        }
      ],
      "2026-04-05T12:00:00.000Z"
    );

    const draws = await service.listAvailableDraws("demo-lottery");
    expect(draws.map((draw) => draw.drawId)).toEqual(["draw-301", "draw-302"]);
  });
});

function buildService(initialSnapshots: readonly DrawSnapshot[], nowIso: string): DrawRefreshService {
  return new DrawRefreshService({
    drawStore: new InMemoryDrawStore(initialSnapshots),
    timeSource: {
      nowIso() {
        return nowIso;
      }
    } satisfies TimeSource
  });
}

class InMemoryDrawStore implements DrawStore {
  private snapshots: DrawSnapshot[];

  constructor(initialSnapshots: readonly DrawSnapshot[]) {
    this.snapshots = initialSnapshots.map(cloneSnapshot);
  }

  async listSnapshots(): Promise<readonly DrawSnapshot[]> {
    return this.snapshots.map(cloneSnapshot);
  }

  async getSnapshot(lotteryCode: string): Promise<DrawSnapshot | null> {
    return this.snapshots.find((snapshot) => snapshot.lotteryCode === lotteryCode) ?? null;
  }

  async upsertSnapshot(snapshot: DrawSnapshot): Promise<void> {
    const filtered = this.snapshots.filter((entry) => entry.lotteryCode !== snapshot.lotteryCode);
    this.snapshots = [...filtered, cloneSnapshot(snapshot)];
  }
}

function cloneSnapshot(snapshot: DrawSnapshot): DrawSnapshot {
  return {
    ...snapshot,
    ...(snapshot.availableDraws
      ? {
          availableDraws: snapshot.availableDraws.map((draw) => ({ ...draw }))
        }
      : {})
  };
}

function drawOption(drawId: string, drawAt: string, label: string): DrawOption {
  return {
    drawId,
    drawAt,
    label
  };
}
