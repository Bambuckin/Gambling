---
phase: 04-internal-ledger-and-wallet-views
plan: 03
subsystem: wallet-ui-and-verification-contour
tags: [wallet, ledger, ui, debug]
requires:
  - phase: 04-02
    provides: reserve/debit/release commands and requestId/idempotency guards
provides:
  - wallet snapshot table and latest movement history in lottery user page
  - dedicated `/debug/wallet-lab` verification-only route
  - manual wallet verification runbook for snapshot and transition checks
affects: [phase-04, phase-05]
tech-stack:
  added: []
  patterns: [read-only ledger view helpers, separate verification contour]
key-files:
  modified:
    - apps/web/src/app/lottery/[lotteryCode]/page.tsx
    - apps/web/src/app/debug/wallet-lab/page.tsx
    - apps/web/src/lib/ledger/wallet-view.ts
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - docs/runbooks/wallet-verification.md
key-decisions:
  - "Wallet rendering on operational routes is read-only and consumes ledger helper functions."
  - "Wallet Lab is explicit test-only contour, separate from operational screens."
  - "Movement rows show operation, signed amount, reference metadata, and timestamp."
patterns-established:
  - "Ledger UI formatting and reference rendering are centralized in web ledger helper module."
requirements-completed: [BAL-06]
duration: 20 min
completed: 2026-04-05
---

# Phase 4 Plan 03: Wallet UI And Verification Contour Summary

`04-03` is complete.

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-05T19:00:00.000Z
- **Completed:** 2026-04-05T19:20:00.000Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Expanded lottery user page wallet block into:
  - snapshot table (`currency`, `available`, `reserved`, movement count),
  - latest movement table (`operation`, `amount`, `reference`, `created at`).
- Added `apps/web/src/lib/ledger/wallet-view.ts` helper module for read-side movement formatting and user extraction.
- Added dedicated `http://localhost:3000/debug/wallet-lab` route:
  - lists seeded wallets and snapshots,
  - shows per-wallet movement history for manual checks,
  - clearly marked as verification-only.
- Added runbook `docs/runbooks/wallet-verification.md` with repeatable checks and expected outcomes for snapshot visibility, ordering, and reserve/debit/release semantics.

## Verification Performed

- `corepack pnpm --filter @lottery/web build` (passed)
- `corepack pnpm smoke` (passed)
- `Select-String -Path docs/runbooks/wallet-verification.md -Pattern "Wallet Lab|expected outcome|reserve|debit|release"` (matched expected sections)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `04-04` to add financial verification scenarios and operator notes for ledger debugging.

---
*Phase: 04-internal-ledger-and-wallet-views*  
*Completed: 2026-04-05*
