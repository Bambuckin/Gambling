import { describe, expect, it } from "vitest";
import { rankQueueForExecution, type TerminalExecutionQueueItem } from "../terminal-execution.js";

describe("rankQueueForExecution", () => {
  it("places admin-priority items before regular items", () => {
    const ranked = rankQueueForExecution([
      queueItem({
        requestId: "req-regular",
        priority: "regular",
        enqueuedAt: "2026-04-05T22:00:00.000Z"
      }),
      queueItem({
        requestId: "req-priority",
        priority: "admin-priority",
        enqueuedAt: "2026-04-05T22:05:00.000Z"
      })
    ]);

    expect(ranked.map((item) => item.requestId)).toEqual(["req-priority", "req-regular"]);
  });

  it("sorts same-priority items by enqueuedAt then requestId", () => {
    const ranked = rankQueueForExecution([
      queueItem({
        requestId: "req-b",
        priority: "regular",
        enqueuedAt: "2026-04-05T22:10:00.000Z"
      }),
      queueItem({
        requestId: "req-a",
        priority: "regular",
        enqueuedAt: "2026-04-05T22:10:00.000Z"
      }),
      queueItem({
        requestId: "req-oldest",
        priority: "regular",
        enqueuedAt: "2026-04-05T21:59:59.000Z"
      })
    ]);

    expect(ranked.map((item) => item.requestId)).toEqual(["req-oldest", "req-a", "req-b"]);
  });
});

function queueItem(input: TerminalExecutionQueueItem): TerminalExecutionQueueItem {
  return {
    ...input
  };
}
