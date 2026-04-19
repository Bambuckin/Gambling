import { NextResponse } from "next/server";
import { loadPurchasableDrawContext } from "../../../../../lib/draw/purchasable-draws";
import { getLotteryRegistryService } from "../../../../../lib/registry/registry-runtime";

type RouteContext = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const lotteryCode = params.lotteryCode.trim().toLowerCase();
  const lottery = await getLotteryRegistryService().getLotteryByCode(lotteryCode);
  const drawContext = await loadPurchasableDrawContext(lotteryCode, lottery?.drawFreshnessMode);

  return NextResponse.json({
    lotteryCode,
    status: drawContext.drawState.status,
    blockedReason: drawContext.blockedReason,
    draws: drawContext.draws
  });
}
