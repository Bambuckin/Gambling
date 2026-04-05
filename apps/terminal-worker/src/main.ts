import {
  PurchaseExecutionQueueService,
  SystemTimeSource,
  TerminalExecutionAttemptService,
  type TerminalExecutionResult
} from "@lottery/application";
import {
  InMemoryPurchaseQueueStore,
  InMemoryPurchaseRequestStore,
  InMemoryTerminalExecutionLock
} from "@lottery/infrastructure";
import { TerminalHandlerRuntime } from "./lib/terminal-handler-runtime.js";

type WorkerBootState = "booting" | "ready";

const WORKER_ID = "terminal-worker";
const POLL_INTERVAL_MS = 3000;
const bootTimestamp = new Date().toISOString();
const timeSource = new SystemTimeSource();
const requestStore = new InMemoryPurchaseRequestStore();
const queueStore = new InMemoryPurchaseQueueStore();
const executionLock = new InMemoryTerminalExecutionLock();

const queueService = new PurchaseExecutionQueueService({
  requestStore,
  queueStore,
  executionLock,
  timeSource
});
const attemptService = new TerminalExecutionAttemptService({
  requestStore,
  queueStore
});
const handlerRuntime = new TerminalHandlerRuntime();

let state: WorkerBootState = "booting";
let isPolling = false;

function logBootMessage(): void {
  console.log(`[terminal-worker] ${bootTimestamp} - queue reservation host started`);
  console.log("[terminal-worker] deterministic handler resolution and attempt journaling are enabled");
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

    const attemptRecord = await attemptService.recordAttemptResult({
      requestId: reservation.request.snapshot.requestId,
      attempt: reservation.queueItem.attemptCount,
      startedAt,
      result: terminalResult
    });

    console.log(
      `[terminal-worker] attempt recorded request=${attemptRecord.request.snapshot.requestId} outcome=${attemptRecord.request.state}`
    );
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

function startWorker(): void {
  logBootMessage();
  state = "ready";
  console.log(`[terminal-worker] state=${state}`);

  void pollQueueForExecution();
  setInterval(() => {
    void pollQueueForExecution();
  }, POLL_INTERVAL_MS);
}

startWorker();

async function executeTerminalAttempt(
  requestId: string,
  attempt: number,
  startedAt: string,
  run: () => Promise<{ rawTerminalOutput: string }>
): Promise<TerminalExecutionResult> {
  try {
    const purchaseResult = await run();
    return {
      requestId,
      nextState: classifyTerminalOutcome(purchaseResult.rawTerminalOutput),
      rawOutput: purchaseResult.rawTerminalOutput,
      finishedAt: timeSource.nowIso()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      requestId,
      nextState: "error",
      rawOutput: `[terminal-worker-error] attempt=${attempt} startedAt=${startedAt} message=${message}`,
      finishedAt: timeSource.nowIso()
    };
  }
}

function classifyTerminalOutcome(rawOutput: string): TerminalExecutionResult["nextState"] {
  const normalized = rawOutput.toLowerCase();
  if (normalized.includes("retry")) {
    return "retrying";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "error";
  }
  return "success";
}
