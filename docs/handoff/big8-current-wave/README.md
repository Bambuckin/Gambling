# Big 8 Current Wave Handoff

**Status:** implemented, runtime-reconciled  
**Prepared:** 2026-04-17

## What Is Live In The Current Slice

- Regular user logs in and lands on `bolshaya-8`.
- The purchase path is: draft -> confirm -> queue -> worker pickup -> cart-stage or final success.
- Manual draw handling is operator-driven: admin creates draw when needed, marks purchased tickets as `win` or `lose`, then closes the draw.
- Ticket results are visible back on the user page after draw closure.
- Shared Postgres state is used across web and worker for draw closures, notifications, cash desk requests, and winnings credit jobs in addition to the earlier queue/ticket/ledger/runtime entities.

## Current UI Contract

- `/admin` is the operator cockpit: system summary, queue snapshot, terminal/last requests, manual draw management.
- `/terminal/receiver` is the simple terminal-side receipt view.
- `/lottery/bolshaya-8` is intentionally trimmed down to ticket creation, queue/request tracking, and ticket results.
- The direct user notification widget and direct payout buttons are intentionally hidden for now to keep the page simpler and avoid promising a flow that the operator is not using on-screen.

## Operator Notes

- Do not treat queue depth as the only signal. A request can disappear from the queue almost instantly because the worker already reserved it. Check the terminal/last-requests block on `/admin` or open `/terminal/receiver`.
- `added_to_cart` is still an honest intermediate state. It means the worker reached the cart stage, not that final checkout happened.
- Backend payout plumbing still exists, but payout is not part of the simplified user-facing contour right now.

## Read-First Code Map

- `apps/terminal-worker/src/main.ts`
- `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/services/ticket-persistence-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts`
- `packages/infrastructure/src/postgres/postgres-registry-draw-store.ts`
- `packages/infrastructure/src/postgres/postgres-schema.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/api/admin/draws/route.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/app/terminal/receiver/page.tsx`

## Validation Baseline

These are the current useful checks for this slice:

```powershell
corepack pnpm typecheck
corepack pnpm --filter @lottery/web build
corepack pnpm runtime:preflight
corepack pnpm db:init
```

When validating end-to-end behavior, smoke the real contour:

1. Create and confirm a ticket.
2. Verify that it either appears in queue or immediately appears in the terminal/last-requests block.
3. Mark the ticket `win` or `lose` in `/admin`.
4. Close the draw and confirm the result is visible on the user page.

## Still Open

- Final checkout/payment automation after cart stage.
- Selector hardening against NLoto DOM drift.
- Optional hardening for credentials, transport security, and expanded roles.
