# Phase 25 Summary: Direct Big 8 Purchase Cutover and Regression Hardening

## Outcome

Plan 25-01 is complete. Phase 25 remains in progress.

The active Big 8 contour is now truthful and locally validated:

- real `bolshaya-8` worker execution now continues past cart staging into a terminal-backed purchased outcome;
- draw close, settlement, and user notifications stay on the existing canonical path without a route rewrite;
- post-cart emulation is no longer the active Big 8 truth path and remains only as compatibility behavior for lotteries that still declare `purchaseCompletionMode=emulate_after_cart`;
- mock/manual smoke and portable LAN receiver contours remain usable.

## Delivered Changes

### Truthful terminal purchase cutover

- Extended `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts` so the real Big 8 handler now opens checkout, confirms purchase, and returns `executionOutcome=ticket_purchased`.
- Kept `apps/terminal-worker/src/lib/terminal-handler-runtime.ts` backward-compatible while preferring `LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED` over the old cart flag alias.
- Restricted `apps/terminal-worker/src/main.ts` post-cart completion logic to explicit compatibility lotteries instead of treating it as the active Big 8 path.
- Switched `packages/infrastructure/src/seeds/default-lottery-catalog.ts` for `bolshaya-8` from `purchaseCompletionMode=emulate_after_cart` to `purchaseCompletionMode=direct`.

### Regression and operator-path hardening

- Revalidated the purchase/ticket/draw-close path through focused `@lottery/application` test runs; the current repo still resolves that command to the full application suite.
- Rebuilt the live web app and re-ran worker preflight so runtime wiring still composes after the cutover.
- Rebuilt LAN bundles and updated worker env templates/runbooks so operator instructions now prefer the new purchase automation flag and no longer claim Big 8 stops at cart stage.

## Files of Record

- `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- `apps/terminal-worker/src/main.ts`
- `packages/infrastructure/src/seeds/default-lottery-catalog.ts`
- `scripts/runtime-preflight.ts`
- `scripts/build-lan-bundles.ps1`
- `.env.example`
- `.env.worker`
- `ops/runtime/.env.worker.template`
- `apps/terminal-worker/README.md`
- `docs/CONFIGURATION.md`
- `docs/GETTING-STARTED.md`
- `docs/handoff-runtime.md`
- `docs/modules/current-working-contour.md`
- `docs/modules/big8-terminal-integration.md`
- `docs/runbooks/deployment-bootstrap.md`
- `docs/runbooks/launch-readiness-checklist.md`

## Validation

Executed during 25-01:

```powershell
corepack pnpm --filter @lottery/infrastructure test -- --runInBand default-lottery-catalog
corepack pnpm --filter @lottery/application test -- --runInBand terminal-execution-attempt-service purchase-completion-service draw-closure-service ticket-persistence-service
corepack pnpm --filter @lottery/application typecheck
corepack pnpm --filter @lottery/infrastructure typecheck
corepack pnpm --filter @lottery/terminal-worker typecheck
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/web build
corepack pnpm runtime:preflight:worker
corepack pnpm bundle:lan
```

Observed result:

- infrastructure seed test passed (`4/4`);
- the targeted application command again resolved to the current full `@lottery/application` suite and all `156/156` tests passed;
- application, infrastructure, terminal-worker, and web typechecks passed;
- `@lottery/web build` passed;
- worker runtime preflight passed against the current `.env`;
- LAN bundles rebuilt successfully, and the generated terminal receiver env now prefers `LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED=true`.

## Remaining Phase Scope

1. Legacy write-model storage still exists as a compatibility layer; full removal/decommission remains Phase 25 follow-up work.
2. NLoto selector/session hardening still needs target-LAN operator smoke on the real terminal machine.
