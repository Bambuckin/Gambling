# Current Working Contour

This document describes the current real operator-facing contour of the project after runtime reconciliation.

Use it when you need to understand what the system actually does today, not what earlier phase docs once intended.

## Scope

The documented contour is the current `bolshaya-8` working slice with:

- shared Postgres runtime between web and worker;
- purchase draft and confirmation in web UI;
- purchase only against open draws, including draws created manually from admin;
- queued request pickup by exactly one worker;
- manual draw handling by admin;
- explicit winning fulfillment split into wallet credit or cash desk;
- admin test cleanup controls for queue/runtime and empty-draw deletion;
- terminal-side visibility for consumed requests;
- result visibility, account summary, and notifications back on the user page.

## Main User Flow

### 1. Login and landing

- User authenticates through `apps/web/src/app/login/page.tsx`.
- Regular user lands on `/lottery/bolshaya-8`.
- Admin lands on `/admin`.

### 2. Ticket preparation

- The working user page is `apps/web/src/app/lottery/[lotteryCode]/page.tsx`.
- The page lets the user:
  - prepare a Big 8 draft;
  - select an open draw, including a draw created manually in admin;
  - confirm the request;
  - watch request status;
  - see canonical-first account totals in `Итоги по аккаунту`;
  - see purchase and result notifications;
  - see final ticket result after draw closure;
  - choose `Зачислить` or `В кассу` for a visible win.

### 3. Queueing

- After confirmation, web creates an awaiting-confirmation request and moves it into the shared purchase queue.
- Money reservation and request lifecycle stay on the shared runtime, not in page-local state.

### 4. Worker pickup

- `apps/terminal-worker/src/main.ts` runs the worker loop.
- In the current contour, Big 8 runs in mock-success mode by default unless `LOTTERY_BIG8_TERMINAL_MODE=real` is set explicitly.
- The worker reserves queued requests, executes the Big 8 terminal handler, and persists request/ticket progress into shared storage.
- Queue entries may disappear very quickly because the worker can reserve them immediately.
- In mock mode the worker no longer injects default Big 8 draws on its own. Purchase should target draws created from admin.

### 5. Admin result handling

- Admin uses `/admin`, implemented by `apps/web/src/app/admin/page.tsx`.
- Admin can:
  - see system summary;
  - inspect queue snapshot;
  - inspect terminal/last-request rows;
  - inspect problem requests, alerts, and recent operations audit;
  - create a draw manually and immediately expose it for purchase;
  - delete an empty test draw;
  - clear queued runtime state for tests;
  - reset test runtime state completely;
  - mark ticket as `win` or `lose`;
  - close cash-desk payouts;
  - inspect winnings-credit jobs;
  - close the draw.

### 6. User result visibility

- After draw closure, the user page shows ticket result state and claim state.
- The current page also shows live notifications about successful purchase and closed-draw result.
- The same page now exposes explicit fulfillment actions for winning tickets, while admin retains the cash-desk issuance control.

## Runtime Ownership

### Web app

Key files:

- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/terminal/receiver/page.tsx`
- `apps/web/src/app/api/admin/draws/route.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`

Web owns:

- role-aware route composition;
- draft preparation and confirmation actions;
- admin draw commands;
- open-draw filtering against draw closures;
- notification read-model presentation on the user page;
- read-model presentation for queue, tickets, receiver rows, account summary, and fulfillment actions.

Web does not own:

- terminal automation logic;
- terminal lock management;
- worker pickup loop.

### Worker app

Key files:

- `apps/terminal-worker/src/main.ts`
- `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts`

Worker owns:

- queue reservation and processing loop;
- terminal execution lock usage;
- Big 8 handler execution;
- ticket/verification follow-up work in the worker slice.

### Shared application layer

Key files:

- `packages/application/src/services/purchase-request-service.ts`
- `packages/application/src/services/purchase-orchestration-service.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/services/ticket-persistence-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/terminal-receiver-query-service.ts`
- `packages/application/src/services/admin-operations-query-service.ts`

Application layer owns:

- typed use-case services;
- request, queue, draw-closure, and ticket contracts;
- lifecycle orchestration between ports;
- canonical-first projections for admin, receiver, and user-facing read models.

### Infrastructure layer

Key files:

- `packages/infrastructure/src/postgres/postgres-purchase-store.ts`
- `packages/infrastructure/src/postgres/postgres-registry-draw-store.ts`
- `packages/infrastructure/src/postgres/postgres-schema.ts`
- `scripts/postgres-init-and-seed.ts`

Infrastructure owns:

- in-memory and Postgres adapters;
- shared schema and bootstrap/reset behavior;
- seed data and runtime persistence details.

## Shared Postgres State

The shared Postgres-backed contour now persists:

- identities and sessions;
- registry entries and draw snapshots;
- ledger entries and wallet state;
- purchase requests and queue items;
- canonical purchases, canonical draws, and purchase attempts;
- compatibility ticket rows when they still exist from older slices;
- draw closures;
- notifications;
- cash desk requests;
- winnings credit jobs;
- advisory terminal execution lock ownership outside the old lock table.

This is why web and worker can observe the same request/ticket/draw state across processes.

## Admin And Terminal Visibility Rules

### Queue is not the whole truth

An operator must not interpret an empty queue as a failed purchase by itself.

Reason:

- queue item can be reserved immediately by the worker;
- once reserved, queue depth can drop to zero;
- the request may already be visible in terminal rows or on `/terminal/receiver`.

### Terminal receiver page

`/terminal/receiver` exists as the fastest proof that a confirmed request reached the terminal side.

Use it when:

- admin says the queue is empty;
- you need to verify cross-process visibility;
- you need a simpler view than the full admin page.

## Current UI Contract

### `/lottery/bolshaya-8`

Intentionally exposed:

- draft creation;
- draw selection;
- request confirmation;
- request status timeline;
- canonical-first `Итоги по аккаунту`;
- notification feed for purchase/result events;
- ticket result table;
- explicit `Зачислить` and `В кассу` actions for winning tickets.

Intentionally not exposed:

- wallet movement history table.
- a separate dedicated payout page;
- a separate cabinet route beyond the lottery page.

### `/admin`

Intentionally exposed:

- system summary;
- queue snapshot;
- terminal/last requests;
- problem requests, alerts, and recent operations audit;
- manual draw creation;
- empty draw deletion;
- cash-desk payout issuance;
- winnings-credit job visibility;
- queue cleanup and full test runtime reset;
- ticket mark and draw closure controls.

### `/terminal/receiver`

Intentionally exposed:

- live terminal-side receipt/status list.

## Known Gaps

- NLoto selector hardening is still open.
- Security hardening remains follow-up work, not current contour.

## Where To Continue Safely

If you need to extend the current slice, start here:

1. `docs/handoff-runtime.md`
2. `docs/runbooks/current-working-contour-smoke.md`
3. `docs/runbooks/deployment-bootstrap.md`
4. `docs/handoff/big8-current-wave/README.md`
5. `.planning/STATE.md`
