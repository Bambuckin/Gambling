# Phase 15: Winning Actions, Credit, and Cash Desk - Summary

**Completed:** 2026-04-16
**Status:** Complete

## What Was Done

### Domain Layer
- Added `TicketClaimState` with five states: `unclaimed`, `credit_pending`, `credited`, `cash_desk_pending`, `cash_desk_paid`.
- Added `CashDeskRequest` type with `pending → paid` lifecycle and `createCashDeskRequest` / `markCashDeskRequestPaid` functions.
- Added `WinningsCreditJob` type with `pending → processing → completed → failed` lifecycle and `createWinningsCreditJob` / `completeWinningsCreditJob` / `failWinningsCreditJob` functions.
- All domain functions enforce idempotency and state guards.

### Application Layer
- `TicketClaimService` — enforces mutually exclusive claim path selection; transitions ticket claim state.
- `CashDeskService` — creates cash-desk requests, marks them paid, queries by status.
- `WinningsCreditService` — enqueues credit jobs, processes next job when queue is idle, writes ledger credit on completion.
- Two new ports: `CashDeskRequestStore`, `WinningsCreditJobStore`.
- `TicketQueryService.TicketView` now includes `claimState`.
- `TicketPersistenceService` now emits `purchase_success` notification on ticket creation.

### Infrastructure Layer
- `InMemoryCashDeskRequestStore` — in-memory implementation.
- `InMemoryWinningsCreditJobStore` — in-memory implementation.

### Web Layer
- `purchase-runtime.ts` — all new services wired into the DI container.
- Lottery page (`/lottery/[lotteryCode]`):
  - Winning tickets show «Зачислить на баланс» and «Получить в кассе» buttons.
  - `claimState` column visible in ticket table.
  - Actions are mutually exclusive — once chosen, the other is disabled.
- Admin page (`/admin`):
  - Cash Desk Requests table with status and «Mark Paid» button.
  - Credit Jobs table with status tracking.

## Verification

- `corepack pnpm --filter @lottery/domain test` — 49 tests passed
- `corepack pnpm --filter @lottery/application test` — 92 tests passed
- `corepack pnpm --filter @lottery/web build` — clean
- Pre-existing typecheck errors in `apps/terminal-worker/src/main.ts` (unrelated).

## Known Gaps / Deferred

- `WinningsCreditService.processNextCreditJob()` is not yet wired into the worker idle-loop. Currently only `enqueueCreditJob` is called from the web route. Processing should be triggered when the purchase queue is empty — this can be done in Phase 16 or as a micro-task.
- All stores are in-memory; no persistent storage for cash-desk requests or credit jobs yet.

## Files Changed

### New Files
- `packages/domain/src/cash-desk.ts`
- `packages/application/src/ports/cash-desk-request-store.ts`
- `packages/application/src/ports/winnings-credit-job-store.ts`
- `packages/application/src/services/ticket-claim-service.ts`
- `packages/application/src/services/cash-desk-service.ts`
- `packages/application/src/services/winnings-credit-service.ts`
- `packages/infrastructure/src/purchase/in-memory-cash-desk-request-store.ts`
- `packages/infrastructure/src/purchase/in-memory-winnings-credit-job-store.ts`

### Modified Files
- `packages/domain/src/ticket.ts` — `TicketClaimState`, `claimState` field
- `packages/domain/src/index.ts` — new exports
- `packages/application/src/services/ticket-query-service.ts` — `claimState` in TicketView
- `packages/application/src/services/ticket-persistence-service.ts` — notification emission
- `packages/application/src/index.ts` — new exports
- `packages/infrastructure/src/index.ts` — new exports
- `apps/web/src/lib/purchase/purchase-runtime.ts` — new service wiring
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` — claim buttons, claimState column
- `apps/web/src/app/admin/page.tsx` — cash-desk and credit jobs tables

---

*Phase: 15-winning-actions-credit-and-cash-desk*
*Summary created: 2026-04-16*
