import {
  PurchaseOrchestrationService,
  PurchaseRequestQueryService,
  PurchaseRequestService,
  SystemTimeSource
} from "@lottery/application";
import { InMemoryPurchaseQueueStore, InMemoryPurchaseRequestStore } from "@lottery/infrastructure";
import { getWalletLedgerService } from "../ledger/ledger-runtime";

const requestStore = new InMemoryPurchaseRequestStore();
const queueStore = new InMemoryPurchaseQueueStore();

let cachedRequestService: PurchaseRequestService | null = null;
let cachedOrchestrationService: PurchaseOrchestrationService | null = null;
let cachedQueryService: PurchaseRequestQueryService | null = null;

export function getPurchaseRequestService(): PurchaseRequestService {
  if (!cachedRequestService) {
    cachedRequestService = new PurchaseRequestService({
      requestStore,
      timeSource: new SystemTimeSource()
    });
  }

  return cachedRequestService;
}

export function getPurchaseOrchestrationService(): PurchaseOrchestrationService {
  if (!cachedOrchestrationService) {
    cachedOrchestrationService = new PurchaseOrchestrationService({
      requestStore,
      queueStore,
      walletLedgerService: getWalletLedgerService(),
      timeSource: new SystemTimeSource()
    });
  }

  return cachedOrchestrationService;
}

export function getPurchaseRequestQueryService(): PurchaseRequestQueryService {
  if (!cachedQueryService) {
    cachedQueryService = new PurchaseRequestQueryService({
      requestStore,
      queueStore
    });
  }

  return cachedQueryService;
}
