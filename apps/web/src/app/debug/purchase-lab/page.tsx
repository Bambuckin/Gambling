import type { ReactElement } from "react";
import Link from "next/link";
import { getPurchaseRequestQueryService } from "../../../lib/purchase/purchase-runtime";

const SEEDED_USER_IDS = ["seed-user", "seed-admin", "seed-tester"] as const;

export default async function PurchaseLabPage(): Promise<ReactElement> {
  const queryService = getPurchaseRequestQueryService();
  const queueItems = await queryService.listQueueItems();
  const userRows = await Promise.all(
    SEEDED_USER_IDS.map(async (userId) => ({
      userId,
      requests: await queryService.listUserRequests(userId)
    }))
  );

  return (
    <section>
      <h1>Purchase Lab</h1>
      <p>Verification contour for Phase 5 purchase request lifecycle checks.</p>
      <p>This route is for manual validation only and is not an operational workflow screen.</p>

      <h2>Queue Snapshot</h2>
      {queueItems.length === 0 ? (
        <p>Queue is empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>User</th>
              <th>Lottery</th>
              <th>Attempts</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Enqueued at</th>
            </tr>
          </thead>
          <tbody>
            {queueItems.map((item) => (
              <tr key={item.requestId}>
                <td>{item.requestId}</td>
                <td>{item.userId}</td>
                <td>{item.lotteryCode}</td>
                <td>{item.attemptCount}</td>
                <td>{item.priority}</td>
                <td>{item.status}</td>
                <td>{item.enqueuedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {userRows.map((row) => (
        <article key={row.userId}>
          <h2>User: {row.userId}</h2>
          {row.requests.length === 0 ? (
            <p>No requests.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Draw</th>
                  <th>Attempts</th>
                  <th>Cost (minor)</th>
                  <th>Created at</th>
                  <th>Updated at</th>
                  <th>Final result</th>
                </tr>
              </thead>
              <tbody>
                {row.requests.map((request) => (
                  <tr key={request.requestId}>
                    <td>{request.requestId}</td>
                    <td>{request.status}</td>
                    <td>{request.drawId}</td>
                    <td>{request.attemptCount}</td>
                    <td>
                      {request.costMinor} {request.currency}
                    </td>
                    <td>{request.createdAt}</td>
                    <td>{request.updatedAt}</td>
                    <td>{request.finalResult ?? "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      ))}

      <p>
        <Link href="/">Back to shell</Link>
      </p>
      <p>
        <Link href="/lottery/demo-lottery">Open Demo Lottery</Link>
      </p>
    </section>
  );
}
