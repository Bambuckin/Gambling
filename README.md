# Lottery Terminal Operations System

Status: Phase 1 in progress (`01-01` and `01-02` complete).

This repository is designed so a new session can continue from files on disk only.

## Start Here

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/ROADMAP.md`
5. `docs/adr/ADR-001-stack-and-repo-shape.md`
6. `.planning/phases/01-foundation-contracts/01-CONTEXT.md`
7. `.planning/phases/01-foundation-contracts/01-RESEARCH.md`
8. `.planning/phases/01-foundation-contracts/01-01-PLAN.md` through `01-04-PLAN.md`
9. `.planning/phases/01-foundation-contracts/.continue-here.md`

## Locked Baseline (ADR-001)

ADR reference: `docs/adr/ADR-001-stack-and-repo-shape.md`

Chosen workspace shape:

- `apps/web`
- `apps/terminal-worker`
- `packages/domain`
- `packages/application`
- `packages/infrastructure`
- `packages/lottery-handlers`
- `packages/test-kit`

Root workspace config files:

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`

## Root Scripts

- `corepack pnpm dev:web`
- `corepack pnpm dev:worker`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm smoke`

## Working Rules

- Keep business logic out of UI and terminal apps.
- Keep terminal execution isolated in worker plus adapter boundaries.
- Treat balance and request transitions as auditable domain events.
- Add or change lotteries only through registry and handler contracts.
- Update `.planning/` and `docs/` when decisions or boundaries change.

## Documentation Map

- `docs/adr/` - architectural decisions and constraints
- `docs/modules/` - module responsibilities and extension notes
- `docs/runbooks/` - operator and maintenance procedures
- `.planning/` - roadmap, plans, summaries, and state continuity

## Environment Note

- Git is available on PATH and repository branch is `main`.
- If a `gsd-tools` git step fails with sandbox `EPERM`, rerun that step via unrestricted shell.

## Immediate Next Step

Execute `.planning/phases/01-foundation-contracts/01-03-PLAN.md`.
