import type { ReactElement } from "react";
import Link from "next/link";
import { getOperationsAlertService, getOperationsAuditService } from "../../../lib/observability/operations-runtime";
import { getAdminOperationsQueryService, getAdminQueueService } from "../../../lib/purchase/purchase-runtime";

export default async function AdminOpsLabPage(): Promise<ReactElement> {
  const [queueSnapshot, operationsSnapshot, alerts, auditEvents] = await Promise.all([
    getAdminQueueService().getQueueSnapshot(),
    getAdminOperationsQueryService().getSnapshot(),
    getOperationsAlertService().listActiveAlerts(),
    getOperationsAuditService().listEvents({ limit: 50 })
  ]);

  return (
    <section>
      <h1>Admin Ops Lab</h1>
      <p>Verification contour for Phase 8 admin operations and observability.</p>
      <p>This route is read-only. Operational mutations remain on `/admin` only.</p>

      <h2>Terminal Snapshot</h2>
      <table>
        <tbody>
          <tr>
            <th>state</th>
            <td>{operationsSnapshot.terminal.state}</td>
          </tr>
          <tr>
            <th>active request</th>
            <td>{operationsSnapshot.terminal.activeRequestId ?? "none"}</td>
          </tr>
          <tr>
            <th>queue depth</th>
            <td>{operationsSnapshot.terminal.queueDepth}</td>
          </tr>
          <tr>
            <th>consecutive failures</th>
            <td>{operationsSnapshot.terminal.consecutiveFailures}</td>
          </tr>
          <tr>
            <th>last error at</th>
            <td>{operationsSnapshot.terminal.lastErrorAt ?? "none"}</td>
          </tr>
          <tr>
            <th>checked at</th>
            <td>{operationsSnapshot.terminal.checkedAt}</td>
          </tr>
        </tbody>
      </table>

      <h2>Queue Snapshot</h2>
      <p>Queue depth: {queueSnapshot.queueDepth}</p>
      <p>Queued: {queueSnapshot.queuedCount}</p>
      <p>Executing: {queueSnapshot.executingCount}</p>
      <p>Admin-priority queued: {queueSnapshot.adminPriorityQueuedCount}</p>
      <p>Regular queued: {queueSnapshot.regularQueuedCount}</p>
      <p>Active execution request: {queueSnapshot.activeExecutionRequestId ?? "none"}</p>

      <h3>Queue Rows</h3>
      {queueSnapshot.rows.length === 0 ? (
        <p>Queue is empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Order</th>
              <th>Attempts</th>
              <th>Request state</th>
              <th>User</th>
              <th>Lottery</th>
            </tr>
          </thead>
          <tbody>
            {queueSnapshot.rows.map((row) => (
              <tr key={row.requestId}>
                <td>{row.requestId}</td>
                <td>{row.status}</td>
                <td>{row.priority}</td>
                <td>{row.executionOrder ?? "active"}</td>
                <td>{row.attemptCount}</td>
                <td>{row.requestState}</td>
                <td>{row.userId}</td>
                <td>{row.lotteryCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Problem Requests</h2>
      {operationsSnapshot.problemRequests.length === 0 ? (
        <p>No problematic requests.</p>
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
              <th>Last error</th>
              <th>Updated at</th>
            </tr>
          </thead>
          <tbody>
            {operationsSnapshot.problemRequests.map((item) => (
              <tr key={item.requestId}>
                <td>{item.requestId}</td>
                <td>{item.anomalyHint}</td>
                <td>{item.status}</td>
                <td>{item.queueStatus}</td>
                <td>{item.queuePriority ?? "none"}</td>
                <td>{item.attemptCount}</td>
                <td>{item.lastError ?? "none"}</td>
                <td>{item.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Active Alerts</h2>
      {alerts.length === 0 ? (
        <p>No active alerts.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Category</th>
              <th>Title</th>
              <th>Description</th>
              <th>References</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.alertId}>
                <td>{alert.severity}</td>
                <td>{alert.category}</td>
                <td>{alert.title}</td>
                <td>{alert.description}</td>
                <td>{alert.referenceIds.length > 0 ? alert.referenceIds.join(", ") : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Recent Operations Audit Events</h2>
      {auditEvents.length === 0 ? (
        <p>No operations audit events.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Domain</th>
              <th>Action</th>
              <th>Severity</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Reference</th>
              <th>Occurred at</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((event) => (
              <tr key={event.eventId}>
                <td>{event.eventId}</td>
                <td>{event.domain}</td>
                <td>{event.action}</td>
                <td>{event.severity}</td>
                <td>{event.actor.actorId}</td>
                <td>{event.target.targetType}:{event.target.targetId}</td>
                <td>{formatReference(event.reference)}</td>
                <td>{event.occurredAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <Link href="/admin">Open Admin Console</Link>
      </p>
      <p>
        <Link href="/debug/terminal-lab">Open Terminal Lab</Link>
      </p>
      <p>
        <Link href="/debug/purchase-lab">Open Purchase Lab</Link>
      </p>
      <p>
        <Link href="/debug/mock-terminal">Open Mock Terminal Inbox</Link>
      </p>
      <p>
        <Link href="/">Back to shell</Link>
      </p>
    </section>
  );
}

function formatReference(reference: {
  readonly requestId?: string;
  readonly userId?: string;
  readonly lotteryCode?: string;
  readonly drawId?: string;
  readonly terminalId?: string;
  readonly ledgerEntryId?: string;
}): string {
  const parts = [
    reference.requestId ? `request=${reference.requestId}` : null,
    reference.userId ? `user=${reference.userId}` : null,
    reference.lotteryCode ? `lottery=${reference.lotteryCode}` : null,
    reference.drawId ? `draw=${reference.drawId}` : null,
    reference.terminalId ? `terminal=${reference.terminalId}` : null,
    reference.ledgerEntryId ? `ledger=${reference.ledgerEntryId}` : null
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(", ") : "none";
}
