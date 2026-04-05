type WorkerBootState = "booting" | "ready";

const bootTimestamp = new Date().toISOString();
let state: WorkerBootState = "booting";

function logBootMessage(): void {
  console.log(`[terminal-worker] ${bootTimestamp} - Phase 1 scaffold entrypoint`);
  console.log("[terminal-worker] queue, schedulers, and terminal adapter wiring come in later plans");
}

function startWorker(): void {
  logBootMessage();
  state = "ready";
  console.log(`[terminal-worker] state=${state}`);
}

startWorker();
