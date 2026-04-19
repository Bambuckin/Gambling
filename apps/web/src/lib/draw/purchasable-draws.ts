import type { DrawAvailabilityState, DrawOption, LotteryDrawFreshnessMode } from "@lottery/domain";
import { getDrawClosureService } from "../purchase/purchase-runtime";
import { getDrawRefreshService } from "./draw-runtime";

export interface PurchasableDrawContext {
  readonly drawState: DrawAvailabilityState;
  readonly draws: readonly DrawOption[];
  readonly blockedReason: string | null;
}

export async function loadPurchasableDrawContext(
  lotteryCode: string,
  freshnessMode?: LotteryDrawFreshnessMode
): Promise<PurchasableDrawContext> {
  const drawService = getDrawRefreshService();
  const [drawState, availableDraws, closures] = await Promise.all([
    drawService.getDrawState(lotteryCode, freshnessMode),
    drawService.listAvailableDraws(lotteryCode),
    getDrawClosureService().listDrawClosures(lotteryCode)
  ]);
  const closedDrawIds = closures.filter((closure) => closure.status === "closed").map((closure) => closure.drawId);
  const draws = filterClosedDrawOptions(availableDraws, closedDrawIds);

  return {
    drawState,
    draws,
    blockedReason: describeDrawPurchaseBlockReason(drawState, draws.length)
  };
}

export function filterClosedDrawOptions(
  draws: readonly DrawOption[],
  closedDrawIds: Iterable<string>
): readonly DrawOption[] {
  const closed = new Set([...closedDrawIds].map((drawId) => drawId.trim()));
  return draws.filter((draw) => !closed.has(draw.drawId));
}

export function describeDrawPurchaseBlockReason(
  drawState: DrawAvailabilityState,
  availableDrawCount: number
): string | null {
  if (drawState.status === "missing") {
    return "данные тиража отсутствуют";
  }

  if (drawState.isPurchaseBlocked) {
    return drawState.status === "stale" ? "данные тиража устарели" : "покупка временно заблокирована";
  }

  if (availableDrawCount === 0) {
    return "нет открытых тиражей";
  }

  return null;
}
