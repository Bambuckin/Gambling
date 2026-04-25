# Configuration Guide

This document collects the configuration surface that is actually used by the repository.
Use it together with `.env.example`, `ops/runtime/`, and `scripts/runtime-preflight.ts`.

## Runtime Modes

The whole system supports two storage backends:

- `LOTTERY_STORAGE_BACKEND=in-memory`
  - fast local development;
  - web and worker do not share state across separate processes unless explicitly wired in the same runtime;
  - optional JSON seed overrides can replace default identities, registry, draws, and ledger entries.
- `LOTTERY_STORAGE_BACKEND=postgres`
  - shared state between `apps/web` and `apps/terminal-worker`;
  - required for realistic LAN deployment;
  - uses the tables defined in `packages/infrastructure/src/postgres/postgres-schema.ts`.

Source of truth for backend selection:

- `packages/infrastructure/src/postgres/storage-backend.ts`

## Main Config Files

- `.env.example` - combined example for local/shared runtime.
- `.env.web` - local web-role sample.
- `.env.worker` - local worker-role sample.
- `ops/runtime/.env.web.template` - LAN deployment template for the web machine.
- `ops/runtime/.env.worker.template` - LAN deployment template for the terminal worker machine.
- `ops/runtime/hosts.template.json` - host/IP inventory template.

## Shared Variables

### Required in all modes

- `LOTTERY_STORAGE_BACKEND`

### Required when backend is `postgres`

- `LOTTERY_POSTGRES_URL`
- `DATABASE_URL` can be used as a fallback alias, but the repo prefers `LOTTERY_POSTGRES_URL`

Connection strings are validated by `scripts/runtime-preflight.ts`.

## Web Runtime Variables

Required for `apps/web`:

- `HOSTNAME`
- `PORT`

Used by:

- `next start`
- wrapper scripts such as `scripts/start-web-runtime.ps1`

### Optional web seed overrides for `in-memory` mode

- `LOTTERY_ACCESS_IDENTITIES_JSON`
  - custom identity seeds instead of default `operator/admin/tester`
- `LOTTERY_REGISTRY_ENTRIES_JSON`
  - full registry seed override
- `LOTTERY_SHELL_LOTTERIES_JSON`
  - legacy fallback shell catalog format; kept for compatibility
- `LOTTERY_DRAW_SNAPSHOTS_JSON`
  - custom draw snapshot seeds
- `LOTTERY_LEDGER_ENTRIES_JSON`
  - custom wallet/ledger seed entries

Used by:

- `apps/web/src/lib/access/access-runtime.ts`
- `apps/web/src/lib/registry/registry-runtime.ts`
- `apps/web/src/lib/draw/draw-runtime.ts`
- `apps/web/src/lib/ledger/ledger-runtime.ts`

## Worker Runtime Variables

Required for `apps/terminal-worker`:

- `LOTTERY_TERMINAL_LOCK_TTL_SECONDS`
- `LOTTERY_TERMINAL_POLL_INTERVAL_MS`
- `LOTTERY_TERMINAL_HANDLER_CODES`

Big 8 worker toggles:

- `LOTTERY_BIG8_TERMINAL_MODE`
  - `real` for live browser automation with terminal purchase
  - `mock` for payload verification without live NL checkout
- `LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED`
- `LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED`
  - preferred flag for the live Big 8 terminal purchase path
- `LOTTERY_BIG8_CART_AUTOMATION_ENABLED`
  - backward-compatible alias for `LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED`
- `LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS`
- `LOTTERY_BIG8_DRAW_MODAL_WAIT_MS`
- `LOTTERY_BIG8_DRAW_TTL_SECONDS`
- `LOTTERY_BIG8_ACTION_TIMEOUT_MS`
- `LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE`
- `LOTTERY_BIG8_MOCK_LATENCY_MS`
- `LOTTERY_TERMINAL_RECEIVER_LABEL`
  - optional label embedded into mock terminal raw output

Terminal browser integration:

- `LOTTERY_TERMINAL_BROWSER_URL`
- `LOTTERY_TERMINAL_PAGE_URL`

These become required when:

- terminal mode is not `mock`, and
- either live draw sync or Big 8 purchase automation is enabled.

Validation logic lives in:

- `scripts/runtime-preflight.ts`
- `apps/terminal-worker/src/lib/runtime/postgres-runtime.ts`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`

## Seeded Defaults

Default seed/bootstrap behavior creates:

- users:
  - `operator / operator`
  - `admin / admin`
  - `tester / tester`
- default lottery registry entries;
- default draw snapshots;
- default wallet credits/reserve examples.

Source of truth:

- `apps/web/src/lib/access/access-runtime.ts`
- `scripts/postgres-init-and-seed.ts`
- `packages/infrastructure/src/seeds/default-lottery-catalog.ts`

## Schema And Persistence

When backend is `postgres`, these tables matter most:

- `lottery_identities`
- `lottery_sessions`
- `lottery_access_audit_events`
- `lottery_registry_entries`
- `lottery_draw_snapshots`
- `lottery_ledger_entries`
- `lottery_purchase_requests`
- `lottery_purchases`
- `lottery_purchase_queue_items`
- `lottery_purchase_attempts`
- `lottery_draws`
- `lottery_tickets`
- `lottery_operations_audit_events`
- `lottery_notifications`
- `lottery_cash_desk_requests`
- `lottery_winnings_credit_jobs`

Defined in:

- `packages/infrastructure/src/postgres/postgres-schema.ts`

## Bootstrap And Validation Scripts

- `corepack pnpm runtime:preflight`
- `corepack pnpm runtime:preflight:web`
- `corepack pnpm runtime:preflight:worker`
- `corepack pnpm db:init`
- `corepack pnpm db:seed`
- `corepack pnpm db:reset`
- `scripts/create-runtime-env.ps1`
- `scripts/bootstrap-runtime.ps1`
- `scripts/prepare-web-runtime.ps1`
- `scripts/prepare-worker-runtime.ps1`

## Configuration Advice

- Use `.env.example` for single-machine local work.
- Use `ops/runtime/*.template` for real LAN deployment.
- Prefer `postgres` backend for any realistic integration check between web and worker.
- Treat `LOTTERY_TERMINAL_HANDLER_CODES` as the worker execution allow-list.
- Do not put real secrets into docs; keep them only in machine-local `.env` files.

## Related Docs

- `docs/GETTING-STARTED.md`
- `docs/DEVELOPMENT.md`
- `docs/runbooks/deployment-bootstrap.md`
- `docs/runbooks/launch-readiness-checklist.md`
