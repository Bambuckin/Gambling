import type { PurchaseRequestRecord } from "@lottery/domain";

export interface PurchaseRequestStore {
  listRequests(): Promise<readonly PurchaseRequestRecord[]>;
  getRequestById(requestId: string): Promise<PurchaseRequestRecord | null>;
  saveRequest(record: PurchaseRequestRecord): Promise<void>;
}
