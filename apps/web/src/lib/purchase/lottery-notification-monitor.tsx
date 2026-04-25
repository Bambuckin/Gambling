"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

export interface LotteryNotificationRow {
  readonly notificationId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly read: boolean;
  readonly createdAt: string;
}

interface LotteryNotificationMonitorProps {
  readonly lotteryCode: string;
  readonly initialNotifications: readonly LotteryNotificationRow[];
}

interface LotteryNotificationResponse {
  readonly notifications: readonly LotteryNotificationRow[];
}

const REFRESH_INTERVAL_MS = 2_500;

export function LotteryNotificationMonitor(props: LotteryNotificationMonitorProps): ReactElement {
  const [notifications, setNotifications] = useState<readonly LotteryNotificationRow[]>(props.initialNotifications);
  const [error, setError] = useState<string | null>(null);
  const [pushNotification, setPushNotification] = useState<LotteryNotificationRow | null>(() =>
    resolveInitialPushNotification(props.initialNotifications)
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  });
  const seenNotificationIdsRef = useRef(
    new Set(props.initialNotifications.map((notification) => notification.notificationId))
  );

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/lottery/${props.lotteryCode}/notifications`, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error("refresh failed");
        }

        const payload = (await response.json()) as LotteryNotificationResponse;
        if (cancelled) {
          return;
        }

        const newPushNotifications = collectNewPushNotifications(payload.notifications, seenNotificationIdsRef.current);
        announceDesktopNotifications(newPushNotifications);
        if (newPushNotifications[0]) {
          setPushNotification(newPushNotifications[0]);
        }
        setNotifications(payload.notifications);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Оповещения временно не обновляются.");
        }
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

  useEffect(() => {
    if (typeof Notification === "undefined") {
      return;
    }

    setPermission(Notification.permission);
  }, []);

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
        <h2>Оповещения</h2>
        <div className="actions-row">
          {permission === "default" ? (
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                void requestNotificationPermission(setPermission);
              }}
            >
              Включить уведомления
            </button>
          ) : null}
          <span className={`badge ${unreadCount > 0 ? "warning" : "success"}`}>
            {unreadCount > 0 ? `${unreadCount} новых` : "Без новых"}
          </span>
        </div>
      </div>

      {error ? <p className="alert-row warn">{error}</p> : null}

      {permission === "denied" ? (
        <p className="muted">Уведомления заблокированы в настройках браузера.</p>
      ) : null}

      {pushNotification ? (
        <section className="alert-row ok" role="status" aria-live="polite">
          <strong>{pushNotification.title}</strong>
          <span style={{ marginLeft: "0.5rem" }}>{pushNotification.body}</span>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => setPushNotification(null)}
          >
            Скрыть
          </button>
        </section>
      ) : null}

      {notifications.length === 0 ? (
        <p className="muted">Оповещений пока нет.</p>
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
      return "Событие";
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

export function collectNewPushNotifications(
  notifications: readonly LotteryNotificationRow[],
  seenNotificationIds: Set<string>
): LotteryNotificationRow[] {
  const newPushNotifications: LotteryNotificationRow[] = [];

  for (const notification of notifications) {
    const alreadySeen = seenNotificationIds.has(notification.notificationId);
    seenNotificationIds.add(notification.notificationId);

    if (!alreadySeen && shouldShowPushNotification(notification)) {
      newPushNotifications.push(notification);
    }
  }

  return newPushNotifications;
}

export function resolveInitialPushNotification(
  notifications: readonly LotteryNotificationRow[]
): LotteryNotificationRow | null {
  const candidates = notifications
    .filter((notification) => !notification.read && shouldShowPushNotification(notification))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return candidates[0] ?? null;
}

function announceDesktopNotifications(notifications: readonly LotteryNotificationRow[]): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  for (const notification of notifications) {
    if (!shouldShowPushNotification(notification)) {
      continue;
    }

    const desktopNotification = new Notification(notification.title, {
      body: notification.body,
      tag: notification.notificationId
    });
    desktopNotification.onclick = () => {
      window.focus();
      desktopNotification.close();
    };
  }
}

export function shouldShowPushNotification(notification: LotteryNotificationRow): boolean {
  return notification.type === "winning_actions_available" || notification.type === "draw_closed_result_ready";
}

async function requestNotificationPermission(
  setPermission: (nextPermission: NotificationPermission | "unsupported") => void
): Promise<void> {
  if (typeof Notification === "undefined") {
    setPermission("unsupported");
    return;
  }

  const nextPermission = await Notification.requestPermission();
  setPermission(nextPermission);
}
