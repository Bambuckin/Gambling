import {
  AdminManualFinanceService,
  AdminOperationsQueryService,
  AdminQueueService,
  AdminTestResetService,
  CashDeskService,
  DrawClosureService,
  NotificationService,
  PurchaseOrchestrationService,
  type PurchaseQueueStore,
  type PurchaseRequestStore,
  PurchaseRequestQueryService,
  PurchaseRequestService,
  SystemTimeSource,
  TicketClaimService,
  type TicketStore,
  WinningsCreditService
} from "@lottery/application";
import {
  InMemoryCashDeskRequestStore,
  InMemoryDrawClosureStore,
  InMemoryNotificationStore,
  InMemoryPurchaseQueueStore,
  InMemoryPurchaseRequestStore,
  InMemoryTerminalExecutionLock,
  InMemoryTicketStore,
  InMemoryWinningsCreditJobStore,
  PostgresCashDeskRequestStore,
  PostgresDrawClosureStore,
  PostgresNotificationStore,
  PostgresPurchaseQueueStore,
  PostgresPurchaseRequestStore,
  PostgresTerminalExecutionLock,
  PostgresTicketStore,
  PostgresWinningsCreditJobStore
} from "@lottery/infrastructure";
import { getLedgerStoreInstance, getWalletLedgerService } from "../ledger/ledger-runtime";
import { getSessionStoreInstance } from "../access/access-runtime";
import { getDrawStoreInstance } from "../draw/draw-runtime";
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
const notificationStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresNotificationStore(postgresPool)
    : new InMemoryNotificationStore();
const drawClosureStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresDrawClosureStore(postgresPool)
    : new InMemoryDrawClosureStore();
const executionLock =
  storageBackend === "postgres" && postgresPool
    ? new PostgresTerminalExecutionLock(postgresPool, {
        ttlSeconds: Number(process.env.LOTTERY_TERMINAL_LOCK_TTL_SECONDS ?? 30)
      })
    : new InMemoryTerminalExecutionLock();
const cashDeskRequestStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresCashDeskRequestStore(postgresPool)
    : new InMemoryCashDeskRequestStore();
const winningsCreditJobStore = storageBackend === "postgres" && postgresPool
  ? new PostgresWinningsCreditJobStore(postgresPool)
  : new InMemoryWinningsCreditJobStore();

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

let cachedDrawClosureService: DrawClosureService | null = null;
let cachedNotificationService: NotificationService | null = null;

export function getDrawClosureService(): DrawClosureService {
  if (!cachedDrawClosureService) {
    cachedDrawClosureService = new DrawClosureService({
      ticketStore,
      drawClosureStore,
      notificationStore,
      timeSource: new SystemTimeSource()
    });
  }

  return cachedDrawClosureService;
}

export function getNotificationService(): NotificationService {
  if (!cachedNotificationService) {
    cachedNotificationService = new NotificationService({
      notificationStore
    });
  }

  return cachedNotificationService;
}

let cachedTicketClaimService: TicketClaimService | null = null;
let cachedCashDeskService: CashDeskService | null = null;
let cachedWinningsCreditService: WinningsCreditService | null = null;

export function getTicketClaimService(): TicketClaimService {
  if (!cachedTicketClaimService) {
    cachedTicketClaimService = new TicketClaimService({ ticketStore });
  }
  return cachedTicketClaimService;
}

export function getCashDeskService(): CashDeskService {
  if (!cachedCashDeskService) {
    cachedCashDeskService = new CashDeskService({
      cashDeskRequestStore,
      ticketClaimService: getTicketClaimService()
    });
  }
  return cachedCashDeskService;
}

export function getWinningsCreditService(): WinningsCreditService {
  if (!cachedWinningsCreditService) {
    cachedWinningsCreditService = new WinningsCreditService({
      winningsCreditJobStore,
      ticketStore,
      ticketClaimService: getTicketClaimService(),
      walletLedgerService: getWalletLedgerService(),
      timeSource: new SystemTimeSource()
    });
  }
  return cachedWinningsCreditService;
}

let cachedAdminManualFinanceService: AdminManualFinanceService | null = null;

export function getAdminManualFinanceService(): AdminManualFinanceService {
  if (!cachedAdminManualFinanceService) {
    cachedAdminManualFinanceService = new AdminManualFinanceService({
      ledgerStore: getLedgerStoreInstance(),
      timeSource: new SystemTimeSource()
    });
  }
  return cachedAdminManualFinanceService;
}

let cachedAdminTestResetService: AdminTestResetService | null = null;

export function getAdminTestResetService(): AdminTestResetService {
  if (!cachedAdminTestResetService) {
    cachedAdminTestResetService = new AdminTestResetService({
      drawStore: getDrawStoreInstance(),
      requestStore,
      queueStore,
      ticketStore,
      ledgerStore: getLedgerStoreInstance(),
      notificationStore,
      drawClosureStore,
      cashDeskRequestStore,
      winningsCreditJobStore,
      sessionStore: getSessionStoreInstance(),
      executionLock,
      walletLedgerService: getWalletLedgerService(),
      timeSource: new SystemTimeSource()
    });
  }
  return cachedAdminTestResetService;
}
