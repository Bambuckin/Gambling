# Phase 29 Plan 29-01 Summary

## Status

Implemented and validated on 2026-04-24.

## What Changed

- Admin draw closure is now one operator action in the UI: the separate `onSettleDraw` prop, client handler, server action, and standalone publication button were removed.
- The draw close confirmation and success message now state that closing publishes results to client screens immediately.
- The draw monitor now groups unfinished draws together and uses one close action for open draws and old closed canonical rows.
- Manual draw creation layout was changed from wrapping flex to a stable responsive grid with full-width controls, so the datetime input cannot overlap the submit button.
- `DrawClosureService.closeDraw()` now settles and publishes both open draws and legacy closed canonical draws.
- `DrawClosureService.settleDraw()` and its public input/result types were removed, so the separate settlement operator path is gone.
- Admin pending ticket status now reads as purchased and waiting for draw close, not waiting for a second publication step.
- Added focused coverage for completing an already-closed canonical draw through `closeDraw()`.

## Files Touched

- `.planning/phases/29-admin-draw-control-and-one-step-closure/29-CONTEXT.md`
- `.planning/phases/29-admin-draw-control-and-one-step-closure/29-01-PLAN.md`
- `.planning/phases/29-admin-draw-control-and-one-step-closure/29-01-SUMMARY.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/purchase/admin-draw-monitor.tsx`
- `apps/web/src/lib/purchase/admin-status-presenter.ts`
- `apps/web/src/lib/purchase/__tests__/admin-status-presenter.test.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/__tests__/draw-closure-service.test.ts`

## Validation

- `corepack pnpm --filter @lottery/application test -- src/__tests__/draw-closure-service.test.ts src/__tests__/ticket-query-service.test.ts` passed.
- `corepack pnpm --filter @lottery/application typecheck` passed.
- `corepack pnpm --filter @lottery/web test -- src/lib/purchase/__tests__/admin-status-presenter.test.ts` passed.
- `corepack pnpm --filter @lottery/web typecheck` passed.
- Targeted Node scan over admin page, admin draw monitor, and draw closure service found no removed `onSettleDraw`, `adminSettleDrawAction`, `.settleDraw(`, `handleSettle`, `closedDraws`, standalone `Опубликовать результат`, `SettleDraw`, or `alreadySettled` strings. Remaining `legacy` mentions are internal identifier names, not UI text or a separate operator action.

## Notes

- The application and web Vitest commands also discovered nearby existing tests under the current Vitest pattern; all discovered tests passed.
- Full browser/runtime smoke is still Phase 30 work.

## Next Phase

Phase 30: End-to-End UI/Mechanics Validation and Regression Hardening.
