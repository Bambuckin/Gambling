# Phase 25 Summary: Legacy Write-Model Dependency Demoted and Final Regression Validation

## Outcome

Plan 25-02 is complete. Phase 25 is complete.

The active Big 8 and winnings contour no longer depends on legacy ticket writes as an operational truth source:

- worker-side purchase success publishing can complete without inserting a `lottery_tickets` row;
- user/admin read surfaces, draw settlement, and winnings fulfillment can project canonical purchases even when no legacy ticket row exists;
- remaining legacy request/ticket storage is now compatibility residue rather than the active runtime truth;
- parity-focused regression checks and typechecks pass for the current canonical-first contour.

## Delivered Changes

### Canonical-first ticket and winnings contour

- Kept `apps/terminal-worker/src/main.ts` on `persistLegacyTicket: false`, so the active worker purchase path stops writing legacy ticket rows by default.
- Propagated canonical ticket ids through `packages/application/src/services/terminal-execution-attempt-service.ts` and `packages/application/src/services/purchase-completion-service.ts` without relying on optional `undefined` writes that break strict typing.
- Extended `packages/application/src/services/ticket-persistence-service.ts` so purchase success can be replay-safe even when only the notification surface is persisted.
- Reworked canonical fallbacks in `packages/application/src/services/ticket-query-service.ts`, `draw-closure-service.ts`, `winning-fulfillment-service.ts`, and `winnings-credit-service.ts` so result visibility, claim state, and payout actions still work without a legacy ticket row.

### Compatibility demotion and runtime honesty

- Left `packages/infrastructure/src/postgres/postgres-purchase-store.ts` and `packages/infrastructure/src/postgres/postgres-schema.ts` aligned with the advisory-lock/transport seam while treating remaining legacy ticket storage as compatibility residue, not active truth.
- Updated `docs/handoff-runtime.md` so the handoff no longer claims the active contour depends on legacy write-model storage.

## Files of Record

- `apps/terminal-worker/src/main.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/application/src/services/purchase-completion-service.ts`
- `packages/application/src/services/ticket-persistence-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/services/winning-fulfillment-service.ts`
- `packages/application/src/services/winnings-credit-service.ts`
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts`
- `packages/infrastructure/src/postgres/postgres-schema.ts`
- `docs/handoff-runtime.md`

## Validation

Executed during 25-02:

```powershell
corepack pnpm --filter @lottery/application test -- terminal-execution-attempt-service ticket-persistence-service winning-fulfillment-service winnings-credit-service ticket-query-service draw-closure-service purchase-request-query-service
corepack pnpm --filter @lottery/application typecheck
corepack pnpm --filter @lottery/infrastructure typecheck
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/terminal-worker typecheck
```

Observed result:

- the `@lottery/application` suite again resolved to the current full package run and all `159/159` tests passed;
- `@lottery/application`, `@lottery/infrastructure`, `@lottery/web`, and `@lottery/terminal-worker` typechecks passed;
- the remaining issue found during execution was a strict optional-property typing mismatch around canonical `ticketId`, and it is now fixed.

## Remaining Risk

1. NLoto selector/session hardening still needs live smoke on the target LAN terminal machine.
2. Compatibility tables still physically exist; removing them destructively should be done in a deliberate migration window, not mixed into the active runtime cutover.
