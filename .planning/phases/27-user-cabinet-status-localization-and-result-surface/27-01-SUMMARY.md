# Phase 27 Plan 27-01 Summary

## Status

Implemented and validated on 2026-04-24.

## What Changed

- User cabinet request rows now render Russian presenter-shaped status/result labels, including bought, waiting-for-draw-close, win, no-win, canceled, and failed purchase states.
- Ticket rows now use a dedicated presenter contract with Russian status, outcome, payout label, and fulfillment eligibility fields.
- The cabinet API now returns presenter-shaped ticket rows instead of raw verification/result/source/claim fields.
- The lottery page ticket table no longer shows internal ticket IDs or the technical result source column.
- The visible request block no longer shows live-sync success narration; it only surfaces a warning when live refresh fails.
- The notification panel no longer shows polling success text, explanatory subtitles, raw type fallbacks, or extra ticket/draw reference IDs.
- Purchase, cancellation, and payout redirect messages no longer include internal request IDs or raw request states.
- The old unused `lottery-live-monitor.tsx` component was deleted because it still exposed raw `status` and `finalResult` strings.

## Files Touched

- `.planning/STATE.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/phases/27-user-cabinet-status-localization-and-result-surface/27-CONTEXT.md`
- `.planning/phases/27-user-cabinet-status-localization-and-result-surface/27-01-PLAN.md`
- `.planning/phases/27-user-cabinet-status-localization-and-result-surface/27-01-SUMMARY.md`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/app/api/lottery/[lotteryCode]/requests/route.ts`
- `apps/web/src/lib/purchase/lottery-live-cabinet.tsx`
- `apps/web/src/lib/purchase/lottery-live-monitor.tsx`
- `apps/web/src/lib/purchase/lottery-live-request-presenter.ts`
- `apps/web/src/lib/purchase/lottery-live-ticket-presenter.ts`
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx`
- `apps/web/src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts`
- `apps/web/src/lib/purchase/__tests__/lottery-live-ticket-presenter.test.ts`

## Validation

- `corepack pnpm --filter @lottery/web test -- src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts src/lib/purchase/__tests__/lottery-live-ticket-presenter.test.ts` passed.
- `corepack pnpm --filter @lottery/web typecheck` passed.

## Notes

- The focused Vitest command also picked up nearby existing web tests under the app test discovery pattern; all discovered tests passed.
- Manual browser smoke was not run in this pass because the user asked to finish the started work before moving to a new chat, and the relevant automated checks passed.

## Next Phase

Phase 28: Admin Encoding and Readability Cleanup.
