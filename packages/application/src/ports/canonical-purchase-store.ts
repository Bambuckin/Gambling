import type { CanonicalPurchaseRecord } from "@lottery/domain";

export interface CanonicalPurchaseStore {
  listPurchases(): Promise<readonly CanonicalPurchaseRecord[]>;
  getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null>;
  getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null>;
  savePurchase(record: CanonicalPurchaseRecord): Promise<void>;
  clearAll(): Promise<void>;
}
