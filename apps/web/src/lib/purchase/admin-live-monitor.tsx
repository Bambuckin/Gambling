"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

interface TerminalSnapshot {
  readonly state: string;
  readonly activeRequestId: string | null;
  readonly consecutiveFailures: number;
  readonly lastErrorAt: string | null;
  readonly checkedAt: string;
}

interface QueuePressureSnapshot {
  readonly queueDepth: number;
  readonly queuedCount: number;
  readonly executingCount: number;
  readonly adminPriorityQueuedCount: number;
  readonly regularQueuedCount: number;
}

interface ProblemRequestRow {
  readonly requestId: string;
  readonly anomalyHint: "retrying" | "error" | "stale-executing";
  readonly status: string;
  readonly queueStatus: string;
  readonly queuePriority: string | null;
  readonly attemptCount: number;
  readonly updatedAt: string;
}

interface AdminLiveMonitorResponse {
  readonly fetchedAt: string;
  readonly terminal: TerminalSnapshot;
  readonly queue: QueuePressureSnapshot;
  readonly problemRequests: readonly ProblemRequestRow[];
  readonly activeExecutionRequestId: string | null;
}

interface AdminLiveMonitorProps {
  readonly initialTerminal: TerminalSnapshot;
  readonly initialQueue: QueuePressureSnapshot;
  readonly initialProblemRequests: readonly ProblemRequestRow[];
  readonly initialActiveExecutionRequestId: string | null;
}

const REFRESH_INTERVAL_MS = 2_500;

export function AdminLiveMonitor(props: AdminLiveMonitorProps): ReactElement {
  const [terminal, setTerminal] = useState<TerminalSnapshot>(props.initialTerminal);
  const [queue, setQueue] = useState<QueuePressureSnapshot>(props.initialQueue);
  const [problemRequests, setProblemRequests] = useState<readonly ProblemRequestRow[]>(
    props.initialProblemRequests
  );
  const [activeExecutionRequestId, setActiveExecutionRequestId] = useState<string | null>(
    props.initialActiveExecutionRequestId
  );
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch("/api/admin/operations", {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`status=${response.status}`);
        }

        const payload = (await response.json()) as AdminLiveMonitorResponse;
        if (cancelled) {
          return;
        }

        setTerminal(payload.terminal);
        setQueue(payload.queue);
        setProblemRequests(payload.problemRequests);
        setActiveExecutionRequestId(payload.activeExecutionRequestId);
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
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <article className="panel">
      <h2>Live operations</h2>
      <p className="muted">Auto-refresh каждые {REFRESH_INTERVAL_MS / 1000} сек без ручного reload.</p>
      <p className={`alert-row ${error ? "warn" : "ok"}`}>
        {error ? `Live-канал временно недоступен: ${error}` : `Синхронизировано: ${formatIso(fetchedAt) ?? "только что"}`}
      </p>

      <div className="mini-grid">
        <article className="mini-stat">
          <span className="label">Terminal state</span>
          <span className="value">{terminal.state}</span>
        </article>
        <article className="mini-stat">
          <span className="label">Active request</span>
          <span className="value">{activeExecutionRequestId ?? terminal.activeRequestId ?? "none"}</span>
        </article>
        <article className="mini-stat">
          <span className="label">Queue depth</span>
          <span className="value">{queue.queueDepth}</span>
        </article>
        <article className="mini-stat">
          <span className="label">Queued / Executing</span>
          <span className="value">
            {queue.queuedCount} / {queue.executingCount}
          </span>
        </article>
      </div>

      <p className="muted">Проблемные заявки: {problemRequests.length}</p>
    </article>
  );
}

function formatIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
