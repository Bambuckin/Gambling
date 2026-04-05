# Queue Incident Triage

Use this when request processing appears stuck, misordered, or repeatedly failing.

## Current Implementation Status

Queue reservation, lock ownership, deterministic handler resolution, attempt journaling, retry policy, and terminal health projection are implemented.

## Triage Goals

1. Confirm whether the issue is real queue behavior or a contract mismatch.
2. Identify whether failure originates in request-state logic, queue port contract, or terminal adapter contract.
3. Capture reproducible attempt metadata for debugging (`startedAt`, `finishedAt`, `rawOutput`, `outcome`).
4. Confirm terminal state mapping (`idle|busy|degraded|offline`) is consistent with recent execution outcomes.

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

## Step 5: Validate terminal health state mapping

Inspect:

- `packages/application/src/services/terminal-health-service.ts`
- `apps/web/src/lib/terminal/terminal-runtime.ts`
- `apps/web/src/app/debug/terminal-lab/page.tsx`

Run:

```powershell
corepack pnpm --filter @lottery/application test -- terminal-health-service
corepack pnpm --filter @lottery/web build
```

State interpretation:

- `idle` - no active executing request and no recent consecutive errors
- `busy` - at least one queue item is in `executing` status
- `degraded` - no active execution, but latest request chain includes error(s)
- `offline` - three or more consecutive error outcomes

## Step 6: Validate admin observability projections

Inspect:

- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/debug/admin-ops-lab/page.tsx`
- `apps/web/src/lib/observability/operations-runtime.ts`
- `packages/application/src/services/operations-alert-service.ts`

Checks:

1. `/admin` shows queue and terminal anomalies as alert rows.
2. `/debug/admin-ops-lab` mirrors queue/terminal/alert data without mutation controls.
3. Latest queue-priority action appears in operations audit events.

Run:

```powershell
corepack pnpm --filter @lottery/application test -- admin-operations-query-service operations-alert-service operations-audit-service
corepack pnpm --filter @lottery/web build
```

## Step 7: Incident capture template

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
