---
phase: 06-main-terminal-execution-engine
plan: 02
subsystem: deterministic-handler-registry-and-resolver
tags: [terminal-worker, handler-registry, resolver, binding]
requires:
  - phase: 06-01
    provides: queue reservation and execution lock baseline
provides:
  - application-level terminal handler registry port and resolver service
  - deterministic lottery handler registry helper in lottery-handlers package
  - worker runtime wiring that resolves handler binding by lottery code before execution
affects: [phase-06]
tech-stack:
  added: []
  patterns: [predefined handler registry, typed binding resolution, no payload-generated execution]
key-files:
  modified:
    - packages/application/src/ports/terminal-handler-registry.ts
    - packages/application/src/services/terminal-handler-resolver-service.ts
    - packages/application/src/__tests__/terminal-handler-resolver-service.test.ts
    - packages/application/src/index.ts
    - packages/lottery-handlers/src/registry.ts
    - packages/lottery-handlers/src/index.ts
    - apps/terminal-worker/src/lib/terminal-handler-runtime.ts
    - apps/terminal-worker/src/main.ts
    - apps/terminal-worker/package.json
    - docs/modules/boundary-catalog.md
key-decisions:
  - "Terminal handler binding resolution is owned by application service `TerminalHandlerResolverService`."
  - "Worker runtime resolves predefined handlers by lottery code and binding key; unknown codes fail with typed error."
  - "Handler logic generation from request payload is explicitly forbidden in boundary rules."
patterns-established:
  - "Deterministic lookup path: worker runtime registry -> application resolver -> runtime handler binding."
requirements-completed: [TERM-03]
duration: 9 min
completed: 2026-04-05
---

# Phase 6 Plan 02: Deterministic Handler Registry And Resolver Summary

`06-02` is complete.

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-05T20:16:00.000Z
- **Completed:** 2026-04-05T20:25:00.000Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added application port `TerminalHandlerRegistry` and resolver service `TerminalHandlerResolverService` with typed errors:
  - `invalid_lottery_code`
  - `handler_not_found`
- Added tests that verify:
  - deterministic resolution by normalized lottery code,
  - missing-binding rejection,
  - empty-code validation.
- Added deterministic registry helper in `@lottery/lottery-handlers`:
  - rejects duplicate lottery bindings,
  - returns immutable binding snapshots (`lotteryCode`, `bindingKey`, `contractVersion`, `handler`).
- Added `apps/terminal-worker/src/lib/terminal-handler-runtime.ts` that:
  - composes predefined handlers,
  - routes binding lookup through application resolver service,
  - exposes resolved handler + binding for worker loop.
- Updated worker main loop to resolve and log handler binding after queue reservation.
- Updated boundary catalog with strict rule: no runtime-generated handler logic from request payload.

## Verification Performed

- `corepack pnpm --filter @lottery/application test -- terminal-handler-resolver-service` (passed, 47 tests)
- `corepack pnpm --filter @lottery/lottery-handlers typecheck` (passed)
- `corepack pnpm --filter @lottery/terminal-worker typecheck` (passed)
- `Select-String -Path docs/modules/boundary-catalog.md -Pattern "deterministic handler|payload|TerminalHandlerResolverService"` (matched)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `06-03` (attempt-level terminal output capture and normalized execution result flow).

---
*Phase: 06-main-terminal-execution-engine*  
*Completed: 2026-04-05*
