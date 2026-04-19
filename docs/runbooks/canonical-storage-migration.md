# Canonical Storage Migration

## Scope

Phases 19-21 make canonical `purchase`, `draw`, and `purchase_attempt` storage usable, cut submit/worker execution over to canonical purchase truth, and cut draw result publication over to canonical settlement without breaking the live Big 8 contour.

This runbook exists so additive coexistence stays explicit instead of living in assumptions.

## What Is Canonical Through Phase 21

- `lottery_purchases` stores canonical purchase submission, queue, processing, failure, purchase, and cancel lifecycle.
- `lottery_purchase_attempts` stores durable terminal attempt history and replay keys for worker re-entry.
- Submit confirmation creates or reuses canonical purchase state before legacy queue/request compatibility mirrors are updated.
- Worker reservation and attempt recording advance canonical purchase truth before compatibility queue, request, and ticket side effects.
- `lottery_draws` stores canonical draw lifecycle with explicit `open -> closed -> settled` transitions.
- Admin draw actions now operate through canonical draw create, close, mark-result, and settle operations.
- Published win/lose visibility now follows canonical draw settlement and canonical purchase result visibility rather than legacy verification-job truth.
- Runtime wiring exposes canonical stores in both `postgres` and `in-memory` modes.

## What Stays Legacy Through Phase 21

- `purchase_request` and the legacy queue table remain active compatibility mirrors for current web/admin/worker flows.
- `ticket`, `ticket_verification_job`, and `draw_closure` remain active compatibility write models.
- `draw_closure` is now only a compatibility mirror for the old closure surface; canonical draw is the lifecycle truth.
- `ticket_verification_job` remains in place, but canonical-managed draws must not reopen already published results through the legacy verification queue.
- TTL terminal execution lock remains active.
- Queue transport does not move to `pg-boss` in this phase.
- Winnings credit and cash-desk fulfillment are still deferred to Phase 22.

Do not remove or rename those models in this phase.

## Compatibility Projection Rules

- `PurchaseRequestQueryService` overlays canonical purchase status and canonical attempt counts onto legacy request rows when canonical truth exists.
- `PurchaseRequestQueryService` emits synthetic request rows for canonical purchases that do not yet have legacy request records.
- `TicketQueryService` emits synthetic compatibility tickets for canonical purchases that have reached the purchased contour but do not yet have legacy ticket rows.
- `TicketQueryService` overlays canonical result visibility onto legacy ticket rows, so hidden canonical results stay hidden and settled canonical results become visible without waiting for legacy verification jobs.
- `AdminOperationsQueryService` projects canonical problem states into the current admin problem-request view without changing the UI contract shape.
- When canonical attempt data exists, compatibility projections prefer canonical attempt counts over legacy queue counters.
- When canonical attempt data does not exist yet but an item is still executing, compatibility projections must not lose the in-flight queue attempt count.
- `TicketVerificationQueueService` skips draws that already exist in canonical draw storage, so legacy verification jobs do not reopen canonical settlement outcomes.

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

If one of these fails after canonical-storage changes, stop and fix the compatibility contour before starting Phase 22 fulfillment rebase work.
