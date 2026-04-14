import type { ReactElement } from "react";
import Link from "next/link";
import { getTicketQueryService } from "../../../lib/ticket/ticket-runtime";

const SEEDED_USER_IDS = ["seed-user", "seed-admin", "seed-tester"] as const;

export default async function TicketLabPage(): Promise<ReactElement> {
  const queryService = getTicketQueryService();
  const allTickets = await queryService.listAllTickets();
  const userRows = await Promise.all(
    SEEDED_USER_IDS.map(async (userId) => ({
      userId,
      tickets: await queryService.listUserTickets(userId)
    }))
  );

  return (
    <section>
      <h1>Ticket Lab</h1>
      <p>Verification contour for Phase 7 ticket outcome visibility and winnings checks.</p>
      <p>This route is verification-only and read-only; no operational mutation controls are allowed here.</p>

      <h2>All Ticket Snapshot</h2>
      {allTickets.length === 0 ? (
        <p>No tickets recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>User</th>
              <th>Lottery</th>
              <th>Draw</th>
              <th>Verification</th>
              <th>Winning (minor)</th>
              <th>Verified at</th>
              <th>External reference</th>
            </tr>
          </thead>
          <tbody>
            {allTickets.map((ticket) => (
              <tr key={ticket.ticketId}>
                <td>{ticket.ticketId}</td>
                <td>{ticket.userId}</td>
                <td>{ticket.lotteryCode}</td>
                <td>{ticket.drawId}</td>
                <td>{ticket.verificationStatus}</td>
                <td>{ticket.winningAmountMinor ?? 0}</td>
                <td>{ticket.verifiedAt ?? "pending"}</td>
                <td>{ticket.externalReference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {userRows.map((row) => (
        <article key={row.userId}>
          <h2>User: {row.userId}</h2>
          {row.tickets.length === 0 ? (
            <p>No tickets.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Request</th>
                  <th>Draw</th>
                  <th>Verification</th>
                  <th>Winning (minor)</th>
                  <th>Verified at</th>
                  <th>Purchased at</th>
                  <th>External reference</th>
                </tr>
              </thead>
              <tbody>
                {row.tickets.map((ticket) => (
                  <tr key={ticket.ticketId}>
                    <td>{ticket.ticketId}</td>
                    <td>{ticket.requestId}</td>
                    <td>{ticket.drawId}</td>
                    <td>{ticket.verificationStatus}</td>
                    <td>{ticket.winningAmountMinor ?? 0}</td>
                    <td>{ticket.verifiedAt ?? "pending"}</td>
                    <td>{ticket.purchasedAt}</td>
                    <td>{ticket.externalReference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      ))}

      <p>
        <Link href="/debug/purchase-lab">Open Purchase Lab</Link>
      </p>
      <p>
        <Link href="/lottery/mechtallion">Open Mechtallion</Link>
      </p>
      <p>
        <Link href="/">Back to shell</Link>
      </p>
    </section>
  );
}
