import type { NotificationRecord } from "@lottery/domain";

export interface NotificationStore {
  saveNotification(notification: NotificationRecord): Promise<void>;
  listUserNotifications(userId: string): Promise<readonly NotificationRecord[]>;
  getNotificationById(notificationId: string): Promise<NotificationRecord | null>;
  markNotificationRead(notificationId: string): Promise<void>;
  clearAll(): Promise<void>;
}
