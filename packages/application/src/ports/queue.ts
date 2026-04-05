export interface QueueTask<TPayload> {
  readonly taskId: string;
  readonly queueName: string;
  readonly payload: TPayload;
  readonly createdAt: string;
  readonly priority: "regular" | "admin-priority";
}

export interface QueuePort<TPayload = unknown> {
  enqueue(task: QueueTask<TPayload>): Promise<void>;
  reserveNext(queueName: string): Promise<QueueTask<TPayload> | null>;
  markDone(taskId: string): Promise<void>;
  markFailed(taskId: string, reason: string): Promise<void>;
}
