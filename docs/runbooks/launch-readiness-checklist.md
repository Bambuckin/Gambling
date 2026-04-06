# Full Launch Readiness Checklist (LAN)

This document is the single place for launch scope:
- what is already implemented,
- what is still missing before go-live,
- what must be installed on each machine,
- how status and data flow work.

## 1. Current implemented baseline

- Shared runtime state for `web` + `terminal-worker` through Postgres (`LOTTERY_STORAGE_BACKEND=postgres`).
- Database schema bootstrap and seed: `scripts/postgres-init-and-seed.ts`.
- Single active terminal executor lock: `PostgresTerminalExecutionLock`.
- Runtime env/IP templates:
  - `.env.example`
  - `ops/runtime/.env.web.template`
  - `ops/runtime/.env.worker.template`
  - `ops/runtime/hosts.template.json`
- Role-based startup scripts:
  - `scripts/bootstrap-runtime.ps1`
  - `scripts/start-web-runtime.ps1`
  - `scripts/start-worker-runtime.ps1`
- Preflight config validator:
  - `scripts/runtime-preflight.ts`

## 2. Mandatory gaps before go-live

Blocking:

- [ ] Final customer-facing ticket purchase UI in `apps/web/src/app/lottery/[lotteryCode]/page.tsx` (or an explicitly new route set).
- [ ] Real terminal handler integrations in `apps/terminal-worker/src/lib/terminal-handler-runtime.ts` (current logic is deterministic stub behavior).
- [ ] Real network and secret values filled in `.env` and `ops/runtime/hosts.template.json`.
- [ ] Integration smoke in target LAN with live terminal flow.

Recommended, non-blocking:

- [ ] TLS/reverse proxy in front of `apps/web`.
- [ ] Stronger secret management and rotation policy.
- [ ] Centralized log collection beyond DB audit if required by operations.

## 3. How lottery/draw status is computed

Data sources:

- Admin controls visibility/order through registry entries.
- Draw snapshots are stored in draw snapshot storage.
- `fresh|stale|missing` is computed from `fetchedAt` + `freshnessTtlSeconds`.

Runtime points:

- User page read path: `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- Draw runtime/store wiring: `apps/web/src/lib/draw/draw-runtime.ts`
- Registry runtime/store wiring: `apps/web/src/lib/registry/registry-runtime.ts`
- Admin observability: `/admin`

## 4. How data moves between clients and terminal

Flow:

1. Client workstation opens `http://<SERVER_IP>:3000` in browser.
2. `apps/web` validates session + payload, computes quote, creates request, queues request.
3. `apps/terminal-worker` reserves queued request from shared DB and executes under terminal lock.
4. Attempt result and ticket status are persisted to DB.
5. Client/admin read updated status through `apps/web`.

Network model:

- Client workstations do not call terminal automation directly.
- Coordination between web and worker happens through shared Postgres.

## 5. Required software by machine role

### Web server

Required:

- Node.js `>=20.11`
- Corepack
- Repository checkout
- Postgres connectivity

Startup:

```powershell
corepack pnpm install
Copy-Item ops/runtime/.env.web.template .env
# fill real values
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env
```

### Main terminal machine (worker)

Required:

- Node.js `>=20.11`
- Corepack
- Repository checkout
- Postgres connectivity
- Terminal integration prerequisites (browser/API credentials/selectors or provider SDK access)

Startup:

```powershell
corepack pnpm install
Copy-Item ops/runtime/.env.worker.template .env
# fill real values
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

### Client workstations

Required:

- Modern browser
- LAN access to `http://<SERVER_IP>:3000`

Not required:

- Node.js
- repository checkout
- local worker
- direct DB access

## 6. Minimum env set required to start

- `LOTTERY_STORAGE_BACKEND=postgres`
- `LOTTERY_POSTGRES_URL=postgresql://<USER>:<PASS>@<DB_IP>:5432/<DB_NAME>`
- `HOSTNAME`
- `PORT`
- `LOTTERY_TERMINAL_LOCK_TTL_SECONDS`
- `LOTTERY_TERMINAL_POLL_INTERVAL_MS`
- `LOTTERY_TERMINAL_HANDLER_CODES`

IP inventory is maintained in `ops/runtime/hosts.template.json`.

## 7. Fast path after filling placeholders

Server:

```powershell
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env
```

Terminal machine:

```powershell
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

Manual verification:

- Login page works: `/login`
- Purchase request can be created: `/lottery/demo-lottery`
- Queue/alerts visible: `/admin`
- Worker logs show reservation + attempt + result traces

## 8. Files to hand to another model/account

1. `docs/START-HERE.md`
2. `docs/runbooks/launch-readiness-checklist.md`
3. `docs/runbooks/deployment-bootstrap.md`
4. `docs/handoff-runtime.md`
5. `.env.example`
6. `ops/runtime/hosts.template.json`
7. `scripts/runtime-preflight.ts`
8. `scripts/postgres-init-and-seed.ts`
9. `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
10. `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`

