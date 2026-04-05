# Queue Incident Triage

Use this when request processing appears stuck, misordered, or repeatedly failing.

## Current Implementation Status

Queue execution is not fully implemented yet (planned in later phases).
This runbook covers triage at the current contract/scaffold level and the minimum checks you can perform now.

## Triage Goals

1. Confirm whether the issue is real queue behavior or a contract mismatch.
2. Identify whether failure originates in request-state logic, queue port contract, or terminal adapter contract.
3. Capture reproducible evidence for the next implementation phase.

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

Confirm callers and adapters use:

- `priority: "regular" | "admin-priority"`
- terminal result `nextState` limited to `success`, `retrying`, `error`

## Step 4: Validate fake adapter path

```powershell
corepack pnpm --filter @lottery/test-kit typecheck
corepack pnpm smoke
```

If fake path is broken, queue behavior cannot be triaged reliably.

## Step 5: Incident capture template

Record:

- timestamp and git commit hash
- request id(s) involved
- expected queue order vs observed order
- observed terminal result (`nextState`, `rawOutput`)
- whether issue reproduces with fake adapters

## Escalation Rule

If contracts are consistent and issue still reproduces, log it as a Phase 5/6 execution bug and attach the capture data above.
