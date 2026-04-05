# Lottery Handler Extension Guide

Use this guide when adding a new lottery to the system.
Do not bypass these contracts with ad-hoc terminal scripts.

## Contract Sources

- Handler contracts: `packages/lottery-handlers/src/contracts.ts`
- Registry shape: `packages/domain/src/lottery-registry.ts`
- Boundary catalog: `docs/modules/boundary-catalog.md`

## What a New Lottery Must Provide

1. A `LotteryPurchaseHandlerContract` implementation.
2. A `LotteryResultHandlerContract` implementation.
3. Registry metadata for the lottery code, title, pricing, and handler binding keys.
4. Local verification path using fake adapters or deterministic stubs.

## Step-by-Step

### 1. Pick stable identifiers

- Choose `lotteryCode` (for example `gosloto-6x45`).
- Choose explicit `bindingKey` values for purchase and result handlers.
- Keep keys stable across deploys to preserve replay/debug consistency.

### 2. Implement handler contracts

Create a module under `packages/lottery-handlers/src/` (for example `gosloto-6x45.ts`) that implements:

- `LotteryPurchaseHandlerContract`
- `LotteryResultHandlerContract`

Required fields:

- `contractVersion: "v1"`
- `lotteryCode: <same code used in registry>`
- `bindingKey: <stable handler id>`

Required methods:

- `purchase(context)` returns `{ externalTicketReference, rawTerminalOutput }`
- `verify(context)` returns `{ status, winningAmountMinor, rawTerminalOutput }`

### 3. Register exports

- Export the new handlers through `packages/lottery-handlers/src/index.ts`.
- Keep exports deterministic and explicit; avoid dynamic runtime registration.

### 4. Bind handlers in registry

Create/update the `LotteryRegistryEntry` source so:

- `handlers.purchaseHandler` equals purchase handler binding key.
- `handlers.resultHandler` equals result handler binding key.
- `pricing` and `formSchemaVersion` match the UI contract for that lottery.

### 5. Add verification

- Add or update a fake/stub path in `packages/test-kit` if needed.
- Run:
  - `corepack pnpm typecheck`
  - `corepack pnpm test`
  - `corepack pnpm smoke`

### 6. Update docs

- Update `docs/modules/boundary-catalog.md` if ownership boundaries changed.
- Update runbooks if operator actions or queue handling changed.

## Hard Rules

- No UI/session logic in handler modules.
- No runtime-generated terminal code from user input.
- No direct ledger mutations inside handler code.
- All terminal outputs must stay traceable (`rawTerminalOutput`).
