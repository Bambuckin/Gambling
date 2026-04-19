# Canonical Storage Migration

## Scope

Phases 19-20 make canonical `purchase`, `draw`, and `purchase_attempt` storage usable and cut submit/worker execution over to canonical purchase truth without breaking the live Big 8 contour.

This runbook exists so additive coexistence stays explicit instead of living in assumptions.

## What Is Canonical In Phase 20

- `lottery_purchases` stores canonical purchase submission, queue, processing, failure, purchase, and cancel lifecycle.
- `lottery_purchase_attempts` stores durable terminal attempt history and replay keys for worker re-entry.
- Submit confirmation creates or reuses canonical purchase state before legacy queue/request compatibility mirrors are updated.
- Worker reservation and attempt recording advance canonical purchase truth before compatibility queue, request, and ticket side effects.
- `lottery_draws` remains the additive canonical draw store, but draw close/settle publication is not cut over in this phase.
- Runtime wiring exposes canonical stores in both `postgres` and `in-memory` modes.

## What Stays Legacy In Phase 20

- `purchase_request` and the legacy queue table remain active compatibility mirrors for current web/admin/worker flows.
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
- When canonical attempt data does not exist yet but an item is still executing, compatibility projections must not lose the in-flight queue attempt count.

These projections are migration seams, not the final cutover. User/admin routes still consume the same read shapes as before.

## Startup And Reset Safety

- Additive schema means canonical tables are created beside legacy tables; startup must not expect destructive rewrites.
- `AdminTestResetService.resetTestData()` now clears canonical purchases, draws, and attempts together with the legacy runtime stores.
- `AdminTestResetService.clearQueue()` still works on the legacy active contour and does not try to rewrite canonical execution history.
- Local `in-memory` runtime exposes the same canonical storage seams as Postgres so tests and debug flows do not diverge.

## Backfill And Replay Constraints

- Do not mutate legacy rows in place to "pretend" canonical history existed.
- Do not delete legacy rows after copying them into canonical tables.
- Any backfill or replay must be idempotent by canonical purchase and attempt identifiers and safe to rerun.
- Replaying the same terminal attempt must reuse the durable canonical attempt record and must not duplicate compatibility tickets or queue mutations.
- Recovered executing queue items may be repaired from canonical outcome state, but TTL lock semantics still own exclusivity in this phase.

## Safe Verification Commands

- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/application typecheck`
- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/web typecheck`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

If one of these fails after canonical-storage changes, stop and fix the compatibility contour before starting Phase 21 draw/result cutover work.
