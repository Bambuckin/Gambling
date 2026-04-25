# Deployment Bootstrap (Server + Main Terminal + Clients)

This runbook prepares the current repository for LAN deployment with shared Postgres state.

## 1. What Is Ready In This Commit

- Web and terminal-worker can run in two modes: `in-memory` or `postgres` (`LOTTERY_STORAGE_BACKEND`).
- Postgres adapters are implemented for identities/sessions, registry, draws, ledger, purchase requests/queue, canonical purchases/draws/attempts, compatibility tickets, draw closures, notifications, cash desk requests, winnings credit jobs, operations audit, and advisory terminal execution locking.
- One shared database can now be used by both web and worker processes.
- Admin visibility no longer depends on queue depth alone: `/admin` also shows terminal/last-request rows, alerts, problem requests, recent audit, cash-desk payouts, and winnings-credit jobs.
- User lottery page is canonical-first for current reads: request status, ticket results, account summary, and winning fulfillment actions come from the new projection layer with legacy fallback only when canonical data is absent.
- Bootstrap script exists to initialize schema and seed base data.
- Kiosk launcher wraps the cashier browser session with clear exit instructions.
- Stop scripts exist for server, worker, and client kiosk sessions.

## 2. What Still Requires Project-Specific Completion

- Big 8 is integrated through queueing, worker pickup, truthful terminal purchase, admin draw closure, and result visibility; remaining live risk is selector/session hardening on the NLoto side.
- Dedicated standalone payout screens still do not exist; payout stays on the same lottery page and in the admin cash-desk console.
- Infrastructure values must be filled: actual IPs, credentials, hostnames.

## 3. Machine Roles

### A) Web Server

Install:
- Node.js >= 20.11
- Corepack enabled (`corepack enable`)
- Repo checkout

One-click launchers:
- Start: `bin/Start Main Server.cmd`
- Stop:  `bin/Stop Server.cmd`

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
- To stop the server: `bin\Stop Server.cmd` or `.\scripts\stop-server.ps1 -EnvFile .env`

### B) Main Terminal Machine (worker)

Install:
- Node.js >= 20.11
- Corepack enabled
- Repo checkout
- Google Chrome or Chromium with the National Lottery tab already opened and authenticated
- Chrome remote debugging enabled so the worker can attach to the existing cashier tab
- Any remaining terminal automation prerequisites you will use (browser profile, credentials, selectors, or API access)

One-click launchers:
- Start: `.\scripts\start-worker-runtime.ps1 -EnvFile .env`
- Stop:  `bin\Stop Worker.cmd`

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

To stop the worker: `bin\Stop Worker.cmd` or `.\scripts\stop-worker.ps1`

Worker env values needed for live Big 8 draw sync:

- `LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED=true`
- `LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED=true`
- `LOTTERY_BIG8_CART_AUTOMATION_ENABLED=true` can remain as a backward-compatible alias
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

### C) Client Computers (Kiosk Mode)

Install:
- Modern browser (Chrome or Edge) only

Use:
- Copy the `client-workstation` bundle folder to the cashier PC
- Double-click `Start Client.cmd` to launch the kiosk
- The browser opens in fullscreen kiosk mode starting at `/login`
- After login, continue to `/lottery/bolshaya-8` and run the purchase/result/payout flow there

**How to exit the kiosk:**
1. Press **Alt+F4** in the browser window (fastest)
2. Double-click **Stop Client.cmd** in the bundle folder
3. Press **Ctrl+C** in the launcher console window

None of these affect the server or other clients.

No Node.js, DB, worker, or repo is needed on client PCs.

Local kiosk testing (single machine):

```powershell
bin\Open Main Client.cmd -Kiosk
```

This opens the client in kiosk mode against `http://127.0.0.1:3000/login`. Press Alt+F4 to exit.

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
- `Start Client.cmd` / `Stop Client.cmd`
- `Start Terminal Receiver.cmd` / `Stop Terminal Receiver.cmd`

Bundle behavior:
- client bundle opens Chrome/Edge in **kiosk mode** (fullscreen) to `/login`
- after login, the manual test target is `/lottery/bolshaya-8`
- client bundle includes `Stop Client.cmd` for explicit kiosk exit
- terminal bundle starts a portable mock receiver runtime and opens `/terminal/receiver`
- terminal bundle includes `Stop Terminal Receiver.cmd` to stop the background worker
- terminal bundle connects to the shared Postgres on the main server IP baked into the bundle
- portable receiver bundle keeps the mock/manual contour; live NLoto purchase still requires `LOTTERY_BIG8_TERMINAL_MODE=real` on the terminal machine

Important:
- the main server machine must already be running web on `0.0.0.0:<PORT>`
- PostgreSQL on the main server must accept LAN connections from the terminal PC
- default bundle IPs currently target the active LAN map from phase 12; override them with script params if IPs change
- for a real handoff, copy only:
  - `dist/lan-bundles/client-workstation` -> cashier/client PC
  - `dist/lan-bundles/terminal-receiver` -> terminal PC
  - repo checkout + `.env` -> main server machine

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

Notes:
- `db:init` now loads local `.env` the same way as runtime preflight.
- `db:reset` clears the shared runtime state, including draw closures, notifications, cash desk requests, and winnings credit jobs.

## 5. Runtime Config Files

- Global env template: `.env.example`
- Host/IP template: `ops/runtime/hosts.template.json`
- Web env template: `ops/runtime/.env.web.template`
- Worker env template: `ops/runtime/.env.worker.template`
- Env generator: `scripts/create-runtime-env.ps1`
- Web wrapper: `scripts/prepare-web-runtime.ps1`
- Worker wrapper: `scripts/prepare-worker-runtime.ps1`
- Runtime gap checklist: `docs/runbooks/launch-readiness-checklist.md`

## 6. Stop / Cleanup Commands

| Action | Command |
|--------|---------|
| Stop web server | `bin\Stop Server.cmd` or `.\scripts\stop-server.ps1` |
| Stop terminal worker | `bin\Stop Worker.cmd` or `.\scripts\stop-worker.ps1` |
| Stop kiosk client (LAN bundle) | `Stop Client.cmd` in bundle folder |
| Stop terminal receiver (LAN bundle) | `Stop Terminal Receiver.cmd` in bundle folder |
| Stop kiosk client (local dev) | Press Alt+F4 in browser, or Ctrl+C in launcher |

## 7. Optional Local PostgreSQL (docker)

```powershell
docker compose -f docker-compose.postgres.yml up -d
```

Then set:

```text
LOTTERY_POSTGRES_URL=postgresql://lottery:lottery@127.0.0.1:5432/lottery
```

## 8. Health Check Sequence

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
- `/admin` shows system summary, queue snapshot, terminal/last requests, alerts, audit, cash-desk payouts, and manual draw controls
- `/lottery/bolshaya-8` shows live draw choices, `Итоги по аккаунту`, request history, ticket results, and winning actions
- worker logs show draw sync refreshes and request reservation + attempt processing
- a confirmed request may leave the queue immediately but should remain visible in the terminal section or on `/terminal/receiver`
- admin can mark a purchased ticket and close the draw, and the result becomes visible back on the user page
- `Зачислить` creates a winnings-credit job that the worker processes
- `В кассу` creates a cash-desk request that admin can close with `Выдать`

## 9. Handoff Notes For Another Machine

### Moving the Database

1. Install PostgreSQL on the new machine
2. Create the `lottery` database and user
3. Dump from old machine: `pg_dump -U lottery lottery > lottery.dump`
4. Restore on new machine: `psql -U lottery lottery < lottery.dump`
5. Update `LOTTERY_POSTGRES_URL` in `.env` on both web and worker machines
6. Run `corepack pnpm runtime:preflight` to verify connectivity

### Moving the Web Server

1. Install Node.js >= 20.11 and enable corepack on the new machine
2. Clone the repo
3. Copy `.env` from the old server
4. Update `LOTTERY_POSTGRES_URL` to point to the new DB host if it also moved
5. Run `corepack pnpm install`
6. Run `.\scripts\start-web-runtime.ps1 -EnvFile .env`
7. Rebuild LAN bundles with new server IP if it changed: `corepack pnpm bundle:lan`

### Moving the Terminal Worker

1. Install Node.js >= 20.11 and enable corepack
2. Clone the repo (or copy the terminal-receiver bundle)
3. Copy `.env` from the old worker machine
4. Update `LOTTERY_POSTGRES_URL` to point to the current DB host
5. Ensure Chrome is installed and the NLoto tab is open with remote debugging
6. Run `.\scripts\start-worker-runtime.ps1 -EnvFile .env`

### Moving Client Kiosks

No data lives on client machines. Just:
1. Copy the `client-workstation` bundle to the new PC
2. Ensure Chrome or Edge is installed
3. Double-click `Start Client.cmd`

Business logic, purchase flows, and handler code are never affected by machine moves.
