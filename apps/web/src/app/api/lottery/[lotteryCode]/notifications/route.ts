import { NextResponse } from "next/server";
import { getAccessService } from "../../../../../lib/access/access-runtime";
import { readSessionCookie } from "../../../../../lib/access/session-cookie";
import { getNotificationService } from "../../../../../lib/purchase/purchase-runtime";

type RouteContext = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const params = await context.params;
  const auth = await authenticateSession();
  if (!auth || auth.identity.role !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lotteryCode = params.lotteryCode.trim().toLowerCase();
  const notifications = (await getNotificationService().listUserNotifications(auth.identity.identityId)).filter(
    (notification) => notification.referenceLotteryCode === lotteryCode
  );

  return NextResponse.json({
    lotteryCode,
    fetchedAt: new Date().toISOString(),
    notifications
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
