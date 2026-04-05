import { PurchaseExecutionQueueService, SystemTimeSource } from "@lottery/application";
import {
  InMemoryPurchaseQueueStore,
  InMemoryPurchaseRequestStore,
  InMemoryTerminalExecutionLock
} from "@lottery/infrastructure";

type WorkerBootState = "booting" | "ready";

const WORKER_ID = "terminal-worker";
const POLL_INTERVAL_MS = 3000;
const bootTimestamp = new Date().toISOString();

const queueService = new PurchaseExecutionQueueService({
  requestStore: new InMemoryPurchaseRequestStore(),
  queueStore: new InMemoryPurchaseQueueStore(),
  executionLock: new InMemoryTerminalExecutionLock(),
  timeSource: new SystemTimeSource()
});

let state: WorkerBootState = "booting";
let isPolling = false;

function logBootMessage(): void {
  console.log(`[terminal-worker] ${bootTimestamp} - queue reservation host started`);
  console.log("[terminal-worker] deterministic handler execution is wired in upcoming Phase 6 plans");
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
