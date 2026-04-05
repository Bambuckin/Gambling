---
phase: 08-admin-operations-and-observability
plan: 02
subsystem: terminal-and-problem-dashboard
tags: [admin, terminal-health, queue-pressure, problem-requests, observability]
requires:
  - phase: 08-01
    provides: admin queue operations and priority controls
provides:
  - consolidated admin operations snapshot service
  - terminal status and queue pressure dashboard on `/admin`
  - problematic request projection with anomaly hints
  - admin operations runbook for incident triage
affects: [phase-08]
tech-stack:
  added: []
  patterns: [read-only projection service, deterministic anomaly hinting, operational runbook closure]
key-files:
  modified:
    - packages/application/src/services/admin-operations-query-service.ts
    - packages/application/src/__tests__/admin-operations-query-service.test.ts
    - packages/application/src/index.ts
    - apps/web/src/lib/purchase/purchase-runtime.ts
    - apps/web/src/app/admin/page.tsx
    - docs/runbooks/admin-operations-console.md
    - docs/runbooks/README.md
key-decisions:
  - "Problem request projection includes `retrying`, `error`, and stale `executing` records with explicit anomaly hints."
  - "Stale executing detection is service-owned and time-based so route code stays read-only."
  - "Admin route now shows terminal status, queue pressure, and problem table in one operational surface."
patterns-established:
  - "Runtime composition exposes `getAdminOperationsQueryService()` for route-level read access without direct store reads."
requirements-completed: [ADMIN-03]
duration: 26 min
completed: 2026-04-05
---

# Phase 8 Plan 02: Terminal And Problem Dashboard Summary

`08-02` is complete.

## Performance

- **Duration:** 26 min
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Implemented `AdminOperationsQueryService` snapshot with:
  - terminal health section;
  - queue pressure section;
  - problem request projection for `retrying`, `error`, and `stale-executing` states.
- Added targeted tests for healthy and incident-heavy snapshots in `admin-operations-query-service.test.ts`.
- Wired `AdminOperationsQueryService` into web runtime through `getAdminOperationsQueryService()`.
- Extended `/admin` with:
  - terminal status table,
  - queue pressure counters,
  - problem requests table including anomaly hint, last error, and user/lottery references.
- Added `docs/runbooks/admin-operations-console.md` and linked it from runbook index.

## Verification Performed

- `corepack pnpm --filter @lottery/application test -- admin-operations-query-service` (passed)
- `corepack pnpm --filter @lottery/web typecheck` (passed)
- `corepack pnpm --filter @lottery/web build` (passed)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `08-03` (structured operations audit log and alert aggregation).

---
*Phase: 08-admin-operations-and-observability*  
*Completed: 2026-04-05*
