---
phase: 01-foundation-contracts
plan: 03
subsystem: domain
tags: [domain-models, ports, fake-adapters, vitest]
requires:
  - phase: 01-02
    provides: runtime and package scaffold
provides:
  - explicit request lifecycle state machine
  - application ports for terminal execution, queue, and time source
  - fake terminal and fake lottery handlers for local verification
  - automated request-state tests using vitest
affects: [01-04, phase-04, phase-05, phase-06, phase-07]
tech-stack:
  added: [vitest]
  patterns: [typed boundary ports, fake adapter contracts, explicit transition map]
key-files:
  created:
    - packages/domain/src/request-state.ts
    - packages/application/src/ports/terminal-executor.ts
    - packages/lottery-handlers/src/contracts.ts
    - packages/test-kit/src/fake-terminal.ts
    - packages/domain/src/__tests__/request-state.test.ts
  modified:
    - packages/domain/src/index.ts
    - packages/application/src/index.ts
    - packages/test-kit/src/index.ts
    - package.json
key-decisions:
  - "Request state transitions are explicit and validated by code, not by implicit status conventions."
  - "Terminal and lottery interactions are consumed only through typed ports/contracts with fake implementations available by default."
patterns-established:
  - "Domain and application boundaries export stable contracts through index barrels."
  - "State-machine baseline must ship with executable tests before feature orchestration starts."
requirements-completed: [PLAT-02, PLAT-03]
duration: 28 min
completed: 2026-04-05
---

# Phase 1 Plan 03: Contracts, Fakes, and State-Machine Summary

**Core domain contracts, application ports, fake adapters, and state-machine tests are now implemented and verified without a production terminal.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-04-05T09:00:52Z
- **Completed:** 2026-04-05T09:29:11Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Added typed domain model files for request state, ledger, registry, draw, and ticket contracts.
- Added application boundary ports and lottery handler contracts.
- Added fake terminal and fake lottery-handler adapters plus automated vitest coverage for request transitions.

## Task Commits

1. **Task 1: Define core domain models and state transitions** - `9d2fd24` (feat)
2. **Task 2: Define application ports and fake adapters** - `fb95dac` (feat)
3. **Task 3: Add automated verification for state machine baseline** - `e2d99c4` (test)

## Files Created/Modified

- `packages/domain/src/request-state.ts` - explicit lifecycle states and guarded transitions.
- `packages/domain/src/ledger.ts` - immutable ledger operation contracts.
- `packages/domain/src/lottery-registry.ts` - registry entry and handler-binding contracts.
- `packages/application/src/ports/*` - terminal, queue, and time source ports.
- `packages/lottery-handlers/src/contracts.ts` - stable purchase/result handler contracts.
- `packages/test-kit/src/fake-terminal.ts` and `fake-lottery-handler.ts` - fake adapter implementations.
- `packages/domain/src/__tests__/request-state.test.ts` - executable baseline verification.

## Decisions Made

- State transitions were codified as an explicit transition graph with guard functions.
- Fake adapters were made first-class exports so future smoke/integration checks stay production-independent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NodeNext import/export specifier requirements**
- **Found during:** workspace typecheck after adding test and new barrels
- **Issue:** NodeNext mode required explicit `.js` in relative specifiers.
- **Fix:** Updated relative barrel/test imports to `.js`-suffixed specifiers.
- **Files modified:** `packages/domain/src/index.ts`, `packages/application/src/index.ts`, `packages/lottery-handlers/src/index.ts`, `packages/test-kit/src/index.ts`, `packages/domain/src/__tests__/request-state.test.ts`
- **Verification:** `corepack pnpm typecheck` passed for all workspace members.
- **Committed in:** `e2d99c4`

**2. [Rule 3 - Blocking] Vitest was absent in workspace dependencies**
- **Found during:** Task 3 verification setup
- **Issue:** Test runner selected in ADR-001 was not available yet.
- **Fix:** Added `vitest` to root dev dependencies and wired domain test script.
- **Files modified:** `package.json`, `packages/domain/package.json`, `pnpm-lock.yaml`
- **Verification:** `corepack pnpm --filter @lottery/domain test` passed (3 tests).
- **Committed in:** `e2d99c4`

---

**Total deviations:** 2 auto-fixed (2 blocking)  
**Impact on plan:** Both deviations were necessary to make contract verification executable and stable.

## Issues Encountered

- Sandbox environment blocks subprocess spawning for some pnpm/vitest commands (`spawn EPERM`), so verification commands were rerun in unrestricted shell per runbook guidance.

## User Setup Required

None - no external service credentials are needed for this plan.

## Next Phase Readiness

- Core contracts and fake adapters are in place.
- Ready to execute `01-04-PLAN.md` for module catalogs, runbooks, and entrypoint refresh.

---
*Phase: 01-foundation-contracts*
*Completed: 2026-04-05*
