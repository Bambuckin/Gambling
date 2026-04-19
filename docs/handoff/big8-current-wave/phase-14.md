# Phase 14: Admin-Driven Draw Emulation, Result Closure, and Notifications

## Goal

Add a deterministic admin-controlled draw/result loop so purchased Big 8 tickets can resolve to win/loss without external integrations.

## Locked Decisions

- External result verification is not implemented in this wave.
- Admin marks each purchased ticket as `win` or `lose` after purchase and before draw closure.
- Draw closure is manual and done by admin.
- Unmarked tickets become `lose` on closure.
- Win amount is fixed at `50_000` minor units.
- User-facing result updates are in-app only.

## Required Implementation

1. Add admin result marking.
   - Admin can mark purchased tickets for a still-open draw as `win` or `lose`.
   - Mark must be editable until the draw is closed.

2. Add draw-close operation.
   - Admin closes a specific draw explicitly.
   - Close operation must be idempotent.
   - Closing resolves all tickets for that draw:
     - marked `win` -> winning result with fixed amount,
     - marked `lose` -> losing result,
     - unmarked -> losing result by default.

3. Persist resolution state.
   - Ticket record must carry enough state to distinguish:
     - purchased but unresolved,
     - admin-marked pre-close,
     - closed final result,
     - result source = admin-emulated.

4. Add user notifications.
   - Persist at least these notification types:
     - `purchase_success`
     - `draw_closed_result_ready`
     - `winning_actions_available`
   - Use the existing polling/live UI pattern. Do not add browser push.

## Likely Touch Points

- `packages/domain/src/ticket.ts`
- `packages/domain/src/draw.ts`
- `packages/application/src/services/ticket-verification-result-service.ts`
- `packages/application/src/services/ticket-verification-queue-service.ts`
- `packages/application/src/services/admin-operations-query-service.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/purchase/lottery-live-monitor.tsx`
- `apps/web/src/lib/purchase/admin-live-monitor.tsx`

## Acceptance Scenarios

- Admin can mark a purchased ticket as `win` or `lose` before draw closure.
- Admin closes a draw once and repeated close attempts do not duplicate effects.
- Unmarked tickets become `lose`.
- User sees result changes without page reload.
- Winning ticket receives the extra notification that actions are now available.

## Out Of Scope

- Real fetch from the official NLoto result source.
- Automatic draw closure on time.
- Any prediction or recommendation logic.
