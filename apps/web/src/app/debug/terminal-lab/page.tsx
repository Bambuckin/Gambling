import type { ReactElement } from "react";
import Link from "next/link";
import { getPurchaseRequestQueryService } from "../../../lib/purchase/purchase-runtime";
import { getTerminalHealthService } from "../../../lib/terminal/terminal-runtime";

export default async function TerminalLabPage(): Promise<ReactElement> {
  const terminalHealthService = getTerminalHealthService();
  const purchaseQueryService = getPurchaseRequestQueryService();

  const [snapshot, queueItems] = await Promise.all([
    terminalHealthService.getStateSnapshot(),
    purchaseQueryService.listQueueItems()
  ]);

  return (
    <section>
      <h1>Terminal Lab</h1>
      <p>Verification contour for Phase 6 terminal execution health states.</p>
      <p>This route is verification-only and must not be used as an operational control panel.</p>

      <h2>Terminal State Snapshot</h2>
      <table>
        <tbody>
          <tr>
            <th>state</th>
            <td>{snapshot.state}</td>
          </tr>
          <tr>
            <th>active request</th>
            <td>{snapshot.activeRequestId ?? "none"}</td>
          </tr>
          <tr>
            <th>queue depth</th>
            <td>{snapshot.queueDepth}</td>
          </tr>
          <tr>
            <th>consecutive failures</th>
            <td>{snapshot.consecutiveFailures}</td>
          </tr>
          <tr>
            <th>last error at</th>
            <td>{snapshot.lastErrorAt ?? "none"}</td>
          </tr>
          <tr>
            <th>checked at</th>
            <td>{snapshot.checkedAt}</td>
          </tr>
        </tbody>
      </table>

      <h2>Queue Snapshot</h2>
      {queueItems.length === 0 ? (
        <p>Queue is empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Attempts</th>
              <th>Enqueued at</th>
            </tr>
          </thead>
          <tbody>
            {queueItems.map((item) => (
              <tr key={item.requestId}>
                <td>{item.requestId}</td>
                <td>{item.status}</td>
                <td>{item.priority}</td>
                <td>{item.attemptCount}</td>
                <td>{item.enqueuedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <Link href="/debug/purchase-lab">Open Purchase Lab</Link>
      </p>
      <p>
        <Link href="/">Back to shell</Link>
      </p>
    </section>
  );
}
