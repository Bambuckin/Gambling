---
phase: 33
plan: 33-01
title: Reserve reconciliation and client push hotfix
status: completed
completed_at: "2026-04-24T18:09:22+05:00"
---

# Phase 33 Summary

## What Changed

- Added `PurchaseOrchestrationService.reconcileDetachedReserves()` to repair stale reserved funds when a request is no longer in the active queue.
- Wired the existing client live recovery helper to run reserve reconciliation before wallet snapshots are read.
- Detached purchased requests now get an auditable reserve `debit`; detached non-purchased requests get an auditable reserve `release` and move to `reserve_released` when the domain transition allows it.
- Client notification monitor now shows an unread win/lose or winnings notification as an in-app push even if that notification already existed before the component mounted.
- Removed mojibake from touched client live labels and notification/result presenter strings.
- Replaced draw-close result notification text with readable Russian text generated from escaped source strings.
- Hardened Postgres ledger append idempotency for concurrent reconciliation writes by using `on conflict do nothing` plus payload compatibility validation.

## Files Changed

- `packages/application/src/services/purchase-orchestration-service.ts`
- `packages/application/src/__tests__/purchase-orchestration-service.test.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx`
- `apps/web/src/lib/purchase/lottery-live-cabinet.tsx`
- `apps/web/src/lib/purchase/lottery-live-request-presenter.ts`
- `apps/web/src/lib/purchase/lottery-live-ticket-presenter.ts`
- `apps/web/src/lib/purchase/__tests__/lottery-notification-monitor.test.ts`
- `apps/web/src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts`
- `apps/web/src/lib/purchase/__tests__/lottery-live-ticket-presenter.test.ts`
- `packages/infrastructure/src/postgres/postgres-ledger-store.ts`

## Validation

- `corepack pnpm --filter @lottery/application test -- src/__tests__/purchase-orchestration-service.test.ts src/__tests__/terminal-execution-attempt-service.test.ts src/__tests__/wallet-ledger-service.test.ts src/__tests__/draw-closure-service.test.ts` - passed, 31 files / 173 tests.
- `corepack pnpm --filter @lottery/web test -- src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts src/lib/purchase/__tests__/lottery-live-ticket-presenter.test.ts src/lib/purchase/__tests__/lottery-notification-monitor.test.ts` - passed, 6 files / 21 tests.
- `corepack pnpm --filter @lottery/application typecheck` - passed.
- `corepack pnpm --filter @lottery/web typecheck` - passed.
- `corepack pnpm --filter @lottery/infrastructure typecheck` - passed.
- `corepack pnpm --filter @lottery/terminal-worker typecheck` - passed.
- `git diff --check` - passed with existing line-ending warnings only.
- Targeted Node encoding scan found no `????`, replacement characters, or common mojibake markers in touched runtime/UI files.

## Remaining Gaps

- Live browser/LAN smoke was not run in this local pass.
- The real terminal machine still needs a manual purchase -> close draw -> push notification smoke check.
