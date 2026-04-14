import type { ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { DrawAvailabilityState } from "@lottery/domain";
import type { LotteryOrderDirection, PurchaseQueuePriority } from "@lottery/application";
import { requireAdminAccess, submitLogout } from "../../lib/access/entry-flow";
import { getDrawRefreshService } from "../../lib/draw/draw-runtime";
import { getOperationsAlertService, getOperationsAuditService } from "../../lib/observability/operations-runtime";
import { listAdminRegistryEntries, moveAdminLottery, setAdminLotteryEnabled } from "../../lib/registry/admin-registry";
import { getAdminOperationsQueryService, getAdminQueueService } from "../../lib/purchase/purchase-runtime";
import { AdminLiveMonitor } from "../../lib/purchase/admin-live-monitor";

type AdminPageProps = {
  readonly searchParams: Promise<{
    readonly status?: string | string[];
    readonly message?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<ReactElement> {
  const access = await requireAdminAccess("/admin");
  const entries = await listAdminRegistryEntries();
  const [drawStates, queueSnapshot, operationsSnapshot, operationsAlerts] = await Promise.all([
    Promise.all(
      entries.map(async (entry) => [entry.lotteryCode, await getDrawRefreshService().getDrawState(entry.lotteryCode)] as const)
    ),
    getAdminQueueService().getQueueSnapshot(),
    getAdminOperationsQueryService().getSnapshot(),
    getOperationsAlertService().listActiveAlerts()
  ]);
  const drawStateByLotteryCode = new Map<string, DrawAvailabilityState>(drawStates);
  const resolvedSearchParams = await searchParams;
  const status = readSingleParam(resolvedSearchParams.status);
  const statusMessage = readSingleParam(resolvedSearchParams.message);

  return (
    <section>
      <h1>Admin Registry Console</h1>
      <p>Registry controls for enable/disable/reorder without handler or history deletion.</p>
      <p>Signed in as: {access.identity.displayName}</p>
      <p>Role: {access.identity.role}</p>
      <p>Session id: {access.session.sessionId}</p>
      <p>Total lotteries: {entries.length}</p>
      {status && statusMessage ? <p>Action [{status}]: {statusMessage}</p> : null}

      <h2>Operations Alerts</h2>
      {operationsAlerts.length === 0 ? (
        <p>No active critical/warning alerts.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Category</th>
              <th>Title</th>
              <th>Description</th>
              <th>References</th>
              <th>Detected at</th>
            </tr>
          </thead>
          <tbody>
            {operationsAlerts.map((alert) => (
              <tr key={alert.alertId}>
                <td>{alert.severity}</td>
                <td>{alert.category}</td>
                <td>{alert.title}</td>
                <td>{alert.description}</td>
                <td>{alert.referenceIds.length > 0 ? alert.referenceIds.join(", ") : "none"}</td>
                <td>{alert.detectedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Queue Operations</h2>
      <AdminLiveMonitor
        initialTerminal={operationsSnapshot.terminal}
        initialQueue={operationsSnapshot.queue}
        initialProblemRequests={operationsSnapshot.problemRequests.map((problem) => ({
          requestId: problem.requestId,
          anomalyHint: problem.anomalyHint,
          status: problem.status,
          queueStatus: problem.queueStatus,
          queuePriority: problem.queuePriority,
          attemptCount: problem.attemptCount,
          updatedAt: problem.updatedAt
        }))}
        initialActiveExecutionRequestId={queueSnapshot.activeExecutionRequestId}
      />

      <h3>Terminal Status</h3>
      <table>
        <tbody>
          <tr>
            <th>State</th>
            <td>{operationsSnapshot.terminal.state}</td>
          </tr>
          <tr>
            <th>Active request</th>
            <td>{operationsSnapshot.terminal.activeRequestId ?? "none"}</td>
          </tr>
          <tr>
            <th>Consecutive failures</th>
            <td>{operationsSnapshot.terminal.consecutiveFailures}</td>
          </tr>
          <tr>
            <th>Last error at</th>
            <td>{operationsSnapshot.terminal.lastErrorAt ?? "none"}</td>
          </tr>
          <tr>
            <th>Checked at</th>
            <td>{operationsSnapshot.terminal.checkedAt}</td>
          </tr>
        </tbody>
      </table>

      <h3>Queue Pressure</h3>
      <p>Queue depth: {operationsSnapshot.queue.queueDepth}</p>
      <p>Queued items: {operationsSnapshot.queue.queuedCount}</p>
      <p>Executing items: {operationsSnapshot.queue.executingCount}</p>
      <p>Admin-priority queued: {operationsSnapshot.queue.adminPriorityQueuedCount}</p>
      <p>Regular queued: {operationsSnapshot.queue.regularQueuedCount}</p>
      <p>Active execution request: {queueSnapshot.activeExecutionRequestId ?? "none"}</p>

      <form action={enqueueAsAdminPriorityAction}>
        <label htmlFor="priority-request-id">Queue existing request as admin-priority</label>
        <input id="priority-request-id" name="requestId" type="text" placeholder="req-..." required />
        <button type="submit">Enqueue As Admin Priority</button>
      </form>

      <h3>Queue Snapshot</h3>
      {queueSnapshot.rows.length === 0 ? (
        <p>Queue is empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>User</th>
              <th>Lottery</th>
              <th>Status</th>
              <th>Request state</th>
              <th>Priority</th>
              <th>Execution order</th>
              <th>Attempts</th>
              <th>Enqueued at</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {queueSnapshot.rows.map((row) => {
              const nextPriority: PurchaseQueuePriority =
                row.priority === "admin-priority" ? "regular" : "admin-priority";

              return (
                <tr key={row.requestId}>
                  <td>{row.requestId}</td>
                  <td>{row.userId}</td>
                  <td>{row.lotteryCode}</td>
                  <td>{row.status}</td>
                  <td>{row.requestState}</td>
                  <td>{row.priority}</td>
                  <td>{row.executionOrder ?? "active"}</td>
                  <td>{row.attemptCount}</td>
                  <td>{row.enqueuedAt}</td>
                  <td>
                    {row.status === "queued" ? (
                      <form action={setQueuePriorityAction}>
                        <input type="hidden" name="requestId" value={row.requestId} />
                        <input type="hidden" name="priority" value={nextPriority} />
                        <button type="submit">
                          {nextPriority === "admin-priority" ? "Set Admin Priority" : "Set Regular Priority"}
                        </button>
                      </form>
                    ) : (
                      "Executing item is locked"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h3>Problem Requests</h3>
      {operationsSnapshot.problemRequests.length === 0 ? (
        <p>No retrying, error, or stale executing requests detected.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Anomaly</th>
              <th>Status</th>
              <th>Queue status</th>
              <th>Queue priority</th>
              <th>Attempts</th>
              <th>User</th>
              <th>Lottery</th>
              <th>Draw</th>
              <th>Last error</th>
              <th>Updated at</th>
            </tr>
          </thead>
          <tbody>
            {operationsSnapshot.problemRequests.map((problem) => (
              <tr key={problem.requestId}>
                <td>{problem.requestId}</td>
                <td>{formatAnomalyHint(problem.anomalyHint)}</td>
                <td>{problem.status}</td>
                <td>{problem.queueStatus}</td>
                <td>{problem.queuePriority ?? "none"}</td>
                <td>{problem.attemptCount}</td>
                <td>{problem.userId}</td>
                <td>{problem.lotteryCode}</td>
                <td>{problem.drawId}</td>
                <td>{problem.lastError ?? "none"}</td>
                <td>{problem.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Enabled</th>
            <th>Display order</th>
            <th>Draw state</th>
            <th>Purchase state</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const drawState = drawStateByLotteryCode.get(entry.lotteryCode);
            const purchaseState = drawState?.isPurchaseBlocked ? "blocked" : "active";
            const drawLabel = drawState
              ? drawState.status === "stale" && drawState.freshness?.staleSince
                ? `stale (since ${drawState.freshness.staleSince})`
                : drawState.status
              : "missing";
            const isFirst = index === 0;
            const isLast = index === entries.length - 1;

            return (
              <tr key={entry.lotteryCode}>
                <td>{entry.lotteryCode}</td>
                <td>{entry.title}</td>
                <td>{entry.enabled ? "yes" : "no"}</td>
                <td>{entry.displayOrder}</td>
                <td>{drawLabel}</td>
                <td>{purchaseState}</td>
                <td>
                  <form action={setLotteryEnabledAction}>
                    <input type="hidden" name="lotteryCode" value={entry.lotteryCode} />
                    <input type="hidden" name="enabled" value={entry.enabled ? "false" : "true"} />
                    <button type="submit">{entry.enabled ? "Disable" : "Enable"}</button>
                  </form>
                  <form action={moveLotteryAction}>
                    <input type="hidden" name="lotteryCode" value={entry.lotteryCode} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={isFirst}>Move Up</button>
                  </form>
                  <form action={moveLotteryAction}>
                    <input type="hidden" name="lotteryCode" value={entry.lotteryCode} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={isLast}>Move Down</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p>
        <Link href="/">Back to shell</Link>
      </p>
      <p>
        <Link href="/debug/registry-lab">Open Registry Lab</Link>
      </p>
      <p>
        <Link href="/debug/admin-ops-lab">Open Admin Ops Lab</Link>
      </p>
      <p>
        <Link href="/lottery/mechtallion">Open Mechtallion</Link>
      </p>
      <p>
        <Link href="/lottery/bolshaya-8">Open Bolshaya 8</Link>
      </p>

      <form action={logoutFromAdminAction}>
        <button type="submit">Logout</button>
      </form>
    </section>
  );
}

async function setLotteryEnabledAction(formData: FormData): Promise<void> {
  "use server";

  await requireAdminAccess("/admin");

  try {
    const lotteryCode = readRequiredFormValue(formData, "lotteryCode");
    const enabled = readBooleanFormValue(formData.get("enabled"));
    const updated = await setAdminLotteryEnabled(lotteryCode, enabled);
    return redirect(
      `/admin?status=ok&message=${encodeURIComponent(
        `${updated.lotteryCode} is now ${updated.enabled ? "enabled" : "disabled"}`
      )}`
    );
  } catch (error) {
    return redirect(
      `/admin?status=error&message=${encodeURIComponent(resolveErrorMessage(error, "Failed to update visibility"))}`
    );
  }
}

async function moveLotteryAction(formData: FormData): Promise<void> {
  "use server";

  await requireAdminAccess("/admin");

  try {
    const lotteryCode = readRequiredFormValue(formData, "lotteryCode");
    const direction = readDirectionFormValue(formData.get("direction"));
    await moveAdminLottery(lotteryCode, direction);
    return redirect(`/admin?status=ok&message=${encodeURIComponent(`${lotteryCode} moved ${direction}`)}`);
  } catch (error) {
    return redirect(`/admin?status=error&message=${encodeURIComponent(resolveErrorMessage(error, "Failed to reorder"))}`);
  }
}

async function setQueuePriorityAction(formData: FormData): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");

  try {
    const requestId = readRequiredFormValue(formData, "requestId");
    const priority = readPriorityFormValue(formData.get("priority"));
    const queueItem = await getAdminQueueService().setQueuePriority({
      requestId,
      priority
    });
    await getOperationsAuditService().recordAdminQueueAction({
      actor: toAdminAuditActor(access),
      action: "queue_priority_changed",
      requestId: queueItem.requestId,
      reference: {
        requestId: queueItem.requestId,
        userId: queueItem.userId,
        lotteryCode: queueItem.lotteryCode,
        drawId: queueItem.drawId
      },
      message: `admin set queue priority to ${queueItem.priority}`
    });
    return redirect(
      `/admin?status=ok&message=${encodeURIComponent(`request ${queueItem.requestId} priority -> ${queueItem.priority}`)}`
    );
  } catch (error) {
    return redirect(
      `/admin?status=error&message=${encodeURIComponent(resolveErrorMessage(error, "Failed to set queue priority"))}`
    );
  }
}

async function enqueueAsAdminPriorityAction(formData: FormData): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");

  try {
    const requestId = readRequiredFormValue(formData, "requestId");
    const queued = await getAdminQueueService().enqueueAsAdminPriority({
      requestId
    });
    await getOperationsAuditService().recordAdminQueueAction({
      actor: toAdminAuditActor(access),
      action: "admin_priority_enqueued",
      requestId: queued.request.snapshot.requestId,
      reference: {
        requestId: queued.request.snapshot.requestId,
        userId: queued.request.snapshot.userId,
        lotteryCode: queued.request.snapshot.lotteryCode,
        drawId: queued.request.snapshot.drawId
      },
      message: queued.replayed
        ? `admin replayed queue request with ${queued.queueItem.priority} priority`
        : "admin enqueued request as admin-priority"
    });
    const message = queued.replayed
      ? `request ${queued.request.snapshot.requestId} already queued; priority is ${queued.queueItem.priority}`
      : `request ${queued.request.snapshot.requestId} queued as ${queued.queueItem.priority}`;
    return redirect(`/admin?status=ok&message=${encodeURIComponent(message)}`);
  } catch (error) {
    return redirect(
      `/admin?status=error&message=${encodeURIComponent(resolveErrorMessage(error, "Failed to queue admin priority request"))}`
    );
  }
}

async function logoutFromAdminAction(): Promise<void> {
  "use server";

  await submitLogout();
  redirect("/login");
}

function readSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`Missing form value: ${key}`);
  }
  return value;
}

function readBooleanFormValue(value: FormDataEntryValue | null): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error("Invalid boolean form value");
}

function readDirectionFormValue(value: FormDataEntryValue | null): LotteryOrderDirection {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "up" || normalized === "down") {
    return normalized;
  }

  throw new Error("Invalid reorder direction");
}

function readPriorityFormValue(value: FormDataEntryValue | null): PurchaseQueuePriority {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "regular" || normalized === "admin-priority") {
    return normalized;
  }

  throw new Error("Invalid queue priority value");
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function formatAnomalyHint(hint: "retrying" | "error" | "stale-executing"): string {
  if (hint === "stale-executing") {
    return "stale executing";
  }

  return hint;
}

function toAdminAuditActor(access: Awaited<ReturnType<typeof requireAdminAccess>>): {
  readonly actorId: string;
  readonly actorRole: "admin";
  readonly actorLabel: string;
} {
  return {
    actorId: access.identity.identityId,
    actorRole: "admin",
    actorLabel: access.identity.displayName
  };
}
