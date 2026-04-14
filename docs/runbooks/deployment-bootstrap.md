# Deployment Bootstrap (Server + Main Terminal + Clients)

This runbook prepares the current repository for LAN deployment with shared Postgres state.

## 1. What Is Ready In This Commit

- Web and terminal-worker can run in two modes: `in-memory` or `postgres` (`LOTTERY_STORAGE_BACKEND`).
- Postgres adapters are implemented for identities/sessions, registry, draws, ledger, purchase requests/queue, tickets, verification jobs, operations audit, and terminal execution lock.
- One shared database can now be used by both web and worker processes.
- Bootstrap script exists to initialize schema and seed base data.

## 2. What Still Requires Project-Specific Completion

- Big 8 is integrated to cart stage only; checkout/payment automation is still pending.
- Final customer-facing ticket purchase UI page/visual system can be replaced independently.
- Infrastructure values must be filled: actual IPs, credentials, hostnames.

## 3. Machine Roles

### A) Web Server

Install:
- Node.js >= 20.11
- Corepack enabled (`corepack enable`)
- Repo checkout

One-click launcher:
- `bin/Start Main Server.cmd`

Run:

```powershell
corepack pnpm install
Copy-Item ops/runtime/.env.web.template .env
# fill DB IP/password and server host/port
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env
```

Alternative (wrapper, no manual `.env` editing):

```powershell
.\scripts\prepare-web-runtime.ps1 `
  -EnvFile .env `
  -DbHost <DB_IP> `
  -DbPassword "<DB_PASSWORD>"
```

Notes:
- `start-web-runtime.ps1` runs config preflight and auto-builds web artifacts if `.next/BUILD_ID` is missing.
- If you prefer direct commands, run `corepack pnpm runtime:preflight:web`, `corepack pnpm --filter @lottery/web build`, then `corepack pnpm start:web`.

### B) Main Terminal Machine (worker)

Install:
- Node.js >= 20.11
- Corepack enabled
- Repo checkout
- Google Chrome or Chromium with the National Lottery tab already opened and authenticated
- Chrome remote debugging enabled so the worker can attach to the existing cashier tab
- Any remaining terminal automation prerequisites you will use (browser profile, credentials, selectors, or API access)

Run:

```powershell
corepack pnpm install
Copy-Item ops/runtime/.env.worker.template .env
# fill DB IP/password and terminal handler codes
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

Alternative (wrapper, no manual `.env` editing):

```powershell
.\scripts\prepare-worker-runtime.ps1 `
  -EnvFile .env `
  -DbHost <DB_IP> `
  -DbPassword "<DB_PASSWORD>" `
  -OpenTerminalChrome
```

Chrome launch example on the terminal machine:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\LotteryTerminalChrome" `
  https://webapp.cloud.nationallottery.ru/
```

If you use `prepare-worker-runtime.ps1 -OpenTerminalChrome`, this launch step is done automatically.

Worker env values needed for live Big 8 draw sync:

- `LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED=true`
- `LOTTERY_BIG8_CART_AUTOMATION_ENABLED=true`
- `LOTTERY_BIG8_TERMINAL_MODE=real`
- `LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS=20000`
- `LOTTERY_TERMINAL_BROWSER_URL=http://127.0.0.1:9222`
- `LOTTERY_TERMINAL_PAGE_URL=https://webapp.cloud.nationallottery.ru/`
- `LOTTERY_BIG8_DRAW_MODAL_WAIT_MS=2500`
- `LOTTERY_BIG8_DRAW_TTL_SECONDS=45`
- `LOTTERY_BIG8_ACTION_TIMEOUT_MS=8000`
- `LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE=true`

Local single-PC verification mode (no live NL checkout):

- set `LOTTERY_BIG8_TERMINAL_MODE=mock`
- optional `LOTTERY_BIG8_MOCK_LATENCY_MS=250`
- use `/debug/mock-terminal` to observe payloads consumed by worker from queue
- shortcut script: `.\scripts\start-worker-mock-terminal.ps1 -EnvFile .env`

### C) Client Computers

Install:
- Modern browser only

Use:
- Open `http://<SERVER_IP>:3000`
- Log in with configured credentials

No Node.js, DB, worker, or repo is needed on client PCs.

### D) Portable LAN Bundles (client PC + terminal receiver)

If you want copyable folders with one-click launchers, build them on the main server machine:

```powershell
corepack pnpm bundle:lan
```

One-click launcher:
- `bin/Build LAN Bundles.cmd`

Output:
- `dist/lan-bundles/client-workstation`
- `dist/lan-bundles/terminal-receiver`

What goes where:
- copy `client-workstation` to the cashier/client PC
- copy `terminal-receiver` to the terminal PC

Launchers inside bundles:
- `Start Client.cmd`
- `Start Terminal Receiver.cmd`

Bundle behavior:
- client bundle opens Chrome/Edge in app mode to `/lottery/bolshaya-8`
- terminal bundle starts a portable mock receiver runtime and opens `/terminal/receiver`
- terminal bundle connects to the shared Postgres on the main server IP baked into the bundle
- no real NLoto checkout is used in this slice; the terminal only proves payload receipt and request state change

Important:
- the main server machine must already be running web on `0.0.0.0:<PORT>`
- PostgreSQL on the main server must accept LAN connections from the terminal PC
- default bundle IPs currently target the active LAN map from phase 12; override them with script params if IPs change

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
- Env generator: `scripts/create-runtime-env.ps1`
- Web wrapper: `scripts/prepare-web-runtime.ps1`
- Worker wrapper: `scripts/prepare-worker-runtime.ps1`
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
- `/lottery/bolshaya-8` shows live draw choices and refreshes them every 20 seconds
- `/lottery/mechtallion` can create and queue request
- worker logs show draw sync refreshes and request reservation + attempt processing

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
