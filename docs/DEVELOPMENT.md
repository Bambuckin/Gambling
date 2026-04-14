# Development Guide

This document explains how to change the repository without breaking its boundaries.
It is meant to complement `docs/modules/boundary-catalog.md`, not replace it.

## Working Model

The repository is intentionally split into composition layers:

- runtime apps compose services and expose UI/HTTP surfaces;
- `packages/domain` owns pure state rules and value contracts;
- `packages/application` owns use-case orchestration and ports;
- `packages/infrastructure` owns concrete adapters and schema/bootstrap logic;
- worker-side terminal behavior stays deterministic and bound to lottery code.

If you find yourself adding business rules directly in a route file, page component, or worker loop, you are probably putting code in the wrong place.

## Where To Change What

### Login, identity, session, and access flow

- Web composition: `apps/web/src/lib/access/`
- Core use cases: `packages/application/src/services/access-service.ts`
- Domain contracts: `packages/domain/src/access.ts`, `packages/domain/src/access-audit.ts`
- Concrete stores: `packages/infrastructure/src/access/`, `packages/infrastructure/src/postgres/postgres-access-store.ts`

### Lottery catalog, registry visibility, and draw freshness

- Web composition: `apps/web/src/lib/registry/`, `apps/web/src/lib/draw/`
- Use cases: `packages/application/src/services/lottery-registry-service.ts`, `draw-refresh-service.ts`
- Domain contracts: `packages/domain/src/lottery-registry.ts`, `draw.ts`
- Seeds and persistence: `packages/infrastructure/src/seeds/default-lottery-catalog.ts`, `packages/infrastructure/src/postgres/postgres-registry-draw-store.ts`

### Wallet, reserve, debit, release, winnings

- Web reads: `apps/web/src/lib/ledger/`
- Use cases: `packages/application/src/services/wallet-ledger-service.ts`
- Domain rules: `packages/domain/src/ledger.ts`
- Storage: `packages/infrastructure/src/ledger/`, `packages/infrastructure/src/postgres/postgres-ledger-store.ts`

### Purchase drafting, request creation, queueing, and cancellation

- UI + server actions: `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- Web composition: `apps/web/src/lib/purchase/`
- Use cases: `purchase-draft-service.ts`, `purchase-request-service.ts`, `purchase-orchestration-service.ts`, `purchase-request-query-service.ts`
- Domain rules: `purchase-draft.ts`, `purchase-request.ts`, `request-state.ts`
- Storage: `packages/infrastructure/src/purchase/`

### Admin queue control and observability

- UI + server actions: `apps/web/src/app/admin/page.tsx`
- Web composition: `apps/web/src/lib/purchase/`, `apps/web/src/lib/observability/`, `apps/web/src/lib/terminal/`
- Use cases: `admin-queue-service.ts`, `admin-operations-query-service.ts`, `operations-audit-service.ts`, `operations-alert-service.ts`, `terminal-health-service.ts`

### Terminal execution, retries, and verification jobs

- Worker loop: `apps/terminal-worker/src/main.ts`
- Worker runtime: `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- Use cases: `purchase-execution-queue-service.ts`, `terminal-execution-attempt-service.ts`, `terminal-retry-service.ts`, `ticket-persistence-service.ts`, `ticket-verification-queue-service.ts`, `ticket-verification-result-service.ts`
- Domain rules: `terminal-attempt.ts`, `retry-policy.ts`, `ticket.ts`, `terminal-execution.ts`

### Big 8 terminal automation

- Live draw sync: `apps/terminal-worker/src/lib/big8-live-draw-provider.ts`
- Real add-to-cart automation: `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts`
- Mock payload receiver flow: `apps/terminal-worker/src/lib/big8-mock-terminal-handler.ts`
- UI form: `apps/web/src/lib/lottery-form/big8-purchase-form.tsx`
- Mock receiver projection: `apps/web/src/lib/purchase/mock-terminal-inbox.ts`

## Runtime Composition Hotspots

These files are the safest place to understand how services are wired together at runtime:

- `apps/web/src/lib/access/access-runtime.ts`
- `apps/web/src/lib/registry/registry-runtime.ts`
- `apps/web/src/lib/draw/draw-runtime.ts`
- `apps/web/src/lib/ledger/ledger-runtime.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/lib/observability/operations-runtime.ts`
- `apps/web/src/lib/terminal/terminal-runtime.ts`
- `apps/web/src/lib/runtime/postgres-runtime.ts`
- `apps/terminal-worker/src/lib/runtime/postgres-runtime.ts`

If behavior is wrong but the domain/application package looks correct, the bug is often in one of these composition files.

## Common Change Workflows

### Change a page or visual behavior

1. Start in `apps/web/src/app/`.
2. If the page needs new data, find the runtime composition file in `apps/web/src/lib/`.
3. If the data requires new business behavior, move the change into `packages/application`.
4. Only touch `packages/domain` if lifecycle rules or contracts change.

### Change purchase validation or quote logic

1. Inspect `packages/domain/src/purchase-draft.ts`.
2. Inspect `packages/application/src/services/purchase-draft-service.ts`.
3. Update the route action in `apps/web/src/app/lottery/[lotteryCode]/page.tsx` only if inputs/outputs changed.

### Change queue reservation or retry behavior

1. Inspect `packages/domain/src/request-state.ts`, `retry-policy.ts`, `terminal-attempt.ts`.
2. Inspect `packages/application/src/services/purchase-execution-queue-service.ts`, `terminal-execution-attempt-service.ts`, `terminal-retry-service.ts`.
3. Update `apps/terminal-worker/src/main.ts` only if orchestration order or polling cadence changed.

### Add or change a lottery

1. Read `docs/modules/lottery-handler-extension.md`.
2. Update registry metadata in `packages/infrastructure/src/seeds/default-lottery-catalog.ts` if seed behavior must change.
3. Update UI preset in `apps/web/src/lib/ui/lottery-presentation.ts` if visual treatment is required.
4. Update worker handler runtime if concrete automation exists.

### Change persistence or runtime config

1. Update `packages/infrastructure`.
2. Update `scripts/postgres-init-and-seed.ts` or `scripts/runtime-preflight.ts` if bootstrap/validation rules changed.
3. Update `docs/CONFIGURATION.md` and affected runbooks in the same change.

## Important Scripts

Run from repository root:

- `corepack pnpm dev:web`
- `corepack pnpm dev:worker`
- `corepack pnpm start:web`
- `corepack pnpm start:worker`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm runtime:preflight`
- `corepack pnpm db:init`
- `corepack pnpm db:seed`
- `corepack pnpm release:check`

LAN/operator wrappers live in `scripts/*.ps1` and are documented in `docs/runbooks/deployment-bootstrap.md`.

## Rules That Matter

- Do not bypass application services from route files.
- Do not mutate ledger, queue, request, or ticket stores directly from UI code.
- Do not add lottery-specific terminal selectors inside generic domain/application packages.
- Keep debug pages observational unless the route is explicitly an admin control surface.
- Keep terminal execution deterministic by lottery code; no generated automation from user input.
- Update docs when you change boundaries, startup flow, env surface, or operator procedure.

## Related Docs

- `docs/modules/boundary-catalog.md`
- `docs/API.md`
- `docs/CONFIGURATION.md`
- `docs/TESTING.md`
- `docs/runbooks/module-verification-matrix.md`
