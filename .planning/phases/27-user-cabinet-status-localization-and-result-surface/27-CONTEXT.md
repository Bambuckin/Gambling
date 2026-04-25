# Phase 27 Context: User Cabinet Status Localization and Result Surface

## Why This Phase Exists

Phase 26 cleaned the purchase contour, but the user cabinet still leaks service chatter and internal fallback values into the visible screen. The page still shows live-sync helper text, notification helper copy, internal ticket identifiers, and some request or ticket labels can still fall back to backend-facing strings when a state is not mapped explicitly.

This phase is not a cosmetic-only pass. The cabinet must stay live while the visible request, ticket, result, and payout states become Russian-first and cashier-readable.

## Scope Locked In

1. All visible request, ticket, result, and payout statuses must be rendered in Russian.
2. The cabinet must not fall back to raw backend `status`, `finalResult`, `claimState`, `resultSource`, or notification `type` strings in the visible UI.
3. Low-value helper copy and service-status narration should be removed from the user cabinet when it only explains background polling or push mechanics.
4. Internal identifiers should stay in hidden mechanics only; user-facing tables and notifications should not expose request or ticket IDs unless the cashier needs them.
5. Live polling for requests, tickets, wallet, draw facts, and notifications must remain intact.

## Concrete UI Changes

1. Request rows should show honest cashier-facing states such as queued, buying, bought, waiting for draw close, win, no win, canceled, or failed purchase.
2. Ticket rows should show that a bought ticket is already bought before draw closure instead of looking like a vague pending pre-purchase state.
3. The cabinet should stop showing live-sync success banners and explanatory subtitles that only narrate background behavior.
4. The ticket table should drop user-visible internal identifiers and other low-value technical columns if they do not help the cashier act.
5. Notification badges and labels must stay Russian-only and should not expose raw type codes or extra reference IDs.

## Files Most Likely Involved

- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/app/api/lottery/[lotteryCode]/requests/route.ts`
- `apps/web/src/lib/purchase/lottery-live-cabinet.tsx`
- `apps/web/src/lib/purchase/lottery-live-request-presenter.ts`
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/ticket-query-service.ts`

## Acceptance Criteria

1. User-facing request, ticket, result, and payout labels are Russian-only.
2. No raw backend `status`, `finalResult`, `claimState`, `resultSource`, or notification `type` strings leak into the visible cabinet.
3. The request and notification blocks no longer show low-value live-sync or push-helper narration.
4. The ticket and notification views stop exposing internal IDs where they are not needed for the cashier.
5. Live cabinet polling still updates requests, tickets, wallet facts, and notifications without manual reload.

## Validation Plan

1. Focused web presenter tests for request and ticket localization.
2. `@lottery/web` typecheck.
3. Manual check of the user cabinet contour if the local runtime is available.
