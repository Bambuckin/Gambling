import type { NotificationRecord } from "@lottery/domain";
import type { NotificationStore } from "@lottery/application";

export class InMemoryNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[] = [];

  async saveNotification(notification: NotificationRecord): Promise<void> {
    const filtered = this.notifications.filter((n) => n.notificationId !== notification.notificationId);
    this.notifications = [...filtered, { ...notification }];
  }

  async listUserNotifications(userId: string): Promise<readonly NotificationRecord[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    return this.notifications.find((n) => n.notificationId === notificationId) ?? null;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    this.notifications = this.notifications.map((n) =>
      n.notificationId === notificationId ? { ...n, read: true } : n
    );
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
  }
}
