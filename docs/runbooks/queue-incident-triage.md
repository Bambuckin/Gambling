# Queue Incident Triage

Use this when request processing appears stuck, misordered, or repeatedly failing.

## Current Implementation Status

Queue reservation, lock ownership, deterministic handler resolution, and attempt journaling are implemented.
Retry policy tuning and final failure classification continue in later Phase 6 plans.

## Triage Goals

1. Confirm whether the issue is real queue behavior or a contract mismatch.
2. Identify whether failure originates in request-state logic, queue port contract, or terminal adapter contract.
3. Capture reproducible attempt metadata for debugging (`startedAt`, `finishedAt`, `rawOutput`, `outcome`).

## Step 1: Confirm repository health

```powershell
git status --short --branch
corepack pnpm typecheck
```

If typecheck fails, treat this as a build-integrity issue first.

## Step 2: Validate request-state rules

```powershell
corepack pnpm --filter @lottery/domain test
```

If this fails, queue incidents are secondary; fix state-machine regressions first.

## Step 3: Validate queue contract shape

Inspect:

- `packages/application/src/ports/queue.ts`
- `packages/application/src/ports/terminal-executor.ts`
- `packages/application/src/ports/terminal-handler-registry.ts`
- `packages/application/src/services/purchase-execution-queue-service.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`

Confirm callers and adapters use:

- `priority: "regular" | "admin-priority"`
- terminal result `nextState` limited to `success`, `retrying`, `error`
- queue item `status` transitions `queued -> executing -> queued|removed`

## Step 4: Validate worker attempt path

```powershell
corepack pnpm --filter @lottery/application test -- purchase-execution-queue-service terminal-handler-resolver-service terminal-execution-attempt-service
corepack pnpm --filter @lottery/terminal-worker typecheck
```

If these checks fail, triage queue incidents after restoring worker execution-path integrity.

## Step 5: Incident capture template

Record:

- timestamp and git commit hash
- request id(s) involved
- expected queue order vs observed order
- observed terminal result (`nextState`, `rawOutput`)
- attempt metadata (`attempt`, `startedAt`, `finishedAt`, `durationMs`)
- resolved handler binding (`lotteryCode`, `bindingKey`)
- whether issue reproduces with fake adapters

## Escalation Rule

If contracts are consistent and issue still reproduces, log it as a Phase 5/6 execution bug and attach the capture data above.
