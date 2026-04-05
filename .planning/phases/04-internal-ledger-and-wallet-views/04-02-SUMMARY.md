---
phase: 04-internal-ledger-and-wallet-views
plan: 02
subsystem: wallet-ledger-transitions
tags: [reserve, debit, release, idempotency]
requires:
  - phase: 04-01
    provides: immutable ledger baseline and wallet aggregate service
provides:
  - explicit reserve/debit/release command API in wallet ledger service
  - requestId-required invariant for reserve/debit/release operations
  - idempotent retry coverage for reserve/debit/release commands
affects: [phase-04, phase-05]
tech-stack:
  added: []
  patterns: [command-specific ledger API, idempotency-by-operation]
key-files:
  modified:
    - packages/application/src/services/wallet-ledger-service.ts
    - packages/application/src/__tests__/wallet-ledger-service.test.ts
    - packages/domain/src/ledger.ts
    - packages/domain/src/__tests__/ledger.test.ts
    - docs/modules/boundary-catalog.md
key-decisions:
  - "Reserve/debit/release now use dedicated service commands instead of generic operation calls."
  - "Domain now enforces requestId reference for reserve/debit/release to keep request lifecycle traceable."
  - "Idempotency key replay remains stable per operation payload and rejects conflicting repeats."
patterns-established:
  - "Financial mutation rules and idempotency guards are centralized in WalletLedgerService."
requirements-completed: [BAL-01, BAL-02, BAL-03]
duration: 10 min
completed: 2026-04-05
---

# Phase 4 Plan 02: Reserve/Debit/Release And Idempotency Summary

`04-02` is complete.

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-05T18:50:00.000Z
- **Completed:** 2026-04-05T19:00:00.000Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added explicit command API to `WalletLedgerService`:
  - `reserveFunds(...)`
  - `debitReservedFunds(...)`
  - `releaseReservedFunds(...)`
- Added command-level `requestId` enforcement for reserve/debit/release requests.
- Strengthened domain invariant in `normalizeLedgerEntry` so reserve/debit/release entries require `requestId`.
- Extended tests:
  - transition semantics for reserve -> debit -> release balance math,
  - idempotent replays for each command without duplicate entries,
  - required-requestId rejection paths.
- Updated boundary docs to explicitly include idempotency ownership in application layer.

## Verification Performed

- `corepack pnpm --filter @lottery/domain test` (passed, 9 tests)
- `corepack pnpm --filter @lottery/application test` (passed, 23 tests)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `04-03` to build wallet/balance history UI and dedicated `/debug/wallet-lab` verification contour.

---
*Phase: 04-internal-ledger-and-wallet-views*  
*Completed: 2026-04-05*
