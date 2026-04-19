# Canonical Storage Migration

## Scope

Phase 19 makes canonical `purchase`, `draw`, and `purchase_attempt` storage usable without cutting the live Big 8 runtime over to it yet.

This runbook exists so additive coexistence stays explicit instead of living in assumptions.

## What Is Canonical In Phase 19

- `lottery_purchases` stores canonical purchase lifecycle, result status, and result visibility.
- `lottery_draws` stores canonical draw lifecycle.
- `lottery_purchase_attempts` stores durable terminal attempt history.
- Runtime wiring exposes canonical stores in both `postgres` and `in-memory` modes.

## What Stays Legacy In Phase 19

- `purchase_request` remains the live submit/queue write model.
- `ticket`, `ticket_verification_job`, and `draw_closure` remain active compatibility write models.
- TTL terminal execution lock remains active.
- Queue transport does not move to `pg-boss` in this phase.

Do not remove or rename those models in this phase.

## Compatibility Projection Rules

- `PurchaseRequestQueryService` overlays canonical purchase status and canonical attempt counts onto legacy request rows when canonical truth exists.
- `PurchaseRequestQueryService` emits synthetic request rows for canonical purchases that do not yet have legacy request records.
- `TicketQueryService` emits synthetic compatibility tickets for canonical purchases that have reached the purchased contour but do not yet have legacy ticket rows.
- `AdminOperationsQueryService` projects canonical problem states into the current admin problem-request view without changing the UI contract shape.
- When canonical attempt data exists, compatibility projections prefer canonical attempt counts over legacy queue counters.

These projections are migration seams, not the final cutover. User/admin routes still consume the same read shapes as before.

## Startup And Reset Safety

- Additive schema means canonical tables are created beside legacy tables; startup must not expect destructive rewrites.
- `AdminTestResetService.resetTestData()` now clears canonical purchases, draws, and attempts together with the legacy runtime stores.
- `AdminTestResetService.clearQueue()` still works on the legacy active contour and does not try to rewrite canonical execution history.
- Local `in-memory` runtime exposes the same canonical storage seams as Postgres so tests and debug flows do not diverge.

## Backfill And Replay Constraints

- Do not mutate legacy rows in place to “pretend” canonical history existed.
- Do not delete legacy rows after copying them into canonical tables.
- Any backfill or replay must be idempotent by canonical identifiers and safe to rerun.
- Until worker cutover lands, a canonical row may coexist with its legacy request/ticket counterpart; compatibility projections are expected to reconcile that overlap.

## Safe Verification Commands

- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

If one of these fails after canonical-storage changes, stop and fix the compatibility contour before moving to worker cutover.
