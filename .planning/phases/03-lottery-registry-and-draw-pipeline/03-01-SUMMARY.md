---
phase: 03-lottery-registry-and-draw-pipeline
plan: 01
subsystem: registry
tags: [lottery-registry, ordering, visibility, handler-bindings, debug-ui]
requires:
  - phase: 02-05
    provides: access shell baseline and debug verification route pattern
provides:
  - registry application service with visibility/order orchestration
  - in-memory registry store adapter with deterministic sorting
  - shell lottery list sourced from registry enabled/order state
  - separate Registry Lab debug UI contour for manual verification
affects: [phase-03, phase-04, phase-05]
tech-stack:
  added: []
  patterns: [registry-runtime composition, service-owned ordering rules, debug verification contour]
key-files:
  created:
    - packages/application/src/ports/lottery-registry-store.ts
    - packages/application/src/services/lottery-registry-service.ts
    - packages/application/src/__tests__/lottery-registry-service.test.ts
    - packages/infrastructure/src/registry/in-memory-lottery-registry-store.ts
    - apps/web/src/lib/registry/registry-runtime.ts
    - apps/web/src/app/debug/registry-lab/page.tsx
  modified:
    - packages/domain/src/lottery-registry.ts
    - packages/application/src/index.ts
    - packages/application/package.json
    - packages/infrastructure/src/index.ts
    - apps/web/src/lib/access/lottery-catalog.ts
    - apps/web/src/lib/access/entry-flow.ts
    - apps/web/src/app/page.tsx
    - docs/modules/boundary-catalog.md
    - .planning/codebase/STRUCTURE.md
    - .planning/phases/03-lottery-registry-and-draw-pipeline/03-01-PLAN.md
key-decisions:
  - "Shell lottery availability now comes from registry service, not direct env catalog parsing."
  - "Registry runtime composition mirrors access runtime so adapters can be replaced without route rewrites."
  - "Debug Registry Lab is a dedicated verification contour, kept separate from core shell flow."
patterns-established:
  - "Registry service enforces code normalization, ordering, visibility filtering, and handler reference presence."
  - "Legacy shell env catalog is mapped into registry seeds only as compatibility input."
requirements-completed: [LOTR-01, LOTR-04]
duration: 8 min
completed: 2026-04-05
---

# Phase 3 Plan 01: Registry Core Summary

`03-01` is complete as the first executable slice of Phase 3.

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T12:21:27.651Z
- **Completed:** 2026-04-05T12:28:59.434Z
- **Tasks:** 4
- **Files modified:** 19

## Accomplishments

- Implemented registry domain helpers, application storage port, and `LotteryRegistryService` with ordering/visibility/handler-reference validation.
- Added in-memory registry store adapter and application tests for enabled-only ordering, upsert behavior, and duplicate-code rejection.
- Wired web shell lottery catalog to registry service and added `/debug/registry-lab` as a separate manual verification contour.
- Updated module boundary and structure docs to reflect registry ownership and runtime wiring.

## Verification Performed

- `corepack pnpm --filter @lottery/application test` (passed, 8 tests)
- `corepack pnpm typecheck` (passed across workspace packages)
- `corepack pnpm --filter @lottery/web build` (passed; includes `/debug/registry-lab` route)
- `corepack pnpm smoke` (passed: `test-kit smoke scaffold ready`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest glob mismatch on Windows**
- **Found during:** Task 2 verification
- **Issue:** the application test script used a glob pattern that did not match files in this Windows shell.
- **Fix:** switched application test script to `vitest run`.
- **Files modified:** `packages/application/package.json`
- **Verification:** `corepack pnpm --filter @lottery/application test` passed

**2. [Rule 1 - Bug] Invalid test fixture lottery codes**
- **Found during:** Task 2 verification
- **Issue:** test fixtures used one-character codes that violated registry code validation pattern.
- **Fix:** replaced fixtures with valid codes (`lottery-a`, `lottery-b`, `lottery-c`).
- **Files modified:** `packages/application/src/__tests__/lottery-registry-service.test.ts`
- **Verification:** registry test suite passed

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** both fixes were required to complete planned verification; no scope creep.

## User Setup Required

None.

## Next Step

Create and execute `03-02` (dynamic lottery form rendering from registry metadata).

---
*Phase: 03-lottery-registry-and-draw-pipeline*
*Completed: 2026-04-05*
