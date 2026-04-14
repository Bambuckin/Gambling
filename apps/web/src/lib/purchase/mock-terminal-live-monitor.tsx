"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { MockTerminalInboxRow } from "./mock-terminal-inbox";

interface MockTerminalLiveMonitorProps {
  readonly initialRows: readonly MockTerminalInboxRow[];
  readonly endpointPath?: string;
  readonly title?: string;
  readonly refreshNote?: string;
  readonly emptyMessage?: string;
}

interface MockTerminalLiveResponse {
  readonly fetchedAt: string;
  readonly rows: readonly MockTerminalInboxRow[];
}

const REFRESH_INTERVAL_MS = 2_000;

export function MockTerminalLiveMonitor(props: MockTerminalLiveMonitorProps): ReactElement {
  const [rows, setRows] = useState<readonly MockTerminalInboxRow[]>(props.initialRows);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const endpointPath = buildEndpointPath(props.endpointPath);

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(endpointPath, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`status=${response.status}`);
        }

        const payload = (await response.json()) as MockTerminalLiveResponse;
        if (cancelled) {
          return;
        }

        setRows(payload.rows);
        setFetchedAt(payload.fetchedAt);
        setError(null);
      } catch (refreshError) {
        if (cancelled) {
          return;
        }

        const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
        setError(message);
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [props.endpointPath]);

  return (
    <article className="panel">
      <h2>{props.title ?? "Mock Terminal Inbox"}</h2>
      <p className="muted">{props.refreshNote ?? `Auto refresh every ${REFRESH_INTERVAL_MS / 1000} sec.`}</p>
      <p className={`alert-row ${error ? "warn" : "ok"}`}>
        {error ? `Stream temporarily unavailable: ${error}` : `Synced: ${formatIso(fetchedAt) ?? "just now"}`}
      </p>

      {rows.length === 0 ? (
        <p className="muted">{props.emptyMessage ?? "No Big 8 requests have reached the receiver yet."}</p>
      ) : (
        <div className="page-column">
          {rows.map((row) => (
            <article key={row.requestId} className="panel">
              <p>
                <strong>{row.requestId}</strong> | state={row.state} | draw={row.drawId}
              </p>
              <p>
                receiver={row.receiverLabel ?? "n/a"} | user={row.userId} | attempts={row.attemptCount}
              </p>
              <p>
                reserved={formatIso(row.reservedAt) ?? "n/a"} | updated={formatIso(row.updatedAt) ?? row.updatedAt}
              </p>
              <p>
                phone={row.phoneMasked ?? "n/a"} | tickets={row.ticketCount}
              </p>
              <p>
                worker raw: <code>{row.workerRawOutput ?? "n/a"}</code>
              </p>
              <details>
                <summary>Payload snapshot</summary>
                <pre>{JSON.stringify(row.payload, null, 2)}</pre>
              </details>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

function buildEndpointPath(endpointPath: string | undefined): string {
  const value = endpointPath?.trim();
  if (!value) {
    return "/api/debug/mock-terminal/inbox";
  }

  return value;
}

function formatIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
