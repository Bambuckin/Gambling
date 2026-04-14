# @lottery/web

Next.js runtime for the human-facing part of the system.

## What This App Owns

- landing page and login flow;
- user lottery page and purchase confirmation flow;
- admin console;
- debug/verification pages;
- JSON endpoints used by polling widgets and verification screens;
- runtime composition of access, registry, draw, ledger, purchase, ticket, observability, and terminal health services.

It does not own domain rules, queue logic, ledger mutation rules, or terminal automation details.

## Key Directories

- `src/app/` - page routes, route handlers, and server actions
- `src/lib/access/` - access/session runtime composition and guards
- `src/lib/draw/` - draw refresh runtime composition
- `src/lib/ledger/` - wallet projection runtime composition
- `src/lib/purchase/` - purchase/admin queue/query composition plus live monitors
- `src/lib/registry/` - registry runtime and admin mutation helpers
- `src/lib/ticket/` - ticket query runtime composition
- `src/lib/observability/` - operations audit/alert composition
- `src/lib/terminal/` - terminal health projection composition
- `src/lib/lottery-form/` - dynamic form rendering, including Big 8 UI
- `src/lib/ui/` - lottery presentation presets

## Route Map

Primary pages:

- `/` - lottery shell
- `/login`
- `/lottery/[lotteryCode]`
- `/admin`
- `/terminal/receiver`

Verification pages:

- `/debug/access-lab`
- `/debug/admin-ops-lab`
- `/debug/mock-terminal`
- `/debug/purchase-lab`
- `/debug/registry-lab`
- `/debug/terminal-lab`
- `/debug/ticket-lab`
- `/debug/wallet-lab`

JSON endpoints:

- `/api/lottery/[lotteryCode]/draws`
- `/api/lottery/[lotteryCode]/requests`
- `/api/admin/operations`
- `/api/debug/mock-terminal/inbox`
- `/api/terminal/receiver/inbox`

See `docs/API.md` for the route-level details.

## Important Entry Files

- `src/app/page.tsx` - landing shell
- `src/app/login/page.tsx` - login form and submit action
- `src/app/lottery/[lotteryCode]/page.tsx` - main purchase page and user write actions
- `src/app/admin/page.tsx` - admin write actions and operations view
- `src/lib/access/access-runtime.ts` - identities, sessions, password verification wiring
- `src/lib/purchase/purchase-runtime.ts` - request, queue, and admin services wiring
- `src/lib/registry/registry-runtime.ts` - registry source and seed parsing
- `src/lib/draw/draw-runtime.ts` - draw freshness source
- `src/lib/ledger/ledger-runtime.ts` - wallet projection source

## How Data Gets In

- route handlers and server actions call runtime composition helpers in `src/lib/`
- composition helpers instantiate services from `@lottery/application`
- services use in-memory or Postgres adapters from `@lottery/infrastructure`

If you need new behavior, add it to application/domain first and let the web app compose it.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/web test
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/web build
```

## Related Docs

- `docs/API.md`
- `docs/DEVELOPMENT.md`
- `docs/modules/ui-customization.md`
- `docs/runbooks/admin-operations-console.md`
