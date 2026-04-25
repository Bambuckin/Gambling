import {
  type CanonicalPurchaseStore,
  DrawRefreshService,
  PurchaseExecutionQueueService,
  type PurchaseAttemptStore,
  type PurchaseQueueTransport,
  type PurchaseQueueStore,
  type PurchaseRequestStore,
  SystemTimeSource,
  type TerminalExecutionLock,
  TerminalExecutionAttemptService,
  TerminalRetryService,
  TicketClaimService,
  type TicketStore,
  TicketPersistenceService,
  type WinningsCreditJobStore,
  WinningsCreditService,
  WalletLedgerService,
  type TerminalExecutionResult
} from "@lottery/application";
import {
  InMemoryCanonicalPurchaseStore,
  InMemoryDrawStore,
  InMemoryLedgerStore,
  InMemoryNotificationStore,
  InMemoryPurchaseAttemptStore,
  InMemoryPurchaseQueueStore,
  InMemoryPurchaseRequestStore,
  InMemoryTerminalExecutionLock,
  InMemoryTicketStore,
  InMemoryWinningsCreditJobStore,
  PostgresDrawStore,
  PostgresLedgerStore,
  PostgresNotificationStore,
  PostgresCanonicalPurchaseStore,
  PostgresPurchaseAttemptStore,
  PostgresPurchaseQueueStore,
  PostgresPurchaseRequestStore,
  PostgresTerminalExecutionLock,
  PostgresTicketStore,
  PostgresWinningsCreditJobStore
} from "@lottery/infrastructure";
import { Big8LiveDrawProvider } from "./lib/big8-live-draw-provider.js";
import { loadWorkerEnvFromFile } from "./lib/runtime/load-worker-env.js";
import { TerminalHandlerRuntime } from "./lib/terminal-handler-runtime.js";
import { getWorkerPostgresPool, getWorkerStorageBackend } from "./lib/runtime/postgres-runtime.js";

type WorkerBootState = "booting" | "ready";

const workerEnvPath = loadWorkerEnvFromFile();
const WORKER_ID = "terminal-worker";
const rawPollIntervalMs = Number(process.env.LOTTERY_TERMINAL_POLL_INTERVAL_MS ?? 3000);
const POLL_INTERVAL_MS = Number.isFinite(rawPollIntervalMs) && rawPollIntervalMs >= 250 ? rawPollIntervalMs : 3000;
const rawDrawSyncIntervalMs = Number(process.env.LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS ?? 5000);
const DRAW_SYNC_INTERVAL_MS =
  Number.isFinite(rawDrawSyncIntervalMs) && rawDrawSyncIntervalMs >= 1000 ? rawDrawSyncIntervalMs : 5000;
const bootTimestamp = new Date().toISOString();
const timeSource = new SystemTimeSource();
const big8TerminalMode = (process.env.LOTTERY_BIG8_TERMINAL_MODE ?? "mock").trim().toLowerCase();
const drawSyncRequested = (process.env.LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED ?? "true").trim().toLowerCase() !== "false";
const drawSyncEnabled = drawSyncRequested;
const storageBackend = getWorkerStorageBackend();
const postgresPool = storageBackend === "postgres" ? getWorkerPostgresPool() : null;
const drawStore =
  storageBackend === "postgres" && postgresPool ? new PostgresDrawStore(postgresPool) : new InMemoryDrawStore();
const requestStore: PurchaseRequestStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresPurchaseRequestStore(postgresPool)
    : new InMemoryPurchaseRequestStore();
const canonicalPurchaseStore: CanonicalPurchaseStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresCanonicalPurchaseStore(postgresPool)
    : new InMemoryCanonicalPurchaseStore();
const queueStore: PurchaseQueueStore & PurchaseQueueTransport =
  storageBackend === "postgres" && postgresPool
    ? new PostgresPurchaseQueueStore(postgresPool)
    : new InMemoryPurchaseQueueStore();
const purchaseAttemptStore: PurchaseAttemptStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresPurchaseAttemptStore(postgresPool)
    : new InMemoryPurchaseAttemptStore();
const executionLock: TerminalExecutionLock =
  storageBackend === "postgres" && postgresPool
    ? new PostgresTerminalExecutionLock(postgresPool, {
        ttlSeconds: Number(process.env.LOTTERY_TERMINAL_LOCK_TTL_SECONDS ?? 30)
      })
    : new InMemoryTerminalExecutionLock();
const ledgerStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresLedgerStore(postgresPool)
    : new InMemoryLedgerStore();
const ticketStore: TicketStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresTicketStore(postgresPool)
    : new InMemoryTicketStore();
const notificationStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresNotificationStore(postgresPool)
    : new InMemoryNotificationStore();
const winningsCreditJobStore: WinningsCreditJobStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresWinningsCreditJobStore(postgresPool)
    : new InMemoryWinningsCreditJobStore();
const walletLedgerService = new WalletLedgerService({
  ledgerStore,
  timeSource
});
const drawRefreshService = new DrawRefreshService({
  drawStore,
  timeSource
});
const ticketPersistenceService = new TicketPersistenceService({
  ticketStore,
  notificationStore,
  persistLegacyTicket: false
});
const big8LiveDrawProvider = new Big8LiveDrawProvider({
  ...(process.env.LOTTERY_TERMINAL_BROWSER_URL
    ? { browserUrl: process.env.LOTTERY_TERMINAL_BROWSER_URL }
    : {}),
  ...(process.env.LOTTERY_TERMINAL_PAGE_URL ? { pageUrl: process.env.LOTTERY_TERMINAL_PAGE_URL } : {}),
  modalWaitMs: Number(process.env.LOTTERY_BIG8_DRAW_MODAL_WAIT_MS ?? 2500),
  freshnessTtlSeconds: Number(process.env.LOTTERY_BIG8_DRAW_TTL_SECONDS ?? 45)
});

const queueService = new PurchaseExecutionQueueService({
  requestStore,
  queueStore,
  canonicalPurchaseStore,
  executionLock,
  timeSource
});
const attemptService = new TerminalExecutionAttemptService({
  requestStore,
  queueStore,
  canonicalPurchaseStore,
  purchaseAttemptStore,
  ticketPersistenceService,
  walletLedgerService
});
const retryService = new TerminalRetryService({
  maxAttempts: 3
});
const ticketClaimService = new TicketClaimService({ ticketStore });
const winningsCreditService = new WinningsCreditService({
  winningsCreditJobStore,
  ticketStore,
  ticketClaimService,
  walletLedgerService,
  timeSource
});
const handlerRuntime = new TerminalHandlerRuntime();

let state: WorkerBootState = "booting";
let isPolling = false;
let isRefreshingDraws = false;

function logBootMessage(): void {
  console.log(`[terminal-worker] ${bootTimestamp} - queue reservation host started`);
  console.log(`[terminal-worker] storage backend=${storageBackend}${workerEnvPath ? ` env=${workerEnvPath}` : ""}`);
  console.log("[terminal-worker] handler resolution, attempt journaling, and retry policy are enabled");
  console.log(
    `[terminal-worker] big8 live draw sync=${drawSyncEnabled ? "enabled" : "disabled"} interval=${DRAW_SYNC_INTERVAL_MS}ms`
  );
  console.log(`[terminal-worker] big8 terminal mode=${big8TerminalMode}`);
}

async function pollQueueForExecution(): Promise<void> {
  if (isPolling) {
    return;
  }
  isPolling = true;

  try {
    const reservation = await queueService.reserveNextQueuedRequest({
      workerId: WORKER_ID
    });
    if (!reservation) {
      await processCreditQueue();
      return;
    }

    console.log(
      `[terminal-worker] reserved request=${reservation.request.snapshot.requestId} attempt=${reservation.queueItem.attemptCount}`
    );

    const resolvedHandler = await handlerRuntime.resolvePurchaseHandler(reservation.request.snapshot.lotteryCode);
    console.log(
      `[terminal-worker] resolved handler lottery=${resolvedHandler.binding.lotteryCode} binding=${resolvedHandler.binding.bindingKey}`
    );

    const startedAt = timeSource.nowIso();
    const terminalResult = await executeTerminalAttempt(
      reservation.request.snapshot.requestId,
      reservation.queueItem.attemptCount,
      startedAt,
      async () =>
        resolvedHandler.handler.purchase({
          requestId: reservation.request.snapshot.requestId,
          lotteryCode: reservation.request.snapshot.lotteryCode,
          draw: {
            lotteryCode: reservation.request.snapshot.lotteryCode,
            drawId: reservation.request.snapshot.drawId,
            drawAt: startedAt,
            fetchedAt: startedAt,
            freshnessTtlSeconds: 300
          },
          ticketPayload: reservation.request.snapshot.payload,
          attempt: reservation.queueItem.attemptCount
        })
    );
    const retryAwareResult: TerminalExecutionResult = {
      ...terminalResult,
      nextState: retryService.resolveNextState({
        attempt: reservation.queueItem.attemptCount,
        candidateState: terminalResult.nextState,
        rawOutput: terminalResult.rawOutput
      })
    };

    const attemptRecord = await attemptService.recordAttemptResult({
      requestId: reservation.request.snapshot.requestId,
      attempt: reservation.queueItem.attemptCount,
      startedAt,
      result: retryAwareResult
    });

    console.log(
      `[terminal-worker] attempt recorded request=${attemptRecord.request.snapshot.requestId} outcome=${attemptRecord.request.state}${attemptRecord.ticket ? ` ticket=${attemptRecord.ticket.ticketId}` : ""}`
    );

    await processCreditQueue();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[terminal-worker] reservation error: ${message}`);
  } finally {
    await queueService.releaseExecutionLock({
      workerId: WORKER_ID
    });
    isPolling = false;
  }
}

async function processCreditQueue(): Promise<void> {
  try {
    const result = await winningsCreditService.processNextCreditJob();
    if (result) {
      console.log(
        `[terminal-worker] credit job processed ticket=${result.job.ticketId} credited=${result.credited}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[terminal-worker] credit job processing failed: ${message}`);
  }
}

async function refreshBig8LiveDraws(): Promise<void> {
  if (!drawSyncEnabled || isRefreshingDraws || isPolling) {
    return;
  }

  isRefreshingDraws = true;
  try {
    const state =
      big8TerminalMode === "mock" ? await refreshBig8MockDraws() : await drawRefreshService.refreshLottery("bolshaya-8", big8LiveDrawProvider);
    const drawCount = state.snapshot?.availableDraws?.length ?? 0;
    console.log(
      `[terminal-worker] big8 draw sync status=${state.status} current=${state.snapshot?.drawId ?? "none"} draws=${drawCount}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[terminal-worker] big8 draw sync failed: ${message}`);
  } finally {
    isRefreshingDraws = false;
  }
}

async function refreshBig8MockDraws() {
  const existingSnapshot = await drawStore.getSnapshot("bolshaya-8");
  if (!existingSnapshot) {
    return drawRefreshService.getDrawState("bolshaya-8");
  }

  await drawRefreshService.upsertSnapshot({
    lotteryCode: "bolshaya-8",
    drawId: existingSnapshot.drawId,
    drawAt: existingSnapshot.drawAt,
    fetchedAt: timeSource.nowIso(),
    freshnessTtlSeconds: existingSnapshot.freshnessTtlSeconds,
    ...(existingSnapshot.availableDraws ? { availableDraws: existingSnapshot.availableDraws } : {})
  });
  return drawRefreshService.getDrawState("bolshaya-8");
}

function startWorker(): void {
  logBootMessage();
  state = "ready";
  console.log(`[terminal-worker] state=${state}`);

  void refreshBig8LiveDraws();
  void pollQueueForExecution();
  setInterval(() => {
    void refreshBig8LiveDraws();
  }, DRAW_SYNC_INTERVAL_MS);
  setInterval(() => {
    void pollQueueForExecution();
  }, POLL_INTERVAL_MS);
}

startWorker();

async function executeTerminalAttempt(
  requestId: string,
  attempt: number,
  startedAt: string,
  run: () => Promise<{
    rawTerminalOutput: string;
    externalTicketReference?: string | null;
    executionOutcome?: "ticket_purchased" | "added_to_cart";
  }>
): Promise<TerminalExecutionResult> {
  try {
    const purchaseResult = await run();
    return {
      requestId,
      nextState: resolveTerminalOutcome(purchaseResult),
      rawOutput: purchaseResult.rawTerminalOutput,
      externalTicketReference: purchaseResult.externalTicketReference ?? null,
      finishedAt: timeSource.nowIso()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      requestId,
      nextState: "error",
      rawOutput: `[terminal-worker-error] attempt=${attempt} startedAt=${startedAt} message=${message}`,
      externalTicketReference: null,
      finishedAt: timeSource.nowIso()
    };
  }
}

function resolveTerminalOutcome(input: {
  readonly rawTerminalOutput: string;
  readonly executionOutcome?: "ticket_purchased" | "added_to_cart";
}): TerminalExecutionResult["nextState"] {
  if (input.executionOutcome === "added_to_cart") {
    return "added_to_cart";
  }
  if (input.executionOutcome === "ticket_purchased") {
    return "success";
  }

  return classifyTerminalOutcome(input.rawTerminalOutput);
}

function classifyTerminalOutcome(rawOutput: string): TerminalExecutionResult["nextState"] {
  const normalized = rawOutput.toLowerCase();
  if (normalized.includes("added_to_cart") || normalized.includes("add-to-cart")) {
    return "added_to_cart";
  }
  if (normalized.includes("retry")) {
    return "retrying";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "error";
  }
  return "success";
}
