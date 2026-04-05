---
phase: 06-main-terminal-execution-engine
plan: 04
subsystem: retry-policy-and-final-error-handling
tags: [retry, failure-classification, terminal-worker]
requires:
  - phase: 06-03
    provides: normalized attempt journaling service and execution result flow
provides:
  - domain retry policy decision helper with transient vs terminal classification
  - application retry service resolving retrying vs final error state
  - worker integration that applies retry policy before attempt persistence
affects: [phase-06]
tech-stack:
  added: []
  patterns: [domain retry rules, application retry arbitration, worker-thin orchestration]
key-files:
  modified:
    - packages/domain/src/retry-policy.ts
    - packages/domain/src/__tests__/retry-policy.test.ts
    - packages/domain/src/index.ts
    - packages/application/src/services/terminal-retry-service.ts
    - packages/application/src/__tests__/terminal-retry-service.test.ts
    - packages/application/src/index.ts
    - apps/terminal-worker/src/main.ts
    - docs/modules/boundary-catalog.md
key-decisions:
  - "Retry decisions are domain-driven (`decideRetryOutcome`) and accept explicit max-attempt configuration."
  - "Application retry service owns conversion from candidate retry state to final `retrying` or `error` based on policy output."
  - "Worker runtime no longer decides retry exhaustion inline and routes decision through `TerminalRetryService`."
patterns-established:
  - "Retry-vs-final-error path now goes through domain + application layers before request transition persistence."
requirements-completed: [TERM-05]
duration: 6 min
completed: 2026-04-05
---

# Phase 6 Plan 04: Retry Policy And Final Error Handling Summary

`06-04` is complete.

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T20:31:00.000Z
- **Completed:** 2026-04-05T20:37:00.000Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added domain retry policy module with strict validation and explicit decision outputs:
  - `retrying` for transient failures with attempts remaining,
  - `error` for exhausted retries or terminal failures.
- Added `TerminalRetryService` in application layer:
  - consumes candidate execution state + raw output + attempt,
  - applies retry policy with configurable `maxAttempts`,
  - returns final state for persistence path.
- Integrated retry service into worker loop so attempt recording receives retry-aware `nextState`.
- Updated boundary catalog to lock retry/final-error ownership inside domain/application services.

## Verification Performed

- `corepack pnpm --filter @lottery/domain test -- retry-policy` (passed, 27 tests)
- `corepack pnpm --filter @lottery/application test -- terminal-retry-service` (passed, 54 tests)
- `corepack pnpm --filter @lottery/terminal-worker typecheck` (passed)
- `Select-String -Path docs/modules/boundary-catalog.md -Pattern "retry policy|final error|terminal-retry-service"` (matched)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `06-05` (terminal state projection and verification contour).

---
*Phase: 06-main-terminal-execution-engine*  
*Completed: 2026-04-05*
