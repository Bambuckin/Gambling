export type PurchaseQueuePriority = "regular" | "admin-priority";

export interface PurchaseQueueItem {
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly userId: string;
  readonly drawId: string;
  readonly attemptCount: number;
  readonly priority: PurchaseQueuePriority;
  readonly enqueuedAt: string;
  readonly status: "queued" | "executing";
}

export interface PurchaseQueueStore {
  listQueueItems(): Promise<readonly PurchaseQueueItem[]>;
  getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null>;
  saveQueueItem(item: PurchaseQueueItem): Promise<void>;
  removeQueueItem(requestId: string): Promise<void>;
}
