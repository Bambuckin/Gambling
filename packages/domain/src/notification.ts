export const NOTIFICATION_TYPES = ["purchase_success", "draw_closed_result_ready", "winning_actions_available"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRecord {
  readonly notificationId: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly read: boolean;
  readonly createdAt: string;
  readonly referenceTicketId: string | null;
  readonly referenceDrawId: string | null;
  readonly referenceLotteryCode: string | null;
}

export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

export function createNotification(input: {
  readonly notificationId: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly referenceTicketId?: string | null;
  readonly referenceDrawId?: string | null;
  readonly referenceLotteryCode?: string | null;
}): NotificationRecord {
  const notificationId = requireNonEmpty(input.notificationId, "notificationId");
  const userId = requireNonEmpty(input.userId, "userId");
  const title = requireNonEmpty(input.title, "title");
  const body = requireNonEmpty(input.body, "body");
  const createdAt = requireValidIso(input.createdAt, "createdAt");

  return {
    notificationId,
    userId,
    type: input.type,
    title,
    body,
    read: false,
    createdAt,
    referenceTicketId: input.referenceTicketId ?? null,
    referenceDrawId: input.referenceDrawId ?? null,
    referenceLotteryCode: input.referenceLotteryCode ?? null
  };
}

export function markNotificationRead(notification: NotificationRecord): NotificationRecord {
  if (notification.read) {
    return { ...notification };
  }

  return { ...notification, read: true };
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new NotificationValidationError(`${field} is required`);
  }
  return normalized;
}

function requireValidIso(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new NotificationValidationError(`${field} must be a valid ISO date string`);
  }
  return normalized;
}
