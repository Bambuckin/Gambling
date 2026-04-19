import { describe, expect, it } from "vitest";
import type { DrawAvailabilityState, DrawOption } from "@lottery/domain";
import { describeDrawPurchaseBlockReason, filterClosedDrawOptions } from "../purchasable-draws";

describe("purchasable draws", () => {
  it("filters out closed draw ids from available draw options", () => {
    const draws: readonly DrawOption[] = [
      { drawId: "draw-1", drawAt: "2026-04-18T10:00:00.000Z", label: "draw-1" },
      { drawId: "draw-2", drawAt: "2026-04-18T11:00:00.000Z", label: "draw-2" }
    ];

    const filtered = filterClosedDrawOptions(draws, ["draw-2"]);
    expect(filtered.map((draw) => draw.drawId)).toEqual(["draw-1"]);
  });

  it("blocks purchase when no open draws remain", () => {
    const drawState: DrawAvailabilityState = {
      lotteryCode: "bolshaya-8",
      status: "fresh",
      isPurchaseBlocked: false,
      snapshot: {
        lotteryCode: "bolshaya-8",
        drawId: "draw-1",
        drawAt: "2026-04-18T10:00:00.000Z",
        fetchedAt: "2026-04-18T09:00:00.000Z",
        freshnessTtlSeconds: 3600
      },
      freshness: {
        isFresh: true
      }
    };

    expect(describeDrawPurchaseBlockReason(drawState, 0)).toBe("нет открытых тиражей");
  });
});
