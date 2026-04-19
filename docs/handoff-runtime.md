# Runtime Handoff

This file is the short operational handoff for the current repository state.

## Read First

1. `docs/handoff/big8-current-wave/README.md`
2. `docs/runbooks/deployment-bootstrap.md`
3. `.planning/STATE.md`

## What Actually Works Now

- Web and terminal worker can share one Postgres-backed runtime through `LOTTERY_STORAGE_BACKEND=postgres`.
- Shared persistence now covers identities, sessions, draws, ledger, purchase requests, purchase queue, tickets, verification jobs, draw closures, notifications, cash desk requests, winnings credit jobs, and the terminal execution lock.
- The user flow works as: prepare ticket -> confirm -> queue request -> worker picks it up -> emulated purchase saves ticket/reference -> admin marks ticket win/lose if needed -> admin closes draw -> user sees result and notification.
- The admin flow works as: watch system summary -> inspect queue -> inspect terminal/last requests -> manually create draw -> user can buy against that open draw -> delete empty draw if needed -> mark ticket -> close draw.
- The terminal receiver page is the quickest operator proof that a queued request really reached the terminal side.

## Important Operational Nuances

- Queue depth alone is not enough. The worker may reserve a request immediately, so `/admin` can show an empty queue while the same request is already visible in the terminal/last-requests block or on `/terminal/receiver`.
- `db:init` now reads local `.env` the same way as runtime preflight. You do not need to export `LOTTERY_POSTGRES_URL` manually if it is already present in `.env`.
- The terminal worker now also auto-loads the repository `.env` on boot, so direct `pnpm start:worker` or `pnpm dev:worker` no longer falls back to in-memory storage when Postgres is configured only in `.env`.
- Big 8 terminal emulation is the default runtime mode now. Switch to the real terminal only by setting `LOTTERY_BIG8_TERMINAL_MODE=real`.
- In mock mode the worker keeps existing snapshots fresh but does not auto-seed new Big 8 draws. The intended operator path is: create draw in admin -> buy against that draw -> close draw in admin.
- Manual draws are preserved in available draw options even after later draw snapshot refreshes, so admin-created draws remain purchasable until they are closed or deleted.
- `/admin` now contains test cleanup controls: clear pending queue/runtime state, full test reset, and empty-draw deletion.
- The simplified current UI now shows purchase/result notifications on `/lottery/bolshaya-8`, but still does not expose a dedicated payout widget.

## Current UI Surface

- `/admin`: system summary, queue snapshot, terminal/last requests, manual draw management.
- `/terminal/receiver`: live terminal-side request history.
- `/lottery/bolshaya-8`: ticket creation, confirmation, open-draw selection, request states, purchase/result notifications, and ticket results. Secondary cabinet analytics and wallet history were intentionally removed from the page.

## Known Remaining Gaps

1. Final checkout/payment automation after cart stage is still not implemented.
2. Selector hardening for long-term NLoto DOM drift still needs more artifacts and validation.
3. Security hardening remains optional follow-up work: stronger password hashing, TLS/proxy setup, broader RBAC.
4. If the active lottery catalog changes, refresh:
   - `packages/infrastructure/src/seeds/default-lottery-catalog.ts`
   - `apps/web/src/lib/ui/lottery-presentation.ts`

## Fast Start

```powershell
# server
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env

# worker
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

## Fast Diagnostics

```powershell
corepack pnpm runtime:doctor:queue
```

Use it before touching the live terminal when the admin page shows queued requests that are not moving.

## Launch Checklist

- `docs/runbooks/launch-readiness-checklist.md`
