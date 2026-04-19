# Phase 20 - Plan 01 Summary

**Status:** Complete

## Result

- Cut submit and cancel flow over to canonical `purchase` lifecycle while keeping legacy request and queue rows as compatibility mirrors for the current Big 8 contour.
- Cut worker reservation, terminal attempt recording, retry/final failure handling, and cart-stage completion over to canonical `purchase` plus durable `purchase_attempt` truth.
- Added replay-safe recovery around canonical attempt history so repeated worker results do not duplicate queue mutations or compatibility ticket creation.
- Kept current request and admin read surfaces truthful during the cutover by reconciling canonical attempt state with in-flight legacy queue counters.
- Updated the migration runbook to state the exact Phase 20 boundary: canonical submit/worker truth is live, while legacy `ticket`, verification jobs, TTL lock, and queue transport still remain in place.

## Verification

- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/application typecheck`
- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/web typecheck`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

## Notes

- Phase 20 did not remove legacy `ticket`, verification jobs, TTL lock, or legacy write models.
- Queue transport did not move to `pg-boss`.
- Phase 21 has not been started.
