# START HERE

Use this file as the first entry point for a new engineer or model.

## 1. What this system is

Lottery Terminal Operations System is a LAN-first web platform where:

- client workstations create and confirm purchase requests in browser;
- `apps/web` validates payload, computes quote, reserves funds, and queues request;
- exactly one `apps/terminal-worker` executes queued requests on the main terminal;
- status and money movement are persisted in shared Postgres and projected back to user/admin UI.

Primary safety invariant:
- only one active terminal execution at a time.

## 2. Repository map

- `apps/web` - UI routes, server actions, admin panel, debug pages.
- `apps/terminal-worker` - queue loop, terminal lock, execution attempts, ticket verification.
- `packages/domain` - lifecycle contracts and state rules.
- `packages/application` - use-case services and ports.
- `packages/infrastructure` - concrete adapters (`in-memory` and `postgres`).
- `packages/lottery-handlers` - deterministic handler contracts and registry.

## 3. What is done vs missing

Implemented:

- shared Postgres runtime for web + worker;
- persisted queue/lock/ledger/tickets/audit storage;
- bootstrap + seed + preflight scripts;
- deployment and handoff runbooks.

Still required before production go-live:

- final customer-facing purchase UI;
- real terminal integration handlers (current handlers are deterministic stubs).

## 4. Launch path

Read and execute in this order:

1. `docs/runbooks/deployment-bootstrap.md`
2. `docs/runbooks/launch-readiness-checklist.md`
3. `docs/handoff-runtime.md`

Templates:

- `.env.example`
- `ops/runtime/.env.web.template`
- `ops/runtime/.env.worker.template`
- `ops/runtime/hosts.template.json`

## 5. Main extension points

- Purchase UI replacement:
  - `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- Real terminal integration:
  - `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- New lottery onboarding:
  - `docs/modules/lottery-handler-extension.md`

## 6. Reading order for architecture context

1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/modules/system-architecture.md`
4. `docs/modules/boundary-catalog.md`
5. `docs/runbooks/launch-readiness-checklist.md`

