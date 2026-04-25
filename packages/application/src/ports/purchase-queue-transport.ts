import type { PurchaseQueueItem, PurchaseQueuePriority } from "./purchase-queue-store.js";

export interface PurchaseQueueTransport {
  listSnapshot(): Promise<readonly PurchaseQueueItem[]>;
  getByRequestId(requestId: string): Promise<PurchaseQueueItem | null>;
  enqueue(item: PurchaseQueueItem): Promise<void>;
  reserve(requestId: string): Promise<PurchaseQueueItem | null>;
  requeue(requestId: string): Promise<PurchaseQueueItem | null>;
  reprioritize(requestId: string, priority: PurchaseQueuePriority): Promise<PurchaseQueueItem | null>;
  complete(requestId: string): Promise<void>;
  clearAll(): Promise<void>;
}
