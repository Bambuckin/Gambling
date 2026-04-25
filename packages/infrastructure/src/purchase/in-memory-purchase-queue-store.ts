import type { PurchaseQueueItem, PurchaseQueuePriority, PurchaseQueueStore, PurchaseQueueTransport } from "@lottery/application";

export class InMemoryPurchaseQueueStore implements PurchaseQueueStore, PurchaseQueueTransport {
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

  async listSnapshot(): Promise<readonly PurchaseQueueItem[]> {
    return this.listQueueItems();
  }

  async getByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    return this.getQueueItemByRequestId(requestId);
  }

  async enqueue(item: PurchaseQueueItem): Promise<void> {
    await this.saveQueueItem(item);
  }

  async reserve(requestId: string): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing || existing.status !== "queued") {
      return null;
    }

    const next: PurchaseQueueItem = {
      ...existing,
      attemptCount: existing.attemptCount + 1,
      status: "executing"
    };
    await this.saveQueueItem(next);
    return next;
  }

  async requeue(requestId: string): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing) {
      return null;
    }

    const next: PurchaseQueueItem = existing.status === "queued" ? existing : { ...existing, status: "queued" };
    await this.saveQueueItem(next);
    return next;
  }

  async reprioritize(requestId: string, priority: PurchaseQueuePriority): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing) {
      return null;
    }

    const next: PurchaseQueueItem = existing.priority === priority ? existing : { ...existing, priority };
    await this.saveQueueItem(next);
    return next;
  }

  async complete(requestId: string): Promise<void> {
    await this.removeQueueItem(requestId);
  }

  async saveQueueItem(item: PurchaseQueueItem): Promise<void> {
    const filtered = this.items.filter((entry) => entry.requestId !== item.requestId);
    this.items = [...filtered, cloneItem(item)];
  }

  async removeQueueItem(requestId: string): Promise<void> {
    const normalized = requestId.trim();
    this.items = this.items.filter((entry) => entry.requestId !== normalized);
  }

  async clearAll(): Promise<void> {
    this.items = [];
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
