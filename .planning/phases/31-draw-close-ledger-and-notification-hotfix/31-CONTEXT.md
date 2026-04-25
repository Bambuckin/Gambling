# Phase 31: Draw Close, Ledger, and Notification Hotfix - Context

**Gathered:** 2026-04-24
**Status:** Ready for execution
**Source:** User runtime report with screenshot, Phase 30 summary, targeted code inspection

## Goal

Fix runtime defects found after the v1.2 automated pass:

- admin draw close confirmation shows mojibake;
- draw synchronization should run every 5 seconds;
- reserve must become a debit immediately after a successful purchase;
- winning tickets should credit the user balance immediately after draw close for now;
- the client cabinet should receive a readable notification for win/lose draw result.

## Acceptance Criteria

1. `window.confirm` text and draw admin UI touched in this phase render readable Russian text.
2. User draw selector, admin draw monitor, admin page refresh, and terminal-worker Big 8 draw sync default to 5 seconds.
3. Purchase completion paths debit reserved funds idempotently when a ticket becomes purchased.
4. Closing a draw with a winning ticket credits winnings immediately and updates ticket/read-model claim state to credited.
5. Closing a draw emits readable user notifications for both winning and losing tickets.
6. Targeted application/web tests and typechecks pass.

## Likely Files

- `apps/web/src/lib/purchase/admin-draw-monitor.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/lottery-form/big8-purchase-form.tsx`
- `apps/terminal-worker/src/main.ts`
- `.env.example`
- `packages/application/src/services/purchase-completion-service.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/services/winnings-credit-service.ts`
- `packages/application/src/__tests__/purchase-completion-service.test.ts`
- `packages/application/src/__tests__/draw-closure-service.test.ts`

## Constraints

- Do not revert existing v1.2 changes.
- Do not expose raw request/result/status strings in the user purchase UI.
- Do not hide broken text with CSS; replace or remove the broken strings in code.
- Keep the patch narrow and compatible with the current dirty worktree.
