import { describe, expect, it } from "vitest";
import {
  collectNewPushNotifications,
  resolveInitialPushNotification,
  shouldShowPushNotification,
  type LotteryNotificationRow
} from "../lottery-notification-monitor";

describe("lottery notification push helpers", () => {
  it("shows unread result notifications that already exist on first render", () => {
    const initial = [
      notification({ notificationId: "purchase-1", type: "purchase_success", read: false }),
      notification({
        notificationId: "result-1",
        type: "draw_closed_result_ready",
        read: false,
        createdAt: "2026-04-24T10:00:00.000Z"
      })
    ];

    expect(resolveInitialPushNotification(initial)?.notificationId).toBe("result-1");
  });

  it("collects only unseen result and winning notifications during polling", () => {
    const seen = new Set(["old-result"]);
    const rows = [
      notification({ notificationId: "old-result", type: "draw_closed_result_ready" }),
      notification({ notificationId: "new-result", type: "draw_closed_result_ready" }),
      notification({ notificationId: "new-purchase", type: "purchase_success" }),
      notification({ notificationId: "new-winning", type: "winning_actions_available" })
    ];

    expect(collectNewPushNotifications(rows, seen).map((row) => row.notificationId)).toEqual([
      "new-result",
      "new-winning"
    ]);
    expect(seen.has("new-purchase")).toBe(true);
  });

  it("keeps purchase notifications out of push surface", () => {
    expect(shouldShowPushNotification(notification({ type: "purchase_success" }))).toBe(false);
    expect(shouldShowPushNotification(notification({ type: "draw_closed_result_ready" }))).toBe(true);
    expect(shouldShowPushNotification(notification({ type: "winning_actions_available" }))).toBe(true);
  });
});

function notification(input: Partial<LotteryNotificationRow>): LotteryNotificationRow {
  return {
    notificationId: input.notificationId ?? "notification-1",
    type: input.type ?? "draw_closed_result_ready",
    title: input.title ?? "result",
    body: input.body ?? "body",
    read: input.read ?? false,
    createdAt: input.createdAt ?? "2026-04-24T09:00:00.000Z"
  };
}
