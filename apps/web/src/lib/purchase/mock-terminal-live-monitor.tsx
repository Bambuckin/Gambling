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
      <h2>{props.title ?? "Очередь терминала"}</h2>
      <p className="muted">{props.refreshNote ?? `Обновление каждые ${REFRESH_INTERVAL_MS / 1000} секунды.`}</p>
      <p className={`alert-row ${error ? "warn" : "ok"}`}>
        {error ? `Связь с терминалом временно недоступна: ${error}` : `Синхронизировано: ${formatIso(fetchedAt) ?? "только что"}`}
      </p>

      {rows.length === 0 ? (
        <p className="muted">{props.emptyMessage ?? "Заявок на терминале пока нет."}</p>
      ) : (
        <div className="page-column">
          {rows.map((row) => (
            <article key={row.requestId} className="panel">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <p style={{ marginBottom: "0.25rem" }}>
                    <strong>{row.requestId}</strong>
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    Пользователь: {row.userId} | Тираж: {row.drawId}
                  </p>
                </div>
                <span className={`badge ${resolveStateTone(row.state)}`}>{formatState(row.state)}</span>
              </div>

              <div className="mini-grid" style={{ marginTop: "0.75rem" }}>
                <article className="mini-stat">
                  <span className="label">Билетов</span>
                  <span className="value">{row.ticketCount}</span>
                </article>
                <article className="mini-stat">
                  <span className="label">Попыток</span>
                  <span className="value">{row.attemptCount}</span>
                </article>
                <article className="mini-stat">
                  <span className="label">Резерв</span>
                  <span className="value">{formatIso(row.reservedAt) ?? "Ещё нет"}</span>
                </article>
                <article className="mini-stat">
                  <span className="label">Обновлено</span>
                  <span className="value">{formatIso(row.updatedAt) ?? row.updatedAt}</span>
                </article>
              </div>

              <p className="muted" style={{ marginTop: "0.75rem" }}>
                Телефон: {row.phoneMasked ?? "нет"}{row.receiverLabel ? ` | Получатель: ${row.receiverLabel}` : ""}
              </p>

              {row.workerRawOutput ? (
                <details>
                  <summary>Технические детали</summary>
                  <pre>{row.workerRawOutput}</pre>
                  {row.payload ? <pre>{JSON.stringify(row.payload, null, 2)}</pre> : null}
                </details>
              ) : null}
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

function formatState(state: string): string {
  switch (state) {
    case "queued":
      return "В очереди";
    case "executing":
      return "Исполняется";
    case "added_to_cart":
      return "Добавлен в корзину";
    case "success":
      return "Куплен";
    case "completed":
      return "Завершён";
    case "retrying":
      return "Повторная попытка";
    case "error":
      return "Ошибка";
    default:
      return state;
  }
}

function resolveStateTone(state: string): "success" | "warning" | "error" {
  switch (state) {
    case "success":
    case "completed":
      return "success";
    case "queued":
    case "executing":
    case "retrying":
      return "warning";
    default:
      return "error";
  }
}
