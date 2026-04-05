# Module Verification Matrix

Use this matrix when you need targeted checks instead of full workspace verification.
Run commands from repository root: `C:\Users\11\Documents\Gambling`.

## Runtime Apps

### `apps/web`

- Purpose: user/admin UI routes, server actions, debug verification contours.
- Primary checks:
  - `corepack pnpm --filter @lottery/web typecheck`
  - `corepack pnpm --filter @lottery/web build`
- Quick triage:
  - route rendering/action regressions: `apps/web/src/app/**/*`
  - runtime composition drift: `apps/web/src/lib/**/*`

### `apps/terminal-worker`

- Purpose: queue polling, single-terminal lock flow, execution/verification processing.
- Primary checks:
  - `corepack pnpm --filter @lottery/terminal-worker typecheck`
- Quick triage:
  - reservation/polling flow: `apps/terminal-worker/src/main.ts`
  - handler runtime: `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`

## Shared Packages

### `packages/domain`

- Purpose: core contracts and lifecycle state rules.
- Primary checks:
  - `corepack pnpm --filter @lottery/domain test -- request-state-machine ledger-state-machine`
- Quick triage:
  - request lifecycle: `packages/domain/src/request-state.ts`
  - ledger invariants: `packages/domain/src/ledger.ts`

### `packages/application`

- Purpose: use-case orchestration, typed ports, read models, audit/alerts.
- Primary checks:
  - `corepack pnpm --filter @lottery/application test -- purchase-orchestration-service terminal-retry-service`
  - `corepack pnpm --filter @lottery/application test -- ticket-verification-result-service admin-queue-service operations-alert-service`
- Quick triage:
  - purchase lifecycle: `packages/application/src/services/purchase-orchestration-service.ts`
  - terminal flow: `packages/application/src/services/terminal-execution-attempt-service.ts`
  - verification + winnings: `packages/application/src/services/ticket-verification-result-service.ts`

### `packages/infrastructure`

- Purpose: concrete storage/audit adapter implementations.
- Primary checks:
  - `corepack pnpm --filter @lottery/infrastructure typecheck`
- Quick triage:
  - purchase stores: `packages/infrastructure/src/purchase/**/*`
  - audit stores: `packages/infrastructure/src/observability/**/*`

### `packages/lottery-handlers`

- Purpose: deterministic terminal handler contracts and registry exports.
- Primary checks:
  - `corepack pnpm --filter @lottery/lottery-handlers typecheck`
- Quick triage:
  - contracts: `packages/lottery-handlers/src/contracts.ts`
  - binding registry: `packages/lottery-handlers/src/registry.ts`

### `packages/test-kit`

- Purpose: fake terminal/handler path for smoke coverage.
- Primary checks:
  - `corepack pnpm --filter @lottery/test-kit typecheck`
  - `corepack pnpm smoke`
- Quick triage:
  - fake terminal behavior: `packages/test-kit/src/fake-terminal.ts`
  - smoke entrypoint: `packages/test-kit/src/smoke.ts`

## Cross-Module Notes

- Prefer targeted module commands first; run `corepack pnpm release:check` before release sign-off.
- If module checks pass but scenario still fails, continue with `docs/runbooks/regression-recipes.md`.
