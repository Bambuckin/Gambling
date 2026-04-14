# Lottery Handler Extension Guide

Use this guide for adding or changing lottery handler bindings.
The target is deterministic behavior from registry metadata to terminal execution.

## Scope And Source Files

- Contracts: `packages/lottery-handlers/src/contracts.ts`
- Handler registry: `packages/lottery-handlers/src/registry.ts`
- Package exports: `packages/lottery-handlers/src/index.ts`
- Lottery metadata contract: `packages/domain/src/lottery-registry.ts`
- Boundary rules: `docs/modules/boundary-catalog.md`
- Operator procedure: `docs/runbooks/lottery-handler-change.md`

## Lifecycle Overview

1. Design precheck (IDs, compatibility, rollback intent).
2. Contract implementation (purchase + result handlers).
3. Registry and export wiring.
4. Verification (type, tests, smoke, admin visibility checks).
5. Operator rollout and post-rollout checks.

## 1) Design Precheck

Before code changes, lock these decisions:

- `lotteryCode`: stable identifier (`mechtallion`, `bolshaya-8`, etc).
- `purchaseBindingKey` and `resultBindingKey`: immutable keys used by worker resolution.
- Compatibility strategy:
  - additive change (new lottery code), or
  - replacement change (same code with new binding key).
- Rollback trigger:
  - explicit condition that forces reverting to previous binding key.

Do not proceed without a clear rollback condition.

## 2) Implement Contracts

Create/update handler module in `packages/lottery-handlers/src/`.

Required contracts:

- `LotteryPurchaseHandlerContract`
- `LotteryResultHandlerContract`

Required fields:

- `contractVersion: "v1"`
- `lotteryCode` matching registry entry
- stable `bindingKey`

Required methods:

- `purchase(context) => { externalTicketReference, rawTerminalOutput }`
- `verify(context) => { status, winningAmountMinor, rawTerminalOutput }`

Handler output must remain deterministic for the same input and must always return traceable `rawTerminalOutput`.

## 3) Wire Registry + Exports

1. Export handlers from `packages/lottery-handlers/src/index.ts`.
2. Register bindings in `packages/lottery-handlers/src/registry.ts`.
3. Ensure `LotteryRegistryEntry.handlers` uses exact binding keys:
   - `handlers.purchaseHandler = purchaseBindingKey`
   - `handlers.resultHandler = resultBindingKey`
4. Verify metadata consistency:
   - pricing schema and form schema remain valid for `lotteryCode`;
   - no duplicate binding keys for unrelated lotteries.

## 4) Verification Checklist (Developer Side)

Run in order:

```powershell
corepack pnpm --filter @lottery/lottery-handlers typecheck
corepack pnpm --filter @lottery/application test -- terminal-handler-resolver-service terminal-execution-attempt-service
corepack pnpm smoke
corepack pnpm --filter @lottery/web build
```

Expected outcomes:

- resolver maps `lotteryCode` to intended binding keys;
- attempt flow receives normalized output shape;
- smoke path stays green with fake terminal adapters;
- web build remains stable for lottery pages/admin views.

## 5) Rollout Notes (Operator Side)

After technical checks pass, run operational rollout using:

- `docs/runbooks/lottery-handler-change.md`

This includes:

- preflight checks,
- staged rollout verification in `/admin` and `/debug/admin-ops-lab`,
- rollback conditions and execution path.

## Hard Rules

- No UI/session logic in handler modules.
- No runtime-generated terminal code from user input.
- No direct ledger mutations inside handler code.
- No direct store mutations from handler code.
- All terminal outputs must remain traceable through `rawTerminalOutput`.
