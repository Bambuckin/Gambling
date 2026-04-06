# Deployment Bootstrap (Server + Main Terminal + Clients)

This runbook prepares the current repository for LAN deployment with shared Postgres state.

## 1. What Is Ready In This Commit

- Web and terminal-worker can run in two modes: `in-memory` or `postgres` (`LOTTERY_STORAGE_BACKEND`).
- Postgres adapters are implemented for identities/sessions, registry, draws, ledger, purchase requests/queue, tickets, verification jobs, operations audit, and terminal execution lock.
- One shared database can now be used by both web and worker processes.
- Bootstrap script exists to initialize schema and seed base data.

## 2. What Still Requires Project-Specific Completion

- Production terminal automation handler logic (real browser/API integration) is still domain-specific.
- Final customer-facing ticket purchase UI page/visual system can be replaced independently.
- Infrastructure values must be filled: actual IPs, credentials, hostnames.

## 3. Machine Roles

### A) Web Server

Install:
- Node.js >= 20.11
- Corepack enabled (`corepack enable`)
- Repo checkout

Run:

```powershell
corepack pnpm install
Copy-Item ops/runtime/.env.web.template .env
# fill DB IP/password and server host/port
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env
```

Notes:
- `start-web-runtime.ps1` runs config preflight and auto-builds web artifacts if `.next/BUILD_ID` is missing.
- If you prefer direct commands, run `corepack pnpm runtime:preflight:web`, `corepack pnpm --filter @lottery/web build`, then `corepack pnpm start:web`.

### B) Main Terminal Machine (worker)

Install:
- Node.js >= 20.11
- Corepack enabled
- Repo checkout
- Any terminal automation prerequisites you will use (browser, credentials, selectors, or API access)

Run:

```powershell
corepack pnpm install
Copy-Item ops/runtime/.env.worker.template .env
# fill DB IP/password and terminal handler codes
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

### C) Client Computers

Install:
- Modern browser only

Use:
- Open `http://<SERVER_IP>:3000`
- Log in with configured credentials

No Node.js, DB, worker, or repo is needed on client PCs.

## 4. Database Bootstrap Commands

```powershell
# schema only
corepack pnpm db:init

# schema + seed if tables are empty
corepack pnpm db:seed

# schema + force replace base seeds + clear runtime state
corepack pnpm db:reset
```

Script: `scripts/postgres-init-and-seed.ts`

## 5. Runtime Config Files

- Global env template: `.env.example`
- Host/IP template: `ops/runtime/hosts.template.json`
- Web env template: `ops/runtime/.env.web.template`
- Worker env template: `ops/runtime/.env.worker.template`
- Runtime gap checklist: `docs/runbooks/launch-readiness-checklist.md`

## 6. Optional Local PostgreSQL (docker)

```powershell
docker compose -f docker-compose.postgres.yml up -d
```

Then set:

```text
LOTTERY_POSTGRES_URL=postgresql://lottery:lottery@127.0.0.1:5432/lottery
```

## 7. Health Check Sequence

On server:

```powershell
corepack pnpm release:check
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env
```

On terminal machine:

```powershell
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

Manual checks:
- `/login` works with seeded users
- `/admin` shows queue/terminal/alerts
- `/lottery/demo-lottery` can create and queue request
- worker logs show reservation + attempt processing

## 8. Handoff Notes For Another Model/Account

If another model continues work, provide these files first:

1. `docs/runbooks/deployment-bootstrap.md`
2. `.env.example`
3. `ops/runtime/hosts.template.json`
4. `scripts/postgres-init-and-seed.ts`
5. `apps/web/src/lib/runtime/postgres-runtime.ts`
6. `apps/terminal-worker/src/lib/runtime/postgres-runtime.ts`
7. `packages/infrastructure/src/postgres/*`

And explicitly state:
- actual IP map,
- DB credentials,
- which lottery handlers must become real terminal integrations,
- whether UI replacement is done in `apps/web/src/app/lottery/[lotteryCode]/page.tsx` or as a new route set.
