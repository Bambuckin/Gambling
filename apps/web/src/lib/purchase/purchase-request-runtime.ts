import { PurchaseRequestService, SystemTimeSource } from "@lottery/application";
import { InMemoryPurchaseRequestStore } from "@lottery/infrastructure";

let cachedService: PurchaseRequestService | null = null;

export function getPurchaseRequestService(): PurchaseRequestService {
  if (!cachedService) {
    cachedService = new PurchaseRequestService({
      requestStore: new InMemoryPurchaseRequestStore(),
      timeSource: new SystemTimeSource()
    });
  }

  return cachedService;
}
