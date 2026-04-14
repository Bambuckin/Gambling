# Testing Guide

This file is the truthful map of what can be verified automatically today and what still depends on manual runbooks.

## Current Reality

- `packages/domain` has real Vitest coverage for lifecycle and invariant logic.
- `packages/application` has the heaviest automated coverage in the repo.
- `packages/infrastructure` currently has narrow automated coverage around seed/catalog behavior.
- `apps/web` has typecheck/build coverage and a small UI-focused test surface.
- `apps/terminal-worker` has typecheck coverage but no real automated worker test suite yet.
- `packages/lottery-handlers` has typecheck coverage but no concrete automated handler tests yet.
- `packages/test-kit` contains useful fake helpers, but `corepack pnpm smoke` is still a scaffold command that prints `test-kit smoke scaffold ready`; it is not a real end-to-end assertion.

Treat manual runbooks as first-class verification, not as optional extras.

## Core Commands

### Workspace-wide

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm release:check
```

### Module-targeted

```powershell
corepack pnpm --filter @lottery/domain test
corepack pnpm --filter @lottery/application test
corepack pnpm --filter @lottery/infrastructure test
corepack pnpm --filter @lottery/web test
corepack pnpm --filter @lottery/web build
corepack pnpm --filter @lottery/terminal-worker typecheck
corepack pnpm --filter @lottery/lottery-handlers typecheck
corepack pnpm --filter @lottery/test-kit typecheck
corepack pnpm smoke
```

## Recommended Validation By Change Type

### Domain/state machine changes

Run:

- `corepack pnpm --filter @lottery/domain test`
- `corepack pnpm --filter @lottery/application test`

Why:

- domain rules are consumed heavily by application services; a pure domain pass is not enough.

### Purchase flow or queue orchestration changes

Run:

- `corepack pnpm --filter @lottery/application test -- purchase-draft-service purchase-request-service purchase-orchestration-service purchase-request-query-service`
- `corepack pnpm --filter @lottery/application test -- purchase-execution-queue-service terminal-execution-attempt-service terminal-retry-service`
- `corepack pnpm --filter @lottery/web build`

Then follow:

- `docs/runbooks/purchase-request-verification.md`
- `docs/runbooks/queue-incident-triage.md`

### Wallet, winnings, or ticket verification changes

Run:

- `corepack pnpm --filter @lottery/application test -- wallet-ledger-service ticket-persistence-service ticket-verification-queue-service ticket-verification-result-service ticket-query-service`
- `corepack pnpm --filter @lottery/web build`

Then follow:

- `docs/runbooks/wallet-verification.md`
- `docs/runbooks/ticket-persistence-verification.md`

### Registry, draw freshness, or admin operations changes

Run:

- `corepack pnpm --filter @lottery/application test -- lottery-registry-service draw-refresh-service admin-queue-service admin-operations-query-service operations-audit-service operations-alert-service terminal-health-service`
- `corepack pnpm --filter @lottery/web build`

Then follow:

- `docs/runbooks/registry-and-draw-verification.md`
- `docs/runbooks/admin-operations-console.md`

### Big 8 terminal automation or LAN receiver changes

Run:

- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/web build`
- `corepack pnpm smoke`

Then follow:

- `docs/runbooks/fake-terminal-smoke.md`
- `docs/runbooks/deployment-bootstrap.md`

Remember:

- `pnpm smoke` only confirms the scaffolded smoke command path today; the meaningful Big 8 validation is still the manual mock-terminal and runtime runbook flow.

## Automated Coverage Map

### `@lottery/domain`

Covers:

- request state transitions;
- retry policy;
- ledger invariants;
- purchase draft validation and quoting;
- ticket model behavior;
- terminal attempt normalization.

### `@lottery/application`

Covers:

- access/session flow;
- registry and draw refresh logic;
- wallet ledger orchestration;
- purchase draft/request/orchestration flow;
- queue reservation logic;
- terminal handler resolution;
- attempt result persistence;
- retry resolution;
- ticket persistence and verification result application;
- admin queue projection and operations alert/audit logic.

### `@lottery/infrastructure`

Current automated coverage is narrow.
Treat typecheck plus manual verification as required when you change persistence adapters or bootstrap behavior.

### `@lottery/web`

Current automated checks are:

- `vitest run` for small UI helper coverage;
- `next build` for route and server-action compilation;
- TypeScript compile through workspace typecheck.

### `@lottery/terminal-worker`

Current automated checks are:

- TypeScript compile only.

There is no meaningful worker runtime test suite yet.

## Manual Runbook Set

Use these when you need scenario validation rather than compilation:

- `docs/runbooks/local-bootstrap.md`
- `docs/runbooks/fake-terminal-smoke.md`
- `docs/runbooks/registry-and-draw-verification.md`
- `docs/runbooks/wallet-verification.md`
- `docs/runbooks/purchase-request-verification.md`
- `docs/runbooks/ticket-persistence-verification.md`
- `docs/runbooks/admin-operations-console.md`
- `docs/runbooks/regression-recipes.md`
- `docs/runbooks/release-readiness.md`

## Release Gate

Before calling a change release-ready, run:

```powershell
corepack pnpm release:check
```

That script is the repo-level release gate and should be the final validation step after targeted checks.
