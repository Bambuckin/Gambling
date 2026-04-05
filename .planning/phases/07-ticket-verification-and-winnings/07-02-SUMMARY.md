---
phase: 07-ticket-verification-and-winnings
plan: 02
subsystem: ticket-verification-trigger-and-queue-flow
tags: [ticket-verification, queue, worker, automation]
requires:
  - phase: 07-01
    provides: persisted purchased tickets with pending verification defaults
provides:
  - domain verification-job model and pending-ticket eligibility helper
  - application verification queue service with enqueue/reserve/done/error transitions
  - worker-side verification queue polling and terminal-result read stub path
affects: [phase-07]
tech-stack:
  added: []
  patterns: [idempotent enqueue by ticketId, queued-to-verifying reservation, service-owned job transitions]
key-files:
  modified:
    - packages/domain/src/ticket.ts
    - packages/domain/src/__tests__/ticket.test.ts
    - packages/application/src/ports/ticket-verification-job-store.ts
    - packages/application/src/services/ticket-verification-queue-service.ts
    - packages/application/src/__tests__/ticket-verification-queue-service.test.ts
    - packages/application/src/index.ts
    - packages/infrastructure/src/purchase/in-memory-ticket-verification-job-store.ts
    - packages/infrastructure/src/index.ts
    - apps/terminal-worker/src/main.ts
    - apps/terminal-worker/src/lib/terminal-handler-runtime.ts
    - docs/modules/boundary-catalog.md
    - docs/runbooks/ticket-persistence-verification.md
key-decisions:
  - "Pending purchased tickets are enqueued into verification jobs once, idempotent by ticketId."
  - "Verification queue reservation transitions jobs from queued to verifying and blocks duplicate reservation."
  - "Worker polls verification queue automatically after purchase polling and records verification-job completion/error."
patterns-established:
  - "Ticket verification flow uses application queue orchestration and worker polling instead of direct runtime store mutations."
requirements-completed: [TICK-02]
duration: 14 min
completed: 2026-04-05
---

# Phase 7 Plan 02: Ticket Verification Trigger And Queue Flow Summary

`07-02` is complete.

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-05T16:50:00.000Z
- **Completed:** 2026-04-05T17:04:00.000Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Extended ticket domain with:
  - verification-job states (`queued|verifying|done|error`),
  - verification-job creation/reservation/completion/failure helpers,
  - pending-ticket eligibility helper.
- Added `TicketVerificationJobStore` port and `TicketVerificationQueueService`:
  - enqueue pending purchased tickets once,
  - reserve next queued job with attempt increment,
  - mark job `done` or `error`.
- Added infrastructure adapter `InMemoryTicketVerificationJobStore`.
- Extended terminal worker loop:
  - auto-enqueue verification jobs when pending tickets exist,
  - reserve and process one verification job per poll cycle,
  - mark job completion/error based on terminal verification result.
- Extended handler runtime with deterministic ticket verification read path for demo flow.
- Updated boundary catalog and ticket verification runbook for new queue ownership rules.

## Verification Performed

- `corepack pnpm --filter @lottery/domain test -- ticket` (passed)
- `corepack pnpm --filter @lottery/application test -- ticket-verification-queue-service` (passed)
- `corepack pnpm --filter @lottery/terminal-worker typecheck` (passed)

## Deviations from Plan

- Result-handler registry expansion was deferred; worker uses deterministic verification stub in runtime while keeping handler resolution by lottery code.

## User Setup Required

None.

## Next Step

Execute `07-03` (verification result normalization and winnings credit).

---
*Phase: 07-ticket-verification-and-winnings*  
*Completed: 2026-04-05*
