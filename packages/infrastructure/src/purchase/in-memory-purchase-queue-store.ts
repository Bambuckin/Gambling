import type { PurchaseQueueItem, PurchaseQueueStore } from "@lottery/application";

export class InMemoryPurchaseQueueStore implements PurchaseQueueStore {
  private items: PurchaseQueueItem[];

  constructor(initialItems: readonly PurchaseQueueItem[] = []) {
    this.items = initialItems.map(cloneItem);
  }

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    return this.items
      .map(cloneItem)
      .sort((left, right) => compareQueueItems(left, right));
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    const normalized = requestId.trim();
    const item = this.items.find((entry) => entry.requestId === normalized) ?? null;
    return item ? cloneItem(item) : null;
  }

  async saveQueueItem(item: PurchaseQueueItem): Promise<void> {
    const filtered = this.items.filter((entry) => entry.requestId !== item.requestId);
    this.items = [...filtered, cloneItem(item)];
  }

  async removeQueueItem(requestId: string): Promise<void> {
    const normalized = requestId.trim();
    this.items = this.items.filter((entry) => entry.requestId !== normalized);
  }
}

function compareQueueItems(left: PurchaseQueueItem, right: PurchaseQueueItem): number {
  const byTimestamp = left.enqueuedAt.localeCompare(right.enqueuedAt);
  if (byTimestamp !== 0) {
    return byTimestamp;
  }

  return left.requestId.localeCompare(right.requestId);
}

function cloneItem(item: PurchaseQueueItem): PurchaseQueueItem {
  return { ...item };
}
