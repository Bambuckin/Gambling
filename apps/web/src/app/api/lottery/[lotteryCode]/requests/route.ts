import { NextResponse } from "next/server";
import { getAccessService } from "../../../../../lib/access/access-runtime";
import { readSessionCookie } from "../../../../../lib/access/session-cookie";
import { loadPurchasableDrawContext } from "../../../../../lib/draw/purchasable-draws";
import {
  ensureDefaultLedgerEntries,
  LEDGER_DEFAULT_CURRENCY,
  getWalletLedgerService
} from "../../../../../lib/ledger/ledger-runtime";
import {
  getPurchaseRequestQueryService,
  recoverInterruptedLotteryPurchaseRequests
} from "../../../../../lib/purchase/purchase-runtime";
import { presentLotteryLiveRequest } from "../../../../../lib/purchase/lottery-live-request-presenter";
import { presentLotteryLiveTicket } from "../../../../../lib/purchase/lottery-live-ticket-presenter";
import { getLotteryRegistryService } from "../../../../../lib/registry/registry-runtime";
import { getTicketQueryService } from "../../../../../lib/ticket/ticket-runtime";

type RouteContext = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const auth = await authenticateSession();
  if (!auth || auth.identity.role !== "user") {
    return NextResponse.json(
      {
        error: "unauthorized"
      },
      {
        status: 401
      }
    );
  }

  const lotteryCode = params.lotteryCode.trim().toLowerCase();
  await recoverInterruptedLotteryPurchaseRequests(auth.identity.identityId, lotteryCode);
  await ensureDefaultLedgerEntries();
  const lottery = await getLotteryRegistryService().getLotteryByCode(lotteryCode);
  const [requests, tickets, walletSnapshot, drawContext] = await Promise.all([
    getPurchaseRequestQueryService()
      .listUserRequests(auth.identity.identityId)
      .then((entries) => entries.filter((request) => request.lotteryCode === lotteryCode)),
    getTicketQueryService()
      .listUserTickets(auth.identity.identityId)
      .then((entries) => entries.filter((ticket) => ticket.lotteryCode === lotteryCode)),
    getWalletLedgerService().getWalletSnapshot(auth.identity.identityId, LEDGER_DEFAULT_CURRENCY),
    loadPurchasableDrawContext(lotteryCode, lottery?.drawFreshnessMode)
  ]);

  return NextResponse.json({
    lotteryCode,
    fetchedAt: new Date().toISOString(),
    requests: requests.map((request) => presentLotteryLiveRequest(request)),
    tickets: tickets.map((ticket) => presentLotteryLiveTicket(ticket)),
    wallet: {
      availableMinor: walletSnapshot.availableMinor,
      reservedMinor: walletSnapshot.reservedMinor,
      currency: walletSnapshot.currency
    },
    currentDraw: resolveCurrentDraw(drawContext)
  });
}

async function authenticateSession(): Promise<
  | {
      readonly identity: {
        readonly identityId: string;
        readonly role: "user" | "admin";
      };
    }
  | null
> {
  const sessionId = await readSessionCookie();
  if (!sessionId) {
    return null;
  }

  const authentication = await getAccessService().authenticate(sessionId);
  if (!authentication.ok) {
    return null;
  }

  return {
    identity: {
      identityId: authentication.identity.identityId,
      role: authentication.identity.role
    }
  };
}

function resolveCurrentDraw(
  drawContext: Awaited<ReturnType<typeof loadPurchasableDrawContext>>
): {
  readonly drawId: string;
  readonly label: string;
  readonly drawAt: string | null;
} | null {
  const snapshot = drawContext.drawState.snapshot;
  if (snapshot) {
    const matchedDraw =
      drawContext.draws.find((draw) => draw.drawId === snapshot.drawId) ??
      snapshot.availableDraws?.find((draw) => draw.drawId === snapshot.drawId);

    return {
      drawId: snapshot.drawId,
      label: matchedDraw?.label ?? snapshot.drawId,
      drawAt: matchedDraw?.drawAt ?? snapshot.drawAt
    };
  }

  const fallbackDraw = drawContext.draws[0];
  if (!fallbackDraw) {
    return null;
  }

  return {
    drawId: fallbackDraw.drawId,
    label: fallbackDraw.label,
    drawAt: fallbackDraw.drawAt
  };
}
