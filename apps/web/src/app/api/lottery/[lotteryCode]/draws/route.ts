import { NextResponse } from "next/server";
import { getDrawRefreshService } from "../../../../../lib/draw/draw-runtime";

type RouteContext = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const drawService = getDrawRefreshService();
  const drawState = await drawService.getDrawState(params.lotteryCode);
  const draws = await drawService.listAvailableDraws(params.lotteryCode);

  return NextResponse.json({
    lotteryCode: params.lotteryCode,
    status: drawState.status,
    blockedReason: describePurchaseBlockReason(drawState.status, drawState.freshness?.staleSince),
    draws
  });
}

function describePurchaseBlockReason(
  status: "fresh" | "stale" | "missing",
  staleSince: string | undefined
): string | null {
  if (status === "missing") {
    return "данные тиража отсутствуют";
  }

  return null;
}
