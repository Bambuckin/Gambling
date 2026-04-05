---
phase: 06-main-terminal-execution-engine
plan: 05
subsystem: terminal-health-projection-and-verification-contour
tags: [terminal-health, verification-ui, runbook]
requires:
  - phase: 06-04
    provides: retry-aware execution outcomes and terminal error classification
provides:
  - application terminal health projection service (`idle|busy|degraded|offline`)
  - web terminal runtime composition and dedicated `/debug/terminal-lab` contour
  - updated triage/runbook and boundary rules for terminal health verification
affects: [phase-06]
tech-stack:
  added: []
  patterns: [state projection service, verification-only debug contour, operational state mapping]
key-files:
  modified:
    - packages/application/src/services/terminal-health-service.ts
    - packages/application/src/__tests__/terminal-health-service.test.ts
    - packages/application/src/index.ts
    - apps/web/src/lib/purchase/purchase-runtime.ts
    - apps/web/src/lib/terminal/terminal-runtime.ts
    - apps/web/src/app/debug/terminal-lab/page.tsx
    - docs/runbooks/queue-incident-triage.md
    - docs/modules/boundary-catalog.md
key-decisions:
  - "Terminal state projection is owned by `TerminalHealthService` and uses queue executing status + consecutive errors."
  - "`terminal-lab` route is verification-only and explicitly forbidden from queue/request mutation controls."
  - "Queue triage runbook now uses `idle|busy|degraded|offline` as first diagnostic signal."
patterns-established:
  - "Web debug contour reads terminal health snapshot from application service through runtime composition without owning terminal logic."
requirements-completed: [TERM-06]
duration: 6 min
completed: 2026-04-05
---

# Phase 6 Plan 05: Terminal Health Projection And Verification Contour Summary

`06-05` is complete.

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T20:37:00.000Z
- **Completed:** 2026-04-05T20:43:00.000Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `TerminalHealthService` in application layer that projects:
  - `idle` (no active execution and no consecutive errors),
  - `busy` (active queue item in `executing`),
  - `degraded` (recent error chain),
  - `offline` (three or more consecutive errors).
- Added tests for all four state mappings.
- Added shared web runtime composition for terminal health service.
- Added dedicated verification contour `/debug/terminal-lab` showing:
  - current terminal state snapshot,
  - active request id,
  - queue depth,
  - consecutive failure count,
  - latest error timestamp,
  - queue snapshot table.
- Updated queue incident runbook with explicit `idle|busy|degraded|offline` interpretation and verification commands.
- Updated boundary catalog to treat terminal-lab as verification-only UI surface.

## Verification Performed

- `corepack pnpm --filter @lottery/application test -- terminal-health-service` (passed, 58 tests)
- `corepack pnpm --filter @lottery/web build` (passed, includes `/debug/terminal-lab`)
- `Select-String -Path docs/runbooks/queue-incident-triage.md -Pattern "idle|busy|degraded|offline"` (matched)
- `Select-String -Path docs/modules/boundary-catalog.md -Pattern "terminal-lab|verification-only"` (matched)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Close Phase 6 and transition to Phase 7 planning (`Ticket Verification and Winnings`).

---
*Phase: 06-main-terminal-execution-engine*  
*Completed: 2026-04-05*
