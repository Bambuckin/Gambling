# Phase 17: User Cabinet Stats and Test Reset Tools - Summary

**Completed:** 2026-04-16
**Status:** Complete

## What Was Done

### Application Layer
- `UserCabinetStatsService` — cross-lottery cabinet aggregates:
  - `getCabinetSummary()`: balance, total stakes, total winnings, net result, total tickets, winning tickets count.
  - `getCabinetTickets()`: filtered ticket list by lottery, status (winning/losing/claimed), period.
- `AdminTestResetService`:
  - `clearQueue()`: removes queued items, releases reserves for queued requests. Only valid when terminal idle.
  - `resetTestData()`: clears all runtime data (requests, queue, tickets, ledger, notifications, draw closures, cash desk, credit jobs, sessions). Preserves identities, catalog, and config.
- Extended 8 store ports with `clearAll()`: PurchaseRequestStore, PurchaseQueueStore, TicketStore, LedgerStore, NotificationStore, DrawClosureStore, CashDeskRequestStore, WinningsCreditJobStore.
- Extended SessionStore with `revokeAll(revokedAt)`.

### Infrastructure Layer
- `clearAll()` added to all in-memory stores (resets internal arrays/maps).
- `revokeAll()` added to InMemorySessionStore (marks all sessions revoked).
- Stub `clearAll()` / `revokeAll()` added to Postgres stores (throws "not implemented").

### Web Layer
- `purchase-runtime.ts`: `getUserCabinetStatsService()`, `getAdminTestResetService()` factories.
- `access-runtime.ts`: `getSessionStoreInstance()` for shared session store access.
- Lottery page: cabinet stats mini-grid (total tickets, winning, stakes, winnings, net result).
- Admin page:
  - Operational Summary mini-grid (queue depth, executing, cash desk pending, credit jobs pending, terminal state).
  - Danger Zone section with «Очистить очередь» and «Сбросить тестовые данные» buttons.
  - Both actions gated by terminal idle check.

## Verification

- `corepack pnpm --filter @lottery/domain test` — 61 tests passed
- `corepack pnpm --filter @lottery/application test` — 115 tests passed (5 new cabinet stats tests)
- `corepack pnpm --filter @lottery/web build` — clean
- Pre-existing typecheck errors in `apps/terminal-worker/src/main.ts` (unrelated).

## Files Changed

### New Files
- `packages/application/src/services/user-cabinet-stats-service.ts`
- `packages/application/src/services/admin-test-reset-service.ts`
- `packages/application/src/__tests__/user-cabinet-stats-service.test.ts`

### Modified Files
- `packages/application/src/ports/purchase-request-store.ts` — clearAll
- `packages/application/src/ports/purchase-queue-store.ts` — clearAll
- `packages/application/src/ports/ticket-store.ts` — clearAll
- `packages/application/src/ports/ledger-store.ts` — clearAll
- `packages/application/src/ports/notification-store.ts` — clearAll
- `packages/application/src/ports/draw-closure-store.ts` — clearAll
- `packages/application/src/ports/cash-desk-request-store.ts` — clearAll
- `packages/application/src/ports/winnings-credit-job-store.ts` — clearAll
- `packages/application/src/ports/session-store.ts` — revokeAll
- `packages/application/src/index.ts` — new exports
- All 8 in-memory store implementations — clearAll
- `packages/infrastructure/src/access/in-memory-session-store.ts` — revokeAll
- Postgres store implementations — stub clearAll/revokeAll
- `apps/web/src/lib/access/access-runtime.ts` — getSessionStoreInstance
- `apps/web/src/lib/purchase/purchase-runtime.ts` — getUserCabinetStatsService, getAdminTestResetService
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` — cabinet stats section
- `apps/web/src/app/admin/page.tsx` — operational summary, danger zone, server actions

## Big 8 Wave Complete

All 17 phases of the Big 8 working-contour wave are now delivered:

| Phase | Description |
|-------|-------------|
| 1-9 | Foundation, access, registry, ledger, purchase, terminal, tickets, admin, hardening |
| 10-11 | Big 8 live draw sync and cart execution |
| 13 | Purchase completion and login UX |
| 14 | Admin draw emulation and notifications |
| 15 | Winning actions (credit + cash desk) |
| 16 | Admin user management and manual finance |
| 17 | User cabinet stats and test reset tools |

---

*Phase: 17-user-cabinet-stats-and-test-reset-tools*
*Summary created: 2026-04-16*
