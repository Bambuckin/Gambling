export type TerminalExecutionPriority = "regular" | "admin-priority";

export interface TerminalExecutionQueueItem {
  readonly requestId: string;
  readonly priority: TerminalExecutionPriority;
  readonly enqueuedAt: string;
}

export function rankQueueForExecution<TItem extends TerminalExecutionQueueItem>(
  items: readonly TItem[]
): TItem[] {
  return [...items].sort((left, right) => compareQueueItems(left, right));
}

function compareQueueItems(left: TerminalExecutionQueueItem, right: TerminalExecutionQueueItem): number {
  const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
  if (byPriority !== 0) {
    return byPriority;
  }

  const byEnqueuedAt = left.enqueuedAt.localeCompare(right.enqueuedAt);
  if (byEnqueuedAt !== 0) {
    return byEnqueuedAt;
  }

  return left.requestId.localeCompare(right.requestId);
}

function priorityRank(priority: TerminalExecutionPriority): number {
  return priority === "admin-priority" ? 0 : 1;
}
