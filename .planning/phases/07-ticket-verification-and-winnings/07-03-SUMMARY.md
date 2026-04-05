---
phase: 07-ticket-verification-and-winnings
plan: 03
subsystem: verification-result-normalization-and-winnings-credit
tags: [ticket-verification, result-normalization, winnings, ledger-idempotency]
requires:
  - phase: 07-02
    provides: verification job reservation and worker-triggered terminal result polling
provides:
  - domain helper for immutable ticket verification outcome application
  - application verification result service with replay-safe event handling
  - wallet ledger winnings credit path with ticket-scoped idempotency key
  - worker integration for applying verification result after terminal check
affects: [phase-07]
tech-stack:
  added: []
  patterns: [verification event idempotency by event key, ticket-first normalization with service boundary, ticket-linked ledger credits]
key-files:
  modified:
    - packages/domain/src/ticket.ts
    - packages/domain/src/__tests__/ticket.test.ts
    - packages/application/src/ports/ticket-store.ts
    - packages/application/src/services/ticket-verification-result-service.ts
    - packages/application/src/__tests__/ticket-verification-result-service.test.ts
    - packages/application/src/services/wallet-ledger-service.ts
    - packages/application/src/__tests__/wallet-ledger-service.test.ts
    - packages/infrastructure/src/purchase/in-memory-ticket-store.ts
    - apps/terminal-worker/src/main.ts
    - docs/modules/boundary-catalog.md
    - docs/runbooks/ticket-persistence-verification.md
key-decisions:
  - "Ticket verification result normalization and winnings credit stay application-owned via TicketVerificationResultService."
  - "Replay safety is keyed by verification event id and enforced across ticket updates plus ledger credit idempotency."
  - "Winnings credit idempotency key is `${ticketId}:winnings:${verificationEventId}` and always links ledger entry to `ticketId`."
patterns-established:
  - "Worker verification flow applies terminal outcome through application service before closing verification job."
requirements-completed: [TICK-03, BAL-04]
duration: 22 min
completed: 2026-04-05
---

# Phase 7 Plan 03: Verification Result Normalization And Winnings Credit Summary

`07-03` is complete.

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-05T17:20:00.000Z
- **Completed:** 2026-04-05T17:42:00.000Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Extended ticket domain with immutable verification-outcome helper:
  - supports `verified|failed` final states,
  - persists `verificationRawOutput`, `winningAmountMinor`, `verifiedAt`,
  - stores `lastVerificationEventId` for replay-safe event handling.
- Added `TicketVerificationResultService`:
  - normalizes terminal statuses into ticket verification outcomes,
  - applies one-shot ticket update per verification event,
  - detects conflicting replay payloads,
  - credits winnings through wallet ledger for verified winning tickets.
- Extended `WalletLedgerService` with `creditWinnings` command:
  - credit operation is linked to `ticketId`,
  - idempotency key is `${ticketId}:winnings:${verificationEventId}`,
  - duplicate event replays do not duplicate credit entries.
- Wired terminal worker verification path to call `TicketVerificationResultService` before finalizing verification jobs.
- Updated boundary catalog and runbook with verification-result and winnings-credit ownership/verification checks.

## Verification Performed

- `corepack pnpm --filter @lottery/domain test -- ticket` (passed)
- `corepack pnpm --filter @lottery/application test -- ticket-verification-result-service wallet-ledger-service` (passed)
- `corepack pnpm --filter @lottery/terminal-worker typecheck` (passed)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `07-04` (user-facing ticket result views and verification contour).

---
*Phase: 07-ticket-verification-and-winnings*  
*Completed: 2026-04-05*
