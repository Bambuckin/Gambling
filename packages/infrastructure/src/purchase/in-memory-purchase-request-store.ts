import type { PurchaseRequestRecord } from "@lottery/domain";
import type { PurchaseRequestStore } from "@lottery/application";

export class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  private records: PurchaseRequestRecord[];

  constructor(initialRecords: readonly PurchaseRequestRecord[] = []) {
    this.records = initialRecords.map(cloneRecord);
  }

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return this.records
      .map(cloneRecord)
      .sort((left, right) => compareRecordsByCreatedAt(left, right));
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    const normalized = requestId.trim();
    const record = this.records.find((entry) => entry.snapshot.requestId === normalized) ?? null;
    return record ? cloneRecord(record) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId);
    this.records = [...filtered, cloneRecord(record)];
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

function compareRecordsByCreatedAt(left: PurchaseRequestRecord, right: PurchaseRequestRecord): number {
  const createdAtDiff = left.snapshot.createdAt.localeCompare(right.snapshot.createdAt);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.snapshot.requestId.localeCompare(right.snapshot.requestId);
}

function cloneRecord(record: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}
