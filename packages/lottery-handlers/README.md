# @lottery/lottery-handlers

Contracts and registry abstraction for deterministic lottery handlers.

## Important Clarification

This package currently defines handler contracts and a purchase-handler registry helper.
Concrete Big 8 automation handlers currently live in `apps/terminal-worker/src/lib/`, not in this package.

That means:

- this package is the contract layer;
- worker runtime is the concrete execution layer today.

## Files

- `src/contracts.ts`
  - purchase context/result contract
  - result verification context/result contract
- `src/registry.ts`
  - purchase-handler registry creation
  - duplicate binding protection
- `src/index.ts`
  - public exports

## What A Handler Must Provide

- `contractVersion: "v1"`
- stable `lotteryCode`
- stable `bindingKey`
- `purchase(context)`
- `verify(context)` for result handlers

See `docs/modules/lottery-handler-extension.md` for the full change workflow.

## Current Architectural Limitation

Because concrete handlers are still worker-local, a future refactor may move reusable concrete handlers into this package.
Until then, treat this package as the stable contract boundary only.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/lottery-handlers typecheck
```

## Related Docs

- `docs/modules/lottery-handler-extension.md`
- `apps/terminal-worker/README.md`
