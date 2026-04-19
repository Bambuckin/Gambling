"use client";

import { useEffect, useState, type ReactElement } from "react";

interface LotteryNotificationRow {
  readonly notificationId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly read: boolean;
  readonly createdAt: string;
  readonly referenceTicketId: string | null;
  readonly referenceDrawId: string | null;
}

interface LotteryNotificationMonitorProps {
  readonly lotteryCode: string;
  readonly initialNotifications: readonly LotteryNotificationRow[];
}

interface LotteryNotificationResponse {
  readonly notifications: readonly LotteryNotificationRow[];
  readonly fetchedAt: string;
}

const REFRESH_INTERVAL_MS = 2_500;

export function LotteryNotificationMonitor(props: LotteryNotificationMonitorProps): ReactElement {
  const [notifications, setNotifications] = useState<readonly LotteryNotificationRow[]>(props.initialNotifications);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/lottery/${props.lotteryCode}/notifications`, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`status=${response.status}`);
        }

        const payload = (await response.json()) as LotteryNotificationResponse;
        if (cancelled) {
          return;
        }

        setNotifications(payload.notifications);
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

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <article className="panel">
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
          <h2>Оповещения по тиражу</h2>
          <p className="muted">После покупки и после закрытия тиража сюда прилетает живой статус билета.</p>
        </div>
        <span className={`badge ${unreadCount > 0 ? "warning" : "success"}`}>
          {unreadCount > 0 ? `${unreadCount} новых` : "Без новых"}
        </span>
      </div>

      <p className={`alert-row ${error ? "warn" : "ok"}`}>
        {error ? `Поток уведомлений временно недоступен: ${error}` : `Синхронизировано: ${formatIso(fetchedAt) ?? "только что"}`}
      </p>

      {notifications.length === 0 ? (
        <p className="muted">Оповещений по этой лотерее пока нет.</p>
      ) : (
        <div className="page-column">
          {notifications.map((notification) => (
            <section
              key={notification.notificationId}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.35)",
                borderRadius: "12px",
                padding: "0.85rem 1rem"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap"
                }}
              >
                <strong>{notification.title}</strong>
                <span className={`badge ${notification.read ? "success" : "warning"}`}>
                  {formatNotificationType(notification.type)}
                </span>
              </div>
              <p style={{ margin: "0.5rem 0 0.35rem" }}>{notification.body}</p>
              <p className="muted" style={{ margin: 0 }}>
                {formatIso(notification.createdAt) ?? notification.createdAt}
                {notification.referenceDrawId ? ` | Тираж: ${notification.referenceDrawId}` : ""}
                {notification.referenceTicketId ? ` | Билет: ${notification.referenceTicketId}` : ""}
              </p>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

function formatNotificationType(type: string): string {
  switch (type) {
    case "purchase_success":
      return "Покупка";
    case "draw_closed_result_ready":
      return "Результат";
    case "winning_actions_available":
      return "Выигрыш";
    default:
      return type;
  }
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
