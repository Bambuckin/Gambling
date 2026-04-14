import type { ReactElement } from "react";
import Link from "next/link";
import { listMockTerminalInboxRows } from "../../../lib/purchase/mock-terminal-inbox";
import { MockTerminalLiveMonitor } from "../../../lib/purchase/mock-terminal-live-monitor";

export default async function TerminalReceiverPage(): Promise<ReactElement> {
  const rows = await listMockTerminalInboxRows();

  return (
    <section className="page-column">
      <article className="panel">
        <h1>Terminal Receiver Monitor</h1>
        <p>
          This page opens on the terminal PC and shows that the central server really delivered the Big 8 payload and
          that the receiver changed request state through the shared runtime.
        </p>
        <p className="muted">
          This is a LAN verification slice without real NLoto checkout. The terminal acts only as a receiver and status
          switcher.
        </p>
      </article>

      <MockTerminalLiveMonitor
        initialRows={rows}
        endpointPath="/api/terminal/receiver/inbox"
        title="Big 8 Receiver Inbox"
        refreshNote="Auto refresh every 2 sec from the central server."
        emptyMessage="No Big 8 requests have reached the terminal receiver yet."
      />

      <article className="panel">
        <h2>Quick Links</h2>
        <div className="actions-row">
          <Link className="btn-primary" href="/lottery/bolshaya-8">
            Open Big 8 client
          </Link>
          <Link className="btn-ghost" href="/admin">
            Open admin
          </Link>
          <Link className="btn-ghost" href="/debug/mock-terminal">
            Debug monitor
          </Link>
        </div>
      </article>
    </section>
  );
}
