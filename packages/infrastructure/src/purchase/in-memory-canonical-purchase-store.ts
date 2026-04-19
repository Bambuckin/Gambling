import type { CanonicalPurchaseRecord } from "@lottery/domain";
import type { CanonicalPurchaseStore } from "@lottery/application";

export class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private records: CanonicalPurchaseRecord[];

  constructor(initialRecords: readonly CanonicalPurchaseRecord[] = []) {
    this.records = initialRecords.map(cloneRecord);
  }

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.records.map(cloneRecord).sort((left, right) => compareRecords(left, right));
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const normalized = purchaseId.trim();
    const record = this.records.find((entry) => entry.snapshot.purchaseId === normalized) ?? null;
    return record ? cloneRecord(record) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const normalized = legacyRequestId.trim();
    const record = this.records.find((entry) => entry.snapshot.legacyRequestId === normalized) ?? null;
    return record ? cloneRecord(record) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.purchaseId !== record.snapshot.purchaseId);
    this.records = [...filtered, cloneRecord(record)];
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

function compareRecords(left: CanonicalPurchaseRecord, right: CanonicalPurchaseRecord): number {
  const bySubmittedAt = left.snapshot.submittedAt.localeCompare(right.snapshot.submittedAt);
  if (bySubmittedAt !== 0) {
    return bySubmittedAt;
  }

  return left.snapshot.purchaseId.localeCompare(right.snapshot.purchaseId);
}

function cloneRecord(record: CanonicalPurchaseRecord): CanonicalPurchaseRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    status: record.status,
    resultStatus: record.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}
