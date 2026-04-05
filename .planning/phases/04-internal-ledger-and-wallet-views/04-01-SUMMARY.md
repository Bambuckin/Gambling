---
phase: 04-internal-ledger-and-wallet-views
plan: 01
subsystem: wallet-ledger-core
tags: [ledger, wallet-aggregate, immutable-history, runtime-wiring]
requires: []
provides:
  - immutable ledger entry validation and aggregate helpers in domain
  - wallet ledger application service with append-only/idempotent recording
  - in-memory ledger adapter for local verification/runtime
  - web runtime wiring for ledger-backed wallet snapshot on lottery page
affects: [phase-04, phase-05, phase-07]
tech-stack:
  added: []
  patterns: [append-only ledger event stream, aggregate-from-history snapshot]
key-files:
  created:
    - packages/domain/src/__tests__/ledger.test.ts
    - packages/application/src/ports/ledger-store.ts
    - packages/application/src/services/wallet-ledger-service.ts
    - packages/application/src/__tests__/wallet-ledger-service.test.ts
    - packages/infrastructure/src/ledger/in-memory-ledger-store.ts
    - apps/web/src/lib/ledger/ledger-runtime.ts
  modified:
    - packages/domain/src/ledger.ts
    - packages/domain/package.json
    - packages/application/src/index.ts
    - packages/infrastructure/src/index.ts
    - apps/web/src/app/lottery/[lotteryCode]/page.tsx
    - docs/modules/boundary-catalog.md
    - .planning/codebase/STRUCTURE.md
key-decisions:
  - "Wallet snapshot is derived from sorted immutable entries, not from mutable balance counters."
  - "Ledger entries now require request/ticket linkage metadata at domain validation boundary."
  - "Web route reads wallet state via runtime-composed WalletLedgerService and no longer uses hash-based fake balance."
patterns-established:
  - "Application service owns financial record command surface while adapters stay append-only storage."
  - "Ledger runtime follows existing access/registry/draw composition pattern for local verification seeds."
requirements-completed: []
duration: 26 min
completed: 2026-04-05
---

# Phase 4 Plan 01: Wallet Aggregate + Immutable Ledger Baseline Summary

`04-01` is complete.

## Performance

- **Duration:** 26 min
- **Started:** 2026-04-05T18:40:00.000Z
- **Completed:** 2026-04-05T19:06:00.000Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Expanded `packages/domain/src/ledger.ts` with strict entry normalization, reference checks, movement deltas, underflow protection, entry sorting, and wallet aggregate computation.
- Added domain tests validating reserve/debit/release/credit math and invariant failure cases.
- Introduced `LedgerStore` port and `WalletLedgerService` for immutable entry recording and snapshot/history retrieval with idempotent replay behavior.
- Added application tests for append flow, idempotency replay/conflict, empty wallet snapshot, and history ordering.
- Added `InMemoryLedgerStore` adapter and exported new ledger boundaries from application/infrastructure package indices.
- Added web ledger runtime composition and replaced hash-based lottery balance preview with real ledger-backed wallet fields (`available`, `reserved`, movement count).
- Updated boundary and structure docs to reflect new ledger ownership and runtime composition.

## Verification Performed

- `corepack pnpm --filter @lottery/domain test` (passed, 8 tests)
- `corepack pnpm --filter @lottery/application test` (passed, 20 tests)
- `corepack pnpm --filter @lottery/infrastructure typecheck` (passed)
- `corepack pnpm --filter @lottery/web build` (passed)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `04-02` to add reserve/debit/release command semantics and strict idempotency guards for repeated request processing.

---
*Phase: 04-internal-ledger-and-wallet-views*  
*Completed: 2026-04-05*
