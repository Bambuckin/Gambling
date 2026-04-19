# Current Working Contour Smoke

Use this runbook to verify the current real contour from user request creation to admin draw closure and visible result.

## Goal

Prove that the current working slice still does the following:

1. user prepares and confirms a ticket;
2. request enters shared runtime;
3. worker picks it up;
4. admin sees it and manages draw result;
5. user sees the final result.
6. user sees the purchase/result notification on the same lottery page.

## Preconditions

- web runtime is started;
- worker runtime is started;
- shared Postgres is reachable if `LOTTERY_STORAGE_BACKEND=postgres`;
- seeded login credentials are available;
- for the current mock contour, create the draw manually from `/admin` before buying.

Note:

- direct worker launch through `pnpm start:worker` or `pnpm dev:worker` now auto-loads repository `.env`;
- Big 8 mock mode is the default unless `LOTTERY_BIG8_TERMINAL_MODE=real` is set explicitly;
- in mock mode the worker does not auto-create default purchasable draws anymore;
- if the worker is not running at all, queued requests will remain in `queued` and admin will show terminal idle.

## Step 1. Admin creates a test draw

1. Open `/admin`.
2. Create a draw manually for `bolshaya-8`.

Expected:

- the new draw appears in the open draws block;
- the same draw becomes available on `/lottery/bolshaya-8`;
- if old test noise exists, admin can delete empty draws or use runtime cleanup controls before continuing.

## Step 2. User creates a request

1. Open `/login`.
2. Log in as a regular user.
3. Open `/lottery/bolshaya-8`.
4. Select the manually created open draw.
5. Prepare a ticket.
5. Confirm the request.

Expected:

- request appears on the page in request history;
- purchase notification appears after emulated successful purchase;
- status becomes queued, executing, retrying, cart-stage, or success depending on worker timing;
- no server error or missing-draw error appears unless the draw actually became unavailable.

## Step 3. Operator confirms terminal-side visibility

Check both:

1. `/admin`
2. `/terminal/receiver`

Expected:

- request is visible either in queue snapshot or in terminal/last-request rows;
- if queue is already empty, the request may still be visible on terminal side;
- empty queue alone is not a failure.

## Step 4. Admin marks ticket outcome

1. Stay on `/admin`.
2. Find the draw row and the purchased ticket.
3. Mark the ticket as `win` or `lose`.

Expected:

- mark is accepted without page crash;
- ticket row reflects the pre-closure mark.

## Step 5. Admin closes the draw

1. Close the draw from the same admin page.

Expected:

- open draw becomes closed;
- tickets in that draw receive final outcome state;
- user notifications are created for closed-draw result;
- repeated close attempt should not silently mutate already-closed draw state.

## Step 6. User sees final result

1. Return to `/lottery/bolshaya-8` as the same user.

Expected:

- notification block shows whether the ticket won or not;
- ticket result appears in the ticket table;
- result source and claim state are visible;
- user does not need a separate notification screen for this contour because the lottery page already shows the feed.

## Failure Triage

### Request not visible in queue

Check `/terminal/receiver` and terminal/last-request rows on `/admin`.

Most likely explanation:

- worker already reserved the request.

### Admin page shows no draw controls

Check:

- you are logged in as admin;
- draw data exists or can be created manually;
- stale test state was not left behind; if needed use queue cleanup or full runtime reset.

### Result not visible after closure

Check:

- ticket belongs to the same user;
- draw was actually closed;
- notification feed on the lottery page refreshed;
- worker and web use the same storage backend and database.

## Useful Commands

```powershell
corepack pnpm runtime:preflight
corepack pnpm runtime:doctor:queue
corepack pnpm db:init
corepack pnpm typecheck
corepack pnpm --filter @lottery/web build
```

## Related Docs

- `docs/modules/current-working-contour.md`
- `docs/handoff-runtime.md`
- `docs/runbooks/deployment-bootstrap.md`
