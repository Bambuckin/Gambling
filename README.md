# Lottery Terminal Operations System

Status: v1 phase baseline complete (`.planning/STATE.md` reports 100%).

This repository contains a LAN-first lottery operations platform with:
- `apps/web` (user/admin web runtime)
- `apps/terminal-worker` (single active execution worker)
- shared domain/application/infrastructure/handler packages

New contributor/model entrypoint:
- [docs/START-HERE.md](docs/START-HERE.md)

## Quick Start (Local)

```powershell
corepack pnpm install
corepack pnpm release:check
corepack pnpm dev:web
corepack pnpm dev:worker
```

## Quick Start (Shared Postgres Runtime)

1. Copy `.env.example` to `.env` and fill DB values.
2. Start PostgreSQL (local or remote).
3. Initialize schema and seed data.
4. Start web and worker processes.

```powershell
corepack pnpm install
corepack pnpm runtime:preflight
corepack pnpm db:init
corepack pnpm db:seed
corepack pnpm start:web
corepack pnpm start:worker
```

Optional local DB:

```powershell
docker compose -f docker-compose.postgres.yml up -d
```

## Runtime Modes

- `LOTTERY_STORAGE_BACKEND=in-memory` (default)
- `LOTTERY_STORAGE_BACKEND=postgres` (shared state for web + worker)

Connection variable:
- `LOTTERY_POSTGRES_URL` (fallback: `DATABASE_URL`)

## Root Scripts

- `corepack pnpm dev:web`
- `corepack pnpm dev:worker`
- `corepack pnpm start:web`
- `corepack pnpm start:worker`
- `corepack pnpm db:init`
- `corepack pnpm db:seed`
- `corepack pnpm db:reset`
- `corepack pnpm runtime:preflight`
- `corepack pnpm runtime:preflight:web`
- `corepack pnpm runtime:preflight:worker`
- `corepack pnpm release:check`

## Deployment + Handoff Docs

- [START-HERE.md](docs/START-HERE.md)
- [deployment-bootstrap.md](docs/runbooks/deployment-bootstrap.md)
- [launch-readiness-checklist.md](docs/runbooks/launch-readiness-checklist.md)
- [release-readiness.md](docs/runbooks/release-readiness.md)
- [module-verification-matrix.md](docs/runbooks/module-verification-matrix.md)
- `ops/runtime/hosts.template.json`
- `ops/runtime/.env.web.template`
- `ops/runtime/.env.worker.template`

## Architecture Anchors

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/modules/system-architecture.md](docs/modules/system-architecture.md)
- [docs/modules/boundary-catalog.md](docs/modules/boundary-catalog.md)
- [docs/modules/lottery-handler-extension.md](docs/modules/lottery-handler-extension.md)

## Planning Continuity

Use in this order when resuming:
1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/ROADMAP.md`
