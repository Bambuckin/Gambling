import { markNotificationRead, type NotificationRecord } from "@lottery/domain";
import type { NotificationStore } from "../ports/notification-store.js";

export interface NotificationServiceDependencies {
  readonly notificationStore: NotificationStore;
}

export interface NotificationView {
  readonly notificationId: string;
  readonly userId: string;
  readonly type: NotificationRecord["type"];
  readonly title: string;
  readonly body: string;
  readonly read: boolean;
  readonly createdAt: string;
  readonly referenceTicketId: string | null;
  readonly referenceDrawId: string | null;
  readonly referenceLotteryCode: string | null;
}

export interface NotificationBadge {
  readonly unreadCount: number;
  readonly hasWinningActions: boolean;
}

export class NotificationService {
  private readonly notificationStore: NotificationStore;

  constructor(dependencies: NotificationServiceDependencies) {
    this.notificationStore = dependencies.notificationStore;
  }

  async listUserNotifications(userId: string): Promise<NotificationView[]> {
    const notifications = await this.notificationStore.listUserNotifications(userId);
    return notifications.map(toNotificationView).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getNotificationBadge(userId: string): Promise<NotificationBadge> {
    const notifications = await this.notificationStore.listUserNotifications(userId);
    const unread = notifications.filter((n) => !n.read);
    const hasWinningActions = unread.some((n) => n.type === "winning_actions_available");

    return {
      unreadCount: unread.length,
      hasWinningActions
    };
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notification = await this.notificationStore.getNotificationById(notificationId);
    if (!notification) {
      return;
    }

    const updated = markNotificationRead(notification);
    if (updated.read !== notification.read) {
      await this.notificationStore.markNotificationRead(notificationId);
    }
  }

  async markAllUserNotificationsRead(userId: string): Promise<number> {
    const notifications = await this.notificationStore.listUserNotifications(userId);
    let marked = 0;

    for (const notification of notifications) {
      if (!notification.read) {
        await this.notificationStore.markNotificationRead(notification.notificationId);
        marked += 1;
      }
    }

    return marked;
  }
}

function toNotificationView(notification: NotificationRecord): NotificationView {
  return {
    notificationId: notification.notificationId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    createdAt: notification.createdAt,
    referenceTicketId: notification.referenceTicketId,
    referenceDrawId: notification.referenceDrawId,
    referenceLotteryCode: notification.referenceLotteryCode
  };
}
