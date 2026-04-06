import {
  AdminOperationsQueryService,
  AdminQueueService,
  PurchaseOrchestrationService,
  type PurchaseQueueStore,
  type PurchaseRequestStore,
  PurchaseRequestQueryService,
  PurchaseRequestService,
  SystemTimeSource,
  type TicketStore
} from "@lottery/application";
import {
  InMemoryPurchaseQueueStore,
  InMemoryPurchaseRequestStore,
  InMemoryTicketStore,
  PostgresPurchaseQueueStore,
  PostgresPurchaseRequestStore,
  PostgresTicketStore
} from "@lottery/infrastructure";
import { getWalletLedgerService } from "../ledger/ledger-runtime";
import { getWebPostgresPool, getWebStorageBackend } from "../runtime/postgres-runtime";

const storageBackend = getWebStorageBackend();
const postgresPool = storageBackend === "postgres" ? getWebPostgresPool() : null;

const requestStore: PurchaseRequestStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresPurchaseRequestStore(postgresPool)
    : new InMemoryPurchaseRequestStore();
const queueStore: PurchaseQueueStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresPurchaseQueueStore(postgresPool)
    : new InMemoryPurchaseQueueStore();
const ticketStore: TicketStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresTicketStore(postgresPool)
    : new InMemoryTicketStore();

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
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly ticketStore: TicketStore;
} {
  return {
    requestStore,
    queueStore,
    ticketStore
  };
}
