import {
  AdminOperationsQueryService,
  AdminQueueService,
  PurchaseOrchestrationService,
  PurchaseRequestQueryService,
  PurchaseRequestService,
  SystemTimeSource
} from "@lottery/application";
import { InMemoryPurchaseQueueStore, InMemoryPurchaseRequestStore, InMemoryTicketStore } from "@lottery/infrastructure";
import { getWalletLedgerService } from "../ledger/ledger-runtime";

const requestStore = new InMemoryPurchaseRequestStore();
const queueStore = new InMemoryPurchaseQueueStore();
const ticketStore = new InMemoryTicketStore();

let cachedRequestService: PurchaseRequestService | null = null;
let cachedOrchestrationService: PurchaseOrchestrationService | null = null;
let cachedQueryService: PurchaseRequestQueryService | null = null;
let cachedAdminQueueService: AdminQueueService | null = null;
let cachedAdminOperationsQueryService: AdminOperationsQueryService | null = null;

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

export function getAdminQueueService(): AdminQueueService {
  if (!cachedAdminQueueService) {
    cachedAdminQueueService = new AdminQueueService({
      requestStore,
      queueStore,
      purchaseOrchestrationService: getPurchaseOrchestrationService()
    });
  }

  return cachedAdminQueueService;
}

export function getAdminOperationsQueryService(): AdminOperationsQueryService {
  if (!cachedAdminOperationsQueryService) {
    cachedAdminOperationsQueryService = new AdminOperationsQueryService({
      requestStore,
      queueStore,
      timeSource: new SystemTimeSource()
    });
  }

  return cachedAdminOperationsQueryService;
}

export function getPurchaseRuntimeStores(): {
  readonly requestStore: InMemoryPurchaseRequestStore;
  readonly queueStore: InMemoryPurchaseQueueStore;
  readonly ticketStore: InMemoryTicketStore;
} {
  return {
    requestStore,
    queueStore,
    ticketStore
  };
}
