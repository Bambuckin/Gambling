# Lottery Terminal Operations System

Status: Phase 2 in progress (`02-01`, `02-02`, and `02-03` complete, `02-04` next).

This repository is designed so a new session can continue from files on disk only.

## Start Here

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/ROADMAP.md`
5. `docs/adr/ADR-001-stack-and-repo-shape.md`
6. `.planning/phases/01-foundation-contracts/01-CONTEXT.md`
7. `.planning/phases/01-foundation-contracts/01-RESEARCH.md`
8. `docs/modules/boundary-catalog.md`
9. `docs/modules/lottery-handler-extension.md`
10. `docs/runbooks/local-bootstrap.md`
11. `docs/runbooks/fake-terminal-smoke.md`
12. `docs/runbooks/queue-incident-triage.md`
13. `.planning/codebase/STRUCTURE.md`
14. `.planning/phases/01-foundation-contracts/01-01-PLAN.md` through `01-04-PLAN.md`
15. `.planning/phases/01-foundation-contracts/.continue-here.md`
16. `.planning/phases/02-access-and-unified-shell/02-CONTEXT.md`
17. `.planning/phases/02-access-and-unified-shell/02-01-PLAN.md`
18. `.planning/phases/02-access-and-unified-shell/02-01-SUMMARY.md`
19. `.planning/phases/02-access-and-unified-shell/.continue-here.md`
20. `.planning/phases/02-access-and-unified-shell/02-02-PLAN.md`
21. `.planning/phases/02-access-and-unified-shell/02-02-SUMMARY.md`
22. `.planning/phases/02-access-and-unified-shell/02-03-PLAN.md`
23. `.planning/phases/02-access-and-unified-shell/02-03-SUMMARY.md`

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
- `docs/modules/boundary-catalog.md` - concrete ownership and anti-ownership map
- `docs/modules/lottery-handler-extension.md` - deterministic workflow for adding/changing lottery handlers
- `docs/runbooks/local-bootstrap.md` - local environment bootstrap before continuing work
- `docs/runbooks/fake-terminal-smoke.md` - smoke verification path without production terminal
- `docs/runbooks/queue-incident-triage.md` - queue/terminal triage baseline at current phase
- `.planning/` - roadmap, plans, summaries, and state continuity

## Environment Note

- Git is available on PATH and repository branch is `main`.
- If a `gsd-tools` git step fails with sandbox `EPERM`, rerun that step via unrestricted shell.

## Immediate Next Step

Execute `02-04` in Phase 2 (`Access and Unified Shell`): add access events/logging and verification scenarios.
