---
phase: 07-ticket-verification-and-winnings
plan: 04
subsystem: ticket-outcome-views-and-verification-contour
tags: [ticket-ui, ticket-query, verification-contour, read-only]
requires:
  - phase: 07-03
    provides: normalized ticket verification results and idempotent winnings credit
provides:
  - application ticket read/query service for user projections
  - lottery page ticket outcome section for user-facing visibility
  - verification-only `/debug/ticket-lab` contour for manual checks
affects: [phase-07]
tech-stack:
  added: []
  patterns: [read-only ticket query boundary, runtime composition reuse via purchase stores, verification-only debug contour]
key-files:
  modified:
    - packages/application/src/services/ticket-query-service.ts
    - packages/application/src/__tests__/ticket-query-service.test.ts
    - packages/application/src/index.ts
    - apps/web/src/lib/purchase/purchase-runtime.ts
    - apps/web/src/lib/ticket/ticket-runtime.ts
    - apps/web/src/app/lottery/[lotteryCode]/page.tsx
    - apps/web/src/app/debug/ticket-lab/page.tsx
    - docs/modules/boundary-catalog.md
    - docs/runbooks/ticket-persistence-verification.md
key-decisions:
  - "Ticket read projections are served by application-only `TicketQueryService`, not route-level store access."
  - "Ticket Lab is an explicit verification-only and read-only contour with no mutation controls."
  - "Lottery user page shows ticket verification status and winning amount in the same shell as purchase request history."
patterns-established:
  - "Web runtime uses dedicated `ticket-runtime` composition for ticket query reads."
requirements-completed: [TICK-04]
duration: 18 min
completed: 2026-04-05
---

# Phase 7 Plan 04: Ticket Outcome Views And Verification Contour Summary

`07-04` is complete.

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-05T17:45:00.000Z
- **Completed:** 2026-04-05T18:03:00.000Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added `TicketQueryService` in application layer:
  - user-scoped and global read projections for tickets,
  - stable UI fields (`ticketId`, `drawId`, `verificationStatus`, `winningAmountMinor`, `verifiedAt`, `externalReference`),
  - read-only boundary with no mutation methods.
- Added `ticket-runtime` in web runtime composition and wired shared in-memory ticket store access through purchase runtime stores.
- Extended lottery page with user-facing **Ticket Outcomes** table.
- Added `/debug/ticket-lab` page:
  - read-only verification contour for ticket snapshots by user/all-tickets views,
  - explicit no-mutation UI contract.
- Updated boundary catalog and runbook to formalize ticket-lab verification-only ownership and manual checks.

## Verification Performed

- `corepack pnpm --filter @lottery/application test -- ticket-query-service` (passed)
- `corepack pnpm --filter @lottery/web build` (passed)
- `Select-String -Path docs/modules/boundary-catalog.md -Pattern "ticket-lab|verification-only"` (matched)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Close Phase 7 in roadmap/state and move focus to Phase 8 planning.

---
*Phase: 07-ticket-verification-and-winnings*  
*Completed: 2026-04-05*
