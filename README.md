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

## One-Command Runtime Prep (LAN)

Use wrapper scripts when you want to avoid manual `.env` editing:

```powershell
# Web machine: generate .env, install deps, bootstrap DB, start web
.\scripts\prepare-web-runtime.ps1 `
  -EnvFile .env `
  -DbHost 192.168.1.10 `
  -DbPassword "your_db_password"

# Terminal machine: generate .env, install deps, open Chrome (optional), start worker
.\scripts\prepare-worker-runtime.ps1 `
  -EnvFile .env `
  -DbHost 192.168.1.10 `
  -DbPassword "your_db_password" `
  -OpenTerminalChrome
```

Helper script:
- `scripts/create-runtime-env.ps1` (generates `.env` from `ops/runtime/.env.*.template`).

Optional local DB:

```powershell
docker compose -f docker-compose.postgres.yml up -d
```

## Runtime Modes

- `LOTTERY_STORAGE_BACKEND=in-memory` (default)
- `LOTTERY_STORAGE_BACKEND=postgres` (shared state for web + worker)

Connection variable:
- `LOTTERY_POSTGRES_URL` (fallback: `DATABASE_URL`)

Big 8 worker mode:
- `LOTTERY_BIG8_TERMINAL_MODE=real` - live NL terminal automation (default)
- `LOTTERY_BIG8_TERMINAL_MODE=mock` - local mock terminal flow for web -> worker payload verification
- `LOTTERY_BIG8_MOCK_LATENCY_MS=250` - optional delay in mock mode

## Local Mock Terminal Check (One PC)

Use this when you need to verify payload transfer from client web UI to worker without live checkout:

1. Set in `.env`:
   - `LOTTERY_BIG8_TERMINAL_MODE=mock`
2. Start web and worker:
   - `corepack pnpm start:web`
   - `.\scripts\start-worker-mock-terminal.ps1 -EnvFile .env`
3. Open:
   - client form: `/lottery/bolshaya-8`
   - terminal simulator: `/debug/mock-terminal`
4. Submit a Big 8 request from the client page and confirm it.
5. In `Mock Terminal Inbox`, verify:
   - request moved through queue/execution states
   - payload snapshot (phone + tickets) is visible
   - worker raw output includes `[big8-mock-terminal]`

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
- [GETTING-STARTED.md](docs/GETTING-STARTED.md)
- [DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [TESTING.md](docs/TESTING.md)
- [CONFIGURATION.md](docs/CONFIGURATION.md)
- [API.md](docs/API.md)
- [deployment-bootstrap.md](docs/runbooks/deployment-bootstrap.md)
- [launch-readiness-checklist.md](docs/runbooks/launch-readiness-checklist.md)
- [release-readiness.md](docs/runbooks/release-readiness.md)
- [module-verification-matrix.md](docs/runbooks/module-verification-matrix.md)
- `ops/runtime/hosts.template.json`
- `ops/runtime/.env.web.template`
- `ops/runtime/.env.worker.template`

## Workspace Maps

- [apps/web/README.md](apps/web/README.md)
- [apps/terminal-worker/README.md](apps/terminal-worker/README.md)
- [packages/domain/README.md](packages/domain/README.md)
- [packages/application/README.md](packages/application/README.md)
- [packages/infrastructure/README.md](packages/infrastructure/README.md)
- [packages/lottery-handlers/README.md](packages/lottery-handlers/README.md)
- [packages/test-kit/README.md](packages/test-kit/README.md)

## Architecture Anchors

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/modules/system-architecture.md](docs/modules/system-architecture.md)
- [docs/modules/boundary-catalog.md](docs/modules/boundary-catalog.md)
- [docs/modules/lottery-handler-extension.md](docs/modules/lottery-handler-extension.md)
- [docs/modules/ui-customization.md](docs/modules/ui-customization.md)

## Planning Continuity

Use in this order when resuming:
1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/ROADMAP.md`
