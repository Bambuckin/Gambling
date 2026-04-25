# Phase 28 Plan 28-01 Summary

## Status

Implemented and validated on 2026-04-24.

## What Changed

- Added a dedicated admin status presenter for terminal, queue, receiver, cash-desk, winnings-credit, alert, audit, draw, verification, mark, and ticket-outcome labels.
- Replaced admin page local status formatters with presenter calls so unknown states use safe Russian fallback labels instead of raw backend values.
- Replaced alert/audit display labels with Russian operator-facing text, including Russian audit domain/action/target/reference labels.
- Removed broken draw monitor `????` close/publish messages and replaced visible `settlement` / `legacy` copy with Russian operator text.
- Draw monitor ticket status/result labels now use the shared presenter instead of local JSX-adjacent switches with raw fallback.
- Application query services were inspected and left as machine-state sources; UI localization stays at the web presenter boundary.

## Files Touched

- `.planning/phases/28-admin-encoding-and-readability-cleanup/28-CONTEXT.md`
- `.planning/phases/28-admin-encoding-and-readability-cleanup/28-01-PLAN.md`
- `.planning/phases/28-admin-encoding-and-readability-cleanup/28-01-SUMMARY.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/purchase/admin-draw-monitor.tsx`
- `apps/web/src/lib/purchase/admin-status-presenter.ts`
- `apps/web/src/lib/purchase/__tests__/admin-status-presenter.test.ts`

## Validation

- `corepack pnpm --filter @lottery/web test -- src/lib/purchase/__tests__/admin-status-presenter.test.ts` passed.
- `corepack pnpm --filter @lottery/web typecheck` passed.
- Targeted string scan over `apps/web/src/app/admin/page.tsx` and `apps/web/src/lib/purchase/admin-draw-monitor.tsx` found no visible `????`, `settlement`, `legacy`, `audit-`, or English `request=/user=/lottery=/terminal=/ledger=` labels. The remaining `draw={draw}` match is JSX prop syntax, not visible text.

## Notes

- The focused Vitest command also picked up nearby existing web tests under the current Vitest discovery pattern; all discovered tests passed.
- Phase 29 still owns the draw creation layout and one-step close/publish behavior. Phase 28 only made the current separate publication step readable in Russian.

## Next Phase

Phase 29: Admin Draw Control and One-Step Closure.
