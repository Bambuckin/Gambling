# Phase 14: Admin-Driven Draw Emulation and Notifications - Summary

**Executed:** 2026-04-16
**Status:** Complete

## What Was Done

Single plan `14-01` covering the full admin-driven draw/result loop:

### Domain (packages/domain)
- Extended `TicketRecord` with `adminResultMark`, `adminResultMarkedBy`, `adminResultMarkedAt`, `resultSource` fields
- Added `setTicketAdminResultMark()` — marks pending ticket as win/lose before draw close
- Added `resolveTicketFromAdminMark()` — resolves ticket from admin mark or defaults to lose
- Added `DrawClosureRecord` with `open|closed` status, `closeDrawClosure()`, `isDrawClosed()`
- Added `ADMIN_EMULATED_WIN_AMOUNT_MINOR = 50_000` constant (500 RUB)
- Added `NotificationRecord` domain type with `purchase_success`, `draw_closed_result_ready`, `winning_actions_available` types
- 49 domain tests (7 new for admin result mark + resolve)

### Application (packages/application)
- New port: `DrawClosureStore` (getClosure, saveClosure, listClosures)
- New port: `NotificationStore` (save, list, getById, markRead)
- New service: `DrawClosureService` — markTicketResult, closeDraw (idempotent), resolve unresolved as lose, generate notifications
- New service: `NotificationService` — listUserNotifications, getNotificationBadge (unreadCount + hasWinningActions), markAsRead
- Extended `TicketPersistenceService` — emits `purchase_success` notification on ticket creation
- Extended `TicketQueryService.TicketView` — added `resultSource`
- 92 application tests (all existing tests updated for notificationStore dependency)

### Infrastructure (packages/infrastructure)
- `InMemoryDrawClosureStore` — in-memory draw closure tracking
- `InMemoryNotificationStore` — in-memory notification persistence

### Web (apps/web)
- New API route: `GET /api/admin/draws` — lists open draws with pending tickets
- New API route: `GET /api/lottery/[lotteryCode]/notifications` — user notifications + badge
- New client component: `AdminDrawMonitor` — live admin draw management with mark/close
- New client component: `LotteryNotificationMonitor` — live notification display with badge
- Admin page: integrated `AdminDrawMonitor` with server actions for mark/close
- Lottery page: integrated `LotteryNotificationMonitor`, ticket table shows `resultSource`

### Worker (apps/terminal-worker)
- Updated `TicketPersistenceService` construction to include `notificationStore`

## Deviations

None. Implementation follows the execution brief exactly.

## Acceptance Scenarios Verified

1. Admin can mark a purchased ticket as `win` or `lose` before draw closure — via AdminDrawMonitor
2. Admin closes a draw once and repeated close attempts do not duplicate effects — idempotent via `isDrawClosed` check
3. Unmarked tickets become `lose` — via `resolveTicketFromAdminMark` default
4. User sees result changes without page reload — via polling `LotteryNotificationMonitor` (3s interval)
5. Winning ticket receives extra `winning_actions_available` notification — generated in `buildTicketNotifications`

## Verification

- `corepack pnpm --filter @lottery/domain test` — 49 passed
- `corepack pnpm --filter @lottery/application test` — 92 passed
- `corepack pnpm --filter @lottery/web build` — clean
- `corepack pnpm typecheck` — only pre-existing terminal-worker errors (unrelated)
