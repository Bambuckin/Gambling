---
phase: 32
plan: 32-01
title: Admin runtime ledger and notification hotfix
status: completed
completed_at: "2026-04-24T17:32:13+05:00"
---

# Phase 32 Summary

## What Changed

- Moved admin native confirmation text for draw close, queue clear, runtime reset, and draw deletion to ASCII-safe Unicode escaped constants so browser dialogs no longer degrade into question marks.
- Changed the web runtime reset wiring so "reset whole runtime" clears draws and queue without restoring seed draw snapshots.
- Added admin user balance visibility with available/reserved ledger totals and manual credit/debit corrections through auditable ledger entries.
- Hardened draw close publishing so already-resolved winning tickets still trigger auto-credit and result notifications.
- Added an in-app push surface in the client cabinet for new win/lose and winning-credit notifications, with browser desktop notifications still used when permission is granted.
- Hardened terminal worker success classification for explicit `ticket_purchased` outcomes so reserve debit is not skipped because of raw terminal text classification.

## Files Changed

- `apps/web/src/lib/purchase/admin-draw-monitor.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/terminal-worker/src/main.ts`
- `packages/application/src/services/admin-manual-finance-service.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/__tests__/admin-manual-finance-service.test.ts`
- `packages/application/src/__tests__/draw-closure-service.test.ts`

## Validation

- `corepack pnpm --filter @lottery/application test -- src/__tests__/draw-closure-service.test.ts src/__tests__/admin-manual-finance-service.test.ts src/__tests__/admin-test-reset-service.test.ts src/__tests__/terminal-execution-attempt-service.test.ts src/__tests__/wallet-ledger-service.test.ts` - passed, 31 files / 171 tests.
- `corepack pnpm --filter @lottery/application typecheck` - passed.
- `corepack pnpm --filter @lottery/web test -- src/lib/purchase/__tests__/admin-status-presenter.test.ts src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts src/lib/purchase/__tests__/lottery-live-ticket-presenter.test.ts` - passed, 5 files / 18 tests.
- `corepack pnpm --filter @lottery/web typecheck` - passed.
- `corepack pnpm --filter @lottery/terminal-worker typecheck` - passed.
- `git diff --check` - passed with existing line-ending warnings only.
- Targeted Node scan found no mojibake markers or raw Cyrillic inside `window.confirm(...)` call arguments in touched runtime/UI files.

## Remaining Gaps

- Live browser/LAN smoke was not run in this local pass; use `docs/runbooks/current-working-contour-smoke.md`.
- Real terminal selector/session behavior still needs validation on the target terminal machine.
- If the dev server was already running with an old bundle, restart it before checking the fixed native confirm dialog.
