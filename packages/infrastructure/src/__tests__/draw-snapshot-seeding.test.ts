import { describe, expect, it } from "vitest";
import type { DrawSnapshot } from "@lottery/domain";
import { selectSeedDrawSnapshots } from "../seeds/draw-snapshot-seeding.js";

describe("selectSeedDrawSnapshots", () => {
  it("returns defaults when runtime snapshots table is empty", () => {
    const defaults = [
      {
        lotteryCode: "bolshaya-8",
        drawId: "draw-001",
        drawAt: "2026-04-22T10:00:00.000Z",
        fetchedAt: "2026-04-22T09:59:00.000Z",
        freshnessTtlSeconds: 1800
      }
    ] satisfies readonly DrawSnapshot[];

    expect(selectSeedDrawSnapshots([], defaults)).toEqual(defaults);
  });

  it("does not recreate defaults when operator-managed snapshots already exist", () => {
    const existing = [
      {
        lotteryCode: "bolshaya-8",
        drawId: "custom-draw-001",
        drawAt: "2026-04-22T11:00:00.000Z",
        fetchedAt: "2026-04-22T10:59:00.000Z",
        freshnessTtlSeconds: 1800
      }
    ] satisfies readonly DrawSnapshot[];
    const defaults = [
      {
        lotteryCode: "bolshaya-8",
        drawId: "seed-draw-001",
        drawAt: "2026-04-22T10:00:00.000Z",
        fetchedAt: "2026-04-22T09:59:00.000Z",
        freshnessTtlSeconds: 1800
      },
      {
        lotteryCode: "super-8",
        drawId: "seed-draw-002",
        drawAt: "2026-04-22T12:00:00.000Z",
        fetchedAt: "2026-04-22T11:59:00.000Z",
        freshnessTtlSeconds: 1800
      }
    ] satisfies readonly DrawSnapshot[];

    expect(selectSeedDrawSnapshots(existing, defaults)).toEqual([]);
  });
});
