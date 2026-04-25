---
phase: 31
plan: 31-01
title: Draw close ledger and notification hotfix
status: completed
completed_at: "2026-04-24T17:05:54+05:00"
---

# Phase 31 Summary

## What Changed

- Replaced the broken admin draw close confirmation with readable Russian text and kept the draw close flow as one close-and-publish action.
- Set draw refresh/sync defaults to 5 seconds in the client Big 8 form, admin draw monitor, terminal worker, env example, and LAN bundle defaults.
- Made cart-stage completion debit reserved funds through `WalletLedgerService.debitReservedFunds()` after the purchased ticket is persisted.
- Wired draw close to enqueue and immediately process a winnings credit job for winning tickets.
- Updated close-result notifications so the client cabinet receives readable win/lose notifications and a credited-winning notification when auto-credit succeeds.

## Files Changed

- `apps/web/src/lib/purchase/admin-draw-monitor.tsx`
- `apps/web/src/lib/lottery-form/big8-purchase-form.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/terminal-worker/src/main.ts`
- `.env.example`
- `scripts/build-lan-bundles.ps1`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `packages/application/src/services/purchase-completion-service.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/services/winnings-credit-service.ts`
- `packages/application/src/__tests__/purchase-completion-service.test.ts`
- `packages/application/src/__tests__/draw-closure-service.test.ts`
- `packages/application/src/__tests__/winnings-credit-service.test.ts`

## Validation

- `corepack pnpm --filter @lottery/application test -- src/__tests__/draw-closure-service.test.ts src/__tests__/purchase-completion-service.test.ts src/__tests__/winnings-credit-service.test.ts src/__tests__/wallet-ledger-service.test.ts` - passed, 31 files / 169 tests.
- `corepack pnpm --filter @lottery/application typecheck` - passed.
- `corepack pnpm --filter @lottery/web test -- src/lib/purchase/__tests__/admin-status-presenter.test.ts src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts src/lib/purchase/__tests__/lottery-live-ticket-presenter.test.ts` - passed, 5 files / 18 tests.
- `corepack pnpm --filter @lottery/web typecheck` - passed.
- `corepack pnpm --filter @lottery/terminal-worker typecheck` - passed.
- `git diff --check` - passed with existing line-ending warnings only.
- Targeted text scan found no mojibake markers in the touched draw close/user form notification files.

## Remaining Gaps

- Live browser/LAN smoke was not run in this pass; use `docs/runbooks/current-working-contour-smoke.md`.
- Real terminal selector/session behavior still needs validation on the target terminal machine.
