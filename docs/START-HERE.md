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
- `apps/terminal-worker` - queue loop, terminal lock, execution attempts, Big 8 terminal purchase, winnings credit.
- `packages/domain` - lifecycle contracts and state rules.
- `packages/application` - use-case services and ports.
- `packages/infrastructure` - concrete adapters (`in-memory` and `postgres`).
- `packages/lottery-handlers` - deterministic handler contracts and registry.
- workspace-level maps:
  - `apps/web/README.md`
  - `apps/terminal-worker/README.md`
  - `packages/domain/README.md`
  - `packages/application/README.md`
  - `packages/infrastructure/README.md`
  - `packages/lottery-handlers/README.md`
  - `packages/test-kit/README.md`

## 3. What is done vs missing

Implemented:

- shared Postgres runtime for web + worker;
- persisted queue/lock/ledger/tickets/audit storage;
- bootstrap + seed + preflight scripts;
- current working contour for Big 8: login -> draft -> queue -> worker pickup -> admin draw closure -> visible result -> credit or cash-desk fulfillment;
- deployment and handoff runbooks.

Still required before production go-live:

- real terminal integration handlers (current handlers are deterministic stubs).

## 4. Launch path

Read and execute in this order:

1. `docs/runbooks/deployment-bootstrap.md`
2. `docs/modules/current-working-contour.md`
3. `docs/runbooks/current-working-contour-smoke.md`
4. `docs/runbooks/launch-readiness-checklist.md`
5. `docs/handoff-runtime.md`

If you need copyable folders for handoff:

- build `dist/lan-bundles/client-workstation` for cashier/client PCs;
- build `dist/lan-bundles/terminal-receiver` for the terminal PC.

Templates:

- `.env.example`
- `ops/runtime/.env.web.template`
- `ops/runtime/.env.worker.template`
- `ops/runtime/hosts.template.json`

## 5. Main extension points

- Purchase UI replacement:
  - `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
  - `apps/web/src/lib/ui/lottery-presentation.ts`
  - `apps/web/src/app/styles.css`
- Real terminal integration:
  - `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- New lottery onboarding:
  - `docs/modules/lottery-handler-extension.md`

## 6. Reading order for architecture context

1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/modules/system-architecture.md`
4. `docs/modules/current-working-contour.md`
5. `docs/modules/boundary-catalog.md`
6. `docs/CONFIGURATION.md`
7. `docs/API.md`
8. `docs/DEVELOPMENT.md`
9. `docs/TESTING.md`
10. `docs/runbooks/launch-readiness-checklist.md`
