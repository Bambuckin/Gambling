---
phase: 06-main-terminal-execution-engine
plan: 03
subsystem: terminal-attempt-journaling-and-outcome-normalization
tags: [terminal-worker, attempts, journaling, outcomes]
requires:
  - phase: 06-02
    provides: deterministic handler resolver boundary
provides:
  - domain normalization model for attempt metadata and outcome
  - application service that records attempt results and mutates request/queue state
  - worker execution path wiring for startedAt/finishedAt/rawOutput capture
affects: [phase-06]
tech-stack:
  added: []
  patterns: [attempt-level journaling, normalized outcome transitions, service-owned state mutation]
key-files:
  modified:
    - packages/domain/src/terminal-attempt.ts
    - packages/domain/src/__tests__/terminal-attempt.test.ts
    - packages/domain/src/index.ts
    - packages/application/src/services/terminal-execution-attempt-service.ts
    - packages/application/src/__tests__/terminal-execution-attempt-service.test.ts
    - packages/application/src/index.ts
    - apps/terminal-worker/src/main.ts
    - docs/runbooks/queue-incident-triage.md
    - docs/modules/boundary-catalog.md
key-decisions:
  - "Attempt metadata normalization (`attempt`, `startedAt`, `finishedAt`, `durationMs`, `rawOutput`) is enforced in domain before state transition."
  - "Terminal execution results are persisted only through `TerminalExecutionAttemptService`, not from worker runtime directly."
  - "Retrying outcomes requeue queue item status to `queued`; success/error outcomes remove queue item."
patterns-established:
  - "Worker flow now captures handler output and records a normalized terminal attempt in request journal each execution cycle."
requirements-completed: [TERM-04]
duration: 6 min
completed: 2026-04-05
---

# Phase 6 Plan 03: Terminal Attempt Journaling And Outcome Normalization Summary

`06-03` is complete.

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T20:25:00.000Z
- **Completed:** 2026-04-05T20:31:00.000Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added domain module `terminal-attempt.ts`:
  - validates attempt metadata,
  - normalizes outcome (`success|retrying|error`),
  - computes `durationMs`,
  - formats structured journal note.
- Added `TerminalExecutionAttemptService` in application layer that:
  - validates request state is `executing`,
  - records normalized attempt note in request journal,
  - transitions request to `success|retrying|error`,
  - requeues or removes queue item depending on outcome.
- Updated worker loop to:
  - execute resolved purchase handler,
  - capture `startedAt`, `finishedAt`, and raw output,
  - classify outcome,
  - persist attempt result via application service.
- Updated queue triage runbook and boundary catalog with attempt metadata troubleshooting and ownership rules.

## Verification Performed

- `corepack pnpm --filter @lottery/domain test -- terminal-attempt` (passed, 23 tests)
- `corepack pnpm --filter @lottery/application test -- terminal-execution-attempt-service` (passed, 50 tests)
- `corepack pnpm --filter @lottery/terminal-worker typecheck` (passed)
- `Select-String -Path docs/runbooks/queue-incident-triage.md -Pattern "startedAt|finishedAt|rawOutput|attempt"` (matched)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `06-04` (retry policy and final error handling).

---
*Phase: 06-main-terminal-execution-engine*  
*Completed: 2026-04-05*
