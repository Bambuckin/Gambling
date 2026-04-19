import { listSnapshotDrawOptions } from "@lottery/domain";
import { NextResponse } from "next/server";
import { getAccessService } from "../../../../lib/access/access-runtime";
import { readSessionCookie } from "../../../../lib/access/session-cookie";
import { getDrawRefreshService } from "../../../../lib/draw/draw-runtime";
import { getDrawClosureService } from "../../../../lib/purchase/purchase-runtime";
import { getTicketQueryService } from "../../../../lib/ticket/ticket-runtime";

type AdminTicketRow = {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly verificationStatus: "pending" | "verified" | "failed";
  readonly purchasedAt: string;
  readonly adminResultMark: "win" | "lose" | null;
  readonly winningAmountMinor: number | null;
  readonly resultSource: "terminal" | "admin_emulated" | null;
  readonly externalReference: string;
};

type AdminDrawRow = {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly fetchedAt: string;
  readonly status: "open" | "closed" | "settled";
  readonly closedAt: string | null;
  readonly settledAt: string | null;
  readonly tickets: readonly AdminTicketRow[];
};

export async function GET(): Promise<NextResponse> {
  const auth = await authenticateAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [snapshots, allTickets, closures, canonicalDraws] = await Promise.all([
    getDrawRefreshService().listSnapshots(),
    getTicketQueryService().listAllTickets(),
    getDrawClosureService().listDrawClosures(),
    getDrawClosureService().listDraws()
  ]);

  const ticketMap = new Map<string, AdminTicketRow[]>();
  for (const ticket of allTickets) {
    const key = `${ticket.lotteryCode}:${ticket.drawId}`;
    const group = ticketMap.get(key) ?? [];
    group.push(mapTicketRow(ticket));
    ticketMap.set(key, group);
  }

  const closureMap = new Map<string, (typeof closures)[number]>();
  for (const closure of closures) {
    closureMap.set(`${closure.lotteryCode}:${closure.drawId}`, closure);
  }
  const canonicalDrawMap = new Map<string, (typeof canonicalDraws)[number]>();
  for (const draw of canonicalDraws) {
    canonicalDrawMap.set(`${draw.lotteryCode}:${draw.drawId}`, draw);
  }
  const drawRows = new Map<string, AdminDrawRow>();

  for (const snapshot of snapshots) {
    for (const draw of listSnapshotDrawOptions(snapshot)) {
      const key = `${snapshot.lotteryCode}:${draw.drawId}`;
      const canonicalDraw = canonicalDrawMap.get(key);
      const closure = closureMap.get(key);

      drawRows.set(key, {
        lotteryCode: snapshot.lotteryCode,
        drawId: draw.drawId,
        drawAt: draw.drawAt,
        fetchedAt: snapshot.fetchedAt,
        status: canonicalDraw?.status ?? closure?.status ?? "open",
        closedAt: canonicalDraw?.closedAt ?? closure?.closedAt ?? null,
        settledAt: canonicalDraw?.settledAt ?? null,
        tickets: ticketMap.get(key) ?? []
      });
    }
  }

  for (const canonicalDraw of canonicalDraws) {
    const key = `${canonicalDraw.lotteryCode}:${canonicalDraw.drawId}`;
    if (drawRows.has(key)) {
      continue;
    }

    drawRows.set(key, {
      lotteryCode: canonicalDraw.lotteryCode,
      drawId: canonicalDraw.drawId,
      drawAt: canonicalDraw.drawAt,
      fetchedAt: canonicalDraw.openedAt,
      status: canonicalDraw.status,
      closedAt: canonicalDraw.closedAt,
      settledAt: canonicalDraw.settledAt,
      tickets: ticketMap.get(key) ?? []
    });
  }

  const draws = [...drawRows.values()].sort(compareAdminDrawRows);

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    draws
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticateAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const lotteryCode = typeof input.lotteryCode === "string" ? input.lotteryCode.trim() : "";
  const drawId = typeof input.drawId === "string" ? input.drawId.trim() : "";
  const drawAt = typeof input.drawAt === "string" ? input.drawAt.trim() : "";
  const freshnessTtlSeconds = typeof input.freshnessTtlSeconds === "number" ? input.freshnessTtlSeconds : 3600;

  if (!lotteryCode || !drawId || !drawAt) {
    return NextResponse.json({ error: "lotteryCode, drawId и drawAt обязательны" }, { status: 400 });
  }

  try {
    await getDrawRefreshService().upsertSnapshot({
      lotteryCode,
      drawId,
      drawAt,
      freshnessTtlSeconds,
      availableDraws: [
        {
          drawId,
          drawAt,
          label: buildManualDrawLabel(drawId, drawAt)
        }
      ]
    });
    await getDrawClosureService().createDraw({
      lotteryCode,
      drawId,
      drawAt
    });

    return NextResponse.json({ ok: true, lotteryCode, drawId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания тиража";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mapTicketRow(ticket: Awaited<ReturnType<ReturnType<typeof getTicketQueryService>["listAllTickets"]>>[number]): AdminTicketRow {
  return {
    ticketId: ticket.ticketId,
    requestId: ticket.requestId,
    userId: ticket.userId,
    verificationStatus: ticket.verificationStatus,
    purchasedAt: ticket.purchasedAt,
    adminResultMark: ticket.adminResultMark,
    winningAmountMinor: ticket.winningAmountMinor,
    resultSource: ticket.resultSource,
    externalReference: ticket.externalReference
  };
}

function compareAdminDrawRows(left: AdminDrawRow, right: AdminDrawRow): number {
  if (left.status !== right.status) {
    return rankDrawStatus(left.status) - rankDrawStatus(right.status);
  }

  const timeDiff = Date.parse(left.drawAt) - Date.parse(right.drawAt);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  const lotteryDiff = left.lotteryCode.localeCompare(right.lotteryCode);
  if (lotteryDiff !== 0) {
    return lotteryDiff;
  }

  return left.drawId.localeCompare(right.drawId);
}

function rankDrawStatus(status: AdminDrawRow["status"]): number {
  switch (status) {
    case "open":
      return 0;
    case "closed":
      return 1;
    case "settled":
      return 2;
  }
}

function buildManualDrawLabel(drawId: string, drawAt: string): string {
  const parsed = new Date(drawAt);
  if (Number.isNaN(parsed.getTime())) {
    return drawId;
  }

  return `${drawId} - ${parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

async function authenticateAdminSession(): Promise<{
  readonly identity: {
    readonly identityId: string;
    readonly role: "admin";
  };
} | null> {
  const sessionId = await readSessionCookie();
  if (!sessionId) {
    return null;
  }

  const authentication = await getAccessService().authenticate(sessionId);
  if (!authentication.ok || authentication.identity.role !== "admin") {
    return null;
  }

  return {
    identity: {
      identityId: authentication.identity.identityId,
      role: "admin"
    }
  };
}
