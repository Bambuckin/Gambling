import type { PurchaseAttemptRecord } from "@lottery/domain";
import type { PurchaseAttemptStore } from "@lottery/application";

export class InMemoryPurchaseAttemptStore implements PurchaseAttemptStore {
  private records: PurchaseAttemptRecord[];

  constructor(initialRecords: readonly PurchaseAttemptRecord[] = []) {
    this.records = initialRecords.map(cloneRecord);
  }

  async listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]> {
    const normalized = purchaseId.trim();
    return this.records
      .filter((entry) => entry.purchaseId === normalized)
      .map(cloneRecord)
      .sort((left, right) => compareRecords(left, right));
  }

  async listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]> {
    const normalized = legacyRequestId.trim();
    return this.records
      .filter((entry) => entry.legacyRequestId === normalized)
      .map(cloneRecord)
      .sort((left, right) => compareRecords(left, right));
  }

  async getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null> {
    const normalized = attemptId.trim();
    const record = this.records.find((entry) => entry.attemptId === normalized) ?? null;
    return record ? cloneRecord(record) : null;
  }

  async saveAttempt(record: PurchaseAttemptRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.attemptId !== record.attemptId);
    this.records = [...filtered, cloneRecord(record)];
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

function compareRecords(left: PurchaseAttemptRecord, right: PurchaseAttemptRecord): number {
  const byAttemptNumber = left.attemptNumber - right.attemptNumber;
  if (byAttemptNumber !== 0) {
    return byAttemptNumber;
  }

  return left.attemptId.localeCompare(right.attemptId);
}

function cloneRecord(record: PurchaseAttemptRecord): PurchaseAttemptRecord {
  return {
    ...record
  };
}
