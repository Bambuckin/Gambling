import type { PurchaseAttemptRecord } from "@lottery/domain";

export interface PurchaseAttemptStore {
  listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]>;
  listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]>;
  getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null>;
  saveAttempt(record: PurchaseAttemptRecord): Promise<void>;
  clearAll(): Promise<void>;
}
