# Getting Started

Use this document when you need to get productive in the repository in the first 30-60 minutes.
It is written for a new engineer or a new model session that has no previous chat context.

## Read This First

1. `README.md` - root runtime overview and startup commands.
2. `docs/START-HERE.md` - short human/model entrypoint.
3. `ARCHITECTURE.md` - system shape and core flows.
4. `docs/modules/system-architecture.md` - runtime-to-package flow map.
5. `docs/modules/boundary-catalog.md` - ownership and forbidden shortcuts.
6. `docs/CONFIGURATION.md` - env files, runtime modes, required variables.
7. `docs/API.md` - pages, JSON endpoints, and server actions.
8. `docs/DEVELOPMENT.md` - where to change code safely.
9. `docs/TESTING.md` - what can actually be validated today.
10. `docs/handoff-runtime.md` and `.planning/STATE.md` - current delivery edge and remaining gaps.

## Repository Shape

- `apps/web` - Next.js runtime for login, lottery purchase pages, admin console, and verification pages.
- `apps/terminal-worker` - single execution worker that polls queue items, resolves handlers, and applies ticket verification results.
- `packages/domain` - pure contracts and lifecycle rules.
- `packages/application` - use-case services and typed ports.
- `packages/infrastructure` - in-memory and Postgres adapters, schema bootstrap, seed catalog.
- `packages/lottery-handlers` - handler contracts and registry abstraction.
- `packages/test-kit` - fake terminal and fake handler helpers.
- `docs/` - architecture, runbooks, ADRs, handoff notes, and now canonical onboarding docs.
- `scripts/` - bootstrap, runtime preparation, preflight, LAN wrappers.
- `ops/runtime/` - deployment templates for `.env` files and host mapping.
- `.planning/` - project state, roadmap, and phase context. Read it when you resume planned work.

## Current Runtime Coverage

The implemented system is usable as a LAN-first orchestration platform, but runtime coverage is not uniform across all lotteries.

- Shared storage works in `in-memory` and `postgres` modes.
- Web runtime covers login, lottery shell, request drafting, request confirmation, wallet projection, ticket projection, and admin queue controls.
- Worker runtime covers queue reservation, terminal lock, attempt journaling, retry classification, ticket persistence, and ticket verification queue processing.
- Big 8 has the only real browser automation path today:
  - live draw sync from the terminal page;
  - add-to-cart purchase automation in real mode;
  - mock terminal mode for payload verification without live checkout.
- Other lottery codes currently resolve to deterministic demo handlers rather than real terminal automation.
- Final checkout/payment automation is still a documented gap; see `docs/handoff-runtime.md`.

## Fast Local Bootstrap

### Install and sanity-check the workspace

```powershell
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
```

### Start in-memory development

Use this when you only need local UI/application behavior and do not need shared state across separate processes.

```powershell
corepack pnpm dev:web
corepack pnpm dev:worker
```

### Start shared Postgres runtime

Use this when you need the real web <-> worker shared state path.

```powershell
corepack pnpm runtime:preflight
corepack pnpm db:init
corepack pnpm db:seed
corepack pnpm start:web
corepack pnpm start:worker
```

If you are preparing separate LAN machines, read `docs/runbooks/deployment-bootstrap.md` first.

## Seeded Runtime Defaults

If you use default seed/bootstrap logic, these identities exist:

- `operator / operator` - regular user flow.
- `tester / tester` - extra user account for queue/ticket checks.
- `admin / admin` - admin controls.

Seed data also creates:

- default lottery registry entries;
- default draw snapshots;
- default wallet balances for seeded users.

Source of truth:

- `apps/web/src/lib/access/access-runtime.ts`
- `scripts/postgres-init-and-seed.ts`
- `packages/infrastructure/src/seeds/default-lottery-catalog.ts`

## Choose Your Entry Point By Task

### UI or page behavior

Start with:

- `apps/web/README.md`
- `apps/web/src/app/`
- `apps/web/src/lib/`
- `docs/API.md`

### Queue, terminal execution, or retries

Start with:

- `apps/terminal-worker/README.md`
- `apps/terminal-worker/src/main.ts`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- `packages/application/README.md`

### Core state transitions or pricing logic

Start with:

- `packages/domain/README.md`
- `packages/application/README.md`

### Storage, schema, bootstrap, or env wiring

Start with:

- `packages/infrastructure/README.md`
- `docs/CONFIGURATION.md`
- `scripts/postgres-init-and-seed.ts`

### New lottery or handler changes

Start with:

- `docs/modules/lottery-handler-extension.md`
- `packages/lottery-handlers/README.md`
- `apps/terminal-worker/README.md`

### Smoke or release verification

Start with:

- `docs/TESTING.md`
- `docs/runbooks/module-verification-matrix.md`
- `docs/runbooks/release-readiness.md`

## Continuation Files For Another Agent

If you are resuming work after a pause, the minimal continuity set is:

1. `.planning/STATE.md`
2. `.planning/ROADMAP.md`
3. `docs/handoff-runtime.md`
4. `docs/START-HERE.md`
5. `docs/DEVELOPMENT.md`

That sequence gives current scope, current gaps, code ownership, and the safe place to continue.
