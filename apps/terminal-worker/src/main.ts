import {
  DrawRefreshService,
  PurchaseExecutionQueueService,
  type PurchaseQueueStore,
  type PurchaseRequestStore,
  SystemTimeSource,
  type TerminalExecutionLock,
  TerminalExecutionAttemptService,
  TerminalRetryService,
  type TicketStore,
  type TicketVerificationJobStore,
  TicketVerificationResultService,
  TicketPersistenceService,
  TicketVerificationQueueService,
  WalletLedgerService,
  type TerminalExecutionResult
} from "@lottery/application";
import {
  createDefaultDrawSnapshots,
  InMemoryLedgerStore,
  InMemoryDrawStore,
  InMemoryPurchaseQueueStore,
  InMemoryPurchaseRequestStore,
  InMemoryTerminalExecutionLock,
  InMemoryTicketStore,
  InMemoryTicketVerificationJobStore,
  PostgresDrawStore,
  PostgresLedgerStore,
  PostgresPurchaseQueueStore,
  PostgresPurchaseRequestStore,
  PostgresTerminalExecutionLock,
  PostgresTicketStore,
  PostgresTicketVerificationJobStore
} from "@lottery/infrastructure";
import { Big8LiveDrawProvider } from "./lib/big8-live-draw-provider.js";
import { TerminalHandlerRuntime } from "./lib/terminal-handler-runtime.js";
import { getWorkerPostgresPool, getWorkerStorageBackend } from "./lib/runtime/postgres-runtime.js";

type WorkerBootState = "booting" | "ready";

const WORKER_ID = "terminal-worker";
const rawPollIntervalMs = Number(process.env.LOTTERY_TERMINAL_POLL_INTERVAL_MS ?? 3000);
const POLL_INTERVAL_MS = Number.isFinite(rawPollIntervalMs) && rawPollIntervalMs >= 250 ? rawPollIntervalMs : 3000;
const rawDrawSyncIntervalMs = Number(process.env.LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS ?? 20000);
const DRAW_SYNC_INTERVAL_MS =
  Number.isFinite(rawDrawSyncIntervalMs) && rawDrawSyncIntervalMs >= 1000 ? rawDrawSyncIntervalMs : 20000;
const bootTimestamp = new Date().toISOString();
const timeSource = new SystemTimeSource();
const big8TerminalMode = (process.env.LOTTERY_BIG8_TERMINAL_MODE ?? "real").trim().toLowerCase();
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
const queueStore: PurchaseQueueStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresPurchaseQueueStore(postgresPool)
    : new InMemoryPurchaseQueueStore();
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
const verificationJobStore: TicketVerificationJobStore =
  storageBackend === "postgres" && postgresPool
    ? new PostgresTicketVerificationJobStore(postgresPool)
    : new InMemoryTicketVerificationJobStore();
const walletLedgerService = new WalletLedgerService({
  ledgerStore,
  timeSource
});
const drawRefreshService = new DrawRefreshService({
  drawStore,
  timeSource
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
  executionLock,
  timeSource
});
const attemptService = new TerminalExecutionAttemptService({
  requestStore,
  queueStore,
  ticketPersistenceService: new TicketPersistenceService({
    ticketStore
  })
});
const retryService = new TerminalRetryService({
  maxAttempts: 3
});
const verificationQueueService = new TicketVerificationQueueService({
  ticketStore,
  jobStore: verificationJobStore,
  timeSource
});
const verificationResultService = new TicketVerificationResultService({
  ticketStore,
  purchaseRequestStore: requestStore,
  walletLedgerService,
  timeSource
});
const handlerRuntime = new TerminalHandlerRuntime();

let state: WorkerBootState = "booting";
let isPolling = false;
let isRefreshingDraws = false;

function logBootMessage(): void {
  console.log(`[terminal-worker] ${bootTimestamp} - queue reservation host started`);
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
      await processTicketVerificationQueue();
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

    await processTicketVerificationQueue();
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

async function processTicketVerificationQueue(): Promise<void> {
  const enqueueResult = await verificationQueueService.enqueuePendingVerificationTickets();
  if (enqueueResult.enqueuedCount > 0) {
    console.log(
      `[terminal-worker] verification jobs enqueued pending=${enqueueResult.pendingCount} enqueued=${enqueueResult.enqueuedCount}`
    );
  }

  const verificationJob = await verificationQueueService.reserveNextVerificationJob({
    workerId: WORKER_ID
  });
  if (!verificationJob) {
    return;
  }

  const result = await handlerRuntime.verifyTicketResult({
    lotteryCode: verificationJob.lotteryCode,
    drawId: verificationJob.drawId,
    externalTicketReference: verificationJob.externalReference
  });
  const verificationEventId = `${verificationJob.jobId}:attempt:${verificationJob.attemptCount}`;

  try {
    const recorded = await verificationResultService.recordVerificationResult({
      ticketId: verificationJob.ticketId,
      verificationEventId,
      terminalStatus: result.status,
      winningAmountMinor: result.winningAmountMinor,
      rawOutput: result.rawTerminalOutput
    });

    if (result.status === "error") {
      await verificationQueueService.markVerificationJobError(verificationJob.jobId, {
        error: "terminal verification error",
        rawTerminalOutput: result.rawTerminalOutput
      });
      console.warn(
        `[terminal-worker] verification job failed job=${verificationJob.jobId} status=${result.status}`
      );
      return;
    }

    await verificationQueueService.markVerificationJobDone(verificationJob.jobId, {
      rawTerminalOutput: result.rawTerminalOutput
    });
    console.log(
      `[terminal-worker] verification job done job=${verificationJob.jobId} status=${result.status} ticket=${recorded.ticket.ticketId} replayed=${recorded.replayed}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await verificationQueueService.markVerificationJobError(verificationJob.jobId, {
      error: message,
      rawTerminalOutput: result.rawTerminalOutput
    });
    console.warn(
      `[terminal-worker] verification result apply failed job=${verificationJob.jobId} message=${message}`
    );
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
  const template = createDefaultDrawSnapshots(new Date()).find((entry) => entry.lotteryCode === "bolshaya-8");
  if (!template) {
    return drawRefreshService.getDrawState("bolshaya-8");
  }

  const availableDraws = template.availableDraws ?? [];
  const currentDraw = availableDraws[0] ?? {
    drawId: template.drawId,
    drawAt: template.drawAt
  };

  await drawRefreshService.upsertSnapshot({
    lotteryCode: "bolshaya-8",
    drawId: currentDraw.drawId,
    drawAt: currentDraw.drawAt,
    fetchedAt: timeSource.nowIso(),
    freshnessTtlSeconds: Number(process.env.LOTTERY_BIG8_DRAW_TTL_SECONDS ?? 45),
    ...(availableDraws.length > 0 ? { availableDraws } : {})
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
