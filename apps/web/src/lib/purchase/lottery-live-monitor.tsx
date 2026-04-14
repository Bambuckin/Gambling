"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

interface LotteryLiveRequestRow {
  readonly requestId: string;
  readonly status: string;
  readonly drawId: string;
  readonly attemptCount: number;
  readonly updatedAt: string;
  readonly finalResult: string | null;
}

interface LotteryLiveMonitorProps {
  readonly lotteryCode: string;
  readonly initialRequests: readonly LotteryLiveRequestRow[];
}

interface LotteryLiveMonitorResponse {
  readonly requests: readonly LotteryLiveRequestRow[];
  readonly fetchedAt: string;
}

const REFRESH_INTERVAL_MS = 2_500;

export function LotteryLiveMonitor(props: LotteryLiveMonitorProps): ReactElement {
  const [requests, setRequests] = useState<readonly LotteryLiveRequestRow[]>(props.initialRequests);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/lottery/${props.lotteryCode}/requests`, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`status=${response.status}`);
        }

        const payload = (await response.json()) as LotteryLiveMonitorResponse;
        if (cancelled) {
          return;
        }

        setRequests(payload.requests);
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
  }, [props.lotteryCode]);

  return (
    <article className="panel">
      <h2>Live статус заявок</h2>
      <p className="muted">Обновление каждые {REFRESH_INTERVAL_MS / 1000} сек без перезагрузки страницы.</p>
      <p className={`alert-row ${error ? "warn" : "ok"}`}>
        {error ? `Live-поток временно недоступен: ${error}` : `Синхронизировано: ${formatIso(fetchedAt) ?? "только что"}`}
      </p>

      {requests.length === 0 ? (
        <p className="muted">Заявок пока нет.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Статус</th>
                <th>Тираж</th>
                <th>Попытки</th>
                <th>Обновлено</th>
                <th>Итог</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.requestId}>
                  <td>{request.requestId}</td>
                  <td>{request.status}</td>
                  <td>{request.drawId}</td>
                  <td>{request.attemptCount}</td>
                  <td>{formatIso(request.updatedAt) ?? request.updatedAt}</td>
                  <td>{request.finalResult ?? "нет"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
