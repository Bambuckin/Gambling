import { NextResponse } from "next/server";
import { getAccessService } from "../../../../lib/access/access-runtime";
import { readSessionCookie } from "../../../../lib/access/session-cookie";
import { getAdminOperationsQueryService, getAdminQueueService } from "../../../../lib/purchase/purchase-runtime";

export async function GET(): Promise<NextResponse> {
  const auth = await authenticateSession();
  if (!auth || auth.identity.role !== "admin") {
    return NextResponse.json(
      {
        error: "unauthorized"
      },
      {
        status: 401
      }
    );
  }

  const [operationsSnapshot, queueSnapshot] = await Promise.all([
    getAdminOperationsQueryService().getSnapshot(),
    getAdminQueueService().getQueueSnapshot()
  ]);

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    terminal: operationsSnapshot.terminal,
    queue: operationsSnapshot.queue,
    problemRequests: operationsSnapshot.problemRequests,
    queueRows: queueSnapshot.rows,
    activeExecutionRequestId: queueSnapshot.activeExecutionRequestId
  });
}

async function authenticateSession(): Promise<
  | {
      readonly identity: {
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
      role: authentication.identity.role
    }
  };
}
